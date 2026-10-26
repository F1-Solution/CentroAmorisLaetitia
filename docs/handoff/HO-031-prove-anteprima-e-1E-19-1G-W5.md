# HO-031 — Prove dell'anteprima e di 1E-19 sui contenuti veri (`1G-W5`)

Fase 1G, wave `1G-W5`, attività T8. Scritto il 2026-10-23.

Due prove della wave girano sul database di sviluppo locale `amoris` ed entrano con
l'account di prova `qa-1e-w6@locale.invalid`, di cui solo tu conosci la password. Una delle
due **scrive** nel database: per questo te le chiedo, con una copia di salvataggio prima.
Tutto resta in locale: nessuna email, nessun servizio esterno.

---

## 1. Che cosa provano e che cosa scrivono

| Prova | Criterio | Che cosa scrive nel database `amoris` |
|---|---|---|
| `tests/visual/prova-anteprima.ts` | 1G-10 (W5-6): per ogni contenuto pubblicato, l'anteprima `/anteprima/<id>/` e la pagina pubblica hanno lo stesso HTML (regola di DR-202), menu compresi | solo l'ingresso e l'uscita dell'account di prova (una sessione e le righe di accesso nel registro) |
| `tests/visual/prova-1e-19.ts` | 1E-19 (W5-7): salvare dal CMS senza modifiche non cambia la pagina pubblica | come sopra, più un salvataggio **senza modifiche** di 4 contenuti: cambia `updated_at` e nel registro nascono 4 righe «Ha modificato» a nome dell'account di prova |

**Effetto da sapere sulla seconda prova.** Dalla `1G-W2` l'editor mostra «Ultima modifica»
dal registro (DR-231): dopo la prova, quei 4 contenuti mostreranno come ultima modifica
l'account di prova. Il database di collaudo della `1G-W7` si copia da questo (DR-215), quindi
l'effetto lo vedresti anche lì. Se non lo vuoi, al §5 c'è il ripristino della copia, che
annulla anche queste righe.

Puoi anche eseguire **solo** la prima prova: in quel caso 1E-19 resta non rieseguita in
questa wave e lo scrivo nel rapporto di chiusura.

## 2. Prerequisiti

- Docker acceso, con `amoris-dev-db-1` attivo.
- Sito su `http://127.0.0.1:3200` e API su `http://127.0.0.1:3002`: li ho già ricompilati e
  avviati con il codice della wave. Se hai riavviato il PC, scrivimelo e li riavvio io.
- La password dell'account di prova `qa-1e-w6@locale.invalid`.

## 3. Comandi (PowerShell, dalla cartella del progetto)

```powershell
Set-Location C:\work\CentroAmorisLaetitia

# 1. copia di salvataggio, fuori dal repository
New-Item -ItemType Directory -Force "$HOME\amoris-backup" | Out-Null
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-031-2026-10-23.dump"
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. password dell'account di prova, senza che resti nella cronologia
$segreta = Read-Host -AsSecureString "Password di qa-1e-w6@locale.invalid"
$env:QA_PASSWORD = [System.Net.NetworkCredential]::new('', $segreta).Password
$env:API = 'http://127.0.0.1:3002'
$env:SITO = 'http://127.0.0.1:3200'

# 3. anteprima contro pagina pubblica, su tutti i contenuti pubblicati
pnpm exec tsx tests/visual/prova-anteprima.ts

# 4. 1E-19 (salta questo comando se hai scelto solo la prima prova)
pnpm exec tsx tests/visual/prova-1e-19.ts

# 5. togli la password dalla sessione di PowerShell
Remove-Item Env:QA_PASSWORD
Remove-Variable segreta
```

## 3-bis. Se non ricordi la password dell'account di prova (aggiunto il 2026-10-26)

Il comando locale `account:create` non reimposta un account esistente, e nel database di
sviluppo oggi non c'è un account **attivo** con il ruolo Amministrazione, quindi «Persone e
permessi» non è usabile. La via più breve è un **nuovo account sintetico** di Redazione,
`qa-1g-w5@locale.invalid`, solo per queste prove: gli script lo usano tramite `QA_EMAIL`.
Scegli tu la password (almeno 12 caratteri) e non scriverla qui né nella chat.

