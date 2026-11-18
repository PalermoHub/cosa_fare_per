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

// Icone dei titoli: tracciati fissi scritti qui (stesso stile delle icone del menù «Altro»)
const ICONE = {
  Idea: '<path d="M9.2 17.2h5.6M10 20.4h4"/><path d="M12 3.4a5.6 5.6 0 0 0-3.3 10.1c.5.4.5.9.5 1.5v.2h5.6V15c0-.6 0-1.1.5-1.5A5.6 5.6 0 0 0 12 3.4Z"/>',
  Sviluppo: '<path d="m8.6 8.2-4 3.8 4 3.8M15.4 8.2l4 3.8-4 3.8M13.2 6.4l-2.4 11.2"/>',
  Ringraziamenti: '<path d="M12 20.2s-7.2-4.4-7.2-9.8A4.1 4.1 0 0 1 12 7.9a4.1 4.1 0 0 1 7.2 2.5c0 5.4-7.2 9.8-7.2 9.8Z"/>',
  Fonti: '<path d="M5.8 4.6h9.4a2 2 0 0 1 2 2v12.8H7.8a2 2 0 0 1-2-2Z"/><path d="M5.8 17.4a2 2 0 0 1 2-2h9.4M9 8.6h5.2"/>',
  Licenza: '<path d="M12 3.6v16.8M7.6 20.4h8.8M5.2 7.2h13.6"/><path d="m5.2 7.2-2.4 6a3 3 0 0 0 4.8 0ZM18.8 7.2l-2.4 6a3 3 0 0 0 4.8 0Z"/>',
};

function icona(nome) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = ICONE[nome] || '';
  return svg;
}

function sezione(titolo, ...paragrafi) {
  const blocco = document.createElement('section');
  const intestazione = document.createElement('h3');
  intestazione.className = 'crediti-sottotitolo';
  const testo = document.createElement('span');
  testo.textContent = titolo;
  intestazione.append(icona(titolo), testo);
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
  titolo.textContent = 'Credits e Fonti';

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

  const fonti = sezione(
    'Fonti',
    paragrafo(
      'Schede servizio e uffici: ',
      link('Comune di Palermo', 'https://www.comune.palermo.it/amministrazione/aree-amministrative/', 'Aree amministrative del Comune di Palermo'),
      ', dal catalogo ',
      link('Cerca servizi', 'https://sites.google.com/comune.palermo.it/trova-servizi/', 'Cerca servizi del Comune di Palermo'),
      '.',
    ),
    paragrafo(
      'Atti del Comune: ',
      link('Albo Pretorio', 'https://albopretorio.comune.palermo.it/albopretorio/jsp/home.jsp?modo=info&info=servizi.jsp', 'Albo Pretorio del Comune di Palermo'),
      ' e ',
      link('Delibere e Ordinanze', 'https://servizionline.comune.palermo.it/portcitt/jsp/home.jsp?modo=info&info=servizi.jsp&SERCOD=60&SERCODROOT=60', 'Delibere e Ordinanze sui servizi online del Comune'),
      '.',
    ),
    paragrafo(
      'Mappe: © ',
      link('OpenStreetMap', 'https://www.openstreetmap.org/copyright', 'Copyright di OpenStreetMap'),
      ' contributors.',
    ),
    paragrafo('Le risposte alle domande più frequenti sono schede preparate dal progetto sulle fonti ufficiali: vanno sempre confermate con l\'ufficio competente.'),
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

  finestra.append(titolo, idea, sviluppo, ringraziamenti, fonti, licenza, azioni);
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
