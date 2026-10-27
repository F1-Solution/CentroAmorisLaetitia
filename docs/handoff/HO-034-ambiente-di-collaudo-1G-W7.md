# HO-034 — Creare l'ambiente di collaudo (`1G-W7`, T7)

Fase 1G, wave `1G-W7`. Scritto il 2026-10-27.

La creazione dell'ambiente di collaudo è un'azione a **conferma obbligatoria** (`CLAUDE.md`,
`PLAN.md` §7 conferma 3). Questo documento chiede una conferma per **una** esecuzione di
`crea.ps1`. Tutto resta sulla tua macchina: nessuna email, nessun servizio esterno, nessun
deploy. Le scelte sono DR-215, DR-223 e DR-266 (D162 = A).

---

## 1. Che cosa crea

| Che cosa | Dove | Contenuto |
|---|---|---|
| Database `amoris_collaudo` | nello stesso Postgres di sviluppo | copia di `amoris`, con compilazioni dei moduli e sessioni **svuotate**; tutti gli account copiati **disattivati** e con la **password resa inutilizzabile** (nessuno può più entrare con quella che aveva) |
| Bucket `collaudo-public` e `collaudo-private` | nello stesso MinIO di sviluppo | copia dei due bucket di sviluppo, entrambi senza accesso anonimo |
| Copia di lavoro `C:\work\amoris-collaudo` | fuori dal repository | codice del commit da collaudare, con installazione e compilazioni proprie |
| Sito, area, API | `http://127.0.0.1:3300`, `http://127.0.0.1:3301/admin`, `http://127.0.0.1:3302` | si accendono con `avvia.ps1` |
| Account `redazione` e `amministrazione` | database di collaudo | li crei **tu**, con password che scegli tu |

Due cose da sapere sul contenuto della copia:

- La tabella dello storico dei messaggi e delle statistiche del sito vecchio (`legacy_email_log`)
  viene copiata com'è, perché è dati personali di terzi che stanno già nel database di
  sviluppo; nessuna schermata dell'area la mostra.
