// Ricerca dal vivo negli atti del Comune di Palermo: Albo Pretorio e Delibere e
// Ordinanze. La ricerca la fa una Worker (worker/src/index.js) perché i due portali
// del Comune non si possono chiamare dal browser: niente CORS, niente iframe, e la
// ricerca è un POST con lo stato in sessione.
//
// Qui non si salva niente: ogni Cerca è una richiesta, e la pagina mostra quello che
// risponde il Comune in quel momento.

// Dove chiedere. Se un giorno il primo indirizzo non risponde (blocco, quota, guasto)
// si passa al successivo: basta aggiungerlo qui, senza toccare altro.
const ENDPOINT = [
  'https://pinuzza-atti.coseerobe.workers.dev',
];

const ATTESA_MS = 30000;

const modulo = document.getElementById('atti-form');
const campoQ = document.getElementById('atti-q');
const campoTipo = document.getElementById('atti-tipo');
const campoAnno = document.getElementById('atti-anno');
const esito = document.getElementById('atti-esito');
const contenitore = document.getElementById('atti-risultati');
const nonTrovato = document.getElementById('atti-non-trovato');
const bottone = modulo?.querySelector('button[type="submit"]');

let richiestaInCorso = null;

const scappa = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const dataBreve = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
  return m ? `${m[1]}/${m[2]}/${m[3].slice(2)}` : String(s || '');
};

const ora = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

function schedaAtto(atto) {
  const numero = atto.numero ? `<span class="atti-numero">n. ${scappa(atto.numero)}</span>` : '';
  const data = atto.data ? `<time class="atti-data">${scappa(dataBreve(atto.data))}</time>` : '';
  const pubblicato = atto.pubblicato
    ? `<span class="atti-pubblicato">pubblicato il ${scappa(dataBreve(atto.pubblicato))}${atto.scade ? `, fino al ${scappa(dataBreve(atto.scade))}` : ''}</span>`
    : '';
  const allegati = atto.allegati
    ? `<span class="atti-allegati">${atto.allegati} ${atto.allegati === 1 ? 'allegato' : 'allegati'}</span>`
    : '';
  const link = atto.link
    ? `<a class="atti-link" href="${scappa(atto.link)}" target="_blank" rel="noopener">Apri l'atto sul sito del Comune<span class="freccia-esterno" aria-hidden="true">↗</span></a>`
    : `<span class="atti-link atti-link-muto">L'atto è nell'elenco del Comune: aprilo dal portale</span>`;

  return `<article class="atti-scheda">
    <p class="atti-testa">
      <span class="atti-tipo">${scappa(atto.tipo)}</span>
      <span class="atti-portale">${scappa(atto.portale)}</span>
      ${numero}${data}
    </p>
    <p class="atti-oggetto">${scappa(atto.oggetto)}</p>
    <p class="atti-piede">${pubblicato}${allegati}</p>
    ${link}
  </article>`;
}

function statoCaricamento(testo) {
  contenitore.innerHTML = `<p class="atti-attesa"><span class="atti-puntini" aria-hidden="true"></span>${scappa(testo)}</p>`;
  nonTrovato.hidden = true;
}

function messaggio(testo) {
  esito.textContent = testo;
}

function notaTipi(dati) {
  const parti = [];
  if (dati.tipiInterrogati) parti.push(`${dati.tipiInterrogati} tipi di atto interrogati`);
  if (dati.tipiNonDisponibili) parti.push(`${dati.tipiNonDisponibili} non disponibili in questo momento`);
  if (dati.tipiNonInterrogati) parti.push(`${dati.tipiNonInterrogati} rimandati (limite della ricerca)`);
  if (dati.aggiornato) parti.push(`aggiornato alle ${ora(dati.aggiornato)}`);
  return parti.join(' · ');
}

function mostra(dati, q) {
  const risultati = dati.risultati || [];
  const totale = dati.totale || 0;

  if (!risultati.length) {
    contenitore.innerHTML = '';
    nonTrovato.hidden = false;
    messaggio(q
      ? `Nessun atto con «${q}». Prova con una parola sola, oppure cambia tipo o anno.`
      : 'In questo momento non ci sono atti pubblicati per questo tipo.');
    return;
  }

  contenitore.innerHTML = risultati.map(schedaAtto).join('');
  nonTrovato.hidden = false;

  const quanti = totale > risultati.length
    ? `${totale} atti trovati, i ${risultati.length} più recenti`
    : `${totale} ${totale === 1 ? 'atto trovato' : 'atti trovati'}`;
  messaggio(`${quanti} · ${notaTipi(dati)}`);
}

