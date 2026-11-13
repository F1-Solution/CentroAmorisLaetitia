# Stack di produzione e di staging

Compose, Caddy ed esempio d'ambiente della piattaforma in produzione (fase 1F, wave W2).
Lo stesso `compose.yml` serve produzione e staging: cambia solo il file d'ambiente (DR-296).
Lo sviluppo resta in `infra/compose/` e non usa questi file.

## 1. Che cosa c'è

| File | Ruolo |
|---|---|
| `compose.yml` | servizi `caddy`, `web`, `admin`, `api`, `scrub`, `db`, `db-init`, `objects`, `objects-init`; `migrate` nel profilo `release`; `backup` e `restore` nel profilo `backup` (a termine; `backup` solo in produzione, `restore` anche in staging; rete d'uscita `backup-out` per ambiente) |
| `caddy/Caddyfile` | Caddy dell'ambiente, solo HTTP dietro l'ingresso: instradamento (ADR-003 §3), HSTS, intestazioni, CSP in sola segnalazione (DR-364), indirizzo del visitatore |
| `ingresso/compose.yml`, `ingresso/Caddyfile`, `ingresso/siti/*.sito` | ingresso comune (DR-409): terzo progetto Compose `amoris-ingresso`, unico a pubblicare 80, 443 e 443/udp e a tenere i certificati; inoltra per nome ai Caddy degli ambienti |
| `ingresso/ingresso.env.example` | modello del file d'ambiente dell'ingresso (nomi, sottoreti, directory ACME), senza segreti |
| `caddy/production.caddy`, `caddy/staging.caddy` | regole per ambiente; lo staging non si fa indicizzare |
| `ambiente/production.env`, `ambiente/staging.env` | impostazioni **non segrete** lette da Caddy e dall'API |
| `.env.production.example` | modello del file per `--env-file`, con i comandi che generano i segreti |
| `db-init/roles.sql` | ruoli del database e loro privilegi, eseguito da `db-init` a ogni avvio; vedi §2 |
| `objects/create-service-users.sh` | utenti di servizio dell'archivio, eseguito da `objects-init` a ogni avvio; vedi §2 |
| `backup/` | script del servizio `backup` (`amoris-backup`, `lib.sh`), copiati nell'immagine; vedi §8 |
| `/etc/amoris/backup-chiavi/` | sul server, **fuori da Git e dai rilasci**: chiave SSH e `known_hosts` del backup, con percorso assoluto in `BACKUP_SSH_KEY_PATH` e `BACKUP_KNOWN_HOSTS_PATH`; vedi §8 |
| `rilascio/rilascia.sh`, `rilascio/authorized_keys.esempio` | script di rilascio sul server con comando forzato (DR-411) e riga d'esempio di `authorized_keys`; vedi §10 |
| `tests/` | prove del Compose e di Caddy (`pnpm test:images`) e aggiunte per la prova locale (`compose.e2e.yml`) |

Le immagini si costruiscono dai Dockerfile di `infra/docker/`. In CI il lavoro `immagini`
di `.github/workflows/ci.yml` le pubblica nel registro privato di GitHub (DR-356) come
`ghcr.io/<proprietario>/amoris-<app>:<hash del commit>`, dopo la verifica di un push su
`main` e dopo il controllo dei file (`infra/docker/check-image.mjs`). `migrate` usa
l'immagine dell'API.

## 2. File d'ambiente

- Il file per `--env-file` contiene i segreti: si copia da `.env.production.example`
  **fuori dal repository** e si riempie riga per riga. Sul server è `/opt/amoris/segreti/<ambiente>.env`
  (proprietario e permessi al §10). Copiato così com'è, il Compose non parte e dice quale chiave manca.
- Il file dell'ambiente contiene anche `INGRESS_SUBNET` (uguale alla rete d'ingresso, §3) e i due percorsi
  assoluti del backup (§8): il rilascio li controlla prima di toccare il server.
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
  Per ruotare una password si cambia il file d'ambiente e si rifà `up -d` (§3). I privilegi valgono
  anche per le tabelle create dalle migrazioni future. I nomi dei ruoli e degli utenti sono
  fissi; solo le password sono segrete.
- `BACKUP_OUT_SUBNET` e `BACKUP_OUT_BRIDGE` (rete d'uscita dei backup) sono obbligatorie e diverse per
  ambiente (DR-412): `10.77.86.0/24` e `amoris-bkp-prod` in produzione, `10.77.87.0/24` e
  `amoris-bkp-stag` in staging.
- Le regolazioni dell'API (tempi dell'accesso, limiti dei form) vanno in
  `ambiente/<valore>.env`, non nel file dei segreti: il Compose passa all'API solo le
  chiavi che nomina.

## 3. Avvio

