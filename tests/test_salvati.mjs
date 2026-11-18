// Controlli statici sulle risposte salvate (js/salvati.js, js/salvati-pagina.js, salvati.html).
//
// Le regole che non devono rompersi: l'elenco sta solo nella memoria del browser (nessun
// invio, nessun backend), si può togliere voce per voce o tutto, la pagina si apre anche
// senza rete e nessuna pagina perde i collegamenti all'elenco.
//
// Uso: node --test tests/test_salvati.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const radice = new URL('../', import.meta.url);
const leggi = percorso => readFileSync(new URL(percorso, radice), 'utf8');
const esiste = percorso => existsSync(new URL(percorso, radice));

const modulo = leggi('js/salvati.js');
const paginaJs = leggi('js/salvati-pagina.js');
const app = leggi('js/app.js');
const pagina = leggi('salvati.html');
const sw = leggi('sw.js');
const privacy = leggi('privacy.html');
const sitemap = leggi('sitemap.xml');

test('l’elenco ha una chiave sola e un tetto di voci', () => {
  assert.ok(modulo.includes("export const CHIAVE = 'pinuzza-salvati'"), 'chiave di memoria diversa da pinuzza-salvati');
  assert.match(modulo, /export const MASSIMO = \d+/);
  assert.ok(modulo.includes('localStorage.setItem(CHIAVE'), 'l’elenco non viene mai scritto');
  assert.ok(modulo.includes('localStorage.getItem(CHIAVE)'), 'l’elenco non viene mai letto');
  // si salvano codici e testo, non l'HTML della risposta
  assert.ok(!/innerHTML/.test(modulo) && !/innerHTML/.test(paginaJs), 'il contenuto va costruito come testo, mai come HTML');
});

