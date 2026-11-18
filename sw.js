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

const VERSIONE = 'pinuzza-v93';
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
  'atti.html',
  'domande.html',
  'salvati.html',
  'guida.html',
  'manifest.webmanifest',
  'css/pinuzza.css',
  'js/app.js',
  'js/atti.js',
  'js/aree.js',
  'js/consenso.js',
  'js/crediti.js',
  'js/dati.js',
  'js/decifra.js',
  'js/icone.js',
  'js/in-cima.js',
  'js/installa.js',
  'js/schermo-intero.js',
  'js/menu.js',
  'js/motore.js',
  'js/offline.js',
  'js/salvati.js',
  'js/salvati-pagina.js',
  'js/tema.js',
  'js/uffici.js',
  'img/favicon.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
  'img/opendatasicilia.png',
  'img/guida/home.webp',
  'img/guida/risposta.webp',
  'img/guida/ufficio.webp',
  'img/guida/incerta.webp',
  'img/guida/vuota.webp',
  'img/guida/salva.webp',
  'img/guida/salvati.webp',
  'img/guida/atti-cerca.webp',
  'img/guida/atti-risultati.webp',
  'img/guida/atti-telefono.webp',
  'img/guida/decifra-finestra.webp',
  'img/guida/decifra-home.webp',
  'img/guida/decifra-istruzioni.webp',
  'img/guida/decifra-telefono.webp',
  'img/guida/domande.webp',
  'img/guida/uffici.webp',
  'img/guida/telefono.webp',
  'img/guida/telefono-altro.webp',
  'img/guida/scuro.webp',
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
      // ma un guscio incompleto è peggio di nessun aggiornamento: con metà file nuovi e
      // metà vecchi l'app può rompersi. Se manca qualcosa si butta la cache e l'installazione
      // fallisce: resta attivo il service worker precedente, che funziona.
      const presenti = await Promise.all(PRECACHE.map(file => cache.match(file)));
      const mancanti = PRECACHE.filter((file, i) => !presenti[i]);
      if (mancanti.length) {
        await caches.delete(GUSCIO);
        throw new Error(`cache incompleta: ${mancanti.join(', ')}`);
      }
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
    // senza rete si serve la pagina chiesta se è in cache (le pagine stanno anche nel guscio),
    // altrimenti almeno la home: mai una pagina sbagliata con il titolo giusto
    const copia =
      (await caches.match(richiesta, { ignoreSearch: true })) ||
      (await cache.match(richiesta, { ignoreSearch: true })) ||
      (await caches.match('index.html'));
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
  const guscio = await caches.open(GUSCIO);
  // argomenti e servizi stanno nella precache del guscio (servono per la prima domanda),
  // uffici.json nella cache dei dati: la risposta vecchia può essere in tutte e due
  const copia =
    (await cache.match(richiesta, { ignoreSearch: true })) ||
    (await guscio.match(richiesta, { ignoreSearch: true }));
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
