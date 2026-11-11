# Piano della wave 1F-W5 — Server, staging e primo rilascio

> **Per chi esegue:** passi con caselle `- [ ]`. Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Prima la prova che fallisce,
> poi la correzione. Nessun commit, rilascio, record DNS o cancellazione senza la sua conferma.

Scritto il 2026-11-09, dopo la chiusura della `1F-W4` (`f18db86`). Dipendenze (PLAN §3): ordine
e indurimento nessuna; dati del Centro sul server la `1F-W4`, chiusa (DR-374), con il rischio di
DR-385 approvato per iscritto (DR-394). Esecuzione (PLAN §2, DR-357): **Sonnet** per codice,
istruzioni e verifiche; **l'utente** per ordini, accessi, DNS e ogni comando sul server dato da
handoff; un **revisore separato** a contesto nuovo per il riesame del diff (come DR-383).

**Obiettivo:** un server Aruba indurito che ospita produzione, non pubblicata, e staging,
pubblicato dietro password, con un unico ingresso sulle porte 80 e 443, il primo rilascio dalle
immagini della CI, il backup cifrato attivo verso la Storage Box e un ripristino completo provato
sul server, tutto installato seguendo solo la documentazione del repository.

**Riferimenti:** PLAN §1 (riga `1F-W5`); criteri 1F-1, 1F-2, 1F-4, 1F-12
(`docs/qa/acceptance-criteria.md` §7); HO-056, HO-058, HO-059, HO-061;
`docs/deploy/security-review-1F.md` §10; `docs/deploy/backup-verification.md` §8;
`infra/deploy/README.md` §7 e §9; DR-296, DR-297, DR-334, DR-335, DR-338, DR-353, DR-356, DR-357,
DR-372, DR-375, DR-376, DR-379, DR-380, DR-402, DR-403, DR-405; skill `deployment-gate`
(separazione degli ambienti, smoke test).

**Cosa la wave non fa:** non cambia i record di `www` (W8) e non pubblica la produzione; non
configura la posta (W6); non importa i contenuti del Centro (W7, se D296 = A); non misura le
prestazioni del sito (1F-5, W7); non prova il rientro all'etichetta precedente (1F-6, W7); non
dichiara conformità GDPR (1F-11). L'agente **non riceve mai** credenziali di fornitori, del server,
della Storage Box o di GitHub.

---

## 1. Punto di partenza (T0, letto il 2026-11-09 su `f18db86`)

| Area | Fatto osservato | Che cosa conta per la wave |
|---|---|---|
| Repository | `main` pulito su `f18db86`; CI 42595603432 verde (verifica e cinque immagini) | base del codice della wave |
| Server e Storage Box | HO-056 e HO-058 «eseguibili» dal 2026-11-06; nessuna esecuzione segnalata | per il repository **non esistono ancora**; dopo il 2026-11-20 prezzi da ricontrollare (HO-056 §2) |
| Handoff | HO-059 e HO-061 scritti, da eseguire; HO-061 §10 lascia quattro voci da decidere | ordine dei passi fissato qui (§3) |
| Porte 80 e 443 | `compose.yml`: un Caddy per ambiente pubblica `CADDY_HTTP_PORT` e `CADDY_HTTPS_PORT`; uno staging su altre porte non ottiene un certificato pubblico (README §9) | produzione e staging non possono avere entrambi 80 e 443 → **D295** |
| Rete `backup-out` | sottorete e bridge fissi (`10.77.86.0/24`, `amoris-bkp-out`); una sola catena `AMORIS-BACKUP-OUT` in `firewall/backup-out.sh` | un ripristino nello staging via SFTP crea una seconda rete con lo stesso bridge; una seconda applicazione dello script sostituisce le regole della produzione → **D298** |
| Memoria | README §7: 7040 MiB per i due ambienti, limite 7168 | un servizio d'ingresso da 128 MiB arriva esattamente al limite |
| Primo account | `account-create` rifiuta un database non locale (R24, HO-061 §8); `tools/seedSintetico.ts` non è nell'immagine dell'API | servono una procedura sul server e un modo di portare dati sintetici → **D296** |
| GitHub (`gh api`) | repository privato dell'organizzazione `F1-Solution`, piano **Free**, due amministratori; nessun ambiente né segreto; protezione dei rami non disponibile; Actions `allowed_actions: all`, `sha_pinning_required: false` | impostazioni da indurire (T6) |
| Documentazione GitHub (letta il 2026-11-09) | con Free, Pro o Team i revisori obbligatori degli ambienti valgono solo per i repository pubblici; con Free niente segreti d'ambiente nei privati; GHCR accetta solo token classici con `read:packages` o il `GITHUB_TOKEN` di un repository con accesso in lettura al pacchetto | DR-357 presupponeva l'«approvazione dell'ambiente»: **non disponibile** → **D297** |
| Hetzner (documentazione, 2026-11-09) | BX11: fino a 10 istantanee automatiche; i sotto-account vedono solo la propria cartella, che può essere in sola lettura | R12 e R14 → **D301**; calendario delle istantanee da leggere in T6 |
| Versioni (release ufficiali, 2026-11-09) | Trivy v0.76.2 del 2026-11-05 (< 2 settimane) → resta **v0.76.1** fino al 2026-11-19; gitleaks **v8.30.1**; restic **v0.19.1**, nessuna correttiva; Caddy 2.11.9 e 2.11.8 (< 2 settimane), in uso **2.10.2** | regola delle due settimane per ogni base aggiornata → **D299** |
| Postazione | Docker 29.9.2; accesi solo `amoris-dev-db` e `amoris-dev-objects`; 46 volumi; **36 GB liberi** su `C:` (68 alla T0 della W4) | una suite Docker alla volta; pulizia di immagini e cache su conferma |

