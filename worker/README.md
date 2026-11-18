# Worker degli atti — come si pubblica

Questo Worker serve la pagina `atti.html`: prende le parole cercate dal cittadino, apre una
sessione sui due portali SISPI del Comune di Palermo (Albo Pretorio e Delibere e Ordinanze),
esegue la ricerca e restituisce JSON con gli atti e il loro **link permanente**.

Serve perché dal browser non si può fare: i due portali non mandano `Access-Control-Allow-Origin`,
rispondono `X-Frame-Options: sameorigin` e la ricerca è un `POST` con lo stato in sessione.

**Non conserva niente**: nessun database, nessun KV, nessun R2. La Cache API serve solo a non
ripetere due volte la stessa ricerca entro dieci minuti.

## Pubblicare

```bash
cd worker
npx wrangler deploy
```

L'indirizzo viene stampato da `wrangler` (`https://pinuzza-atti.<sottodominio>.workers.dev`).
Se cambia, va aggiornato l'elenco `ENDPOINT` in `js/atti.js` — è l'unico posto in cui compare.

## Provare

```bash
# il Comune risponde a un IP Cloudflare? (la domanda che conta)
curl "https://pinuzza-atti.<sottodominio>.workers.dev/prova"

# gli atti più recenti
curl "https://pinuzza-atti.<sottodominio>.workers.dev/cerca?tipo=tutti&recenti=1"

# una ricerca vera
curl "https://pinuzza-atti.<sottodominio>.workers.dev/cerca?tipo=delibere&q=pulizia&anno=2026"

# con i conteggi delle subrequest (per stare dentro il piano gratuito)
curl "https://pinuzza-atti.<sottodominio>.workers.dev/cerca?tipo=tutti&q=pulizia&debug=1"
```

## Conti da tenere d'occhio

Il piano **Workers gratuito** dà 50 subrequest per invocazione e 10 ms di CPU. I portali
rispondono `302` verso `home.jsp?modo=tabella`, quindi ogni passo costa **due** subrequest:
una ricerca su un tipo costa 3, la scheda di un atto 2. Il codice conta tutto in
`BUDGET_SUBREQUEST` (46) e, quando il bilancio finisce, smette di interrogare tipi invece di far
fallire la ricerca: nel JSON lo dice (`tipiNonInterrogati`).

Il gruppo «tutti» interroga cinque tipi e mostra sei risultati: sono i valori scelti per stare
larghi sul piano gratuito (**2,9-4 s per ricerca, 19-29 subrequest, CPU p50 ~1,7 ms**, misurati
con `/cerca?…&debug=1`). Gli altri tipi restano cercabili scegliendo il gruppo. Le punte di CPU
(p90 ~30 ms) sono **avvii a freddo** dell'isolate, non parsing: una richiesta banale ha lo stesso
p90. Se si alza `MAX_RISULTATI` conviene ricontrollare `debug.cpuParseMs` e `debug.subrequest`.

Con il piano a pagamento (5 $/mese) si possono alzare i tetti in `wrangler.toml`
(`[limits] subrequests = 1000`) e togliere il taglio.

## Se il Comune cambia le pagine

`/prova` risponde `ok: false` quando un portale è irraggiungibile o restituisce
«Servizio temporaneamente non disponibile». Le cose che possono cambiare senza preavviso:

- i codici `TD` dei tipi di atto (sono nella costante `TIPI` di `src/index.js`);
- i nomi dei campi del modulo di ricerca (`ALB_DESOGGETTO`, `ALB_NUM_PROT`, `ALB_DESANNOPROT`);
- il formato delle tabelle (le intestazioni si leggono, non si indovinano) e il `302` dopo la ricerca;
- il blocco `testoCodiceIpa = '…ALBCOD=…'` da cui si ricava il link permanente.

## Un secondo account, come ripiego

La pagina prova gli indirizzi in `ENDPOINT` (in `js/atti.js`) uno dopo l'altro: il secondo entra
in gioco solo se il primo non risponde (rete, 5xx, quota finita, sospensione). Non serve per il
blocco lato Comune: gli IP di uscita di Cloudflare sono gli stessi per tutti gli account, e per
quello servirebbe un host diverso.

Per aggiungerlo serve un token di **quell'account**, non il login OAuth del nostro:

```bash
# 1) token creato dal pannello dell'altro account (template «Edit Cloudflare Workers»)
mkdir -p ~/.config/pinuzza
cat > ~/.config/pinuzza/nuovo.env <<'EOF'
CLOUDFLARE_API_TOKEN=…
CLOUDFLARE_ACCOUNT_ID=…
EOF
chmod 600 ~/.config/pinuzza/nuovo.env

# 2) deploy nell'altro account (le credenziali di casa restano intatte)
set -a; . ~/.config/pinuzza/nuovo.env; set +a
cd worker && npx wrangler deploy      # stampa https://pinuzza-atti.<sottodominio>.workers.dev

# 3) quel nuovo indirizzo va messo PRIMA nell'elenco ENDPOINT di js/atti.js,
#    lasciando https://pinuzza-atti.coseerobe.workers.dev come secondo.
```

Attenzione: `wrangler login` sovrascrive le credenziali in `~/.config/.wrangler` (una sola per
volta). Se si usa OAuth e non un token, isolare la configurazione con `XDG_CONFIG_HOME` — non con
`WRANGLER_HOME`, che non è più letto.
