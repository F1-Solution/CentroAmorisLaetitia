# Stack di produzione e di staging

Compose, Caddy ed esempio d'ambiente della piattaforma in produzione (fase 1F, wave W2).
Lo stesso `compose.yml` serve produzione e staging: cambia solo il file d'ambiente (DR-296).
Lo sviluppo resta in `infra/compose/` e non usa questi file.

## 1. Che cosa c'è

| File | Ruolo |
|---|---|
| `compose.yml` | servizi `caddy`, `web`, `admin`, `api`, `scrub`, `db`, `db-init`, `objects`, `objects-init`; `migrate` nel profilo `release`; `backup` e `restore` nel profilo `backup` (a termine, solo produzione, rete d'uscita `backup-out`) |
| `caddy/Caddyfile` | instradamento (ADR-003 §3), HTTPS, HSTS, intestazioni, CSP in sola segnalazione (DR-364) |
| `caddy/production.caddy`, `caddy/staging.caddy` | regole per ambiente; lo staging non si fa indicizzare |
| `ambiente/production.env`, `ambiente/staging.env` | impostazioni **non segrete** lette da Caddy e dall'API |
| `.env.production.example` | modello del file per `--env-file`, con i comandi che generano i segreti |
| `db-init/roles.sql` | ruoli del database e loro privilegi, eseguito da `db-init` a ogni avvio; vedi §2 |
| `objects/create-service-users.sh` | utenti di servizio dell'archivio, eseguito da `objects-init` a ogni avvio; vedi §2 |
| `backup/` | script del servizio `backup` (`amoris-backup`, `lib.sh`), copiati nell'immagine; vedi §8 |
| `backup-chiavi/` | cartella **fuori da Git** per la chiave SSH e il `known_hosts` del backup (percorso predefinito) |
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
- **Privilegi minimi (T6g).** Ogni servizio riceve solo la credenziale che gli serve:

  | Credenziale | Chi la riceve | Che cosa può |
  |---|---|---|
  | `POSTGRES_PASSWORD` (superutente) | `db`, `db-init` | tutto; mai le applicazioni |
  | `DB_OWNER_PASSWORD` (`amoris_owner`) | `migrate`, `restore` | possiede database e oggetti, crea e cambia lo schema |
  | `DB_APP_PASSWORD` (`amoris_app`) | `api` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` e sequenze; niente DDL, niente `COPY … PROGRAM` |
  | `DB_BACKUP_PASSWORD` (`amoris_backup`) | `backup` | sola lettura di ogni tabella (`pg_read_all_data`) |
  | `S3_ACCESS_KEY`, `S3_SECRET_KEY` (amministratore) | `objects`, `objects-init` | tutto; mai le applicazioni |
  | `S3_API_SECRET_KEY` (`amoris-api`) | `api`, `restore` | legge, scrive e cancella solo nei due bucket |
  | `S3_BACKUP_SECRET_KEY` (`amoris-backup`) | `backup` | legge solo i due bucket |

  I ruoli e gli utenti si creano e si riallineano (password comprese) a **ogni** `up`:
  `db-init` esegue `db-init/roles.sql` come superutente e `objects-init` esegue
  `objects/create-service-users.sh` come amministratore, entrambi senza effetti se già a posto.
  Per ruotare una password si cambia il file d'ambiente e si rifà `up -d`. I privilegi valgono
  anche per le tabelle create dalle migrazioni future. I nomi dei ruoli e degli utenti sono
  fissi; solo le password sono segrete.
- Le regolazioni dell'API (tempi dell'accesso, limiti dei form) vanno in
  `ambiente/<valore>.env`, non nel file dei segreti: il Compose passa all'API solo le
  chiavi che nomina.

## 3. Avvio

Dalla radice del repository, con `<file>` il file d'ambiente:

```
docker compose -f infra/deploy/compose.yml --env-file <file> up -d --wait db objects db-init objects-init
docker compose -f infra/deploy/compose.yml --env-file <file> --profile release run --rm migrate
docker compose -f infra/deploy/compose.yml --env-file <file> up -d --wait
```

Le migrazioni non partono mai all'avvio (ADR-009 §4.4): si eseguono con il secondo comando,
a ogni rilascio che le porta. Il progetto Compose si chiama `amoris-<AMORIS_ENV>`: volumi e
reti di produzione e di staging non si toccano.

### Indirizzo del client e sottorete interna

L'API si fida di `X-Forwarded-For` solo dalla rete interna `app` (variabile `TRUSTED_PROXY`, fissata dal Compose uguale ad `APP_SUBNET`, predefinita `10.77.84.0/24`). Produzione e staging sullo stesso server impostano due `APP_SUBNET` diverse nel proprio file d'ambiente. Senza `TRUSTED_PROXY` l'API non si fida di nessuno.

### Sblocco di un account bloccato per troppi tentativi

Il blocco scade da solo 15 minuti dopo l'ultimo fallimento vero. Per sbloccare subito un account, senza toccare le altre righe del registro (ne scrive una nuova, `auth.login_unblocked`):

```
docker compose -f infra/deploy/compose.yml --env-file <file> run --rm --no-deps -e ACCOUNT_EMAIL=<indirizzo> api node bin/account-unblock.js
```

Esito atteso: «Account sbloccato: N fallimenti azzerati. Operazione registrata.»; se l'indirizzo manca, esce con errore.

### Secondo fattore perso (telefono smarrito)

Ogni account entra con password e codice TOTP (app di autenticazione). Chi perde il telefono non può reimpostarlo dall'interfaccia: lo fa chi ha accesso al server, con questo comando che toglie il secondo fattore dell'account, chiude tutte le sue sessioni e scrive una riga di registro (`auth.second_factor_reset`, senza segreti). Al prossimo accesso la persona attiva un nuovo secondo fattore:

```
docker compose -f infra/deploy/compose.yml --env-file <file> run --rm --no-deps -e ACCOUNT_EMAIL=<indirizzo> api node bin/account-reset-totp.js
```

Esito atteso: «Secondo fattore reimpostato: N sessioni chiuse. Operazione registrata.»; se l'indirizzo manca o non corrisponde a nessun account, esce con errore. Verificare l'identità della persona prima di eseguirlo. La chiave `TOTP_ENCRYPTION_KEY` va conservata con gli altri segreti: se si perde, tutti i secondi fattori attivati vanno reimpostati.

### Pulizia di sessioni e tentativi falliti

Cancella le sessioni scadute o revocate da più di 30 giorni e le righe di registro dei tentativi d'accesso falliti (`auth.login` con esito `failure`, rifiuti per troppi tentativi compresi) più vecchie di 30 giorni; nessun'altra riga del registro. Si lancia a mano; il timer di systemd che la esegue ogni giorno si crea nella W5:

```
docker compose -f infra/deploy/compose.yml --env-file <file> run --rm --no-deps api node bin/auth-purge.js
```

Esito atteso: «Pulizia eseguita: N sessioni e M tentativi falliti cancellati.»; con codice diverso da 0 non ha cancellato nulla di cui fidarsi. La durata del registro delle operazioni è una decisione ancora aperta e questo comando non la tocca.

## 4. Verifica

| Indirizzo | Risposta attesa |
|---|---|
| `https://<sito>/health/live/` | 200 (sito) |
| `https://<sito>/admin/health/live` | 200 (area) |
| `https://<sito>/api/health/ready` | 404: i controlli di salute dell'API non sono pubblici, si leggono dall'interno (sotto) |
| `https://<sito>/api/openapi.json` | 404: la specifica non è pubblica |
| `https://<sito-staging>/robots.txt` | 401 senza password, `Disallow: /` con la password |

Lo staging sta dietro `basic_auth` di Caddy (DR-375), anche per `/api`, `/media`, `/forms` e `robots.txt`; il controllo di salute interno ne è escluso. Utente e hash bcrypt si danno in `STAGING_BASIC_AUTH_USER` e `STAGING_BASIC_AUTH_HASH` nel file dei segreti (hash tra apici singoli, generato con `caddy hash-password`): se mancano, Caddy non parte.

`docker compose ... ps` deve mostrare ogni servizio `healthy`; `objects-init` esce con 0.

Salute e specifica dell'API dall'interno (Caddy risponde 404 a `/api/health/*` e a `/api/openapi.json`):

```
docker compose -f infra/deploy/compose.yml --env-file <file> exec api node -e "fetch('http://127.0.0.1:3002/health/ready').then(async (r) => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1); })"
docker compose -f infra/deploy/compose.yml --env-file <file> exec api node -e "fetch('http://127.0.0.1:3002/openapi.json').then(async (r) => console.log(r.status, (await r.text()).length))"
```

`/health/live` si legge allo stesso modo; l'indirizzo interno `127.0.0.1:2020/health/live` di Caddy resta quello del controllo del Compose.

## 5. Arresto

```
docker compose -f infra/deploy/compose.yml --env-file <file> down
```

`down` lascia i volumi (database, archivio, certificati). `down -v` li **cancella**: mai
sulla produzione, e sullo staging solo con conferma (PLAN §7 riga 7).

## 6. Prova locale dello stack

Per provare le immagini in locale, con dati sintetici:

1. costruire le immagini: `docker build -f infra/docker/<app>.Dockerfile -t amoris-<app>:prova .`
   per `web`, `admin`, `api`, `scrub`, `backup`;
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
   Il database ricreato non ha più i privilegi dell'API: subito dopo `prepara.ts` si esegue
   `docker compose … run --rm db-init`, che ripristina proprietario e privilegi.

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

7040 MiB restano sotto i 7168 (7 GiB). `db-init` (64), `objects-init` (128) e `migrate` (256) escono a lavoro
finito; anche `backup` è un processo a termine: la memoria è occupata solo durante il backup. La
taratura sul server è della W5.

## 8. Backup e ripristino

Il servizio `backup` copia ogni giorno database e oggetti in un repository restic cifrato,
su una Storage Box raggiunta via SFTP (DR-335, DR-366). Gira solo in produzione (DR-372), a
termine e solo su richiesta: nessun processo resta acceso (DR-367). L'avvio giornaliero è un
timer di systemd sull'host, che si imposta nella W5. La prova di ripristino è in
`docs/deploy/backup-verification.md`.

In tutti i comandi: dalla radice del repository, `<file>` è il file d'ambiente di produzione.
Servono `RESTIC_PASSWORD`, `BACKUP_SFTP_HOST`, `BACKUP_SFTP_USER` e `BACKUP_SFTP_PATH` in quel
file, e la chiave SSH e `known_hosts` al loro posto (vedi «Chiavi e file»). Le chiavi si creano con `docs/handoff/HO-059-chiavi-dei-backup-1F-W5.md`.

### Comandi

| Comando | Che cosa fa |
|---|---|
| `init` | crea il repository sulla Storage Box, solo se non esiste |
| `backup` | dump del database, copia dei due bucket, istantanea cifrata, `forget --prune`; poi `check` va lanciato a parte |
| `check` | rilegge a campione il 10 % dei dati del repository |
| `restore <id\|latest>` | ripristina un'istantanea su database e bucket **vuoti**; si lancia con il servizio `restore` |

```
docker compose -f infra/deploy/compose.yml --env-file <file> --profile backup run --rm --no-deps backup init
docker compose -f infra/deploy/compose.yml --env-file <file> --profile backup run --rm backup backup
docker compose -f infra/deploy/compose.yml --env-file <file> --profile backup run --rm --no-deps backup check
docker compose -f infra/deploy/compose.yml --env-file <file> --profile backup run --rm restore restore latest
```

- `backup` legge con ruoli di sola lettura. `restore` scrive: è un servizio a parte, con il
  ruolo proprietario del database e l'utente dell'archivio dell'API, mai con il superutente né
  con le chiavi principali di MinIO.
- `init` va eseguito **una volta**, prima del primo backup: il `backup` non crea mai il
  repository da sé. Se il repository esiste, `init` non cambia nulla; se la password è
  sbagliata, esce con errore.
- `backup` e `restore` avviano da sé `db` e `objects`. `init` e `check` non ne hanno bisogno:
  con `--no-deps` non li avviano.
- `restore` accetta `latest` (l'ultima istantanea di host `amoris` con etichetta
  `amoris-backup`) oppure un identificativo, anche abbreviato.

### Conservazione e manutenzione

- Dopo ogni backup, `forget --prune` tiene 7 istantanee giornaliere e 4 settimanali, senza
  mensili: nessuna istantanea oltre circa 35 giorni (DR-379, che supera il 7/4/6 di DR-373).
- `forget` agisce **solo** sulle istantanee di host `amoris` con etichetta `amoris-backup`.
  Altre istantanee nello stesso repository non si toccano mai.
- `check` dura pochi secondi su dati piccoli e va lanciato ogni settimana dal timer.
- Il registro delle cancellazioni (DR-381) e il suo riuso dopo un ripristino non esistono
  ancora: si fanno nella `1F-W6`.

### Esito e codici d'uscita

Ogni comando stampa **una riga JSON** (comando, esito, durata, byte, identificativo
dell'istantanea, passo fallito, codice) e la scrive in `last-<comando>.json` nel volume
`backup-state` (`/backup/state`). Mai nomi di file né contenuti. Per leggerla:

```
docker compose -f infra/deploy/compose.yml --env-file <file> --profile backup run --rm --no-deps --entrypoint cat backup /backup/state/last-backup.json
```

| Codice | Significato |
|---:|---|
| 0 | riuscito |
| 64 | argomento mancante o non valido |
| 65 | destinazione del ripristino non vuota, o bucket mancante |
| 74 | volume di stato non scrivibile: si ferma prima di toccare dati e rete |
| 75 | un altro `backup` o `restore` è già in corso (un solo alla volta) |
| 78 | configurazione: variabile, chiave SSH o `known_hosts` mancante o non valida |
| altri | codice dello strumento che ha fallito (per esempio 10 e 12 di restic: repository assente, password sbagliata); 143 se il contenitore riceve SIGTERM |

Con codice diverso da 0 il campo `failed_step` dice dove si è fermato. Se anche il file di
stato non si scrive, la riga ha `"state_written":false`.

### Ripristino

Il ripristino rifiuta di partire (codice 65) se il database ha già schemi o tabelle, o se un
bucket manca o non è vuoto. Le migrazioni **non** si eseguono: le porta il dump, con lo
schema `drizzle`. Sequenza dopo la perdita dei volumi, su volumi nuovi:

```
docker compose -f infra/deploy/compose.yml --env-file <file> up -d --wait
docker compose -f infra/deploy/compose.yml --env-file <file> --profile backup run --rm restore restore latest
```

Il primo comando crea i ruoli (`db-init`), i bucket vuoti e gli utenti dell'archivio (`objects-init`) e avvia lo stack; l'API, all'avvio, non
scrive nel database, quindi il ripristino funziona anche a stack acceso. **Non** eseguire
`migrate` prima del ripristino.

- **Guasto in `db_restore`:** il ripristino del database è in una sola transazione, quindi il
  database resta vuoto. Basta ripetere il comando.
- **Guasto in `objects_restore`:** il database è già pieno e un secondo tentativo è rifiutato
  (65). La destinazione era nuova e vuota, quindi si rifà da capo: `down`, si cancellano
  **solo** i volumi di database e archivio di quella destinazione (`<progetto>_db-data` e
  `<progetto>_objects-data`; `docker volume ls` li elenca), poi `up -d --wait` e di nuovo
  `restore`. Mai su un ambiente con dati da conservare.
- **Sessioni:** dopo il caricamento del dump il ripristino revoca tutte le sessioni non revocate
  (la riga di esito porta `sessions_revoked`, il numero chiuso): dopo un ripristino tutti
  accedono di nuovo. Se il passo fallisce, esce con `failed_step` `sessions_revoke` e il sito
  non si riapre.
- **Dopo ogni ripristino, prima di riaprire il sito:** riapplicare le cancellazioni
  registrate, perché il backup può contenere dati già cancellati (DR-381; parere MI-06, 3e).
  Il registro nasce nella `1F-W6`: **oggi è un punto aperto**, quindi con dati reali il sito
  non si riapre senza quel passo.
- Gli spec e2e di `cms/` **non** si eseguono su uno stack da conservare: scrivono contenuti,
  media, account e impostazioni. Per un controllo di lettura sullo stack ripristinato bastano
  `regole-strutturali.spec.ts` e `titolo-nel-head.spec.ts` (§6, con `E2E_STACK_URL` e senza
  `prepara.ts`).

### Chiavi e file

- Le password (database, MinIO, `RESTIC_PASSWORD`) stanno nel file d'ambiente. Chiave SSH e
  `known_hosts` sono file dell'host, montati in `/run/secrets`: percorsi predefiniti
  `infra/deploy/backup-chiavi/ssh_key` e `known_hosts` (fuori da Git), o quelli di
  `BACKUP_SSH_KEY_PATH` e `BACKUP_KNOWN_HOSTS_PATH`.
- I due file devono essere **leggibili dall'utente 10003** del contenitore: i montaggi
  mantengono proprietario e permessi dell'host (consigliati: proprietario `10003`, chiave `0400`,
  `known_hosts` `0444`).
- Il server SFTP si verifica con `StrictHostKeyChecking=yes`. `known_hosts` ha la forma
  `[<host-storage-box>]:23 ssh-ed25519 <chiave pubblica>`: con una porta diversa da 22, l'host
  va **fra parentesi quadre**, seguito da `:porta`, altrimenti la verifica fallisce.
- La porta SFTP è `BACKUP_SFTP_PORT` (23 sulla Storage Box).

### Firewall dell'host

La rete `backup-out` ha uscita libera per Docker: `firewall/backup-out.sh` la limita con la catena `DOCKER-USER`.
Da root sull'host: `sh infra/deploy/firewall/backup-out.sh --env-file <file>` applica le regole, con `--check` le verifica senza modificarle.
La rete esce solo verso la Storage Box (TCP, `BACKUP_SFTP_PORT`) e verso i resolver DNS dell'host; tutto il resto è rifiutato.
Se la Storage Box non si risolve, lo script esce con 2 e non lascia la rete aperta.
Si applica nella W5, con le regole rese persistenti dopo `docker.service`; la sottorete è `BACKUP_OUT_SUBNET` (§2).

### Limiti di capacità

Il volume `backup-data` è l'area di lavoro di `backup` e `restore`: durante l'esecuzione
tiene il dump e una copia degli oggetti (D259), quindi vuole spazio pari agli oggetti più il
dump; a fine esecuzione, riuscita o no, viene svuotato (R18), e a ogni backup gli oggetti si
scaricano di nuovo per intero (restic non ricarica i blocchi già presenti). La cache di restic
sta in `backup-cache`; se manca, ripiega su `/tmp` (16 MiB, in memoria), troppo poco per un
repository vero. La taratura sul server è della W5.

## 9. Da fare nelle wave successive

- **W4, revisione di sicurezza:** CSP da applicare dopo la sola segnalazione. Ruoli del
  database e utenti dell'archivio con privilegi minimi: fatti (§2).
- **W4, firewall dell'host:** fatto in `firewall/backup-out.sh` (§8, «Firewall dell'host»): la rete `backup-out`
  esce solo verso la Storage Box sulla porta 23 e verso il DNS. Resta da applicarlo sul server nella W5.
