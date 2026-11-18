// Aspetto del sito: undici temi curati più uno personalizzabile e dimensione del testo.
//
// Regole (P1.2 di docs/DA_FARE.md, estese il 18/11/2026):
//  - il tema di partenza è chiaro, uguale per tutti: non dipende dal sistema;
//  - se l'utente ha scelto, vale la sua scelta salvata in `localStorage`:
//      `pinuzza-tema`        = uno dei temi curati (chiaro, scuro, seppia, salvia, mare, notte, bosco,
//                            contrasto, contrasto-chiaro, blu-arancio, rosso-petrolio) oppure "personalizzato"
//      `pinuzza-tema-colori` = { scelte, vars }  (solo per il tema personalizzato)
//      `pinuzza-testo`       = "0".."4"          (dimensione del testo, "1" = normale)
//  - il tema è `data-theme` su <html>, i colori stanno in css/pinuzza.css; il personalizzato
//    scrive le sue variabili sulla radice (stile in linea), derivate da quattro colori in
//    js/tema-colori.js che ne garantisce il contrasto;
//  - la barra del browser (theme-color) segue il tema.
//
// Il tema e il testo vengono applicati il prima possibile da uno script in linea nell'<head>
// di ogni pagina; qui si costruisce il pannello «Aspetto» e si gestisce la scelta.

import { derivaTema, contrasto, valido } from './tema-colori.js';

const CHIAVE = 'pinuzza-tema';
const CHIAVE_COLORI = 'pinuzza-tema-colori';
const CHIAVE_TESTO = 'pinuzza-testo';
const radice = document.documentElement;

// `campioni` = sfondo, testo, accento: servono ai tre pallini dell'anteprima e alla barra
// del browser; un test controlla che coincidano con i valori in css/pinuzza.css.
const TEMI = [
  { id: 'chiaro', nome: 'Chiaro', campioni: ['#fcfbf7', '#17150f', '#0e5a54'] },
  { id: 'scuro', nome: 'Scuro', campioni: ['#131210', '#f3efe4', '#7fd8cb'] },
  { id: 'seppia', nome: 'Seppia', campioni: ['#f2e8d2', '#2b2214', '#0b5a4f'] },
  { id: 'salvia', nome: 'Salvia', campioni: ['#eef2e6', '#1f2a1c', '#2f5d2a'] },
  { id: 'mare', nome: 'Mare', campioni: ['#eaf1f5', '#14232e', '#0b5a8a'] },
  { id: 'notte', nome: 'Notte', campioni: ['#0e1420', '#e9eef7', '#8fc2ff'] },
  { id: 'bosco', nome: 'Bosco', campioni: ['#0f1a14', '#e8f1e6', '#9be0a8'] },
  { id: 'contrasto', nome: 'Contrasto giallo', campioni: ['#000000', '#ffffff', '#ffe14d'] },
  { id: 'contrasto-chiaro', nome: 'Contrasto chiaro', campioni: ['#ffffff', '#000000', '#00428a'] },
  { id: 'blu-arancio', nome: 'Blu e arancio', campioni: ['#fbfbf9', '#16181c', '#004f8c'] },
  { id: 'rosso-petrolio', nome: 'Rosso e petrolio', campioni: ['#fcfaf9', '#1a1618', '#9c1139'] },
];
const ID_TEMI = [...TEMI.map(t => t.id), 'personalizzato'];
const PASSI_TESTO = ['90%', '100%', '115%', '130%', '150%'];
const TESTO_NORMALE = 1;

// ---------- memoria (può non esserci: navigazione privata, cookie bloccati) ----------

function leggi(chiave) {
  try { return localStorage.getItem(chiave); } catch (errore) { return null; }
}
function scrivi(chiave, valore) {
  try { localStorage.setItem(chiave, valore); } catch (errore) { /* resta per questa visita */ return; }
  chiediPersistenza();
}

// La scelta deve restare finché l'utente non la cambia o non cancella i dati del sito.
// `localStorage` non ha scadenza, ma alcuni browser (Safari dopo sette giorni senza visite)
// sfoltiscono i dati dei siti poco usati: si chiede di non farlo. Richiesta facoltativa:
// il browser può rifiutare, e senza questa API non cambia nulla.
let persistenzaChiesta = false;
function chiediPersistenza() {
  if (persistenzaChiesta) return;
  persistenzaChiesta = true;
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persist().catch(() => { /* rifiutata: si resta con la memoria normale */ });
    }
  } catch (errore) { /* API non disponibile */ }
}
function togli(chiave) {
  try { localStorage.removeItem(chiave); } catch (errore) { /* niente da togliere */ }
}

