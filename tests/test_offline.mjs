// Controlli statici su manifest e service worker di «Chiedilo a Pinuzza».
// Il comportamento vero (aprire l'app senza rete) si verifica a mano con il browser:
// qui si controlla che i pezzi siano coerenti, perché un errore qui vuol dire
// un'app che al primo volo offline non si apre più.
//
// Uso: node --test tests/test_offline.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const radice = new URL('../', import.meta.url);
const leggi = percorso => readFileSync(new URL(percorso, radice), 'utf8');

const manifest = JSON.parse(leggi('manifest.webmanifest'));
const sw = leggi('sw.js');
const offline = leggi('js/offline.js');

test('il manifest dichiara quello che serve per installare l\'app', () => {
  assert.equal(manifest.name, 'Chiedilo a Pinuzza');
  assert.equal(manifest.short_name, 'Pinuzza');
  assert.equal(manifest.lang, 'it');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0e5a54');
  assert.equal(manifest.background_color, '#fcfbf7');
  assert.equal(manifest.start_url, './?fonte=pwa');
});

test('le icone del manifest esistono e ci sono le tre misure richieste', () => {
  const misure = manifest.icons.map(i => i.sizes);
  for (const attesa of ['192x192', '512x512']) assert.ok(misure.includes(attesa), `manca ${attesa}`);
  assert.ok(manifest.icons.some(i => (i.purpose || '').includes('maskable')), 'manca l\'icona maskable');
  for (const icona of manifest.icons) {
    assert.ok(existsSync(new URL(icona.src, radice)), `icona mancante: ${icona.src}`);
  }
});

test('la versione del service worker è coerente nei due file', () => {
  const inSw = sw.match(/const VERSIONE = '(pinuzza-v\d+)'/);
  const inOffline = offline.match(/const VERSIONE_ATTESA = '(pinuzza-v\d+)'/);
  assert.ok(inSw, 'VERSIONE non trovata in sw.js');
  assert.ok(inOffline, 'VERSIONE_ATTESA non trovata in js/offline.js');
  assert.equal(inSw[1], inOffline[1], 'js/offline.js e sw.js dichiarano versioni diverse');
});

test('tutti i file elencati per la cache esistono davvero', () => {
  const elenco = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(elenco, 'PRECACHE non trovata in sw.js');
  const file = [...elenco[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(file.length >= 15, `solo ${file.length} file in cache`);
  for (const percorso of file) {
    if (percorso === './') continue;
    assert.ok(existsSync(new URL(percorso, radice)), `file in cache ma inesistente: ${percorso}`);
  }
});

test('nessun file di css/ o js/ resta fuori dalla cache', () => {
  const elenco = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  const inCache = new Set([...elenco.matchAll(/'([^']+)'/g)].map(m => m[1]));
  const cartelle = ['css', 'js'];
  const mancanti = [];
  for (const cartella of cartelle) {
    for (const file of readdirSync(new URL(`${cartella}/`, radice))) {
      if (!/\.(css|js)$/.test(file)) continue;
      const percorso = `${cartella}/${file}`;
      if (!inCache.has(percorso)) mancanti.push(percorso);
    }
  }
  assert.deepEqual(mancanti, [], `fuori dalla cache offline: ${mancanti.join(', ')}`);
});

test('il service worker tiene fuori le terze parti (mappa e statistiche)', () => {
  const elenco = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  assert.ok(/openstreetmap|googletagmanager|google-analytics/i.test(elenco) === false, 'una URL di terzi finirebbe in cache');
  assert.ok(sw.includes('stessoSito'), 'manca il controllo che limita la cache al nostro sito');
  assert.ok(/request\.method !== 'GET' \|\| !stessoSito/.test(sw), 'il filtro sulle richieste non esclude le terze parti');
});

test('ogni pagina registra il service worker e linka il manifest', () => {
  for (const pagina of ['index.html', 'uffici.html', 'privacy.html']) {
    const html = leggi(pagina);
    assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/, `${pagina}: manca il manifest`);
    assert.match(html, /<script type="module" src="js\/offline\.js"><\/script>/, `${pagina}: manca js/offline.js`);
  }
});

test('l\'avviso «senza rete» compare e sparisce con gli eventi del browser', () => {
  assert.ok(offline.includes("addEventListener('offline'"), 'manca l\'ascolto di offline');
  assert.ok(offline.includes("addEventListener('online'"), 'manca l\'ascolto di online');
  assert.ok(offline.includes('navigator.onLine'), 'lo stato iniziale non viene letto');
  assert.ok(offline.includes('avviso-rete'), 'manca la classe dell\'avviso (css/pinuzza.css)');
  assert.ok(readFileSync(new URL('css/pinuzza.css', radice), 'utf8').includes('.avviso-rete'), 'manca lo stile');
});

test('l\'installazione non lascia mai una cache mezza vuota', () => {
  assert.ok(sw.includes('cache incompleta'), 'manca il controllo sui file mancanti');
  assert.ok(/mancanti\.length[\s\S]{0,120}caches\.delete\(GUSCIO\)/.test(sw), 'la cache incompleta non viene buttata');
  assert.ok(sw.includes('throw new Error'), 'l\'installazione deve fallire, non passare');
});

test('senza rete una pagina chiesta si serve dalla sua copia, non sempre dalla home', () => {
  assert.ok(/caches\.match\(richiesta, \{ ignoreSearch: true \}\)/.test(sw),
    'il fallback di navigazione deve cercare la pagina richiesta in tutte le cache');
});
