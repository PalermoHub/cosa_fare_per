// Registrazione del service worker e avviso «senza rete».
//
// Sta in tutte le pagine: l'app deve poter rispondere anche quando la connessione
// manca (allo sportello, in giro, in metropolitana). Il service worker mette in cache
// il guscio e i dati; qui si registra e si dice all'utente che sta lavorando offline,
// con la data dei dati che sta usando.

const VERSIONE_ATTESA = 'pinuzza-v67'; // deve combaciare con VERSIONE in sw.js (scripts/test_offline.mjs)

// ---------- service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(errore => {
      // capita in http:// (senza localhost) o in navigazione privata: l'app funziona lo stesso
      console.warn('Service worker non registrato:', errore && errore.message);
    });
  });
}

// ---------- avviso «senza rete» ----------

function dataSalvata() {
  const nodo = document.querySelector('#aggiornato');
  const testo = nodo?.textContent?.trim() || '';
  return testo && testo !== '—' ? testo : '';
}

function creaAvviso() {
  const avviso = document.createElement('p');
  avviso.className = 'avviso-rete';
  avviso.id = 'avviso-rete';
  avviso.setAttribute('role', 'status');
  avviso.hidden = true;

  const icona = document.createElement('span');
  icona.className = 'avviso-rete-icona';
  icona.setAttribute('aria-hidden', 'true');
  icona.textContent = '⚠';

  const testo = document.createElement('span');
  testo.className = 'avviso-rete-testo';

  avviso.append(icona, testo);

  // subito sotto la testata: resta visibile mentre si scorrono i risultati
  const testata = document.querySelector('header.testata');
  if (testata && testata.parentElement) testata.after(avviso);
  else document.body.prepend(avviso);
  return avviso;
}

function aggiornaAvviso() {
  const avviso = document.getElementById('avviso-rete') || creaAvviso();
  const offline = navigator.onLine === false;
  if (!offline) {
    avviso.hidden = true;
    return;
  }
  const data = dataSalvata();
  avviso.querySelector('.avviso-rete-testo').textContent = data
    ? `Stai lavorando senza rete: rispondo con i dati salvati sul dispositivo, aggiornati al ${data}. I link esterni e la mappa hanno bisogno di connessione.`
    : 'Stai lavorando senza rete: rispondo con i dati salvati sul dispositivo. I link esterni e la mappa hanno bisogno di connessione.';
  avviso.hidden = false;
}

aggiornaAvviso();
window.addEventListener('offline', aggiornaAvviso);
window.addEventListener('online', aggiornaAvviso);
// la data dei dati arriva quando l'app ha finito di caricare: se siamo offline la si aggiorna allora
setTimeout(aggiornaAvviso, 1500);
window.addEventListener('caricato', aggiornaAvviso);
