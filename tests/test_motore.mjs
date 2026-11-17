// Verifica del motore: le domande tipiche del cittadino devono trovare la voce giusta.
// Uso: node --test tests/test_motore.mjs   (oppure npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indicizza, cerca, cercaSezioni, cercaUffici, normalizza, parole, sezioniDomanda, suggerimenti, SOGLIA_MINIMA, SOGLIA_SICURA } from '../js/motore.js';

const leggi = f => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const servizi = Object.fromEntries(leggi('servizi.json').map(s => [s.id, s]));
const argomenti = leggi('argomenti.json').voci;
const uffici = leggi('uffici.json');
const indice = argomenti.map(v => indicizza(v, servizi));

// domanda del cittadino -> id accettati (il primo è quello atteso)
const CASI = [
  ["come faccio la carta d'identità", ['cie']],
  ["devo rinnovare il documento di identità", ['cie']],
  ["la carta d'identità è scaduta", ['cie']],
  ['ho perso la tessera elettorale', ['tessera-elettorale']],
  ['mi hanno rubato la tessera elettorale', ['tessera-elettorale']],
  ['quando devo dichiarare la nascita di mio figlio', ['nascita']],
  ['è morto mio nonno cosa devo fare', ['morte']],
  ['come mi sposo in comune', ['matrimonio-civile']],
  ['unioni civili come si fanno', ['matrimonio-civile']],
  ['divorzio senza avvocato davanti al sindaco', ['separazione-divorzio']],
  ['come ottengo la cittadinanza italiana', ['cittadinanza']],
  ['sono straniero e devo prendere la residenza', ['stranieri']],
  ['come iscrivo mio figlio al nido', ['nidi']],
  ['graduatoria asilo nido', ['nidi']],
  ['quanto costa la mensa scolastica', ['mensa']],
  ['iscrizione scuolabus', ['trasporto-scolastico']],
  ['mio figlio disabile a scuola che assistenza ha', ['assistenza-disabili-scuola']],
  ['libri di testo gratis per la primaria', ['libri-cedole']],
  ['non ho soldi posso avere un bonus dal comune', ['bonus-sociali']],
  ['assistenza domiciliare per mia madre anziana', ['anziani']],
  ['come ottengo il contrassegno disabili', ['contrassegno-disabili']],
  ['certificato di idoneità alloggiativa', ['idoneita-alloggiativa']],
  ["non riesco a pagare l'affitto", ['contributo-affitto']],
  ['devo iscrivere la tari per la nuova casa', ['richiedere-iscrizione-tari']],
  ['come chiudo la tari se lascio la casa', ['richiedere-cessazione-tari']],
  ['come si calcola l imu', ['imu']],
  ['quanto devo pagare di imu per la seconda casa', ['imu']],
  ['imposta di soggiorno per il bed and breakfast', ['imposta-soggiorno']],
  ['come partecipo al bando per la casa popolare', ['casa-popolare']],
  ['la spazzatura non viene ritirata', ['rifiuti']],
  ['discarica abusiva in strada', ['rifiuti']],
  ['un albero pericolante in piazza', ['verde']],
  ['amianto sul tetto del capannone', ['amianto']],
  ["c'è allerta meteo cosa devo fare", ['protezione-civile']],
  ['un palazzo pericolante in centro', ['edilizia-pericolante']],
  ['c è una buca in strada', ['strade']],
  ['il lampione davanti casa è spento', ['strade']],
  ['come faccio per un loculo al cimitero', ['cimiteri']],
  ['ho trovato un cane randagio', ['canile']],
  ["perdita d'acqua in strada", ['idrico']],
  ['occupazione suolo pubblico per una festa', ['occupazione-suolo']],
  ['come ottengo un posteggio al mercato', ['mercati']],
  ['come prendo la licenza taxi', ['taxi']],
  ['insegna del negozio serve autorizzazione', ['pubblicita']],
  ['ci sono concorsi al comune', ['concorsi']],
  ['orari biblioteca comunale', ['biblioteche']],
  ['prenotare il campo di calcio', ['impianti-sportivi']],
  ['patrocinio del sindaco per un evento', ['patrocinio']],
  ['voglio fare un reclamo al comune', ['urp']],
  ["come consegno un'istanza al protocollo", ['protocollo']],
  ['certificato di avvenuta pubblicazione albo pretorio', ['albo-pretorio']],
  ['segnalazione whistleblowing', ['trasparenza']],
  ['esproprio del mio terreno per una strada', ['espropri']],
  ['posso affittare un locale comunale', ['immobili-comunali']],
  ['numero del centralino del comune', ['numeri-utili']],
  ['come cambio residenza', ['dichiarazione-di-cambio-indirizzo-o-abitazione']],
  ['autocertificazione di residenza', ['autocertificazioni-anpr']],
  ['certificato di stato di famiglia', ['certificati-anagrafici']],
  ['come chiedo il passo carrabile', ['richiedere-permesso-per-passo-carrabile-2']],
  ['permesso per entrare in ztl', ['richiedere-permesso-di-accesso-ad-area-ztl-31']],
  ['come pago una multa', ['pagare-contravvenzioni-2']],
  ['mi è arrivata una multa ma non ero io alla guida', ['comunicazione-dati-conducente']],
  ['cila per ristrutturare casa', ['sportello-unico-per-edilizia']],
  ['come apro un negozio', ['sportello-unico-attivita-produttive']],
  ['come chiedo l accesso agli atti', ['accesso-agli-atti-civico-semplice-e-generalizzato']],
  ['contributo per i libri di scuola', ['richiedere-agevolazioni-scolastiche-4']],
  ['come faccio lo scrutatore alle elezioni', ['iscrizione-albo-scrutatori-di-seggio']],
  ['parcheggio per invalidi', ['contrassegno-disabili', 'parcheggio-invalidi']],
  ['pass h', ['contrassegno-disabili']],
  ['come pago il canone unico per il passo carrabile', ['pagare-canone-unico-patrimoniale']],
  ['ho perso il portafoglio', ['oggetti-smarriti']],
  ['ho trovato un portafoglio per strada', ['oggetti-smarriti']],
  ['come faccio ricorso al prefetto per una multa', ['ricorso-prefetto']],
  ['voglio contestare un verbale della polizia municipale', ['ricorso-prefetto']],
  ['come fare un patto di collaborazione', ['patto-di-collaborazione']],
  ['voglio curare con il comune una piazza o un aiuola', ['patto-di-collaborazione']],
  ['certificato di destinazione urbanistica', ['certificato-di-destinazione-urbanistica']],
  ['come si richiede il certificato di destinazione urbanistica', ['certificato-di-destinazione-urbanistica']],
  ['posso cambiare la targa del pass h temporaneamente', ['sostituzione-targa-pass-h']],
  ['come comunico la nuova targa del contrassegno in ztl', ['sostituzione-targa-pass-h']],
  ['auto sostitutiva con il contrassegno disabili', ['sostituzione-targa-pass-h', 'contrassegno-disabili']], // frase ambigua: vanno bene entrambe
  ['chi può richiedere il permesso di parcheggio per residenti', ['richiedere-permesso-di-parcheggio-per-residenti']],
  ['come faccio a sapere se è arrivato il condono edilizio', ['condono-edilizio-abusivismo']],
  ['come segnalo un abuso edilizio nel palazzo accanto', ['condono-edilizio-abusivismo']],
  ['come segnalo una pista ciclabile pericolosa', ['piste-ciclabili-mobilita-sostenibile']],
  ['dove trovo il piano urbano della mobilità sostenibile', ['piste-ciclabili-mobilita-sostenibile']],
  ['non mi hanno ancora pagato la fattura', ['pagamenti-ai-fornitori']],
  ['dove trovo i dati aperti del comune', ['open-data']],
  ['quali progetti pnrr ha il comune di palermo', ['fondi-europei-pnrr']],
  ['come faccio a ottenere lo spid', ['spid-identita-digitale']],
  ['come faccio il passaporto', ['passaporto']],
  ['iscrizione aire come si fa', ['aire-residenza-estero']],
  ['posso pagare la multa a rate', ['rateizzazione-multe-cartelle']],
  ['come faccio ricorso contro una sanzione amministrativa', ['ricorso-sanzioni-amministrative']],
  ['mi hanno portato via la macchina con il carro attrezzi', ['rimozione-forzata-recupero-veicolo']],
  ['certificato storico di residenza', ['certificati-anagrafici']],
  ['tari per chi vive da solo', ['agevolazione-riduzione-esenzione-tari']],
  ['il pass h è scaduto come lo rinnovo', ['contrassegno-disabili']],
  ['come apro un edicola', ['edicole-fiorai-chioschi']],
  ['voglio fare il fioraio su strada serve una autorizzazione', ['edicole-fiorai-chioschi']],
  ['come apro un bar a palermo', ['aprire-un-bar']],
  ['cosa serve per aprire un ristorante', ['aprire-un-bar']],
  ['contributo per eliminare le barriere architettoniche in casa', ['barriere-architettoniche-contributo']],
  ['come ottengo una carrozzina gratuita', ['ausili-protesi-asp']],
  ['come faccio il servizio civile al comune di palermo', ['servizio-civile-universale']],
  ['centri estivi comunali come si fa l iscrizione', ['centri-estivi']],
  ['devo rinnovare il permesso ztl', ['richiedere-permesso-di-accesso-ad-area-ztl-31']],
  ['sull insegna del negozio devo pagare l imposta di pubblicità', ['pubblicita']],
];

