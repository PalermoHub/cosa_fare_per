// Controlli statici sul tema chiaro/scuro (js/tema.js + css/pinuzza.css).
//
// Il comportamento vero si verifica nel browser; qui si controlla che non manchino i pezzi:
// un tema che si applica dopo il primo disegno fa un lampo bianco, una pagina senza lo
// script non ha il pulsante, una chiave sbagliata non ricorda la scelta.
//
// Uso: node --test tests/test_tema.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const radice = new URL('../', import.meta.url);
const leggi = percorso => readFileSync(new URL(percorso, radice), 'utf8');
const tema = leggi('js/tema.js');
const css = leggi('css/pinuzza.css');
const PAGINE = ['index.html', 'uffici.html', 'domande.html', 'privacy.html'];

test('ogni pagina applica il tema prima del primo disegno', () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    const script = /<script>(?:(?!<\/script>)[\s\S])*pinuzza-tema[\s\S]*?<\/script>/.exec(html);
    assert.ok(script, `${pagina}: manca lo script in linea che imposta data-theme`);
    // deve stare prima del foglio di stile, altrimenti il primo disegno è già sbagliato
    assert.ok(html.indexOf(script[0]) < html.indexOf('css/pinuzza.css'), `${pagina}: lo script del tema è dopo il CSS`);
    assert.match(script[0], /dataset\.theme/, `${pagina}: lo script non imposta data-theme`);
    assert.match(script[0], /localStorage\.getItem\("pinuzza-tema"\)/, `${pagina}: lo script non legge la scelta salvata`);
    // scelta del committente (17/11/2026): il sito parte in tema chiaro per tutti, non segue
    // `prefers-color-scheme`. Se un giorno si cambia idea, questo test lo ricorda.
    assert.ok(!script[0].includes('prefers-color-scheme'), `${pagina}: il tema di partenza non deve dipendere dal sistema`);
  }
});

test('ogni pagina carica js/tema.js (pulsante e scelta dell\'utente)', () => {
  for (const pagina of PAGINE) {
    assert.match(leggi(pagina), /<script type="module" src="js\/tema\.js"><\/script>/, `${pagina}: manca js/tema.js`);
  }
});

test('la scelta si salva sotto la chiave giusta e non viene sovrascritta', () => {
  assert.ok(tema.includes("const CHIAVE = 'pinuzza-tema'"), 'chiave di memoria diversa da pinuzza-tema');
  assert.ok(tema.includes('localStorage.setItem(CHIAVE'), 'la scelta non viene salvata');
  assert.ok(!tema.includes('matchMedia'), 'il tema non deve seguire il sistema: si parte chiari e vale la scelta salvata');
});

test('sul telefono la stessa scelta si fa dalla barra in basso', () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    assert.match(html, /id="tema-barra"/, `${pagina}: manca la voce del tema nella barra in basso`);
    assert.match(html, /aria-pressed="false"/, `${pagina}: la voce non dichiara lo stato`);
    assert.match(html, /icona-luna/, `${pagina}: manca l'icona del tema scuro`);
    assert.match(html, /icona-sole/, `${pagina}: manca l'icona del tema chiaro`);
  }
  assert.ok(tema.includes("getElementById('tema-barra')"), 'tema.js non collega la voce della barra');
  assert.ok(tema.includes("voce.setAttribute('aria-pressed'"), 'la voce della barra non aggiorna lo stato');
});

test('il tema cambia anche il colore della barra del browser', () => {
  assert.match(tema, /meta\[name="theme-color"\]/, 'manca l\'aggiornamento di theme-color');
  assert.ok(tema.includes('#131210') && tema.includes('#fcfbf7'), 'mancano i due colori della barra');
});

test('il pulsante dichiara lo stato e cosa fa', () => {
  assert.ok(tema.includes("setAttribute('aria-pressed'"), 'manca aria-pressed');
  assert.ok(tema.includes('aria-label'), 'manca l\'etichetta accessibile');
  assert.match(tema, /Tema chiaro|Tema scuro/, 'il pulsante non dice cosa fa');
});

test('il cambio tema sta nella barra del sito, in fondo al menu', () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    const menu = /<nav class="barra-sito"[^>]*>[\s\S]*?<\/nav>/.exec(html);
    assert.ok(menu, `${pagina}: manca il menu della barra del sito`);
    assert.match(menu[0], /<button type="button" class="tema-menu" id="tema"/, `${pagina}: il pulsante del tema non è nel menu`);
    // il pulsante è l'ultimo comando del menu, dopo le voci delle pagine
    assert.ok(menu[0].indexOf('id="tema"') > menu[0].indexOf('href="privacy.html"'), `${pagina}: il pulsante deve venire dopo le voci`);
    // niente più costruzione da JavaScript: il pulsante sta nel markup di ogni pagina
    assert.ok(!tema.includes('createElement'), 'il pulsante non va costruito da JavaScript');
    assert.ok(!tema.includes('inserisciNelPiede'), 'non deve restare l\'inserimento nel piede');
  }
  const stile = leggi('css/pinuzza.css');
  assert.match(stile, /\.tema-menu[^{}]*\{[^}]*border-radius: 50%/, 'il pulsante deve essere tondo');
  assert.match(stile, /\.tema-menu[^{}]*\{[^}]*align-self: center/, 'il pulsante va centrato nella barra');
});

test('il pulsante mostra la sola icona e tiene il nome per i lettori di schermo', () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    const pulsante = /<button type="button" class="tema-menu"[\s\S]*?<\/button>/.exec(html);
    assert.ok(pulsante, `${pagina}: manca il pulsante del tema`);
    assert.match(pulsante[0], /<span class="nascosto">Tema scuro<\/span>/, `${pagina}: la parola deve essere nascosta a video, non cancellata`);
    assert.match(pulsante[0], /aria-label="Passa al tema scuro/, `${pagina}: manca il nome accessibile`);
    assert.match(pulsante[0], /aria-pressed="false"/, `${pagina}: il pulsante non dichiara lo stato`);
  }
});

test('aggiornare la parola non deve cancellare le icone', () => {
  const funzione = /function aggiornaPulsante\(\)[\s\S]*?\n\}/.exec(tema);
  assert.ok(funzione, 'non trovo aggiornaPulsante');
  assert.ok(!/pulsante\.textContent\s*=/.test(funzione[0]) || funzione[0].includes('if (parola)'),
    'aggiornaPulsante deve scrivere nella sola <span>, altrimenti perde le icone');
  assert.ok(funzione[0].includes("querySelector('span')"), 'la parola va cercata nella span');
});



test('sul telefono la barra del sito non si mostra (c\'è quella in basso)', () => {
  const stile = leggi('css/pinuzza.css');
  assert.match(stile, /@media \(max-width: 40rem\)[\s\S]*\.barra-sito \{ display: none; \}/, 'manca la regola mobile della barra del sito');
});