Sul server non c'è un clone del repository: ogni comando d'ambiente parte dal rilascio in uso (§10) e si lancia da utente amministrativo con `sudo`: `rilasci/` e `segreti/` non sono leggibili dall'amministratore, che non è nel gruppo `docker`. `<compose>` indica la seconda riga qui sotto, con `<ambiente>` uguale a `production` o `staging`; la prima si ripete dopo ogni rilascio:

```
R=$(sudo readlink -f /opt/amoris/rilasci/<ambiente>/corrente)
sudo docker compose -f "$R/infra/deploy/compose.yml" --env-file /opt/amoris/segreti/<ambiente>.env --env-file "$R/rilascio.env"
```

Si passa dalla cartella reale dell'hash, non dal collegamento `corrente`, come fa lo script: i percorsi dei montaggi restano gli stessi e un `up -d` a mano non ricrea i contenitori senza motivo. `rilascio.env` va per ultimo perché fissa `IMAGE_TAG` e `AMORIS_ENV` del rilascio; senza, i contenitori possono ripartire con un'altra versione. In locale (§6) `<compose>` è `docker compose -f infra/deploy/compose.yml --env-file <file>`, senza `sudo`, dalla radice del repository.

L'avvio normale sul server è il rilascio (§10), che fa pull, migrazioni (con `--migrazioni`) e `up -d --wait`. I tre comandi seguenti servono per ripartire a mano:

```
<compose> up -d --wait db objects db-init objects-init
<compose> --profile release run --rm migrate
<compose> up -d --wait
```

Le migrazioni non partono mai all'avvio (ADR-009 §4.4): si eseguono con il secondo comando,
a ogni rilascio che le porta. Il progetto Compose si chiama `amoris-<AMORIS_ENV>`: volumi e
reti di produzione e di staging non si toccano.

### Ingresso comune e ordine d'avvio (DR-409)

Produzione e staging stanno sullo stesso server, ma solo l'ingresso pubblica 80, 443 e 443/udp: i
Caddy degli ambienti non pubblicano porte e parlano HTTP. **L'ingresso si avvia per primo**, perché
crea le reti `amoris-ingresso-production` e `amoris-ingresso-staging` a cui gli ambienti si agganciano;
poi gli ambienti (anche uno solo), con il rilascio (§10). L'ingresso non fa parte dei rilasci: si installa a parte (HO-062, 1F-W5 T6), con la cartella `ingresso/` e il file d'ambiente `<ingresso>` copiato da `ingresso/ingresso.env.example` fuori dal repository. `<cartella-ingresso>` è la cartella `ingresso/` così installata.

```
sudo docker compose -f <cartella-ingresso>/compose.yml --env-file <ingresso> up -d --wait
```

- `INGRESS_SUBNET` di ogni ambiente è uguale alla sottorete che l'ingresso crea per lui
  (`10.77.88.0/24` produzione, `10.77.89.0/24` staging; `10.77.87.0/24` è riservata al backup dello staging).
  Il rilascio controlla che la rete abbia come unica sottorete quella del file dei segreti e, se non è così, si ferma in fase `rete`.
- Il nome della produzione (`INGRESS_PRODUCTION_NAME`) resta **vuoto fino alla 1F-W8**: senza nome l'ingresso
  non ha il sito e non chiede il certificato. Con il nome si ricrea il contenitore (punto sotto).
- I nomi pubblici (`INGRESS_STAGING_NAME`, `INGRESS_PRODUCTION_NAME`) hanno solo minuscole, cifre, `.` e `-`: niente
  schema, porta, virgole, spazi o `*`. L'ingresso li controlla prima di avviare Caddy e, se non sono validi, esce con 64 e nomina la variabile.
- Se cambiano il Caddyfile, i file di `siti/` o i nomi, `up -d` da solo non ricrea il contenitore: serve
  `sudo docker compose -f <cartella-ingresso>/compose.yml --env-file <ingresso> up -d --force-recreate ingresso`.
- La directory ACME è `INGRESS_ACME_CA`: prima quella di prova di Let's Encrypt, poi quella vera (URL nel
  file d'esempio). Nessun indirizzo e-mail ACME. I certificati stanno nel volume `ingresso-data`, da conservare.
- Il Caddy dello staging non raggiunge quello della produzione, e viceversa: reti distinte.
- Se un ambiente parte prima dell'ingresso, il Compose dice che la rete `amoris-ingresso-<ambiente>` non esiste.

### Indirizzo del client e sottorete interna

