/**
 * Chiedilo a Pinuzza — ricerca dal vivo negli atti del Comune di Palermo.
 *
 * Due portali, una sola ricerca. Sono lo stesso motore SISPI in due installazioni:
 *
 *  - Albo Pretorio (albopretorio.comune.palermo.it): ciò che è pubblicato adesso,
 *    con tutti i tipi di atto (delibere, determinazioni, ordinanze, bandi, gare,
 *    convocazioni, matrimoni). Alla scadenza della pubblicazione l'atto sparisce.
 *  - Delibere e Ordinanze (servizionline.comune.palermo.it, SERCOD=60): l'archivio
 *    delle delibere di Giunta, Consiglio e Comitato dei Sindaci, delle determinazioni
 *    e ordinanze sindacali e commissariali.
 *
 * I due si sovrappongono: una delibera in pubblicazione compare in entrambi con lo
 * stesso `ALBCOD` (il codice del «link permanente»), quindi si deduplica per link.
 *
 * Perché serve un Worker: la ricerca di quei portali è un POST con lo stato in
 * sessione, i due host non mandano `Access-Control-Allow-Origin` e rispondono
 * `X-Frame-Options: sameorigin`. Dal browser della pagina statica non si può né
 * chiamarli né incorporarli. Qui la sessione la teniamo noi, per una sola ricerca:
 * nessun dato viene salvato.
 *
 * Il flusso, per ogni tipo di atto:
 *   1. GET  /<portale>/pu/push-tabella-delibere.do?nomeTabella=…&TD=…  (apre la sessione)
 *   2. POST /<portale>/dbmanager/tabella-ricerca.do                     (esegue la ricerca)
 *   3. GET  /<portale>/dbmanager/tabella-modifica.do?row=N              (legge il link permanente)
 *
 * Tre comportamenti del portale, scoperti provando, che qui sono gestiti:
 *  - se la ricerca trova **un solo** atto salta direttamente alla scheda, senza elenco;
 *  - le colonne cambiano da tabella a tabella (le ordinanze non hanno il numero di
 *    protocollo, l'Albo ha anche le date di pubblicazione): si leggono le intestazioni;
 *  - la ricerca e la scheda rispondono `302` verso `home.jsp?modo=tabella`, quindi
 *    ogni passo costa **due** subrequest: il bilancio qui sotto le conta tutte.
 */

const UA = 'Chiedilo-a-Pinuzza/1.0 (+https://palermohub.github.io/cosa_fare_per/)';
const CACHE_RICERCA = 600; // secondi: la stessa ricerca non torna al Comune
const MAX_RISULTATI = 10;
const MAX_Q = 80;
const PARALLELE = 8;
// Il piano Workers gratuito dà 50 subrequest per invocazione (la Cache API conta
// come subrequest) e 10 ms di CPU: stiamo larghi e, se il bilancio finisce, si
// smette di interrogare tipi invece di far fallire tutta la ricerca.
const BUDGET_SUBREQUEST = 46;

const PORTALI = {
  albo: {
    nome: 'Albo Pretorio',
    servizio: 'https://albopretorio.comune.palermo.it/albopretorio/jsp/home.jsp?modo=info&info=servizi.jsp',
    base: 'https://albopretorio.comune.palermo.it/albopretorio',
    ap: true,
    campoAnno: 'ALB_DESANNOPROT',
    campoNumero: 'ALB_NUMPROT',
    campoOggetto: 'ALB_DESOGGETTO',
    campoExtra: { SET_COD: '' },
  },
  archivio: {
    nome: 'Delibere e Ordinanze',
    servizio: 'https://servizionline.comune.palermo.it/portcitt/jsp/home.jsp?modo=info&info=servizi.jsp&SERCOD=60&SERCODROOT=60',
    base: 'https://servizionline.comune.palermo.it/portcitt',
    ap: false,
    campoAnno: 'ALB_DESANNOPROT',
    campoNumero: 'ALB_NUMPROT',
    campoOggetto: 'ALB_DESOGGETTO',
    campoExtra: {},
  },
};

