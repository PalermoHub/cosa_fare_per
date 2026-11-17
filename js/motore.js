// Motore di ricerca di «Chiedilo a Pinuzza»: nessun LLM, nessuna API.
// Confronta la domanda del cittadino con le voci preparate (argomenti.json + schede
// servizio del Comune) e, se nessuna voce è abbastanza pertinente, cerca l'ufficio
// competente nelle competenze degli uffici (uffici.json).

export const PAROLE_VUOTE = new Set(`a ad al alla alle allo agli ai anche che chi ci come con cui da dal
dalla dalle dallo dagli dai dei del della delle dello degli di e ed gli ha ho i il in io la le lo mi ne nel
nella nelle nello negli nei no non o per più piu quale quali quando quanto se sei si sia sono su sul sulla
sui tra tu un una uno vi voi fa fare serve bisogno devo deve posso può puo cosa dove essere stato stata stati
state vorrei voglio sapere mi me lo la le li posso potrebbe mi dico dimmi grazie per favore ciao buongiorno
buonasera scusi cortesemente aiuto aiutatemi urgentemente adesso oggi ora devo necessito occorre possibile
si no` .split(/\s+/).filter(Boolean));

// Parole del cittadino che portano alla stessa cosa: si aggiungono alla domanda prima del confronto.
export const SINONIMI = {
  vigili: ['polizia', 'municipale'],
  municipale: ['polizia'],
  spazzatura: ['rifiuti'],
  immondizia: ['rifiuti'],
  monnezza: ['rifiuti'],
  bolletta: ['tari', 'imu'],
  bollette: ['tari', 'imu'],
  tasse: ['tributi'],
  multa: ['contravvenzioni'],
  multe: ['contravvenzioni'],
  verbale: ['contravvenzioni'],
  asilo: ['nido'],
  materna: ['infanzia'],
  mensa: ['refezione'],
  scuolabus: ['trasporto', 'scolastico'],
  carta: ['identita'],
  documento: ['identita'],
  patente: ['identita'],
  sfratto: ['morosita', 'affitto'],
  anziano: ['anziani'],
  vecchio: ['anziani'],
  disabile: ['disabilita'],
  handicap: ['disabilita'],
  invalido: ['disabilita'],
  cane: ['animali', 'canile'],
  gatto: ['animali', 'felina'],
  albero: ['verde', 'arboreo'],
  parco: ['verde'],
  giardino: ['verde'],
  lampione: ['illuminazione'],
  luce: ['illuminazione'],
  buca: ['strade', 'infrastrutture'],
  marciapiede: ['strade'],
  fogna: ['fognari'],
  perdita: ['idrico'],
  h: ['contrassegno'],
  acqua: ['idrico'],
  lavoro: ['concorsi', 'occupazione'],
  concorso: ['concorsi'],
  assunzione: ['concorsi'],
  matrimonio: ['matrimonio', 'pubblicazioni'],
  sposarsi: ['matrimonio'],
  morto: ['morte'],
  morta: ['morte'],
  funerale: ['cimitero'],
  cimitero: ['cimiteri'],
  tomba: ['cimitero', 'loculo'],
  nascita: ['nascita'],
  neonato: ['nascita'],
  bambino: ['nido', 'infanzia'],
  figlio: ['scuola', 'nido'],
  scuola: ['scuola'],
  iscrizione: ['iscrizione'],
  residenza: ['residenza'],
  trasloco: ['residenza', 'cambio'],
  certificato: ['certificati'],
  autocertificazione: ['autocertificazioni'],
  appuntamento: ['urp', 'sportello'],
  reclamo: ['urp', 'segnalazione'],
  rumore: ['acustico'],
  amianto: ['amianto'],
  rifiuti: ['rifiuti'],
  negozio: ['commercio'],
  bar: ['somministrazione'],
  tavolini: ['dehors', 'suolo'],
  mercato: ['mercati'],
  edilizia: ['edilizia'],
  ristrutturare: ['edilizia', 'cila'],
  costruire: ['edilizia', 'permesso'],
  ztl: ['ztl'],
  parcheggio: ['parcheggio'],
  sosta: ['parcheggio'],
  biblioteca: ['biblioteche'],
  sport: ['sport', 'impianti'],
  piscina: ['piscina'],
  evento: ['eventi', 'patrocinio'],
  patrocinio: ['patrocinio'],
};

