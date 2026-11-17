// «Chiedilo a Pinuzza» — interfaccia.
// Nessuna rete oltre ai dati locali, nessun modello linguistico: la risposta viene
// dalle voci preparate (data/argomenti.json) e dalle schede servizio del Comune.

import { indicizza, cerca, cercaSezioni, cercaUffici, suggerimenti, SOGLIA_SICURA, SOGLIA_MINIMA } from './motore.js';
import { caricaBase, caricaUffici, stato, ufficiDellaVoce } from './dati.js';
import { eSalvato, salva, togli } from './salvati.js';

const $ = sel => document.querySelector(sel);
const risultati = $('#risultati');
const modulo = $('#modulo');
const campo = $('#domanda');
const bottone = $('#invia');
const contenitoreSuggerimenti = $('#suggerimenti');
const bottoneNuova = $('#nuova');
const bottoneAzzera = $('#azzera');
const testata = $('#testata');
const bottoneInCima = $('#inCima'); // solo per nasconderlo quando si azzera la pagina

let indice = [];
let ultimeAlternative = [];

// etichette delle sezioni delle schede servizio ufficiali
const SEZIONI_SCHEDA = [
  ['come_fare', 'Come fare'],
  ['cosa_serve', 'Cosa serve'],
  ['cosa_si_ottiene', 'Cosa si ottiene'],
  ['tempi', 'Tempi e scadenze'],
  ['costo', 'Quanto costa'],
  ['presentare', 'Come presentare la richiesta'],
  ['altro', 'Ulteriori informazioni'],
  ['condizioni', 'Condizioni di servizio'],
];

// ---------- utilità di costruzione del DOM ----------

function el(tag, classe, testo) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (testo != null) n.textContent = testo; // sempre testo, mai HTML
  return n;
}

function paragrafi(testo) {
  const frammento = document.createDocumentFragment();
  const righe = String(testo).split('\n').map(r => r.trim()).filter(Boolean);
  let elenco = null;
  for (const riga of righe) {
    if (riga.startsWith('- ')) {
      if (!elenco || elenco.tagName !== 'UL') {
        elenco = el('ul');
        frammento.append(elenco);
      }
      elenco.append(el('li', null, riga.slice(2)));
    } else {
      elenco = null;
      frammento.append(el('p', null, riga));
    }
  }
  return frammento;
}

function sezione(titolo, contenuto, livello = 3) {
  if (!contenuto) return null;
  const s = el('div', 'sezione');
  s.append(el(`h${livello}`, null, titolo));
  if (Array.isArray(contenuto)) {
    const lista = el('ol');
    for (const voce of contenuto) lista.append(el('li', null, voce));
    s.append(lista);
  } else {
    s.append(paragrafi(contenuto));
  }
  return s;
}

function sezioneElenco(titolo, voci, livello = 3) {
  if (!voci || !voci.length) return null;
  const s = el('div', 'sezione');
  s.append(el(`h${livello}`, null, titolo));
  const lista = el('ul');
  for (const v of voci) lista.append(el('li', null, v));
  s.append(lista);
  return s;
}

// ---------- scheda dell'ufficio ----------

const haCoordinate = u => Array.isArray(u.coord) && u.coord.length === 2;

// mini mappa OpenStreetMap incorporata: si carica solo quando la scheda entra nello schermo
function mappaIncorporata(ufficio) {
  const contenitore = el('div', 'mappa');
  if (!haCoordinate(ufficio)) {
    contenitore.classList.add('mappa-senza');
    contenitore.textContent = ufficio.indirizzo
      ? 'Mappa non disponibile: la sede non ha coordinate pubblicate. Il pulsante «Percorso» usa l’indirizzo.'
      : 'Mappa non disponibile: il Comune non pubblica indirizzo né coordinate di questa sede. Usa la scheda ufficiale.';
    return contenitore;
  }
  const [lon, lat] = ufficio.coord;
  const d = 0.0035;
  const bbox = [lon - d, lat - d / 1.6, lon + d, lat + d / 1.6].map(n => n.toFixed(5)).join('%2C');
  const iframe = el('iframe');
  iframe.title = `Mappa della sede: ${ufficio.sede || ufficio.nome}`;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer';
  iframe.dataset.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
  iframe.src = 'about:blank';
  if ('IntersectionObserver' in window) {
    const osservatore = new IntersectionObserver(voci => {
      for (const voce of voci) {
        if (voce.isIntersecting && iframe.dataset.src) {
          iframe.src = iframe.dataset.src;
          delete iframe.dataset.src;
          osservatore.disconnect();
        }
      }
    }, { rootMargin: '200px' });
    osservatore.observe(iframe);
  } else {
    iframe.src = iframe.dataset.src;
  }
  contenitore.append(iframe);

  const link = el('a', null, 'Apri la mappa più grande');
  link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  link.rel = 'noopener';
  link.className = 'mappa-link';
  contenitore.append(link);
  return contenitore;
}