test('un elenco illeggibile o una memoria bloccata non rompono l’app', () => {
  assert.match(modulo, /try \{\s*grezzo = localStorage\.getItem/, 'la lettura non è protetta');
  assert.match(modulo, /JSON\.parse\(grezzo\)[\s\S]{0,120}catch/, 'il JSON rotto non è gestito');
  assert.match(modulo, /catch \(errore\) \{\s*return \[\];/, 'con la memoria bloccata si deve partire da un elenco vuoto');
  assert.match(modulo, /function scrivi\(elenco\) \{[\s\S]*?catch \(errore\) \{\s*return false;/, 'la scrittura non dice quando fallisce');
});

test('salvare non manda niente a nessuno', () => {
  for (const [nome, testo] of [['js/salvati.js', modulo], ['js/salvati-pagina.js', paginaJs]]) {
    for (const vietato of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'gtag(', 'new Image(']) {
      assert.ok(!testo.includes(vietato), `${nome}: non deve usare ${vietato}`);
    }
  }
});

test('il comando sta in fondo alla scheda, dopo «ti è stato utile?»', () => {
  assert.match(app, /import \{[^}]*\} from '\.\/salvati\.js'/);
  const risposta = /async function rispostaSicura\(voce, domanda\) \{[\s\S]*?\n\}/.exec(app);
  assert.ok(risposta, 'non trovo rispostaSicura');
  const utile = risposta[0].indexOf('bloccoUtile(voce, domanda)');
  const salva = risposta[0].indexOf('bloccoSalva(voce, domanda)');
  assert.ok(utile > 0 && salva > utile, 'il comando «Salva» deve venire dopo il feedback');
  assert.match(app, /'Salva questa risposta'/);
  assert.match(app, /href = 'salvati\.html'/);
  assert.match(app, /Non riesco a salvare su questo dispositivo/, 'va detto quando la memoria è piena o bloccata');
  assert.match(app, /annuncia\(/, 'il salvataggio va annunciato ai lettori di schermo');
});

test('la pagina dell’elenco esiste, non si indicizza e si apre da sola', () => {
  assert.ok(esiste('salvati.html'));
  assert.match(pagina, /<meta name="robots" content="noindex, follow">/);
  assert.match(pagina, /<h1 class="titolo-pagina"/);
  assert.match(pagina, /id="elenco-salvati"/);
  assert.match(pagina, /id="svuota-salvati"/);
  assert.match(pagina, /id="stato-salvati" role="status"/);
  assert.match(pagina, /<script type="module" src="js\/salvati-pagina\.js"><\/script>/);
  assert.match(pagina, /href="salvati\.html" aria-current="page"/);
  // una pagina personale non ha senso nella sitemap
  assert.ok(!sitemap.includes('salvati.html'), 'salvati.html non deve stare nella sitemap');
});

test('l’elenco si può svuotare, con una conferma prima di cancellare', () => {
  assert.match(paginaJs, /elencoSalvati\(\)/, 'la pagina non legge l’elenco');
  assert.match(paginaJs, /conferma-svuota/, 'manca la conferma in linea');
  assert.match(paginaJs, /'Sì, togli tutto'/);
  assert.match(paginaJs, /'Annulla'/);
  assert.match(paginaJs, /svuota\(\)/, 'la conferma non svuota');
  assert.match(paginaJs, /'Togli'/, 'manca il comando per la singola voce');
  assert.match(paginaJs, /index\.html\?q=\$\{encodeURIComponent\(voce\.domanda\)\}/, 'manca il rimando alla risposta');
  assert.match(paginaJs, /querySelector\('\.salvata-togli'\) \|\| titoloPagina/, 'dopo «Togli» il focus deve andare da qualche parte');
});

test('ogni pagina porta all’elenco, dal menu largo, dal piede e dal telefono', () => {
  for (const file of ['index.html', 'uffici.html', 'domande.html', 'privacy.html', 'salvati.html', 'guida.html']) {
    const html = leggi(file);
    const menu = /<nav class="barra-sito"[^>]*>[\s\S]*?<\/nav>/.exec(html);
    assert.ok(menu, `${file}: manca il menu del sito`);
    assert.ok(menu[0].includes('href="salvati.html"'), `${file}: «Salvate» non sta nel menu`);
    const piede = /<nav class="piede-voci"[^>]*>[\s\S]*?<\/nav>/.exec(html);
    assert.ok(piede, `${file}: manca il piede`);
    assert.ok(piede[0].includes('href="salvati.html"'), `${file}: manca «Risposte salvate» nel piede`);
    assert.match(html, /data-voce-salvati/, `${file}: manca la voce nella barra in basso`);
  }
});

test('la voce del telefono e la pillola della home compaiono solo se c’è qualcosa', () => {
  for (const file of ['index.html', 'uffici.html', 'domande.html', 'privacy.html']) {
    const voce = /<a class="voce" href="salvati\.html" data-voce-salvati hidden>/.exec(leggi(file));
    assert.ok(voce, `${file}: la voce «Salvate» deve partire nascosta`);
  }
  assert.match(leggi('index.html'), /data-scorciatoia-salvati hidden/);
  assert.match(modulo, /nodo\.hidden = quanti === 0/);
  assert.match(modulo, /'1 risposta' : `\$\{quanti\} risposte`/);
  // nella pagina delle salvate la voce si vede sempre
  assert.match(modulo, /classList\.contains\('pagina-salvati'\)/);
});

test('la pagina e i moduli nuovi stanno nel guscio offline', () => {
  const elenco = /const PRECACHE = \[([\s\S]*?)\];/.exec(sw)[1];
  for (const file of ['salvati.html', 'js/salvati.js', 'js/salvati-pagina.js']) {
    assert.ok(elenco.includes(`'${file}'`), `${file} non è nella precache del service worker`);
    assert.ok(esiste(file), `manca il file ${file}`);
  }
});

test('l’informativa racconta cosa si salva, dove e come si cancella', () => {
  assert.ok(privacy.includes('<code>pinuzza-salvati</code>'), 'manca la chiave nella tabella della memoria locale');
  assert.match(privacy, /Le risposte salvate/);
  assert.match(privacy, /Resta sul tuo dispositivo/);
  assert.match(privacy, /Togli tutte le risposte salvate/);
  // non deve più dire che in localStorage c'è solo la scelta sulle statistiche
  assert.ok(!privacy.includes('salva soltanto la tua scelta sull\'avviso delle statistiche'), 'l’informativa è rimasta indietro');
});
