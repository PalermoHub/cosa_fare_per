// Invito a installare l'app: sull'app installata il browser non mostra le barre e non esce
// dallo schermo intero (su Edge la scheda normale ne esce spesso).
//
//  - Chrome, Edge, Samsung Internet…: il browser lancia `beforeinstallprompt`; lo si tiene da parte
//    e lo si apre solo al tocco su «Installa» (il browser lo ammette soltanto dopo un gesto).
//  - Safari su iPhone/iPad: non esiste un'installazione da codice, si spiega il gesto («Condividi»).
// «Non ora» mette l'invito a riposo per 14 giorni; app già installata = nessun invito.
// Nessun servizio esterno: la scelta sta solo in localStorage.

const CHIAVE = 'pinuzza-installa-no';
const GIORNI_DI_RIPOSO = 14;
const ATTESA_MS = 3000; // lasciare il tempo di leggere la pagina prima di proporre

const installata = () =>
  window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches ||
  navigator.standalone === true;

const inRiposo = () => {
  try {
    const quando = Number(localStorage.getItem(CHIAVE));
    return quando > 0 && Date.now() - quando < GIORNI_DI_RIPOSO * 864e5;
  } catch {
    return false;
  }
};
const mettiARiposo = () => {
  try { localStorage.setItem(CHIAVE, String(Date.now())); } catch { /* ok senza: solo questa visita */ }
};

// iPadOS 13+ si presenta come «Macintosh» ma ha il touch
const iosSafari =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const sembraSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

let invito = null; // l'evento del browser, se c'è
let riquadro = null;

function chiudi() {
  riquadro?.remove();
  riquadro = null;
}

function mostra() {
  if (riquadro || installata() || inRiposo()) return;
  if (!invito && !(iosSafari && sembraSafari)) return;

  riquadro = document.createElement('section');
  riquadro.className = 'installa';
  riquadro.setAttribute('role', 'dialog');
  riquadro.setAttribute('aria-label', 'Installa l’app');

  const testo = document.createElement('p');
  testo.className = 'consenso-testo';
  testo.textContent = invito
    ? 'Installa Chiedilo a Pinuzza come app: si apre senza le barre del browser, a schermo intero, e funziona anche senza rete.'
    : 'Per installare Chiedilo a Pinuzza come app: tocca Condividi, poi «Aggiungi alla schermata Home». Si apre a schermo intero.';

  const azioni = document.createElement('div');
  azioni.className = 'consenso-azioni';

  if (invito) {
    const installa = document.createElement('button');
    installa.type = 'button';
    installa.className = 'consenso-accetta';
    installa.textContent = 'Installa';
    installa.addEventListener('click', async () => {
      const evento = invito;
      invito = null;
      chiudi();
      try {
        await evento.prompt();
        const { outcome } = await evento.userChoice;
        if (outcome !== 'accepted') mettiARiposo();
      } catch {
        mettiARiposo();
      }
    });
    azioni.append(installa);
  }

  const dopo = document.createElement('button');
  dopo.type = 'button';
  dopo.textContent = invito ? 'Non ora' : 'Ho capito';
  dopo.addEventListener('click', () => { mettiARiposo(); chiudi(); });
  azioni.append(dopo);

  riquadro.append(testo, azioni);
  // il tocco sull'invito non deve far scattare l'ingresso a schermo intero (js/schermo-intero.js)
  riquadro.addEventListener('pointerup', e => e.stopPropagation());
  document.body.append(riquadro);
}

// Un solo avviso alla volta: se c'è quello sulle statistiche si aspetta che sia chiuso.
function quandoLibero(fai) {
  if (!document.querySelector('.consenso')) return void setTimeout(() => (!document.querySelector('.consenso') ? fai() : quandoLibero(fai)), ATTESA_MS);
  const osservatore = new MutationObserver(() => {
    if (document.querySelector('.consenso')) return;
    osservatore.disconnect();
    setTimeout(fai, ATTESA_MS);
  });
  osservatore.observe(document.body, { childList: true });
}

if (!installata() && !inRiposo()) {
  window.addEventListener('beforeinstallprompt', evento => {
    evento.preventDefault(); // l'invito lo facciamo noi, al momento giusto
    invito = evento;
    quandoLibero(mostra);
  });
  window.addEventListener('appinstalled', () => { invito = null; chiudi(); });
  if (iosSafari && sembraSafari) quandoLibero(mostra);
}