Esegui questi comandi **al posto del §3**, nella stessa finestra di PowerShell:

```powershell
Set-Location C:\work\CentroAmorisLaetitia

# 1. copia di salvataggio, prima di qualunque scrittura
New-Item -ItemType Directory -Force "$HOME\amoris-backup" | Out-Null
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-031-2026-10-26.dump"
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. nuovo account sintetico di Redazione (solo database locale)
$segreta = Read-Host -AsSecureString "Password nuova per qa-1g-w5@locale.invalid (almeno 12 caratteri)"
$env:ACCOUNT_EMAIL = 'qa-1g-w5@locale.invalid'
$env:ACCOUNT_NAME = 'Prova sintetica 1G-W5'
$env:ACCOUNT_PASSWORD = [System.Net.NetworkCredential]::new('', $segreta).Password
$env:ACCOUNT_ROLE = 'editor'
pnpm --filter @amoris/api account:create

# 3. stesse credenziali per le due prove
$env:QA_EMAIL = $env:ACCOUNT_EMAIL
$env:QA_PASSWORD = $env:ACCOUNT_PASSWORD
$env:API = 'http://127.0.0.1:3002'
$env:SITO = 'http://127.0.0.1:3200'

# 4. anteprima contro pagina pubblica, su tutti i contenuti pubblicati
pnpm exec tsx tests/visual/prova-anteprima.ts

# 5. 1E-19 (salta questo comando se hai scelto solo la prima prova, §1)
pnpm exec tsx tests/visual/prova-1e-19.ts

# 6. togli credenziali e password dalla sessione di PowerShell
Remove-Item Env:ACCOUNT_EMAIL, Env:ACCOUNT_NAME, Env:ACCOUNT_PASSWORD, Env:ACCOUNT_ROLE, Env:QA_EMAIL, Env:QA_PASSWORD
Remove-Variable segreta
```

Il passo 2 deve rispondere `Account creato: qa-1g-w5@locale.invalid, ruolo «editor». La
password non viene mostrata.` L'account resta nel database di sviluppo: è sintetico, e la sua
rimozione dagli ambienti di prova è già prevista a fine fase (1G-27). Con la prova 1E-19,
le 4 righe «Ha modificato» del §1 saranno a nome di questo account.

## 4. Esito atteso

| Passo | Atteso |
|---|---|
| 1 | il file `amoris-prima-HO-031-2026-10-23.dump` in `$HOME\amoris-backup\` |
| 3 | `contenuti pubblicati con indirizzo: N`, poi `N/N identici`; esiti in `docs/qa/confronto/prova-anteprima.json` (solo indirizzi pubblici ed esiti) |
| 4 | `identici: 4/4`; esiti in `docs/qa/confronto/prova-1e-19.json` |

## 5. Se qualcosa va storto

| Problema | Che cosa fare |
|---|---|
| Il passo 3 o 4 stampa righe `DIVERSO: …` | non ripetere: mandami le righe (contengono solo tipo e indirizzo pubblico) e mi fermo ad analizzare |
| `QA_PASSWORD non impostata` | il passo 2 non è andato: ripetilo nella stessa finestra di PowerShell |
| Errore di accesso (401) | password errata o account disattivato: scrivimelo, non riprovare più di due volte |
| `ECONNREFUSED` su 3002 o 3200 | i server non sono accesi: scrivimelo e li riavvio |
| Vuoi annullare le scritture della prova 1E-19 | **solo su tua conferma esplicita**, ripristino della copia del passo 1: `docker cp "$HOME\amoris-backup\amoris-prima-HO-031-2026-10-23.dump" amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists /tmp/copia.dump'`, poi `docker exec amoris-dev-db-1 rm /tmp/copia.dump` (sostituisce tutto il database con lo stato del passo 1) |

## 6. Come segnalare il completamento

Rispondi con le righe finali dei passi 3 e 4, per esempio:

```
HO-031 fatto: prova-anteprima N/N identici; prova-1e-19 identici 4/4 (oppure: 1E-19 non eseguita).
```
