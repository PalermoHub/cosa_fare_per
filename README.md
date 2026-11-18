# Chiedilo a Pinuzza

Una pagina bianca, una domanda in italiano semplice, una risposta con **l'ufficio giusto del Comune
di Palermo**: nome dell'Area e del Settore, unità organizzativa competente, responsabile, sede,
telefono, email, PEC e link alla scheda ufficiale.

Pinuzza non è un modello linguistico e non chiama nessun servizio esterno: risponde da un archivio
preparato di domande tipiche, agganciato alle **schede servizio** e alle **aree amministrative**
pubblicate dal Comune di Palermo. Se non sa rispondere, lo dice e indica gli uffici che potrebbero
occuparsene.

## Come è fatta

```
index.html            pagina unica (testata e piede fissi, scorre solo la colonna dei risultati)
domande.html          tutte le domande tipiche, per categoria (generata da scripts/genera_pagine.py)
uffici.html           tutti gli uffici: griglia per area amministrativa o elenco alfabetico
salvati.html          le risposte salvate in questo browser
guida.html            come funziona l'app, con le schermate e le istruzioni per installarla
privacy.html          informativa privacy e cookie, con le preferenze
css/pinuzza.css       tema chiaro, tipografia di sistema, nessun font remoto
js/motore.js          normalizzazione, sinonimi, punteggio delle domande, ricerca degli uffici
js/dati.js            caricamento dei dati (gli uffici solo quando servono)
js/app.js             risposte, schede ufficio con mappa, percorso con GPS, navigazione
js/aree.js            raggruppamento per area, elenco alfabetico, filtro e suggerimenti (3 lettere)
js/uffici.js          interfaccia della pagina degli uffici
js/salvati.js         risposte salvate nella memoria del browser (nessun server)
js/salvati-pagina.js  interfaccia della pagina delle risposte salvate
data/argomenti.json   122 voci: domande tipiche, parole chiave, risposta preparata, uffici competenti
data/servizi.json     58 schede servizio ufficiali del Comune, estratte con le loro sezioni
data/uffici.json      601 nodi Area / Settore / U.O. con competenze, contatti, sede, coordinate
img/                  icone e logo OpenDataSicilia
img/guida/            le schermate della guida (WebP, rigenerate a mano quando cambia l'interfaccia)
tests/                i controlli automatici (motore, uffici, offline, contrasto, tema, pagine, interfaccia, accessibilità)
package.json          gli script `npm test`, `npm run test:ui`, `npm run test:a11y`
```

Non ci sono dipendenze per usarlo: è un sito statico (HTML, CSS, moduli JS, JSON) servito da GitHub Pages.

## Funzioni

- In home le domande suggerite sono badge: le voci marcate `inEvidenza` compaiono sempre per prime,
  le altre si scelgono a caso a ogni caricamento (otto su schermo largo, nove su schermo stretto,
  in colonne da tre che scorrono in orizzontale, una alla volta).
- Due rimandi sotto le domande: gli uffici (`uffici.html`) e le segnalazioni, che aprono le
  [issue del repository](https://github.com/PalermoHub/cosa_fare_per/issues) su GitHub. Su schermo
  stretto gli stessi tre indirizzi, più l'informativa privacy e il cambio tema, stanno nella barra in basso.
- Risposta in tre livelli: sicura, «non sono sicura di aver capito» (con alternative), «non ho una
  risposta pronta» (con gli uffici competenti trovati nelle loro competenze).
- Scheda ufficio con mini mappa OpenStreetMap (caricata solo quando entra nello schermo) e pulsante
  **Percorso**: chiede la posizione al browser e apre il navigatore verso la sede.
- URL condivisibile (`?q=…`), tasto indietro del browser, pulsante «Torna all'inizio», pulsante
  «torna in cima», funziona anche da tastiera.
- **Risposte salvate** (`salvati.html`): «Salva questa risposta» mette la scheda da parte nella
  memoria del browser; da qui si riapre o si toglie, anche tutte insieme. Niente account, niente invio.
- **Guida** (`guida.html`): come fare una domanda, leggere la risposta, arrivare all'ufficio,
  salvare, usare l'app sul telefono e senza rete. Le schermate stanno in `img/guida/`.
- **Tutti gli uffici** (`uffici.html`): i 601 uffici in griglia per area amministrativa o in elenco
  alfabetico. La ricerca suggerisce dopo **3 lettere** l'ufficio o l'area giusta (frecce su/giù e
  Invio per scegliere) e filtra per nome, area, settore e competenze; la scelta si può condividere
  con `?q=…` e `?vista=elenco`.

## Dati e aggiornamenti

Le risposte «ufficiali» restano legate alla loro scheda su `comune.palermo.it/servizio/…`: quando il
Comune aggiorna una scheda, il testo della risposta si aggiorna rigenerando `data/servizi.json`.
Le voci curate (`data/argomenti.json`) si modificano a mano: ogni voce ha `domande`, `keywords`,
`uffici` e, se non esiste una scheda servizio, una risposta con `sintesi`, `passi`, `serve` e `nota`.
Con `inEvidenza: true` la voce finisce sempre tra le domande suggerite in home, con la sua prima
domanda.

I dati degli uffici provengono da `comune.palermo.it/amministrazione/aree-amministrative/` e
`/amministrazione/uffici/`; il catalogo dei servizi anche da
`sites.google.com/comune.palermo.it/trova-servizi/`.

> Pinuzza non è uno sportello e non prende pratiche. Importi, scadenze e documenti vanno sempre
> verificati sulla scheda del servizio o con l'ufficio.

## Controlli automatici

```bash
npm test          # 85 test statici sui dati, sul motore e sulle pagine (nessuna dipendenza)
npm run test:ui   # 16 casi nell’interfaccia con Chromium (serve Playwright: npm i -D playwright)
npm run test:a11y # audit di accessibilità con axe-core
```

I primi si lanciano sempre; gli altri due aprono il sito in locale con un browser. Girano anche in
CI a ogni push su `main` (`.github/workflows/verifica.yml`).

## Licenza e crediti

**Chiedilo a Pinuzza** è un progetto di [OpenDataSicilia](https://opendatasicilia.it/).
I dati sono pubblicati dal Comune di Palermo con licenza CC BY 4.0; il codice è rilasciato con
licenza MIT (testo in [`LICENSE`](LICENSE), © 2026 OpenDataSicilia). Vedi anche `LICENZE.md`.
