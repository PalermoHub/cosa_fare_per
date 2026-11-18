// Tema chiaro e scuro.
//
// Regole (P1.2 di docs/DA_FARE.md):
//  - il tema di partenza è chiaro, uguale per tutti: non dipende dal sistema;
//  - se l'utente ha scelto un tema, vale la sua scelta salvata in `localStorage`
//    (`pinuzza-tema` = "chiaro" | "scuro");
//  - il tema è `data-theme` su <html>, i colori stanno tutti in css/pinuzza.css;
//  - la barra del browser (theme-color) segue il tema.
//
// Il tema viene applicato il prima possibile da uno script in linea nell'<head>: qui si
// gestiscono i pulsanti (piede e barra in basso) e la scelta dell'utente.

const CHIAVE = 'pinuzza-tema';
const radice = document.documentElement;

function sceltaSalvata() {
  try {
    const valore = localStorage.getItem(CHIAVE);
    return valore === 'chiaro' || valore === 'scuro' ? valore : null;
  } catch (errore) {
    return null; // memoria non disponibile (navigazione privata, cookie bloccati)
  }
}

function salvaScelta(tema) {
  try {
    localStorage.setItem(CHIAVE, tema);
  } catch (errore) {
    /* niente da fare: il tema resta per questa visita */
  }
}

const temaCorrente = () => (radice.dataset.theme === 'scuro' ? 'scuro' : 'chiaro');

function applica(tema) {
  radice.dataset.theme = tema;
  const barra = document.querySelector('meta[name="theme-color"]');
  if (barra) barra.setAttribute('content', tema === 'scuro' ? '#131210' : '#fcfbf7');
  aggiornaPulsante();
}

function aggiornaPulsante() {
  const scuro = temaCorrente() === 'scuro';

  const pulsante = document.getElementById('tema');
  if (pulsante) {
    pulsante.setAttribute('aria-pressed', String(scuro));
    // solo la parola: `textContent` cancellerebbe le due icone (luna e sole)
    const parola = pulsante.querySelector('span');
    const etichetta = scuro ? 'Tema chiaro' : 'Tema scuro';
    if (parola) parola.textContent = etichetta;
    else pulsante.textContent = etichetta;
    pulsante.title = scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro';
    pulsante.setAttribute('aria-label', `${pulsante.title}: ora ${scuro ? 'scuro' : 'chiaro'}`);
  }

  // interruttore del pannello «Altro» (telefono): qui la parola dice lo stato, l'icona
  // (luna o sole) la sceglie il CSS
  const voce = document.getElementById('tema-barra');
  if (voce) {
    const parola = voce.querySelector('[data-tema-parola]');
    if (parola) parola.textContent = scuro ? 'Scuro' : 'Chiaro';
    voce.setAttribute('aria-pressed', String(scuro));
    voce.setAttribute('aria-label',
      scuro ? 'Passa al tema chiaro: ora scuro' : 'Passa al tema scuro: ora chiaro');
  }
}

function cambia() {
  const nuovo = temaCorrente() === 'scuro' ? 'chiaro' : 'scuro';
  salvaScelta(nuovo);
  applica(nuovo);
}

// Due comandi, una sola scelta: il pulsante nella barra del sito (schermo largo) e
// l'interruttore nel pannello «Altro» (telefono). Stanno nel markup di ogni pagina: qui si
// collegano soltanto.
const voceTema = document.getElementById('tema-barra');
if (voceTema) voceTema.addEventListener('click', cambia);

const pulsanteTema = document.getElementById('tema');
if (pulsanteTema) pulsanteTema.addEventListener('click', cambia);

applica(temaCorrente());
