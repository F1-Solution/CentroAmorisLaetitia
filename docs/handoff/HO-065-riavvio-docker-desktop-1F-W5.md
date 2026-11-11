# HO-065 — Riavvio di Docker Desktop sulla postazione di sviluppo (Fase 1F, W5)

**Stato:** ⏳ **da eseguire** — Docker Desktop risponde «Docker Desktop is unable to start» dal
2026-11-11 mattina; la verifica della T5b è ferma.

**Scopo:** riportare in funzione Docker Desktop per finire la verifica della T5b (suite delle
immagini e parte A con il database di sviluppo). I numeri `HO-062`…`HO-064` sono riservati agli
handoff del server della T6.

**Chi esegue:** il manutentore, sulla postazione di sviluppo. Nessun dato reale coinvolto: i
volumi contengono solo dati sintetici.

---

## 1. Prerequisiti

- [ ] Nessun agente sta usando Docker: il coordinatore ha fermato la verifica (rapporto parziale in
      `.superpowers/sdd/W5-PLAN/t5b-verifica-report.md`).
- [ ] Nessun lavoro aperto negli altri progetti che usano Docker (`agenticos-*`, `quixant-docs-*`):
      il riavvio ferma anche i loro contenitori.

## 2. Procedura

1. Dall'icona di Docker nell'area di notifica scegli **Quit Docker Desktop** e aspetta che l'icona
   sparisca (fino a un minuto).
2. Se l'icona non sparisce, in PowerShell come utente normale:

   ```powershell
   Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue | Stop-Process
   wsl --shutdown
   ```

3. Avvia **Docker Desktop** dal menu Start e aspetta che lo stato diventi «Engine running».
4. Verifica in PowerShell, dalla cartella del repository:

   ```powershell
   docker info --format '{{.ServerVersion}}'
   docker volume ls -q | Measure-Object | Select-Object -ExpandProperty Count
   docker ps --format '{{.Names}} {{.Status}}'
   ```

**Esito atteso:** una versione (oggi `29.9.3`); il numero dei volumi è **53** (46 più i 7 lasciati
apposta dagli e2e attraverso l'ingresso della verifica: non cancellarli, li elenca il coordinatore);
`amoris-dev-db-1` e `amoris-dev-objects-1` ripartono da soli (`restart: unless-stopped`) e
risultano `Up … (healthy)` entro un paio di minuti.

**Non fare:** `pnpm compose:reset`, `docker system prune`, «Clean / Purge data», «Reset to factory
defaults» o cancellazioni di volumi o immagini: perderesti le immagini `w5-t5b` e i dati di
sviluppo.

## 3. Se fallisce

- «Docker Desktop is unable to start» anche dopo il passo 2: riavvia Windows, poi ripeti i passi
  3 e 4.
- `amoris-dev-db-1` o `amoris-dev-objects-1` non compaiono dopo due minuti: lancia
  `pnpm compose:up` dalla cartella del repository e ripeti `docker ps`; se fallisce, copia l'errore
  (senza valori del file `.env`) e segnalalo.
- Il numero dei volumi è minore di 53: non fare altro e segnalalo.

## 4. Come segnalare il completamento

Scrivi nella sessione: «HO-065 fatto», con le uscite del passo 4 (versione, numero dei volumi,
righe di `docker ps`).
