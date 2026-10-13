# HO-006 — Provare a mano le schermate della wave `1D-W9`

**Fase:** 1D, dopo la wave `1D-W9`. **Stato:** in attesa che tu la esegua.

---

## 1. Perché serve

I criteri 1D-31…1D-35 sono eseguiti automaticamente: 55 prove nuove fra
`apps/api`, `apps/admin` e `packages/ui` li percorrono tutti, e il riepilogo è in fondo a questo
documento. Quello che le prove automatiche **non** possono dirti è se le
schermate si usano bene: se le parole sono quelle giuste, se un passaggio è
scomodo, se manca qualcosa che ti aspettavi.

Per guardarle serve un database con dentro qualcosa. Da qui il comando di seme
sintetico: mette a terra due media, due contenuti, una categoria, un menu con
tutti e quattro i casi di visibilità, due redirect, sei impostazioni e quattro
template SEO. **Tutto inventato**: nessun dato reale del Centro, nessun nome,
nessun recapito. Gli indirizzi di posta usano il dominio `.invalid`, che per
definizione non esiste.

---

## 2. Cosa ho già verificato, così non devi controllarlo tu

| Verifica | Esito |
|---|---|
| Il seme scrive su un database vuoto appena migrato | sì — eseguito su un database usa e getta, poi eliminato |
| I comandi del §4 leggono da soli il `.env` della radice | sì — eseguiti tutti e cinque il 2026-09-23, dopo la correzione del difetto che li faceva fallire |
| Il servizio si avvia e resta in ascolto | sì — avviato il 2026-09-23 su una porta libera, configurazione presa dal `.env` |
| Rieseguirlo non duplica nulla | sì — si ferma con «si esegue una volta sola» |
| Se fallisce a metà non lascia righe | sì — tutte le scritture stanno in una transazione |
| Rifiuta un database con dentro un'importazione | sì — controlla `import_runs` e i contenuti con identificativo di origine |
| Rifiuta `NODE_ENV=production` | sì |
| Il menu seminato ha tutti e quattro i casi di visibilità | sì — uno per caso, contati a database |
| La password non compare nei messaggi né nel codice | sì — arriva da `SEED_PASSWORD` e non viene mai stampata |

---

## 3. Prerequisiti

1. Docker in esecuzione, con i servizi del progetto avviati.
2. Un file `.env` alla radice **completo**. I comandi lo leggono da soli, ma
   solo se contiene tutto: il tuo, al 2026-09-23, è più vecchio di
   `.env.example` e gli mancano otto righe, fra cui `IP_HASH_SALT` e
   `CSRF_SECRET`, che il servizio pretende e che non hanno valore predefinito
   perché sono segreti. Vedi il §3.1 qui sotto.
3. Un database **vuoto**. Se il tuo contiene già qualcosa, il seme si rifiuta di
   scrivere: è voluto.

### 3.1 Rimettere in pari il `.env`

Il confronto lo fai con un comando, senza aprire i file:

```powershell
$chiavi = { param($f) Get-Content $f | Select-String '^[A-Z_]+=' | ForEach-Object { ($_.Line -split '=')[0] } }
Compare-Object (& $chiavi .env) (& $chiavi .env.example) | Where-Object SideIndicator -eq '=>' | ForEach-Object InputObject
```

Stampa le chiavi che ci sono in `.env.example` e mancano nel tuo `.env`. Copia
dall'esempio le righe corrispondenti: i valori che ci trovi vanno bene così come
sono, sono di un ambiente usa e getta che vive sulla tua macchina.

`SESSION_SECRET`, se ce l'hai, non serve più a nulla: puoi toglierla.

**Il tuo `.env` non l'ho toccato**, e non lo farò: contiene valori tuoi e la sua
modifica è una di quelle che richiedono la tua mano.

---

## 4. Comandi esatti

Dalla radice del repository, uno per volta.

Serve un `.env` alla radice: tutti i comandi qui sotto lo leggono da soli.

```powershell
# 1. Servizi (PostgreSQL, MinIO). Se sono già su, salta.
pnpm compose:up

# 2. Schema. Non fa nulla se le migrazioni sono già applicate.
pnpm db:migrate

# 3. Seme sintetico. Scegli tu la parola: vale solo per questo database locale.
$env:SEED_PASSWORD = "scegli-una-parola-lunga"; pnpm db:seed
```

Poi, in due terminali distinti:

```powershell
pnpm --filter @amoris/api dev      # servizio, porta 3002
pnpm --filter @amoris/admin dev    # area amministrativa, porta 3001
```

Apri **`http://localhost:3001/admin`**, entra con `redazione@esempio.invalid` e
la parola che hai scelto, e scegli la veste **Redazione**.