function coloriSalvati() {
  try {
    const dati = JSON.parse(leggi(CHIAVE_COLORI));
    const s = dati && dati.scelte;
    if (s && ['sfondo', 'testo', 'accento', 'caldo'].every(k => valido(s[k]))) return s;
  } catch (errore) { /* JSON rovinato: si riparte dal tema chiaro */ }
  return null;
}

// ---------- applicare ----------

let variabiliPersonalizzate = [];

function ripulisciPersonalizzato() {
  for (const nome of variabiliPersonalizzate) radice.style.removeProperty(nome);
  variabiliPersonalizzate = [];
}

function scriviVariabili(vars) {
  ripulisciPersonalizzato();
  for (const [nome, valore] of Object.entries(vars)) {
    radice.style.setProperty(nome, valore);
    variabiliPersonalizzate.push(nome);
  }
}

const temaCorrente = () => (ID_TEMI.includes(radice.dataset.theme) ? radice.dataset.theme : 'chiaro');
const nomeTema = id => (id === 'personalizzato' ? 'Personalizzato' : TEMI.find(t => t.id === id).nome);

function colore(nome) {
  return getComputedStyle(radice).getPropertyValue(nome).trim();
}

function applica(id) {
  radice.dataset.theme = id;
  if (id !== 'personalizzato') ripulisciPersonalizzato();
  const barra = document.querySelector('meta[name="theme-color"]');
  if (barra) barra.setAttribute('content', colore('--carta') || '#fcfbf7');
  aggiornaComandi();
}

function applicaPersonalizzato(scelte) {
  const { vars, corretti } = derivaTema(scelte);
  radice.dataset.theme = 'personalizzato';
  scriviVariabili(vars);
  scrivi(CHIAVE, 'personalizzato');
  scrivi(CHIAVE_COLORI, JSON.stringify({ scelte, vars }));
  const barra = document.querySelector('meta[name="theme-color"]');
  if (barra) barra.setAttribute('content', vars['--carta']);
  aggiornaComandi();
  return { vars, corretti };
}

function scegliTema(id) {
  if (id === 'personalizzato') {
    const scelte = coloriSalvati() || {
      sfondo: colore('--carta'), testo: colore('--inchiostro'),
      accento: colore('--accento-fondo'), caldo: colore('--caldo-fondo'),
    };
    // i colori di partenza sono quelli del tema in uso, se sono esadecimali
    for (const k of Object.keys(scelte)) if (!valido(scelte[k])) scelte[k] = '#808080';
    return applicaPersonalizzato(scelte);
  }
  scrivi(CHIAVE, id);
  applica(id);
  return null;
}

// ---------- dimensione del testo ----------

function passoTesto() {
  const n = Number(radice.dataset.testo);
  return Number.isInteger(n) && n >= 0 && n < PASSI_TESTO.length ? n : TESTO_NORMALE;
}

function scegliTesto(n) {
  const passo = Math.min(PASSI_TESTO.length - 1, Math.max(0, n));
  if (passo === TESTO_NORMALE) { delete radice.dataset.testo; togli(CHIAVE_TESTO); }
  else { radice.dataset.testo = String(passo); scrivi(CHIAVE_TESTO, String(passo)); }
  aggiornaComandi();
}

// ---------- comandi nel markup di ogni pagina ----------

function aggiornaComandi() {
  const id = temaCorrente();
  const nome = nomeTema(id);
  const testo = PASSI_TESTO[passoTesto()];

  const pulsante = document.getElementById('tema');
  if (pulsante) {
    pulsante.title = `Aspetto: tema ${nome.toLowerCase()}, testo al ${testo}`;
    pulsante.setAttribute('aria-label', `Aspetto del sito: tema ${nome.toLowerCase()}, testo al ${testo}. Apri le opzioni`);
  }
  const voce = document.getElementById('tema-barra');
  if (voce) {
    const parola = voce.querySelector('[data-tema-parola]');
    if (parola) parola.textContent = `${nome}, testo al ${testo}`;
    voce.setAttribute('aria-label', `Aspetto: tema ${nome.toLowerCase()}, testo al ${testo}. Apri le opzioni`);
  }
  aggiornaPannello();
}

// ---------- il pannello «Aspetto» ----------

let pannello = null;
let ultimoFuoco = null;

