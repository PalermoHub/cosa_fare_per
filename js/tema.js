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

// Il comando su schermo largo è un badge subito dopo le domande suggerite: sta fuori dal
// blocco `#suggerimenti`, che sparisce quando compare una risposta, così resta visibile
// anche mentre si legge. Sul telefono la stessa cosa si fa dalla barra in basso.
function inserisciBadge() {
  if (document.getElementById('tema')) return;
  const suggerimenti = document.getElementById('suggerimenti');
  const riferimento = suggerimenti || document.querySelector('.campo')?.closest('form');

  const riga = document.createElement('div');
  riga.className = 'tema-badge-riga';

  const pulsante = document.createElement('button');
  pulsante.type = 'button';
  pulsante.id = 'tema';
  pulsante.className = 'badge-tema';
  pulsante.addEventListener('click', cambia);

  const iconaLuna = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  iconaLuna.setAttribute('viewBox', '0 0 24 24');
  iconaLuna.setAttribute('class', 'icona-luna');
  iconaLuna.setAttribute('aria-hidden', 'true');
  iconaLuna.setAttribute('focusable', 'false');
  const percorso = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  percorso.setAttribute('d', 'M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.6 8.6 0 1 0 10.6 10.6Z');
  iconaLuna.append(percorso);

  const iconaSole = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  iconaSole.setAttribute('viewBox', '0 0 24 24');
  iconaSole.setAttribute('class', 'icona-sole');
  iconaSole.setAttribute('aria-hidden', 'true');
  iconaSole.setAttribute('focusable', 'false');
  const cerchio = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  cerchio.setAttribute('cx', '12');
  cerchio.setAttribute('cy', '12');
  cerchio.setAttribute('r', '4.2');
  iconaSole.append(cerchio);
  for (const [x1, y1, x2, y2] of [[12, 2.6, 12, 5.2], [12, 18.8, 12, 21.4], [2.6, 12, 5.2, 12], [18.8, 12, 21.4, 12],
    [5.4, 5.4, 7.2, 7.2], [16.8, 16.8, 18.6, 18.6], [16.8, 7.2, 18.6, 5.4], [5.4, 18.6, 7.2, 16.8]]) {
    const linea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    linea.setAttribute('x1', x1);
    linea.setAttribute('y1', y1);
    linea.setAttribute('x2', x2);
    linea.setAttribute('y2', y2);
    iconaSole.append(linea);
  }

  // il nome resta scritto (per i lettori di schermo), ma a video si vede solo l'icona
  const parola = document.createElement('span');
  parola.className = 'nascosto';
  pulsante.append(iconaLuna, iconaSole, parola);
  riga.append(pulsante);

  if (riferimento && riferimento.parentElement) riferimento.after(riga);
  else document.querySelector('header.testata')?.append(riga);
  aggiornaPulsante();
}

// Con una risposta aperta il badge va in testata, attaccato a «Torna all'inizio»: sono i due
// comandi che servono mentre si legge (uscire, cambiare tema), quindi stanno insieme a destra.
function gruppoAzioni() {
  const titolo = document.querySelector('.riga-titolo');
  if (!titolo) return null;
  let gruppo = titolo.querySelector('.testata-azioni');
  if (!gruppo) {
    gruppo = document.createElement('div');
    gruppo.className = 'testata-azioni';
    titolo.append(gruppo);
  }
  // «Torna all'inizio» entra nel gruppo: così non resta al centro da solo
  const nuova = document.getElementById('nuova');
  if (nuova && nuova.parentElement !== gruppo) gruppo.prepend(nuova);
  return gruppo;
}

function posizionaBadge() {
  const riga = document.querySelector('.tema-badge-riga');
  if (!riga) return;
  const suggerimenti = document.getElementById('suggerimenti');
  const gruppo = gruppoAzioni();
  if (document.body.classList.contains('ha-risultati') && gruppo) {
    gruppo.append(riga);
    riga.classList.add('in-testata');
  } else if (suggerimenti) {
    suggerimenti.after(riga);
    riga.classList.remove('in-testata');
  }
}

// la voce della barra in basso fa lo stesso del badge
const voceTema = document.getElementById('tema-barra');
if (voceTema) voceTema.addEventListener('click', cambia);

inserisciBadge();
// `ha-risultati` sul <body> dice se c'è una risposta aperta: il badge cambia posto da solo
new MutationObserver(posizionaBadge).observe(document.body, { attributes: true, attributeFilter: ['class'] });
applica(temaCorrente());
posizionaBadge();
