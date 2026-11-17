// Service worker di «Chiedilo a Pinuzza»: l'app deve funzionare anche senza rete,
// perché allo sportello o in giro la connessione manca proprio quando serve.
//
// Regole:
//  - guscio (CSS, JS, icone, manifest): prima la copia in cache, aggiornamento in background;
//  - dati (data/*.json) e pagine HTML: rete prima, copia in cache come riserva; per i dati
//    si aggiorna la cache mentre si serve la copia vecchia (stale-while-revalidate);
//  - siti di terzi (OpenStreetMap per la mappa, Google per le statistiche): mai in cache,
//    passano sempre dalla rete — se manca la rete, spariscono senza rompere altro.
//
// A ogni rilascio va incrementata VERSIONE (o si lancia scripts/nuova_versione.sh): le cache
// vecchie vengono cancellate all'attivazione, così non si serve mai un misto di versioni.

const VERSIONE = 'pinuzza-v2';
const GUSCIO = `${VERSIONE}-guscio`;
const PAGINE = `${VERSIONE}-pagine`;
const DATI = `${VERSIONE}-dati`;

// Quello che serve per aprire l'app e rispondere alla prima domanda.
// I file elencati qui devono esistere: scripts/test_offline.mjs lo controlla.
const PRECACHE = [
  './',
  'index.html',
  'privacy.html',
  'uffici.html',
  'manifest.webmanifest',
  'css/pinuzza.css',
  'js/app.js',
  'js/aree.js',
  'js/consenso.js',
  'js/dati.js',
  'js/motore.js',
  'js/offline.js',
  'js/uffici.js',
  'img/favicon.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
  'img/opendatasicilia.png',
  'data/argomenti.json',
  'data/servizi.json',
];

// data/uffici.json pesa più di 1 MB: non si scarica all'installazione, entra in cache
// la prima volta che l'app lo chiede (lo fa da sola, in background, dopo l'apertura).

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(GUSCIO).then(async cache => {
      // uno per uno: se un file manca non deve saltare tutta l'installazione
      await Promise.allSettled(PRECACHE.map(file => cache.add(new Request(file, { cache: 'reload' }))));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    (async () => {
      const nomi = await caches.keys();
      await Promise.all(nomi.filter(n => !n.startsWith(VERSIONE)).map(n => caches.delete(n)));
      await self.clients.claim();
      // gli uffici pesano più di 1 MB e non stanno nella precache: si scaricano qui, in
      // background, così la prima scheda ufficio funziona anche se la rete sparisce
      // subito dopo la prima apertura
      riempiDati();
    })(),
  );
});

async function riempiDati() {
  try {
    const cache = await caches.open(DATI);
    if (await cache.match('data/uffici.json')) return;
    await cache.add(new Request('data/uffici.json', { cache: 'reload' }));
  } catch (errore) {
    // niente rete o file non disponibile: ci penserà l'app alla prima richiesta
  }
}

const stessoSito = url => new URL(url, self.location.href).origin === self.location.origin;
const èDato = url => /\/data\/[^/]+\.json$/.test(new URL(url).pathname);
const èGuscio = url => /\.(css|js|png|ico|svg|webmanifest)$/.test(new URL(url).pathname);

async function retePrima(richiesta, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const risposta = await fetch(richiesta);
    if (risposta && risposta.ok) cache.put(richiesta, risposta.clone());
    return risposta;
  } catch (errore) {
    const copia = (await cache.match(richiesta, { ignoreSearch: true })) || (await caches.match('index.html'));
    if (copia) return copia;
    throw errore;
  }
}

async function cachePrima(richiesta, cacheName) {
  const cache = await caches.open(cacheName);
  const copia = await cache.match(richiesta, { ignoreSearch: true });
  if (copia) {
    // aggiornamento in background: la prossima apertura è già nuova
    fetch(richiesta).then(risposta => {
      if (risposta && risposta.ok) cache.put(richiesta, risposta.clone());
    }).catch(() => {});
    return copia;
  }
  const risposta = await fetch(richiesta);
  if (risposta && risposta.ok) cache.put(richiesta, risposta.clone());
  return risposta;
}

async function staleWhileRevalidate(richiesta) {
  const cache = await caches.open(DATI);
  const copia = await cache.match(richiesta, { ignoreSearch: true });
  const aggiorna = fetch(richiesta)
    .then(risposta => {
      if (risposta && risposta.ok) cache.put(richiesta, risposta.clone());
      return risposta;
    });
  return copia || aggiorna;
}

self.addEventListener('fetch', evento => {
  const { request } = evento;
  if (request.method !== 'GET' || !stessoSito(request.url)) return; // terzi: mai in cache

  if (request.mode === 'navigate') {
    evento.respondWith(retePrima(request, PAGINE));
    return;
  }
  if (èDato(request.url)) {
    evento.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (èGuscio(request.url)) {
    evento.respondWith(cachePrima(request, GUSCIO));
  }
});
