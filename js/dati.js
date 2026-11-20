// Caricamento dei dati dell'app: prima le voci e le schede servizio (leggere),
// poi gli uffici (pesanti) solo quando serve una scheda o la ricerca di riserva.

const percorsi = {
  argomenti: 'data/argomenti.json',
  servizi: 'data/servizi.json',
  uffici: 'data/uffici.json',
  rous: 'data/rous.json',
  rousArticoli: 'data/rous-articoli.json',
};

const inMemoria = {};

async function scarica(nome) {
  if (inMemoria[nome]) return inMemoria[nome];
  const risposta = await fetch(percorsi[nome]);
  if (!risposta.ok) throw new Error(`Non riesco a scaricare ${percorsi[nome]} (${risposta.status})`);
  inMemoria[nome] = await risposta.json();
  return inMemoria[nome];
}

export const stato = {
  voci: [],
  servizi: {}, // id -> scheda servizio
  uffici: null, // id -> ufficio (caricato su richiesta)
  rous: null, // { voci, documenti, pdf } (caricato quando si sceglie l'ambito ROUS)
  articoliRous: null, // id -> { doc, numero, titolo, testo }
  aggiornato: '',
};

export async function caricaBase() {
  const [argomenti, servizi] = await Promise.all([scarica('argomenti'), scarica('servizi')]);
  stato.voci = argomenti.voci || [];
  stato.aggiornato = argomenti.versione || '';
  stato.servizi = Object.fromEntries((servizi || []).map(s => [s.id, s]));
  return stato;
}

export async function caricaUffici() {
  if (stato.uffici) return stato.uffici;
  const elenco = await scarica('uffici');
  stato.uffici = Object.fromEntries(elenco.map(u => [u.id, u]));
  return stato.uffici;
}

export function ufficioDa(id) {
  return stato.uffici ? stato.uffici[id] || null : null;
}

// gli uffici competenti per una voce: prima quelli indicati nella voce, poi quelli della scheda servizio
export function ufficiDellaVoce(voce) {
  const ids = [];
  for (const id of voce.uffici || []) ids.push(id);
  const scheda = voce.servizio ? stato.servizi[voce.servizio] : null;
  for (const u of scheda?.uffici || []) ids.push(u.id);
  return [...new Set(ids)].map(ufficioDa).filter(Boolean);
}

// ROUS: le voci curate servono subito (ambito «ROUS»), i testi integrali degli articoli
// solo quando si apre una fonte o la ricerca ricade sul testo.
export async function caricaRous() {
  if (stato.rous) return stato.rous;
  stato.rous = await scarica('rous');
  return stato.rous;
}

export async function caricaArticoliRous() {
  if (stato.articoliRous) return stato.articoliRous;
  stato.articoliRous = await scarica('rousArticoli');
  return stato.articoliRous;
}
