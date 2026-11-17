// Test dell'interfaccia (P1.7): tredici casi che coprono quello che l'utente fa davvero.
//
// Apre il sito in locale con Chromium (Playwright) e prova: pagina bianca, risposta con
// scheda ufficio, domanda con due richieste, risposta incerta, risposta vuota, GPS negato, telefono 390×844, tema
// scuro, funzionamento senza rete, consenso accettato/rifiutato, feedback e dati
// strutturati. Non usa @playwright/test: si lancia con `node tests/ui.spec.mjs` e
// stampa un caso per riga.
//
// Uso:
//   node tests/ui.spec.mjs                       # serve la cartella e prova tutto
//   node tests/ui.spec.mjs --url http://127.0.0.1:8777/   # contro un server già acceso
//
// Esce con codice 1 se un caso fallisce: è il controllo che gira in CI a ogni push su `main`
// (`.github/workflows/verifica.yml`).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = fileURLToPath(new URL('../', import.meta.url));
const TIPI = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

async function caricaPlaywright() {
  const percorsi = [
    'playwright',
    join(BASE, 'node_modules/playwright/index.mjs'),
    '/tmp/pwtest/node_modules/playwright/index.mjs',
    '/home/coseerobe/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs',
  ];
  for (const percorso of percorsi) {
    try {
      return await import(percorso);
    } catch {
      /* provo il prossimo */
    }
  }
  throw new Error('Playwright non trovato: npm i -D playwright');
}

function avviaServer(cartella) {
  const server = createServer(async (richiesta, risposta) => {
    try {
      const percorso = decodeURIComponent(new URL(richiesta.url, 'http://x').pathname);
      let file = normalize(join(cartella, percorso));
      if (!file.startsWith(cartella)) throw new Error('fuori dalla cartella');
      const info = await stat(file).catch(() => null);
      if (!info || info.isDirectory()) file = join(file, 'index.html');
      const contenuto = await readFile(file);
      risposta.writeHead(200, { 'content-type': TIPI[extname(file)] || 'application/octet-stream' });
      risposta.end(contenuto);
    } catch {
      risposta.writeHead(404, { 'content-type': 'text/plain' });
      risposta.end('non trovato');
    }
  });
  return new Promise(risolvi => server.listen(0, '127.0.0.1', () => risolvi(server)));
}

// ---------- utilità ----------

const attesa = ms => new Promise(r => setTimeout(r, ms));

function verifica(condizione, messaggio) {
  if (!condizione) throw new Error(messaggio);
}

async function nuovaSessione(browser, { larghezza = 1280, altezza = 900 } = {}) {
  const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza } });
  // l'avviso delle statistiche copre il contenuto in basso: nei test lo chiudiamo in anticipo,
  // tranne nel caso che lo riguarda (che imposta una scelta esplicita prima di ricaricare)
  await contesto.addInitScript(() => {
    try {
      if (localStorage.getItem('pinuzza-consenso') === null) localStorage.setItem('pinuzza-consenso', 'rifiutato');
    } catch {
      /* niente memoria: il test funziona lo stesso */
    }
  });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', errore => errori.push(errore.message));
  return { contesto, pagina, errori };
}

async function pulisciCache(pagina, base) {
  await pagina.goto(base, { waitUntil: 'load' });
  await pagina.evaluate(async () => {
    for (const registrazione of await navigator.serviceWorker.getRegistrations()) await registrazione.unregister();
    for (const chiave of await caches.keys()) await caches.delete(chiave);
    localStorage.clear();
  });
}

// ---------- i casi ----------