// le stesse domande con un refuso: una lettera sbagliata, mancante o scambiata non deve
// cambiare la risposta (i refusi si correggono solo su parole di almeno 6 lettere che il
// vocabolario non conosce, quindi «tary» o «imsu» restano fuori: sono parole troppo corte)
const CASI_REFUSO = [
  ['residensa', ['dichiarazione-di-cambio-indirizzo-o-abitazione']],
  ['come faccio per la residensa', ['dichiarazione-di-cambio-indirizzo-o-abitazione']],
  ['devo cambaire residenza', ['dichiarazione-di-cambio-indirizzo-o-abitazione']],
  ['famglia', ['certificati-anagrafici']],
  ['certificato di stato di famglia', ['certificati-anagrafici']],
  ['certificato di residensa', ['certificati-anagrafici']],
  ['cartta di identita scaduta', ['cie']],
  ['como ottengo lo spid', ['spid-identita-digitale']],
  ['come chido il passo carrabile', ['richiedere-permesso-per-passo-carrabile-2']],
  ['la spazatura non viene ritirata', ['rifiuti']],
  ['il lampione davnti casa e spento', ['strade']],
  ['come ottengo il contrasegno disabili', ['contrassegno-disabili']],
  ['iscrizione all asilo nido', ['nidi']],
  ['ho perso il portafoglo', ['oggetti-smarriti']],
  ['mi hanno rubato la tessera eletorale', ['tessera-elettorale']],
  ['cila per ristruttrare casa', ['sportello-unico-per-edilizia']],
  ['come pago la mult', ['pagare-contravvenzioni-2']],
];

