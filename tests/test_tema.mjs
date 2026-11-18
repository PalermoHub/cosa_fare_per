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
const PAGINE = ['index.html', 'uffici.html', 'domande.html', 'privacy.html', 'salvati.html', 'guida.html'];

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

test('la scelta si salva sotto le chiavi giuste e non segue il sistema', () => {
  assert.ok(tema.includes("const CHIAVE = 'pinuzza-tema'"), 'chiave di memoria diversa da pinuzza-tema');
  assert.ok(tema.includes("'pinuzza-tema-colori'"), 'manca la chiave dei colori personalizzati');
  assert.ok(tema.includes("'pinuzza-testo'"), 'manca la chiave della dimensione del testo');
  assert.ok(tema.includes('localStorage.setItem(chiave'), 'la scelta non viene salvata');
  assert.ok(!tema.includes('matchMedia'), 'il tema non deve seguire il sistema: si parte chiari e vale la scelta salvata');
});

test('lo script in linea applica anche dimensione del testo e tema personalizzato, con controlli sui valori', () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    const script = /<script>(?:(?!<\/script>)[\s\S])*pinuzza-tema[\s\S]*?<\/script>/.exec(html)[0];
    assert.match(script, /pinuzza-testo/, `${pagina}: lo script non legge la dimensione del testo`);
    assert.match(script, /pinuzza-tema-colori/, `${pagina}: lo script non legge i colori personalizzati`);
    // dalla memoria entrano solo nomi di variabile e valori attesi: niente stringhe arbitrarie nello stile
    assert.match(script, /\^--\[a-z-\]\+\$/, `${pagina}: le variabili lette dalla memoria non sono filtrate`);
    for (const id of ['seppia', 'salvia', 'mare', 'notte', 'bosco', 'contrasto', 'contrasto-chiaro', 'blu-arancio', 'rosso-petrolio']) {
      assert.ok(script.includes(id), `${pagina}: lo script non conosce il tema ${id}`);
    }
  }
});

test('i temi curati hanno nome, campioni e valori uguali a quelli del CSS', () => {
  const dichiarati = [...tema.matchAll(/\{ id: '([\w-]+)', nome: '([^']+)', campioni: \['(#\w+)', '(#\w+)', '(#\w+)'\] \}/g)];
  assert.deepEqual(dichiarati.map(m => m[1]), ['chiaro', 'scuro', 'seppia', 'salvia', 'mare', 'notte', 'bosco', 'contrasto', 'contrasto-chiaro', 'blu-arancio', 'rosso-petrolio'], 'temi curati diversi dagli undici attesi');
  for (const [, id, , sfondo, testo, accento] of dichiarati) {
    const selettore = id === 'chiaro' ? ':root' : `\\[data-theme="${id}"\\]`;
    const blocco = new RegExp(`${selettore}\\s*\\{([^}]*)\\}`).exec(css)[1];
    const valore = nome => new RegExp(`${nome}:\\s*(#\\w+)`).exec(blocco)[1].toLowerCase();
    assert.equal(valore('--carta'), sfondo, `${id}: lo sfondo del campione non coincide con --carta`);
    assert.equal(valore('--inchiostro'), testo, `${id}: il testo del campione non coincide con --inchiostro`);
    assert.equal(valore('--accento'), accento, `${id}: l'accento del campione non coincide con --accento`);
  }
});

test('il tema cambia anche il colore della barra del browser', () => {
  assert.match(tema, /meta\[name="theme-color"\]/, 'manca l\'aggiornamento di theme-color');
  assert.ok(tema.includes("colore('--carta')"), 'la barra deve prendere il colore della carta del tema in uso');
});

test('il comando Aspetto apre un pannello, dichiara cosa fa e non perde il nome accessibile', () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    const pulsante = /<button type="button" class="tema-menu"[\s\S]*?<\/button>/.exec(html);
    assert.ok(pulsante, `${pagina}: manca il pulsante dell'aspetto`);
    assert.match(pulsante[0], /aria-haspopup="dialog"/, `${pagina}: il pulsante non dichiara che apre un pannello`);
    assert.match(pulsante[0], /aria-label="Aspetto del sito/, `${pagina}: manca il nome accessibile`);
    assert.match(pulsante[0], /<span class="nascosto">Aspetto<\/span>/, `${pagina}: la parola deve essere nascosta a video, non cancellata`);
    const voce = /<button type="button" class="altre-tema" id="tema-barra"[\s\S]*?<\/button>/.exec(html);
    assert.ok(voce, `${pagina}: manca la voce Aspetto nel pannello «Altro»`);
    assert.match(voce[0], /data-tema-parola/, `${pagina}: la voce non dice il tema in uso`);
  }
  for (const frammento of ['type: \'radio\'', "type: 'color'", 'role: \'status\'', 'showModal', 'data-testo-meno', 'data-testo-piu']) {
    assert.ok(tema.includes(frammento), `nel pannello manca: ${frammento}`);
  }
});

test('la dimensione del testo ha cinque livelli e scala tutto', () => {
  assert.match(tema, /PASSI_TESTO = \['90%', '100%', '115%', '130%', '150%'\]/, 'livelli diversi dai cinque attesi');
  for (const n of [0, 2, 3, 4]) assert.match(css, new RegExp(`html\\[data-testo="${n}"\\]\\s*\\{\\s*font-size: \\d+%`), `manca la regola per il livello ${n}`);
  assert.ok(!/(^|[^-])html\s*\{[^}]*font-size:\s*\d+px/m.test(css), 'html non deve avere una dimensione in px: bloccherebbe la scala');
});

test('sul telefono la barra del sito non si mostra (c\'è quella in basso)', () => {
  const stile = leggi('css/pinuzza.css');
  assert.match(stile, /@media \(max-width: 40rem\)[\s\S]*\.barra-sito \{ display: none; \}/, 'manca la regola mobile della barra del sito');
});
