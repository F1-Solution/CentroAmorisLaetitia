# Stack di produzione e di staging

Compose, Caddy ed esempio d'ambiente della piattaforma in produzione (fase 1F, wave W2).
Lo stesso `compose.yml` serve produzione e staging: cambia solo il file d'ambiente (DR-296).
Lo sviluppo resta in `infra/compose/` e non usa questi file.

## 1. Che cosa c'è

| File | Ruolo |
|---|---|
| `compose.yml` | servizi `caddy`, `web`, `admin`, `api`, `scrub`, `db`, `objects`, `objects-init`; `migrate` nel profilo `release`; `backup` nel profilo `backup` (a termine, solo produzione, rete d'uscita `backup-out`) |
| `caddy/Caddyfile` | instradamento (ADR-003 §3), HTTPS, HSTS, intestazioni, CSP in sola segnalazione (DR-364) |
| `caddy/production.caddy`, `caddy/staging.caddy` | regole per ambiente; lo staging non si fa indicizzare |
| `ambiente/production.env`, `ambiente/staging.env` | impostazioni **non segrete** lette da Caddy e dall'API |
| `.env.production.example` | modello del file per `--env-file`, con i comandi che generano i segreti |
| `tests/` | prove del Compose e di Caddy (`pnpm test:images`) e aggiunte per la prova locale (`compose.e2e.yml`) |

Le immagini si costruiscono dai Dockerfile di `infra/docker/`. In CI il lavoro `immagini`
di `.github/workflows/ci.yml` le pubblica nel registro privato di GitHub (DR-356) come
`ghcr.io/<proprietario>/amoris-<app>:<hash del commit>`, dopo la verifica di un push su
`main` e dopo il controllo dei file (`infra/docker/check-image.mjs`). `migrate` usa
l'immagine dell'API.

## 2. File d'ambiente

- Il file per `--env-file` contiene i segreti: si copia da `.env.production.example`
  **fuori dal repository**, con permessi 600, e si riempie riga per riga. Copiato così
  com'è, il Compose non parte e dice quale chiave manca.
- Ogni segreto si genera con il comando scritto sopra la sua riga (`openssl rand -hex …`).
- Produzione e staging hanno file separati e **nessun segreto in comune**.
- Le regolazioni dell'API (tempi dell'accesso, limiti dei form) vanno in
  `ambiente/<valore>.env`, non nel file dei segreti: il Compose passa all'API solo le
  chiavi che nomina.

## 3. Avvio

Dalla radice del repository, con `<file>` il file d'ambiente:

```
docker compose -f infra/deploy/compose.yml --env-file <file> up -d --wait db objects objects-init
docker compose -f infra/deploy/compose.yml --env-file <file> --profile release run --rm migrate
docker compose -f infra/deploy/compose.yml --env-file <file> up -d --wait
```

Le migrazioni non partono mai all'avvio (ADR-009 §4.4): si eseguono con il secondo comando,
a ogni rilascio che le porta. Il progetto Compose si chiama `amoris-<AMORIS_ENV>`: volumi e
reti di produzione e di staging non si toccano.

## 4. Verifica

| Indirizzo | Risposta attesa |
|---|---|
| `https://<sito>/health/live/` | 200 (sito) |
| `https://<sito>/admin/health/live` | 200 (area) |
| `https://<sito>/api/health/ready` | 200 (API e database) |
| `https://<sito-staging>/robots.txt` | `Disallow: /` |

`docker compose ... ps` deve mostrare ogni servizio `healthy`; `objects-init` esce con 0.

## 5. Arresto

```
docker compose -f infra/deploy/compose.yml --env-file <file> down
```

`down` lascia i volumi (database, archivio, certificati). `down -v` li **cancella**: mai
sulla produzione, e sullo staging solo con conferma (PLAN §7 riga 7).

## 6. Prova locale dello stack

Per provare le immagini in locale, con dati sintetici:

1. costruire le immagini: `docker build -f infra/docker/<app>.Dockerfile -t amoris-<app>:prova .`
   per `web`, `admin`, `api`, `scrub`;
2. scrivere un file d'ambiente sintetico fuori dal repository, con `IMAGE_PREFIX=amoris`,
   `IMAGE_TAG=prova`, `CADDY_SITE_ADDRESS=localhost` (Caddy emette da sé un certificato
   interno), porte libere (per esempio 8080 e 8443), `POSTGRES_DB=amoris_e2e`, segreti
   generati, e `E2E_DB_PORT`, `E2E_OBJECTS_PORT` per l'aggiunta di prova;
3. avviare come al §3 aggiungendo `-f infra/deploy/tests/compose.e2e.yml` a ogni comando:
   apre database e archivio su `127.0.0.1` e toglie le attese dell'accesso. **Mai sul server**;
4. eseguire gli e2e attraverso Caddy, con le stesse variabili del file d'ambiente:

   ```
   E2E_STACK_URL=https://localhost:8443
   DATABASE_URL=postgres://amoris:<POSTGRES_PASSWORD>@127.0.0.1:<E2E_DB_PORT>/amoris
   S3_ENDPOINT=http://127.0.0.1:<E2E_OBJECTS_PORT>
   pnpm exec tsx tests/e2e/prepara.ts
   pnpm exec playwright test
   ```

   Con `E2E_STACK_URL` le prove non avviano server propri; `prepara.ts` ricrea il database
   `amoris_e2e` dello stack e scrive il seme sintetico, senza compilare le applicazioni.

Produzione e staging possono girare insieme con porte diverse (per esempio 8443 e 9443).

## 7. Memoria

Limiti in MiB (DR-334: produzione e staging insieme sotto i 7 GiB degli 8 del server).
Il backup gira solo in produzione (DR-372): i due ambienti differiscono.

| Servizio | Produzione | Staging |
|---|---:|---:|
| caddy | 128 | 128 |
| web | 384 | 384 |
| admin | 256 | 256 |
| api | 640 | 640 |
| scrub | 1024 | 1024 |
| db | 512 | 512 |
| objects | 384 | 384 |
| backup | 384 | non gira |
| **Per ambiente** | **3712** | **3328** |
| **Produzione e staging** | **7040** | |

7040 MiB restano sotto i 7168 (7 GiB). `objects-init` (64) e `migrate` (256) escono a lavoro
finito; anche `backup` è un processo a termine: la memoria è occupata solo durante il backup. La
taratura sul server è della W5.

## 8. Da fare nelle wave successive

- **W4, revisione di sicurezza:** l'API usa le credenziali principali di MinIO; serve un
  utente di servizio limitato ai due bucket. CSP da applicare dopo la sola segnalazione.
- **W4, firewall dell'host:** Docker da solo non limita la destinazione della rete `backup-out`
  (non interna). Servono regole sulla catena `DOCKER-USER` che lascino uscire quella rete solo
  verso la Storage Box sulla porta 23 e verso il DNS, e blocchino il resto.
- **W4, segreti del backup:** `RESTIC_PASSWORD`, la password del database e le chiavi di MinIO stanno
  nell'ambiente del contenitore e si leggono con `docker inspect`: rischio accettato, uguale a quello
  dell'API. Solo chiave SSH e `known_hosts` sono file.
- **W5, server:** uno staging su porte diverse da 80 e 443 non ottiene un certificato
  pubblico da solo (instradamento per nome davanti ai due Caddy, o certificato DNS);
  sul server serve la cartella `infra/` intera (`objects-init` usa
  `infra/compose/create-buckets.sh`); file di `infra/deploy/caddy/` leggibili da tutti
  (Caddy gira senza capacità); HSTS più lungo dopo la verifica di HTTPS; lavoro di
  rilascio di DR-357.
- **Fornitura dei programmi:** `ffmpeg` arriva da una release automatica di BtbN, che
  potrebbe non restare pubblicata; serve una copia propria prima che sparisca.