test('il motore trova la voce giusta per le domande tipiche', () => {
  const falliti = [];
  let secondi = 0;
  for (const [domanda, attesi] of CASI) {
    const risultati = cerca(indice, domanda, 3);
    const idTrovati = risultati.map(r => r.indice.voce.id);
    if (!attesi.includes(idTrovati[0])) {
      if (attesi.some(a => idTrovati.includes(a))) secondi++;
      falliti.push({ domanda, attesi, trovati: idTrovati, punteggi: risultati.map(r => +r.punteggio.toFixed(1)) });
    }
  }
  if (falliti.length) console.error(JSON.stringify(falliti, null, 1));
  if (secondi) console.error(`${secondi} domande giuste solo al 2° o 3° posto`);
  assert.equal(falliti.length, 0, `${falliti.length}/${CASI.length} domande con la risposta sbagliata in prima posizione`);
});

// due richieste nella stessa domanda: la prima diventa la scheda principale, la seconda
// finisce nel riquadro «nella domanda c'è anche questo» (js/app.js). Le coppie sono
// costruite unendo due domande vere di categorie diverse.
const CASI_DOPPI = [
  ['ho trovato un cane randagio cosa faccio, poi contributo per eliminare le barriere architettoniche in casa', ['canile', 'barriere-architettoniche-contributo']],
  ['come apro un bar a palermo, poi quali tasse comunali devo pagare', ['aprire-un-bar', 'tributi-locali']],
  ['mi hanno portato via la macchina col carro attrezzi e come faccio il passaporto', ['rimozione-forzata-recupero-veicolo', 'passaporto']],
  ['come ottengo il contrassegno disabili e come prenoto un campo di calcio', ['contrassegno-disabili', 'impianti-sportivi']],
  ['come faccio la carta di identità e come mi sposo in comune', ['cie', 'matrimonio-civile']],
  ['come segnalo una buca e dove pago la multa', ['strade', 'pagare-contravvenzioni-2']],
  ['come iscrivo mio figlio al nido e come ottengo lo spid', ['nidi', 'spid-identita-digitale']],
  ['posso pagare la multa a rate e come chiedo l accesso agli atti', ['rateizzazione-multe-cartelle', 'accesso-agli-atti-civico-semplice-e-generalizzato']],
  ['devo rinnovare il permesso ztl e come ottengo il pass h', ['richiedere-permesso-di-accesso-ad-area-ztl-31', 'contrassegno-disabili']],
  ['come apro un negozio e come faccio il servizio civile', ['sportello-unico-attivita-produttive', 'servizio-civile-universale']],
  ['come faccio il passaporto e dove trovo i dati aperti del comune', ['passaporto', 'open-data']],
  ['come ottengo il contrassegno disabili e come chiedo il passo carrabile', ['contrassegno-disabili', 'richiedere-permesso-per-passo-carrabile-2']],
];

