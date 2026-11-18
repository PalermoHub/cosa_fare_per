// Audit di accessibilità (P1.4): axe-core su cinque viste, bersagli tattili, tastiera.
//
// Apre il sito in locale con Chromium (Playwright), fa girare axe-core con le regole
// WCAG 2.0/2.1 A e AA più le best practice, misura i comandi sotto i 44 px sul telefono
// e prova il giro completo da tastiera (campo → Invio → titolo della risposta).
// Scrive il rapporto in docs/ACCESSIBILITA.md (solo se la cartella `docs/` esiste: in CI non
// c'è) ed esce con errore se trova violazioni serious o critical.
//
// Uso:
//   node tests/audit_axe.mjs            # serve la cartella e fa l'audit
//   node tests/audit_axe.mjs --url http://127.0.0.1:8777/   # contro un server già acceso
//
// Serve Playwright (npm i -D playwright oppure l'installazione globale) e la rete per
// scaricare axe-core dal CDN: l'audit non fa parte di `npm test` per questo motivo.
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = fileURLToPath(new URL('../', import.meta.url));
const AXE = 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js';
const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

async function caricaPlaywright() {
  const percorsi = [
    'playwright',
    join(BASE, 'node_modules/playwright/index.mjs'),
    // installazioni già presenti su questa macchina (nessun download)
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
  throw new Error('Playwright non trovato: npm i -D playwright (oppure installalo globalmente)');
}

// server statico minimo: si serve la cartella del progetto
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

const VISTE = [
  ['home', '/', 390],
  ['risposta con scheda ufficio', '/?q=come%20cambio%20residenza', 390],
  ['«non ho capito»', '/?q=rumore%20dei%20locali%20la%20notte', 390],
  ['domanda con due richieste', '/?q=come%20ottengo%20il%20contrassegno%20disabili%20e%20come%20prenoto%20un%20campo%20di%20calcio', 390],
  ['privacy', '/privacy.html', 390],
  ['tutti gli uffici', '/uffici.html', 390],
  ['atti del Comune', '/atti.html', 390],
  ['tutte le domande', '/domande.html', 390],
  ['guida', '/guida.html', 390],
  ['guida (schermo largo)', '/guida.html', 1280],
  ['risposte salvate (vuoto)', '/salvati.html', 390],
  ['risposte salvate con una voce', '/salvati.html', 390],
  ['«Credits» aperto', '/', 390],
  ['«Decifra la PA» aperto', '/', 390],
  ['pannello «Altro» aperto', '/', 390],
  ['home (schermo largo)', '/', 1280],
  ['risposta in tema scuro (schermo largo)', '/?q=come%20cambio%20residenza', 1280],
];

// Le schede degli atti: la pagina le chiede a un Worker, qui la risposta è finta,
// così l'audit è veloce, sempre uguale e non dipende dal sito del Comune.
const ATTI_FINTI = {
  tipo: 'tutti', tipoNome: 'Tutti gli atti', totale: 2,
  tipiInterrogati: 2, tipiNonDisponibili: 0, tipiNonInterrogati: 0,
  aggiornato: new Date().toISOString(),
  risultati: [
    { tipo: 'Delibere di Giunta', portale: 'Delibere e Ordinanze', numero: '360', data: '13/11/2026',
      oggetto: 'IL GEMELLAGGIO TRA IL COMUNE DI PALERMO E IL COMUNE DI RIO DE JANEIRO',
      pubblicato: '14/11/2026', scade: '29/11/2026', allegati: 14,
      link: 'https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2024&ALBCOD=6271626779667976607C&sportello=albopretorio' },
    { tipo: 'Determinazioni dirigenziali', portale: 'Albo Pretorio', numero: '17033', data: '18/11/2026',
      oggetto: 'AFFIDAMENTO DIRETTO PER L’ACQUISIZIONE DEI SERVIZI DI LAVAGGIO',
      pubblicato: '18/11/2026', scade: '03/12/2026', allegati: 1,
      link: 'https://albopretorio.comune.palermo.it/albopretorio/pu/push-tabella-delibere.do?nomeTabella=FO_SCEDELIBEREAP&TD=2010&ALBCOD=62716267796770746778&sportello=albopretorio' },
  ],
};

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
  const contesto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pagina = await contesto.newPage();
  const rapporti = [];

  try {
    for (const [nome, percorso, larghezza] of VISTE) {
      await pagina.setViewportSize({ width: larghezza, height: 900 });
      await pagina.emulateMedia({ colorScheme: 'light' });
      if (percorso.includes('atti.html')) {
        await pagina.route('**/cerca?**', route => route.fulfill({
          status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(ATTI_FINTI),
        }));
      }
      await pagina.goto(base.replace(/\/$/, '') + percorso, { waitUntil: 'load' });
      if (nome.includes('tema scuro')) {
        await pagina.evaluate(() => localStorage.setItem('pinuzza-tema', 'scuro'));
        await pagina.reload({ waitUntil: 'load' });
      }
      if (nome.includes('con una voce')) {
        // una risposta salvata a mano: la pagina deve reggere anche con l'elenco pieno
        await pagina.evaluate(() => {
          localStorage.setItem('pinuzza-salvati', JSON.stringify([
            { id: 'cambio-residenza', domanda: 'come cambio residenza', titolo: 'Cambio di residenza', quando: '2026-11-18' },
          ]));
        });
        await pagina.reload({ waitUntil: 'load' });
      }
      if (nome.includes('Credits')) {
        // il riquadro dei crediti si apre dal collegamento nel piede
        await pagina.evaluate(() => document.querySelector('[data-crediti]').click());
      }
      if (nome.includes('Decifra')) {
        // la finestra si apre dal riquadro in home; il campo del link prende il fuoco
        await pagina.evaluate(() => document.querySelector('[data-decifra]').click());
      }
      if (nome.includes('Altro')) {
        // il pannello delle voci secondarie si apre dal suo pulsante, in fondo alla pagina
        await pagina.evaluate(() => document.querySelector('[data-altre]').click());
      }
      await pagina.waitForTimeout(900);
      await pagina.addScriptTag({ url: AXE });
      const violazioni = await pagina.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
        });
        return r.violations.map(v => ({ id: v.id, impatto: v.impact, help: v.help, nodi: v.nodes.length }));
      });
      rapporti.push({ nome, violazioni });
      if (percorso.includes('atti.html')) await pagina.unroute('**/cerca?**');
      await pagina.evaluate(() => {
        localStorage.removeItem('pinuzza-tema');
        localStorage.removeItem('pinuzza-salvati');
      });
      process.stdout.write(`${nome}: ${violazioni.length ? violazioni.map(v => v.id).join(', ') : 'nessuna violazione'}\n`);
    }

    // bersagli tattili sul telefono
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.goto(base.replace(/\/$/, '') + '/?q=come%20cambio%20residenza', { waitUntil: 'load' });
    await pagina.waitForTimeout(900);
    await pagina.evaluate(() => document.querySelector('[data-altre]').click());
    await pagina.waitForTimeout(400);
    const piccoli = await pagina.evaluate(() => [...document.querySelectorAll('button, input, .azioni a, .altre-voci a, .altre-tema')]
      .filter(el => el.getClientRects().length)
      .map(el => ({ chi: (el.id || String(el.className) || el.tagName).split(' ')[0], altezza: Math.round(el.getBoundingClientRect().height) }))
      .filter(x => x.altezza < 44));

    // tastiera: campo → Invio → il focus va sul titolo della risposta
    await pagina.goto(base.replace(/\/$/, '') + '/', { waitUntil: 'load' });
    await pagina.waitForTimeout(700);
    await pagina.focus('#domanda');
    await pagina.keyboard.type('come cambio residenza');
    await pagina.keyboard.press('Enter');
    await pagina.waitForTimeout(1200);
    const tastiera = await pagina.evaluate(() => ({
      focus: `${document.activeElement?.tagName || '?'} — ${(document.activeElement?.textContent || '').trim().slice(0, 50)}`,
      annuncio: document.getElementById('annuncio')?.textContent || '',
    }));

    const gravi = rapporti.flatMap(r => r.violazioni.filter(v => v.impatto === 'serious' || v.impatto === 'critical'));
    const rapporto = [
      '# Accessibilità (audit misurato)',
      '',
      'Generato da `tests/audit_axe.mjs` con axe-core 4.10.2 (regole WCAG 2.0/2.1 A e AA più',
      'best practice), Chromium headless via Playwright. Si rilancia con:',
      '',
      '```bash',
      'node tests/audit_axe.mjs',
      '```',
      '',
      `Totale violazioni serious/critical: **${gravi.length}**.`,
      '',
      '## Violazioni per vista',
      '',
      '| Vista | Violazioni |',
      '|---|---|',
      ...rapporti.map(r => `| ${r.nome} | ${r.violazioni.length ? r.violazioni.map(v => `${v.impatto}: ${v.id} (${v.nodi})`).join('<br>') : 'nessuna'} |`),
      '',
      '## Bersagli tattili sotto 44 px (telefono, 390 px)',
      '',
      piccoli.length
        ? ['| Comando | Altezza |', '|---|---|', ...piccoli.map(p => `| ${p.chi} | ${p.altezza} px |`)].join('\n')
        : 'Nessuno: tutti i comandi (bottoni, campo di ricerca, azioni della scheda ufficio) sono alti almeno 44 px.',
      '',
      '## Tastiera',
      '',
      `Da tastiera, dopo l'invio della domanda il focus va su: ${tastiera.focus}.`,
      `Annuncio per i lettori di schermo: «${tastiera.annuncio}».`,
      '',
      'Il contenitore dei risultati **non** è più `aria-live`: annunciare tutta la risposta sarebbe',
      'rumore. C’è una riga nascosta (`#annuncio`, `role="status"`) che dice solo che cosa è arrivato.',
      '',
    ].join('\n');

    // il rapporto è un documento di lavoro: in CI (dove `docs/` è escluso dal repo) si limita
    // a stamparlo, così il passo di audit non fallisce per una cartella che non esiste
    try {
      await writeFile(join(BASE, 'docs/ACCESSIBILITA.md'), rapporto, 'utf8');
      console.log('\nRapporto scritto in docs/ACCESSIBILITA.md');
    } catch {
      console.log('\n(docs/ assente: rapporto non scritto su file, stampato qui sotto)\n');
      console.log(rapporto);
    }
    if (gravi.length) {
      console.error(`\n${gravi.length} violazioni serious/critical: da sistemare.`);
      process.exitCode = 1;
    }
  } finally {
    await contesto.close();
    await browser.close();
    if (server) server.close();
  }
}

await main();