// «Percorso»: chiede la posizione, poi apre il navigatore con la destinazione già impostata
function chiediPosizione() {
  return new Promise((risolvi, rifiuta) => {
    if (!navigator.geolocation) {
      rifiuta(new Error('Il browser non offre la posizione'));
      return;
    }
    navigator.geolocation.getCurrentPosition(risolvi, rifiuta, {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 60000,
    });
  });
}

function urlPercorso(ufficio, posizione) {
  const destinazione = haCoordinate(ufficio)
    ? `${ufficio.coord[1]},${ufficio.coord[0]}`
    : encodeURIComponent(ufficio.indirizzo || ufficio.sede || 'Comune di Palermo');
  const parametri = new URLSearchParams({ api: '1', destination: destinazione, travelmode: 'driving' });
  if (posizione) parametri.set('origin', `${posizione.coords.latitude},${posizione.coords.longitude}`);
  return `https://www.google.com/maps/dir/?${parametri.toString()}`;
}

async function apriPercorso(ufficio, bottone) {
  const etichetta = bottone.textContent;
  // la scheda del navigatore va aperta subito, dentro il clic: se si aspetta il GPS
  // il browser blocca la finestra come popup
  const finestra = window.open('about:blank', '_blank');
  if (finestra) {
    try {
      finestra.opener = null;
      finestra.document.title = 'Percorso verso l\'ufficio…';
      finestra.document.body.textContent = 'Sto preparando il percorso…';
    } catch (e) { /* la finestra potrebbe non essere ancora pronta */ }
  }
  const vai = url => {
    if (finestra && !finestra.closed) finestra.location.replace(url);
    else window.location.href = url;
  };

  bottone.disabled = true;
  bottone.textContent = 'Cerco il GPS…';
  const avviso = bottone.closest('.ufficio')?.querySelector('.avviso-gps');
  if (avviso) avviso.hidden = true;
  try {
    const posizione = await chiediPosizione();
    vai(urlPercorso(ufficio, posizione));
  } catch (errore) {
    vai(urlPercorso(ufficio, null));
    if (avviso) {
      avviso.hidden = false;
      avviso.textContent = errore && errore.code === 1
        ? 'Hai negato la posizione: per il percorso più veloce attiva il GPS (o consenti la posizione a questo sito) e riprova. Intanto si apre la mappa: imposta tu la partenza.'
        : 'Non riesco a leggere la posizione: attiva il GPS e riprova per avere il percorso più veloce. Intanto si apre la mappa senza partenza.';
    }
  } finally {
    bottone.disabled = false;
    bottone.textContent = etichetta;
  }
}

