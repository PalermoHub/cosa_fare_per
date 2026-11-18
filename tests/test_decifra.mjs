// Controlli su «Decifra la PA»: il modello di istruzioni per farsi spiegare un avviso
// pubblico da un assistente AI, la scheda in home e i crediti.
//
// Cosa non deve rompersi: le istruzioni contengono la fonte scelta (link o testo), le
// regole del modello originale e la richiesta di non inventare; il modulo non chiama
// nessuna AI e nessun servizio esterno; la scheda è in home e nella cache offline.
//
// Uso: node --test tests/test_decifra.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { istruzioni, normalizzaLink, linkValido, indirizzoChat, servizioPerNome, SERVIZI_AI } from '../js/decifra.js';

const radice = new URL('../', import.meta.url);
const leggi = percorso => readFileSync(new URL(percorso, radice), 'utf8');

const modulo = leggi('js/decifra.js');
const index = leggi('index.html');
const sw = leggi('sw.js');

const LINK = 'https://www.comune.palermo.it/avviso/123';

test('le istruzioni partono dal link e chiedono un testo chiaro in italiano', () => {
  const testo = istruzioni(LINK, '');
  assert.match(testo, /Leggi l'articolo a questo URL:\nhttps:\/\/www\.comune\.palermo\.it\/avviso\/123/);
  assert.match(testo, /Linguaggio semplice/);
  assert.match(testo, /In pratica questo significa:/);
  assert.match(testo, /Non aggiungere informazioni non presenti nella fonte/);
  assert.match(testo, /Scrivi tutto in italiano\./);
});

test('senza link si può incollare il testo dell\'avviso, e i due si possono combinare', () => {
  const testo = istruzioni('', '  Bando per il contributo affitto  ');
  assert.match(testo, /Leggi questo testo:\n\nBando per il contributo affitto$/m);
  assert.doesNotMatch(testo, /questo URL/);

  const entrambi = istruzioni(LINK, 'Bando per il contributo affitto');
  assert.match(entrambi, /Se il link non si apre, ecco il testo dell'articolo:/);
  assert.match(entrambi, /Bando per il contributo affitto/);
});

test('un indirizzo scritto senza schema viene accettato, ma solo http e https', () => {
  assert.equal(normalizzaLink('www.comune.palermo.it/avviso'), 'https://www.comune.palermo.it/avviso');
  assert.equal(normalizzaLink('  https://example.org/x  '), 'https://example.org/x');
  assert.equal(normalizzaLink(''), '');
  assert.ok(linkValido('https://example.org'));
  assert.ok(linkValido('http://example.org'));
  assert.equal(linkValido('javascript:alert(1)'), false);
  assert.equal(linkValido('non un link'), false);
  assert.equal(linkValido(''), false);
});

test('si può scegliere fra le chat web più usate; il testo viaggia dove è supportato', () => {
  const testo = istruzioni(LINK, '');
  assert.deepEqual(
    SERVIZI_AI.map(s => s.nome),
    ['Claude', 'DeepSeek', 'Qwen', 'Z.ai', 'Kimi', 'ChatGPT', 'Gemini', 'Copilot', 'Perplexity', 'Grok'],
  );

  // dove il servizio accetta le istruzioni nell'indirizzo, ci arrivano già pronte
  for (const nome of ['ChatGPT', 'Claude', 'Perplexity']) {
    const indirizzo = indirizzoChat(servizioPerNome(nome), testo);
    assert.match(indirizzo, /\?q=/, `${nome}: manca il testo nell'indirizzo`);
    assert.equal(decodeURIComponent(indirizzo.split('?q=')[1]), testo);
  }

  // negli altri casi si apre la chat e le istruzioni restano negli appunti, da incollare
  for (const [nome, indirizzo] of [
    ['Gemini', 'https://gemini.google.com/app'],
    ['Copilot', 'https://copilot.microsoft.com/'],
    ['DeepSeek', 'https://chat.deepseek.com/'],
    ['Grok', 'https://grok.com/'],
  ]) {
    assert.equal(indirizzoChat(servizioPerNome(nome), testo), indirizzo);
  }

  assert.equal(servizioPerNome('non esiste').nome, 'Claude');
});

test('il modulo non chiama nessuna AI né servizi esterni: compone solo il testo', () => {
  assert.doesNotMatch(modulo, /\bfetch\s*\(/);
  assert.doesNotMatch(modulo, /XMLHttpRequest/);
  assert.doesNotMatch(modulo, /openai|anthropic|generativelanguage/i);
});

test('la home invita a «Decifra la PA» e il modulo sta nella cache offline', () => {
  assert.match(index, /<section class="decifra-invito"/);
  assert.match(index, /data-decifra/);
  assert.match(index, /src="js\/decifra\.js"/);
  assert.match(sw, /'js\/decifra\.js'/);
});

test('i crediti citano l\'app, il repository e l\'autore', () => {
  const crediti = leggi('js/crediti.js');
  assert.match(crediti, /https:\/\/aborruso\.github\.io\/in_due_tocchi\//);
  assert.match(crediti, /https:\/\/github\.com\/aborruso\/in_due_tocchi/);
  assert.match(crediti, /Andrea Borruso/);
});