export function normalizza(testo) {
  return (testo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parole(testo, { conSinonimi = false } = {}) {
  const base = normalizza(testo)
    .split(' ')
    .filter(p => (p.length > 2 || p === 'h') && !PAROLE_VUOTE.has(p));
  if (!conSinonimi) return base;
  const extra = [];
  for (const p of base) {
    if (SINONIMI[p]) extra.push(...SINONIMI[p]);
    else if (p.length > 4 && p.length < 11) extra.push(p.slice(0, p.length - 1)); // plurale/singolare
  }
  return [...new Set([...base, ...extra])];
}

// indice di ricerca di una voce (calcolato una volta sola al caricamento)
export function indicizza(voce, schedeServizio = {}) {
  const s = schedeServizio[voce.servizio] || null;
  const campi = {
    domande: (voce.domande || []).map(d => ({ testo: normalizza(d), parole: parole(d, { conSinonimi: true }) })),
    keywords: (voce.keywords || []).flatMap(k => parole(k, { conSinonimi: true })),
    titolo: parole(voce.titolo || '', { conSinonimi: true }),
    extra: parole([s?.sommario, ...(s?.categorie || [])].filter(Boolean).join(' '), { conSinonimi: true }),
    risposta: parole(
      voce.risposta
        ? [voce.risposta.sintesi, ...(voce.risposta.passi || []), ...(voce.risposta.serve || [])].join(' ')
        : '',
    ),
  };
  return { voce, campi, servizio: s };
}

const PESO = { domandaIntera: 14, domandaParola: 7, keyword: 6, titolo: 5, extra: 2, risposta: 1 };

// Distanza di editazione (Levenshtein + trasposizioni) con tetto: se il conteggio
// supera `tetto` si ferma e restituisce tetto+1, così il confronto resta economico.
function distanza(a, b, tetto) {
  if (Math.abs(a.length - b.length) > tetto) return tetto + 1;
  let dueFa = null;
  let precedente = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const colonna = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(colonna[j - 1] + 1, precedente[j] + 1, precedente[j - 1] + costo);
      // trasposizione: «residenza» / «resdienza» conta come un errore solo
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, dueFa[j - 2] + 1);
      }
      colonna[j] = v;
      if (v < minimo) minimo = v;
    }
    if (minimo > tetto) return tetto + 1;
    dueFa = precedente;
    precedente = colonna;
  }
  return Math.min(precedente[b.length], tetto + 1);
}

// Quanto una parola della domanda somiglia a una parola dell'indice.
// Le forme troncate valgono meno: «insegna» vale 1 con «insegna», 0.8 con «insegne» o «insegne…»,
// ma «autorizzazione» NON deve valere per «auto».
function punteggioParola(parola, elenco) {
  const l = parola.length;
  let migliore = 0;
  for (const p of elenco) {
    if (p === parola) return 1;
    const corta = l <= p.length ? parola : p;
    const lunga = l <= p.length ? p : parola;
    if (lunga.startsWith(corta) && lunga.length - corta.length <= 4) migliore = Math.max(migliore, 0.8);
    else if (l > 4 && p.includes(parola)) migliore = Math.max(migliore, 0.6);
  }
  return migliore;
}

const pesoParola = p => (p.length >= 12 ? 2 : p.length >= 8 ? 1.5 : 1);

export function valuta(indice, domanda) {
  const q = normalizza(domanda);
  if (!q) return 0;
  const qp = parole(domanda, { conSinonimi: true });
  if (!qp.length) return 0;
  const { campi } = indice;
  const peso = qp.reduce((s, p) => s + pesoParola(p), 0);
  let punti = 0;

  for (const d of campi.domande) {
    if (d.testo === q) punti += PESO.domandaIntera;
    else if (d.testo.includes(q) || q.includes(d.testo)) punti += PESO.domandaIntera * 0.8;
    let parziali = 0;
    for (const p of qp) parziali += punteggioParola(p, d.parole);
    punti += (parziali / qp.length) * PESO.domandaParola;
  }
  for (const p of qp) {
    const w = pesoParola(p);
    punti += punteggioParola(p, campi.keywords) * PESO.keyword * w;
    punti += punteggioParola(p, campi.titolo) * PESO.titolo * w;
    punti += punteggioParola(p, campi.extra) * PESO.extra * w;
    punti += punteggioParola(p, campi.risposta) * PESO.risposta * w;
  }
  return punti / Math.max(2, peso);
}

// Soglie tarate sulle 70 domande di scripts/test_motore.mjs e su domande fuori tema:
// le domande pertinenti stanno tra 2,65 e 24,9 (mediana 9,8), quelle fuori tema sotto 4,0.
export const SOGLIA_SICURA = 4.5; // sopra: risposta diretta
export const SOGLIA_MINIMA = 2.0; // tra le due: «forse cerchi questo»; sotto: nessuna risposta pronta

// Parole dell'indice (nomi, titoli, competenze) raccolte una volta sola: servono a
// capire quali parole della domanda il vocabolario non conosce.
const vocabolari = new WeakMap();
function vocabolario(indiceVoci) {
  let parole = vocabolari.get(indiceVoci);
  if (parole) return parole;
  parole = new Set();
  for (const { campi } of indiceVoci) {
    for (const elenco of [campi.keywords, campi.titolo, campi.extra, campi.risposta, ...campi.domande.map(d => d.parole)]) {
      for (const p of elenco) parole.add(p);
    }
  }
  vocabolari.set(indiceVoci, parole);
  return parole;
}

