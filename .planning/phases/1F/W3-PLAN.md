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

- [ ] Prove: ripristino su database **vuoto** e bucket vuoti; rifiuta di partire se il database
  contiene già tabelle o i bucket contengono oggetti (nessuna sovrascrittura per errore);
  istantanea scelta per identificativo o `latest`. **Rosse** prima.
- [ ] `infra/deploy/backup/restore.sh`: `restic restore` in `/tmp` del contenitore,
  `pg_restore` (o `psql`), `mc mirror` verso i bucket; esito registrato come per il backup.

### T4 — Servizio nel Compose

- [ ] Prove in `infra/deploy/tests/compose-1f.test.ts`: servizio `backup` nel profilo e con la
  pianificazione di D258; reti `data` e una rete d'uscita **solo** verso la destinazione;
  sola lettura, `cap_drop ALL`, `no-new-privileges`, limite di memoria; segreti senza
  predefinito; nessuna porta. **Rosse** prima.
- [ ] Servizio `backup` in `infra/deploy/compose.yml`; chiavi nuove in
  `.env.production.example` (prova `env-example-1f` rossa prima).
- [ ] Rete d'uscita: il contenitore raggiunge la destinazione e nient'altro di necessario;
  annotare in `README.md` §8 per la W4 ciò che Docker da solo non sa limitare.
- [ ] Memoria: limite del servizio e tabella di `README.md` §7 aggiornati (W3-10).

### T5 — Conservazione e cifratura

- [ ] Prova della conservazione: istantanee datate con `restic backup --time` su 8 mesi, poi
  `forget` con la politica; restano 7 + 4 + 6 secondo le regole di restic (W3-5).
- [ ] Prova della cifratura: nessuna stringa nota dei dati sintetici nei file del repository;
  password sbagliata → errore (W3-4).

### T6 — Prova di ripristino completo (W3-7, W3-8)

- [ ] Stack `amoris-production` locale dalle immagini (come la T10 della W2), migrazioni, seme
  sintetico **sull'archivio dello stack**, non su quello di sviluppo (lezione della W2).
- [ ] Repository di prova secondo D263; backup; conteggi delle righe di ogni tabella e SHA-256 di
  ogni oggetto salvati come riferimento (solo numeri e impronte, nessun contenuto).
- [ ] `down`, volumi **di prova** rimossi su conferma (PLAN §7 riga 7); stack nuovo, migrazioni
  **non** eseguite (le porta il dump); ripristino; confronto; e2e di lettura verdi attraverso
  Caddy.
- [ ] Tempo del backup e del ripristino misurati e annotati.

### T7 — Revisione e verifica

- [ ] Revisione `code-reviewer` su Dockerfile, script, Compose; correzioni di critici e alti.
- [ ] Verifica come la CI (W3-11).

### T8 — Documenti e chiusura

- [ ] `docs/deploy/backup-verification.md`: metodo, versioni, esiti, tempi, limiti della prova
  locale (cosa resta da provare sul server nella W5, 1F-2).
- [ ] `infra/deploy/README.md`: backup, ripristino, inizializzazione del repository.
- [ ] Handoff della chiave (numero assegnato alla scrittura; HO-058 è l'acquisto della Storage Box): creazione della password del repository e della chiave
  SSH, custodia di una copia fuori dal server (DR-298); **eseguito nella W5**, non ora.
- [ ] `CONTEXT.md` §4 e questo piano aggiornati; dipendenze confrontate con PLAN §5.
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