const elemento = (nome, attributi = {}, ...figli) => {
  const e = document.createElement(nome);
  for (const [k, v] of Object.entries(attributi)) {
    if (k === 'class') e.className = v;
    else if (k === 'testo') e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...figli);
  return e;
};

const CAMPI = [
  ['sfondo', 'Sfondo'], ['testo', 'Testo'], ['accento', 'Accento'], ['caldo', 'Evidenza'],
];

function costruisciPannello() {
  const chiudi = elemento('button', { type: 'button', class: 'altre-chiudi', 'data-aspetto-chiudi': '', 'aria-label': 'Chiudi' });
  chiudi.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  const temi = elemento('div', { class: 'aspetto-temi' });
  for (const t of [...TEMI, { id: 'personalizzato', nome: 'Personalizzato', campioni: null }]) {
    const campioni = elemento('span', { class: 'aspetto-campioni', 'aria-hidden': 'true' });
    if (t.campioni) {
      t.campioni.forEach((c, i) => {
        const p = elemento('i');
        p.style.background = c;
        if (i === 0) campioni.style.background = c;
        campioni.append(p);
      });
      campioni.querySelector('i').remove(); // il primo pallino è lo sfondo stesso
    } else {
      campioni.classList.add('aspetto-campioni-libero');
    }
    const radio = elemento('input', { type: 'radio', name: 'aspetto-tema', value: t.id });
    temi.append(elemento('label', { class: 'aspetto-tema' }, radio, campioni, elemento('span', { class: 'aspetto-nome', testo: t.nome })));
  }

  const editor = elemento('div', { class: 'aspetto-editor', id: 'aspetto-editor', hidden: '' });
  const griglia = elemento('div', { class: 'aspetto-colori' });
  for (const [chiave, etichetta] of CAMPI) {
    const input = elemento('input', { type: 'color', 'data-colore': chiave, 'aria-label': etichetta });
    griglia.append(elemento('label', { class: 'aspetto-colore' }, input, elemento('span', { testo: etichetta })));
  }
  editor.append(
    griglia,
    elemento('p', { class: 'aspetto-stato', id: 'aspetto-stato', role: 'status', 'aria-live': 'polite' }),
    elemento('button', { type: 'button', class: 'aspetto-azione', 'data-aspetto-ripristina': '', testo: 'Torna al tema chiaro' }),
  );

  const meno = elemento('button', { type: 'button', class: 'aspetto-passo', 'data-testo-meno': '', 'aria-label': 'Riduci il testo' }, elemento('span', { 'aria-hidden': 'true', testo: 'A−' }));
  const piu = elemento('button', { type: 'button', class: 'aspetto-passo aspetto-passo-grande', 'data-testo-piu': '', 'aria-label': 'Ingrandisci il testo' }, elemento('span', { 'aria-hidden': 'true', testo: 'A+' }));
  const valore = elemento('output', { class: 'aspetto-valore', 'data-testo-valore': '', 'aria-live': 'polite' });
  const normale = elemento('button', { type: 'button', class: 'aspetto-azione', 'data-testo-normale': '', testo: 'Dimensione normale' });

  const nota = elemento('p', { class: 'aspetto-nota', testo: '«Blu e arancio» e «Rosso e petrolio» sono pensati per il daltonismo: il primo per chi confonde rosso e verde, il secondo per chi confonde blu e giallo.' });
  const gruppoTemi = elemento('fieldset', { class: 'aspetto-gruppo' }, elemento('legend', { testo: 'Tema' }), temi, nota, editor);
  const gruppoTesto = elemento('fieldset', { class: 'aspetto-gruppo' },
    elemento('legend', { testo: 'Dimensione del testo' }),
    elemento('div', { class: 'aspetto-testo' }, meno, valore, piu),
    normale);

  const d = elemento('dialog', { class: 'altre aspetto', id: 'aspetto', 'aria-labelledby': 'aspetto-titolo' },
    elemento('div', { class: 'altre-testa' }, elemento('h2', { class: 'altre-titolo', id: 'aspetto-titolo', testo: 'Aspetto' }), chiudi),
    gruppoTemi, gruppoTesto);
  document.body.append(d);

  // — eventi —
  temi.addEventListener('change', evento => {
    const radio = evento.target;
    if (!(radio instanceof HTMLInputElement)) return;
    const risultato = scegliTema(radio.value);
    if (risultato) mostraStato(risultato);
  });
  griglia.addEventListener('input', evento => {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement) || !campo.dataset.colore) return;
    const scelte = {};
    for (const input of griglia.querySelectorAll('input[data-colore]')) scelte[input.dataset.colore] = input.value;
    mostraStato(applicaPersonalizzato(scelte));
  });
  d.querySelector('[data-aspetto-ripristina]').addEventListener('click', () => {
    togli(CHIAVE_COLORI);
    scegliTema('chiaro');
  });
  meno.addEventListener('click', () => scegliTesto(passoTesto() - 1));
  piu.addEventListener('click', () => scegliTesto(passoTesto() + 1));
  normale.addEventListener('click', () => scegliTesto(TESTO_NORMALE));
  chiudi.addEventListener('click', () => chiudiPannello());
  d.addEventListener('click', evento => {
    const r = d.getBoundingClientRect();
    if (evento.clientX < r.left || evento.clientX > r.right || evento.clientY < r.top || evento.clientY > r.bottom) chiudiPannello();
  });
  d.addEventListener('cancel', evento => { evento.preventDefault(); chiudiPannello(); });
  return d;
}