function schedaUfficio(ufficio, { livello = 3, mappa = true } = {}) {
  const card = el('article', 'ufficio');

  const pulito = nome => (nome && !/^uffici non collocati$/i.test(nome) ? nome : '');
  const gerarchia = [pulito(ufficio.area), pulito(ufficio.settore)].filter(Boolean).join(' › ');
  if (gerarchia) card.append(el('p', 'percorso-ufficio', gerarchia));
  card.append(el(`h${livello}`, null, ufficio.nome));

  if (ufficio.responsabili) card.append(el('p', 'responsabile', `Responsabile: ${ufficio.responsabili}`));

  const dl = el('dl');
  const riga = (etichetta, valore) => {
    if (!valore) return;
    dl.append(el('dt', null, etichetta));
    const dd = el('dd');
    if (valore instanceof Node) dd.append(valore);
    else dd.textContent = valore;
    dl.append(dd);
  };
  // quando il Comune non pubblica un recapito, la riga c'è lo stesso: il silenzio
  // sembrerebbe una dimenticanza nostra e chi legge non sa se il dato manca
  const mancante = testo => el('span', 'dato-mancante', testo);

  const indirizzo = ufficio.indirizzo || '';
  const nomeSede = ufficio.sede || '';
  // «Piazza Giulio Cesare, 6» e «P.za Giulio Cesare, 6, 90123 Palermo» sono la stessa sede:
  // se le parole del nome sede stanno già nell'indirizzo, il nome non si ripete
  const paroleSede = nomeSede.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(p => p.length > 1);
  const paroleIndirizzo = new Set(indirizzo.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' '));
  const contenuta = paroleSede.length > 0 && paroleSede.filter(p => paroleIndirizzo.has(p)).length >= Math.ceil(paroleSede.length * 0.6);
  const sede = nomeSede && indirizzo && !contenuta ? `${nomeSede} — ${indirizzo}` : indirizzo || nomeSede;
  riga('Sede', sede || mancante('Non pubblicata dal Comune'));

  if (ufficio.telefoni?.length) {
    const telefono = el('a', null, ufficio.telefoni.slice(0, 2).join(' · '));
    telefono.href = `tel:${ufficio.telefoni[0].replace(/[^\d+]/g, '')}`;
    riga('Telefono', telefono);
  } else {
    riga('Telefono', mancante('Non pubblicato dal Comune'));
  }
  const email = (ufficio.email || []).filter(e => !(ufficio.pec || []).includes(e));
  if (email.length) {
    const mail = el('a', null, email[0]);
    mail.href = `mailto:${email[0]}`;
    riga('Email', mail);
  } else {
    riga('Email', mancante('Non pubblicata dal Comune'));
  }
  if (ufficio.pec?.length) {
    const pec = el('a', null, ufficio.pec[0]);
    pec.href = `mailto:${ufficio.pec[0]}`;
    riga('PEC', pec);
  }
  if (ufficio.aggiornata) riga('Scheda aggiornata il', ufficio.aggiornata);
  if (dl.childElementCount) card.append(dl);

  if (mappa) card.append(mappaIncorporata(ufficio));

  const azioni = el('div', 'azioni');
  // senza un indirizzo o delle coordinate il «Percorso» non porta da nessuna parte:
  // meglio nessun pulsante che un pulsante che apre una destinazione generica
  if (ufficio.indirizzo || ufficio.sede || haCoordinate(ufficio)) {
    const btnPercorso = el('button', 'percorso', 'Percorso');
    btnPercorso.type = 'button';
    btnPercorso.title = 'Calcola il percorso più veloce dalla tua posizione';
    btnPercorso.addEventListener('click', () => apriPercorso(ufficio, btnPercorso));
    azioni.append(btnPercorso);
  }
  if (ufficio.url) {
    const a = el('a', null, 'Scheda ufficiale');
    a.href = ufficio.url;
    a.rel = 'noopener';
    azioni.append(a);
  }
  card.append(azioni);

  const nota = el('p', 'avviso-gps');
  nota.hidden = true;
  card.append(nota);

  return card;
}

// ---------- risposta ----------

// ---------- stato di revisione della risposta ----------
// Le voci con risposta preparata restano «da-rivedere» finché una persona non le
// controlla (docs/REVISIONE.md). L'avviso sta in cima, prima dei passi: chi legge
// deve saperlo prima di usare l'informazione, non dopo.

function dataIt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function avvisoRevisione(voce) {
  const rev = voce.revisione || {};
  if (rev.stato === 'fonte-ufficiale') return null; // è il testo della scheda del Comune
  if (rev.stato === 'ok') {
    const quando = dataIt(rev.data);
    const p = el(
      'p',
      'revisione-ok',
      `Informazione rivista da una persona${rev.da ? ` (${rev.da})` : ''}${quando ? ` il ${quando}` : ''}.`,
    );
    return p;
  }
  // stato sconosciuto o assente: si tratta come non rivista, che è l'ipotesi sicura
  const p = el('p', 'avviso avviso-revisione');
  p.append(
    el('strong', null, 'Informazione preparata. '),
    document.createTextNode(
      "Non è ancora stata verificata da una persona: confermala allo sportello o con l'ufficio competente prima di presentare la domanda.",
    ),
  );
  return p;
}