test('una domanda con due richieste trova tutte e due le voci', () => {
  const falliti = [];
  for (const [domanda, attesi] of CASI_DOPPI) {
    const principale = cerca(indice, domanda, 1)[0];
    const anche = cercaSezioni(indice, domanda, { esclusa: principale?.indice.voce.id, quante: 2 });
    const mostrate = new Set([principale?.indice.voce.id, ...anche.map(a => a.voce.id)]);
    if (!attesi.every(a => mostrate.has(a))) falliti.push({ domanda, attesi, mostrate: [...mostrate] });
  }
  if (falliti.length) console.error(JSON.stringify(falliti, null, 1));
  assert.equal(falliti.length, 0, `${falliti.length}/${CASI_DOPPI.length} domande doppie senza tutte e due le voci`);
});

test('una domanda di un solo tema non apre una seconda scheda', () => {
  const falliti = [];
  for (const [domanda] of CASI) {
    const principale = cerca(indice, domanda, 1)[0];
    if (!principale || principale.punteggio < SOGLIA_SICURA) continue;
    const anche = cercaSezioni(indice, domanda, { esclusa: principale.indice.voce.id, quante: 2 });
    if (anche.length) falliti.push({ domanda, anche: anche.map(a => a.voce.id) });
  }
  if (falliti.length) console.error(JSON.stringify(falliti, null, 1));
  assert.equal(falliti.length, 0, `${falliti.length} domande di un solo tema con una seconda scheda`);
});

test('la domanda si spezza sui connettivi, non sulle parole vuote', () => {
  assert.deepEqual(sezioniDomanda('come cambio residenza e come iscrivo la tari'), ['come cambio residenza', 'come iscrivo la tari']);
  assert.deepEqual(sezioniDomanda('devo pagare la tari'), ['devo pagare la tari']);
  assert.deepEqual(sezioniDomanda('che cos è e a che serve'), []);
});

test('un refuso non cambia la risposta', () => {
  const falliti = [];
  for (const [domanda, attesi] of CASI_REFUSO) {
    const risultati = cerca(indice, domanda, 3);
    const idTrovati = risultati.map(r => r.indice.voce.id);
    if (!attesi.includes(idTrovati[0])) falliti.push({ domanda, attesi, trovati: idTrovati });
  }
  if (falliti.length) console.error(JSON.stringify(falliti, null, 1));
  assert.equal(falliti.length, 0, `${falliti.length}/${CASI_REFUSO.length} domande con refuso senza la risposta giusta`);
});

test('un refuso non inventa una risposta fuori tema', () => {
  for (const q of ['ricetaa della pasta con le sarde', 'come si aggiusta un frigerifero', 'quale è il colore preferito di pinuzza']) {
    const r = cerca(indice, q);
    assert.ok(r.length === 0 || r[0].punteggio < SOGLIA_MINIMA, `«${q}» ha superato la soglia`);
  }
});

test('normalizza toglie accenti, maiuscole e punteggiatura', () => {
  assert.equal(normalizza('Città, PERCHÉ?'), 'citta perche');
});

test('le parole vuote non contano', () => {
  assert.deepEqual(parole('come posso fare una domanda sulla residenza'), ['domanda', 'residenza']);
});

test('domanda vuota o di sole parole vuote non produce risultati', () => {
  assert.deepEqual(cerca(indice, ''), []);
  assert.deepEqual(cerca(indice, 'come cosa il di'), []);
});

test('domanda fuori tema non supera la soglia minima', () => {
  for (const q of ['quale è il colore preferito di Pinuzza', 'ricetta della pasta con le sarde', 'come si aggiusta un frigorifero']) {
    const r = cerca(indice, q);
    assert.ok(r.length === 0 || r[0].punteggio < SOGLIA_MINIMA, `«${q}» ha superato la soglia`);
  }
});

test('le domande pertinenti stanno sopra la soglia minima', () => {
  for (const [domanda] of CASI) {
    const r = cerca(indice, domanda, 1);
    assert.ok(r.length && r[0].punteggio >= SOGLIA_MINIMA, `«${domanda}» sotto soglia (${r[0]?.punteggio.toFixed(2)})`);
  }
});