function mostraStato({ vars, corretti }) {
  const stato = document.getElementById('aspetto-stato');
  if (!stato) return;
  const rapporto = contrasto(vars['--inchiostro'], vars['--carta']);
  let frase = `Contrasto del testo sullo sfondo: ${rapporto.toFixed(1).replace('.', ',')}:1 (minimo ${'4,5'}:1).`;
  if (corretti.length) {
    frase += ` Per tenere il testo leggibile ho ritoccato: ${corretti.join(', ')}.`;
  }
  stato.textContent = frase;
}

function aggiornaPannello() {
  if (!pannello) return;
  const id = temaCorrente();
  for (const radio of pannello.querySelectorAll('input[name="aspetto-tema"]')) radio.checked = radio.value === id;

  const editor = pannello.querySelector('#aspetto-editor');
  editor.hidden = id !== 'personalizzato';
  const personalizzato = pannello.querySelector('input[value="personalizzato"]');
  const campioni = personalizzato && personalizzato.parentElement.querySelector('.aspetto-campioni');
  const salvati = coloriSalvati();
  if (campioni && salvati) {
    campioni.classList.remove('aspetto-campioni-libero');
    campioni.style.background = `linear-gradient(135deg, ${salvati.sfondo} 0 50%, ${salvati.accento} 50% 100%)`;
    campioni.style.borderColor = salvati.testo;
  }
  if (id === 'personalizzato' && salvati) {
    for (const input of pannello.querySelectorAll('input[data-colore]')) {
      if (document.activeElement !== input) input.value = salvati[input.dataset.colore];
    }
  }

  const n = passoTesto();
  pannello.querySelector('[data-testo-valore]').textContent = PASSI_TESTO[n];
  pannello.querySelector('[data-testo-meno]').disabled = n === 0;
  pannello.querySelector('[data-testo-piu]').disabled = n === PASSI_TESTO.length - 1;
  pannello.querySelector('[data-testo-normale]').disabled = n === TESTO_NORMALE;
}

function apriPannello() {
  // dal telefono si arriva dal pannello «Altro»: lo si chiude, per non impilare due pannelli
  const altre = document.getElementById('altre-voci');
  const pulsanteAltre = document.querySelector('[data-altre]');
  const dalPannelloAltro = altre && altre.open;
  if (dalPannelloAltro) {
    altre.close();
    document.body.classList.remove('altre-aperte');
    if (pulsanteAltre) pulsanteAltre.setAttribute('aria-expanded', 'false');
  }
  ultimoFuoco = dalPannelloAltro && pulsanteAltre ? pulsanteAltre : document.activeElement;
  if (!pannello) pannello = costruisciPannello();
  aggiornaPannello();
  if (typeof pannello.showModal === 'function') pannello.showModal();
  else pannello.setAttribute('open', '');
  const attivo = pannello.querySelector('input[name="aspetto-tema"]:checked');
  if (attivo) attivo.focus();
}

function chiudiPannello() {
  if (!pannello) return;
  if (pannello.open) pannello.close();
  else pannello.removeAttribute('open');
  if (ultimoFuoco && typeof ultimoFuoco.focus === 'function') ultimoFuoco.focus();
}

for (const id of ['tema', 'tema-barra']) {
  const comando = document.getElementById(id);
  if (comando) comando.addEventListener('click', apriPannello);
}

// All'avvio lo script in linea ha già scelto tema e testo: qui si allineano barra e comandi.
// Se la memoria dei colori personalizzati è rovinata si ricade sul tema chiaro.
if (temaCorrente() === 'personalizzato' && !coloriSalvati()) applica('chiaro');
else applica(temaCorrente());