Con l'ingresso comune (DR-409) la catena ha due salti, e l'indirizzo del visitatore si mantiene così: l'ingresso non si fida di nessuno, quindi scarta `X-Forwarded-For`, `X-Real-IP` e `Forwarded` dei client e passa al Caddy dell'ambiente l'indirizzo che vede; il Caddy dell'ambiente si fida **solo** della rete dell'ingresso (`INGRESS_SUBNET`), ne ricava l'indirizzo del visitatore e lo passa a sito, area e API come unica voce di `X-Forwarded-For`. `X-Forwarded-Proto` resta `https` e `Host` il nome pubblico. Una richiesta che arriva al Caddy dell'ambiente da fuori della rete dell'ingresso non può imporre un indirizzo. Se `INGRESS_SUBNET` non coincide con la rete dell'ingresso, tutti i visitatori compaiono con l'indirizzo dell'ingresso e i tetti diventano un solo conteggio: per questo il rilascio lo verifica.

L'API si fida di `X-Forwarded-For` solo dalla rete interna `app` (variabile `TRUSTED_PROXY`, fissata dal Compose uguale ad `APP_SUBNET`). `APP_SUBNET` è obbligatoria e diversa per ambiente (DR-402): `10.77.84.0/24` in produzione e `10.77.85.0/24` in staging, ciascuna nel proprio file d'ambiente; senza, il Compose non parte. La fiducia vale per tutta la sottorete, quindi anche per sito e area: un loro contenitore compromesso potrebbe dichiarare un indirizzo falso (rischio accettato in Fase 1, DR-402). Il sito inoltra all'API l'indirizzo del visitatore ricevuto da Caddy, così ricerca e redirect si limitano per visitatore (DR-401). Senza `TRUSTED_PROXY` l'API non si fida di nessuno.

### Primo account

Sul server il primo account si crea dentro il contenitore dell'API, con la conferma esplicita dell'ambiente (production o staging, uguale a `AMORIS_ENV`); il ruolo (per esempio `amministrazione`) va nell'ambiente del comando, indirizzo e nome su due righe di standard input, mai la password:

```
D=$(mktemp -d ~/account.XXXXXX)
(umask 077; nano "$D/primo-account.txt")
<compose> run --rm --no-deps -T -e ACCOUNT_ROLE=amministrazione api node bin/account-create.js --ambiente production --conferma < "$D/primo-account.txt"
rm -rf "$D"
```

Il file (prima riga `<indirizzo>`, seconda `<nome e cognome>`) sta in una cartella temporanea con permessi 700 nella home dell'amministratore (`mktemp -d` la crea così), perché con `sudo … <` il reindirizzamento lo apre la shell di chi lancia `sudo`, non root. Si scrive con `nano`, che di base non lascia copie, non con `vim` né con `echo` (la cronologia). La cancellazione della cartella è una riga a sé: va eseguita anche se il comando fallisce. Su un SSD la cancellazione non è garantita, per questo il file vive pochi secondi e contiene solo indirizzo e nome.

Stampa su stdout una sola riga, la password temporanea, mostrata una volta e mai registrata; i messaggi vanno su stderr. Consegnarla alla persona su un canale sicuro (DR-398), non per posta ordinaria né in chat di gruppo. Senza `--ambiente` uguale all'ambiente, senza `--conferma` o con `ACCOUNT_PASSWORD` il comando rifiuta e non scrive nulla. Al primo accesso la persona attiva il codice TOTP (obbligatorio) e poi sceglie una nuova password (DR-228). Se perde il telefono si usa `account-reset-totp` (sezione seguente, DR-397); per toglierle l'accesso si usa il pulsante «Disattiva» sulla sua riga in Impostazioni > Sistema > «Persone e permessi» (`/impostazioni/persone`), poi «Disattiva» nella conferma «Disattiva l'account».

### Sblocco di un account bloccato per troppi tentativi

Il blocco scade da solo 15 minuti dopo l'ultimo fallimento vero. Per sbloccare subito un account, senza toccare le altre righe del registro (ne scrive una nuova, `auth.login_unblocked`):

```
D=$(mktemp -d ~/account.XXXXXX)
(umask 077; nano "$D/indirizzo.txt")
<compose> run --rm --no-deps -T api node bin/account-unblock.js --ambiente production --conferma < "$D/indirizzo.txt"
rm -rf "$D"
```

Sul server l'indirizzo è l'unica riga del file, con le stesse cautele del primo account (cartella 700, `nano`, cancellazione come riga a sé). Senza `--ambiente` uguale all'ambiente, senza `--conferma` o con `ACCOUNT_EMAIL` nell'ambiente il comando rifiuta prima di leggere lo standard input e non scrive nulla (DR-429, DR-433). In sviluppo, con il database locale, si usa ancora `ACCOUNT_EMAIL`.

Esito atteso: «Account sbloccato: N fallimenti azzerati. Operazione registrata.»; se l'indirizzo manca, esce con errore.

### Secondo fattore perso (telefono smarrito)

