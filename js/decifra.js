// «Decifra la PA»: dal link di un avviso pubblico alle istruzioni da incollare in un
// assistente AI (ChatGPT, Claude, Gemini…), perché lo spieghi in italiano semplice.
//
// L'app non chiama nessuna intelligenza artificiale e non manda niente in rete: compone
// soltanto il testo delle istruzioni, che resta nel browser finché non lo incolla l'utente.
// Il modello è adattato da «"Decifra" la PA» dell'app «in due tocchi» di Andrea Borruso
// (https://github.com/aborruso/in_due_tocchi, licenza MIT): i crediti stanno nel riquadro
// «Credits» (js/crediti.js) e in fondo a questa finestra.

// Il modello, diviso in tre pezzi: la fonte cambia (link o testo incollato), le regole no.
function fonte(link, testo) {
  const parti = [];
  if (link) {
    parti.push(`1. Leggi l'articolo a questo URL:\n${link}`);
    if (testo) parti.push(`Se il link non si apre, ecco il testo dell'articolo:\n\n${testo}`);
  } else {
    parti.push(`1. Leggi questo testo:\n\n${testo}`);
  }
  return parti.join('\n\n');
}

export function istruzioni(link, testo) {
  return `${fonte((link || '').trim(), (testo || '').trim())}

2. Riscrivi tutto con queste regole:
   - Linguaggio semplice, come se lo spiegassi a un'amica o a un vicino di casa
   - Niente burocratese, niente sigle senza spiegazione
   - Fai capire subito cosa cambia per le persone
   - Metti in evidenza: cosa bisogna fare, da quando, chi è coinvolto, eventuali vantaggi o conseguenze
   - Se ci sono obblighi, spiega cosa succede se non si rispettano
   - Se ci sono eccezioni, falle capire con esempi concreti
   - Mantieni lo stile scorrevole
   - Evita frasi lunghe e amministrative
   - Usa titoletti e punti elenco quando serve

3. Chiudi il testo con una mini-sezione finale: "In pratica questo significa:"
   con 3–5 punti molto concreti e orientati alla vita reale.

4. Non aggiungere informazioni non presenti nella fonte.
   Se qualcosa non è chiaro nell'articolo, specificalo come "non è indicato".

Scrivi tutto in italiano.`;
}

// Accetta anche un indirizzo scritto senza schema («www.comune.palermo.it/…»).
export function normalizzaLink(valore) {
  const link = (valore || '').trim();
  if (!link) return '';
  if (/^www\./i.test(link)) return `https://${link}`;
  return link;
}

export function linkValido(link) {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Le chat web più usate, per chi sta al computer (dove non c'è il pannello di condivisione
// del telefono). Dove il servizio accetta il testo nell'indirizzo lo passiamo già pronto;
// negli altri casi la pagina si apre e le istruzioni restano negli appunti, da incollare.
// Il testo parte solo quando l'utente clicca «Apri».
export const SERVIZI_AI = [
  // Claude è la scelta predefinita
  { nome: 'Claude', indirizzo: 'https://claude.ai/new?q=', giaPronto: true },
  { nome: 'DeepSeek', indirizzo: 'https://chat.deepseek.com/', giaPronto: false },
  { nome: 'Qwen', indirizzo: 'https://chat.qwen.ai/', giaPronto: false },
  { nome: 'Z.ai', indirizzo: 'https://chat.z.ai/', giaPronto: false },
  { nome: 'Kimi', indirizzo: 'https://www.kimi.com/', giaPronto: false },
  { nome: 'ChatGPT', indirizzo: 'https://chatgpt.com/?q=', giaPronto: true },
  { nome: 'Gemini', indirizzo: 'https://gemini.google.com/app', giaPronto: false },
  { nome: 'Copilot', indirizzo: 'https://copilot.microsoft.com/', giaPronto: false },
  { nome: 'Perplexity', indirizzo: 'https://www.perplexity.ai/search?q=', giaPronto: true },
  { nome: 'Grok', indirizzo: 'https://grok.com/', giaPronto: false },
];

export function servizioPerNome(nome) {
  return SERVIZI_AI.find(servizio => servizio.nome === nome) || SERVIZI_AI[0];
}

export function indirizzoChat(servizio, testo) {
  return servizio.giaPronto ? servizio.indirizzo + encodeURIComponent(testo) : servizio.indirizzo;
}

let finestra = null;
let ultimoFuoco = null;

function elemento(tag, classe, testo) {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  if (testo !== undefined) nodo.textContent = testo;
  return nodo;
}

function collegamento(testo, href, titolo) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = testo;
  if (titolo) a.title = titolo;
  return a;
}

function iconaChiudi() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const percorso = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  percorso.setAttribute('d', 'M6.8 6.8l10.4 10.4M17.2 6.8 6.8 17.2');
  svg.append(percorso);
  return svg;
}