// Un tipo di atto = una vista del portale. `gruppi` dice in quali scelte compare.
// L'ordine conta: quando il bilancio non basta si interrogano i primi.
const TIPI = [
  // —— delibere: l'archivio è più completo dell'Albo, che tiene solo le ultime settimane
  { id: 'dgc', nome: 'Delibere di Giunta', portale: 'archivio', tabella: 'FO_SCEDELIBERE', td: 'DGC', sercod: '6000', gruppi: ['delibere', 'tutti'] },
  { id: 'dcc', nome: 'Delibere di Consiglio', portale: 'archivio', tabella: 'FO_SCEDELIBERE', td: 'DCC', sercod: '6010', gruppi: ['delibere', 'tutti'] },
  { id: 'dcs', nome: 'Delibere del Comitato dei Sindaci', portale: 'archivio', tabella: 'FO_SCEDELIBERE', td: 'DCS', sercod: '6017', gruppi: ['delibere', 'tutti'] },
  { id: 'circ', nome: 'Delibere di Circoscrizione', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '1037940907', gruppi: ['delibere', 'tutti'] },

  // —— determinazioni e ordinanze
  { id: 'det', nome: 'Determinazioni dirigenziali', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2010', gruppi: ['determinazioni', 'tutti'] },
  { id: 'od', nome: 'Ordinanze dirigenziali', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2012', gruppi: ['ordinanze', 'tutti'] },
  { id: 'os', nome: 'Determinazioni e ordinanze sindacali', portale: 'archivio', tabella: 'FO_SCEALBOPRETORIO', td: 'OS', sercod: '6020', gruppi: ['ordinanze', 'tutti'] },
  { id: 'dco', nome: 'Determinazioni e ordinanze commissariali', portale: 'archivio', tabella: 'FO_SCEALBOPRETORIO', td: 'DCO', sercod: '6021', gruppi: ['ordinanze', 'tutti'] },

  // —— bandi, avvisi, gare: solo sull'Albo
  { id: 'b-concorso', nome: 'Bandi di concorso', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2021', gruppi: ['bandi'] },
  { id: 'b-pubblici', nome: 'Avvisi pubblici', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '1041037357', gruppi: ['bandi'] },
  { id: 'b-creditori', nome: 'Avvisi ai creditori', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '1039137602', gruppi: ['bandi'] },
  { id: 'b-opponendum', nome: 'Avvisi ad opponendum', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2025', gruppi: ['bandi'] },
  { id: 'g-avviso', nome: 'Avvisi di gara', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2013', gruppi: ['gare'] },
  { id: 'g-bando', nome: 'Bandi di gara', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '1050094620', gruppi: ['gare'] },
  { id: 'g-esito', nome: 'Esiti di gara', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2018', gruppi: ['gare'] },
  { id: 'g-asta', nome: 'Aste pubbliche', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '1038293858', gruppi: ['gare'] },
  { id: 'c-circ', nome: 'Convocazioni di circoscrizione', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2047', gruppi: ['convocazioni'] },
  { id: 'c-comm', nome: 'Convocazioni di commissione', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2046', gruppi: ['convocazioni'] },
  { id: 'c-odg', nome: 'Ordini del giorno', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2063', gruppi: ['convocazioni'] },
  { id: 'matrimoni', nome: 'Pubblicazioni di matrimonio', portale: 'albo', tabella: 'FO_SCEDELIBEREAP', td: '2014', gruppi: ['matrimoni'] },
];

// Le voci del menù «tipo». `tutti` è il predefinito.
const GRUPPI = {
  tutti: { nome: 'Tutti gli atti', tipi: ['dgc', 'dcc', 'dcs', 'circ', 'det', 'od', 'os', 'dco'] },
  delibere: { nome: 'Delibere', tipi: ['dgc', 'dcc', 'dcs', 'circ'] },
  determinazioni: { nome: 'Determinazioni', tipi: ['det'] },
  ordinanze: { nome: 'Ordinanze', tipi: ['od', 'os', 'dco'] },
  bandi: { nome: 'Bandi e avvisi', tipi: ['b-concorso', 'b-pubblici', 'b-creditori', 'b-opponendum'] },
  gare: { nome: 'Gare e appalti', tipi: ['g-avviso', 'g-bando', 'g-esito', 'g-asta'] },
  convocazioni: { nome: 'Convocazioni', tipi: ['c-circ', 'c-comm', 'c-odg'] },
  matrimoni: { nome: 'Matrimoni', tipi: ['matrimoni'] },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(dati, stato = 200, extra = {}) {
  return new Response(JSON.stringify(dati), {
    status: stato,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS, ...extra },
  });
}

function spendi(contesto) {
  contesto.spese += 1;
  if (contesto.spese > BUDGET_SUBREQUEST) {
    const errore = new Error('FUORI_BILANCIO');
    errore.fuoriBilancio = true;
    throw errore;
  }
}

/** Un client minimo con i cookie: tiene la JSESSIONID per la durata di una ricerca. */
function client(base, contesto) {
  const barattolo = new Map();

  function assorbiCookies(risposta) {
    let righe = [];
    if (typeof risposta.headers.getSetCookie === 'function') {
      righe = risposta.headers.getSetCookie();
    } else {
      const sola = risposta.headers.get('set-cookie');
      if (sola) righe = sola.split(/,(?=[^;=]+=)/);
    }
    for (const riga of righe) {
      const coppia = String(riga).split(';')[0];
      const taglio = coppia.indexOf('=');
      if (taglio > 0) barattolo.set(coppia.slice(0, taglio).trim(), coppia.slice(taglio + 1).trim());
    }
  }

  async function richiesta(percorso, form) {
    const testate = new Headers({
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
    });
    if (barattolo.size) testate.set('Cookie', [...barattolo].map(([k, v]) => `${k}=${v}`).join('; '));
    let corpo;
    if (form) {
      testate.set('Content-Type', 'application/x-www-form-urlencoded');
      corpo = new URLSearchParams(form).toString();
    }
    spendi(contesto);
    let risposta = await fetch(base + percorso, {
      method: form ? 'POST' : 'GET',
      headers: testate,
      body: corpo,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    assorbiCookies(risposta);
    // i portali rispondono 302 verso home.jsp?modo=tabella: il salto conta come subrequest
    if (risposta.status >= 300 && risposta.status < 400) {
      const destinazione = new URL(risposta.headers.get('location') || '', base).toString();
      spendi(contesto);
      risposta = await fetch(destinazione, {
        method: 'GET',
        headers: testate,
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      assorbiCookies(risposta);
    }
    return risposta.text();
  }

  return { html: richiesta };
}

const ENTITA = { '&#39;': "'", '&apos;': "'", '&quot;': '"', '&amp;': '&', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&agrave;': 'à', '&egrave;': 'è', '&eacute;': 'é', '&igrave;': 'ì', '&ograve;': 'ò', '&ugrave;': 'ù', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&ndash;': '–', '&mdash;': '—', '&deg;': '°', '&euro;': '€' };

function testo(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-zA-Z]+;/g, (m) => (ENTITA[m] !== undefined ? ENTITA[m] : m))
    .replace(/\s+/g, ' ')
    .trim();
}

function dataIt(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0;
}

function valoreCampo(html, campo) {
  const input = new RegExp(`name='${campo}'[^>]*value='([^']*)'`).exec(html);
  if (input) return testo(input[1]);
  const area = new RegExp(`name='${campo}'[^>]*>([\\s\\S]*?)</textarea>`).exec(html);
  if (area) return testo(area[1]);
  // molti tipi di atto mostrano l'oggetto in un div con lo stesso id, non in un campo
  const div = new RegExp(`<div[^>]*id=['"]${campo}['"][^>]*>([\\s\\S]*?)</div>`).exec(html);
  return div ? testo(div[1]) : '';
}

function intestazioni(html) {
  const thead = /<thead[\s\S]*?<\/thead>/.exec(html);
  if (!thead) return [];
  return [...thead[0].matchAll(/<div class='title[^']*'>([\s\S]*?)<\/div>/g)].map((m) => testo(m[1]).toLowerCase());
}

function righeTabella(html) {
  const titoli = intestazioni(html);
  const iOggetto = titoli.findIndex((t) => /oggetto/.test(t));
  const iNumero = titoli.findIndex((t) => /(numero|protocollo)/.test(t) && !/data/.test(t));
  const iData = titoli.findIndex((t) => /data.*protocollo/.test(t)) >= 0
    ? titoli.findIndex((t) => /data.*protocollo/.test(t))
    : titoli.findIndex((t) => /^data/.test(t));
  const iInizio = titoli.findIndex((t) => /inizio pubblicazione/.test(t));
  const iFine = titoli.findIndex((t) => /fine pubblicazione/.test(t));

  const righe = [];
  const re = /<tr class='(?:color|alterno)'>\s*<td class='row_head'><a href='[^']*row=(\d+)'[^>]*><span>\d+<\/span><\/a>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    const celle = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => testo(c[1]));
    if (celle.length < 2) continue;
    const prendi = (i) => (i >= 0 ? celle[i - 1] || '' : '');
    righe.push({
      row: Number(m[1]),
      conNumero: iNumero >= 0,
      numero: prendi(iNumero),
      data: prendi(iData),
      oggetto: prendi(iOggetto) || celle.reduce((a, b) => (b.length > a.length ? b : a), ''),
      inizio: prendi(iInizio),
      fine: prendi(iFine),
    });
  }
  return righe;
}

function totaleRighe(html) {
  const m = /N\.ro righe ([\d.]+)/.exec(html);
  return m ? Number(m[1].replace(/\./g, '')) : 0;
}

/** La scheda di un atto: link permanente, oggetto completo, date, numero di allegati. */
function scheda(html) {
  const codice = /testoCodiceIpa\s*=\s*'([^']+)'/.exec(html);
  const link = codice ? codice[1].replace(/&amp;/g, '&') : '';
  return {
    _inizio: link ? '' : testo(html).slice(0, 180),
    link: link && /ALBCOD=/.test(link) ? link : '',
    numero: valoreCampo(html, 'ALB_NUMPROT'),
    data: valoreCampo(html, 'ALB_DATPROT'),
    oggetto: valoreCampo(html, 'ALB_DESOGGETTO'),
    inizio: valoreCampo(html, 'ALB_DATINIPUB'),
    fine: valoreCampo(html, 'ALB_DATFINPUB'),
    settore: valoreCampo(html, 'SET_DESSETTORE') || valoreCampo(html, 'SET_COD_DECODIFICATO') || valoreCampo(html, 'SET_DES'),
    allegati: (html.match(/viewDocument\?col=ALLEGATI/g) || []).length,
  };
}

/** Esegue `azione` su tutti gli elementi, al massimo `limite` alla volta. */
async function aPool(elementi, limite, azione) {
  const esiti = new Array(elementi.length);
  let prossimo = 0;
  const operai = Array.from({ length: Math.min(limite, elementi.length) }, async () => {
    while (prossimo < elementi.length) {
      const i = prossimo++;
      try {
        esiti[i] = { ok: true, valore: await azione(elementi[i], i) };
      } catch (errore) {
        esiti[i] = { ok: false, errore: String((errore && errore.message) || errore) };
      }
    }
  });
  await Promise.all(operai);
  return esiti;
}

async function cercaTipo(tipo, parametri, contesto) {
  const portale = PORTALI[tipo.portale];
  const c = client(portale.base, contesto);
  const query = new URLSearchParams({ nomeTabella: tipo.tabella, TD: tipo.td });
  if (portale.ap) query.set('AP', 'AP');
  if (tipo.sercod) query.set('SERCOD', tipo.sercod);

  const apertura = await c.html(`/pu/push-tabella-delibere.do?${query}`);
  if (apertura.length < 2000 || /Servizio temporaneamente non disponibile/i.test(apertura)) {
    return { tipo, totale: 0, righe: [], guasto: true };
  }

  // senza testo, anno né numero si mostra l'elenco: la pagina di apertura basta
  if (!parametri.q && !parametri.anno && !parametri.numero) {
    return { tipo, totale: totaleRighe(apertura), righe: righeTabella(apertura), client: c };
  }

  const form = {
    [portale.campoAnno]: parametri.anno || '',
    [portale.campoNumero]: parametri.numero || '',
    [portale.campoOggetto]: parametri.q || '',
    ...portale.campoExtra,
    siglaStato: 'F',
    row: '0',
    chiave: '',
    provieneDa: '',
  };
  const html = await c.html('/dbmanager/tabella-ricerca.do', form);
  if (/Servizio temporaneamente non disponibile/i.test(html)) {
    return { tipo, totale: 0, righe: [], guasto: true };
  }

  // Un solo risultato: il portale salta alla scheda, senza elenco.
  if (/record\s*1\s*di\s*1/.test(html) || /id=['"]LINKPERMANENTE['"]/.test(html)) {
    const s = scheda(html);
    return {
      tipo,
      totale: 1,
      righe: [{ row: null, conNumero: true, numero: s.numero, data: s.data, oggetto: s.oggetto, inizio: s.inizio, fine: s.fine, scheda: s }],
      client: c,
    };
  }

  return { tipo, totale: totaleRighe(html), righe: righeTabella(html), client: c };
}

async function cerca(gruppo, parametri, contesto) {
  const scelta = GRUPPI[gruppo] || GRUPPI.tutti;
  let tipi = scelta.tipi.map((id) => TIPI.find((t) => t.id === id)).filter(Boolean);

  // con il testo la ricerca costa 3 subrequest per tipo più 2 per scheda: se il
  // gruppo è grande si comincia dai primi tipi, e lo si dice nel risultato
  const conTesto = Boolean(parametri.q || parametri.anno || parametri.numero);
  const costo = conTesto ? 3 : 1;
  const perDettagli = MAX_RISULTATI * 2;
  const entroBilancio = Math.max(1, Math.floor((BUDGET_SUBREQUEST - perDettagli - 2) / costo));
  const saltatiPerBilancio = Math.max(0, tipi.length - entroBilancio);
  if (saltatiPerBilancio) tipi = tipi.slice(0, entroBilancio);

  let esiti = await aPool(tipi, PARALLELE, (tipo) => cercaTipo(tipo, parametri, contesto));

  const guasti = esiti.map((esito, i) => ({ esito, tipo: tipi[i] })).filter(({ esito }) => !esito.ok || esito.valore.guasto);
  const margine = BUDGET_SUBREQUEST - contesto.spese;
  if (guasti.length && margine >= 6) {
    const daRipetere = guasti.slice(0, Math.floor(margine / 6));
    await aPool(daRipetere, 3, async ({ tipo }) => {
      const i = tipi.indexOf(tipo);
      try {
        const secondo = await cercaTipo(tipo, parametri, contesto);
        if (!secondo.guasto) esiti[i] = { ok: true, valore: secondo };
      } catch (errore) {
        /* resta guasto */
      }
    });
  }

  const righe = [];
  let totale = 0;
  let nonDisponibili = 0;
  let nonInterrogati = saltatiPerBilancio;
  const elencoTipi = [];
  esiti.forEach((esito, i) => {
    const tipo = tipi[i];
    if (!esito.ok && String(esito.errore).includes('FUORI_BILANCIO')) {
      nonInterrogati++;
      elencoTipi.push({ tipo: tipo.nome, totale: 0, saltato: true });
      return;
    }
    if (!esito.ok || esito.valore.guasto) {
      nonDisponibili++;
      elencoTipi.push({ tipo: tipo.nome, totale: 0, guasto: true });
      return;
    }
    const r = esito.valore;
    totale += r.totale;
    elencoTipi.push({ tipo: tipo.nome, totale: r.totale });
    for (const riga of r.righe) righe.push({ ...riga, tipo, client: r.client });
  });

  righe.sort((a, b) => dataIt(b.data) - dataIt(a.data));

  // lo stesso atto può comparire due volte (Albo e archivio, o due pubblicazioni)
  const viste = new Set();
  const uniche = righe.filter((riga) => {
    const impronta = `${riga.numero}|${riga.data}|${riga.oggetto.slice(0, 60)}`;
    if (viste.has(impronta)) return false;
    viste.add(impronta);
    return true;
  });
  const prime = uniche.slice(0, MAX_RISULTATI);

  // una scheda alla volta per sessione: il portale tiene il «record corrente» nella
  // sessione, quindi due richieste in parallelo sulla stessa sessione leggono lo stesso atto
  const quantiDettagli = Math.max(0, Math.floor((BUDGET_SUBREQUEST - contesto.spese - 2) / 2));
  const daLeggere = prime.filter((r) => !r.scheda).slice(0, quantiDettagli);
  const perSessione = new Map();
  for (const riga of daLeggere) {
    if (!perSessione.has(riga.client)) perSessione.set(riga.client, []);
    perSessione.get(riga.client).push(riga);
  }
  const schedePerRiga = new Map();
  await Promise.all([...perSessione.values()].map(async (gruppo) => {
    for (const riga of gruppo) {
      try {
        schedePerRiga.set(riga, scheda(await riga.client.html(`/dbmanager/tabella-modifica.do?row=${riga.row}`)));
      } catch (errore) {
        schedePerRiga.set(riga, null);
      }
    }
  }));

  const risultati = [];
  const visti = new Set();
  prime.forEach((riga) => {
    const s = riga.scheda || schedePerRiga.get(riga) || {};
    const oggetto = s.oggetto || riga.oggetto;
    // nei tipi senza colonna «numero» (ordinanze) il numero sta nell'oggetto: «O.S. N. 185 DEL…»
    const daOggetto = (/(?:N\.|NUM\.|N°)\s*0*(\d{1,5})/i.exec(oggetto) || [])[1] || '';
    const voce = {
      tipo: riga.tipo.nome,
      portale: PORTALI[riga.tipo.portale].nome,
      numero: riga.conNumero === false ? daOggetto : s.numero || riga.numero || daOggetto,
      data: s.data || riga.data,
      oggetto,
      pubblicato: s.inizio || riga.inizio || '',
      scade: s.fine || riga.fine || '',
      settore: s.settore || '',
      allegati: s.allegati || 0,
      link: s.link || '',
    };
    const impronta = voce.link || `${voce.numero}|${voce.data}|${voce.oggetto.slice(0, 60)}`;
    if (visti.has(impronta)) return;
    visti.add(impronta);
    risultati.push(voce);
  });

  return { totale, risultati, guasti: nonDisponibili, saltati: nonInterrogati, tipi: tipi.length, elencoTipi };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return json({ errore: 'Metodo non consentito' }, 405);

    // Diagnostica: il Comune risponde a un IP Cloudflare?
    if (url.pathname === '/prova') {
      const esiti = {};
      for (const [chiave, portale] of Object.entries(PORTALI)) {
        const inizio = Date.now();
        try {
          const primo = TIPI.find((t) => t.portale === chiave);
          const q = new URLSearchParams({ nomeTabella: primo.tabella, TD: primo.td });
          if (portale.ap) q.set('AP', 'AP');
          if (primo.sercod) q.set('SERCOD', primo.sercod);
          const html = await client(portale.base, { spese: 0 }).html(`/pu/push-tabella-delibere.do?${q}`);
          esiti[chiave] = { ms: Date.now() - inizio, righe: totaleRighe(html), bloccato: /Servizio temporaneamente non disponibile/i.test(html) };
        } catch (e) {
          esiti[chiave] = { errore: String((e && e.message) || e), ms: Date.now() - inizio };
        }
      }
      return json({ ok: Object.values(esiti).every((e) => !e.errore && !e.bloccato), esiti });
    }

    if (url.pathname === '/tipi') {
      return json({ gruppi: Object.fromEntries(Object.entries(GRUPPI).map(([k, v]) => [k, v.nome])), portali: Object.fromEntries(Object.entries(PORTALI).map(([k, v]) => [k, { nome: v.nome, servizio: v.servizio }])) });
    }

    if (url.pathname !== '/cerca') {
      return json({
        nome: 'Chiedilo a Pinuzza — atti del Comune di Palermo',
        uso: '/cerca?tipo=tutti|delibere|determinazioni|ordinanze|bandi|gare|convocazioni|matrimoni&q=parole&anno=2026&numero=360&recenti=1',
        prova: '/prova',
        tipi: '/tipi',
      });
    }

    const tipo = Object.prototype.hasOwnProperty.call(GRUPPI, url.searchParams.get('tipo')) ? url.searchParams.get('tipo') : 'tutti';
    const q = (url.searchParams.get('q') || '').slice(0, MAX_Q).replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    const anno = /^\d{4}$/.test(url.searchParams.get('anno') || '') ? url.searchParams.get('anno') : '';
    const numero = (url.searchParams.get('numero') || '').slice(0, 12).replace(/[^\d/\-]/g, '');

    if (!q && !anno && !numero && !url.searchParams.get('recenti')) {
      return json({ errore: 'Scrivi una parola, oppure indica un anno o un numero di protocollo' }, 400);
    }

    const chiave = `cerca?v=12&tipo=${tipo}&q=${encodeURIComponent(q)}&anno=${anno}&numero=${numero}`;
    const cache = caches.default;
    const richiestaCache = new Request(`https://cache.pinuzza.internal/${chiave}`);
    const inCache = await cache.match(richiestaCache);
    if (inCache) return new Response(inCache.body, inCache);

    const inizio = Date.now();
    const contesto = { spese: 2 }; // 2 per la cache (match + put)
    let risposta;
    try {
      const esito = await cerca(tipo, { q, anno, numero }, contesto);
      risposta = json({
        tipo,
        tipoNome: (GRUPPI[tipo] || GRUPPI.tutti).nome,
        q,
        anno,
        numero,
        totale: esito.totale,
        risultati: esito.risultati,
        tipiInterrogati: esito.tipi,
        tipiNonDisponibili: esito.guasti,
        tipiNonInterrogati: esito.saltati,
        elencoTipi: esito.elencoTipi,
        aggiornato: new Date().toISOString(),
        ms: Date.now() - inizio,
      }, 200, { 'Cache-Control': `public, max-age=${CACHE_RICERCA}` });
    } catch (e) {
      risposta = json({ errore: 'Il servizio del Comune non ha risposto', dettaglio: String((e && e.message) || e) }, 502);
    }

    if (risposta.ok) {
      const daSalvare = new Response(risposta.clone().body, risposta);
      daSalvare.headers.set('Cache-Control', `public, max-age=${CACHE_RICERCA}`);
      ctx.waitUntil(cache.put(richiestaCache, daSalvare));
    }
    return risposta;
  },
};