Ogni account entra con password e codice TOTP (app di autenticazione). Chi perde il telefono non può reimpostarlo dall'interfaccia: lo fa chi ha accesso al server, con questo comando che toglie il secondo fattore dell'account, chiude tutte le sue sessioni e scrive una riga di registro (`auth.second_factor_reset`, senza segreti). Al prossimo accesso la persona attiva un nuovo secondo fattore:

```
D=$(mktemp -d ~/account.XXXXXX)
(umask 077; nano "$D/indirizzo.txt")
<compose> run --rm --no-deps -T api node bin/account-reset-totp.js --ambiente production --conferma < "$D/indirizzo.txt"
rm -rf "$D"
```

Valgono le stesse regole dello sblocco: indirizzo da standard input, `--ambiente` e `--conferma` obbligatori sul server, `ACCOUNT_EMAIL` rifiutato prima di leggere (in sviluppo si usa ancora).

Esito atteso: «Secondo fattore reimpostato: N sessioni chiuse. Operazione registrata.»; se l'indirizzo manca o non corrisponde a nessun account, esce con errore. Verificare l'identità della persona prima di eseguirlo. La chiave `TOTP_ENCRYPTION_KEY` va conservata con gli altri segreti: se si perde, tutti i secondi fattori attivati vanno reimpostati.

### Pulizia di sessioni e tentativi falliti

Cancella le sessioni scadute o revocate da più di 30 giorni e, più vecchie di 30 giorni, le righe di registro dei tentativi: accessi falliti (rifiuti per troppi tentativi compresi), password o codice del secondo fattore sbagliati e sblocchi da CLI (DR-403); nessun'altra riga del registro. Si lancia a mano; il timer di systemd che la esegue ogni giorno si crea nella W5:

```
<compose> run --rm --no-deps api node bin/auth-purge.js
```

Esito atteso: «Pulizia eseguita: N sessioni e M righe di tentativi cancellate.»; con codice diverso da 0 non ha cancellato nulla di cui fidarsi. La durata del registro delle operazioni è una decisione ancora aperta e questo comando non la tocca.

## 4. Verifica

| Indirizzo | Risposta attesa |
|---|---|
| `https://<sito>/health/live/` | 200 (sito) |
| `https://<sito>/admin/health/live` | 200 (area) |
| `https://<sito>/api/health/ready` | 404: i controlli di salute dell'API non sono pubblici, si leggono dall'interno (sotto) |
| `https://<sito>/api/openapi.json` | 404: la specifica non è pubblica |
| `https://<sito-staging>/robots.txt` | 401 senza password, `Disallow: /` con la password |

Lo staging sta dietro `basic_auth` di Caddy (DR-375), anche per `/api`, `/media`, `/forms` e `robots.txt`; il controllo di salute interno ne è escluso. Utente e hash bcrypt si danno in `STAGING_BASIC_AUTH_USER` e `STAGING_BASIC_AUTH_HASH` nel file dei segreti (hash tra apici singoli, generato con `caddy hash-password`): se mancano, Caddy non parte.

`<compose> ps` deve mostrare ogni servizio `healthy`; `objects-init` esce con 0.

Salute e specifica dell'API dall'interno (Caddy risponde 404 a `/api/health/*` e a `/api/openapi.json`):

```
<compose> exec api node -e "fetch('http://127.0.0.1:3002/health/ready').then(async (r) => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1); })"
<compose> exec api node -e "fetch('http://127.0.0.1:3002/openapi.json').then(async (r) => console.log(r.status, (await r.text()).length))"
```

`/health/live` si legge allo stesso modo; l'indirizzo interno `127.0.0.1:2020/health/live` di Caddy resta quello del controllo del Compose.

## 5. Arresto

```
<compose> down
```

`down` lascia i volumi (database, archivio, certificati). `down -v` li **cancella**: mai
sulla produzione, e sullo staging solo con conferma (PLAN §7 riga 7).

## 6. Prova locale dello stack

Per provare le immagini in locale, con dati sintetici:

1. costruire le immagini: `docker build -f infra/docker/<app>.Dockerfile -t amoris-<app>:prova .`
   per `web`, `admin`, `api`, `scrub`, `backup`;
