// Schermo intero automatico sul telefono.
//
// Due strade, perché nessuna basta da sola:
//  - app installata: lo decide il manifest (`display_override`), non serve codice;
//  - scheda del browser: l'API Fullscreen vuole un gesto dell'utente, quindi si entra
//    al primo tocco di OGNI pagina (cambiando pagina il browser esce dallo schermo intero).
//    Safari su iPhone non la offre per le pagine: lì resta l'installazione.
// Una sola uscita non è una scelta (tastiera, gesti dai bordi): si rientra al tocco dopo;
// dopo 3 uscite sulla stessa pagina si smette di insistere (e si ricomincia sulla pagina nuova).

const CHIAVE = 'pinuzza-schermo-intero-no';
// Quante uscite consecutive tollerare prima di concludere che l'utente non lo vuole.
// Edge (e altri) escono da soli aprendo la tastiera o con i gesti dai bordi: una sola
// uscita non è una scelta, quindi al tocco successivo si rientra.
const MAX_USCITE = 3;

const telefono = window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches;
const giaIntero = () =>
  document.fullscreenElement ||
  window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

const leggi = () => { try { return sessionStorage.getItem(CHIAVE); } catch { return null; } };
const scrivi = () => { try { sessionStorage.setItem(CHIAVE, '1'); } catch { /* ok senza */ } };

const radice = document.documentElement;
const inCampo = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');

if (telefono && radice.requestFullscreen && !giaIntero() && !leggi()) {
  let uscite = 0;
  let lasciando = false;

  const entra = () => {
    if (giaIntero()) return;
    // con la tastiera aperta il browser esce subito: aspettare il tocco fuori dal campo
    if (inCampo()) return riarma();
    radice.requestFullscreen({ navigationUI: 'hide' }).catch(() => riarma());
  };
  // pointerup: su touch è il primo evento che il browser riconosce come gesto valido
  const riarma = () => document.addEventListener('pointerup', entra, { once: true, passive: true });
  riarma();

  // Cambiando pagina il browser esce da solo e lancia lo stesso evento: non conta.
  addEventListener('pagehide', () => { lasciando = true; });
  addEventListener('beforeunload', () => { lasciando = true; });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement || lasciando || document.visibilityState !== 'visible') return;
    uscite += 1;
    if (uscite >= MAX_USCITE) { scrivi(); return; }
    riarma(); // rientra al prossimo tocco, senza insistere
  });
}