// le parole della domanda che nessuna voce riconosce: sono le uniche su cui vale la
// pena correggere, mentre «colore» o «pasta» restano parole sconosciute e basta
function paroleSconosciute(indiceVoci, domanda) {
  const vocab = vocabolario(indiceVoci);
  return parole(domanda).filter(p => !vocab.has(p) && !vocab.has(p.slice(0, p.length - 1)));
}

// Refusi: si perdona una lettera sola (sbagliata, mancante o scambiata) e solo dove
// non fa danni, cioè su parole lunghe abbastanza da non diventare un'altra parola
// («pasta» / «passo» no, «residenza» / «residensa» sì) e con la stessa lettera
// iniziale, che nessuno sbaglia.
const REFUSO_MIN = 6;
const REFUSO_CANDIDATI = 4;

function refusoAmmesso(parola, altra) {
  return parola.length >= REFUSO_MIN && altra.length >= REFUSO_MIN &&
    parola[0] === altra[0] && Math.abs(parola.length - altra.length) <= 1;
}

// le parole del vocabolario a una lettera di distanza, in ordine alfabetico (l'ordine
// conta solo per rendere la scelta ripetibile)
function correzioniPossibili(indiceVoci, parola) {
  if (parola.length < REFUSO_MIN) return [];
  const trovate = [];
  for (const altra of vocabolario(indiceVoci)) {
    if (!refusoAmmesso(parola, altra)) continue;
    if (distanza(parola, altra, 1) === 1) trovate.push(altra);
    if (trovate.length >= 32) break;
  }
  return trovate.sort().slice(0, REFUSO_CANDIDATI);
}

// le domande da provare: quella scritta e, se ci sono parole che il vocabolario non
// conosce, le varianti con quelle parole corrette (una variante per correzione)
function variantiDomanda(indiceVoci, domanda) {
  const scritta = parole(domanda);
  const sconosciute = paroleSconosciute(indiceVoci, domanda);
  if (!sconosciute.length) return [domanda];
  const daCorreggere = sconosciute
    .map(p => ({ parola: p, correzioni: correzioniPossibili(indiceVoci, p) }))
    .filter(c => c.correzioni.length);
  if (!daCorreggere.length) return [domanda];
  // si correggono al massimo due parole per volta: le combinazioni esplodono e i refusi
  // veri sono quasi sempre uno o due
  const combinazioni = [[]];
  for (const { parola, correzioni } of daCorreggere.slice(0, 2)) {
    const aggiunte = [];
    for (const base of combinazioni) for (const c of correzioni) aggiunte.push([...base, [parola, c]]);
    combinazioni.push(...aggiunte);
    if (combinazioni.length > 12) break;
  }
  const varianti = [];
  for (const sostituzioni of combinazioni) {
    if (!sostituzioni.length) continue;
    const mappa = new Map(sostituzioni);
    varianti.push(scritta.map(p => mappa.get(p) || p).join(' '));
  }
  return [domanda, ...varianti.slice(0, 12)];
}

// [{ voce, punteggio }] ordinati, al massimo n.
// Vince la lettura migliore fra la domanda scritta e quelle con i refusi corretti:
// se una parola non esiste nel vocabolario si prova a raddrizzarla (una o due parole
// per volta) e si tiene la domanda che trova la voce più pertinente. Le domande scritte
// bene non hanno parole sconosciute, quindi non pagano nulla di tutto questo.
export function cerca(indiceVoci, domanda, n = 4) {
  const classifica = testo =>
    indiceVoci
      .map(indice => ({ indice, punteggio: valuta(indice, testo) }))
      .filter(r => r.punteggio > 0)
      .sort((a, b) => b.punteggio - a.punteggio);
  const scritta = classifica(domanda);
  let migliore = scritta;
  for (const variante of variantiDomanda(indiceVoci, domanda).slice(1)) {
    const prova = classifica(variante);
    if ((prova[0]?.punteggio || 0) > (migliore[0]?.punteggio || 0)) migliore = prova;
  }
  return migliore.slice(0, n);
}

// Una domanda può chiedere due cose diverse («come cambio residenza e come iscrivo la tari»):
// spezzandola sui connettivi si vede se i pezzi portano a voci diverse.
const SEPARATORE_SEZIONI = /\s*(?:[.;!?,]|\be anche\b|\binoltre\b|\boppure\b|\bpoi\b|\be\b)\s*/gi;

