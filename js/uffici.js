// Pagina «Tutti gli uffici»: la stessa base di data/uffici.json, in due viste.
// «Per area» raggruppa gli uffici nelle 25 aree amministrative del Comune;
// «Elenco A–Z» è la lista piatta in ordine alfabetico. Nessuna mappa: qui conta l'elenco.

import { caricaUffici } from './dati.js';
import { raggruppaPerArea, elencoAlfabetico, filtra, suggerisci, areaDi, LIVELLI, SENZA_AREA } from './aree.js';

const $ = sel => document.querySelector(sel);
const campo = $('#cerca-ufficio');
const esito = $('#esito');
const contenitoreAree = $('#per-area');
const contenitoreElenco = $('#elenco');
const bottoniVista = [...document.querySelectorAll('[data-vista]')];
const introduzione = $('#introduzione');
const lista = $('#suggerimenti-uffici');

const stato = {
  uffici: [],
  righe: [], // { ufficio, card, riga, sezione }
  sezioni: [], // { nodo, conteggio, totale, trovati }
  vista: 'area',
  scelta: null, // {tipo:'area', area} o {tipo:'ufficio', id}: scelta esatta dai suggerimenti
  suggerimenti: [],
  attivo: -1,
};

const conta = n => (n === 1 ? '1 ufficio' : `${n} uffici`);

function el(tag, classe, testo) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (testo != null) n.textContent = testo;
  return n;
}

function link(testo, href, classe) {
  const a = el('a', classe, testo);
  a.href = href;
  return a;
}

// Area › Settore, saltando i nomi vuoti e il segnaposto «Uffici non collocati»
function percorso(ufficio) {
  const pulito = nome => (nome && !/^uffici non collocati$/i.test(nome) ? nome : '');
  const parti = [pulito(ufficio.area), pulito(ufficio.settore)];
  if (parti[1] === parti[0]) parti[1] = '';
  return parti.filter(Boolean).join(' › ');
}

function recapiti(ufficio) {
  const p = el('p', 'ufficio-recapiti');
  const telefono = (ufficio.telefoni || [])[0];
  if (telefono) {
    const a = link(telefono, `tel:${telefono.replace(/[^\d+]/g, '')}`);
    p.append(a);
  }
  const email = (ufficio.email || []).find(e => !(ufficio.pec || []).includes(e));
  if (email) {
    if (p.childElementCount) p.append(document.createTextNode(' · '));
    p.append(link(email, `mailto:${email}`));
  }
  return p.childElementCount ? p : null;
}

function scheda(ufficio) {
  const card = el('article', 'ufficio-voce');
  card.append(el('p', 'ufficio-livello', LIVELLI[ufficio.livello] || 'Ufficio'));
  card.append(el('h3', 'ufficio-nome', ufficio.nome));
  const dove = percorso(ufficio);
  if (dove && dove !== ufficio.nome) card.append(el('p', 'ufficio-dove', dove));
  const contatti = recapiti(ufficio);
  if (contatti) card.append(contatti);
  const azioni = el('p', 'ufficio-azioni');
  if (ufficio.url) {
    const a = link('Scheda ufficiale ↗', ufficio.url, 'ufficio-scheda');
    a.rel = 'noopener';
    azioni.append(a);
  }
  const via = (ufficio.indirizzo || '').replace(/,\s*\d{5}\b.*$/, '').trim();
  if (via) azioni.append(el('span', 'ufficio-indirizzo', via));
  if (azioni.childElementCount) card.append(azioni);
  return card;
}

// la riga d'intestazione dell'elenco A–Z: le tre colonne si chiamano per nome.
// È nascosta ai lettori di schermo (aria-hidden): l'elenco resta una lista di uffici
// e i recapiti si presentano da soli («tel:», «mailto:»).
function intestazioneElenco() {
  const riga = el('li', 'intestazione-elenco');
  riga.setAttribute('aria-hidden', 'true');
  riga.append(
    el('span', 'col-nome', 'Ufficio'),
    el('span', 'col-dove', 'Area e settore'),
    el('span', 'col-recapiti', 'Recapiti'),
  );
  return riga;
}

function rigaElenco(ufficio, conteggi) {
  const riga = el('li', 'riga-ufficio');
  const nome = ufficio.url ? link(ufficio.nome, ufficio.url, 'riga-nome') : el('span', 'riga-nome', ufficio.nome);
  if (nome.tagName === 'A') nome.rel = 'noopener';
  riga.append(nome);

  const dove = percorso(ufficio);
  if (dove && dove !== ufficio.nome) riga.append(el('span', 'riga-dove', dove));
  else if (ufficio.livello === 'area') {
    // la scheda dell'area non ha un'area sopra di sé: al posto del percorso dice quanti
    // uffici raccoglie, così la colonna non resta vuota
    const quanti = (conteggi.get(areaDi(ufficio)) || 1) - 1;
    if (quanti > 0) riga.append(el('span', 'riga-dove', quanti === 1 ? '1 ufficio nell\'area' : `${quanti} uffici nell'area`));
  }

  // il recapito va sempre nella terza colonna, anche quando area e settore mancano
  const contatti = recapiti(ufficio);
  if (contatti) {
    contatti.className = 'riga-recapiti';
    riga.append(contatti);
  }
  return riga;
}

