// Risposte salvate: quello che l'utente mette da parte con «Salva questa risposta».
// Resta nella memoria del browser (`localStorage`, chiave `pinuzza-salvati`): niente
// server, nessun invio, nessun account. Per riaprire la risposta basta la domanda
// scritta (`index.html?q=…`, la stessa che finisce nell'indirizzo), mentre il titolo
// serve a mostrare l'elenco anche prima che i dati siano stati caricati.
//
// Se la memoria è piena o bloccata (navigazione privata, quota esaurita) le funzioni
// rispondono `false` invece di rompere l'app: chi chiama lo dice all'utente.

export const CHIAVE = 'pinuzza-salvati';
// Oltre questo numero escono le più vecchie: la memoria del browser non è infinita e
// un elenco lunghissimo non serve a nessuno.
export const MASSIMO = 100;

const EVENTO = 'pinuzza-salvati-cambiati';

function leggi() {
  let grezzo = null;
  try {
    grezzo = localStorage.getItem(CHIAVE);
  } catch (errore) {
    return []; // memoria bloccata: come se non ci fosse niente di salvato
  }
  if (!grezzo) return [];
  let dati = null;
  try {
    dati = JSON.parse(grezzo);
  } catch (errore) {
    return []; // elenco illeggibile: meglio ripartire da zero che rompere la pagina
  }
  if (!Array.isArray(dati)) return [];
  return dati
    .filter(voce => voce && typeof voce.id === 'string' && typeof voce.domanda === 'string')
    .map(voce => ({
      id: voce.id,
      domanda: voce.domanda,
      titolo: typeof voce.titolo === 'string' ? voce.titolo : '',
      quando: /^\d{4}-\d{2}-\d{2}$/.test(String(voce.quando || '')) ? voce.quando : '',
    }));
}

function scrivi(elenco) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(elenco));
    return true;
  } catch (errore) {
    return false;
  }
}

function avvisa() {
  window.dispatchEvent(new Event(EVENTO));
}

export function elencoSalvati() {
  return leggi();
}

export function quantiSalvati() {
  return leggi().length;
}

export function eSalvato(id) {
  return leggi().some(voce => voce.id === id);
}

// Salva una voce della risposta (non l'HTML: codici e testo che bastano a ritrovarla).
// Salvare due volte la stessa voce non la duplica: si aggiorna con la domanda nuova.
export function salva(voce, domanda) {
  if (!voce || !voce.id || !domanda) return false;
  const elenco = leggi().filter(s => s.id !== voce.id);
  elenco.unshift({
    id: voce.id,
    domanda: String(domanda),
    titolo: voce.titolo || '',
    quando: new Date().toISOString().slice(0, 10),
  });
  const esito = scrivi(elenco.slice(0, MASSIMO));
  if (esito) avvisa();
  return esito;
}

export function togli(id) {
  const prima = leggi();
  const dopo = prima.filter(voce => voce.id !== id);
  if (dopo.length === prima.length) return true; // niente da togliere: non è un errore
  const esito = scrivi(dopo);
  if (esito) avvisa();
  return esito;
}

export function svuota() {
  const esito = scrivi([]);
  if (esito) avvisa();
  return esito;
}

// Il numero delle risposte salvate aggiorna i pochi segnali sparsi nelle pagine:
// la pillola della home e la riga «Salvate» nel pannello «Altro» del telefono (che resta
// sempre al suo posto: a zero dice «nessuna per ora», senza sparire dal menù).
function aggiornaInterfaccia() {
  const quanti = quantiSalvati();
  for (const nodo of document.querySelectorAll('[data-scorciatoia-salvati]')) {
    nodo.hidden = quanti === 0;
  }
  for (const numero of document.querySelectorAll('[data-salvati-numero]')) {
    numero.textContent = quanti === 0
      ? 'nessuna per ora'
      : quanti === 1 ? '1 risposta' : `${quanti} risposte`;
  }
}

export function avviaSalvati() {
  aggiornaInterfaccia();
  window.addEventListener(EVENTO, aggiornaInterfaccia);
  // un'altra scheda dello stesso sito può aver salvato o tolto qualcosa
  window.addEventListener('storage', evento => {
    if (evento.key === CHIAVE) aggiornaInterfaccia();
  });
}

// il modulo è caricato come <script type="module">: il documento è già pronto o lo sarà tra un attimo
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avviaSalvati);
  else avviaSalvati();
}