function corpoRisposta(voce, { livello = 2, classe = 'risposta' } = {}) {
  const scheda = voce.servizio ? stato.servizi[voce.servizio] : null;
  const articolo = el('article', classe);

  articolo.append(el('p', 'etichetta', voce.categoria || scheda?.categorie?.[0] || 'Comune di Palermo'));
  articolo.append(el(`h${livello}`, null, voce.titolo));

  const revisione = avvisoRevisione(voce);
  if (revisione) articolo.append(revisione);

  if (voce.risposta) {
    if (voce.risposta.sintesi) articolo.append(el('p', 'sintesi', voce.risposta.sintesi));
    const come = sezione('Come fare', voce.risposta.passi, livello + 1);
    if (come) articolo.append(come);
    const serve = sezioneElenco('Cosa serve', voce.risposta.serve, livello + 1);
    if (serve) articolo.append(serve);
    if (voce.risposta.nota) {
      const nota = el('p', 'nota');
      nota.append(el('strong', null, 'Da sapere. '), document.createTextNode(voce.risposta.nota));
      articolo.append(nota);
    }
  } else if (scheda) {
    if (scheda.sommario) articolo.append(el('p', 'sintesi', scheda.sommario));
    for (const [chiave, titolo] of SEZIONI_SCHEDA) {
      const s = sezione(titolo, scheda.sezioni?.[chiave], livello + 1);
      if (s) articolo.append(s);
    }
    const nota = el('p', 'nota');
    nota.append(
      el('strong', null, 'Fonte. '),
      document.createTextNode('Questa risposta riporta il testo della scheda servizio pubblicata dal Comune di Palermo.'),
    );
    articolo.append(nota);
  } else {
    articolo.append(el('p', 'sintesi', 'Non ho la scheda di questo servizio: prova a chiedermelo con altre parole.'));
  }

  const link = [...(voce.link || [])];
  if (scheda?.url) link.unshift({ titolo: 'Scheda ufficiale del servizio', url: scheda.url });
  if (scheda?.accedi) link.push({ titolo: 'Accedi al servizio online', url: scheda.accedi });
  if (link.length) {
    const collegamenti = el('div', 'collegamenti');
    for (const l of link.slice(0, 4)) {
      const a = el('a', null, l.titolo);
      a.href = l.url;
      a.rel = 'noopener';
      collegamenti.append(a);
    }
    articolo.append(collegamenti);
  }

  return articolo;
}

async function schedeUffici(voce, { livello = 3, mappa = true } = {}) {
  if (!voce) return null;
  const uffici = ufficiDellaVoce(voce);
  if (!uffici.length) return null;
  const contenitore = el('div', 'uffici');
  for (const u of uffici.slice(0, 3)) contenitore.append(schedaUfficio(u, { livello, mappa }));
  return contenitore;
}

async function rispostaSicura(voce, domanda) {
  const frammento = document.createDocumentFragment();
  frammento.append(corpoRisposta(voce));
  await caricaUffici();
  const schede = await schedeUffici(voce);
  if (schede) {
    const intestazione = el('div', 'sezione');
    intestazione.append(el('h3', null, 'A chi rivolgerti'));
    frammento.append(intestazione, schede);
  }
  if (domanda) frammento.append(bloccoUtile(voce, domanda));
  frammento.append(bloccoSalva(voce, domanda));
  return frammento;
}

async function rispostaIncerta(voce, domanda, alternative) {
  const frammento = document.createDocumentFragment();
  const avviso = el('p', 'avviso');
  avviso.append(
    el('strong', null, 'Non sono sicura di aver capito. '),
    document.createTextNode('Se non è questo, dimmelo con altre parole o scegli una delle domande qui sotto.'),
  );
  frammento.append(avviso, corpoRisposta(voce));
  await caricaUffici();
  const schede = await schedeUffici(voce);
  if (schede) frammento.append(schede);
  if (alternative.length) frammento.append(domandeVicine(alternative));
  if (domanda) frammento.append(bloccoUtile(voce, domanda));
  return frammento;
}

// Una domanda può contenere due richieste: la scheda principale resta quella, questa
// è la seconda, con i suoi uffici ma senza il riquadro «ti è stato utile?» (uno basta).
async function rispostaAnche(sezioni) {
  const box = el('section', 'anche');
  const titolo = el('h3', null, 'Nella domanda c’è anche questo');
  titolo.id = 'anche-titolo';
  box.setAttribute('aria-labelledby', titolo.id);
  box.append(titolo);
  await caricaUffici();
  for (const sezione of sezioni) {
    box.append(corpoRisposta(sezione.voce, { livello: 4, classe: 'risposta risposta-anche' }));
    // niente mappa nella seconda scheda: raddoppierebbe i riquadri OpenStreetMap della pagina.
    // Gli uffici stanno chiusi in un <details>: la seconda scheda non deve raddoppiare la
    // lunghezza della pagina, ma i recapiti devono restare a una riga di distanza.
    const schede = await schedeUffici(sezione.voce, { livello: 5, mappa: false });
    if (schede) {
      const quanti = schede.querySelectorAll('.ufficio').length;
      const dettagli = el('details', 'anche-uffici');
      dettagli.append(el('summary', null, quanti > 1 ? `A chi rivolgerti (${quanti} uffici)` : 'A chi rivolgerti'));
      dettagli.append(schede);
      box.append(dettagli);
    }
  }
  return box;
}

function domandeVicine(elencoDomande) {
  const box = el('div', 'domande-vicine');
  box.append(el('h3', null, 'Forse cercavi'));
  const ul = el('ul');
  for (const testo of elencoDomande) {
    const li = el('li');
    const b = el('button', null, testo);
    b.type = 'button';
    b.addEventListener('click', () => chiedi(testo));
    li.append(b);
    ul.append(li);
  }
  box.append(ul);
  return box;
}