function sezioneArea(gruppo) {
  const sezione = el('section', 'gruppo-area');
  const intestazione = el('div', 'intestazione-area');
  intestazione.append(el('h2', null, gruppo.area));
  const conteggio = el('p', 'conteggio-area');
  intestazione.append(conteggio);
  sezione.append(intestazione);
  if (gruppo.area === SENZA_AREA) {
    sezione.append(
      el('p', 'nota-area', 'Uffici che il Comune non ha assegnato a un\'area amministrativa: sono comunque raggiungibili con i loro recapiti.'),
    );
  }
  const griglia = el('div', 'griglia-uffici');
  sezione.append(griglia);
  return { sezione, griglia, conteggio, totale: gruppo.uffici.length, trovati: gruppo.uffici.length };
}

function mostraVista(vista, { aggiornaUrl = true } = {}) {
  stato.vista = vista === 'elenco' ? 'elenco' : 'area';
  contenitoreAree.hidden = stato.vista !== 'area';
  contenitoreElenco.hidden = stato.vista !== 'elenco';
  for (const b of bottoniVista) b.setAttribute('aria-pressed', String(b.dataset.vista === stato.vista));
  if (aggiornaUrl) aggiornaIndirizzo();
}

function aggiornaIndirizzo() {
  const url = new URL(location.href);
  if (stato.vista === 'elenco') url.searchParams.set('vista', 'elenco');
  else url.searchParams.delete('vista');
  const q = campo.value.trim();
  if (q) url.searchParams.set('q', q);
  else url.searchParams.delete('q');
  if (url.href !== location.href) history.replaceState({}, '', url);
}

function applicaFiltro() {
  const testo = campo.value.trim();
  const elenco = stato.scelta?.tipo === 'area'
    ? stato.uffici.filter(u => areaDi(u) === stato.scelta.area)
    : stato.scelta?.tipo === 'ufficio'
      ? stato.uffici.filter(u => u.id === stato.scelta.id)
      : filtra(stato.uffici, testo);
  const trovati = new Set(elenco.map(u => u.id));
  const attivo = Boolean(testo);

  for (const riga of stato.righe) {
    const ok = trovati.has(riga.ufficio.id);
    riga.card.hidden = !ok;
    if (riga.riga) riga.riga.hidden = !ok;
    if (riga.sezione) {
      if (ok) riga.sezione.trovati += 1;
    }
  }

  for (const sezione of stato.sezioni) {
    sezione.nodo.hidden = sezione.trovati === 0;
    sezione.conteggio.textContent = attivo
      ? `${conta(sezione.trovati)} di ${sezione.totale}`
      : conta(sezione.totale);
    sezione.trovati = 0;
  }

  esito.textContent = attivo
    ? (trovati.size ? `${conta(trovati.size)} ${trovati.size === 1 ? 'trovato' : 'trovati'}` : 'Nessun ufficio trovato: prova con il nome dell\'area o del servizio')
    : '';
  aggiornaIndirizzo();
}

// ---------- suggerimenti: dopo 3 lettere si propone l'ufficio o l'area giusta ----------

function chiudiSuggerimenti() {
  lista.textContent = '';
  lista.hidden = true;
  campo.setAttribute('aria-expanded', 'false');
  campo.removeAttribute('aria-activedescendant');
  stato.suggerimenti = [];
  stato.attivo = -1;
}

function evidenzia(indice) {
  const n = stato.suggerimenti.length;
  if (!n) return;
  stato.attivo = (indice + n) % n;
  [...lista.children].forEach((li, k) => {
    const attivo = k === stato.attivo;
    li.classList.toggle('attivo', attivo);
    li.setAttribute('aria-selected', String(attivo));
  });
  const scelto = lista.children[stato.attivo];
  campo.setAttribute('aria-activedescendant', scelto.id);
  scelto.scrollIntoView({ block: 'nearest' });
}