2. scrivere due file d'ambiente sintetici fuori dal repository:
   - **ingresso** (da `ingresso/ingresso.env.example`): `INGRESS_ACME_CA` qualunque (per i nomi
     `*.localhost` l'ingresso emette da sé un certificato interno e non contatta nessuno),
     `INGRESS_PRODUCTION_NAME=localhost`, `INGRESS_STAGING_NAME` vuoto, due sottoreti libere
     (per esempio `10.77.88.0/24` e `10.77.89.0/24`) e due porte libere
     `INGRESS_E2E_HTTP_PORT`, `INGRESS_E2E_HTTPS_PORT` per l'aggiunta di prova;
   - **ambiente**: `IMAGE_PREFIX=amoris`, `IMAGE_TAG=prova`, `CADDY_SITE_ADDRESS=localhost`,
     `INGRESS_SUBNET` uguale alla sottorete dell'ingresso per la produzione,
     `SITE_URL=https://localhost:<porta HTTPS dell'ingresso>`, `POSTGRES_DB=amoris_e2e`,
     segreti generati, `BACKUP_SSH_KEY_PATH` e `BACKUP_KNOWN_HOSTS_PATH` (obbligatorie: due percorsi
     assoluti qualunque, per esempio due file vuoti di prova, perché il profilo `backup` non parte in locale),
     e `E2E_DB_PORT`, `E2E_OBJECTS_PORT` per l'aggiunta di prova;
3. avviare **prima l'ingresso**, con `-f infra/deploy/tests/ingresso.e2e.yml` (porte su `127.0.0.1`),
   poi lo stack come al §3, dalla radice del repository con il `<compose>` locale, aggiungendo `-f infra/deploy/tests/compose.e2e.yml` a ogni comando
   (apre database e archivio su `127.0.0.1` e toglie le attese dell'accesso). **Mai sul server**:

   ```
   docker compose -f infra/deploy/ingresso/compose.yml -f infra/deploy/tests/ingresso.e2e.yml --env-file <ingresso> up -d --wait
   ```

4. eseguire gli e2e attraverso l'ingresso e il Caddy dell'ambiente, con le stesse variabili del file d'ambiente
   (il nome è `localhost` perché Node su Windows non risolve i nomi `*.localhost`, mentre `localhost` sì, e le
   prove che usano `request` di Playwright passano da Node; l'ingresso emette da sé il certificato interno):

   ```
   E2E_STACK_URL=https://localhost:<porta HTTPS dell'ingresso>
   DATABASE_URL=postgres://amoris:<POSTGRES_PASSWORD>@127.0.0.1:<E2E_DB_PORT>/amoris
   S3_ENDPOINT=http://127.0.0.1:<E2E_OBJECTS_PORT>
   pnpm exec tsx tests/e2e/prepara.ts
   pnpm exec playwright test
   ```

   Con `E2E_STACK_URL` le prove non avviano server propri; `prepara.ts` ricrea il database
   `amoris_e2e` dello stack e scrive il seme sintetico, senza compilare le applicazioni.
   Il database ricreato non ha più i privilegi dell'API: subito dopo `prepara.ts` si esegue
   `docker compose … run --rm db-init`, che ripristina proprietario e privilegi.

Produzione e staging possono girare insieme dietro lo stesso ingresso, che li distingue per nome
(per esempio `localhost` e `staging.localhost`, il secondo raggiungibile solo dal browser), non per
porta: ciascuno ha il proprio file d'ambiente con `INGRESS_SUBNET` della propria rete. Per fermare tutto: `down` dell'ambiente
e poi dell'ingresso.

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
| ingresso comune (`amoris-ingresso`) | 128 | |
| **Produzione, staging e ingresso** | **7168** | |

7168 MiB (7 GiB esatti) sono il tetto: nessun margine, si misura sul server (W5 T9). `db-init` (64), `objects-init` (128) e `migrate` (256) escono a lavoro
finito; anche `backup` è un processo a termine: la memoria è occupata solo durante il backup. La
taratura sul server è della W5.

## 8. Backup e ripristino

Il servizio `backup` copia ogni giorno database e oggetti in un repository restic cifrato,
su una Storage Box raggiunta via SFTP (DR-335, DR-366). Gira solo in produzione (DR-372), a
termine e solo su richiesta: nessun processo resta acceso (DR-367). L'avvio giornaliero è un
timer di systemd sull'host, che si imposta nella W5. La prova di ripristino è in
`docs/deploy/backup-verification.md`.

In tutti i comandi: `<compose>` è quello della produzione (§3, con `sudo` e la cartella reale del rilascio).
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
<compose> --profile backup run --rm --no-deps backup init
<compose> --profile backup run --rm backup backup
<compose> --profile backup run --rm --no-deps backup check
<compose> --profile backup run --rm restore restore latest
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
<compose> --profile backup run --rm --no-deps --entrypoint cat backup /backup/state/last-backup.json
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
<compose> up -d --wait
<compose> --profile backup run --rm restore restore latest
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
  `known_hosts` sono file dell'host, montati in `/run/secrets`. I percorsi, **obbligatori** e **assoluti**,
  stanno in `BACKUP_SSH_KEY_PATH` e `BACKUP_KNOWN_HOSTS_PATH` del file dei segreti (di entrambi gli ambienti):
  `/etc/amoris/backup-chiavi/ssh_key` e `/etc/amoris/backup-chiavi/known_hosts`, come in HO-059. Non possono
  stare sotto `rilasci/`, che si ricrea a ogni rilascio; il rilascio li controlla (non che i file esistano).
- I due file devono essere **leggibili dall'utente 10003** del contenitore: i montaggi
  mantengono proprietario e permessi dell'host (consigliati: proprietario `10003`, chiave `0400`,
  `known_hosts` `0444`).
- Il server SFTP si verifica con `StrictHostKeyChecking=yes`. `known_hosts` ha la forma
  `[<host-storage-box>]:23 ssh-ed25519 <chiave pubblica>`: con una porta diversa da 22, l'host
  va **fra parentesi quadre**, seguito da `:porta`, altrimenti la verifica fallisce.
- La porta SFTP è `BACKUP_SFTP_PORT` (23 sulla Storage Box).

### Firewall dell'host

La rete `backup-out` ha uscita libera per Docker: `firewall/backup-out.sh` la limita con una catena `DOCKER-USER` per ambiente (`AMORIS-BKP-OUT-PRODUCTION`, `AMORIS-BKP-OUT-STAGING`).
Da root sull'host, **una volta per ambiente**: `sh /opt/amoris/rilascio/backup-out.sh --env <ambiente> --env-file /opt/amoris/segreti/<ambiente>.env` applica le regole, con `--check` le verifica senza modificarle; ogni esecuzione tocca solo la catena e il salto del proprio ambiente.
Lo script gira da root: si usa la copia in `/opt/amoris/rilascio/` (§10), mai quella dentro `rilasci/`, scrivibile da `deploy`.
L'ambiente si ricava da `AMORIS_ENV` (nel file, nell'ambiente o con `--env production|staging`); se manca o non è `production` o `staging`, lo script esce con 64 senza toccare nulla.
Con 64 rifiuta anche un prefisso della sottorete fuori da `/16`–`/32` e, in applicazione (non con `--check`), una sottorete o un bridge già usati dalla catena dell'altro ambiente.
La rete esce solo verso la Storage Box (TCP, `BACKUP_SFTP_PORT`) e verso i resolver DNS dell'host; tutto il resto è rifiutato.
Se la Storage Box non si risolve, lo script esce con 2 e non lascia la rete aperta.
Si applica nella W5, con le regole rese persistenti dopo `docker.service`; la sottorete è `BACKUP_OUT_SUBNET` (§2).
Lo staging non fa backup (DR-372), ma `restore` usa la stessa rete: per ricevere un ripristino dalla Storage Box ha bisogno delle regole del proprio ambiente.

### Limiti di capacità

Il volume `backup-data` è l'area di lavoro di `backup` e `restore`: durante l'esecuzione
tiene il dump e una copia degli oggetti (D259), quindi vuole spazio pari agli oggetti più il
dump; a fine esecuzione, riuscita o no, viene svuotato (R18), e a ogni backup gli oggetti si
scaricano di nuovo per intero (restic non ricarica i blocchi già presenti). La cache di restic
sta in `backup-cache`; se manca, ripiega su `/tmp` (16 MiB, in memoria), troppo poco per un
repository vero. La taratura sul server è della W5.

## 9. Da fare nelle wave successive

- **W4, revisione di sicurezza: chiusa** (`docs/deploy/security-review-1F.md`). Ruoli del
  database e utenti dell'archivio con privilegi minimi (§2), staging con password, log senza IP
  né query, `APP_SUBNET` per ambiente: fatti. La CSP resta in sola segnalazione fino alla W5
  (R21, DR-364). Le azioni sul server nate dalla revisione sono in HO-061.
- **W4, firewall dell'host:** fatto in `firewall/backup-out.sh` (§8, «Firewall dell'host»): la rete
  `backup-out` esce solo verso la Storage Box e verso il DNS. Applicazione, persistenza dopo il
  riavvio e rinnovo giornaliero nella W5 (HO-061 §6).
