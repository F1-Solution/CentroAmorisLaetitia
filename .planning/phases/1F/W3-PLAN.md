# Piano della wave 1F-W3 — Backup e ripristino

> **Per chi esegue:** passi con caselle `- [ ]`. Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Prima la prova che fallisce,
> poi il codice. Nessun commit senza la sua conferma.

Scritto il 2026-11-06, dopo la chiusura della `1F-W2` (`5ebc774`). Esecuzione di codice:
**Sonnet** (PLAN §2). Dipende dalla `1F-W2` (PLAN §3): il servizio `backup` entra nel Compose
di `infra/deploy/`.

**Obiettivo:** un servizio `backup` copia ogni giorno database e oggetti in un repository
restic cifrato fuori dall'host, con la conservazione di ADR-009 §4.5, e un ripristino completo
su uno stack pulito, **in locale** e con dati sintetici, restituisce gli stessi dati.

Nessun server, nessuna Storage Box, nessuna chiave reale: tutto in locale, con un repository
e una chiave **di prova**. La chiave vera nasce nella `1F-W5` (PLAN §7, conferma 3).

**Riferimenti:** ADR-009 §4.5 (forma e conservazione) e §9 (verifica), DR-298 (cifratura prima
dell'invio, chiave custodita dall'utente), DR-335 (Hetzner Storage Box, restic via SFTP),
DR-334 (memoria del server), DR-296 (staging separato), DR-101 (immagini per digest),
DR-356 (GHCR), `privacy-safe-development`.

---

## 1. Dove sta il codice (letto il 2026-11-06 su `5ebc774`)

| Punto | File | Che cosa conta per la wave |
|---|---|---|
| Compose | `infra/deploy/compose.yml` | `db` PostgreSQL 17.11 su rete `data`; `objects` MinIO per digest su `data`; reti tutte interne salvo `edge`; profilo `release` per `migrate`; memoria 3328 MiB per ambiente, 6656 con lo staging |
| Bucket | `infra/compose/create-buckets.sh` | due bucket, `media-public` e `media-private`; nessun accesso anonimo |
| Esempio d'ambiente | `infra/deploy/.env.production.example`, prova `apps/api/tests/env-example-1f.test.ts` | ogni chiave nuova del Compose va nell'esempio, o la prova diventa rossa |
| Immagini | `infra/docker/*.Dockerfile`, `infra/docker/check-image.mjs`, lavoro «Immagine» in `.github/workflows/ci.yml` | quattro immagini oggi; il controllo dei file rifiuta chiavi e file d'ambiente |
| Prove d'infrastruttura | `infra/docker/tests`, `infra/deploy/tests`, `pnpm test:images` | 118 prove; il Compose si prova con `docker compose config` e con stack reali |
| Documenti | `infra/deploy/README.md` | §7 memoria, §8 rinvii; `docs/deploy/` non esiste ancora |
| Tabelle | database di sviluppo | **33** tabelle nello schema `public`, più le migrazioni di Drizzle. Il «20 tabelle» di PLAN §1 viene dal collaudo della 1G ed è superato: la prova confronta **tutte** le tabelle |

## 2. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W3-1 | Immagine | immagine `backup` da Dockerfile del repository; base e programmi (restic, client PostgreSQL 17, `mc`) fissati per versione e impronta; utente non `root`; controllata da `check-image.mjs`; costruita e pubblicata dalla CI come le altre quattro |
| W3-2 | Dump coerente | `pg_dump` in un'unica transazione, formato secondo D260; ripristinabile su un database vuoto della stessa versione |
| W3-3 | Oggetti | i due bucket copiati secondo D259, compresi i metadati che l'API legge (tipo e dimensione) |
| W3-4 | Cifratura | il repository restic si apre solo con la sua password; nessun file in chiaro sulla destinazione (prova: il repository non contiene stringhe note dei dati sintetici) |
| W3-5 | Conservazione | `forget` con 7 giornalieri, 4 settimanali, 6 mensili, provato con istantanee datate in modo sintetico su 8 mesi: restano esattamente quelle attese |
| W3-6 | Esito | ogni esecuzione registra esito, durata, dimensioni e identificativo dell'istantanea secondo D261, **senza** nomi di file, contenuti o dati personali; codice d'uscita diverso da 0 a ogni errore |
| W3-7 | Ripristino completo | stack di produzione locale con dati sintetici → backup → stack **pulito** (volumi nuovi) → ripristino → conteggi delle righe di **ogni** tabella e SHA-256 di **ogni** oggetto uguali; e2e di lettura verdi sullo stack ripristinato |
| W3-8 | Trasporto | il backup e il ripristino passano dal trasporto di D263 |
| W3-9 | Nessun segreto | password del repository e chiave SSH solo da file montati o variabili del file d'ambiente, mai nell'immagine, nei log o in Git; esempio d'ambiente aggiornato |
| W3-10 | Memoria | limite del servizio dichiarato; produzione e staging restano sotto 7 GiB (DR-334) |
| W3-11 | Nessuna regressione | verifica come la CI (frozen, lint, Prettier sui file di Git, typecheck, build, test, db:verify, copertura ≥ 80 %, e2e, `test:images`) |
| W3-12 | Documenti e chiusura | `docs/deploy/backup-verification.md` con la prova di ripristino; `infra/deploy/README.md` con backup e ripristino; handoff per la chiave (eseguito nella W5); revisione; commit e push su conferma; CI verde; riga `STATUS:complete` |

