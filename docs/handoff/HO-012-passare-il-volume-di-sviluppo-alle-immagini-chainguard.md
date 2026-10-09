# HO-012 — Passare il volume di sviluppo alle immagini Chainguard di MinIO

**Fase:** 1D, wave `1D-W12`. **Stato:** chiuso il 2026-10-09, verificato: server sano, 1477 e 4 oggetti, accesso anonimo 403.

## 1. Perché serve

DR-101 sostituisce le immagini di MinIO, non più scaricabili da quay.io, con
quelle di Chainguard. Il nuovo server gira come utente `65532`, non come root,
e il volume `amoris-dev_objects-data` è stato creato dall'immagine precedente,
che girava come root: senza questo passo il server **non parte** («Unable to
write to the backend»).

Il passo è stato provato il 2026-10-09 su una copia del volume, poi eliminata:
dopo il cambio di proprietario il server parte e legge gli stessi oggetti del
server attuale, 1477 nel bucket pubblico e 4 in quello riservato.

Fino a questo passo il container attuale continua a funzionare con l'immagine
vecchia, già scaricata. **Non** eseguire `docker compose up` sul servizio
`objects` prima del passo 3: ricreerebbe il container con l'immagine nuova sul
volume non ancora riassegnato.

## 2. Prerequisiti

- Docker Desktop avviato, `amoris-dev-objects-1` in stato `healthy`.
- Nessun comando dell'importer, della suite di test o di `pnpm dev` in corso.
- Il ramo `main` aggiornato con il commit di DR-101.
- Cartella `~\amoris-backup` presente, con qualche GB libero.

## 3. Passi

In PowerShell, dalla radice del repository. La variabile evita di ripetere il
digest dell'immagine con la shell, usata solo per copia e cambio di proprietario.

```powershell
$DEV = 'cgr.dev/chainguard/minio:latest-dev@sha256:5ed9207c9d1bf50e2b0aa917ffb0fede5507651178b7bd4119ff75319e7fdeec'
$COMPOSE = 'docker compose -f infra/compose/docker-compose.yml --env-file .env'
```

1. **Copia di salvataggio** del volume:

   ```powershell
   docker run --rm --user 0 -v amoris-dev_objects-data:/data:ro -v "$HOME\amoris-backup:/backup" --entrypoint /bin/sh $DEV -c "tar -cf /backup/objects-prima-DR-101-2026-10-09.tar -C /data ."
   ```

2. **Ferma** il server attuale:

   ```powershell
   Invoke-Expression "$COMPOSE stop objects"
   ```

3. **Riassegna** il volume all'utente del nuovo server:

   ```powershell
   docker run --rm --user 0 -v amoris-dev_objects-data:/data --entrypoint /bin/sh $DEV -c "chown -R 65532:65532 /data"
   ```

4. **Avvia** il server nuovo e riesegui la creazione dei bucket, che non cambia
   nulla se esistono già:

   ```powershell
   Invoke-Expression "$COMPOSE up -d --wait objects"
   Invoke-Expression "$COMPOSE run --rm objects-init"
   ```

5. **Controlla:** `docker ps --format "{{.Names}} {{.Image}} {{.Status}}"`

## 4. Esito atteso

- Passo 1: il file `objects-prima-DR-101-2026-10-09.tar` esiste in `~\amoris-backup`.
- Passo 4: `objects-init` stampa due volte «bucket gia' presente» e poi «bucket pronti.».
- Passo 5: `amoris-dev-objects-1` usa `cgr.dev/chainguard/minio` ed è `Up … (healthy)`.

## 5. Se fallisce

- **Il server non parte dopo il passo 4:** copia le ultime righe di
  `docker logs amoris-dev-objects-1` e segnalale. Non ricreare il volume.
- **Per tornare indietro:** riporta il proprietario a root con il passo 3
  scritto `chown -R 0:0 /data`, poi avvia l'immagine precedente, che è ancora
  nella cache, con il file Compose del commit precedente:
  `git show HEAD~1:infra/compose/docker-compose.yml > $env:TEMP\compose-prima.yml`, poi
  `docker compose -p amoris-dev -f $env:TEMP\compose-prima.yml --env-file .env up -d objects`.
  Se i dati risultassero danneggiati, si ripristinano dalla copia del passo 1.

## 6. Come segnalare il completamento

Scrivi «HO-012 fatto». Il conteggio degli oggetti nei due bucket lo verifico io
contro i valori attesi, 1477 e 4.