- **W4, segreti nell'ambiente dei contenitori:** `RESTIC_PASSWORD`, le password dei ruoli e i segreti
  dell'API si leggono con `docker inspect`: rischio accettato in Fase 1 (DR-387), confermato dalla
  revisione. Solo chiave SSH e `known_hosts` sono file.
- **W4, `/health/ready`:** non è pubblico (Caddy risponde 404 a `/api/health*`); i controlli
  interni sono al §4. Non controlla l'archivio a oggetti: nessun rischio di sicurezza (revisione
  della W4); da riprendere con la sonda esterna della W8 (D227, DR-408).
- **W5, backup sul server:** timer di systemd che lancia `backup` ogni giorno e `check` ogni
  settimana, con `--no-deps` per `check` (e per `init`); chiavi della Storage Box e `known_hosts`
  (HO-059); regole `DOCKER-USER` della W4; capacità di `backup-data` e `backup-cache`; timer della
  pulizia `bin/auth-purge.js` (HO-061 §7); ripristino con la copia della chiave del Centro (DR-380).
  Dettaglio in `docs/deploy/backup-verification.md`.
- **W5, server, instradamento per nome: fatto** (DR-409, §3): l'ingresso comune tiene 80, 443 e i
  certificati e inoltra per nome ai due Caddy. Resta da fare sul server (W5): emissione dei certificati
  con la directory di prova e poi con quella vera; il nome della produzione si attiva nella W8.
