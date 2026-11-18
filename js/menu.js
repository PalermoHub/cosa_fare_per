// Il menù «Altro» del telefono: le voci che non stanno nella barra in basso.
//
// Il pannello è nel markup di ogni pagina (`<dialog class="altre" id="altre-voci">`), quindi si apre
// anche senza JavaScript scaricato in ritardo; qui si collegano il pulsante della barra, la
// chiusura (pulsante, vela, tasto Esc), il fuoco che torna dov'era e l'aria-expanded.
// Come per il riquadro dei crediti: se il browser non ha <dialog> modale, il pannello resta
// un riquadro sopra la pagina.

const pulsante = document.querySelector('[data-altre]');
const pannello = document.getElementById('altre-voci');
let ultimoFuoco = null;

function mostra(vero) {
  if (pulsante) pulsante.setAttribute('aria-expanded', vero ? 'true' : 'false');
}

function apri() {
  if (!pannello) return;
  ultimoFuoco = document.activeElement;
  if (typeof pannello.showModal === 'function') {
    pannello.showModal();
  } else {
    pannello.setAttribute('open', '');
    document.body.classList.add('altre-aperte');
  }
  mostra(true);
  const chiudi = pannello.querySelector('[data-altre-chiudi]');
  if (chiudi) chiudi.focus();
}

function chiudi(tornaAlPulsante = true) {
  if (!pannello) return;
  if (pannello.open) pannello.close();
  else pannello.removeAttribute('open');
  document.body.classList.remove('altre-aperte');
  mostra(false);
  const fuoco = tornaAlPulsante ? ultimoFuoco : null;
  if (fuoco && typeof fuoco.focus === 'function') fuoco.focus();
}

if (pulsante && pannello) {
  pulsante.addEventListener('click', () => {
    if (pannello.open) chiudi();
    else apri();
  });

  const chiudiPulsante = pannello.querySelector('[data-altre-chiudi]');
  if (chiudiPulsante) chiudiPulsante.addEventListener('click', () => chiudi());

  // il tocco sulla vela (fuori dal pannello) chiude: si confrontano le coordinate con il riquadro
  pannello.addEventListener('click', evento => {
    const riquadro = pannello.getBoundingClientRect();
    const fuori = evento.clientX < riquadro.left || evento.clientX > riquadro.right
      || evento.clientY < riquadro.top || evento.clientY > riquadro.bottom;
    if (fuori) chiudi();
  });

  // Esc: il browser chiude da solo il <dialog> modale, qui si rimettono a posto barra e fuoco
  pannello.addEventListener('cancel', evento => {
    evento.preventDefault();
    chiudi();
  });

  // senza <dialog> modale il tasto Esc lo ascoltiamo noi
  if (typeof pannello.showModal !== 'function') {
    document.addEventListener('keydown', evento => {
      if (evento.key === 'Escape' && pannello.hasAttribute('open')) chiudi();
    });
  }

  // ruotando il telefono o allargando la finestra le voci tornano nel menu in cima:
  // il pannello aperto non deve restare appeso sopra la pagina
  const largo = window.matchMedia('(min-width: 40.01rem)');
  const forseChiudi = evento => { if (evento.matches && pannello.open) chiudi(false); };
  if (typeof largo.addEventListener === 'function') largo.addEventListener('change', forseChiudi);
  else if (typeof largo.addListener === 'function') largo.addListener(forseChiudi);
}