async function chiedi(parametri, segnale) {
  const query = new URLSearchParams(parametri);
  let ultimoErrore = null;

  for (const base of ENDPOINT) {
    const controllo = new AbortController();
    const scadenza = setTimeout(() => controllo.abort(), ATTESA_MS);
    const annulla = () => controllo.abort();
    segnale?.addEventListener('abort', annulla, { once: true });
    try {
      const risposta = await fetch(`${base}/cerca?${query}`, {
        signal: controllo.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(scadenza);
      if (!risposta.ok) {
        const corpo = await risposta.json().catch(() => ({}));
        ultimoErrore = new Error(corpo.errore || `Il servizio ha risposto ${risposta.status}`);
        if (risposta.status === 400) break;
        continue;
      }
      return await risposta.json();
    } catch (errore) {
      clearTimeout(scadenza);
      segnale?.removeEventListener('abort', annulla);
      ultimoErrore = errore;
    }
  }
  throw ultimoErrore || new Error('Ricerca non disponibile');
}

function errore(errore) {
  contenitore.innerHTML = `<div class="atti-errore" role="alert">
      <p><strong>La ricerca non è disponibile in questo momento.</strong> Il servizio del Comune non ha
      risposto, oppure la connessione è caduta.</p>
      <p>Puoi cercare direttamente nei due portali:
      <a href="https://albopretorio.comune.palermo.it/albopretorio/jsp/home.jsp?modo=info&amp;info=servizi.jsp" rel="noopener">Albo Pretorio</a>
      e
      <a href="https://servizionline.comune.palermo.it/portcitt/jsp/home.jsp?modo=info&amp;info=servizi.jsp&amp;SERCOD=60&amp;SERCODROOT=60" rel="noopener">Delibere e Ordinanze</a>.</p>
      ${errore && errore.message ? `<p class="atti-errore-dettaglio">${scappa(errore.message)}</p>` : ''}
    </div>`;
  messaggio('');
  nonTrovato.hidden = true;
}

function aggiornaIndirizzo(parametri) {
  const url = new URL(location.href);
  url.search = '';
  for (const [chiave, valore] of Object.entries(parametri)) {
    const predefinito = (chiave === 'recenti' && valore === '1') || (chiave === 'tipo' && valore === 'tutti');
    if (valore && !predefinito) url.searchParams.set(chiave, valore);
  }
  history.replaceState(null, '', url);
}

async function cerca() {
  const q = (campoQ?.value || '').trim();
  const tipo = campoTipo?.value || 'tutti';
  const anno = (campoAnno?.value || '').trim();

  const parametri = { tipo };
  if (q) parametri.q = q;
  if (anno) parametri.anno = anno;
  if (!q && !anno) parametri.recenti = '1';

  if (richiestaInCorso) richiestaInCorso.abort();
  richiestaInCorso = new AbortController();
  const segnale = richiestaInCorso.signal;

  bottone?.setAttribute('disabled', 'disabled');
  statoCaricamento(q ? `Sto cercando «${q}» negli atti del Comune…` : 'Sto leggendo gli atti più recenti dal Comune…');
  messaggio('La ricerca interroga i portali del Comune in diretta: può volerci qualche secondo.');

  try {
    const dati = await chiedi(parametri, segnale);
    mostra(dati, q);
    aggiornaIndirizzo({ q, tipo, anno });
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    errore(e);
  } finally {
    bottone?.removeAttribute('disabled');
    richiestaInCorso = null;
  }
}

// stato iniziale dall'indirizzo, così una ricerca si può condividere
const iniziali = new URLSearchParams(location.search);
if (iniziali.get('q')) campoQ.value = iniziali.get('q');
if (iniziali.get('tipo') && campoTipo.querySelector(`option[value="${CSS.escape(iniziali.get('tipo'))}"]`)) {
  campoTipo.value = iniziali.get('tipo');
}
if (iniziali.get('anno')) campoAnno.value = iniziali.get('anno');

modulo?.addEventListener('submit', (evento) => {
  evento.preventDefault();
  cerca();
});

// prima apertura: gli atti più recenti, senza che si debba premere niente
cerca();