async function rispostaVuota(domanda) {
  const frammento = document.createDocumentFragment();
  const box = el('div', 'vuoto');
  box.append(el('h2', null, 'Non ho una risposta pronta'));
  box.append(
    el('p', null,
      `Su «${domanda}» non ho una scheda preparata. Posso però indicarti gli uffici che si occupano di cose simili: ` +
      'se non è quello giusto, prova a scrivere la domanda in un altro modo (per esempio «come cambio residenza»).'),
  );
  frammento.append(box);

  await caricaUffici();
  const trovati = cercaUffici(Object.values(stato.uffici), domanda, 3);
  if (trovati.length) {
    const intestazione = el('div', 'sezione');
    intestazione.append(el('h3', null, 'Uffici che potrebbero occuparsene'));
    frammento.append(intestazione);
    const contenitore = el('div', 'uffici');
    for (const t of trovati) contenitore.append(schedaUfficio(t.ufficio));
    frammento.append(contenitore);
  } else {
    frammento.append(
      el('p', null, 'Non ho trovato nemmeno un ufficio pertinente: prova con le parole del servizio, per esempio «tari», «cila», «mensa».'),
    );
  }
  if (ultimeAlternative.length) frammento.append(domandeVicine(ultimeAlternative));
  return frammento;
}

// ---------- «ti è stato utile?» ----------
// Nessun backend: «Sì» resta un evento aggregato (solo se il consenso è già dato);
// «No» apre una segnalazione già scritta su GitHub, che l'utente legge e corregge
// prima di inviare. Nel testo finiscono solo il codice della voce e la domanda scritta:
// niente nome, niente email, niente indirizzo IP nostro.

const NUOVA_SEGNALAZIONE = 'https://github.com/PalermoHub/cosa_fare_per/issues/new';

// Evento aggregato: parte solo se il consenso alle statistiche è già stato dato (stessa chiave
// di js/consenso.js). Non si importa la funzione da consenso.js apposta: se il service worker
// servisse un consenso.js di una versione vecchia l'import farebbe fallire tutta l'app.
function registraEvento(nome, parametri = {}) {
  let scelta = null;
  try {
    scelta = localStorage.getItem('pinuzza-consenso');
  } catch (errore) {
    return;
  }
  if (scelta !== 'accettato' || typeof window.gtag !== 'function') return;
  window.gtag('event', nome, parametri);
}

function urlSegnalazione(voce, domanda) {
  const corpo = [
    `Voce: ${voce.id} — ${voce.titolo}`,
    '',
    `Domanda: ${domanda}`,
    '',
    'Cosa non torna (requisito, ufficio, importo, link…):',
    '- ',
    '',
    "Nota: questo testo è preparato dall'app con il codice della voce e la domanda che hai scritto. Non contiene altri dati tuoi.",
  ].join('\n');
  const parametri = new URLSearchParams({
    labels: 'segnalazione',
    title: `[Risposta] ${voce.id}`,
    body: corpo,
  });
  return `${NUOVA_SEGNALAZIONE}?${parametri.toString()}`;
}

function bloccoUtile(voce, domanda) {
  const riquadro = el('div', 'utile');
  const etichetta = el('p', 'utile-domanda', 'Ti è stato utile?');
  etichetta.id = `utile-${voce.id}`;
  riquadro.setAttribute('role', 'group');
  riquadro.setAttribute('aria-labelledby', etichetta.id);

  const azioni = el('div', 'utile-azioni');
  const si = el('button', 'utile-si', 'Sì, grazie');
  const no = el('button', 'utile-no', 'No, la risposta è sbagliata');
  si.type = 'button';
  no.type = 'button';
  azioni.append(si, no);

  const esito = el('div', 'utile-esito');
  esito.setAttribute('role', 'status');

  si.addEventListener('click', () => {
    esito.textContent = 'Grazie: lo tengo da conto.';
    si.disabled = true;
    no.disabled = true;
    registraEvento('risposta_utile', { voce_id: voce.id });
  });

  no.addEventListener('click', () => {
    // la finestra va aperta subito, dentro il clic, altrimenti il browser la blocca.
    // Si apre una pagina vuota e poi ci si naviga: con `noopener` window.open restituisce
    // null e non si saprebbe distinguere «bloccata» da «aperta».
    const indirizzo = urlSegnalazione(voce, domanda);
    const finestra = window.open('about:blank', '_blank');
    if (finestra) {
      try {
        finestra.opener = null;
        finestra.location.replace(indirizzo);
      } catch (errore) {
        finestra.location.href = indirizzo;
      }
    }
    esito.replaceChildren(
      el('p', null, finestra
        ? 'Ho preparato la segnalazione su GitHub in una nuova scheda: puoi leggerla e correggerla prima di inviarla. Per pubblicarla serve un account GitHub.'
        : 'La segnalazione è pronta ma il browser ha bloccato la nuova scheda: aprila con il pulsante qui sotto.'),
    );
    const link = el('a', null, 'Apri la segnalazione su GitHub');
    link.href = indirizzo;
    link.target = '_blank';
    link.rel = 'noopener';
    const nota = el('p', 'utile-nota', "Contiene solo il codice della voce e la domanda che hai scritto: nessun altro dato tuo, e puoi modificarla prima di inviarla.");
    esito.append(link, nota);
    si.disabled = true;
    no.disabled = true;
    registraEvento('risposta_non_utile', { voce_id: voce.id });
  });

  riquadro.append(etichetta, azioni, esito);
  return riquadro;
}

