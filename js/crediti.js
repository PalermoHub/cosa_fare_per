// «Credits»: chi ha ideato e chi ha sviluppato Chiedilo a Pinuzza.
// Il riquadro si costruisce da qui (come l'avviso sui cookie) così il piede di ogni pagina
// ha solo il collegamento «Credits» e il testo dei crediti sta in un posto solo.

let riquadro = null;
let ultimoFuoco = null;

function link(testo, href, titolo) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = testo;
  if (titolo) a.title = titolo;
  return a;
}

function paragrafo(...contenuto) {
  const p = document.createElement('p');
  p.className = 'crediti-testo';
  p.append(...contenuto);
  return p;
}

function sezione(titolo, ...paragrafi) {
  const blocco = document.createElement('section');
  const intestazione = document.createElement('h3');
  intestazione.className = 'crediti-sottotitolo';
  intestazione.textContent = titolo;
  blocco.append(intestazione, ...paragrafi);
  return blocco;
}

function costruisci() {
  const finestra = document.createElement('dialog');
  finestra.className = 'crediti';
  finestra.id = 'crediti';
  finestra.setAttribute('aria-labelledby', 'crediti-titolo');

  const titolo = document.createElement('h2');
  titolo.className = 'crediti-titolo';
  titolo.id = 'crediti-titolo';
  titolo.textContent = 'Credits';

  const idea = sezione(
    'Idea',
    paragrafo(
      'Idea di ',
      link('Ciro Spataro', 'https://www.linkedin.com/in/cirospataro/', 'Ciro Spataro su LinkedIn'),
      ' e ',
      link('Giovan Battista Vitrano', 'https://www.linkedin.com/in/gbvitrano', 'Giovan Battista Vitrano su LinkedIn'),
      '.',
    ),
  );

  const sviluppo = sezione(
    'Sviluppo',
    paragrafo(
      'Web app progettata e sviluppata da ',
      link('@gbvitrano', 'https://www.linkedin.com/in/gbvitrano', 'Giovan Battista Vitrano su LinkedIn'),
      ' in collaborazione con ',
      link('Claude AI (Anthropic)', 'https://www.anthropic.com/claude', 'Claude, l\'assistente AI di Anthropic'),
      ' e ',
      link('DeepSeek', 'https://chat.deepseek.com/', 'DeepSeek, chat online'),
      ', che hanno affiancato le scelte architetturali, l\'ottimizzazione del codice e lo sviluppo delle funzionalità di visualizzazione geospaziale.',
    ),
  );

  const ringraziamenti = sezione(
    'Ringraziamenti',
    paragrafo(
      'La funzione «Decifra la PA» arriva dall\'app ',
      link('in due tocchi', 'https://aborruso.github.io/in_due_tocchi/', 'in due tocchi, l\'app di Andrea Borruso'),
      ' di ',
      link('Andrea Borruso', 'https://github.com/aborruso', 'aborruso su GitHub'),
      ' (codice su ',
      link('GitHub', 'https://github.com/aborruso/in_due_tocchi', 'Repository in_due_tocchi'),
      ', licenza MIT): le istruzioni sono adattate dal suo modello «Decifra la PA».',
    ),
  );

  const licenza = sezione(
    'Licenza',
    paragrafo(
      'Il codice di Chiedilo a Pinuzza è rilasciato con ',
      link('licenza MIT', 'https://github.com/PalermoHub/cosa_fare_per/blob/main/LICENSE', 'Testo della licenza MIT'),
      '.',
    ),
  );

  const chiudi = document.createElement('button');
  chiudi.type = 'button';
  chiudi.className = 'crediti-chiudi';
  chiudi.textContent = 'Chiudi';

  const azioni = document.createElement('div');
  azioni.className = 'crediti-azioni';
  azioni.append(chiudi);

  finestra.append(titolo, idea, sviluppo, ringraziamenti, licenza, azioni);
  document.body.append(finestra);

  const nascondi = () => {
    if (finestra.open) finestra.close();
    else finestra.removeAttribute('open');
    document.body.classList.remove('crediti-aperti');
    if (ultimoFuoco && typeof ultimoFuoco.focus === 'function') ultimoFuoco.focus();
  };

  chiudi.addEventListener('click', nascondi);

  // i browser senza <dialog> modale restano comunque serviti: il riquadro si apre come
  // pannello sopra la pagina, chiuso dal pulsante o dal tasto Esc
  finestra.addEventListener('cancel', evento => {
    evento.preventDefault();
    nascondi();
  });

  return finestra;
}

export function apriCrediti() {
  if (!riquadro) riquadro = costruisci();
  ultimoFuoco = document.activeElement;
  if (typeof riquadro.showModal === 'function') {
    riquadro.showModal();
  } else {
    riquadro.setAttribute('open', '');
    document.body.classList.add('crediti-aperti');
  }
  const chiudi = riquadro.querySelector('.crediti-chiudi');
  if (chiudi) chiudi.focus();
}

export function avviaCrediti() {
  // il collegamento «Credits» nel piede apre il riquadro
  for (const bottone of document.querySelectorAll('[data-crediti]')) {
    bottone.addEventListener('click', evento => {
      evento.preventDefault();
      // dal menù «Altro» del telefono: prima si chiude il pannello, poi si apre il riquadro
      const menu = bottone.closest('dialog.altre');
      if (menu && menu.open) menu.querySelector('[data-altre-chiudi]').click();
      apriCrediti();
    });
  }
}

// la pagina carica questo file come modulo: i collegamenti sono già nel documento
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avviaCrediti);
else avviaCrediti();
