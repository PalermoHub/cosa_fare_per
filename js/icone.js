// Icone a tratto per i recapiti degli uffici (sede, telefono, email, PEC, data).
// Stesso disegno delle icone delle categorie in domande.html: 24×24, tratto 1.7,
// colore del testo (`currentColor`), quindi leggibili in tema chiaro e scuro.
// Sono decorative — `aria-hidden`, `focusable="false"` — perché accanto c'è sempre
// la parola che dice di cosa si tratta («Telefono», «Email», l'indirizzo).

const SPAZIO = 'http://www.w3.org/2000/svg';

const DISEGNI = {
  sede: [
    ['path', { d: 'M12 21c4-4.4 6.5-7.9 6.5-11a6.5 6.5 0 0 0-13 0c0 3.1 2.5 6.6 6.5 11Z' }],
    ['circle', { cx: 12, cy: 10, r: 2.4 }],
  ],
  telefono: [
    ['path', {
      d: 'M6.6 3.5a2 2 0 0 0-2 2.4c1 6.4 6.1 11.5 12.5 12.5a2 2 0 0 0 2.4-2v-1.9'
        + 'a1.5 1.5 0 0 0-1.2-1.5l-2.5-.5a1.5 1.5 0 0 0-1.4.5l-.9 1a1.5 1.5 0 0 1-1.6.4'
        + ' 11 11 0 0 1-4.7-4.7 1.5 1.5 0 0 1 .4-1.6l1-.9a1.5 1.5 0 0 0 .5-1.4'
        + 'L8.1 4.7a1.5 1.5 0 0 0-1.5-1.2Z',
    }],
  ],
  email: [
    ['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2 }],
    ['path', { d: 'M3.6 6.5 12 12.5l8.4-6' }],
  ],
  // la PEC è una email con la conferma: busta stretta e, accanto, il segno di spunta
  pec: [
    ['rect', { x: 2.5, y: 6, width: 13.5, height: 12, rx: 1.8 }],
    ['path', { d: 'M3.2 7.2 9.25 12.2 15.3 7.2' }],
    ['path', { d: 'M16.4 14.3l1.9 1.9 3-3.3' }],
  ],
  calendario: [
    ['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2 }],
    ['path', { d: 'M3.5 9.5h17M8 3.5v3M16 3.5v3' }],
  ],
};

export function icona(nome, classe = 'icona-recapito') {
  const disegno = DISEGNI[nome];
  if (!disegno) return null;
  const svg = document.createElementNS(SPAZIO, 'svg');
  svg.setAttribute('class', classe);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attributi] of disegno) {
    const nodo = document.createElementNS(SPAZIO, tag);
    for (const [chiave, valore] of Object.entries(attributi)) nodo.setAttribute(chiave, valore);
    svg.append(nodo);
  }
  return svg;
}
