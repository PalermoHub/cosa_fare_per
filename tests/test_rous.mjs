// Verifica dell'ambito ROUS: le domande scritte con parole diverse da quelle preparate devono
// trovare la voce giusta, i testi citati devono esistere, le domande fuori tema non rispondono.
// Uso: node --test tests/test_rous.mjs   (fa parte di npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indicizzaRous, filtroRous, cerca, cercaSezioni, cercaArticoli, SOGLIA_SICURA, SOGLIA_MINIMA } from '../js/motore.js';

const leggi = f => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const rous = leggi('rous.json');
const articoli = leggi('rous-articoli.json');
const uffici = new Set(leggi('uffici.json').map(u => u.id));
const indice = rous.voci.map(indicizzaRous);
const primo = domanda => cerca(indice, domanda, 3, filtroRous);

// domanda scritta da un utente (non è tra quelle preparate) -> voce attesa
const CASI = [
  ['quanti giorni di smart working posso fare', 'rous-lavoro-agile-giorni-orari'],
  ['lavoro agile se ho un figlio di 8 anni', 'rous-lavoro-agile-priorita'],
  ['come chiedo il part time', 'rous-part-time-domanda'],
  ['entro quando va presentata la richiesta di tempo parziale', 'rous-part-time-domanda'],
  ['con il part time al 50% posso lavorare anche altrove', 'rous-part-time-secondo-lavoro'],
  ['devo chiedere il permesso per fare la consulenza fuori dal comune', 'rous-incarichi-autorizzazione'],
  ['posso fare volontariato senza autorizzazione', 'rous-incarichi-senza-autorizzazione'],
  ['quante ore di permesso per studiare ho', 'rous-permessi-studio'],
  ['serve l inglese al concorso', 'rous-concorso-lingue-informatica'],
  ['come si presenta la domanda per un concorso', 'rous-concorso-bando-domanda'],
  ['quanti anni devo avere per un concorso comunale', 'rous-concorso-requisiti'],
  ['punteggio minimo per l orale del concorso', 'rous-concorso-prove'],
  ['quanto vale la graduatoria dopo il concorso', 'rous-concorso-graduatoria'],
  ['chi nomina i commissari del concorso', 'rous-concorso-commissione'],
  ['i volontari delle forze armate hanno una riserva di posti', 'rous-concorso-riserve-preferenze'],
  ['quanto dura il comando presso un altro ente', 'rous-comando'],
  ['come si passa da un ente all altro con la mobilita', 'rous-mobilita-esterna'],
  ['chi avvia il procedimento disciplinare', 'rous-procedimento-disciplinare'],
  ['elenco delle sanzioni disciplinari', 'rous-sanzioni-disciplinari'],
  ['si possono accettare regali dai cittadini', 'rous-codice-regali'],
  ['quando devo astenermi per conflitto di interessi', 'rous-codice-conflitto-astensione'],
  ['che differenza c e tra capo area e dirigente di settore', 'rous-capo-area-dirigenti'],
  ['chi sostituisce il segretario generale', 'rous-segretario-generale'],
  ['chi fa parte del comitato di direzione', 'rous-direttore-generale'],
  ['cos e il cug', 'rous-cug'],
  ['chi sono i componenti dell oiv', 'rous-oiv'],
  ['controlli antimafia sugli appalti', 'rous-antimafia'],
  ['parere della commissione di vigilanza per un concerto', 'rous-spettacolo-commissione'],
  ['supplenze nelle scuole dell infanzia comunali', 'rous-unita-didattiche'],
  ['chi controlla che i dipendenti non facciano secondi lavori', 'rous-ufficio-ispettivo'],
  ['cosa e il piano della performance', 'rous-performance'],
  ['progressione verticale requisiti', 'rous-progressioni-verticali'],
];

// con refusi
const CASI_REFUSO = [
  ['come chiedo il part tiem', 'rous-part-time-domanda'],
  ['permessi per studiao', 'rous-permessi-studio'],
  ['procedimento disciplinre', 'rous-procedimento-disciplinare'],
  ['graduatora del concorso', 'rous-concorso-graduatoria'],
];