- **W4, segreti del backup:** `RESTIC_PASSWORD` e le password dei ruoli di sola lettura stanno
  nell'ambiente del contenitore e si leggono con `docker inspect`: rischio accettato, uguale a quello
  dell'API. Solo chiave SSH e `known_hosts` sono file.
- **W5, backup sul server:** timer di systemd che lancia `backup` ogni giorno e `check` ogni
  settimana, con `--no-deps` per `check` (e per `init`); chiavi della Storage Box e `known_hosts`
  (HO-059); regole `DOCKER-USER` della W4; capacità di `backup-data` e `backup-cache`; timer della pulizia `bin/auth-purge.js`; ripristino
  con la copia della chiave del Centro (DR-380). Dettaglio in `docs/deploy/backup-verification.md`.
- **W5, server:** uno staging su porte diverse da 80 e 443 non ottiene un certificato
  pubblico da solo (instradamento per nome davanti ai due Caddy, o certificato DNS);
  sul server serve la cartella `infra/` intera (`objects-init` usa
  `infra/compose/create-buckets.sh`); file di `infra/deploy/caddy/` leggibili da tutti
  (Caddy gira senza capacità); HSTS più lungo dopo la verifica di HTTPS; lavoro di
  rilascio di DR-357.
- **Fornitura dei programmi:** `ffmpeg` arriva da una release automatica di BtbN, che
  potrebbe non restare pubblicata; serve una copia propria prima che sparisca.
