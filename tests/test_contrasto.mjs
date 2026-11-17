// Contrasto dei colori nei due temi, misurato secondo WCAG 2.1 (non «a occhio»).
//
// Legge le variabili da css/pinuzza.css (tema chiaro in `:root`, tema scuro in
// `[data-theme="scuro"]`), calcola il rapporto di contrasto delle coppie testo/sfondo
// che l'interfaccia usa davvero e verifica la soglia AA: 4,5:1 per il testo normale.
//
// Uso:
//   node --test tests/test_contrasto.mjs              # controlla (fa parte di npm test)
//   node tests/test_contrasto.mjs --tabella           # stampa la tabella misurata
//   node tests/test_contrasto.mjs --scrivi            # la scrive in docs/CONTRASTO.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const RADICE = new URL('../', import.meta.url);
const CSS = readFileSync(new URL('css/pinuzza.css', RADICE), 'utf8');
const SOGLIA_AA = 4.5;

// ---------- estrazione delle variabili ----------

function blocco(selettore) {
  const corrispondenza = new RegExp(`${selettore}\\s*\\{([^}]*)\\}`).exec(CSS);
  assert.ok(corrispondenza, `in css/pinuzza.css non trovo il blocco ${selettore}`);
  const variabili = {};
  // i commenti vanno tolti prima: contengono «;» e colori che romperebbero il conteggio
  const pulito = corrispondenza[1].replace(/\/\*[\s\S]*?\*\//g, '');
  for (const riga of pulito.split(';')) {
    const due = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/m.exec(riga);
    if (due) variabili[due[1]] = due[2].trim();
  }
  return variabili;
}

const CHIARO = blocco(':root');
const SCURO = { ...CHIARO, ...blocco('\\[data-theme="scuro"\\]') };

// ---------- calcolo WCAG ----------

const canale = c => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminanza(colore) {
  const esadecimale = /^#([0-9a-f]{6})$/i.exec(colore ?? '');
  assert.ok(esadecimale, `colore non riconosciuto: «${colore}» (servono 6 cifre esadecimali)`);
  const n = parseInt(esadecimale[1], 16);
  return 0.2126 * canale((n >> 16) & 255) + 0.7152 * canale((n >> 8) & 255) + 0.0722 * canale(n & 255);
}

function contrasto(primo, secondo) {
  const [a, b] = [luminanza(primo), luminanza(secondo)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// ---------- le coppie che l'interfaccia usa davvero ----------

const COPPIE = [
  ['testo su carta', 'inchiostro', 'carta'],
  ['testo su carta-alt (nota, piede)', 'inchiostro', 'carta-alt'],
  ['testo su superficie (schede, campi)', 'inchiostro', 'superficie'],
  ['testo tenue su carta-alt', 'inchiostro-tenue', 'carta-alt'],
  ['testo tenue su superficie', 'inchiostro-tenue', 'superficie'],
  ['etichette su carta', 'inchiostro-fio', 'carta'],
  ['etichette su carta-alt', 'inchiostro-fio', 'carta-alt'],
  ['etichette su superficie', 'inchiostro-fio', 'superficie'],
  ['link su carta', 'accento', 'carta'],
  ['link su superficie', 'accento', 'superficie'],
  ['badge su accento-chiaro', 'accento', 'accento-chiaro'],
  ['pulsante principale', 'su-accento', 'accento-fondo'],
  ['pulsante principale (hover)', 'su-accento', 'accento-fondo-hover'],
  ['badge caldo', 'su-caldo', 'caldo-fondo'],
  ['avviso', 'avviso-tenue', 'caldo-chiaro'],
  ['avviso in grassetto', 'avviso-testo', 'caldo-chiaro'],
  ['link in hover su superficie', 'caldo', 'superficie'],
  ['«salta al contenuto»', 'carta', 'inchiostro'],
];

function misura(tema) {
  return COPPIE.map(([nome, primo, secondo]) => {
    const colorePrimo = tema[`--${primo}`];
    const coloreSecondo = tema[`--${secondo}`];
    return { nome, primo, secondo, colorePrimo, coloreSecondo, rapporto: contrasto(colorePrimo, coloreSecondo) };
  });
}

const CHIARO_MISURATO = misura(CHIARO);
const SCURO_MISURATO = misura(SCURO);

// ---------- test ----------

test('nel tema chiaro ogni testo supera 4,5:1', () => {
  for (const riga of CHIARO_MISURATO) {
    assert.ok(riga.rapporto >= SOGLIA_AA, `${riga.nome}: ${riga.rapporto.toFixed(2)}:1 (serve ${SOGLIA_AA})`);
  }
});

test('nel tema scuro ogni testo supera 4,5:1', () => {
  for (const riga of SCURO_MISURATO) {
    assert.ok(riga.rapporto >= SOGLIA_AA, `${riga.nome}: ${riga.rapporto.toFixed(2)}:1 (serve ${SOGLIA_AA})`);
  }
});

test('il tema scuro ridefinisce tutti i colori del tema chiaro', () => {
  const scuro = blocco('\\[data-theme="scuro"\\]');
  const soloChiaro = Object.entries(CHIARO)
    .filter(([, valore]) => /^#[0-9a-f]{6}$/i.test(valore)) // solo i colori, non misure e font
    .filter(([nome]) => !(nome in scuro))
    .map(([nome]) => nome);
  assert.deepEqual(soloChiaro, [], `colori non ridefiniti nel tema scuro: ${soloChiaro.join(', ')}`);
});

test('nessun colore è scritto a mano fuori dalle variabili', () => {
  const senzaVariabili = CSS.replace(/:root\s*\{[^}]*\}/s, '')
    .replace(/\[data-theme="scuro"\]\s*\{[^}]*\}/s, '')
    .split('\n')
    .filter(riga => /#(fff|ffffff|[0-9a-f]{6})\b/i.test(riga))
    .map(riga => riga.trim())
    .filter(riga => !riga.startsWith('/*') && !riga.includes('fill:')); // l'occhio del logo resta bianco
  assert.deepEqual(senzaVariabili, [], `colori scritti a mano: ${senzaVariabili.join(' | ')}`);
});

// ---------- tabella per i documenti ----------

const tabella = (titolo, righe) => [
  `### ${titolo}`, '',
  '| Testo | Colore | Sfondo | Rapporto | AA |',
  '|---|---|---|---|---|',
  ...righe.map(r => `| ${r.nome} | \`${r.colorePrimo}\` | \`${r.coloreSecondo}\` | ${r.rapporto.toFixed(2)}:1 | ${r.rapporto >= SOGLIA_AA ? 'sì' : 'NO'} |`),
  '',
];

const REPORT = [
  '# Contrasto dei colori (misurato)',
  '',
  `Soglia WCAG 2.1 AA per il testo normale: ${SOGLIA_AA}:1. Calcolato da \`css/pinuzza.css\` con`,
  '`tests/test_contrasto.mjs`; fa parte di `npm test`, così una modifica di colore che abbassa',
  'il contrasto fa fallire i test invece di passare inosservata.',
  '',
  ...tabella('Tema chiaro', CHIARO_MISURATO),
  ...tabella('Tema scuro', SCURO_MISURATO),
].join('\n');

if (process.argv.includes('--tabella')) console.log(REPORT);
if (process.argv.includes('--scrivi')) {
  writeFileSync(new URL('docs/CONTRASTO.md', RADICE), REPORT + '\n', 'utf8');
  console.log('Scritto docs/CONTRASTO.md');
}
