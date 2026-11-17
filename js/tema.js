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
    pulsante.textContent = scuro ? 'Tema chiaro' : 'Tema scuro';
    pulsante.title = scuro ? 'Passa al tema chiaro' : 'Passa al tema scuro';
    pulsante.setAttribute('aria-label', `${pulsante.title}: ora ${scuro ? 'scuro' : 'chiaro'}`);
  }

  // voce della barra in basso (solo telefono): l'icona la sceglie il CSS, qui la parola
  const voce = document.getElementById('tema-barra');
  if (voce) {
    const parola = voce.querySelector('span');
    if (parola) parola.textContent = scuro ? 'Chiaro' : 'Scuro';
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

function inserisciPulsante() {
  if (document.getElementById('tema')) return;
  const pulsante = document.createElement('button');
  pulsante.type = 'button';
  pulsante.id = 'tema';
  pulsante.className = 'link-bottone';
  pulsante.addEventListener('click', cambia);

  // nel piede, dove stanno le impostazioni. Non dentro `.piede-legale`: sul telefono quella
  // riga è nascosta e il pulsante deve restare raggiungibile (le testate delle tre pagine
  // hanno forme diverse, quindi il piede è l'unico posto uguale per tutte).
  const nota = document.querySelector('.piede .piede-nota');
  const paragrafo = document.querySelector('.piede p');
  if (!paragrafo) return;
  const gruppo = document.createElement('span');
  gruppo.className = 'piede-tema';
  gruppo.append(document.createTextNode(' · '), pulsante);
  if (nota && nota.parentElement === paragrafo) nota.after(gruppo);
  else paragrafo.append(gruppo);
  aggiornaPulsante();
}

// la voce della barra in basso fa lo stesso del pulsante nel piede
const voceTema = document.getElementById('tema-barra');
if (voceTema) voceTema.addEventListener('click', cambia);

inserisciPulsante();
applica(temaCorrente());