## 3. Attività

Percorsi nuovi: `infra/docker/backup.Dockerfile`, `infra/deploy/backup/` per gli script,
`docs/deploy/backup-verification.md`.

### T0 — Linea di base

- [ ] `PROGRESS.md` letto; nessuna riga `1F-W3 STATUS:complete`.
- [ ] Decisioni D257…D264 registrate (§4): DR-366…DR-373 il 2026-11-06.
- [ ] Docker in salute, spazio su disco sufficiente (≥ 15 GB liberi: lezione di HO-057); nessuno
  stack `amoris-production` o `amoris-staging` acceso.
- [ ] Versioni correnti di restic e del client di MinIO rilette sulle pagine ufficiali, con data;
  nessuna versione più recente di due settimane.

### T1 — Immagine `backup` (prova prima)

- [x] Prove in `infra/docker/tests`: l'immagine esiste, gira come utente non `root`, contiene
  `restic`, `pg_dump`/`pg_restore` 17.x, `mc` e `ssh`, versioni attese; **rosse** prima (9 su
  41 nelle prove dei Dockerfile e della CI; le 7 dell'immagine non partivano), poi verdi.
- [x] `infra/docker/backup.Dockerfile` (DR-366): base `postgres:17.11-alpine` per digest, la
  stessa del Compose; restic 0.19.1 con SHA-256 dal `SHA256SUMS` della release; `mc` dall'immagine
  Chainguard per digest; `openssh-client-default=10.3_p1-r2`; utente `backup` 10003; nessun
  `COPY` dal repository; 517 MB. `check-image.mjs`: 3913 voci, nessun file vietato, dopo aver
  aggiunto `etc/ssl1.1/` (certificati di sistema di Alpine) con la sua prova rossa prima.
- [x] Lavoro «Immagine» della CI esteso a `backup`; prova `ci-immagini-1f` aggiornata (rossa
  prima).
- **Per la T4:** l'immagine di base dichiara `VOLUME /var/lib/postgresql/data`, inutile qui;
  `ENTRYPOINT []` toglie l'avvio di PostgreSQL. Se Alpine ritira il pacchetto di `ssh` fissato,
  la build si ferma finché la versione non si aggiorna.

### T2 — Script di backup (prova prima)

- [x] Prove in `infra/docker/tests/backup-1f.test.ts` (25), con PostgreSQL, MinIO e una
  destinazione SFTP di prova (`infra/deploy/tests/sftp-prova.Dockerfile`, stessa base fissata,
  `openssh-server=10.3_p1-r2`, chiavi generate nella prova): istantanea con host ed etichette,
  dump non compresso e oggetti; cifratura; uscita ≠ 0 e stato registrato con database, archivio o
  SFTP spenti, chiave dell'host diversa, variabile o segreto mancante (78); nessun dato, nome di
  oggetto, password o chiave nell'uscita. **Rosse** prima: 22 su 25 senza gli script; poi 25/25.
- [x] `infra/deploy/backup/amoris-backup` con `lib.sh`, punto d'ingresso unico
  `amoris-backup init|backup|check`: dump `-Fc --compress=0` (D260), poi `mc mirror --remove`
  (D259), `restic backup`, `forget --prune` 7/4/6, `check --read-data-subset=10%` (D264), riga JSON
  e file di stato atomico in `/backup/state` (D261). Segreti da file (`*_FILE`), SSH con
  `StrictHostKeyChecking=yes`, scritture solo in `/tmp` e nei volumi `/backup/{data,state,cache}`.
- [x] `init` separato e idempotente: codice 10 di restic → crea; 0 → nulla; 12 (password) → errore.
- W3-3: tipo e dimensione dei media vengono dal database (`public/routes.ts:360`, `byteSize`);
  la copia dei file basta, nessun manifesto dei metadati S3.
- **Per la T4**, interfaccia: `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD_FILE`; `S3_ENDPOINT`,
  `S3_ACCESS_KEY_FILE`, `S3_SECRET_KEY_FILE`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`;
  `RESTIC_PASSWORD_FILE`; `BACKUP_SFTP_HOST`, `BACKUP_SFTP_PORT` (23 sulla Storage Box),
  `BACKUP_SFTP_USER`, `BACKUP_SFTP_PATH`, `BACKUP_SSH_KEY_FILE`, `BACKUP_KNOWN_HOSTS_FILE`; volumi
  `/backup/data`, `/backup/state`, `/backup/cache`.
- **Per la T7:** le prove chiamano `docker` con `spawnSync`; sotto carico Vitest scade
  («Timeout calling onTaskUpdate») e una prova di Caddy cade (158/159 al primo giro con un altro
  processo Docker in parallelo, 159/159 da sola). Le credenziali di MinIO passano come argomenti
  a `mc alias set` dentro il contenitore: valutare `MC_HOST_<alias>`.

### T3 — Script di ripristino (prova prima)

- [x] Prove in `infra/docker/tests/ripristino-1f.test.ts` (16): ripristino per identificativo e
  `latest` su destinazioni nuove con conteggi di righe e SHA-256 uguali; rifiuto (65) con tabella,
  schema `drizzle`, oggetto o bucket mancante, destinazione invariata; istantanea inesistente,
  SFTP spento, segreto mancante, `pg_restore` fallito a metà (database resta vuoto); nessun dato
  nelle uscite. **Rosse** prima: 13 su 16; poi 16/16.
- [x] Comando `amoris-backup restore <id|latest>` (non uno script separato): controlli della
  destinazione prima di tutto, `restic restore` in `/backup/data/.restore` (**non** in `/tmp`, che
  in produzione è in memoria; rimossa a ogni uscita), `pg_restore --single-transaction
  --exit-on-error --no-owner --no-privileges`, `mc mirror` e conteggio degli oggetti; esito in
  `last-restore.json`. Codici: 64 argomento, 65 destinazione non vuota.
- **Per la T6:** lo schema vero crea `pgcrypto`, `citext`, `unaccent`: il ripristino delle
  estensioni si prova solo lì. **Per la T8 (README):** un guasto dopo `pg_restore` lascia il
  database pieno e il ritentativo viene rifiutato: ripulire la destinazione prima di ripetere.

### T4 — Servizio nel Compose

- [x] Prove in `infra/deploy/tests/compose-1f.test.ts`: servizio solo nel profilo
  `backup`, nessuna porta, `restart: no`, sola lettura, `cap_drop ALL`, `no-new-privileges`,
  `mem_limit` 384m e `GOMEMLIMIT`, tre volumi con nome, reti esattamente `data` e `backup-out`
  (unico servizio sulla rete d'uscita, non interna; le altre restano interne), segreti come file
  (solo chiave SSH e known_hosts, in `/run/secrets`; nell'ambiente solo le quattro password), ogni variabile nuova mancante ferma il
  Compose con il suo nome, memoria 7040 MiB; prova di fumo con `amoris-backup:prova-1f`: senza
  argomenti esce con 64, i 2 file in `/run/secrets` leggibili dall'utente 10003. **Rosse** prima:
  14 su 48; poi 46/46 con lo schema finale, compresa `backup-chiavi/` esclusa da Git (`.gitignore`;
  prova rossa prima, aggiunta in verifica). `env-example-1f`: rossa senza le chiavi nuove nell'esempio (prima 2 su 14 con un segreto da variabile, poi riprogettato); poi 13/13.
- [x] Servizio `backup` in `compose.yml` (profilo `backup`, `entrypoint: amoris-backup`, ancora
  `*hardened` con `restart: 'no'`, `HOME=/nonexistent`, tmpfs su `/tmp` e su
  `/var/lib/postgresql/data`: nessun volume anonimo). Volumi `backup-data`, `backup-state`,
  `backup-cache`. Chiavi nuove nell'esempio: `RESTIC_PASSWORD`, `BACKUP_SFTP_HOST/USER/PATH`, `BACKUP_SSH_KEY_PATH`,
  `BACKUP_KNOWN_HOSTS_PATH` e `BACKUP_SFTP_PORT` (23), facoltative fuori dalla produzione.
- **Segreti, schema finale (correzione del coordinatore):** un segreto `environment:` (e un `configs`
  con `content`) non si monta in un servizio `read_only` (`file is the sole supported option`, provato),
  e sei file avrebbero duplicato i valori del file d'ambiente. Quindi `PGPASSWORD`, `S3_ACCESS_KEY`,
  `S3_SECRET_KEY` come l'API (`${POSTGRES_PASSWORD}` ecc.); `RESTIC_PASSWORD` e `BACKUP_SFTP_HOST/USER/PATH`
  con `${VAR:-}`, vuote se mancano (`need` e `setup_restic` di `lib.sh` rispondono già 78 con valore
  vuoto, provato dalla prova di fumo: nessuna modifica a `lib.sh`); solo chiave SSH e `known_hosts` sono
  `secrets:` con `file:` e percorso predefinito `./backup-chiavi/{ssh_key,known_hosts}`. Verificato con
  `up --dry-run --pull never` senza profilo e senza quei file: gli altri servizi partono; nessun `${VAR:?}`
  rimasto per il backup, quindi `up` e lo staging non richiedono nulla. `RESTIC_PASSWORD` e le altre
  password in chiaro nell'ambiente (`docker inspect`): rischio accettato, annotato in README §8 per la W4.
- [x] Rete d'uscita `backup-out` (non interna), solo per il backup; `README.md` §8 ha la voce W4
  (catena `DOCKER-USER`, uscita solo verso la Storage Box sulla porta 23 e il DNS).
- [x] Memoria: `README.md` §7 riscritta (produzione 3712, staging 3328, totale 7040 < 7168);
  §1 con una riga sul servizio.
- **Per la T6:** `run` avvia `db` e `objects` (dipendenze); i file dei segreti vanno creati dai
  valori sintetici dello stack. **Per la W5:** chiave SSH e known_hosts in `infra/deploy/backup-chiavi/`
  (o nei percorsi indicati), leggibili dall'utente 10003 (i montaggi mantengono i permessi dell'host);
  lo staging non imposta nulla. **Per la T8:** il README di backup e ripristino
  non è ancora scritto.

### T5 — Conservazione e cifratura

- [x] Prova della conservazione (W3-5): `conservazione-1f.test.ts`, 36 istantanee di amoris con
  `restic backup --time` su 240 giorni (due il giorno 1 e due il giorno 95; giorni 1-10 consecutivi;
  mesi senza istantanee; ore 6, 8, 12, 18, 20, 23) più 5 di un altro host o di un'altra etichetta;
  poi lo script vero. Insieme atteso, calcolato nella prova con le regole di restic (lette il
  2026-11-06 su restic.readthedocs.io, «Removing backup snapshots»): 13 di amoris (con oggi al
  2026-11-06: 6, 5, 4, 3, 2 e 1 novembre, 31 e 25 ottobre, 16 ottobre, 25 settembre, 28 agosto,
  29 giugno, 30 maggio) più le 5 estranee, tutte intatte (lo script filtra con
  `--host amoris --tag amoris-backup`). Il modello verifica che ogni politica tenga qualcosa che le
  altre non tengono. Mutazioni rosse (1 prova su 10 ciascuna): `--keep-daily 4`, `--keep-weekly 3`,
  `--keep-monthly 5`; `--keep-daily 6` resta verde per coincidenza di calendario (il giorno escluso
  è tenuto dal mese). Verde 10/10, 87 s.
- [x] Prova della cifratura (W3-4): controllo positivo (le stringhe stanno in chiaro nel dump e negli
  oggetti sottoposti a backup), poi nessuna delle tre stringhe uniche (riga, contenuto, nome
  oggetto) in nessun file del repository copiato dal server SFTP, con `config`, `keys/` e `data/`
  presenti; `check` e `backup` con password sbagliata escono con codice diverso da 0 (passo
  `repository`, 12), lo stato `last-<cmd>.json` coincide con l'uscita e nessuna password compare.
  Mutazione rossa: un file in chiaro nel repository, 1 prova su 10.
- Nessun difetto dello script trovato; script e Dockerfile invariati.
- **Per la T6/T8:** due esecuzioni di Vitest insieme su Docker danno falsi rossi e «10 skipped»:
  una alla volta. Nel README: `forget --prune` agisce solo sulle istantanee di host `amoris` con
  etichetta `amoris-backup`; altre istantanee nello stesso repository non vengono mai potate.

### T6 — Prova di ripristino completo (W3-7, W3-8)

Eseguita il 2026-11-07, solo dati sintetici, progetto Compose `amoris-production` locale; file d'ambiente,
chiavi e riferimenti nello scratchpad (fuori da Git). Dati e tempi sono di una prova piccola, non della produzione.

- [x] Stack `amoris-production` locale dalle immagini `amoris-{web,admin,api,scrub,backup}:prova` (la `backup`
  rietichettata da `prova-1f`, più recente del Dockerfile), `up -d --wait` (44 s, a freddo), `migrate` (8 s, migrazioni
  in 2,9 s), seme con `tests/e2e/prepara.ts` sul database e sull'archivio **dello stack** (16 s; ricrea `amoris_e2e` e lo
  migra da sé). Il seme mette 1 oggetto per bucket: aggiunti con `mc` (immagine del Compose, per digest) 4 oggetti
  pubblici e 3 riservati, casuali o di testo: 3 MiB, 68 KiB, 1 byte, **0 byte**, nome con spazi, percorso annidato.
  Totale 5 pubblici + 4 riservati.
- [x] Riferimento: 34 tabelle (schema `public` e `drizzle`, 12 migrazioni), 75 righe in tutto; estensioni `citext` 1.6,
  `pgcrypto` 1.3, `unaccent` 1.1 (più `plpgsql` 1.0); SHA-256 e dimensione di ognuno dei 9 oggetti.
- [x] SFTP di prova (D263): `sftp-prova.Dockerfile`, contenitore `amoris-t6-sftp`, chiavi in un volume Docker (la chiave
  dell'host vuole 0600: da cartella di Windows sarebbe rifiutata) e repository in un secondo volume, entrambi fuori dal
  progetto Compose; collegato a `amoris-production_backup-out` con alias, porta 2222.
- [x] Backup: `init` (6 s, `repository: created`), `backup` (7 s: dump 97 959 byte, 9 oggetti, 6 432 582 byte; una
  istantanea), `check` (2 s), tutti con esito `ok`. Tempi di script; con l'avvio del contenitore ogni comando dura
  circa 5 s in più. Repository sull'SFTP: 4 232 KiB.
- [x] `down -v` del solo progetto, dopo aver elencato i sette volumi (`backup-{cache,data,state}`, `caddy-{config,data}`,
  `db-data`, `objects-data`) e staccato l'SFTP; nessun volume del progetto rimasto.
- [x] Stack 2 con volumi nuovi: `up -d --wait` (27 s), **senza** `migrate` e **senza** `prepara.ts`. L'API all'avvio
  non scrive nel database (zero schemi, zero relazioni): `restore latest` con **tutto lo stack acceso** funziona, 2 s di
  script (7 s con il contenitore), `ok`, stessa istantanea, stesse dimensioni.
- [x] Confronto: stesse 34 tabelle con le stesse righe (75), stesse estensioni e versioni, stessi 9 SHA-256 e byte
  (compreso l'oggetto da 0 byte e quello annidato); zero differenze.
- [x] E2e attraverso Caddy (`E2E_STACK_URL`, senza `prepara.ts`): `regole-strutturali.spec.ts` e
  `titolo-nel-head.spec.ts`, 2 spec, **8 prove su 8 verdi** (6 s): pagina del seme resa dal database ripristinato, 404,
  JSON-LD, robots, intestazioni dell'area. In più, come prova dell'accesso con gli account ripristinati,
  `cms/accesso.spec.ts`, 5 su 5 (scrive solo sessioni; eseguita dopo il confronto). Esclusi i 23 spec di `cms/`
  restanti: scrivono contenuti, media, account o impostazioni. Il PDF pubblico ripristinato si legge da
  `/media/...` (200, 554 byte) e la sitemap risponde 200.
- [x] Pulizia: `down -v` dello stack 2, contenitore e volumi `amoris-t6-*` rimossi (`docker rm -v` per il volume
  anonimo dell'immagine di base), rete di prova tolta dal Compose; volumi 41 prima e 41 dopo, identici per nome;
  `amoris-dev-*` accesi e intatti; immagini `amoris-*:prova` restano (tolta solo `amoris-sftp-prova:t6`).
- **Sequenza (segnaposto per i segreti):** file d'ambiente `<generato>` fuori da Git; `docker compose -f
  infra/deploy/compose.yml [-f tests/compose.e2e.yml] --env-file <file> up -d --wait`; `--profile release run --rm
  migrate`; `--profile backup run --rm backup init|backup|check`. Dopo la perdita dei volumi: `up -d --wait`, **non**
  `migrate`, poi `--profile backup run --rm backup restore latest` (o l'identificativo).
- **Difetti:** nessuno dello script né delle immagini; nessuna correzione. Non riverificato in questo giro il rifiuto
  (65) di un ripristino su destinazione piena (l'uscita è risultata vuota): resta coperto da `ripristino-1f.test.ts`.
- **Per la T7:** su Windows servono `MSYS_NO_PATHCONV=1` e il file d'ambiente con percorso in forma `C:/...`; il
  `down` deve avere `--profile backup` (e `release`) per togliere anche il contenitore creato e le reti; la rete
  `backup-out` esiste solo dopo `create`/`run` del backup (la prova ha usato `create backup`, poi `network connect`
  dell'SFTP). L'immagine di base dell'SFTP dichiara un volume anonimo: `docker rm -v`.
- **Per la T8 (README e `docs/deploy/backup-verification.md`):** scrivere la sequenza sopra; dire che il ripristino
  vuole database e bucket vuoti (volumi nuovi, `objects-init` crea i bucket vuoti) e che le migrazioni le porta il
  dump; tempi e dimensioni della prova (solo conteggi: 34 tabelle, 75 righe, 9 oggetti, 4 232 KiB di repository, 2 s
  di ripristino); estensioni provate; chiavi dell'host dell'SFTP nel volume e `known_hosts` con `[host]:porta`;
  e2e di lettura e che gli spec di `cms/` non vanno rieseguiti su uno stack da conservare.

### T7 — Revisione e verifica

- [x] Revisione `code-reviewer` su Dockerfile, script, Compose; correzioni di critici e alti (2026-11-07).
  Rilievi e esito:
  - **A1 stato non scrivibile**: corretto. Ogni comando verifica all'avvio, con una scrittura vera (`test -w` di
    BusyBox non vede un volume in sola lettura), che lo stato sia scrivibile: altrimenti passo `state_write`, codice 74,
    prima di dump e rete; un errore con stato non scritto porta `state_written:false`. Prove `backup-1f`:
    **rosse** 3 su 3 (volume in sola lettura, cartella non scrivibile dall'utente 10003, `emit` provato con `lib.sh`
    letto dentro il contenitore), poi verdi.
  - **M1 uscite silenziose**: corretto. La trappola di uscita emette `unexpected` con il codice (1 se era 0) se non c'è
    stata nessuna riga; SIGTERM dà `unexpected` con 143. Prove: **rosse** 2 su 2 (`false` sotto `set -eu`, SIGTERM
    durante un passo lungo), poi verdi.
  - **M2 segnali**: corretto, `init: true` per `backup`. Prova in `compose-1f`: **rossa** 1 su 47, poi 47/47.
  - **M3 esecuzioni concorrenti**: corretto. `backup` e `restore` prendono `flock -n` su `.lock` nel volume di stato
    (`flock` c'è: BusyBox); occupato: passo `busy`, codice 75; la pulizia di `.database.dump.tmp` e `.restore` solo con il
    lock; `init` e `check` non lo prendono. Prove con un secondo contenitore che tiene il lock: **rosse** 2 su 3 (backup e
    restore; la terza, `check` con il lock tenuto, nasce verde per costruzione), poi 3/3.
  - **M4 istantanea vuota**: corretto, con prova (`restic` finto davanti nel `PATH`, immagine intatta): **rossa**, poi verde.
  - **Bassi**: corretti, ognuno con prova rossa prima: host con primo carattere `-` (`-oProxyCommand=x` era già 78 per il
    `=`: la prova ha anche `-xhost`), `BACKUP_SSH_CONNECT_TIMEOUT` numerico (78), `.restore` escluso dall'istantanea
    (`restic ls`: 1 → 0).
  - **Prove fragili**: `conservazione-1f`, analizzati nel modello 731 giorni (2026-01-01…2027-12-31) per tre ore del
    giorno: **0 giorni** in cui `only('weekly')`, `only('monthly')` o `reasons.size < group.length` falliscono, prima e
    dopo; nessuna data da cambiare. Aggiunta una prova pura che lo verifica a ogni giro (verde per costruzione, nessun rosso
    da annotare). `ripristino-1f`: tolti `console.log` e `afterEach(sleep(100))`.
  - **Rinviati**: guasto durante la copia degli oggetti nel ripristino, T8 (documentazione); `--no-deps` per `check` e
    `init` nel timer, W5 e T8; spazio del volume e ripiego della cache in `/tmp`, nota di capacità in T8 e W5.
  - **Accettati**: pacchetto `ssh` di Alpine non fissato alla revisione (già annotato); segreti nell'ambiente (rischio
    accettato).
- [x] Verifica come la CI (W3-11), 2026-11-07, dal coordinatore: `install --frozen-lockfile`, lint,
  Prettier su tutti i file di Git (a gruppi con `node .../prettier.cjs`: con `pnpm exec` la riga di
  comando di Windows è troppo lunga), typecheck, build, test di tutti i pacchetti, `db:verify`,
  copertura 93,64 % delle righe, e2e 69/69; `test:images` 213/213 e `check-image` (3920 voci) dal
  correttore.

### T8 — Documenti e chiusura

- [x] Decisioni dopo il parere MI-06 (2026-11-07): D267 = B (DR-379, conservazione 7 giornalieri +
  4 settimanali, circa 35 giorni, supera il 7/4/6 di DR-373), D268 = A (DR-380, chiavi in doppia
  copia manutentore e Centro, integra DR-298), D269 = A (DR-381, registro delle cancellazioni nella
  `1F-W6`); parere in Git (DR-382).
- [x] Conservazione 7/4 nello script; `backup-1f` e `conservazione-1f` riscritte prima (2 rosse su
  48), poi 48/48; mutazioni `--keep-monthly 6` e `--keep-weekly 3` rosse; `--keep-daily 6` rossa
  solo sull'argomento esatto di `forget` (coincidenza di calendario, spiegata nel documento di
  verifica). `test:images` 213/213; volumi 41 prima e dopo.
- [x] `docs/deploy/backup-verification.md`: metodo, versioni, esiti, tempi, limiti della prova
  locale e dieci punti da provare sul server nella W5.
- [x] `infra/deploy/README.md`: nuova §8 «Backup e ripristino» (inizializzazione, backup, check,
  ripristino, codici d'uscita, ripartenza dopo `objects_restore`, `--no-deps`, `known_hosts`,
  uid 10003); i rinvii passano alla §9 (le citazioni «README §8» di questo piano e della W2 sono
  storiche).
- [x] Handoff **HO-059** (chiavi dei backup, doppia copia, prova con la copia del Centro),
  **eseguito nella W5**. Da verificare alla W5: lettura dello stato e prova con la copia del
  Centro non eseguiti; rotazione della password restic rinviata a un handoff proprio.
- [x] `CONTEXT.md` §4 aggiornato. Dipendenze contro PLAN §5: `restic` e `mc` previsti;
  `openssh-client-default` (fissato a revisione) **non elencato**, necessario al trasporto SFTP
  deciso con DR-335: scostamento dichiarato qui. `openssh-server` solo nell'immagine di prova
  (DR-378), fuori dal Compose e dalla CI di pubblicazione.
- [ ] Commit e push **su conferma**; CI verde, cinque immagini pubblicate; riga
  `PHASE:1F WAVE:1F-W3 STATUS:complete`.

## 4. Decisioni

Da chiedere con `grill-me` prima della T1, in due round (massimo cinque domande ciascuno).

| id | Decisione | Opzioni | Raccomandazione | Blocca |
|---|---|---|---|---|
| **D257** | Immagine del servizio `backup` | A Dockerfile proprio: base fissata per digest, binario ufficiale di restic con SHA-256 della release, client PostgreSQL 17, `mc` copiato dall'immagine Chainguard già usata · B immagine ufficiale `restic/restic` con il client PostgreSQL aggiunto · C due contenitori (dump e restic) che si passano un volume | **A**: una sola immagine controllata come le altre, versioni allineate al server PostgreSQL | T1 |
| **D258** | Chi avvia il backup ogni giorno | A timer di systemd sull'host che lancia `docker compose run --rm backup` (impianto nella W5, da handoff) · B contenitore sempre acceso con pianificatore interno (es. `supercronic`, dipendenza nuova) · C cron dell'host | **A**: nessun processo acceso tutto il giorno, nessuna dipendenza nuova, memoria occupata solo durante il backup; l'esito resta nel registro di D261 | T2, T4 |
| **D259** | Copia degli oggetti | A `mc mirror` dei due bucket in un volume di appoggio persistente (solo le differenze ogni giorno), poi restic su quel volume · B restic legge direttamente il volume di MinIO (formato interno, ripristinabile solo con MinIO compatibile, coerenza non garantita a servizio acceso) · C `rclone` (dipendenza nuova) | **A**: copia nel formato dei file, indipendente dalla versione di MinIO; costa spazio pari agli oggetti (oggi < 1 GB) | T2, T3 |
| **D260** | Formato del dump | A `pg_dump` formato custom **senza** compressione interna (restic deduplica e comprime) · B SQL in chiaro · C `pg_dump` custom compresso | **A**: ripristino selettivo con `pg_restore`, deduplicazione efficace fra un giorno e l'altro | T2, T3 |
| **D263** | Destinazione di prova in locale | A contenitore SFTP locale, solo per le prove (immagine fissata per digest), così chiave SSH e `known_hosts` si provano già ora come sulla Storage Box · B repository restic in una cartella locale; SFTP provato solo sul server nella W5 | **A**: gli errori di trasporto emergono prima del server | T2, T6 |
| **D261** | Dove si registra l'esito | A riga JSON nel log del contenitore e file di stato in un volume (data, esito, durata, byte, identificativo), codice d'uscita ≠ 0; avvisi secondo D227 nella W8 · B anche email al Centro (dipende dall'SMTP della W6) · C solo il log | **A** | T2 |
| **D262** | Ambienti sottoposti a backup | A solo la produzione · B produzione e staging, in repository separati | **A**: lo staging contiene copie ricreabili; dimezza tempi e spazio | T4 |
| **D264** | Manutenzione del repository | A `forget --prune` dopo ogni backup, `restic check` settimanale con lettura del 10 % dei dati · B `prune` settimanale, `check` mensile · C solo `forget`, `prune` a mano | **A**: lo spazio non cresce oltre la politica e i dati si rileggono a campione | T2 |

Round 1 chiuso il 2026-11-06: D257 = A (DR-366), D258 = A (DR-367), D259 = A (DR-368), D260 = A
(DR-369), D263 = A (DR-370). Round 2 chiuso il 2026-11-06: D261 = A (DR-371), D262 = A (DR-372),
D264 = A (DR-373).

## 5. Rischi e rientro

| Rischio | Mitigazione |
|---|---|
| Chiunque controlli il server può cancellare i backup (`forget` gira dal server) | Istantanee della Storage Box non cancellabili dal server, da verificare all'ordine (DR-335); annotato per la W4 e la W5 |
| Password del repository persa: backup illeggibili | Handoff HO-058 con copia fuori dal server (DR-298); la W3 usa solo una password di prova |
| Dump coerente ma oggetti copiati in un altro istante: un media caricato fra i due manca o avanza | Ordine fisso (prima il database, poi gli oggetti): un oggetto in più è innocuo, uno in meno no; la prova lo dichiara |
| Spazio del volume di appoggio | Dimensione annotata; taratura sul server nella W5 |
| Disco pieno durante le prove (HO-057) | Controllo in T0; volumi di prova rimossi su conferma |
| Rientro della wave | Il servizio è nuovo e nel suo profilo: togliere il servizio dal Compose e l'immagine dalla CI riporta allo stato della W2 |

## 6. Assunzioni dichiarate

- Il server avrà PostgreSQL 17: il client nell'immagine resta della stessa versione maggiore.
- Restic via SFTP verso la Storage Box è quanto deciso (DR-335); non si valuta `borg`.
- Il contenuto del sito è pubblico, ma il database contiene account e compilazioni dei
  moduli: il backup si tratta come dato personale (cifratura, nessun contenuto nei log).

## 7. Conferme richieste nella wave

| # | Che cosa |
|---|---|
| 1 | decisioni dei due round |
| 2 | rimozione dei volumi di prova durante e dopo la T6 |
| 3 | commit e push a fine wave |