- **W5, server:** sul server serve la cartella `infra/` intera (`objects-init` usa
  `infra/compose/create-buckets.sh`); file di `infra/deploy/caddy/` leggibili da tutti
  (Caddy gira senza capacità); HSTS più lungo dopo la verifica di HTTPS; lavoro di
  rilascio di DR-357.
- **Fornitura dei programmi:** `ffmpeg` arriva da una release automatica di BtbN, che
  potrebbe non restare pubblicata; serve una copia propria prima che sparisca.

## 10. Rilascio

Il rilascio parte da GitHub Actions (DR-411): la chiave SSH del lavoro può eseguire sul server **solo** `rilascia.sh`.

**Disposizione sul server** (radice `/opt/amoris`; l'utente `deploy` non ha password):

| Percorso | Proprietario e modo | Contenuto |
|---|---|---|
| `rilascio/` e `rilascio/rilascia.sh` | `root:root`, `0755` | lo script, eseguibile, e le copie degli script che esegue root (firewall di `backup-out`) |
| `segreti/` | `root:deploy`, `0750` | cartella dei file dei segreti |
| `segreti/<ambiente>.env` | `root:deploy`, `0640` | segreti dell'ambiente, fuori dal repository, letti e mai stampati; `AMORIS_ENV`, se presente, deve coincidere con l'ambiente; `IMAGE_PREFIX` comincia con `ghcr.io/`; `INGRESS_SUBNET` e i due percorsi del backup sono obbligatori |
| `rilasci/` | `deploy:deploy`, `0700` | cartella dei rilasci |
| `rilasci/<ambiente>/<hash>/` | `deploy:deploy` | `infra/` di quel commit e `rilascio.env` (`AMORIS_ENV`, `IMAGE_TAG`); un rilascio ripetuto lo sostituisce |
| `rilasci/<ambiente>/corrente` | `deploy:deploy` | collegamento all'ultimo rilascio riuscito, punto d'avvio di ogni comando, risolto in cartella reale (§3) |
| `rilasci/<ambiente>/registri/` | `deploy:deploy`, `0700` (file `0600`) | un registro per rilascio, vedi «Registro del rilascio» |
| `/etc/ssh/authorized_keys/deploy` | `root:root`, `0644` | la riga della chiave (sotto), fuori dalla home di `deploy` |
| `/etc/amoris/backup-chiavi/` | secondo HO-059 | chiave SSH e `known_hosts` del backup (§8) |

Gli script che root esegue da systemd (il firewall di `backup-out`) si copiano in `/opt/amoris/rilascio/` e non si eseguono dai rilasci, che `deploy` può scrivere.

**Regole `sshd`** (`/etc/ssh/sshd_config`): `PasswordAuthentication no`, `AllowUsers` con l'amministratore e `deploy`, e un blocco per l'utente del rilascio:

```
Match User deploy
    AuthorizedKeysFile /etc/ssh/authorized_keys/%u
    ForceCommand /opt/amoris/rilascio/rilascia.sh
    AllowTcpForwarding no
    X11Forwarding no
    PermitTTY no
    ClientAliveInterval 30
    ClientAliveCountMax 4
```

`ClientAliveInterval` e `ClientAliveCountMax` fanno cadere dopo circa due minuti una sessione il cui runner è morto senza chiudere il TCP, così non tiene il blocco del rilascio. Lo script, a sua volta, dà 30 secondi di tempo alle letture dell'ingresso standard (fase `credenziali`) e, se scade, lo scrive nel registro del rilascio.

> **Attenzione:** `deploy` è nel gruppo `docker`, quindi **equivale a root** sul server (rischio accettato, DR-411). I permessi sopra proteggono da errori e dai contenitori, non da chi controlla la chiave: la chiave privata è un segreto di pari livello.

Questi passi si eseguono nella 1F-W5 T6 con HO-062; qui si descrive la disposizione, non l'impianto.

**Riga di `authorized_keys`**, in `/etc/ssh/authorized_keys/deploy` (modello in `rilascio/authorized_keys.esempio`):

```
restrict,command="/opt/amoris/rilascio/rilascia.sh" ssh-ed25519 AAAA... rilascio-github
```

**Comando** (nessun'altra forma, altrimenti esce con 64 senza fare nulla):
`rilascia <production|staging> <hash di 40 caratteri minuscoli> [--migrazioni]`.
Ingresso standard: utente GitHub, token del registro, poi `git archive --format=tar.gz <hash> infra`.
Uscita standard: una riga JSON con `esito` (`ok` o `errore`), `fase` se è fallito, e `registro` (il nome del file di registro sul server). L'uscita di Docker non arriva al client.

**Passi** (tra parentesi la `fase` della riga d'esito):

1. Blocco per ambiente (`blocco`) e pulizia dei residui di rilasci interrotti di quell'ambiente, compresa la cartella dell'hash lasciata da parte da un'uccisione brusca, che torna al suo posto.
2. Lettura dell'utente GitHub e del token (`credenziali`).
3. Controllo del file dei segreti (`configurazione`): `AMORIS_ENV`, `IMAGE_PREFIX`, `INGRESS_SUBNET` e i due percorsi del backup, che devono essere assoluti, senza `.` o `..` come componenti, con soli lettere, cifre e `._/+@-`, e non sotto `rilasci/`.
4. Controllo dell'archivio (`archivio`): tetto di 100 MiB compressi e di 200 MiB decompressi, al massimo 20 000 voci, solo file e cartelle sotto `infra/`, nomi con caratteri ammessi.
5. Controllo della rete `amoris-ingresso-<ambiente>` (`rete`): deve esistere (l'ingresso si installa a parte) e avere come unica sottorete `INGRESS_SUBNET`.
6. Solo ora la cartella del rilascio si sostituisce (`archivio`): se esiste già quella dello stesso hash, resta da parte e torna al suo posto se il rilascio fallisce.
7. Configurazione temporanea di Docker e login a `ghcr.io` (`login`): il plugin `docker compose` deve essere installato a livello di sistema, non in `~/.docker` dell'utente.
8. Pull di tutte le immagini del Compose (`pull`), anche di Caddy, PostgreSQL, MinIO e `mc`, con i profili `backup` e `release`: un registro che non risponde si vede qui. Poi logout.
9. Migrazioni solo con `--migrazioni` (`migrazioni`).
10. `up -d --wait --pull never` (`avvio`).
11. Aggiornamento di `corrente` (`collegamento`), solo a rilascio riuscito.

**Registro del rilascio (DR-422):** l'uscita di Docker (pull, migrazioni, avvio) e gli errori dello script restano sul server in `/opt/amoris/rilasci/<ambiente>/registri/<data>-<hash>.log` (cartella `0700`, file `0600`). Al client arriva solo la riga JSON. Per leggere il registro di un rilascio fallito, da utente amministrativo:

```
sudo ls -l /opt/amoris/rilasci/<ambiente>/registri/
sudo tail -n 50 /opt/amoris/rilasci/<ambiente>/registri/<nome del registro>
```

Il registro può contenere dati dell'applicazione (per esempio l'errore di una migrazione): non si incolla in chat né in una issue. Si riportano solo la fase e la riga d'errore riassunta. I registri non si cancellano da soli: la loro conservazione è una decisione aperta.

**Come si avvia:** GitHub → Actions → «Rilascio» → Run workflow: si sceglie l'ambiente, si scrive l'hash del commit (40 caratteri) e, se serve, si spunta `migrazioni`. La conferma dell'utente prima dell'avvio è l'approvazione (DR-411). Il lavoro parte dal ramo `main` per comodità, non per sicurezza: chi può scrivere nel repository può avviare un lavoro da un altro ramo che usa lo stesso segreto, e il server accetta qualunque hash le cui immagini siano pubblicate (rischio accettato, DR-411).

**Segreto e variabili del repository:** `RILASCIO_SSH_KEY` (segreto, chiave privata del comando forzato), `RILASCIO_KNOWN_HOSTS` (variabile, riga `known_hosts` del server) e `RILASCIO_HOST` (variabile, nome o indirizzo del server); l'utente è sempre `deploy`. Se uno manca, il lavoro si ferma con un errore chiaro.

**Che cosa controlla prima di contattare il server:** che parta da `main` (una comodità, vedi sopra), che l'hash abbia 40 caratteri esadecimali minuscoli e sia un commit raggiungibile da `origin/main`, e che nel registro esistano le cinque immagini con quell'hash. La riga JSON d'esito del server va nel riepilogo del lavoro; un'uscita non zero fa fallire il lavoro. A fine lavoro la chiave e il `known_hosts` si cancellano dal runner.

**Codici d'uscita:** 0 riuscito; 64 comando rifiutato; 1 errore di un passo.

**Revoca e rientro:** per revocare la chiave si toglie la riga da `authorized_keys`; per tornare a un rilascio precedente si rilancia il comando con il suo hash. I rilasci vecchi non si cancellano da soli: la potatura è annotata nel rapporto di sicurezza (`docs/deploy/security-review-1F.md`).
