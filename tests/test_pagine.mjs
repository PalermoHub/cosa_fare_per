// Controlli sulle pagine generate da scripts/genera_pagine.py (P1.3):
// domande.html, sitemap.xml, robots.txt e il blocco JSON-LD dentro index.html.
//
// Cosa non deve rompersi: nessun link a domande che non esistono, nessuna URL nella
// sitemap che non sia servita, JSON-LD valido con sole voci che hanno una risposta
// nostra, e le pagine nuove dentro la cache offline.
//
// Uso: node --test tests/test_pagine.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const radice = new URL('../', import.meta.url);
const leggi = percorso => readFileSync(new URL(percorso, radice), 'utf8');
const argomenti = JSON.parse(leggi('data/argomenti.json'));

const domandeHtml = leggi('domande.html');
const sitemap = leggi('sitemap.xml');
const robots = leggi('robots.txt');
const index = leggi('index.html');
const sw = leggi('sw.js');

const domande = argomenti.voci.flatMap(v => v.domande || []);

test('domande.html elenca tutte le domande tipiche, una per una', () => {
  const collegamenti = (domandeHtml.match(/href="index\.html\?q=/g) || []).length;
  assert.equal(collegamenti, domande.length, `${collegamenti} link contro ${domande.length} domande`);
  for (const categoria of new Set(argomenti.voci.map(v => v.categoria))) {
    assert.ok(domandeHtml.includes(`>${categoria}<`), `manca la categoria «${categoria}»`);
  }
  assert.match(domandeHtml, /<h1 class="titolo-pagina">Tutte le domande<\/h1>/);
});

test('ogni link di domande.html porta a una domanda vera', () => {
  const testo = decodeURIComponent(domandeHtml);
  const mancanti = domande.filter(d => !testo.includes(`index.html?q=${d}"`));
  assert.deepEqual(mancanti.slice(0, 5), [], `${mancanti.length} domande senza link`);
});

test('la sitemap contiene solo pagine che esistono', () => {
  const url = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(url.length >= 4, `solo ${url.length} URL nella sitemap`);
  for (const indirizzo of url) {
    const percorso = indirizzo.split('/cosa_fare_per/')[1] || '';
    assert.ok(existsSync(new URL(percorso || 'index.html', radice)), `nella sitemap c'è un file che non esiste: ${percorso}`);
  }
  assert.ok(url.some(u => u.endsWith('/domande.html')), 'manca domande.html nella sitemap');
  assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, 'manca lastmod');
});

test('robots.txt lascia indicizzare tutto e punta alla sitemap', () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/[^ ]+\/sitemap\.xml$/m);
});

test('il JSON-LD è valido e dichiara solo risposte nostre', () => {
  const blocco = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(index);
  assert.ok(blocco, 'manca il blocco JSON-LD in index.html');
  const dati = JSON.parse(blocco[1]);
  assert.equal(dati['@type'], 'FAQPage');
  assert.equal(dati.inLanguage, 'it');
  assert.ok(Array.isArray(dati.mainEntity) && dati.mainEntity.length >= 10, 'poche FAQ dichiarate');
  assert.ok(dati.mainEntity.length <= 20, 'troppe FAQ: il piano dice massimo 20');

  const perId = Object.fromEntries(argomenti.voci.map(v => [v.id, v]));
  for (const voce of dati.mainEntity) {
    assert.equal(voce['@type'], 'Question');
    assert.ok(voce.name.trim().length > 10, `domanda troppo corta: ${voce.name}`);
    assert.ok(voce.name.endsWith('?'), `la domanda non è una domanda: ${voce.name}`);
    assert.equal(voce.acceptedAnswer['@type'], 'Answer');
    assert.ok(voce.acceptedAnswer.text.length > 60, `risposta troppo corta per «${voce.name}»`);
    // le risposte nostre sono dichiarate come preparate, i rimandi non entrano proprio
    assert.match(voce.acceptedAnswer.text, /non ancora verificata/, `manca l'avviso in «${voce.name}»`);
  }
  // nessuna FAQ deve nascere da un rimando alla scheda ufficiale
  const senzaRisposta = argomenti.voci.filter(v => !v.risposta?.sintesi).map(v => v.titolo);
  for (const voce of dati.mainEntity) {
    assert.ok(!senzaRisposta.includes(voce.name), `dichiarata FAQ una cosa che è un rimando: ${voce.name}`);
  }
  void perId;
});

test('la pagina delle domande è disponibile anche senza rete', () => {
  const elenco = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  assert.ok(elenco.includes("'domande.html'"), 'domande.html non è nella precache del service worker');
});

test('le pagine linkano «Tutte le domande»', () => {
  for (const pagina of ['index.html', 'uffici.html', 'privacy.html', 'domande.html']) {
    assert.match(leggi(pagina), /href="domande\.html"/, `${pagina}: manca il link a domande.html`);
  }
});