function mostraSuggerimenti() {
  stato.suggerimenti = suggerisci(stato.uffici, campo.value);
  stato.attivo = -1;
  lista.textContent = '';
  if (!stato.suggerimenti.length) {
    chiudiSuggerimenti();
    return;
  }
  stato.suggerimenti.forEach((s, i) => {
    const voce = el('li', 'suggerimento');
    voce.id = `sugg-${i}`;
    voce.setAttribute('role', 'option');
    voce.setAttribute('aria-selected', 'false');
    if (s.tipo === 'area') {
      voce.append(el('span', 'suggerimento-tipo', 'Area'));
      voce.append(el('span', 'suggerimento-nome', s.area));
      voce.append(el('span', 'suggerimento-dove', `${s.numero} uffici`));
    } else {
      voce.append(el('span', 'suggerimento-nome', s.ufficio.nome));
      const dove = percorso(s.ufficio);
      if (dove) voce.append(el('span', 'suggerimento-dove', dove));
    }
    // il clic non deve togliere il fuoco al campo, altrimenti la lista si chiude prima
    voce.addEventListener('mousedown', evento => evento.preventDefault());
    voce.addEventListener('click', () => scegliSuggerimento(i));
    lista.append(voce);
  });
  lista.hidden = false;
  campo.setAttribute('aria-expanded', 'true');
}

function scegliSuggerimento(indice) {
  const s = stato.suggerimenti[indice];
  if (!s) return;
  stato.scelta = s.tipo === 'area' ? { tipo: 'area', area: s.area } : { tipo: 'ufficio', id: s.ufficio.id };
  campo.value = s.tipo === 'area' ? s.area : s.ufficio.nome;
  chiudiSuggerimenti();
  applicaFiltro();
  campo.focus();
}

// ---------- costruzione delle due viste ----------

function costruisci() {
  const gruppi = raggruppaPerArea(stato.uffici);
  const frammentoAree = document.createDocumentFragment();

  for (const gruppo of gruppi) {
    const { sezione, griglia, conteggio, totale } = sezioneArea(gruppo);
    stato.sezioni.push({ nodo: sezione, conteggio, totale, trovati: 0 });

    for (const ufficio of gruppo.uffici) {
      const card = scheda(ufficio);
      griglia.append(card);
      stato.righe.push({ ufficio, card, riga: null, sezione: stato.sezioni.at(-1) });
    }
    frammentoAree.append(sezione);
  }

  contenitoreAree.append(frammentoAree);

  // «Elenco A–Z» è una lista unica: ordine alfabetico su tutti gli uffici, non
  // area per area (le aree si susseguivano nell'ordine dei gruppi e sembrava disordinato).
  const lista = el('ul', 'elenco-uffici');
  lista.append(intestazioneElenco());
  const conteggi = new Map(gruppi.map(g => [g.area, g.uffici.length]));
  const righe = new Map(stato.righe.map(r => [r.ufficio.id, r]));
  for (const ufficio of elencoAlfabetico(stato.uffici)) {
    const riga = rigaElenco(ufficio, conteggi);
    const registrata = righe.get(ufficio.id);
    if (registrata) registrata.riga = riga;
    lista.append(riga);
  }
  contenitoreElenco.append(lista);

  const aree = gruppi.filter(g => g.area !== SENZA_AREA).length;
  if (introduzione) {
    introduzione.textContent = `${stato.uffici.length} uffici in ${aree} aree amministrative: cercali per nome, area o competenza.`;
  }
}

async function avvia() {
  const parametri = new URLSearchParams(location.search);
  if (parametri.get('q')) campo.value = parametri.get('q');
  mostraVista(parametri.get('vista'), { aggiornaUrl: false });

  for (const b of bottoniVista) {
    b.addEventListener('click', () => {
      mostraVista(b.dataset.vista);
      document.querySelector('#contenuto').scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  let attesa = null;
  const aggiorna = () => {
    // riscrivere nel campo (o azzerarlo con la crocetta) annulla la scelta dell'area
    stato.scelta = null;
    applicaFiltro();
    mostraSuggerimenti();
  };
  campo.addEventListener('input', () => {
    clearTimeout(attesa);
    attesa = setTimeout(aggiorna, 120);
  });
  campo.addEventListener('search', aggiorna); // crocetta del campo search

  campo.addEventListener('keydown', evento => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      if (lista.hidden) mostraSuggerimenti();
      else evidenzia(stato.attivo + 1);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!lista.hidden) evidenzia(stato.attivo - 1);
    } else if (evento.key === 'Enter') {
      if (!lista.hidden && stato.attivo >= 0) {
        evento.preventDefault();
        scegliSuggerimento(stato.attivo);
      }
    } else if (evento.key === 'Escape') {
      chiudiSuggerimenti();
    }
  });

  campo.addEventListener('blur', () => setTimeout(chiudiSuggerimenti, 120));
  document.addEventListener('click', evento => {
    if (!lista.hidden && !lista.contains(evento.target) && evento.target !== campo) chiudiSuggerimenti();
  });

  try {
    stato.uffici = Object.values(await caricaUffici());
    costruisci();
    applicaFiltro(); // riempie i conteggi delle aree (e applica un filtro scritto nell'indirizzo)
  } catch (errore) {
    console.error(errore);
    esito.textContent = 'Non riesco a caricare l\'elenco degli uffici. Ricarica la pagina tra poco.';
  }
}

avvia();
