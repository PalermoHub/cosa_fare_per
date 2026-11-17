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

// Quanto una parola della domanda somiglia a una parola dell'indice.
// Le forme troncate valgono meno: «insegna» vale 1 con «insegna», 0.8 con «insegne» o «insegne…»,
// ma «autorizzazione» NON deve valere per «auto».
function punteggioParola(parola, elenco) {
  let migliore = 0;
  for (const p of elenco) {
    if (p === parola) return 1;
    const corta = parola.length <= p.length ? parola : p;
    const lunga = parola.length <= p.length ? p : parola;
    if (lunga.startsWith(corta) && lunga.length - corta.length <= 4) migliore = Math.max(migliore, 0.8);
    else if (parola.length > 4 && p.includes(parola)) migliore = Math.max(migliore, 0.6);
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

// [{ voce, punteggio }] ordinati, al massimo n
export function cerca(indiceVoci, domanda, n = 4) {
  const risultati = indiceVoci
    .map(indice => ({ indice, punteggio: valuta(indice, domanda) }))
    .filter(r => r.punteggio > 0)
    .sort((a, b) => b.punteggio - a.punteggio);
  return risultati.slice(0, n);
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

// domande suggerite: si parte da un punto "a caso" e si gira l'elenco (termina sempre,
// anche se `caso` restituisce sempre lo stesso numero)
export function suggerimenti(voci, n = 6, caso = Math.random) {
  const pool = voci.filter(v => (v.domande || []).length);
  if (!pool.length) return [];
  const scelti = [];
  const partenza = Math.floor(caso() * pool.length) || 0;
  for (let k = 0; k < pool.length && scelti.length < n; k++) {
    const v = pool[(partenza + k) % pool.length];
    const i = Math.floor(caso() * v.domande.length) || 0;
    scelti.push(v.domande[i % v.domande.length]);
  }
  return scelti;
}