Il segmento `/admin` non è facoltativo: l'area amministrativa è servita lì e
`http://localhost:3001` da solo risponde 404. È il percorso su cui il reverse
proxy la instraderà (ADR-003 §3.2, ADR-008 §3.2), ed è lo stesso in sviluppo
perché gli indirizzi degli asset restino quelli veri.

---

## 5. Esito atteso

Il terzo comando stampa sei righe che cominciano con «Seme sintetico scritto.» e
riassumono che cosa è entrato. Non stampa la password.

---

## 6. Che cosa guardare, schermata per schermata

| Dove | Criterio | Che cosa provare |
|---|---|---|
| Redazione → Media | 1D-31 | Carica un file. Aprine uno, scrivi testo alternativo e didascalia, salva. Premi «Sostituisci il file» e scegli un altro PNG: l'indirizzo non deve cambiare. Prova a eliminare `immagine-di-prova.png`: **deve essere rifiutata**, perché la pagina di prova la cita. Elimina l'altra: deve riuscire |
| Redazione → Menu | 1D-32 | Aggiungi una voce. Spostala su e giù, annidala sotto quella sopra, riportala al livello superiore. Aprila e cambia visibilità: i ruoli compaiono solo scegliendo «Solo ad alcuni ruoli» |
| Redazione → Pagine → una pagina → scheda SEO | 1D-33 | Scrivi titolo e descrizione, spunta «Non indicizzare», salva |
| Redazione → SEO e indirizzi → Template globali | 1D-33 | Apri «Pagine», cambia il template del titolo, salva |
| Redazione → SEO e indirizzi → Redirect | 1D-34 | Crea un redirect. Aprine uno e togli la spunta «Attivo»: si spegne senza essere cancellato |
| Commuta veste → Impostazioni | 1D-35 | Cambia il titolo del sito, spegni la sitemap, cambia gli articoli per pagina. Il valore riservato non deve mostrarsi |

**Nota su una cosa che manca e non è un difetto della wave:** le sezioni
«Persone e permessi» e «Registro delle operazioni» compaiono nella navigazione ma
non hanno ancora una schermata. Non appartengono alla `1D-W9`, che il piano
limita a media, menu, SEO, redirect e impostazioni.

---

## 7. Se qualcosa non funziona

| Sintomo | Che cosa significa | Che cosa fare |
|---|---|---|
| «SEED_PASSWORD non è impostata» | la variabile manca o è più corta di 12 caratteri | riscrivi il comando con una parola più lunga |
| «DATABASE_URL non è impostata» | manca il `.env` alla radice, oppure non contiene quella riga | copia `.env.example` in `.env`: i valori vanno bene così come sono |
| «IP_HASH_SALT manca» o «CSRF_SECRET manca» | il `.env` è più vecchio di `.env.example` | esegui il confronto del §3.1 e aggiungi le righe mancanti |
| «Ci sono già delle persone a database» | il seme è già stato eseguito | va bene così: passa ai due comandi `dev` |
| «Questo database porta i segni di un'importazione» | c'è dentro il sito vero | **non forzare**: usa un database diverso, o `pnpm compose:reset` seguito da `pnpm db:migrate`, che **cancella** il volume locale |
| Le immagini si vedono rotte | il seme scrive le righe dei media ma non carica i byte nell'archivio a oggetti | è atteso: carica un file vero dalla schermata Media per vedere un'anteprima |
| L'accesso risponde «Operazione non consentita» | sei nell'area sbagliata | usa il commutatore in alto a destra |
| «EADDRINUSE … 3001» o «… 3002» | c'è già un servizio in ascolto su quella porta, quasi sempre un avvio di sviluppo rimasto aperto da una sessione precedente | chiudilo e riavvialo: un processo vecchio serve una versione vecchia del codice |
| Pagina 404 al centro dello schermo | manca `/admin` nell'indirizzo | vai su `http://localhost:3001/admin` |
| In console: «A tree hydrated but some attributes… didn't match», con `cz-shortcut-listen` sul `body` | è un'estensione del browser che modifica la pagina prima che React la prenda in carico, non un difetto dell'area amministrativa | nulla da fare: dal 2026-09-23 l'attributo aggiunto dalle estensioni non produce più l'avviso |

---

## 8. Come segnalarmi il completamento

Scrivimi: **«HO-006: fatto»**, e per ciascuna delle sei righe della tabella al §6
se l'hai trovata giusta o che cosa cambieresti. Le correzioni di parole e di
disposizione entrano prima della `1D-W10`; quelle che cambiano il significato di
una schermata diventano una decisione nel registro.

---

## 9. Che cosa **non** ti sto chiedendo di fare

Non ti sto chiedendo di eseguire l'importazione vera, che resta alla `1D-W11` e
ha una sua conferma puntuale (DR-072). Non ti sto chiedendo di toccare il sito in
produzione. Nessuno dei comandi qui sopra esce dalla tua macchina.
