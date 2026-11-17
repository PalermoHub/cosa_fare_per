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
css/pinuzza.css       tema chiaro, tipografia di sistema, nessun font remoto
js/motore.js          normalizzazione, sinonimi, punteggio delle domande, ricerca degli uffici
js/dati.js            caricamento dei dati (gli uffici solo quando servono)
js/app.js             risposte, schede ufficio con mappa, percorso con GPS, navigazione
data/argomenti.json   100 voci: domande tipiche, parole chiave, risposta preparata, uffici competenti
data/servizi.json     58 schede servizio ufficiali del Comune, estratte con le loro sezioni
data/uffici.json      611 nodi Area / Settore / U.O. con competenze, contatti, sede, coordinate
img/                  icone e logo OpenDataSicilia
```

Non ci sono dipendenze: è un sito statico (HTML, CSS, moduli JS, JSON) servito da GitHub Pages.

## Funzioni

- Risposta in tre livelli: sicura, «non sono sicura di aver capito» (con alternative), «non ho una
  risposta pronta» (con gli uffici competenti trovati nelle loro competenze).
- Scheda ufficio con mini mappa OpenStreetMap (caricata solo quando entra nello schermo) e pulsante
  **Percorso**: chiede la posizione al browser e apre il navigatore verso la sede.
- URL condivisibile (`?q=…`), tasto indietro del browser, pulsante «Torna all'inizio», pulsante
  «torna in cima», funziona anche da tastiera.

## Dati e aggiornamenti

Le risposte «ufficiali» restano legate alla loro scheda su `comune.palermo.it/servizio/…`: quando il
Comune aggiorna una scheda, il testo della risposta si aggiorna rigenerando `data/servizi.json`.
Le voci curate (`data/argomenti.json`) si modificano a mano: ogni voce ha `domande`, `keywords`,
`uffici` e, se non esiste una scheda servizio, una risposta con `sintesi`, `passi`, `serve` e `nota`.

I dati degli uffici provengono da `comune.palermo.it/amministrazione/aree-amministrative/` e
`/amministrazione/uffici/`; il catalogo dei servizi anche da
`sites.google.com/comune.palermo.it/trova-servizi/`.

> Pinuzza non è uno sportello e non prende pratiche. Importi, scadenze e documenti vanno sempre
> verificati sulla scheda del servizio o con l'ufficio.

## Licenza e crediti

**Chiedilo a Pinuzza** è un progetto di [OpenDataSicilia](https://opendatasicilia.it/).
I dati sono pubblicati dal Comune di Palermo con licenza CC BY 4.0; il codice è rilasciato con
licenza MIT. Vedi `LICENZE.md`.