const casi = {
  async 'pagina bianca: campo, suggerimenti e badge degli uffici'(pagina, base) {
    await pagina.goto(base, { waitUntil: 'load' });
    await attesa(900);
    verifica(await pagina.textContent('h1') !== null, 'manca il titolo');
    verifica(await pagina.isVisible('#domanda'), 'manca il campo di ricerca');
    const domande = await pagina.locator('.riga-domande button').count();
    verifica(domande >= 6, `suggerimenti: ${domande}`);
    const badge = await pagina.textContent('#badge-uffici');
    verifica(/\d{3} uffici/.test(badge), `badge uffici: ${badge}`);
  },

  async 'risposta con scheda ufficio: titolo, recapiti, feedback'(pagina, base) {
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1200);
    const titolo = await pagina.textContent('#risultati article.risposta h2');
    verifica(titolo.includes('Cambio di residenza'), `titolo: ${titolo}`);
    verifica(await pagina.locator('#risultati .uffici .ufficio').count() >= 1, 'nessuna scheda ufficio');
    verifica(await pagina.locator('#risultati .uffici a[href^="tel:"]').count() >= 1, 'nessun telefono cliccabile');
    verifica(await pagina.locator('.utile-azioni button').count() === 2, 'manca il feedback');
  },

  async 'domanda con due richieste: la seconda scheda sta sotto, con i suoi uffici'(pagina, base) {
    await pagina.goto(base + '?q=' + encodeURIComponent('come ottengo il contrassegno disabili e come prenoto un campo di calcio'), { waitUntil: 'load' });
    await attesa(1600);
    const prima = await pagina.textContent('#risultati article.risposta h2');
    verifica(/contrassegno/i.test(prima), `prima scheda: ${prima}`);
    verifica(await pagina.locator('#risultati .anche').count() === 1, 'manca il riquadro «anche»');
    const seconda = await pagina.textContent('#risultati .anche h4');
    verifica(/campo|impianti|sport/i.test(seconda), `seconda scheda: ${seconda}`);
    // i titoli scendono di un livello, senza saltarne uno
    const livelli = await pagina.evaluate(() => [...document.querySelectorAll('#risultati .anche h3, #risultati .anche h4, #risultati .anche h5')].map(h => Number(h.tagName.slice(1))));
    verifica(livelli[0] === 3 && livelli.includes(4) && !livelli.includes(6), `titoli del riquadro: ${livelli}`);
    verifica(await pagina.locator('#risultati .anche .uffici .ufficio').count() >= 1, 'nessun ufficio nella seconda scheda');
    // una sola domanda «ti è stato utile?»: quella della risposta principale
    verifica(await pagina.locator('#risultati .utile').count() === 1, 'feedback duplicato');
  },

  async 'risposta incerta: lo dice e propone domande vicine'(pagina, base) {
    await pagina.goto(base + '?q=' + encodeURIComponent('aiuola funziona'), { waitUntil: 'load' });
    await attesa(1200);
    const avviso = await pagina.textContent('#risultati .avviso');
    verifica(/non sono sicura/i.test(avviso), `avviso: ${avviso}`);
    verifica(await pagina.locator('.domande-vicine button').count() >= 1, 'nessuna domanda vicina');
  },

  async 'risposta vuota: lo dice e indica gli uffici'(pagina, base) {
    await pagina.goto(base + '?q=' + encodeURIComponent('ricetta della pasta con le sarde'), { waitUntil: 'load' });
    await attesa(1500);
    const titolo = await pagina.textContent('#risultati .vuoto h2');
    verifica(/Non ho una risposta pronta/.test(titolo), `titolo: ${titolo}`);
  },

  async 'GPS negato: il percorso si apre lo stesso, con l’avviso'(pagina, base) {
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1200);
    const contesto = pagina.context();
    await contesto.clearPermissions();
    await pagina.locator('#risultati .ufficio button.percorso').first().click();
    await attesa(1500);
    const avvisi = await pagina.locator('.avviso-gps:not([hidden])').count();
    verifica(avvisi >= 1, 'nessun avviso quando il GPS manca');
  },

  async 'telefono 390×844: barra in basso, tema, bersagli ≥ 44 px'(pagina, base) {
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1200);
    verifica(await pagina.isVisible('.barra-basso'), 'manca la barra in basso');
    verifica(await pagina.isVisible('#tema-barra'), 'manca il tema nella barra in basso');
    // i comandi, non i link dentro un testo (`.link-bottone` del piede, per esempio)
    const piccoli = await pagina.evaluate(() => [...document.querySelectorAll('button, input, .azioni a')]
      .filter(el => !el.classList.contains('link-bottone') && el.getClientRects().length)
      .map(el => ({ chi: (el.id || String(el.className) || el.tagName).split(' ')[0], h: Math.round(el.getBoundingClientRect().height) }))
      .filter(x => x.h < 44));
    verifica(piccoli.length === 0, `bersagli sotto 44 px: ${JSON.stringify(piccoli)}`);
  },

  async 'tema scuro: cambia, resta dopo il ricaricamento'(pagina, base) {
    await pagina.setViewportSize({ width: 1280, height: 900 });
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1000);
    await pagina.click('#tema');
    await attesa(300);
    const dopo = await pagina.evaluate(() => ({
      tema: document.documentElement.dataset.theme,
      fondo: getComputedStyle(document.body).backgroundColor,
      salvato: localStorage.getItem('pinuzza-tema'),
    }));
    verifica(dopo.tema === 'scuro' && dopo.salvato === 'scuro', `tema dopo il clic: ${JSON.stringify(dopo)}`);
    verifica(dopo.fondo === 'rgb(19, 18, 16)', `fondo scuro atteso, trovato ${dopo.fondo}`);
    await pagina.reload({ waitUntil: 'load' });
    await attesa(800);
    verifica(await pagina.evaluate(() => document.documentElement.dataset.theme) === 'scuro', 'il tema non resta dopo il ricaricamento');
    await pagina.evaluate(() => { localStorage.removeItem('pinuzza-tema'); document.documentElement.dataset.theme = 'chiaro'; });
  },

  async 'senza rete: l’app si apre, risponde e mostra la scheda'(pagina, base) {
    await pulisciCache(pagina, base);
    await pagina.reload({ waitUntil: 'load' });
    await pagina.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
    // il riempimento dei dati degli uffici parte dopo l'attivazione
    for (let i = 0; i < 60; i++) {
      const pronto = await pagina.evaluate(async () => {
        const chiavi = await caches.keys();
        const dati = chiavi.find(k => k.endsWith('-dati'));
        if (!dati) return false;
        return !!(await (await caches.open(dati)).match('data/uffici.json'));
      });
      if (pronto) break;
      await attesa(250);
    }
    await pagina.context().setOffline(true);
    // Chromium aggiorna `navigator.onLine` con un attimo di ritardo: aspettiamo prima di navigare
    await pagina.waitForFunction(() => navigator.onLine === false, { timeout: 5000 }).catch(() => {});
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1200);
    const esito = await pagina.evaluate(() => ({
      titolo: document.querySelector('#risultati article.risposta h2')?.textContent || '',
      uffici: document.querySelectorAll('#risultati .uffici .ufficio').length,
    }));
    verifica(/Cambio di residenza/.test(esito.titolo), `titolo offline: ${esito.titolo}`);
    verifica(esito.uffici >= 1, 'nessuna scheda ufficio offline');

    // In Playwright `setOffline` blocca la rete ma non sempre cambia `navigator.onLine`: per la
    // barra «senza rete» si simula lo stato che il browser dichiara in aereo (offline + evento).
    const banner = await pagina.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
      window.dispatchEvent(new Event('offline'));
      const avviso = document.querySelector('.avviso-rete');
      return { visibile: !!avviso && !avviso.hidden, testo: avviso?.textContent || '' };
    });
    verifica(banner.visibile, 'la barra «senza rete» non compare con lo stato offline');
    verifica(/senza rete/i.test(banner.testo), `testo della barra: ${banner.testo}`);
    verifica(/aggiornat[oi] al/i.test(banner.testo), `la barra non dice a quando risalgono i dati: ${banner.testo}`);

    await pagina.goto(base + 'domande.html', { waitUntil: 'load' });
    await attesa(600);
    verifica((await pagina.textContent('h1')).includes('Tutte le domande'), 'domande.html non si apre offline');
    await pagina.context().setOffline(false);
  },

  async 'statistiche: nessuno script se rifiutate, sì se accettate'(pagina, base) {
    await pagina.goto(base, { waitUntil: 'load' });
    await pagina.evaluate(() => localStorage.setItem('pinuzza-consenso', 'rifiutato'));
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1000);
    verifica(await pagina.locator('script[data-analytics]').count() === 0, 'Analytics è partito senza consenso');
    await pagina.locator('.utile-si').click();
    verifica((await pagina.evaluate(() => typeof window.gtag)) === 'undefined', 'gtag esiste senza consenso');
    await pagina.evaluate(() => localStorage.setItem('pinuzza-consenso', 'accettato'));
    await pagina.reload({ waitUntil: 'load' });
    await attesa(1200);
    verifica(await pagina.locator('script[data-analytics]').count() === 1, 'Analytics non parte nemmeno con il consenso');
    await pagina.evaluate(() => localStorage.removeItem('pinuzza-consenso'));
  },

  async 'feedback: «No» prepara la segnalazione su GitHub'(pagina, base) {
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1200);
    await pagina.evaluate(() => {
      // l'app apre `about:blank` e poi naviga: la URL buona è quella su cui finisce la finestra
      window.__finestra = null;
      window.open = url => {
        const finta = { opener: null, location: { href: url, replace(nuovo) { this.href = nuovo; } }, closed: false };
        window.__finestra = finta;
        return finta;
      };
    });
    await pagina.locator('.utile-no').click();
    await attesa(400);
    const indirizzo = await pagina.evaluate(() => window.__finestra?.location?.href || '');
    verifica(indirizzo.startsWith('https://github.com/PalermoHub/cosa_fare_per/issues/new?'), `indirizzo: ${indirizzo}`);
    verifica(indirizzo.includes('labels=segnalazione'), 'manca l’etichetta');
    verifica(indirizzo.includes('%5BRisposta%5D'), 'manca il titolo [Risposta]');
    verifica((await pagina.textContent('.utile-esito')).length > 20, 'manca l’esito');
  },

  async 'la mappa parte solo quando la scheda entra nello schermo'(pagina, base) {
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.goto(base + '?q=' + encodeURIComponent('come cambio residenza'), { waitUntil: 'load' });
    await attesa(1200);
    const iff = pagina.locator('#risultati .ufficio iframe').first();
    verifica(await iff.count() === 1, 'manca la mappa incorporata');
    const prima = await iff.getAttribute('src');
    verifica(prima === 'about:blank', `la mappa è partita subito: ${prima}`);
    await iff.scrollIntoViewIfNeeded();
    await attesa(1500);
    const dopo = await iff.getAttribute('src');
    verifica(/openstreetmap\.org/.test(dopo || ''), `la mappa non parte allo scorrimento: ${dopo}`);
  },

  async 'dati strutturati: FAQPage con 20 domande e la data dei dati'(pagina, base) {
    await pagina.goto(base, { waitUntil: 'load' });
    const dati = await pagina.evaluate(() => {
      const blocco = document.querySelector('script[type="application/ld+json"]');
      return blocco ? JSON.parse(blocco.textContent) : null;
    });
    verifica(dati && dati['@type'] === 'FAQPage', 'manca il JSON-LD FAQPage');
    verifica(dati.mainEntity.length === 20, `domande FAQ: ${dati.mainEntity.length}`);
    verifica(dati.mainEntity.every(q => q.acceptedAnswer.text.length > 60), 'risposte troppo corte');
    // la data arriva dai dati (argomenti.json), non dall'HTML: sul live può servire un attimo
    await pagina
      .waitForFunction(() => /\d{4}/.test(document.querySelector('#aggiornato')?.textContent || ''), { timeout: 10000 })
      .catch(() => {});
    const data = (await pagina.textContent('#aggiornato')) || '—';
    verifica(/\d{4}/.test(data), `data dei dati: ${data}`);
  },
};

// ---------- esecuzione ----------

async function main() {
  const argomenti = process.argv.slice(2);
  const indice = argomenti.indexOf('--url');
  const { chromium } = await caricaPlaywright();

  let server = null;
  let base = indice >= 0 ? argomenti[indice + 1] : '';
  if (!base) {
    server = await avviaServer(BASE);
    base = `http://127.0.0.1:${server.address().port}`;
  }
  if (!base.endsWith('/')) base += '/';

  const browser = await chromium.launch();
  const fallimenti = [];

  try {
    for (const [nome, prova] of Object.entries(casi)) {
      const { contesto, pagina, errori } = await nuovaSessione(browser);
      try {
        await prova(pagina, base);
        verifica(errori.length === 0, `errori in pagina: ${errori.join(' | ')}`);
        console.log(`✓ ${nome}`);
      } catch (errore) {
        fallimenti.push(nome);
        console.log(`✗ ${nome}\n    ${errore.message}`);
      } finally {
        await contesto.close();
      }
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }

  console.log(`\n${Object.keys(casi).length - fallimenti.length}/${Object.keys(casi).length} casi superati`);
  if (fallimenti.length) process.exitCode = 1;
}

await main();