// ---------- «salva questa risposta» ----------
// Il comando sta in fondo alla scheda, dopo il «ti è stato utile?»: mette da parte la
// risposta nella memoria del browser (js/salvati.js), senza inviarla a nessuno. Il testo
// del pulsante dice sempre cosa succede adesso: salva, oppure toglie se è già salvata.

function bloccoSalva(voce, domanda) {
  const riquadro = el('div', 'salva');
  const bottone = el('button', 'salva-bottone');
  bottone.type = 'button';
  const esito = el('span', 'salva-esito');
  esito.setAttribute('role', 'status');

  const disegna = () => {
    const salvata = eSalvato(voce.id);
    bottone.textContent = salvata ? 'Salvata: toglila dall’elenco' : 'Salva questa risposta';
    bottone.classList.toggle('salvata', salvata);
  };
  disegna();

  bottone.addEventListener('click', () => {
    const salvata = eSalvato(voce.id);
    const riuscito = salvata ? togli(voce.id) : salva(voce, domanda);
    esito.textContent = '';
    if (!riuscito) {
      esito.textContent = 'Non riesco a salvare su questo dispositivo: la memoria del browser è piena o bloccata.';
      return;
    }
    disegna();
    if (salvata) {
      esito.textContent = 'Tolta dalle risposte salvate.';
      annuncia('Risposta tolta dalle risposte salvate.');
    } else {
      const link = el('a', null, 'vedi le risposte salvate');
      link.href = 'salvati.html';
      esito.append('Salvata su questo dispositivo: ', link, '.');
      annuncia('Risposta salvata: la trovi nella pagina Risposte salvate.');
    }
  });

  riquadro.append(bottone, esito);
  riquadro.append(el('p', 'salva-nota', 'Resta qui nel browser: la domanda non viene inviata a nessuno.'));
  return riquadro;
}

// ---------- conversazione ----------

const annuncio = $('#annuncio');

function aggiornaStatoPagina() {
  document.body.classList.add('ha-risultati');
  bottoneAzzera.hidden = false;
}

// Il contenitore dei risultati non è più `aria-live` (avrebbe annunciato tutta la risposta,
// un carattere alla volta mentre si scrive): qui si annuncia in una riga che cosa è arrivato.
function annuncia(testo) {
  if (!annuncio) return;
  annuncio.textContent = '';
  // un attimo dopo, altrimenti i lettori di schermo non notano il cambiamento
  setTimeout(() => { annuncio.textContent = testo; }, 60);
}

// Dopo una risposta il focus va sul titolo: chi usa la tastiera o un lettore di schermo
// riparte da lì, non resta nel campo di ricerca.
function portaFocusSullaRisposta(contenuto) {
  const titolo = contenuto.querySelector('article.risposta h2, .vuoto h2');
  if (!titolo) return;
  titolo.setAttribute('tabindex', '-1');
  titolo.focus({ preventScroll: true });
}

function ripulisci(testo) {
  return testo.replace(/\s+/g, ' ').trim();
}