- Dopo la copia lo script confronta i conteggi di 19 tabelle più le compilazioni dei moduli
  (le righe svuotate devono essere quante quelle di sviluppo). **Non confronta** queste 13:
  `content_drafts`, `document_terms`, `import_id_map`, `import_issues`, `import_runs`,
  `legacy_download_stats`, `legacy_email_log`, `permissions`, `role_permissions`, `roles`,
  `seo_templates`, `term_seo` e `sessions` (quest'ultima si svuota apposta).
- Il registro delle operazioni del collaudo riporta i **nomi veri** degli autori di sviluppo
  (gli account sono disattivati, ma i nomi nel registro restano).

Il database `amoris` e i suoi bucket **non si scrivono**: gli script li leggono soltanto.
Per questo non serve una copia di sicurezza di sviluppo.

## 2. Impatto

- Disco: una copia del database, una dei file dei media e una copia di lavoro con le sue
  dipendenze.
- Tempo: alcuni minuti per la copia e l'installazione, altri per la compilazione.
- Memoria: con il collaudo acceso i server di sviluppo (porte 3000, 3001, 3002, 3200) devono
  essere **spenti**; `avvia.ps1` si rifiuta di partire se non lo sono.
- Le porte 3300, 3301 e 3302 devono essere libere.

## 3. Prerequisiti

- Docker acceso, con `amoris-dev-db-1` e `amoris-dev-objects-1` in salute.
- PowerShell **7.3 o successivo**, `git` e `pnpm` nel `PATH`. Apri «PowerShell 7» dal menu Start, oppure scrivi `pwsh` in un terminale (il PowerShell blu di Windows, versione 5, **non basta**). Controlla la versione con:

  ```powershell
  $PSVersionTable.PSVersion
  ```

  Deve mostrare `Major` 7 e `Minor` 3 o più (per esempio `7.4.1`). Se non c'è, scrivimelo.
- I server di sviluppo (porte 3000, 3001, 3002, 3200) spenti: `crea.ps1` e `avvia.ps1` si rifiutano di partire se non lo sono.
- Il **codice del commit da collaudare**: te lo do io, completo (40 caratteri), dopo il commit della wave. Non usare `HEAD`: se ci sono modifiche non salvate, il collaudo non le conterrebbe.

## 4. Comandi (PowerShell 7.3 o successivo, dalla cartella del progetto)

### 4.1 Creare l'ambiente

Scrivi al posto di `SHA-COMPLETO-DEL-COMMIT` il codice che ti ho dato (40 caratteri, uno solo
tra gli apici). Se lo lasci com'è, lo script si ferma con «Il commit indicato non esiste».

```powershell
Set-Location C:\work\CentroAmorisLaetitia
$commit = 'SHA-COMPLETO-DEL-COMMIT'
.\tools\collaudo\crea.ps1 -Commit $commit
```

Se esiste già un ambiente di collaudo, lo script lo cancella prima di ricrearlo e ti chiede
di scrivere il nome del database (`amoris_collaudo`) per confermare.

### 4.2 Accenderlo

```powershell
.\tools\collaudo\avvia.ps1
```

Prima di accendere, lo script controlla che nel collaudo non ci siano compilazioni dei moduli
né account attivi fuori da `@example.invalid`; se ci sono, si rifiuta.

### 4.3 Creare i due account sintetici

Per ciascuno lo script ti chiede la password (almeno 12 caratteri, la scegli tu, non la scrivi
qui né in chat). Lavora solo sul database `amoris_collaudo` e si rifiuta se l'indirizzo del
database non punta lì.

```powershell
Set-Location C:\work\CentroAmorisLaetitia
.\tools\collaudo\crea-account.ps1 -Indirizzo 'redazione@example.invalid' -Nome 'Redazione sintetica del collaudo' -Ruolo editor
.\tools\collaudo\crea-account.ps1 -Indirizzo 'amministrazione@example.invalid' -Nome 'Amministrazione sintetica del collaudo' -Ruolo amministrazione
```

## 5. Esito atteso

| Passo | Atteso |
|---|---|
| 4.1 | righe di riepilogo con soli numeri: contenuti e media uguali a quelli di sviluppo, oggetti copiati uguali a quelli di sviluppo, compilazioni svuotate, sessioni tolte, account disattivati con `attivi rimasti: 0`, password rese inutilizzabili con `rimaste: 0` |
| 4.2 | `API`, `sito` e `area` con un codice di risposta, poi `Collaudo acceso: …` |
| 4.3 | per ciascun comando, `Account creato: …@example.invalid, ruolo «…». La password non viene mostrata.` |

## 6. Se qualcosa va storto

| Problema | Che cosa fare |
|---|---|
| `crea.ps1` si ferma con un messaggio | se aveva già cominciato a copiare, ha cancellato da sé la copia incompleta; non rilanciarlo a ripetizione. Mandami solo il messaggio finale (codice e riga `ERROR:`). L'uscita completa è in un file di `C:\work\amoris-collaudo.stato\` (nome `errori-…`; se la cartella non c'è ancora, lo script la crea e resta anche se la creazione fallisce; `.\tools\collaudo\crea.ps1 -Rimuovi` la toglie): **non inviarlo**, può contenere dati |
| `avvia.ps1` dice che ci sono server di sviluppo accesi | spegnili e rilancia; se non sai come, scrivimelo |
| `avvia.ps1` dice «Compilazione non riuscita» | mandami le ultime righe di `C:\work\amoris-collaudo.stato\compilazione.log` |
| `crea-account.ps1` risponde «esiste già un account» | l'account c'è già: non serve rifarlo |
| `crea-account.ps1` si rifiuta per l'indirizzo del database | non proseguire: scrivimelo (non crea nulla in `amoris`) |
| Un servizio non risponde | `.\tools\collaudo\ferma.ps1`, poi di nuovo `.\tools\collaudo\avvia.ps1` |

## 7. Tornare indietro

```powershell
.\tools\collaudo\ferma.ps1
.\tools\collaudo\crea.ps1 -Rimuovi
```

Cancella il database di collaudo, i due bucket e la copia di lavoro, dopo una tua conferma
scritta. Non tocca nulla di sviluppo.

## 8. Verifica successiva

Controllo io, in sola lettura: sito, area e API rispondono; le compilazioni sono 0; gli
account attivi sono 2; gli oggetti copiati sono tanti quanti quelli di sviluppo.

## 9. Come segnalare il completamento

```
HO-034 fatto: ambiente creato e acceso, due account creati.
```

Se qualche passo è fallito, scrivi il numero del passo e il messaggio finale.
