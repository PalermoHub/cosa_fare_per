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

test('i recapiti degli uffici portano la loro icona, senza rete', () => {
  const icone = leggi('js/icone.js');
  for (const nome of ['sede', 'telefono', 'email', 'pec', 'calendario']) {
    assert.match(icone, new RegExp(`\\b${nome}: \\[`), `manca il disegno «${nome}» in js/icone.js`);
  }
  // decorative (il testo accanto dice già di che recapito si tratta) e col colore del testo
  assert.match(icone, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(icone, /setAttribute\('stroke', 'currentColor'\)/);
  for (const modulo of ['js/app.js', 'js/uffici.js']) {
    assert.match(leggi(modulo), /import \{ icona \} from '\.\/icone\.js'/, `${modulo}: non usa le icone dei recapiti`);
  }
  // senza rete l'icona non c'è: il file deve stare nella precache del service worker
  assert.match(sw, /'js\/icone\.js'/, 'js/icone.js non è nella precache');
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
  for (const pagina of ['index.html', 'uffici.html', 'privacy.html', 'domande.html', 'guida.html']) {
    assert.match(leggi(pagina), /href="domande\.html"/, `${pagina}: manca il link a domande.html`);
  }
});

test('il «torna in cima» c’è in ogni pagina e il modulo è nel guscio offline', () => {
  // regola del progetto: le pagine lunghe (uffici, domande, informativa) devono poter
  // tornare in cima con lo stesso comando della home, non solo con la rotella
  for (const pagina of ['index.html', 'uffici.html', 'domande.html', 'privacy.html', 'salvati.html', 'guida.html']) {
    const html = leggi(pagina);
    assert.match(html, /id="inCima"/, `${pagina}: manca il pulsante «torna in cima»`);
    assert.match(html, /<script type="module" src="js\/in-cima\.js"><\/script>/, `${pagina}: manca js/in-cima.js`);
  }
  assert.match(sw, /'js\/in-cima\.js',/, 'sw.js non mette in cache js/in-cima.js: offline il pulsante non funziona');
});

test('la guida mostra schermate che esistono e hanno un testo alternativo', () => {
  const guida = leggi('guida.html');
  const immagini = [...guida.matchAll(/<img src="(img\/guida\/[^"]+)"[^>]*>/g)];
  assert.ok(immagini.length >= 8, `solo ${immagini.length} schermate nella guida`);
  for (const [tag, percorso] of immagini) {
    assert.ok(existsSync(new URL(percorso, radice)), `schermata mancante: ${percorso}`);
    assert.match(tag, /alt="[^"]{20,}"/, `la schermata ${percorso} non ha un testo alternativo utile`);
    assert.match(tag, /width="\d+" height="\d+"/, `la schermata ${percorso} non dichiara le misure: salterebbe il layout`);
  }
  // la guida sta nella sitemap e nella cache offline, altrimenti non arriva a nessuno
  assert.ok(sitemap.includes('guida.html'), 'guida.html non è nella sitemap');
  assert.ok(sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].includes("'guida.html'"), 'guida.html non è nella precache');
});

test('il menù del telefono ha quattro posti e tutto il resto nel pannello «Altro»', () => {
  // La barra in basso non può crescere all'infinito: ogni voce nuova che non sia una
  // destinazione principale va nel pannello, che resta lo stesso in tutte le pagine.
  const PAGINE = ['index.html', 'uffici.html', 'domande.html', 'privacy.html', 'salvati.html', 'guida.html'];
  // la guida non sta nel pannello: si raggiunge dalla pillola in home e dal piede («Come funziona»)
  const destinazioni = ['salvati.html', 'privacy.html', 'https://github.com/PalermoHub/cosa_fare_per/issues'];
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    const barra = /<nav class="barra-basso"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    assert.ok(barra, `${pagina}: manca la barra in basso`);
    const voci = [...barra[1].matchAll(/class="voce[^"]*"/g)];
    assert.equal(voci.length, 4, `${pagina}: la barra deve avere quattro posti, non ${voci.length}`);
    for (const href of ['index.html', 'domande.html', 'uffici.html']) {
      assert.ok(barra[1].includes(`href="${href}"`), `${pagina}: manca «${href}» nella barra`);
    }
    assert.match(barra[1], /data-altre aria-expanded="false" aria-controls="altre-voci"/, `${pagina}: manca il pulsante del pannello`);

    const pannello = /<dialog class="altre" id="altre-voci"[\s\S]*?<\/dialog>/.exec(html);
    assert.ok(pannello, `${pagina}: manca il pannello «Altro»`);
    for (const destinazione of destinazioni) {
      assert.ok(pannello[0].includes(destinazione), `${pagina}: «${destinazione}» non sta nel pannello`);
    }
    assert.ok(!pannello[0].includes('guida.html'), `${pagina}: la guida non deve stare nel pannello «Altro»`);
    // il pannello è una finestra di dialogo: titolo, chiusura e comando che la apre
    assert.match(pannello[0], /aria-labelledby="altre-titolo"/, `${pagina}: il pannello non è etichettato`);
    assert.match(pannello[0], /data-altre-chiudi/, `${pagina}: il pannello non si chiude`);
    assert.match(html, /<script type="module" src="js\/menu\.js"><\/script>/, `${pagina}: manca js/menu.js`);
    assert.match(sw, /'js\/menu\.js',/, 'sw.js non mette in cache js/menu.js: offline il pannello non si apre');
  }
});

test('nessun id ripetuto dentro una pagina', () => {
  // un id doppio non si vede a occhio ma rompe `getElementById`: il pannello «Altro» non si
  // apriva in guida.html perché la sezione «Tutte le domande» usava già id="altre".
  for (const pagina of ['index.html', 'uffici.html', 'domande.html', 'privacy.html', 'salvati.html', 'guida.html']) {
    const html = leggi(pagina);
    const visti = new Set();
    for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) {
      assert.ok(!visti.has(id), `${pagina}: id="${id}" compare più di una volta`);
      visti.add(id);
    }
  }
});

test('schermo intero su telefono: manifest, modulo in ogni pagina e nel guscio offline', () => {
  const manifest = JSON.parse(leggi('manifest.webmanifest'));
  assert.deepEqual(manifest.display_override, ['fullscreen', 'standalone'], 'manifest: manca il display_override a schermo intero');
  for (const pagina of ['index.html', 'uffici.html', 'domande.html', 'privacy.html', 'salvati.html', 'guida.html', 'atti.html']) {
    assert.match(leggi(pagina), /<script type="module" src="js\/schermo-intero\.js"><\/script>/, `${pagina}: manca js/schermo-intero.js`);
  }
  assert.match(sw, /'js\/schermo-intero\.js',/, 'sw.js non mette in cache js/schermo-intero.js');
  for (const pagina of ['index.html', 'uffici.html', 'domande.html', 'privacy.html', 'salvati.html', 'guida.html', 'atti.html']) {
    assert.match(leggi(pagina), /<script type="module" src="js\/installa\.js"><\/script>/, `${pagina}: manca js/installa.js`);
  }
  assert.match(sw, /'js\/installa\.js',/, 'sw.js non mette in cache js/installa.js');
});