async function chiedi(testo, { daStorico = false } = {}) {
  const domanda = ripulisci(testo || '');
  if (!domanda) return;

  campo.value = domanda;
  aggiornaStatoPagina();
  bottoneNuova.hidden = false;
  bottone.disabled = true;

  // la pagina azzerata sparisce appena arriva una nuova domanda
  risultati.querySelector('.azzerato')?.remove();

  const scambio = el('section', 'scambio');
  scambio.append(el('h2', 'domanda-fatta', domanda));
  const contenuto = el('div', 'contenuto');
  scambio.append(contenuto);
  risultati.prepend(scambio); // la più recente in alto, sotto la testata
  scambio.scrollIntoView({ block: 'start', behavior: 'smooth' });
  contenuto.append(el('p', 'attesa', 'Pinuzza sta cercando…'));

  try {
    const trovati = cerca(indice, domanda, 3);
    const migliore = trovati[0];
    contenuto.textContent = '';

    if (migliore && migliore.punteggio >= SOGLIA_SICURA) {
      contenuto.append(await rispostaSicura(migliore.indice.voce, domanda));
      const anche = cercaSezioni(indice, domanda, { esclusa: migliore.indice.voce.id, quante: 2 });
      if (anche.length) contenuto.append(await rispostaAnche(anche));
      annuncia(
        anche.length
          ? `Risposta pronta: ${migliore.indice.voce.titolo}. Nella domanda c’è anche: ${anche.map(a => a.voce.titolo).join(', ')}.`
          : `Risposta pronta: ${migliore.indice.voce.titolo}.`,
      );
      portaFocusSullaRisposta(contenuto);
    } else if (migliore && migliore.punteggio >= SOGLIA_MINIMA) {
      const alternative = [
        ...trovati.slice(1).map(t => t.indice.voce.domande[0]),
        ...(migliore.indice.voce.domande || []).slice(0, 3),
      ].filter(Boolean);
      ultimeAlternative = [...new Set(alternative)].slice(0, 3);
      contenuto.append(await rispostaIncerta(migliore.indice.voce, domanda, ultimeAlternative));
      annuncia(`Forse ho capito: ${migliore.indice.voce.titolo}. Se non è questo, scegli una delle domande vicine.`);
      portaFocusSullaRisposta(contenuto);
    } else {
      ultimeAlternative = suggerimenti(stato.voci, 3);
      contenuto.append(await rispostaVuota(domanda));
      annuncia('Non ho una risposta pronta: ti indico gli uffici che potrebbero occuparsene.');
      portaFocusSullaRisposta(contenuto);
    }
  } catch (errore) {
    contenuto.textContent = '';
    const avviso = el('p', 'avviso');
    avviso.append(el('strong', null, 'Qualcosa non ha funzionato. '), document.createTextNode(errore.message || String(errore)));
    contenuto.append(avviso);
    console.error(errore);
  } finally {
    bottone.disabled = false;
    if (!daStorico) {
      const url = new URL(window.location.href);
      url.searchParams.set('q', domanda);
      if (url.href !== window.location.href) history.pushState({ domanda }, '', url);
    }
  }
}

// «Azzera» sta accanto a «Chiedi»: svuota risposta e campo ma non riporta alla home,
// la pagina resta questa (testata compatta, comando a portata di mano).
function azzeraRisultati() {
  risultati.textContent = '';
  campo.value = '';
  ultimeAlternative = [];
  bottoneInCima.hidden = true;
  // il ?q= non deve far ricomparire la risposta al ricaricamento; replaceState non
  // aggiunge una tappa alla cronologia, quindi «indietro» resta il passo di prima
  if (window.location.search) history.replaceState({}, '', window.location.pathname);
  const vuoto = el('div', 'vuoto azzerato');
  vuoto.append(el('h2', null, 'Ho azzerato tutto'));
  vuoto.append(el('p', null, 'Puoi scrivere una nuova domanda qui sopra: resto in questa pagina.'));
  risultati.append(vuoto);
  annuncia('Ho azzerato tutto: puoi scrivere una nuova domanda.');
  risultati.scrollTo({ top: 0 });
  campo.focus({ preventScroll: true });
}

function tornaAllInizio({ daStorico = false } = {}) {
  risultati.textContent = '';
  document.body.classList.remove('ha-risultati');
  bottoneNuova.hidden = true;
  bottoneAzzera.hidden = true;
  bottoneInCima.hidden = true;
  campo.value = '';
  ultimeAlternative = [];
  if (!daStorico) history.pushState({}, '', window.location.pathname);
  annuncia('Ricominciamo: la pagina è di nuovo bianca, puoi scrivere una nuova domanda.');
  campo.focus({ preventScroll: true });
  risultati.scrollTo({ top: 0, behavior: 'smooth' });
  // chi torna all'inizio ritrova un altro giro di domande di prova, non le stesse di prima
  if (stato.voci.length) mostraSuggerimenti(suggerimenti(stato.voci, domandeDiProva()));
}

// ---------- avvio ----------

// domande di prova: sul telefono quindici che girano in tre colonne da cinque (se ne vedono
// cinque per volta, si passa alle altre scorrendo), sullo schermo largo otto in fila
const DOMANDE_STRETTO = 15;
const DOMANDE_LARGO = 8;
const RIGHE_STRETTO = 5;
const LARGHEZZA_STRETTO = '(max-width: 40rem)';

function schermoStretto() {
  return window.matchMedia(LARGHEZZA_STRETTO).matches;
}