test('la ricerca di riserva trova un ufficio competente', () => {
  const r = cercaUffici(uffici, 'rumore dei locali la notte', 3);
  assert.ok(r.length > 0, 'nessun ufficio trovato');
  assert.ok(r[0].ufficio.nome.length > 0);
});

test('i suggerimenti sono domande, non id', () => {
  const s = suggerimenti(argomenti, 6, () => 0.42);
  assert.equal(s.length, 6);
  assert.ok(s.every(d => d.trim().length > 5));
});

test('le domande in evidenza stanno in testa ai suggerimenti', () => {
  const evidenza = argomenti.filter(v => v.inEvidenza).map(v => v.domande[0]);
  assert.ok(evidenza.length > 0, 'nessuna voce in evidenza');
  const s = suggerimenti(argomenti, 8, () => 0.42);
  assert.deepEqual(s.slice(0, evidenza.length), evidenza);
  assert.equal(s.length, 8);
});

// la home sul telefono mostra quindici domande di prova, cinque per volta: devono girare
// (un altro punto di partenza, altre domande) e non essere tutte lo stesso tema
test('le quindici domande di prova girano e restano su temi diversi', () => {
  const tema = new Map(argomenti.flatMap(v => v.domande.map(d => [d, v.categoria || ''])));
  const quindici = suggerimenti(argomenti, 15, () => 0.42);
  assert.equal(quindici.length, 15);
  assert.equal(new Set(quindici).size, 15, 'domande ripetute nei suggerimenti');
  const conto = new Map();
  for (const d of quindici) {
    const t = tema.get(d);
    conto.set(t, (conto.get(t) || 0) + 1);
  }
  const troppo = [...conto].filter(([, n]) => n > 2);
  assert.deepEqual(troppo, [], 'troppe domande dello stesso tema in home');

  const altroGiro = suggerimenti(argomenti, 15, () => 0.91);
  assert.notDeepEqual(altroGiro, quindici, 'i suggerimenti non girano: stesso elenco a ogni avvio');
});

test('ogni voce ha domande e titolo', () => {
  for (const v of argomenti) {
    assert.ok(v.titolo && v.titolo.length > 3, `titolo mancante in ${v.id}`);
    assert.ok(Array.isArray(v.domande) && v.domande.length > 0, `domande mancanti in ${v.id}`);
  }
});

test('ogni voce dichiara se è un rimando o una risposta preparata', () => {
  for (const v of argomenti) {
    if (v.servizio) assert.equal(v._v, 'rimando', `${v.id} punta a una scheda ma _v è ${v._v}`);
    else assert.equal(v._v, 'argomento', `${v.id} ha una risposta preparata ma _v è ${v._v}`);
  }
});

test('ogni voce dichiara lo stato di revisione', () => {
  const stati = new Set(['fonte-ufficiale', 'da-rivedere', 'ok']);
  for (const v of argomenti) {
    assert.ok(v.revisione, `blocco revisione mancante in ${v.id}`);
    assert.ok(stati.has(v.revisione.stato), `stato di revisione non valido in ${v.id}: ${v.revisione.stato}`);
  }
});

test('i rimandi sono «fonte-ufficiale», le risposte preparate no', () => {
  for (const v of argomenti) {
    if (v.servizio) {
      assert.equal(v.revisione.stato, 'fonte-ufficiale', `${v.id} rimanda a una scheda e non può dirsi ${v.revisione.stato}`);
    } else {
      assert.ok(
        ['da-rivedere', 'ok'].includes(v.revisione.stato),
        `${v.id} ha una risposta preparata e non può dirsi ${v.revisione.stato}`,
      );
    }
  }
});

test('le voci riviste dichiarano chi e quando', () => {
  for (const v of argomenti) {
    if (v.revisione.stato !== 'ok') continue;
    assert.ok((v.revisione.da || '').trim(), `manca chi ha rivisto ${v.id}`);
    assert.match(v.revisione.data, /^\d{4}-\d{2}-\d{2}$/, `data di revisione non valida in ${v.id}`);
  }
});

test('ogni rimando punta a una scheda servizio esistente e a uffici esistenti', () => {
  const idUffici = new Set(uffici.map(u => u.id));
  for (const v of argomenti) {
    if (v.servizio) assert.ok(servizi[v.servizio], `servizio inesistente in ${v.id}`);
    for (const u of v.uffici || []) assert.ok(idUffici.has(u), `ufficio ${u} inesistente in ${v.id}`);
  }
});

export { CASI };
