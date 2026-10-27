# HO-035 — Prove 1E-19 e anteprima sul collaudo (`1G-W7`, T7)

Fase 1G, wave `1G-W7`. Scritto il 2026-10-27.

Le due prove di 1G-22 girano sull'ambiente di collaudo creato con HO-034, **non** sul database
di sviluppo (DR-265, D161 = A). Le esegui tu, con l'account sintetico di Redazione. Tutto
resta in locale: nessuna email, nessun servizio esterno.

---

## 1. Che cosa provano e che cosa scrivono

| Prova | Criterio | Che cosa scrive nel database `amoris_collaudo` |
|---|---|---|
| `tests/visual/prova-anteprima.ts` | per ogni contenuto pubblicato, l'anteprima e la pagina pubblica hanno lo stesso HTML | solo l'ingresso e l'uscita dell'account (una sessione e righe di accesso) |
| `tests/visual/prova-1e-19.ts` | salvare dal CMS senza modifiche non cambia la pagina pubblica (1E-19) | come sopra, più 4 salvataggi **senza modifiche** e 4 righe «Ha modificato» a nome di `redazione@example.invalid` |

I 4 salvataggi **restano** nel database di collaudo. La `1G-W8` comincia con il ripristino
dell'ambiente (`crea.ps1`), che li annulla. Il database di sviluppo non si tocca, quindi non
serve una copia di salvataggio.

## 2. Prerequisiti

- HO-034 fatto: collaudo acceso su `3300`, `3301`, `3302`, account `redazione@example.invalid` creato.
- La password di quell'account.

## 3. Comando (PowerShell 7.3 o successivo, dalla cartella del progetto)

Serve PowerShell **7.3 o successivo** (come in HO-034 §3): aprilo dal menu Start («PowerShell 7») o scrivendo `pwsh` in un terminale, e controlla la versione con `$PSVersionTable.PSVersion`.

Lo script ti chiede la password di `redazione@example.invalid`, imposta indirizzi e account
del collaudo, esegue le due prove una dopo l'altra e toglie tutto dalla sessione. Si ferma con
un errore, prima di qualunque prova, se l'indirizzo del database non punta a `amoris_collaudo`.

```powershell
Set-Location C:\work\CentroAmorisLaetitia
.\tools\collaudo\esegui-prove.ps1
```

## 4. Esito atteso

| Passo | Atteso |
|---|---|
| prova dell'anteprima | `contenuti pubblicati con indirizzo: N`, poi `N/N identici` |
| 1E-19 | `identici: 4/4` |
| fine | `Esito: prova dell'anteprima codice 0, 1E-19 codice 0 (0 = riuscita).` |

Gli esiti si scrivono in `docs/qa/confronto/prova-anteprima.json` e
`docs/qa/confronto/prova-1e-19.json` (solo indirizzi pubblici ed esiti), sovrascrivendo quelli
dell'esecuzione di HO-031: la versione precedente resta nella storia Git, e ora i due file
contengono gli esiti del collaudo.

## 5. Se qualcosa va storto

| Problema | Che cosa fare |
|---|---|
| righe `DIVERSO: …` | non ripetere. Ogni riga contiene tipo e indirizzo pubblico **e un estratto della differenza, che può essere testo dei contenuti**: non incollarlo nella segnalazione. Mandami solo quante righe `DIVERSO` ci sono e, per ciascuna, tipo e indirizzo pubblico |
| errore di accesso (401) | password errata o account non creato: non riprovare più di due volte e scrivimelo |
| lo script si rifiuta per l'indirizzo del database | non proseguire: scrivimelo (le prove non partono) |
| `ECONNREFUSED` su 3300 o 3302 | il collaudo non è acceso: `.\tools\collaudo\avvia.ps1`, oppure scrivimelo |

## 6. Come segnalare il completamento

```
HO-035 fatto: prova-anteprima N/N identici; prova-1e-19 identici 4/4.
```
