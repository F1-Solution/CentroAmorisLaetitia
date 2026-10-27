# Ambiente di collaudo

Scelta DR-266 (D162 = A). Script PowerShell 7.3 o successivo, da lanciare dalla copia di lavoro di sviluppo con Docker acceso e i server di sviluppo (3001, 3002, 3200) spenti.

| Script | Che cosa fa |
|---|---|
| `crea.ps1 -Commit <sha>` | copia database e bucket di sviluppo, svuota compilazioni e sessioni, disattiva gli account copiati e rende inutilizzabile la loro password (`password_hash` nullo), crea la copia di lavoro `C:\work\amoris-collaudo` e installa le dipendenze; su un ambiente esistente lo cancella e lo ricrea, dopo conferma scritta. Se la copia del database fallisce a metà, cancella da sé la sola copia di collaudo |
| `avvia.ps1` | compila se serve e avvia API `:3302`, sito `:3300`, area `:3301/admin`; rifiuta se i server di sviluppo sono accesi, se `form_submissions` non è vuota o se c'è un account attivo fuori da `@example.invalid`; l'API deve rispondere 200 su `/health/ready` |
| `ferma.ps1` | ferma ciò che ascolta sulle porte del collaudo (solo 3300-3399) e appartiene alla copia di lavoro del collaudo |
| `crea-account.ps1` | crea un account sintetico (`@example.invalid`) nel solo database di collaudo, con password chiesta a terminale |
| `esegui-prove.ps1` | esegue la prova dell'anteprima e 1E-19 sul collaudo con l'account di Redazione (HO-035) |
| `crea.ps1 -Rimuovi` | cancella database, bucket e copia di lavoro, dopo conferma scritta |
| `crea.ps1 -WhatIf` | stampa i passi senza scrivere nulla (restano le letture di controllo) |
| `comune.ps1` | funzioni condivise, non si lancia |

`-Commit` vuole uno sha che esista; se coincide con `HEAD` e ci sono file modificati in `apps`, `packages` o `pnpm-lock.yaml`, `crea.ps1` rifiuta.

Nomi: database `amoris_collaudo`, bucket `collaudo-public` e `collaudo-private`. Gli script
rifiutano qualunque destinazione che non abbia questa forma (confronti sensibili alle maiuscole) e, comunque, il database e i
bucket di sviluppo. Per una prova si possono usare `-Database amoris_collaudo_prova
-PrefissoBucket collaudo-prova -Worktree C:\work\amoris-collaudo-prova` e porte diverse.

Cosa scrivono: solo il database e i bucket di collaudo, la cartella `C:\work\amoris-collaudo` e
la cartella dei log `C:\work\amoris-collaudo.stato`. Sul database di sviluppo fanno soltanto
`SELECT`. Stampano solo conteggi; l'uscita completa di un errore di `psql` o `pg_restore` va in un file della cartella dei log, a video restano codice e prima riga `ERROR:`. Le password non passano dalla riga di comando.

Ripristino: `crea.ps1` sopra un ambiente esistente. La copia di lavoro si tiene se è già sullo
stesso commit e senza modifiche (restano installazione e compilazioni); `-RifaiWorktree` la rifà.
