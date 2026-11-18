// Controlli sulla pagina «Atti» (la ricerca dal vivo nell'Albo Pretorio e in Delibere e
// Ordinanze del Comune) e sul Worker che la serve.
//
// Cosa non deve rompersi: la pagina esiste con il suo modulo di ricerca, il Worker è
// dichiarato in un solo posto e raggiungibile via https, i due portali ufficiali sono
// linkati dove servono, la pagina e il modulo stanno nella cache offline, e il Worker
// non conserva niente (niente KV, niente D1, niente R2: solo la Cache API per non
// ripetere la stessa ricerca).
//
// Uso: node --test tests/test_atti.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const radice = new URL('../', import.meta.url);
const leggi = percorso => readFileSync(new URL(percorso, radice), 'utf8');

const atti = leggi('atti.html');
const script = leggi('js/atti.js');
const worker = leggi('worker/src/index.js');
const sw = leggi('sw.js');
const sitemap = leggi('sitemap.xml');
const privacy = leggi('privacy.html');

test('la pagina degli atti ha il modulo di ricerca e i suoi campi', () => {
  assert.match(atti, /<form class="atti-form" id="atti-form" role="search">/);
  for (const campo of ['atti-q', 'atti-tipo', 'atti-anno']) {
    assert.match(atti, new RegExp(`id="${campo}"`), `manca il campo ${campo}`);
  }
  assert.match(atti, /<button type="submit" class="atti-cerca-bottone">Cerca<\/button>/);

  // i tipi che si possono scegliere devono essere gli stessi che conosce il Worker
  const scelte = [...atti.matchAll(/<option value="([a-z]+)">/g)].map(m => m[1]);
  assert.deepEqual(scelte, ['tutti', 'delibere', 'determinazioni', 'ordinanze', 'bandi', 'gare', 'convocazioni', 'matrimoni']);
  for (const gruppo of scelte) {
    assert.match(worker, new RegExp(`\\b${gruppo}: \\{`), `il Worker non conosce il gruppo «${gruppo}»`);
  }
});

test('la pagina dice da dove vengono gli atti e linka i due portali ufficiali', () => {
  assert.match(atti, /albopretorio\.comune\.palermo\.it\/albopretorio\/jsp\/home\.jsp/);
  assert.match(atti, /servizionline\.comune\.palermo\.it\/portcitt\/jsp\/home\.jsp\?modo=info&amp;info=servizi\.jsp&amp;SERCOD=60/);
  assert.match(atti, /Albo Pretorio/);
  assert.match(atti, /Delibere e Ordinanze/);
  // la distinzione fra i due servizi è spiegata, non solo nominata
  assert.match(atti, /alla scadenza della pubblicazione l'atto esce dall'elenco/);
  assert.match(atti, /la ricerca non conserva nulla/i);
  // lo slogan: ironico, e dice chi cerca
  assert.match(atti, /Cerchi una delibera e non la trovi\? Non è colpa tua\./);
  assert.match(atti, /Chiedi a Pinuzza, la cerca lei/);
});

test('il Worker si chiama in un solo posto e solo via https', () => {
  const elenco = script.match(/const ENDPOINT = \[([\s\S]*?)\];/);
  assert.ok(elenco, 'manca l’elenco degli indirizzi del Worker in js/atti.js');
  const indirizzi = [...elenco[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(indirizzi.length >= 1, 'nessun indirizzo del Worker');
  for (const indirizzo of indirizzi) {
    assert.match(indirizzo, /^https:\/\/[a-z0-9.-]+\.workers\.dev$/, `indirizzo sospetto: ${indirizzo}`);
  }
  // la pagina non fa richieste al Comune: quelle le fa il Worker
  assert.doesNotMatch(script, /fetch\(['"`]https:\/\/(albopretorio|servizionline)/);
  assert.match(script, /\/cerca\?/, 'js/atti.js non chiama /cerca');
});

test('la ricerca parte senza parole (gli atti più recenti) e regge il guasto', () => {
  assert.match(script, /recenti/, 'manca la modalità «atti più recenti»');
  assert.match(script, /La ricerca non è disponibile in questo momento/);
  assert.match(atti, /Non c'è quello che cerchi\?/);
});

test('il Worker non conserva dati: niente binding, solo la Cache API', () => {
  assert.doesNotMatch(worker, /\benv\.(KV|DB|R2|D1)\b/, 'il Worker usa un binding di archiviazione');
  assert.doesNotMatch(worker, /\.put\([^)]*\)\s*;?\s*\/\/\s*salva/i);
  assert.match(worker, /caches\.default/, 'manca la cache delle ricerche');
  assert.match(worker, /BUDGET_SUBREQUEST/, 'manca il bilancio delle subrequest (piano gratuito)');
  assert.match(worker, /ALBCOD/, 'il Worker non legge il link permanente dell’atto');
});

test('il Worker si tiene nei limiti del piano gratuito', () => {
  // 50 subrequest per invocazione, 10 ms di CPU: il bilancio deve stare sotto i 50
  const bilancio = Number((worker.match(/const BUDGET_SUBREQUEST = (\d+)/) || [])[1]);
  assert.ok(bilancio > 0 && bilancio <= 46, `bilancio fuori misura: ${bilancio}`);
  // ogni passo dei portali costa due subrequest (302 + pagina): il conto deve saperlo
  assert.match(worker, /redirect: 'manual'/);
  assert.match(worker, /spendi\(contesto\)/);
  // le richieste partono con un user agent riconoscibile
  assert.match(worker, /Chiedilo-a-Pinuzza/);
});

test('pagina e modulo sono nella cache offline e nella sitemap', () => {
  assert.match(sw, /'atti\.html'/, 'atti.html non è nella precache');
  assert.match(sw, /'js\/atti\.js'/, 'js/atti.js non è nella precache');
  assert.match(sitemap, /cosa_fare_per\/atti\.html/);
});

test('l’informativa privacy nomina il servizio che esegue la ricerca', () => {
  assert.match(privacy, /Cloudflare Workers/);
  assert.match(privacy, /parole cercate negli atti/i);
});

test('il Worker è versionato nel repository insieme alla pagina', () => {
  assert.ok(existsSync(new URL('worker/wrangler.toml', radice)), 'manca worker/wrangler.toml');
  assert.ok(existsSync(new URL('worker/README.md', radice)), 'manca worker/README.md');
  const toml = leggi('worker/wrangler.toml');
  assert.match(toml, /name = "pinuzza-atti"/);
  assert.match(toml, /main = "src\/index\.js"/);
});

test('tutte le pagine hanno la voce «Atti» nel menù e nel piede', () => {
  const pagine = readdirSync(new URL('.', radice)).filter(f => f.endsWith('.html'));
  assert.ok(pagine.length >= 7, `solo ${pagine.length} pagine`);
  for (const pagina of pagine) {
    const html = leggi(pagina);
    assert.match(html, /<a href="atti\.html"[ >]/, `${pagina}: manca la voce «Atti» nel menù`);
    assert.match(html, /altre-nota">Albo, delibere, ordinanze, bandi/, `${pagina}: manca la voce nel pannello «Altro»`);
    assert.match(html, /<a href="atti\.html">Atti del Comune<\/a>/, `${pagina}: manca il rimando nel piede`);
  }
});