export function sezioniDomanda(domanda) {
  return (domanda || '')
    .split(SEPARATORE_SEZIONI)
    .map(sezione => sezione.trim())
    // due parole piene: «che cos» o «qual» sono pezzi di frase, non richieste
    .filter(sezione => parole(sezione).length >= 2);
}

// Le altre cose chieste dalla stessa domanda: una voce diversa da quella principale per
// ogni pezzo che, preso da solo, trova una risposta sicura. Serve alla scheda «nella
// domanda c'è anche questo»: su una domanda di un solo tema restituisce [].
export function cercaSezioni(indiceVoci, domanda, { esclusa = null, quante = 1 } = {}) {
  const sezioni = sezioniDomanda(domanda);
  if (sezioni.length < 2) return [];
  const trovate = [];
  const visti = new Set(esclusa ? [esclusa] : []);
  for (const sezione of sezioni) {
    const migliore = cerca(indiceVoci, sezione, 1)[0];
    if (!migliore || migliore.punteggio < SOGLIA_SICURA) continue;
    const id = migliore.indice.voce.id;
    if (visti.has(id)) continue;
    visti.add(id);
    trovate.push({ voce: migliore.indice.voce, punteggio: migliore.punteggio, sezione });
  }
  return trovate.sort((a, b) => b.punteggio - a.punteggio).slice(0, quante);
}

// Ricerca di riserva: quale ufficio si occupa di questa cosa (usa nome, area e competenze)
export function cercaUffici(uffici, domanda, n = 3) {
  const qp = parole(domanda, { conSinonimi: true });
  if (!qp.length) return [];
  const punteggi = [];
  for (const u of uffici) {
    const nome = parole(u.nome, { conSinonimi: true });
    const area = parole(`${u.area} ${u.settore}`, { conSinonimi: true });
    const comp = parole(u.competenze);
    let punti = 0;
    for (const p of qp) {
      punti += punteggioParola(p, nome) * 3;
      punti += punteggioParola(p, area) * 2;
      punti += punteggioParola(p, comp) * 1;
    }
    const media = punti / Math.max(2, Math.min(qp.length, 4));
    if (media >= 0.5) punteggi.push({ ufficio: u, punteggio: media });
  }
  // un ufficio figlio e il suo ufficio padre dicono la stessa cosa: tieni il più specifico
  punteggi.sort((a, b) => b.punteggio - a.punteggio);
  const scelti = [];
  for (const p of punteggi) {
    if (scelti.length >= n) break;
    const doppione = scelti.some(
      s => s.ufficio.nome === p.ufficio.nome || (s.ufficio.area === p.ufficio.area && s.ufficio.nome === p.ufficio.nome),
    );
    if (!doppione) scelti.push(p);
  }
  return scelti;
}

// domande suggerite: le voci marcate `inEvidenza` aprono sempre la lista con la loro
// prima domanda (sono quelle che devono stare in home); le altre si scelgono a caso,
// con l'elenco mescolato a ogni avvio (termina sempre, anche se `caso` restituisce sempre
// lo stesso numero). Al massimo due domande per tema: la home non deve sembrare fatta
// solo di TARI.
const TETTO_TEMA = 2;

export function suggerimenti(voci, n = 6, caso = Math.random) {
  const pool = voci.filter(v => (v.domande || []).length);
  if (!pool.length) return [];
  const scelti = [];
  const conto = new Map();
  const usate = new Set();
  const prendi = v => {
    const tema = v.categoria || '';
    conto.set(tema, (conto.get(tema) || 0) + 1);
    usate.add(v.id);
  };
  for (const v of pool) {
    if (!v.inEvidenza) continue;
    if (scelti.length >= n) return scelti;
    scelti.push(v.domande[0]);
    prendi(v);
  }
  const girabili = pool.filter(v => !v.inEvidenza);
  if (!girabili.length) return scelti;
  // mescolate con `caso`: ogni avvio (e ogni ritorno alla pagina bianca) porta un giro
  // diverso di domande, non una finestra spostata dello stesso elenco
  for (let k = girabili.length - 1; k > 0; k--) {
    const j = Math.floor(caso() * (k + 1)) % (k + 1);
    [girabili[k], girabili[j]] = [girabili[j], girabili[k]];
  }
  // primo giro con il tetto per tema, secondo giro senza: se i temi finiscono si riempie
  // lo stesso, e nessuna voce compare due volte
  for (const tetto of [TETTO_TEMA, Infinity]) {
    for (const v of girabili) {
      if (scelti.length >= n) return scelti;
      if (usate.has(v.id)) continue;
      const tema = v.categoria || '';
      if ((conto.get(tema) || 0) >= tetto) continue;
      const i = Math.floor(caso() * v.domande.length) || 0;
      scelti.push(v.domande[i % v.domande.length]);
      prendi(v);
    }
  }
  return scelti;
}
