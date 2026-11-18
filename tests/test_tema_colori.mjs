// Il tema personalizzato non deve poter rendere illeggibile l'app: qualunque colore scelga
// l'utente, ogni coppia testo/sfondo resta ≥ 4,5:1. Si prova con ventimila scelte casuali,
// più i casi limite (grigio medio, tutto uguale, bianco e nero puri).
//
// Uso: node --test tests/test_tema_colori.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivaTema, normalizzaSfondo, COPPIE, contrasto, peggiorContrasto, valido } from '../js/tema-colori.js';

// generatore pseudo-casuale con seme fisso: se fallisce, fallisce sempre allo stesso modo
let seme = 20261118;
const caso = () => { seme = (seme * 1664525 + 1013904223) % 4294967296; return seme / 4294967296; };
const colore = () => '#' + Math.floor(caso() * 0xffffff).toString(16).padStart(6, '0');

function misura(scelte) {
  const { vars } = derivaTema(scelte);
  for (const [a, b] of COPPIE) {
    const rapporto = contrasto(vars[`--${a}`], vars[`--${b}`]);
    assert.ok(rapporto >= 4.5, `${a} su ${b}: ${rapporto.toFixed(2)}:1 con ${JSON.stringify(scelte)}`);
  }
  return vars;
}

test('ventimila scelte casuali: ogni coppia testo/sfondo supera 4,5:1', () => {
  for (let i = 0; i < 20000; i++) misura({ sfondo: colore(), testo: colore(), accento: colore(), caldo: colore() });
});

test('casi limite: grigi medi, colori tutti uguali, bianco e nero puri', () => {
  const casi = ['#808080', '#777777', '#999999', '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00'];
  for (const s of casi) for (const t of casi) misura({ sfondo: s, testo: t, accento: t, caldo: s });
});

test('il testo ha almeno 4,5:1 sullo sfondo anche se si sceglie lo stesso colore due volte', () => {
  const vars = misura({ sfondo: '#336699', testo: '#336699', accento: '#336699', caldo: '#336699' });
  assert.ok(contrasto(vars['--inchiostro'], vars['--carta']) >= 4.5);
});

test('lo sfondo di luminosità media viene spostato e la correzione è segnalata', () => {
  const { corretto, colore: nuovo } = normalizzaSfondo('#808080');
  assert.ok(corretto, 'un grigio medio va corretto');
  assert.notEqual(nuovo, '#808080');
  assert.equal(normalizzaSfondo('#ffffff').corretto, false);
  assert.equal(normalizzaSfondo('#000000').corretto, false);
  const { corretti } = derivaTema({ sfondo: '#808080', testo: '#ffffff', accento: '#ff00ff', caldo: '#00ffff' });
  assert.ok(corretti.includes('sfondo'), 'manca la segnalazione dello sfondo ritoccato');
});

test('una scelta fatta bene viene rispettata, senza ritocchi', () => {
  const { vars, corretti } = derivaTema({ sfondo: '#fcfbf7', testo: '#17150f', accento: '#0e5a54', caldo: '#a4461b' });
  assert.deepEqual(corretti, [], `ritocchi inattesi: ${corretti.join(', ')}`);
  assert.equal(vars['--carta'], '#fcfbf7');
  assert.equal(vars['--accento'], '#0e5a54');
  assert.equal(vars['--schema'], 'light');
  assert.equal(derivaTema({ sfondo: '#101010', testo: '#f0f0f0', accento: '#7fd8cb', caldo: '#f0a37a' }).vars['--schema'], 'dark');
});

test('colori non validi vengono rifiutati, non applicati', () => {
  assert.throws(() => derivaTema({ sfondo: 'rosso', testo: '#000', accento: '#fff', caldo: '#123456' }));
  assert.equal(valido('#12345g'), false);
  assert.equal(valido('#123456'), true);
  assert.ok(peggiorContrasto(derivaTema({ sfondo: '#ffffff', testo: '#000000', accento: '#0000aa', caldo: '#aa0000' }).vars) >= 4.5);
});

test('ogni variabile prodotta esiste nel CSS (nessun nome inventato)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../css/pinuzza.css', import.meta.url), 'utf8');
  const radice = /:root\s*\{([^}]*)\}/.exec(css)[1];
  const { vars } = derivaTema({ sfondo: '#ffffff', testo: '#000000', accento: '#0000aa', caldo: '#aa0000' });
  for (const nome of Object.keys(vars)) {
    if (nome === '--schema') continue; // solo per il tema personalizzato
    assert.ok(radice.includes(`${nome}:`), `${nome} non esiste in :root`);
  }
});
