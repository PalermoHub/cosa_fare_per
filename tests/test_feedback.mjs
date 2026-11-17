// Controlli statici sul feedback «Ti è stato utile?» (P1.6 di docs/DA_FARE.md).
//
// Le regole che non devono rompersi: nessun backend, nessun dato personale nella segnalazione,
// eventi aggregati solo con consenso già dato, e tutto funziona anche con Analytics rifiutato.
//
// Uso: node --test tests/test_feedback.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const radice = new URL('../', import.meta.url);
const leggi = percorso => readFileSync(new URL(percorso, radice), 'utf8');
const app = leggi('js/app.js');
const consenso = leggi('js/consenso.js');

test('il feedback c\'è sotto ogni risposta con una voce', () => {
  assert.match(app, /async function rispostaSicura\(voce, domanda\)/);
  assert.match(app, /async function rispostaIncerta\(voce, domanda, alternative\)/);
  assert.equal((app.match(/frammento\.append\(bloccoUtile\(voce, domanda\)\)/g) || []).length, 2, 'il blocco deve stare in entrambe le risposte');
  assert.match(app, /'Ti è stato utile\?'/);
  assert.match(app, /'Sì, grazie'/);
  assert.match(app, /'No, la risposta è sbagliata'/);
});

test('la segnalazione va su GitHub con etichetta, titolo e testo precompilati', () => {
  assert.match(app, /https:\/\/github\.com\/PalermoHub\/cosa_fare_per\/issues\/new/);
  assert.match(app, /labels: 'segnalazione'/);
  assert.match(app, /title: `\[Risposta\] \$\{voce\.id\}`/);
  assert.match(app, /Voce: \$\{voce\.id\}/);
  assert.match(app, /Domanda: \$\{domanda\}/);
});

test('la segnalazione non porta con sé dati personali', () => {
  const funzione = /function urlSegnalazione\(voce, domanda\) \{[\s\S]*?\n\}/.exec(app);
  assert.ok(funzione, 'non trovo urlSegnalazione');
  for (const vietato of ['navigator.userAgent', 'location.href', 'userId', 'email', 'userAgent', 'localStorage']) {
    assert.ok(!funzione[0].includes(vietato), `urlSegnalazione non deve usare ${vietato}`);
  }
});

test('gli eventi aggregati partono solo con consenso già dato', () => {
  const funzione = /function registraEvento\([\s\S]*?\n\}/.exec(app);
  assert.ok(funzione, 'non trovo registraEvento in js/app.js');
  assert.match(funzione[0], /scelta !== 'accettato'/);
  assert.ok(funzione[0].includes("localStorage.getItem('pinuzza-consenso')"), 'chiave del consenso sbagliata');
  assert.ok(funzione[0].includes("window.gtag('event'"), 'non chiama gtag');
  assert.match(app, /registraEvento\('risposta_utile', \{ voce_id: voce\.id \}\)/);
  assert.match(app, /registraEvento\('risposta_non_utile', \{ voce_id: voce\.id \}\)/);
});

test('app.js non importa nulla da consenso.js (cache mista = app rotta)', () => {
  assert.ok(!/import \{[^}]*\} from '\.\/consenso\.js'/.test(app), 'app.js non deve importare da consenso.js');
  assert.match(consenso, /export function leggiScelta/, 'consenso.js deve esportare leggiScelta');
});

test('il feedback funziona anche senza statistiche (nessuna dipendenza da gtag)', () => {
  // il clic su «No» apre la finestra prima di qualsiasi evento, e non lo aspetta
  const no = /no\.addEventListener\('click'[\s\S]*?\n  \}\);/.exec(app);
  assert.ok(no, 'non trovo il gestore del «No»');
  assert.ok(no[0].indexOf('window.open') < no[0].indexOf('registraEvento'), 'la finestra va aperta prima dell\'evento');
  assert.ok(!/await/.test(no[0]), 'il gestore non deve essere asincrono: il popup verrebbe bloccato');
  // con `noopener` window.open restituisce null: non si distingue «bloccata» da «aperta»
  assert.ok(no[0].includes("window.open('about:blank', '_blank')"), 'la finestra deve aprirsi su about:blank e poi navigare');
  assert.ok(no[0].includes('finestra.opener = null'), 'la segnalazione va aperta senza opener');
});

test('i due pulsanti sono raggiungibili e il gruppo è etichettato', () => {
  assert.match(app, /riquadro\.setAttribute\('role', 'group'\)/);
  assert.match(app, /aria-labelledby/);
  assert.match(app, /esito\.setAttribute\('role', 'status'\)/);
});

test('la privacy racconta cosa succede cliccando «Sì» e «No»', () => {
  const privacy = leggi('privacy.html');
  assert.match(privacy, /Ti è stato utile\?/);
  assert.match(privacy, /risposta_utile/);
  assert.match(privacy, /voce_id=cie/);
  assert.match(privacy, /modificarlo prima di inviarlo/);
  assert.match(privacy, /nessun nome, nessuna email/i);
});