function domandeDiProva() {
  return schermoStretto() ? DOMANDE_STRETTO : DOMANDE_LARGO;
}

function mostraSuggerimenti(elenco) {
  contenitoreSuggerimenti.textContent = '';
  const etichetta = el('p', 'etichetta-suggerimenti', 'Prova con');
  const riga = el('div', 'riga-domande');
  for (const domanda of elenco) {
    const b = el('button', null, domanda);
    b.type = 'button';
    b.addEventListener('click', () => chiedi(domanda));
    riga.append(b);
  }
  contenitoreSuggerimenti.append(etichetta, riga);
  aggiungiPuntini(riga);
}

// su schermo stretto si vede una colonna alla volta: i puntini dicono quante colonne ci sono
// e quale si sta guardando (decorativi: si naviga scorrendo o con Tab)
function aggiungiPuntini(riga) {
  const colonne = Math.ceil(riga.children.length / RIGHE_STRETTO);
  if (colonne < 2) return;
  const puntini = el('div', 'puntini');
  puntini.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < colonne; i++) puntini.append(el('span'));
  const segna = () => {
    // le colonne sono tutte uguali: la posizione si ricava dallo spazio scorribile
    const passo = (riga.scrollWidth - riga.clientWidth) / (colonne - 1);
    const attiva = passo > 0 ? Math.round(riga.scrollLeft / passo) : 0;
    [...puntini.children].forEach((p, i) => p.classList.toggle('attivo', i === attiva));
  };
  riga.addEventListener('scroll', segna, { passive: true });
  riga.parentElement.append(puntini);
  segna();
  // cambiando la larghezza cambia anche il passo dello scorrimento
  window.addEventListener('resize', segna);
}

function dataItaliana(iso) {
  if (!iso) return '—';
  const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const [a, m, g] = iso.split('-').map(Number);
  if (!a || !m || !g) return iso;
  return `${g} ${mesi[m - 1]} ${a}`;
}

async function avvia() {
  modulo.addEventListener('submit', evento => {
    evento.preventDefault();
    chiedi(campo.value);
  });

  bottoneNuova.addEventListener('click', () => tornaAllInizio());
  bottoneAzzera.addEventListener('click', azzeraRisultati);

  // il «torna in cima» lo gestisce js/in-cima.js, uguale su tutte le pagine: qui resta solo
  // l'ombra della testata quando i risultati le scorrono sotto
  risultati.addEventListener('scroll', () => {
    testata.classList.toggle('scrollata', risultati.scrollTop > 6);
  }, { passive: true });


  // Esc = torna alla pagina bianca, come il pulsante
  campo.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && document.body.classList.contains('ha-risultati')) {
      evento.preventDefault();
      tornaAllInizio();
    }
  });

  // tasto indietro/avanti del browser: si torna alla domanda precedente o alla pagina bianca
  window.addEventListener('popstate', () => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) chiedi(q, { daStorico: true });
    else tornaAllInizio({ daStorico: true });
  });

  try {
    await caricaBase();
    indice = stato.voci.map(v => indicizza(v, stato.servizi));
    // quindici domande che girano, cinque per colonna sul telefono (vedi domandeDiProva)
    mostraSuggerimenti(suggerimenti(stato.voci, domandeDiProva()));
    const aggiornato = $('#aggiornato');
    if (aggiornato) aggiornato.textContent = dataItaliana(stato.aggiornato);
    // js/offline.js aspetta questo evento per scrivere la data nell'avviso «senza rete»
    window.dispatchEvent(new Event('caricato'));

    const q = new URLSearchParams(location.search).get('q');
    if (q) chiedi(q, { daStorico: true });
    else campo.focus();

    // gli uffici servono alla prima scheda: si scaricano mentre l'utente legge
    const scaricaUffici = () => caricaUffici()
      .then(uffici => {
        // il badge degli uffici dice quanti ce ne sono davvero, non un numero scritto a mano
        const badge = $('#badge-uffici');
        if (badge) badge.textContent = `${Object.keys(uffici).length} uffici`;
      })
      .catch(e => console.warn('uffici non disponibili', e));
    if ('requestIdleCallback' in window) requestIdleCallback(scaricaUffici, { timeout: 4000 });
    else setTimeout(scaricaUffici, 1200);
  } catch (errore) {
    console.error(errore);
    const avviso = el('p', 'avviso');
    avviso.append(
      el('strong', null, 'Non riesco a caricare i dati. '),
      document.createTextNode('Ricarica la pagina tra poco: se il problema resta, i servizi sono consultabili sul sito del Comune di Palermo.'),
    );
    risultati.append(avviso);
  }
}

avvia();
