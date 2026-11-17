// Verifica dei raggruppamenti della pagina «Tutti gli uffici» (js/aree.js):
// 611 uffici, 25 aree, griglia per area e elenco alfabetico devono contenere tutti.
// Uso: node --test tests/test_uffici.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { raggruppaPerArea, elencoAlfabetico, filtra, suggerisci, SENZA_AREA } from '../js/aree.js';

const uffici = JSON.parse(readFileSync(new URL('../data/uffici.json', import.meta.url), 'utf8'));
const confronto = new Intl.Collator('it', { sensitivity: 'base' });

test('la griglia raggruppa tutti gli uffici per area, senza perderne nessuno', () => {
  const gruppi = raggruppaPerArea(uffici);
  const totale = gruppi.reduce((n, g) => n + g.uffici.length, 0);
  assert.equal(totale, uffici.length);
  assert.equal(new Set(gruppi.map(g => g.area)).size, gruppi.length, 'un\'area compare due volte');
  assert.ok(gruppi.length >= 24, `solo ${gruppi.length} aree`);
});

test('le aree sono in ordine alfabetico e «Uffici non collocati» sta in fondo', () => {
  const aree = raggruppaPerArea(uffici).map(g => g.area);
  const senza = aree.filter(a => a === SENZA_AREA);
  assert.ok(senza.length === 1, 'la sezione degli uffici senza area deve essere una sola');
  assert.equal(aree.at(-1), SENZA_AREA, 'gli uffici senza area vanno in fondo');
  const ordinate = aree.slice(0, -1);
  for (let i = 1; i < ordinate.length; i++) {
    assert.ok(confronto.compare(ordinate[i - 1], ordinate[i]) <= 0, `${ordinate[i - 1]} dopo ${ordinate[i]}`);
  }
});

test('dentro ogni area gli uffici sono in ordine alfabetico', () => {
  for (const gruppo of raggruppaPerArea(uffici)) {
    const nomi = gruppo.uffici.map(u => u.nome);
    for (let i = 1; i < nomi.length; i++) {
      assert.ok(confronto.compare(nomi[i - 1], nomi[i]) <= 0, `${gruppo.area}: ${nomi[i - 1]} dopo ${nomi[i]}`);
    }
  }
});

test('l\'elenco alfabetico contiene tutti gli uffici, ordinati per nome', () => {
  const elenco = elencoAlfabetico(uffici);
  assert.equal(elenco.length, uffici.length);
  for (let i = 1; i < elenco.length; i++) {
    assert.ok(confronto.compare(elenco[i - 1].nome, elenco[i].nome) <= 0, `${elenco[i - 1].nome} dopo ${elenco[i].nome}`);
  }
});

test('il filtro cerca in nome, area, settore e competenze', () => {
  assert.equal(filtra(uffici, '').length, uffici.length);
  const tributi = filtra(uffici, 'tributi');
  assert.ok(tributi.length > 0, '«tributi» non trova niente');
  assert.ok(tributi.some(u => u.area === 'Area delle Entrate e dei Tributi Comunali'));

  assert.ok(filtra(uffici, 'mensa').length > 0, '«mensa» deve trovare gli uffici della refezione');
  assert.equal(filtra(uffici, 'parola che non esiste').length, 0);

  // più parole: tutte devono comparire, in qualunque ordine
  const a = filtra(uffici, 'polizia municipale');
  const b = filtra(uffici, 'municipale polizia');
  assert.equal(a.length, b.length);
});

test('il filtro ignora accenti e maiuscole', () => {
  assert.deepEqual(
    filtra(uffici, 'CITTA').map(u => u.id).sort(),
    filtra(uffici, 'città'.normalize('NFC')).map(u => u.id).sort(),
  );
});

// ---------- suggerimenti della ricerca ----------

test('sotto le 3 lettere non si suggerisce niente', () => {
  assert.deepEqual(suggerisci(uffici, ''), []);
  assert.deepEqual(suggerisci(uffici, 'po'), []);
  assert.deepEqual(suggerisci(uffici, '  t '), []);
});

test('con 3 lettere si suggerisce subito l\'area giusta', () => {
  const s = suggerisci(uffici, 'pol');
  assert.ok(s.length > 0, '«pol» non propone nulla');
  assert.equal(s[0].tipo, 'area');
  assert.equal(s[0].area, 'Area della Polizia municipale');
  assert.ok(s[0].numero > 50, 'l\'area deve dire quanti uffici contiene');
});

test('i suggerimenti sono uffici veri, unici e mai le schede «Area»', () => {
  for (const q of ['anagr', 'mensa', 'tributi', 'protocollo', 'edilizia']) {
    const s = suggerisci(uffici, q);
    assert.ok(s.length > 0, `«${q}» non propone nulla`);
    assert.ok(s.length <= 8, `«${q}» propone troppe voci (${s.length})`);
    const id = s.filter(x => x.tipo === 'ufficio').map(x => x.ufficio.id);
    assert.equal(new Set(id).size, id.length, `«${q}» ripete lo stesso ufficio`);
    for (const x of s) {
      if (x.tipo === 'ufficio') {
        assert.notEqual(x.ufficio.livello, 'area', `«${q}» propone una scheda Area`);
        assert.ok(uffici.some(u => u.id === x.ufficio.id));
      }
    }
  }
});

test('il nome dell\'ufficio batte le competenze: «anagrafe» non propone i contratti', () => {
  const s = suggerisci(uffici, 'anagrafe').filter(x => x.tipo === 'ufficio');
  assert.equal(s[0].ufficio.nome, 'U.O. Direzione Anagrafe');
  assert.ok(s.every(x => !/approvvigionamenti/i.test(x.ufficio.nome)));
});

test('una parola corta non pesca all\'interno di un\'altra: «tari» non è «sanitarie»', () => {
  const trovati = filtra(uffici, 'tari');
  assert.ok(trovati.some(u => /TARSU\/TARES\/TARI/i.test(u.nome)), '«tari» deve trovare gli uffici TARI');
  assert.ok(!trovati.some(u => /socio sanitarie/i.test(u.nome)), '«tari» non deve pescare «sanitarie»');
});

test('la scheda non ripete come email un indirizzo che è già PEC', () => {
  for (const u of uffici) {
    const doppioni = (u.email || []).filter(e => (u.pec || []).includes(e));
    assert.deepEqual(doppioni, [], `${u.id}: ${doppioni.join(', ')}`);
  }
});

test('ogni ufficio ha id, nome, area e contatti in forma di elenco', () => {
  for (const u of uffici) {
    assert.ok(u.id && u.nome, `ufficio senza id o nome: ${JSON.stringify(u).slice(0, 80)}`);
    for (const campo of ['telefoni', 'email', 'pec']) {
      assert.ok(Array.isArray(u[campo]), `${u.id}: ${campo} non è un elenco`);
    }
    if (u.coord) assert.equal(u.coord.length, 2, `${u.id}: coordinate non valide`);
  }
});