// una domanda con due richieste: la principale e quella «anche»
const CASI_DUE = [
  ['come chiedo il part time e quanti giorni di smart working posso fare', ['rous-part-time-domanda', 'rous-lavoro-agile-giorni-orari']],
  ['quanti anni servono per il concorso e quando scade la domanda', ['rous-concorso-requisiti', 'rous-concorso-bando-domanda']],
  ['quanto dura il comando presso un altro ente e quali sono le sanzioni disciplinari', ['rous-comando', 'rous-sanzioni-disciplinari']],
];

const FUORI_TEMA = ['come cambio residenza', 'ricetta della pasta con le sarde', 'come si aggiusta un frigorifero', 'quale è il colore preferito di pinuzza', 'orari della biblioteca comunale'];

test('ogni voce ROUS ha domande, fonti esistenti e uffici esistenti', () => {
  for (const v of rous.voci) {
    assert.ok(v.domande.length >= 5, `${v.id}: poche domande`);
    assert.ok(v.risposta?.sintesi, `${v.id}: manca la sintesi`);
    assert.ok(v.fonte?.length, `${v.id}: manca la fonte`);
    for (const f of v.fonte) {
      if (f.id) assert.ok(articoli[f.id], `${v.id}: articolo inesistente ${f.id}`);
      assert.ok(rous.documenti[f.doc], `${v.id}: documento ${f.doc}`);
    }
    for (const u of v.uffici || []) assert.ok(uffici.has(u), `${v.id}: ufficio inesistente ${u}`);
    assert.ok(v.link.some(l => l.url === rous.pdf), `${v.id}: manca il link ai PDF originali`);
  }
});

test('nessuna domanda preparata compare in due voci e ognuna trova la propria voce', () => {
  const viste = new Map();
  const falliti = [];
  for (const v of rous.voci) {
    for (const d of v.domande) {
      assert.ok(!viste.has(d), `domanda duplicata: ${d}`);
      viste.set(d, v.id);
      if (primo(d)[0]?.indice.voce.id !== v.id) falliti.push(d);
    }
  }
  assert.deepEqual(falliti, []);
});

test('le domande scritte con altre parole trovano la voce giusta', () => {
  const falliti = [];
  for (const [domanda, atteso] of CASI) {
    const r = primo(domanda);
    if (r[0]?.indice.voce.id !== atteso || r[0].punteggio < SOGLIA_SICURA) {
      falliti.push({ domanda, atteso, trovati: r.map(x => [x.indice.voce.id, +x.punteggio.toFixed(1)]) });
    }
  }
  if (falliti.length) console.error(JSON.stringify(falliti, null, 1));
  assert.equal(falliti.length, 0, `${falliti.length}/${CASI.length} domande senza la risposta giusta`);
});

test('un refuso non cambia la risposta ROUS', () => {
  for (const [domanda, atteso] of CASI_REFUSO) {
    assert.equal(primo(domanda)[0]?.indice.voce.id, atteso, domanda);
  }
});

test('una domanda con due richieste trova anche la seconda voce', () => {
  for (const [domanda, [prima, seconda]] of CASI_DUE) {
    const principale = primo(domanda)[0].indice.voce.id;
    assert.ok([prima, seconda].includes(principale), `${domanda}: principale ${principale}`);
    const altra = principale === prima ? seconda : prima;
    const anche = cercaSezioni(indice, domanda, { esclusa: principale, quante: 2, filtro: filtroRous });
    assert.ok(anche.some(a => a.voce.id === altra), `${domanda}: manca ${altra}`);
  }
});

test('le domande fuori tema non hanno una risposta ROUS pronta', () => {
  for (const q of FUORI_TEMA) {
    const r = primo(q);
    assert.ok(r.length === 0 || r[0].punteggio < SOGLIA_SICURA, `«${q}» risponde con ${r[0]?.indice.voce.id} (${r[0]?.punteggio.toFixed(1)})`);
  }
});

test('la ricerca sul testo degli articoli riporta l\'articolo vero', () => {
  const r = cercaArticoli(articoli, 'giornata formativa pausa pranzo rientro del mercoledì', 3);
  assert.ok(r.length > 0, 'nessun articolo');
  assert.equal(r[0].id, 'rous-a8-art-5');
  assert.deepEqual(cercaArticoli(articoli, 'ricetta della pasta con le sarde', 3), []);
});
