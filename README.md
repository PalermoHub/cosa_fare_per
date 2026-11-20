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
atti.html             ricerca dal vivo negli atti del Comune (Albo Pretorio e Delibere e Ordinanze)
salvati.html          le risposte salvate in questo browser
guida.html            come funziona l'app, con le schermate e le istruzioni per installarla
privacy.html          informativa privacy e cookie, con le preferenze
css/pinuzza.css       tema chiaro, tipografia di sistema, nessun font remoto
js/motore.js          normalizzazione, sinonimi, punteggio delle domande, ricerca degli uffici
js/dati.js            caricamento dei dati (gli uffici solo quando servono)
js/app.js             risposte, schede ufficio con mappa, percorso con GPS, navigazione
js/aree.js            raggruppamento per area, elenco alfabetico, filtro e suggerimenti (3 lettere)
js/uffici.js          interfaccia della pagina degli uffici
js/atti.js            interfaccia della pagina degli atti: chiama il Worker e mostra le schede
js/salvati.js         risposte salvate nella memoria del browser (nessun server)
js/salvati-pagina.js  interfaccia della pagina delle risposte salvate
js/decifra.js         «Decifra la PA»: dalle istruzioni per farsi spiegare un avviso pubblico
data/argomenti.json   122 voci: domande tipiche, parole chiave, risposta preparata, uffici competenti
data/servizi.json     58 schede servizio ufficiali del Comune, estratte con le loro sezioni
data/uffici.json      601 nodi Area / Settore / U.O. con competenze, contatti, sede, coordinate
img/                  icone e logo OpenDataSicilia
img/guida/            le schermate della guida (WebP, rigenerate a mano quando cambia l'interfaccia)
worker/               il Worker Cloudflare che interroga i portali del Comune (src/index.js, wrangler.toml)
tests/                i controlli automatici (motore, uffici, atti, offline, contrasto, tema, pagine, interfaccia, accessibilità)
package.json          gli script `npm test`, `npm run test:ui`, `npm run test:a11y`
```

Non ci sono dipendenze per usarlo: è un sito statico (HTML, CSS, moduli JS, JSON) servito da GitHub Pages.

## Funzioni

- Un selettore sopra il campo sceglie **su che cosa si chiede**: *Argomenti* (voci curate, comportamento
  di sempre), *Uffici e servizi* (schede servizio e ricerca degli uffici per nome e competenze) e *ROUS*
  (Regolamento sull'ordinamento degli Uffici e dei Servizi). Ogni ambito ha il suo indice e le sue
  domande di prova; l'ambito sta nell'indirizzo (`?q=…&ambito=rous`). Le risposte ROUS citano gli
  articoli col testo ufficiale e il link ai PDF originali del Comune.
- In home le domande suggerite sono badge: le voci marcate `inEvidenza` compaiono sempre per prime,
  le altre si scelgono a caso a ogni caricamento (otto su schermo largo, dodici su schermo stretto,
  in tre colonne da quattro che scorrono in orizzontale, una alla volta).
- Due rimandi sotto le domande: gli uffici (`uffici.html`) e le segnalazioni, che aprono le
  [issue del repository](https://github.com/PalermoHub/cosa_fare_per/issues) su GitHub.
- Navigazione a due velocità: su schermo largo il menu in cima (`Chiedi`, `Domande`, `Uffici`,
  `Salvate`, `Guida`, `Segnala`, `Privacy` e il cambio tema); sul telefono una barra in basso con
  **quattro posti** (`Chiedi`, `Domande`, `Uffici`, `Altro`) e il resto dentro il pannello «Altro»
  (risposte salvate con il numero, guida, segnalazioni, informativa, interruttore del tema). La
  barra non cresce: una voce nuova che non sia una destinazione principale va nel pannello.
- Risposta in tre livelli: sicura, «non sono sicura di aver capito» (con alternative), «non ho una
  risposta pronta» (con gli uffici competenti trovati nelle loro competenze).
- Scheda ufficio con mini mappa OpenStreetMap (caricata solo quando entra nello schermo) e pulsante
  **Percorso**: chiede la posizione al browser e apre il navigatore verso la sede.
- URL condivisibile (`?q=…`), tasto indietro del browser, pulsante «Torna all'inizio», pulsante
  «torna in cima», funziona anche da tastiera.
- **«Decifra la PA»** (in home): incolli il link di un avviso, di un bando o di una notizia
  della pubblica amministrazione e l'app prepara le istruzioni da incollare in un assistente AI
  (ChatGPT, Claude, Gemini…), perché te lo spieghi in italiano semplice: cosa cambia, cosa devi
  fare e da quando. Nessuna AI viene chiamata e nessun dato esce dal browser: il testo si compone
  lì e resta lì finché non lo copi tu. Sul telefono il pannello di condivisione le passa all'app
  che usi; sul computer si sceglie fra le chat web più usate (Claude, DeepSeek, Qwen, Z.ai, Kimi,
  ChatGPT, Gemini, Copilot, Perplexity, Grok) e le istruzioni si aprono già pronte dove il servizio
  lo consente.
  Le istruzioni sono adattate dal modello «Decifra la PA»
  dell'app [in due tocchi](https://github.com/aborruso/in_due_tocchi) di Andrea Borruso (MIT).
- **Risposte salvate** (`salvati.html`): «Salva questa risposta» mette la scheda da parte nella
  memoria del browser; da qui si riapre o si toglie, anche tutte insieme. Niente account, niente invio.
- **Guida** (`guida.html`): come fare una domanda, leggere la risposta, arrivare all'ufficio,
  salvare, usare l'app sul telefono e senza rete. Le schermate stanno in `img/guida/`.
- **Atti del Comune** (`atti.html`): una casella sola per cercare **delibere, determinazioni,
  ordinanze, bandi, gare, convocazioni e pubblicazioni di matrimonio** nei due servizi del Comune —
  l'**Albo Pretorio** (ciò che è pubblicato adesso: alla scadenza l'atto esce dall'elenco) e
  **Delibere e Ordinanze** (l'archivio degli atti deliberativi). Le due fonti si sovrappongono e sono
  unificate: ogni atto compare una volta, con il suo numero, la data, l'oggetto e il **link permanente**
  all'atto ufficiale con gli allegati PDF. Filtri per tipo e anno, e senza parole vedi gli atti più
  recenti. La ricerca è **dal vivo**: non esiste un archivio nostro, ogni Cerca interroga i portali.
  Serve un piccolo Worker perché quei portali non si possono chiamare dal browser (niente CORS,
  niente iframe, ricerca con lo stato in sessione): vedi `worker/README.md`.
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

Il ROUS (`data/rous.json`: 65 voci per tema; `data/rous-articoli.json`: testo degli articoli, caricato
solo quando serve) si rigenera dai PDF in `dati/rous/pdf` con `python3 scripts/rous_estrai.py` e
`python3 scripts/rous_build.py`; le voci curate stanno in `scripts/rous_voci_a.py` e `rous_voci_b.py` e
il build controlla che le fonti, gli uffici e i numeri citati esistano. Sono marcate `da-rivedere`.

I dati degli uffici provengono da `comune.palermo.it/amministrazione/aree-amministrative/` e
`/amministrazione/uffici/`; il catalogo dei servizi anche da
`sites.google.com/comune.palermo.it/trova-servizi/`.

> Pinuzza non è uno sportello e non prende pratiche. Importi, scadenze e documenti vanno sempre
> verificati sulla scheda del servizio o con l'ufficio.

## La ricerca negli atti (Worker)

`atti.html` parla con `pinuzza-atti`, un Worker Cloudflare in `worker/`. Non conserva niente: apre una
sessione sui due portali SISPI del Comune, esegue la ricerca e restituisce JSON con il link permanente
dell'atto, che è l'unico modo per puntare a un atto preciso (gli indirizzi «normali» dipendono dalla
sessione e non si possono condividere). Il codice è nel repository e si pubblica con
`cd worker && npx wrangler deploy`; se cambia l'indirizzo va aggiornato `ENDPOINT` in `js/atti.js`,
che è l'unico posto in cui compare.

Sul piano Workers gratuito ci sono 50 subrequest per invocazione e 10 ms di CPU: i portali rispondono
`302` e ogni passo costa due subrequest, quindi il Worker conta le richieste (`BUDGET_SUBREQUEST`) e,
quando il bilancio finisce, smette di interrogare tipi invece di far fallire la ricerca. `/prova`
dice se il Comune risponde e se qualcosa è cambiato.

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
