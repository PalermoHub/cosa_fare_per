// Raggruppamenti e filtri per la pagina «Tutti gli uffici».
// Funzioni pure (nessun DOM, nessuna rete): le usano js/uffici.js e scripts/test_uffici.mjs.

export const SENZA_AREA = 'Uffici non collocati';

const confronto = new Intl.Collator('it', { sensitivity: 'base' });

export function normalizza(testo) {
  return (testo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// il Comune lascia senza area 37 uffici: si mostrano in fondo, dichiarandolo
export function areaDi(ufficio) {
  const area = ufficio.area;
  return !area || /^uffici non collocati$/i.test(area) ? SENZA_AREA : area;
}

export const LIVELLI = { area: 'Area', settore: 'Settore', unita: 'U.O.' };

// [{ area, uffici: [...] }] ordinati per area; dentro l'area, per nome.
// «Uffici non collocati» sta in fondo: non è un'area amministrativa.
export function raggruppaPerArea(uffici) {
  const gruppi = new Map();
  for (const u of uffici) {
    const area = areaDi(u);
    if (!gruppi.has(area)) gruppi.set(area, []);
    gruppi.get(area).push(u);
  }
  return [...gruppi.entries()]
    .map(([area, elenco]) => ({ area, uffici: [...elenco].sort((a, b) => confronto.compare(a.nome, b.nome)) }))
    .sort((a, b) => {
      if (a.area === SENZA_AREA) return 1;
      if (b.area === SENZA_AREA) return -1;
      return confronto.compare(a.area, b.area);
    });
}

// elenco piatto in ordine alfabetico di nome
export function elencoAlfabetico(uffici) {
  return [...uffici].sort((a, b) => confronto.compare(a.nome, b.nome));
}

// testo su cui si fa la ricerca: nome, area, settore e competenze (calcolato una volta)
export function chiaveRicerca(ufficio) {
  if (!ufficio._cerca) {
    ufficio._cerca = normalizza([ufficio.nome, ufficio.area, ufficio.settore, ufficio.competenze].join(' '));
  }
  return ufficio._cerca;
}

// Una parola corta («tari», «pol») vale solo all'inizio di una parola: così «tari» non
// pesca «saniTARIe» e «pol» non pesca «politico» dentro un'altra parola qualsiasi.
const combacia = (testo, parola) => (parola.length < 5 ? inizioParola(testo, parola) : testo.includes(parola));

// filtro per una o più parole, tutte presenti (indipendenti dall'ordine)
export function filtra(uffici, testo) {
  const parole = normalizza(testo).split(' ').filter(Boolean);
  if (!parole.length) return uffici;
  return uffici.filter(u => {
    const chiave = chiaveRicerca(u);
    return parole.every(p => combacia(chiave, p));
  });
}

// ---------- suggerimenti della ricerca ----------
// «Intelligente» qui vuol dire: si comincia a suggerire dopo 3 lettere, si guarda prima
// il nome dell'ufficio, poi settore e area, e si propone anche l'area intera.
export const MIN_LETTERE = 3;
export const MAX_SUGGERIMENTI = 8;

const inizioParola = (testo, parola) => testo.startsWith(parola) || testo.includes(` ${parola}`);

function punteggioUfficio(ufficio, parole, q) {
  const nome = normalizza(ufficio.nome);
  const settore = normalizza(ufficio.settore);
  const area = normalizza(ufficio.area);
  let punti = 0;
  let nelNome = true;
  for (const p of parole) {
    if (inizioParola(nome, p)) punti += 8;
    else if (combacia(nome, p)) punti += 5;
    else if (combacia(settore, p)) { punti += 2; nelNome = false; }
    else if (combacia(area, p)) { punti += 1; nelNome = false; }
    else { punti += 0.2; nelNome = false; } // compare solo nelle competenze
  }
  if (nome === q) punti += 12;
  else if (nome.startsWith(q)) punti += 6;
  // a parità di parole, il nome più corto è quello più preciso
  return { punti: punti - nome.length / 200, nelNome };
}

function punteggioArea(area, parole) {
  const nome = normalizza(area);
  let punti = 0;
  for (const p of parole) punti += inizioParola(nome, p) ? 3 : combacia(nome, p) ? 1 : 0;
  return punti;
}

// [{ tipo: 'area', area, numero } | { tipo: 'ufficio', ufficio }]
export function suggerisci(uffici, testo, n = MAX_SUGGERIMENTI) {
  const q = normalizza(testo);
  if (q.length < MIN_LETTERE) return [];
  const parole = q.split(' ').filter(Boolean);

  const aree = raggruppaPerArea(uffici)
    .filter(g => parole.every(p => combacia(normalizza(g.area), p)))
    .map(g => ({ area: g.area, numero: g.uffici.length, punti: punteggioArea(g.area, parole) }))
    .sort((a, b) => b.punti - a.punti || b.numero - a.numero)
    .slice(0, 2)
    .map(({ area, numero }) => ({ tipo: 'area', area, numero }));

  // le schede «Area» non si suggeriscono: al loro posto c'è già la voce dell'area intera
  const candidati = uffici
    .filter(u => u.livello !== 'area')
    .filter(u => parole.every(p => combacia(chiaveRicerca(u), p)))
    .map(u => ({ ufficio: u, ...punteggioUfficio(u, parole, q) }));

  // se qualcosa combacia col nome, non si sporcano i suggerimenti con chi lo cita
  // solo nelle competenze (es. «servizio sostitutivo di mensa»)
  const conNome = candidati.filter(c => c.nelNome);
  const scelti = conNome.length ? conNome : candidati;

  const trovati = scelti
    .sort((a, b) => b.punti - a.punti || confronto.compare(a.ufficio.nome, b.ufficio.nome))
    .map(c => ({ tipo: 'ufficio', ufficio: c.ufficio }));

  return [...aree, ...trovati].slice(0, Math.max(aree.length, n));
}
