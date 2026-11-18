// Schermo intero automatico sul telefono.
//
// Due strade, perché nessuna basta da sola:
//  - app installata: lo decide il manifest (`display_override`), non serve codice;
//  - scheda del browser: l'API Fullscreen vuole un gesto dell'utente, quindi si entra
//    al primo tocco di OGNI pagina (cambiando pagina il browser esce dallo schermo intero).
//    Safari su iPhone non la offre per le pagine: lì resta l'installazione.
// Se l'utente esce di proposito dallo schermo intero, per quella sessione non si insiste.

const CHIAVE = 'pinuzza-schermo-intero-no';

const telefono = window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches;
const giaIntero = () =>
  document.fullscreenElement ||
  window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

const leggi = () => { try { return sessionStorage.getItem(CHIAVE); } catch { return null; } };
const scrivi = () => { try { sessionStorage.setItem(CHIAVE, '1'); } catch { /* ok senza */ } };

const radice = document.documentElement;

if (telefono && radice.requestFullscreen && !giaIntero() && !leggi()) {
  const entra = () => {
    if (giaIntero()) return;
    radice.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  };
  // pointerup: su touch è il primo evento che il browser riconosce come gesto valido
  document.addEventListener('pointerup', entra, { once: true, passive: true });

  // uscita voluta mentre la pagina è viva: rispettarla. Cambiando pagina il browser esce
  // da solo dallo schermo intero e lancia lo stesso evento: quella NON è una scelta dell'utente,
  // altrimenti dalla seconda pagina in poi non si rientrerebbe più.
  let lasciando = false;
  addEventListener('pagehide', () => { lasciando = true; });
  addEventListener('beforeunload', () => { lasciando = true; });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !lasciando && document.visibilityState === 'visible') scrivi();
  });
}
