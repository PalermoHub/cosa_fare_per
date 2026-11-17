// Pagina «Risposte salvate»: mostra l'elenco che sta in js/salvati.js.
// Nessuna richiesta di rete: l'elenco è tutto nel browser, e i titoli sono già salvati
// (se una voce sparisse dai dati, la scheda resta comunque riconoscibile e si può togliere).
//
// Comandi: «Riapri la risposta» (torna alla home con la domanda nell'indirizzo), «Togli»
// per una voce, «Togli tutte» in fondo — con una conferma in linea, senza finestre di sistema.

import { elencoSalvati, togli, svuota } from './salvati.js';

const contenitore = document.querySelector('#elenco-salvati');
const quante = document.querySelector('#salvate-quante');
const comandi = document.querySelector('#comandi-salvati');
const pulsanteSvuota = document.querySelector('#svuota-salvati');
const stato = document.querySelector('#stato-salvati');
const titoloPagina = document.querySelector('h1');

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function el(tag, classe, testo) {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  if (testo != null) nodo.textContent = testo; // sempre testo, mai HTML
  return nodo;
}

function dataItaliana(iso) {
  const [a, m, g] = String(iso || '').split('-').map(Number);
  if (!a || !m || !g) return '';
  return `${g} ${MESI[m - 1]} ${a}`;
}

function annuncia(testo) {
  if (!stato) return;
  stato.textContent = '';
  // un attimo dopo, altrimenti i lettori di schermo non notano il cambiamento
  setTimeout(() => { stato.textContent = testo; }, 60);
}

function etichetta(voce) {
  return voce.titolo || voce.domanda;
}

function vuoto() {
  const riquadro = el('div', 'salvati-vuoto');
  riquadro.append(
    el('h2', null, 'Non hai ancora salvato nessuna risposta'),
    el('p', null, 'Quando una risposta ti serve, premi «Salva questa risposta» in fondo alla scheda: la ritrovi qui, anche senza rete.'),
  );
  const link = el('a', null, 'Chiedi qualcosa');
  link.href = 'index.html';
  riquadro.append(link);
  return riquadro;
}

function scheda(voce) {
  const riga = el('li', 'salvata');
  const quando = dataItaliana(voce.quando);
  if (quando) riga.append(el('p', 'salvata-quando', `Salvata il ${quando}`));
  riga.append(el('h2', 'salvata-titolo', etichetta(voce)));
  riga.append(el('p', 'salvata-domanda', `«${voce.domanda}»`));

  const azioni = el('div', 'salvata-azioni');
  const apri = el('a', 'salvata-apri', 'Riapri la risposta');
  apri.href = `index.html?q=${encodeURIComponent(voce.domanda)}`;
  apri.setAttribute('aria-label', `Riapri la risposta su «${etichetta(voce)}»`);

  const pulsante = el('button', 'salvata-togli', 'Togli');
  pulsante.type = 'button';
  pulsante.dataset.id = voce.id;
  pulsante.setAttribute('aria-label', `Togli dall’elenco «${etichetta(voce)}»`);
  pulsante.addEventListener('click', () => {
    if (!togli(voce.id)) {
      annuncia('Non riesco a togliere la risposta: la memoria del browser è bloccata.');
      return;
    }
    disegna();
    annuncia(`Tolta dall’elenco: ${etichetta(voce)}.`);
    // il focus non deve cadere nel vuoto: la prima voce rimasta, o il titolo della pagina
    const prossimo = contenitore.querySelector('.salvata-togli') || titoloPagina;
    if (prossimo) prossimo.focus({ preventScroll: true });
  });

  azioni.append(apri, pulsante);
  riga.append(azioni);
  return riga;
}

function disegna() {
  const salvate = elencoSalvati();
  contenitore.textContent = '';
  comandi.hidden = salvate.length === 0;
  quante.textContent = salvate.length === 0
    ? ''
    : salvate.length === 1
      ? '1 risposta salvata su questo dispositivo'
      : `${salvate.length} risposte salvate su questo dispositivo`;

  if (!salvate.length) {
    contenitore.append(vuoto());
    return;
  }
  const lista = el('ul', 'elenco-salvati');
  for (const voce of salvate) lista.append(scheda(voce));
  contenitore.append(lista);
}

// conferma in linea: il pulsante «Togli tutte» non cancella al primo clic
function chiediConferma() {
  const quanteVoci = elencoSalvati().length;
  const riquadro = el('div', 'conferma-svuota');
  riquadro.append(
    el('p', 'conferma-domanda', quanteVoci === 1
      ? 'Togli l’unica risposta salvata?'
      : `Togli tutte le ${quanteVoci} risposte salvate?`),
  );

  const si = el('button', 'conferma-si', 'Sì, togli tutto');
  si.type = 'button';
  const no = el('button', 'conferma-no', 'Annulla');
  no.type = 'button';

  const anima = el('div', 'conferma-azioni');
  anima.append(si, no);

  si.addEventListener('click', () => {
    if (!svuota()) {
      annuncia('Non riesco a svuotare l’elenco: la memoria del browser è bloccata.');
      return;
    }
    disegna();
    annuncia('Ho tolto tutte le risposte salvate.');
    if (titoloPagina) titoloPagina.focus({ preventScroll: true });
  });
  no.addEventListener('click', () => {
    comandi.replaceChildren(pulsanteSvuota);
    pulsanteSvuota.focus();
  });

  riquadro.append(anima);
  comandi.replaceChildren(riquadro);
  si.focus();
}

if (pulsanteSvuota) pulsanteSvuota.addEventListener('click', chiediConferma);
disegna();