function costruisci() {
  const riquadro = elemento('dialog', 'decifra');
  riquadro.id = 'decifra-pa';
  riquadro.setAttribute('aria-labelledby', 'decifra-titolo');

  const testa = elemento('div', 'decifra-testa');
  const titolo = elemento('h2', 'decifra-titolo', 'Decifra la PA');
  titolo.id = 'decifra-titolo';
  const chiudi = elemento('button', 'decifra-chiudi');
  chiudi.type = 'button';
  chiudi.setAttribute('aria-label', 'Chiudi Decifra la PA');
  chiudi.append(iconaChiudi());
  testa.append(titolo, chiudi);

  const spiegazione = elemento(
    'p',
    'decifra-spiega',
    'Avvisi, bandi e comunicati sono scritti in burocratese. Incolla il link (o il testo) di quello che vuoi capire: preparo le istruzioni da incollare nel tuo assistente AI, così te lo spiegano in italiano semplice — cosa cambia, cosa devi fare e da quando.',
  );

  const modulo = elemento('form', 'decifra-campi');
  modulo.noValidate = true;

  const etichettaLink = elemento('label', 'decifra-etichetta', 'Il link dell\'avviso, del bando o della notizia');
  etichettaLink.htmlFor = 'decifra-link';
  const campoLink = elemento('input');
  campoLink.id = 'decifra-link';
  campoLink.type = 'url';
  campoLink.name = 'link';
  campoLink.inputMode = 'url';
  campoLink.autocomplete = 'url';
  campoLink.placeholder = 'https://…';
  campoLink.setAttribute('aria-describedby', 'decifra-aiuto-link decifra-errore');

  const aiutoLink = elemento(
    'p',
    'decifra-aiuto',
    'Va bene anche un PDF pubblico. Il link resta nel tuo browser: non lo mando a nessuno.',
  );
  aiutoLink.id = 'decifra-aiuto-link';

  const senzaLink = elemento('details', 'decifra-senza-link');
  const sommario = elemento('summary', null, 'Non c\'è un link? Incolla il testo');
  const etichettaTesto = elemento('label', 'nascosto', 'Il testo dell\'avviso, del bando o della notizia');
  etichettaTesto.htmlFor = 'decifra-testo-fonte';
  const campoTesto = elemento('textarea');
  campoTesto.id = 'decifra-testo-fonte';
  campoTesto.rows = 6;
  campoTesto.placeholder = 'Incolla qui il testo dell\'avviso';
  senzaLink.append(sommario, etichettaTesto, campoTesto);

  const errore = elemento('p', 'decifra-errore');
  errore.id = 'decifra-errore';
  errore.setAttribute('role', 'alert');
  errore.hidden = true;

  const prepara = elemento('button', 'decifra-prepara', 'Prepara le istruzioni');
  prepara.type = 'submit';

  modulo.append(etichettaLink, campoLink, aiutoLink, senzaLink, errore, prepara);

  const esito = elemento('div', 'decifra-esito');
  esito.hidden = true;
  const etichettaIstruzioni = elemento(
    'label',
    'decifra-etichetta',
    'Istruzioni pronte: copiale e incollale nel tuo assistente AI',
  );
  etichettaIstruzioni.htmlFor = 'decifra-istruzioni';
  const istruzioniPronte = elemento('textarea', 'decifra-istruzioni');
  istruzioniPronte.id = 'decifra-istruzioni';
  istruzioniPronte.readOnly = true;
  istruzioniPronte.rows = 7;

  const azioni = elemento('div', 'decifra-azioni');
  const copia = elemento('button', 'decifra-copia', 'Copia le istruzioni');
  copia.type = 'button';
  const condividi = elemento('button', 'decifra-condividi', 'Condividi');
  condividi.type = 'button';
  condividi.hidden = typeof navigator.share !== 'function';
  azioni.append(copia, condividi);

  // la chat web si sceglie da un elenco: ognuno usa quella che preferisce
  const apriBlocco = elemento('div', 'decifra-apri');
  const etichettaServizio = elemento('label', 'decifra-etichetta decifra-etichetta-apri', 'Apri in');
  etichettaServizio.htmlFor = 'decifra-servizio';
  const sceltaServizio = elemento('select', 'decifra-servizio');
  sceltaServizio.id = 'decifra-servizio';
  for (const servizio of SERVIZI_AI) {
    const voce = elemento('option', null, servizio.nome);
    voce.value = servizio.nome;
    sceltaServizio.append(voce);
  }
  const apriChat = collegamento(`Apri ${SERVIZI_AI[0].nome} ↗`, SERVIZI_AI[0].indirizzo, '');
  apriChat.className = 'decifra-apri-chat';
  apriBlocco.append(etichettaServizio, sceltaServizio, apriChat);

  const notaChat = elemento(
    'p',
    'decifra-nota-computer',
    'Sul telefono «Condividi» passa le istruzioni all\'app che usi. Da computer scegli la chat web e premi «Apri»: le istruzioni vengono copiate e, se non compaiono già, basta incollarle.',
  );

  const stato = elemento('p', 'decifra-stato');
  stato.setAttribute('role', 'status');
  stato.setAttribute('aria-live', 'polite');

  esito.append(etichettaIstruzioni, azioni, apriBlocco, notaChat, istruzioniPronte, stato);

  const fonteCrediti = elemento('p', 'decifra-fonte');
  fonteCrediti.append(
    'Istruzioni adattate da «Decifra la PA» dell\'app ',
    collegamento('in due tocchi', 'https://aborruso.github.io/in_due_tocchi/', 'in due tocchi, di Andrea Borruso'),
    ' di ',
    collegamento('Andrea Borruso', 'https://github.com/aborruso', 'aborruso su GitHub'),
    ' · ',
    collegamento('codice su GitHub', 'https://github.com/aborruso/in_due_tocchi', 'Repository in_due_tocchi'),
    ' (licenza MIT).',
  );

  riquadro.append(testa, spiegazione, modulo, esito, fonteCrediti);
  document.body.append(riquadro);

  const nascondi = () => {
    if (riquadro.open) riquadro.close();
    else riquadro.removeAttribute('open');
    document.body.classList.remove('decifra-aperti');
    if (ultimoFuoco && typeof ultimoFuoco.focus === 'function') ultimoFuoco.focus();
  };

  chiudi.addEventListener('click', nascondi);
  riquadro.addEventListener('cancel', evento => {
    evento.preventDefault();
    nascondi();
  });
  riquadro.addEventListener('close', () => {
    document.body.classList.remove('decifra-aperti');
    if (ultimoFuoco && typeof ultimoFuoco.focus === 'function') ultimoFuoco.focus();
  });

  const mostraErrore = messaggio => {
    errore.textContent = messaggio;
    errore.hidden = !messaggio;
    campoLink.setAttribute('aria-invalid', messaggio ? 'true' : 'false');
    if (messaggio) campoLink.focus();
  };

  modulo.addEventListener('submit', evento => {
    evento.preventDefault();
    stato.textContent = '';
    const link = normalizzaLink(campoLink.value);
    const testo = campoTesto.value.trim();

    if (!link && !testo) {
      mostraErrore('Incolla il link di un avviso oppure, se il link non c\'è, il suo testo.');
      return;
    }
    if (link && !linkValido(link)) {
      mostraErrore('Il link deve essere un indirizzo pubblico che comincia con http:// o https://.');
      return;
    }

    mostraErrore('');
    istruzioniPronte.value = istruzioni(link, testo);
    aggiornaApri();
    esito.hidden = false;
    istruzioniPronte.scrollTop = 0;
    istruzioniPronte.focus({ preventScroll: true });
    stato.textContent = 'Istruzioni pronte.';
    // sul telefono la finestra scorre quel tanto che basta a mettere le istruzioni
    // subito sotto la testata appiccicata (niente righe tagliate a metà)
    const testata = riquadro.querySelector('.decifra-testa');
    const scarto = esito.getBoundingClientRect().top - riquadro.getBoundingClientRect().top - (testata ? testata.offsetHeight : 0);
    riquadro.scrollTop = Math.max(0, riquadro.scrollTop + scarto);
  });

  const aggiornaApri = () => {
    const servizio = servizioPerNome(sceltaServizio.value);
    apriChat.href = indirizzoChat(servizio, istruzioniPronte.value);
    apriChat.textContent = `Apri ${servizio.nome} ↗`;
    apriChat.setAttribute('aria-label', `Apri ${servizio.nome} in una nuova scheda e copia le istruzioni`);
  };

  const copiaNegliAppunti = async () => {
    const testoIstruzioni = istruzioniPronte.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(testoIstruzioni);
        return true;
      } catch {
        /* si prova il ripiego qui sotto */
      }
    }
    istruzioniPronte.focus();
    istruzioniPronte.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  };

  copia.addEventListener('click', async () => {
    const copiato = await copiaNegliAppunti();
    stato.textContent = copiato
      ? 'Istruzioni copiate: incollale nel tuo assistente AI.'
      : 'Non sono riuscito a copiare: seleziona il testo e copialo a mano.';
  });

  sceltaServizio.addEventListener('change', aggiornaApri);

  // prima si avvia il caricamento della chat (il clic è ancora «fresco»), poi si copia:
  // così le istruzioni sono negli appunti anche dove il servizio non le mostra già
  apriChat.addEventListener('click', () => {
    const servizio = servizioPerNome(sceltaServizio.value);
    copiaNegliAppunti().then(copiato => {
      stato.textContent = copiato
        ? `Istruzioni copiate: se ${servizio.nome} non le mostra già, incollale nella chat.`
        : `Se ${servizio.nome} non mostra le istruzioni, copiale con «Copia le istruzioni».`;
    });
  });

  condividi.addEventListener('click', async () => {
    try {
      await navigator.share({ title: 'Decifra la PA', text: istruzioniPronte.value });
      stato.textContent = 'Istruzioni condivise.';
    } catch (erroreCondivisione) {
      if (erroreCondivisione.name !== 'AbortError') {
        stato.textContent = 'Non sono riuscito a condividere: copia il testo.';
      }
    }
  });

  return riquadro;
}

export function apriDecifra(origine) {
  if (!finestra) finestra = costruisci();
  ultimoFuoco = origine || document.activeElement;
  if (typeof finestra.showModal === 'function') {
    finestra.showModal();
  } else {
    finestra.setAttribute('open', '');
    document.body.classList.add('decifra-aperti');
  }
  const campo = finestra.querySelector('#decifra-link');
  if (campo) {
    campo.focus();
    if (campo.value) campo.select();
  }
}

export function avviaDecifra() {
  for (const bottone of document.querySelectorAll('[data-decifra]')) {
    bottone.addEventListener('click', evento => {
      evento.preventDefault();
      apriDecifra(bottone);
    });
  }
}

// la pagina carica questo file come modulo; in Node (test) non c'è documento e non si avvia
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avviaDecifra);
  else avviaDecifra();
}