## 2. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W5-1 | Server indurito | uscite di verifica senza segreti: accesso solo con chiave, `root` escluso, firewall con 22, 80 e 443, aggiornamenti di sicurezza attivi secondo D300, versione di Docker e di Compose; porte dei servizi interni chiuse viste dall'esterno |
| W5-2 | Ingresso comune | un solo servizio pubblica 80 e 443; i due ambienti su reti separate; l'indirizzo del visitatore arriva all'API attraverso i salti, e un `X-Forwarded-For` falsificato dal client non sposta il conteggio (prova della W4 T3 ripetuta); nessun certificato chiesto per il nome della produzione prima della W8 |
| W5-3 | Rilascio | rilascio avviato a mano solo da `main`; sul server il comando forzato rifiuta ogni altro comando; nessuna credenziale stabile del registro sul server; `actionlint` e prove dello script verdi |
| W5-4 | Immagini del rilascio | basi secondo D299; Trivy (solo conteggi): nessun critico o alto con correzione non applicata, o nuova decisione; gitleaks 0 su cronologia e immagini; `check-image` pulito |
| W5-5 | Staging pubblicato | HTTPS con certificato valido sul sottodominio di D304; 401 senza password su sito, `/admin`, `/api`, `/media`; `robots.txt` che rifiuta e `X-Robots-Tag: noindex`; `/api/openapi.json` e `/api/health*` 404; smoke test del §3 T9 verdi |
| W5-6 | Backup attivo | `init`; timer giornaliero del backup e settimanale del `check`, esito nel journal; firewall di `backup-out` con un'uscita negata provata; istantanee e sotto-account secondo D301; prova che il server non cancella le istantanee |
| W5-7 | Ripristino sul server (1F-2) | ripristino completo dal backup remoto nello staging: tabelle, estensioni e impronte degli oggetti uguali al riferimento; `check` e `restore` con la **copia del Centro** (DR-380) |
| W5-8 | Misure | caricamento sintetico da 100 MB e tempi dell'archivio (N2, DR-338); picco di memoria di ogni servizio e del backup contro README §7; spazio di `backup-data` e `backup-cache`; ritorno di servizi, regole e timer dopo un riavvio |
| W5-9 | Azioni della security review | HO-061 §4–§9 con l'esito atteso; pulizia di `auth-purge` attiva nei due ambienti; procedura del primo account (R24) provata sullo staging con una persona sintetica |
| W5-10 | Nessuna regressione | verifica come la CI (frozen, audit, lint, Prettier sui file di Git, typecheck, build, test, `db:verify`, copertura ≥ 80 %, e2e attraverso l'ingresso, `test:images`, `check-image`) |
| W5-11 | Riesame | revisore separato sul solo diff della wave: zero critici e alti aperti; medi corretti o accettati con DR |
| W5-12 | Documenti e chiusura | installazione eseguita seguendo **solo** documenti del repository (1F-1 per il server); rapporto in `docs/deploy/`; handoff con esito; commit e push su conferma; CI verde; riga `STATUS:complete` |

## 3. Attività

Percorsi nuovi, fissati se le decisioni seguono la raccomandazione: `infra/deploy/ingresso/`
(Compose e `Caddyfile` dell'ingresso), `infra/deploy/rilascio/` (script del server),
`.github/workflows/rilascio.yml`, `docs/deploy/server-e-staging-1F-W5.md`, handoff HO-062…HO-064.

### T0 — Linea di base

- [x] `PROGRESS.md` letto: ultima riga `PHASE:1F WAVE:1F-W4 STATUS:complete`; nessuna riga `1F-W5`.
- [x] `main` pulito su `f18db86`; CI 42595603432 verde.
- [x] Fatti del §1 rilevati il 2026-11-09 (repository, handoff, Compose, GitHub, Hetzner, versioni,
  postazione). Nessun accesso a server, Storage Box o account dei fornitori.
- [x] Decisioni D295…D299 prese e registrate (§4, primo round): DR-409…DR-413 il 2026-11-09,
  riepilogo in [`W5-decisioni.md`](W5-decisioni.md).

### T1 — Acquisti e primo accesso (utente)

- [ ] HO-056 eseguito: server creato, Ubuntu 24.04 LTS confermato, indirizzi IPv4 e IPv6,
  uscita del §8 passo 5 (non contiene segreti). Dopo il 2026-11-20: prima il ricontrollo dei prezzi.
- [ ] HO-058 eseguito: BX11 in Germania, contratto per i dati accettato, nome utente e host
  annotati (non segreti).
- [ ] Esiti scritti nei due handoff e nell'indice.

T1 non blocca T2…T5, che lavorano in locale.

### T2 — Ingresso comune su 80 e 443 (D295, Sonnet, prova prima)

Se D295 = A:

- [x] Prove rosse prima, in `caddy-1f` e `compose-1f`: un solo servizio pubblica 80 e 443; le reti
  dei due ambienti non si vedono; intestazioni, password dello staging e `robots.txt` uguali
  attraverso l'ingresso; senza nome della produzione l'ingresso non chiede certificati per quel nome.
  (T2a: anche `ingresso-1f`, 30 prove.)
- [x] Progetto Compose dell'ingresso con l'immagine di Caddy già fissata per digest, unico a
  pubblicare 80 e 443, TLS per i nomi valorizzati, inoltro per nome ai Caddy degli ambienti su due
  reti esterne separate.
- [x] Caddy degli ambienti senza porte pubblicate, in HTTP dietro l'ingresso, con `trusted_proxies`
  limitato alla rete dell'ingresso; catena dell'indirizzo del visitatore fino all'API (DR-401, DR-402).
  Prova a livello di Caddy con servizi finti (T2a); con l'API vera nella casella seguente (T2b).
- [x] Prova della W4 T3 ripetuta attraverso i due salti: un `X-Forwarded-For` falsificato dal client
  non sposta il conteggio dei tentativi. (T2b: `sicurezza-1f` 61/61, con la prova nuova «visitatori
  distinti, conteggi distinti» e il controllo negativo `subnet` rosso.)
- [ ] Prima emissione verso l'ambiente di prova di ACME, poi verso quello vero (§5). Nel codice:
  `INGRESS_ACME_CA` obbligatoria (T2a); l'emissione si fa sul server nella T7.
- [x] e2e attraverso l'ingresso sullo stack d'immagini locale; README §1, §3, §6, §7. (T2b: 71/71
  con il nome `localhost`, perché Node su Windows non risolve `*.localhost`.)

### T3 — Rilascio, ripristino nello staging e primo account (D297, D298, Sonnet)

- [x] **T3a** — script di rilascio sul server (se D297 = A): accetta solo `production` o `staging`
  e un hash di 40 caratteri esadecimali; riceve la cartella `infra/` di quel commit e il token del
  registro dall'ingresso standard; `docker login --password-stdin`, `pull`, `up -d --wait`,
  `logout`; migrazioni solo con un indicatore esplicito; riga JSON d'esito senza valori segreti.
  Prova del comando forzato: ogni altro comando rifiutato. (`rilascio-1f` 51/51 con `sshd` vero e
  `docker` finto; percorsi in `/opt/amoris`, `corrente` e `rilascio.env` per le unità della T8.)
- [x] **T3b** — `.github/workflows/rilascio.yml`: avvio a mano, solo `refs/heads/main`, hash con
  le cinque immagini già pubblicate, `permissions: contents: read, packages: read`, una sola
  esecuzione per ambiente alla volta, azioni per SHA, `known_hosts` del server fissato;
  `actionlint` per digest; prove in `ci-immagini-1f`. (25/25; segreto `RILASCIO_SSH_KEY`, variabili
  `RILASCIO_HOST` e `RILASCIO_KNOWN_HOSTS`, utente `deploy`, per HO-064.)
- [x] **T3c** — se D298 = A: sottorete, bridge e catena del firewall per ambiente; `firewall-1f`
  con due ambienti, rossa prima (la seconda applicazione cancella le regole della prima). (23/23;
  `10.77.86.0/24` e `amoris-bkp-prod`, `10.77.87.0/24` e `amoris-bkp-stag`.)
- [x] **T3d** — primo account (R24): `account-create` eseguibile nel contenitore dell'API sul
  database del Compose, con ambiente dichiarato e conferma; password temporanea mostrata una sola
  volta, cambio e attivazione del TOTP obbligatori al primo accesso (DR-228, DR-398). Prova rossa
  prima. Conteggio delle righe dell'autenticazione rifatto con la regola invariata (nucleo 786 su
  800, DR-395): oltre 800, stop e ripresentazione. (Nucleo 789, totale 2109 con `localAccount.ts`;
  prova nel contenitore in `ruoli-1f` rossa sulle `w4-t7a` come atteso, verde nella T4.)

### T4 — Basi aggiornate e scansioni (D299, DR-405)

- [x] Digest delle basi rilette dalle release ufficiali, ciascuna pubblicata da almeno due settimane.
  (`mc` a `latest-dev` `20d1b2a3…`; Node 26.12.1, restic 0.19.1, PostgreSQL e MinIO invariati.)
- [x] Immagini ricostruite con i comandi della CI; `check-image`; `test:images` una suite alla volta.
  (`w5-t4` da `git archive`; tutte le suite verdi, `ruoli-1f` 15/15 dopo la correzione della prova.)
- [x] Trivy per digest, sola lettura da archivi `docker save`, solo conteggi; gitleaks su cronologia
  e immagini con `--redact`. Rapporti nella scratchpad, nel repository solo conteggi e verdetti.
  (Residui accettati in DR-418; gitleaks 0 sulla cronologia, 5 e 5 nei file generati da Next.)
- [x] **T4b** (DR-416) — Caddy 2.11.7 al digest attuale di `2.11.7-alpine`, Trivy prima
  dell'adozione; `caddy-1f`, `ingresso-1f`, `compose-1f`, `sicurezza-1f`; e2e nella T5.
  (`e70b164d…`, Go 1.26.8; Trivy da 6 critici e 100 alti a 1 e 10, residui con correzione 1 e 9 →
  D312; Caddyfile invariati; suite 65, 18, 30, 61.)
- [ ] **Caddy 2.11.9** (DR-420, D312 = B) — dal 2026-11-19 digest attuale di `2.11.9-alpine`,
  Trivy prima dell'adozione e le prove della T4b; nessun rilascio sul server con il 2.11.7.
- [ ] **MinIO** (DR-417) — dal 2026-11-23 primo digest con build di almeno due settimane e nuova
  scansione, prima del primo rilascio successivo e comunque prima della W7.

### T5 — Verifica, riesame e commit candidato

- [ ] Verifica come la CI (W5-10).
- [ ] Revisore separato, contesto nuovo, sola lettura, sul solo diff T2–T4 (ingresso, catena
  dell'indirizzo, comando forzato, workflow, firewall, `account-create`), senza le conclusioni del
  coordinatore. Critici e alti riprodotti dal coordinatore e corretti con prova rossa; scelte con
  `grill-me`.
- [ ] Commit e push su conferma; CI verde. Per DR-420 il **candidato** del primo rilascio è il
  commit che porta Caddy 2.11.9, non questo. Per DR-421 (D313 = A) il commit è **uno solo**, dopo
  la T5a.

### T5a — Correzioni del riesame (DR-421…DR-424, Sonnet, prova rossa prima)

- [x] **T5a-1** — `rilascia.sh`: tetto sui byte decompressi e sul numero di voci (N2); sottorete di
  `amoris-ingresso-<ambiente>` uguale a `INGRESS_SUBNET` (N4); percorsi delle chiavi di backup
  assoluti (N6); residui puliti all'avvio (N12); controlli prima di sostituire la cartella (N13);
  uscita di Docker in un file 600 sul server e al client solo la riga JSON (DR-422);
  `compose config` con i due `--env-file` reali e un `git archive` vero (N7(c)).
- [x] **T5a-2** — `account-create` scrive `account.create` con origine `cli` nel registro (N5),
  prova anche nel contenitore (`ruoli-1f`); `BACKUP_SSH_KEY_PATH` e `BACKUP_KNOWN_HOSTS_PATH`
  obbligatori e assoluti nell'esempio e nel Compose (N6).
- [x] **T5a-3** — ingresso e firewall: isolamento con il motivo del fallimento e reti `--internal`
  (N7(a)); caso `Connection: X-Forwarded-For` (N10); nomi dell'ingresso validati (N11); sottoreti
  `/0`–`/15` e stessa sottorete dell'altro ambiente rifiutate (N15).
- [x] **T5a-4** — istruzioni: README §10 con proprietari, permessi, regole `sshd` e gruppo
  `docker` equivalente a root (N8), «solo da `main`» come comodità (D8), `--force-recreate` per
  l'ingresso (N14), lettura dell'uscita di un rilascio fallito (DR-422); HO-061 su
  `rilasci/<ambiente>/corrente` e `segreti/<ambiente>.env` (N9); rapporto di sicurezza con N7(b),
  N7(d), potatura dei rilasci (N14) e N16 annotati.
- [x] Nuova verifica come la T5 sulle immagini ricostruite (almeno l'API), e2e attraverso
  l'ingresso, suite delle immagini una alla volta, gitleaks; riesame separato sul solo diff della
  T5a; poi la richiesta del commit unico. (`w5-t5a`: tutto verde, 3248 prove, e2e 71 e 71,
  14 suite; riesame 0 critici, 0 alti, 2 medi, 15 bassi → D318.)

### T5b — Correzioni del riesame della T5a (DR-426, Sonnet, prova rossa prima)

- [ ] **T5b-1** — `rilascia.sh`: cartella `vecchio` rimessa a posto e `.corrente.*` puliti (M2);
  scadenza sulle letture da stdin (M1); segnali ignorati durante la pulizia (B1); `umask 022`
  prima dell'estrazione (B4); percorsi del backup senza `/./`, `$` e commenti (B12).
- [ ] **T5b-2** — `account-create` legge indirizzo e nome da un file 600 o da stdin, non da `-e`
  (B15).
- [ ] **T5b-3** — documenti: `ClientAliveInterval 30` e `ClientAliveCountMax 4` nel `Match User
  deploy` (M1); README, HO-059 e HO-061 allineati (B5, B16) e sul nuovo `account-create`; rapporto
  di sicurezza con B2, B3, B6–B11, B13, B14 accettati per la Fase 1 e B9 rinviato (DR-427).
- [ ] Nuova verifica come la T5a, riesame separato sul solo diff della T5b, poi richiesta del
  commit unico T2–T5b.

### T5c — Dopo il commit unico, con un commit proprio (DR-429, DR-430, Sonnet, prova rossa prima)

- [ ] **T5c-1** — `rilascia.sh`: bassi 1, 2, 3, 6, 7 del riesame della T5b; **entro la T7**.
- [ ] **T5c-2** — `account-unblock` e `account-reset-totp` leggono l'indirizzo da stdin sul server
  e rifiutano `ACCOUNT_EMAIL` (DR-429); basso 9; **entro la T9**.
- [ ] **T5c-3** — documenti: bassi 11 e 12, README §3, 4, 5, 8, 10 annotati nel §7.4.
- [ ] Verifica: unità dell'API, `rilascio-1f`, `ruoli-1f`, `sicurezza-1f`, e2e; poi richiesta del
  commit della T5c.

### T6 — Server, DNS e GitHub (handoff, utente)

Dopo il secondo round (D300…D305) e la T1.

- [ ] **HO-062** — indurimento e impianto: utente amministrativo non `root` con sola chiave;
  `PermitRootLogin no`, `PasswordAuthentication no`; firewall con 22 (con limite di frequenza), 80
  e 443; aggiornamenti di sicurezza secondo D300; Docker dal repository ufficiale con versione
  fissata; utente `deploy` con comando forzato (T3a); file d'ambiente dei due ambienti (HO-061 §4)
  fuori dal repository, permessi 600. Una sessione di riserva resta aperta mentre si cambia SSH.
  Controllo che `INGRESS_SUBNET` di ogni ambiente sia uguale alla sottorete della rete
  `amoris-ingresso-<ambiente>` (`docker network inspect`): se diversa, tutti i visitatori finiscono
  in un solo conteggio dei tentativi (T2a).
- [ ] **HO-063** — record DNS dello staging su Aruba (D304): A, e AAAA se il server ha IPv6;
  verifica con `Resolve-DnsName`. Conferma puntuale.
- [ ] **HO-064** — GitHub: segreto con la chiave SSH di rilascio, variabile con il `known_hosts`
  del server, `sha_pinning_required` attivo, `GITHUB_TOKEN` predefinito in sola lettura, accesso del
  repository ai pacchetti GHCR verificato.
- [ ] Esiti con le sole uscite di verifica; nessun valore segreto all'agente.

### T7 — Primo rilascio sullo staging (conferma puntuale)

- [ ] Prerequisito (DR-420): Caddy 2.11.9 adottato e committato, CI verde.
- [ ] Avvio del workflow con il candidato e `staging`, su conferma. `db-init` e `objects-init`
  escono con 0; **nessuna migrazione**: lo schema arriva con il ripristino della T9 (il ripristino
  rifiuta un database con tabelle).
- [ ] Verifiche d'infrastruttura: HTTP verso HTTPS, certificato valido, 401 senza password,
  `robots.txt` e `X-Robots-Tag`, 404 su `/api/openapi.json` e `/api/health*`, salute interna
  (README §4), nessun «pool overlaps».

### T8 — Produzione non pubblicata, chiavi e backup (conferme puntuali)

- [ ] Rilascio dello **stesso** candidato in `production`, non pubblicata: l'ingresso non instrada il
  suo nome fino alla W8. Stessa build già passata sullo staging (`deployment-gate`).
- [ ] HO-059, rivisto per D301 (sotto-account, istantanee): chiavi, `known_hosts`, `init`, due copie
  cifrate, verbale.
- [ ] HO-061 §5 (esiti di `db-init` e `objects-init`), §6 (firewall di `backup-out` con un'uscita
  negata provata, unità e timer), §7 (pulizia giornaliera nei due ambienti).
- [ ] Unità e timer del backup (ogni giorno) e del `check` (ogni settimana, `--no-deps`), esito nel
  journal; procedura aggiunta all'handoff.
- [ ] Istantanee della Storage Box secondo D301; tentativo di cancellazione dal server rifiutato.

### T9 — Dati sintetici, ripristino sul server e prove (D296)

Se D296 = A, ogni passo che scrive sul server con la sua conferma:

- [ ] In locale, dallo stack d'immagini del candidato: insieme sintetico (seme sintetico, media
  sintetici, un video da 100 MB generato); conteggi delle 20 tabelle, estensioni e impronte degli
  oggetti di riferimento nella scratchpad; backup in un repository di prova sulla Storage Box
  (sotto-account e password usa e getta).
- [ ] Sul server: ripristino del repository di prova nella produzione vuota; primo backup vero;
  `check`.
- [ ] Ripristino del backup vero nello staging (D298) e confronto con il riferimento: **zero
  differenze** (1F-2).
- [ ] HO-059 §9: `check` e `restore` con la copia del Centro.
- [ ] Smoke test sullo staging, adattati ai dati sintetici: home, una pagina, un articolo, un
  archivio, ricerca, 404; accesso con TOTP, una modifica di prova e il suo ripristino; media,
  redirect di un campione, certificato, console senza errori, `robots.txt`. Parità e monitoraggio
  restano alla W7 e alla W8.
- [ ] Misure (W5-8): N2 con il caricamento da 100 MB e i tempi dell'archivio; `docker stats` dei
  servizi e del backup; spazio di `backup-data` e `backup-cache`; durata di backup e ripristino.
- [ ] Riavvio del server su conferma: servizi, regole del firewall e timer tornano da soli
  (HO-061 §6, punto 4).
- [ ] Primo account (T3d) provato sullo staging con una persona sintetica, poi disattivato.
- [ ] Cancellazione del repository e del sotto-account di prova, su conferma.

### T10 — Documenti, audit e chiusura

- [ ] `docs/deploy/server-e-staging-1F-W5.md`: versioni, uscite di verifica senza segreti, misure,
  esiti, limiti; `infra/deploy/README.md` (§3, §7, §8, §9 e una sezione «Server»);
  `backup-verification.md` §8 con gli esiti; handoff con esito e indice; CONTEXT §4; PLAN §8.
- [ ] Audit W5-1…W5-12 **prima** della richiesta di commit.
- [ ] Commit e push su conferma; CI verde; riga `PHASE:1F WAVE:1F-W5 STATUS:complete`.

## 4. Decisioni

Numeri da D295. Nessuna attività parte con una sua decisione bloccante aperta. Le raccomandazioni
non sono decisioni: si registra la risposta dell'utente.

### Primo round — prima della T2 (decide il codice)

Preso il 2026-11-09 con `grill-with-ui` (riepilogo in [`W5-decisioni.md`](W5-decisioni.md)):
tutte e cinque le risposte seguono la raccomandazione.

| id | Decisione | Esito |
|---|---|---|
| ~~**D295**~~ | Porte 80 e 443 dello stesso server | **DR-409**: ingresso comune dedicato, Caddy degli ambienti senza TLS su reti separate, nome della produzione dalla W8 |
| ~~**D296**~~ | Dati sul server e prova 1F-2 | **DR-410**: solo dati sintetici, portati con un repository restic di prova; contenuti del Centro nella W7 |
| ~~**D297**~~ | Rilasci senza approvazione dell'ambiente | **DR-411**: avvio a mano solo da `main`, comando forzato, `GITHUB_TOKEN` del lavoro; supera DR-357 sul punto dell'approvazione |
| ~~**D298**~~ | Rete `backup-out` e ripristino nello staging | **DR-412**: sottorete, bridge e catena del firewall per ambiente |
| ~~**D299**~~ | Basi delle immagini al primo rilascio | **DR-413**: DR-405 più Trivy sulle quattro immagini di terzi, aggiornate solo con un rilievo |

Opzioni e motivazioni presentate:

| id | Decisione | Opzioni | Raccomandazione | Impatto |
|---|---|---|---|---|
| **D295** | Produzione e staging sulle porte 80 e 443 dello stesso server | **A** ingresso dedicato: un terzo progetto Compose con lo stesso Caddy, unico a pubblicare 80 e 443, TLS per i due nomi, inoltro per nome ai Caddy degli ambienti su reti separate; il nome della produzione si attiva nella W8 · **B** il Caddy della produzione fa da ingresso anche per lo staging · **C** staging diretto su 80 e 443 fino alla W8, scelta rinviata · **D** secondo indirizzo IPv4 sul VPS, un Caddy per indirizzo | **A**: ambienti indipendenti, nessun cambio d'ingresso a ridosso del passaggio. B lega lo staging alla produzione e chiede il certificato di `www` prima della W8; C cambia l'ingresso dopo la validazione sullo staging; D ha costo e disponibilità Aruba non verificati | A: circa un giorno, prove di Caddy e Compose da estendere, riesame; memoria al limite di 7168 MiB |
| **D296** | Dati sul server nella W5 e prova di ripristino (1F-2) | **A** solo sintetici: insieme creato in locale dalle stesse immagini, portato in produzione con un ripristino da un repository di prova, poi backup vero e ripristino nello staging; contenuti del Centro nella W7 · **B** contenuti dell'import locale (sorgente 2026-09-13) già nella W5 · **C** produzione vuota, prova rinviata alla W7 | **A**: prova completa senza dati personali prima del registro delle cancellazioni (DR-381, W6). B porta le tabelle storiche sul server prima del tempo e la W7 le sostituisce; C fa slittare 1F-2 e le misure di capacità | A: un sotto-account di prova sulla Storage Box per qualche giorno; capacità rimisurate con i dati veri nella W7 |
| **D297** | Rilasci da GitHub Actions senza approvazione dell'ambiente (piano Free, DR-357) | **A** avvio a mano solo da `main`; chiave SSH in un segreto del repository; utente `deploy` con comando forzato che accetta solo «rilascia ambiente hash»; login a GHCR con il `GITHUB_TOKEN` del lavoro, che scade con il lavoro; l'approvazione è la conferma dell'utente prima di ogni avvio · **B** piano GitHub con revisori obbligatori nei repository privati (Free, Pro e Team non li hanno; costo da verificare) · **C** rilasci da handoff con lo stesso script lanciato dal PC del manutentore (opzione A di D228) | **A**: tiene DR-357 senza costi; la chiave sul server può solo rilasciare immagini pubblicate. Rischio: chi ha scrittura sul repository (oggi due amministratori) può avviare un rilascio | A: T3a, T3b, HO-064; aggiornamento di DR-357 sul punto dell'approvazione |
| **D298** | Ripristino nello staging e rete `backup-out` | **A** sottorete, bridge e catena del firewall per ambiente, script applicato una volta per ambiente; il backup resta solo in produzione (DR-372), lo staging usa solo `restore` · **B** nessun codice: nella prova si toglie la rete della produzione, si ripristina nello staging con gli stessi bridge e regole, poi si toglie la rete dello staging · **C** ripristino nella produzione svuotata invece che nello staging | **A**: il ripristino nello staging serve anche nella W7 e dopo; B è una procedura a mano da ripetere ogni volta; C non prova lo staging come destinazione (PLAN W5) | A: T3c, `firewall-1f` esteso, una variabile in più per ambiente |
| **D299** | Basi delle immagini al primo rilascio (DR-405) | **A** DR-405 (Node 26 ultima patch, `mc` di Chainguard, restic) più Trivy, solo conteggi, anche sulle quattro immagini di terzi del Compose (Caddy, PostgreSQL, MinIO, `mc`); di queste si aggiorna solo ciò che ha critici o alti con correzione · **B** anche Caddy 2.11 e l'ultima patch di PostgreSQL 17 e MinIO subito · **C** DR-405 alla lettera, solo le cinque immagini nostre | **A**: copre ciò che va sul server senza cambi non motivati. B cambia versioni senza un rilievo; C lascia scoperte quattro immagini esposte | A: T4 un po' più lunga; ogni base con almeno due settimane |

### Secondo round — prima della T6 (decide il server)

| id | Decisione | Opzioni | Raccomandazione |
|---|---|---|---|
| **D300** | Riavvii dopo gli aggiornamenti di sicurezza | **A** automatici di notte quando richiesti, in una finestra dopo il backup, con verifica del ritorno · **B** solo manuali, con avviso al manutentore · **C** nessun aggiornamento automatico | **A**: un solo manutentore; pochi minuti di fermo notturno |
| **D301** | Storage Box: accessi e istantanee (R12, R14) | **A** sotto-account limitato alla cartella del repository per il server, utente principale solo nel gestore di password; istantanee automatiche giornaliere, 10 tenute · **B** istantanee settimanali, 5 tenute · **C** nessuna istantanea, R12 accettato | **A**: un server compromesso non cancella le istantanee; nessuna oltre 35 giorni (DR-379) |
| **D302** | Separazione dello staging (MI-06, domanda 12) | **A** staging acceso solo per prove e rilasci, limiti di memoria del Compose dichiarati al Centro · **B** sempre acceso, stessi limiti · **C** server separato | **A**: meno superficie esposta e memoria libera; da confermare dopo la misura della T9 |
| **D303** | HSTS lungo (R20) e CSP applicata (R21, DR-364) | **A** HSTS lungo dopo la verifica di HTTPS della produzione nella W8; violazioni della CSP raccolte dalla console negli e2e e nelle pagine della matrice sullo staging con i contenuti veri (W7), CSP applicata al rilascio se zero violazioni · **B** entrambe come oggi per la Fase 1 · **C** indirizzo di raccolta delle segnalazioni (codice nuovo) | **A**: si decide con dati reali, senza codice nuovo |
| **D304** | Nome dello staging (DR-375) | **A** `staging.centroamorislaetitia.it` · **B** un nome meno ovvio · **C** un altro dominio | **A**: il nome compare comunque nei registri pubblici dei certificati; la protezione è la password |
| **D305** | IPv6 dell'ingresso (emerso nella T2a). Una connessione IPv6 verso porte pubblicate su una rete Docker solo IPv4 passa da `docker-proxy`: l'ingresso vede l'indirizzo del bridge, non quello del visitatore, e tutti i visitatori IPv6 finiscono in un solo conteggio dei tentativi. Vale anche per lo stack di oggi | **A** solo record A nella W5, IPv6 rivalutato nella W8 con una prova sul server · **B** IPv6 sulla rete `edge` dell'ingresso (sottorete ULA, `ip6tables`) e record AAAA, con la prova dell'indirizzo IPv6 sul server · **C** record AAAA accettando il conteggio comune degli IPv6 | **A**: lo staging non ha bisogno di IPv6, e la prova su Docker Desktop non vale per il server; HO-063 senza AAAA |

Decisioni della fase che restano fuori da questa wave: D229 (W7), D227 e D230 (W8), D231 (dopo la W9).

## 5. Rischi e rientro

| Rischio | Mitigazione |
|---|---|
| Server e Storage Box non ancora acquistati | T2–T5 procedono in locale; T6 e seguenti attendono la T1 |
| Tentativi falliti di emissione del certificato (limiti di Let's Encrypt) | prima emissione verso l'ambiente di prova di ACME; record DNS verificato prima del rilascio |
| Accesso SSH perso durante l'indurimento | sessione di riserva aperta; console web di Aruba come rientro (HO-062) |
| Porte pubblicate da Docker che scavalcano il firewall | solo l'ingresso pubblica porte; controllo dall'esterno delle porte di database e archivio |
| Chiave di rilascio sottratta da GitHub | comando forzato: solo rilascio di hash pubblicati, nessuna shell; revoca togliendo la riga in `authorized_keys` |
| Memoria oltre gli 8 GB con ingresso e ripristino | misura in T9; staging spento fuori dalle prove (D302) o limiti rivisti con DR |
| Ripristino che sovrascrive dati da conservare | il ripristino rifiuta database e bucket non vuoti; nella W5 solo dati sintetici |
| Perdita della password del repository restic | due copie cifrate in mani diverse e prova con la copia del Centro (DR-380) |
| Disco della postazione (36 GB liberi) | immagini di prova e cache di Trivy cancellate su conferma; mai cache in `out/` (contesto Docker) |
| Prove Docker in parallelo che scadono sotto carico | una suite Docker alla volta, in primo piano, con tempo massimo esplicito |

## 6. Assunzioni dichiarate

- Il candidato del primo rilascio è il commit con Caddy 2.11.9 (DR-420); le immagini sono quelle
  della sua CI.
- Il server usa Ubuntu 24.04 LTS (DR-353); se il carrello non lo offre, stop (HO-056 §10).
- Docker si installa dal repository ufficiale di Docker con versione fissata: le versioni dei
  pacchetti di Ubuntu 24.04 vanno confrontate in T6 con quelle provate in sviluppo.
- Lo staging non fa backup (DR-372); usa `restore` solo per le prove.
- Nessuna dipendenza npm nuova; l'ingresso usa la stessa immagine di Caddy fissata per digest.
- L'agente scrive handoff e verifica uscite; non esegue comandi sul server e non riceve segreti.

## 7. Conferme richieste durante la wave

| # | Quando | Che cosa |
|---|---|---|
| 1 | T5, T10 | commit e push |
| 2 | T6 | record DNS dello staging |
| 3 | T7 e ogni rilascio successivo | rilascio sullo staging, per quell'hash |
| 4 | T8 | impianto della produzione non pubblicata; creazione delle chiavi e del repository restic |
| 5 | T9 | ripristino nella produzione e nello staging; riavvio del server |
| 6 | T9 e ogni attività | cancellazioni: repository e sotto-account di prova, volumi, immagini |

Una conferma vale per quella azione e non si eredita (`CLAUDE.md`, `deployment-gate`).
