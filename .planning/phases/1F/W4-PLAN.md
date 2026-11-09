# Piano della wave 1F-W4 — Security review

> **Per chi esegue:** passi con caselle `- [ ]`. Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Prima la prova che fallisce,
> poi la correzione. Nessun commit senza la sua conferma.

Scritto il 2026-11-08, dopo la chiusura della `1F-W3` (`1afed56`). Dipende da `1F-W2` e
`1F-W3` (PLAN §3). Esecuzione (PLAN §2): **revisore separato** (`security-reviewer`, contesto
nuovo, riceve il codice e il perimetro, **non** le conclusioni di questo piano), poi **Sonnet**
per le correzioni. La `1F-W5` avanza in parallelo sul server **senza dati del Centro**
(DR-374): la chiusura di questa wave è la condizione perché dati del Centro arrivino sul server.

**Obiettivo:** una revisione di sicurezza indipendente di codice, configurazione, immagini e
dipendenze come andranno in produzione, con l'autenticazione coperta controllo per controllo,
nessun esito critico o alto aperto e nessun segreto nel repository, nella sua cronologia o
nelle immagini.

**Riferimenti:** criteri 1F-3 e 1F-4 (`docs/qa/acceptance-criteria.md` §7); ADR-007 §3.1
(12 controlli), §6 (contromisure, DR-066, DR-070) e §8 (verifica 1F); `database-schema.md`
§7 (tre tabelle con dati personali) e §8 punto 5 (cifratura a riposo); parere MI-06
(`docs/legal/MI-06-parere-privacy.md`, domande 3e, 7b, 12: requisiti tecnici rimessi a questa
revisione); `infra/deploy/README.md` §9 (rinvii marcati W4); W2-PLAN T1 (`/health/ready` e
archivio); W3-PLAN rischi (cancellazione dei backup dal server); `privacy-safe-development`.

**Cosa la wave non fa:** non dichiara conformità GDPR (1F-11 resta al professionista); non è
un penetration test esterno né un audit umano indipendente (DR-383); non
tocca server, Storage Box, DNS o account dei fornitori; non apre il database di sviluppo sulle
tre tabelle: le prove sui dati usano solo stack con seme **sintetico**.

---

## 1. Punto di partenza (letto il 2026-11-08 su `1afed56`)

| Area | Dove | Che cosa conta per la wave |
|---|---|---|
| Autenticazione | `apps/api/src/auth/*`, `plugins/auth.ts`, `plugins/csrf.ts`, `lib/crypto.ts`, `lib/password.ts`, `modules/auth/routes.ts` | sessioni proprie (DR-066); nucleo **475**/500, totale 1416 (`apps/api/tests/auth-line-count.json`, 2026-10-28); 11 controlli su 12 con un test, il 12º (recupero password) fuori perimetro |
| Moduli API | `apps/api/src/modules/` (15 moduli) | permessi in `auth/permissions.ts`; validazione Zod; `trustProxy: true` in `app.ts` |
| Tre tabelle | `packages/db/src/schema/forms.ts`, `legacy.ts`, `users` | `form_submissions`, `legacy_email_log`, `users`; IP solo come digest con sale (schema §7.3); cifratura a riposo aperta (§8.5) |
| Proxy | `infra/deploy/caddy/Caddyfile`, `production.caddy`, `staging.caddy` | HSTS 3600 s, CSP solo in segnalazione (DR-364), `handle_path` verso l'API |
| Contenitori | `infra/deploy/compose.yml`, `infra/docker/*.Dockerfile`, `check-image.mjs` | utenti non root, sola lettura, `cap_drop ALL`; l'API usa le credenziali principali di MinIO; segreti come variabili d'ambiente (rischio accettato in W2-W3, da riesaminare qui) |
| Backup | `infra/deploy/backup/`, rete `backup-out` non interna | uscita non limitata nella destinazione senza regole `DOCKER-USER`; `forget` gira dal server |
| CI | `.github/workflows/ci.yml` | azioni per etichetta (`@v5`, `@v4`), non per SHA; nessun audit delle dipendenze; immagini in GHCR privato |
| Segreti | nessuna configurazione di scansione nel repository | `ghcr.io/gitleaks/gitleaks:v8.28.0` già in locale, versione da ricontrollare in T0 |
| Documenti | `docs/deploy/` | oggi solo `backup-verification.md` |

## 2. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W4-1 | Revisione indipendente | rapporto del revisore separato sul perimetro del §3 T4, ogni area con esito (anche «nessun rilievo»), severità secondo `code-review.md` |
| W4-2 | Autenticazione | i 12 controlli di ADR-007 §3.1 spuntati uno per uno nel rapporto, ciascuno con il test che lo prova o la motivazione; limitazione dei tentativi e revoca provate **attraverso Caddy** sullo stack d'immagini; conteggio delle righe riverificato senza cambiare regola (ADR-007 §8) |
| W4-3 | Tre tabelle | accessi per ruolo, digest degli IP, contenuto di `audit_log.detail` e dei log applicativi verificati sul codice e su uno stack con seme sintetico; rischio di DR-385 (nessuna cifratura a riposo) descritto nel rapporto e handoff al Centro per l'approvazione scritta |
| W4-4 | Segreti (1F-4) | gitleaks su working tree e **intera cronologia** e sui filesystem delle cinque immagini: zero rilievi non triati; valori mai stampati (`--redact`); ogni falso positivo motivato in una lista di eccezioni versionata |
| W4-5 | Dipendenze | audit delle dipendenze di produzione e delle cinque immagini (DR-386), `pnpm audit --prod` bloccante nella CI: nessuna vulnerabilità critica o alta senza correzione o accettazione registrata |
| W4-6 | Esiti chiusi | **zero** critici e alti aperti; medi corretti o accettati con DR; bassi annotati |
| W4-7 | Correzioni provate | ogni correzione con una prova rossa prima; riesame del revisore sul solo diff delle correzioni |
| W4-8 | Rinvii W4 chiusi | voci W4 di `infra/deploy/README.md` §9 (MinIO, firewall `DOCKER-USER`, segreti nell'ambiente) e `/health/ready` (W2-PLAN T1): corrette, o accettate con DR, o rinviate a una wave nominata |
| W4-9 | Requisiti MI-06 | domande 3e, 7b e 12 del parere: per ogni requisito tecnico, esito (attuato, da attuare in wave nominata, rischio da far approvare al Centro); MFA TOTP attuata (DR-384) |
| W4-10 | Nessuna regressione | verifica come la CI (frozen, lint, Prettier sui file di Git, typecheck, build, test, db:verify, copertura ≥ 80 %, e2e, `test:images`, `check-image`) |
| W4-11 | Documenti e chiusura | `docs/deploy/security-review-1F.md`; ADR-007, `database-schema.md` §8, README §9, CONTEXT §4 aggiornati; commit e push su conferma; CI verde; riga `STATUS:complete` |

## 3. Attività

Percorsi nuovi: `docs/deploy/security-review-1F.md`, `.gitleaks.toml` (solo se servono
eccezioni), `infra/deploy/firewall/` (regole `DOCKER-USER`, se confermate in T6).

### T0 — Linea di base

- [x] `PROGRESS.md` letto; nessuna riga `1F-W4 STATUS:complete`.
- [x] Decisioni D270…D274 registrate (§4): DR-383…DR-387 il 2026-11-08.
- [x] `main` pulito su `1afed56` salvo i documenti di questa wave; CI 42423552918 di `1afed56` verde.
- [x] Docker 29.9.2 in salute, 68 GB liberi; nessuno stack `amoris-production` o `amoris-staging`
  acceso (accesi solo i due contenitori di sviluppo).
- [x] Versioni rilette il 2026-11-08 sulle release ufficiali di GitHub:
  - gitleaks **v8.30.1** (2026-03-21), ultima release;
    `ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`.
    La v8.28.0 già in locale è superata e non si usa.
  - Trivy: l'ultima, v0.76.2 (2026-11-05), ha meno di due settimane; si usa **v0.76.1**
    (2026-10-21), `aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c`.
  - Entrambe girano in contenitore, senza montare il socket di Docker; Trivy legge le immagini
    da archivi `docker save`. La firma dell'immagine di Trivy si verifica in T2, se `cosign` è
    disponibile, prima di usarla.

### T1 — Scansione dei segreti (1F-4)

- [x] gitleaks in contenitore, sola lettura, senza rete: `git` sull'intera cronologia di tutti i
  rami, `dir` sul working tree (escluse le cartelle ignorate da Git, **mai** `source-private/`),
  `--redact`, rapporto JSON nella scratchpad, mai nel repository.
- [x] gitleaks `dir` sul filesystem esportato di ciascuna delle cinque immagini
  (`docker export` delle immagini costruite da `1afed56`), a integrazione di `check-image.mjs`.
- [x] Triage: per ogni rilievo, file, commit, regola e verdetto (vero, falso positivo, dato
  sintetico). Un vero segreto in cronologia **non** si cancella riscrivendo la storia senza
  conferma: prima rotazione del segreto, poi proposta all'utente con impatto e rientro.
- [x] Prova sentinella: un segreto finto in un file temporaneo non tracciato fa rilevare la
  scansione (poi il file si toglie). Esito in rapporto: conteggi, regole, verdetti; nessun valore.

### T2 — Dipendenze e immagini

- [x] `pnpm audit --prod` (JSON) sull'intero workspace; elenco per severità, pacchetto, percorso.
- [x] Scansione delle cinque immagini (DR-386) (pacchetti di sistema e `node_modules`).
- [x] Triage: raggiungibilità dal codice o dal contenitore, correzione disponibile, proposta.
  Nessun aggiornamento di dipendenza in questa attività: le correzioni vanno in T6.

### T3 — Prove di ADR-007 §8 sullo stack d'immagini

Stack `amoris-production` locale dalle immagini di `1afed56`, seme sintetico, attraverso Caddy.

- [x] Limitazione dei tentativi: per account e per IP, ritardo progressivo; **l'IP che conta è
  quello del client visto da Caddy**: prova che un `X-Forwarded-For` falsificato dal client non
  sposta il conteggio (rossa se lo sposta).
- [x] Revoca: una sessione revocata, e tutte le sessioni di una persona, rifiutate alla richiesta
  successiva; rotazione del token dopo accesso e cambio password.
- [x] Cookie in produzione: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, nessun dominio esteso;
  CSRF rifiutato senza il token a doppio invio su ogni rotta che modifica.
- [x] Enumerazione: stesso messaggio e tempi confrontabili per utente inesistente e password errata.
- [x] `pnpm --filter api` prova del conteggio delle righe verde, regola invariata; il numero entra
  nel rapporto.
- [x] Dati: nessun IP in chiaro in `sessions`, `audit_log`, `form_submissions` dello stack
  sintetico (interrogazione che conta le corrispondenze a un'espressione di indirizzo, senza
  stampare valori). Stack fermato con `down`; volumi rimossi su conferma.

Le prove che non esistono ancora si scrivono qui come prove automatiche, non come controlli a mano.

### T4 — Revisione del revisore separato

Agente `security-reviewer`, sola lettura, contesto nuovo. Riceve: il perimetro qui sotto, i
riferimenti del preambolo, gli esiti grezzi di T1–T3. Non riceve: ipotesi su dove stiano i
problemi. Non legge `source-private/`, file `.env`, dump né il database di sviluppo.

- [x] Autenticazione: i 12 controlli di ADR-007 §3.1 uno per uno; area amministrativa e mappa
  delle aree; ruoli e permessi; durata delle sessioni (il parere non convalida 12 ore / 30 giorni).
- [x] Ogni rotta dell'API: autenticazione, permesso, CSRF, validazione d'ingresso, limiti di
  dimensione, errori che non trapelano dettagli; rotte pubbliche `/forms` e `/media`.
- [x] Tre tabelle: chi le legge e le scrive, digest con sale, `audit_log.detail`, log applicativi
  e del servizio di backup, esportazioni.
- [x] Caricamenti e servizio di pulizia: tipi, dimensioni, percorso, isolamento del contenitore.
- [x] `Caddyfile`: TLS, HSTS, intestazioni, CSP, instradamento, staging non indicizzabile e
  protetto (DR-375).
- [x] Compose e immagini: utenti, capacità, reti, porte, segreti nell'ambiente, separazione
  effettiva di staging e produzione sullo stesso server (MI-06 domanda 12), credenziali di MinIO.
- [x] Backup: chi può cancellare le istantanee, uscita della rete `backup-out`, custodia (DR-380).
- [x] CI e catena di fornitura: permessi del `GITHUB_TOKEN`, azioni per etichetta o per SHA,
  immagini di base per digest, lockfile.
- [x] Requisiti tecnici del parere MI-06 (3e, 7b, 12) con esito per ciascuno.
- [x] Rapporto: per ogni rilievo severità, file e riga, scenario concreto, correzione proposta.

### T5 — Decisioni sugli esiti

- [x] Coordinatore: verifica di ogni rilievo critico o alto sul codice (riproduzione o prova),
  scarto motivato dei falsi positivi.
- [x] Rilievi che chiedono una scelta (costo, UX, architettura, rischio da accettare): `grill-me`,
  round di massimo 5, numeri da D275; registrazione in `decision-register.md`.

### T6 — Correzioni (Sonnet, prova prima)

Perimetro deciso in T5 (DR-388…DR-392, rapporto della T4 con i rilievi R1–R29). Ordine: base
Node per prima (ogni prova successiva gira sulla base nuova), poi alti, medi, bassi, TOTP per
ultimo. Per ciascuna correzione la prova rossa prima, poi verde; una suite Docker alla volta.

- [x] **T6a — R2** (DR-389): Node **26.12.1** su `bookworm-slim` fissato per digest in `.nvmrc`,
  CI e nei cinque Dockerfile; verifica come la CI e `test:images` sulla base nuova.
- [x] **T6b — R17**: `npm`, `npx`, `corepack` e intestazioni tolti dallo stadio `runtime` delle
  quattro immagini Node; `gosu` tolto da `backup`; prova in `check-image` o nelle prove
  d'immagine; nuova scansione Trivy (solo conteggi).
- [x] **T6c — R16**: drizzle-orm ≥ 0.45.2, zod ≥ 4.6.6, fastify ≥ 5.12.6; `override` dove serve;
  eslint fuori dalle dipendenze di produzione di `@amoris/config` o eccezione motivata;
  `pnpm audit --prod --audit-level=high` verde.
- [x] **T6d — R15** (DR-386): azioni della CI fissate per SHA completo con commento della
  versione; `pnpm audit --prod` bloccante; gitleaks nella CI; eccezioni versionate.
- [x] **T6e — R1** (DR-375): `basic_auth` davanti a tutto lo staging (hash in variabile
  d'ambiente, mai nel repository); prova 401 su sito, `/admin`, `/api/openapi.json`.
- [x] **T6f — R3** (DR-390): log dell'API con metodo, percorso senza query, esito, durata,
  `requestId` e digest con sale dell'IP; rotazione `json-file` 10 MB × 5 per ogni servizio del
  Compose; prova che il log catturato non contenga né IP né query.
- [x] **T6g — R10, R11**: ruolo applicativo del database senza `SUPERUSER` (proprietario solo per
  `migrate`, sola lettura per `backup`); utente di servizio di MinIO limitato ai due bucket per
  l'API e in sola lettura per il backup, creato da `objects-init`; prove.
- [x] **T6h — R5, R6, R7, R8, R19, R28**: righe `too_many_attempts` fuori dal conteggio e
  procedura di sblocco da CLI; tetto HTTP per indirizzo sulle rotte anonime senza scrittura a
  database, niente audit per i rifiuti anonimi, indici su `ip_hash`; HMAC dell'email digitata;
  prefisso /64 per IPv6; `trustProxy` ristretto alla rete di Caddy; `user_agent` troncato a 500.
- [x] **T6i — R13**: script delle regole `DOCKER-USER` per `backup-out` (Storage Box porta 23 e
  DNS) con prova in un contenitore Linux con privilegi di rete; applicazione nella W5 da handoff.
- [x] **T6j — R18, R22, R25, R26a, R26c, R27**: `backup-data` svuotato a fine esecuzione;
  `/api/openapi.json` e `/api/health/*` non pubblici da Caddy; pulizia di sessioni scadute e
  tentativi falliti, sessioni revocate dopo un ripristino; `setPassword` e revoca in una
  transazione; `no-store` su `/auth/me` e `/auth/sessions`; configurazione di produzione
  validata (chiavi S3 obbligatorie, minimi Argon2, segreti diversi).
- [x] **T6k — R9** (DR-391): sessione 14 giorni, inattività 8 ore, cookie senza `maxAge`.
- [x] **T6l — R4** (DR-384, DR-388, DR-395…DR-399): TOTP nell'area amministrativa con
  `node:crypto`, senza dipendenze nuove; conferma (password o TOTP) entro 10 minuti per ogni rotta
  di `users.manage` (DR-391, DR-396); reimpostazione solo da CLI (DR-397).
  - [x] **T6l-a** (API): nucleo 772 oltre 650, stop; D281…D285 decise, soglia del nucleo **800**
    (DR-395), regola di conteggio invariata.
  - [x] **T6l-b** (area ed e2e): schermata del secondo fattore (attivazione e verifica), rinvii
    della sessione, conferma recente in «Persone e permessi»; prove unitarie ed e2e.
- [ ] Rinviati alla W5 con handoff: R12, R14 (Storage Box), R20, R21 (DR-364), R24. Annotati
  nel rapporto: R23, R26b, R26d–f, R29.

### T7 — Riesame e verifica

- [x] Il revisore riesamina il solo diff delle correzioni (`6c6e4ed..57c4ae6`): 0 critici, 1 alto
  (N1), 2 medi (N2, N3), 6 bassi (N4–N9); D286…D290 decise (DR-400…DR-404).
- [x] **T7a — correzioni del riesame** (prova rossa prima per ciascuna): N1 (DR-400), N2 e N8
  (DR-401), N3 (DR-402), N4 e N5 (DR-403); riesame del revisore sul solo diff di queste
  correzioni: N1–N5 e N8 chiusi, 0 critici, 0 alti, 0 medi, 6 bassi annotati (R-A…R-F).
- [x] Verifica come la CI (W4-10), `test:images` (340/340), `check-image`, e2e attraverso Caddy
  sullo stack delle immagini `w4-t7a` (71/71); gitleaks su cronologia (144 commit, 0) e immagini.
- [ ] Sito e area ricompilati per lo sviluppo, server spenti, volumi di prova rimossi su conferma.
  Server spenti; ricompilazione con `riavvia-sviluppo.ps1` alla riaccensione; volumi alla chiusura
  della T8 (DR-404), più due volumi anonimi nati in questa sessione, da cancellare su conferma.

### T8 — Documenti e chiusura

- [ ] `docs/deploy/security-review-1F.md`: perimetro, metodo e versioni degli strumenti, esiti per
  area, 12 controlli di ADR-007, tre tabelle, scansioni (solo conteggi e verdetti), rilievi con
  severità ed esito, rischi accettati con DR, rinvii a wave nominate, limiti della revisione.
- [ ] ADR-007 (§8, esito 1F), `database-schema.md` §8 punto 5, `infra/deploy/README.md` §9,
  CONTEXT §4, PLAN §8 aggiornati; handoff per azioni sul server nate dagli esiti (eseguiti in W5).
- [ ] Audit di chiusura della wave contro W4-1…W4-11 **prima** della richiesta di commit.
- [ ] Commit e push su conferma; CI verde; riga `PHASE:1F WAVE:1F-W4 STATUS:complete`.

## 4. Decisioni

Prese il 2026-11-08: D270…D274 con `grill-with-ui` (riepilogo in [`W4-decisioni.md`](W4-decisioni.md)), D275…D279 in T5 sugli esiti della T4, D280 sul perimetro della T6, D281…D285 nella T6l. Il 2026-11-09: D286…D290 nella T7 sugli esiti del riesame.

| id | Decisione | Esito |
|---|---|---|
| ~~**D270**~~ | Chi è il revisore separato | **DR-383**: agente `security-reviewer` a contesto nuovo; il rapporto dichiara di non essere un audit umano |
| ~~**D271**~~ | MFA per gli accessi privilegiati | **DR-384**: TOTP nell'area amministrativa per tutti gli account, prima della produzione; superamento delle 500 righe ripresentato (ADR-007 §6) |
| ~~**D272**~~ | Cifratura a riposo delle tre tabelle | **DR-385**: solo backup e trasporto cifrati; rischio residuo **approvato per iscritto dal Centro** prima dei dati sul server |
| ~~**D273**~~ | Audit delle dipendenze e delle immagini | **DR-386**: una tantum nella W4; `pnpm audit --prod` bloccante su critici e alti nella CI |
| ~~**D274**~~ | Segreti nell'ambiente dei contenitori | **DR-387**: rischio accettato in Fase 1; si riapre se la revisione trova un percorso di esposizione |
| ~~**D275**~~ | TOTP oltre le 500 righe del nucleo (R4) | **DR-388**: terza deroga, soglia del nucleo 650, TOTP con `node:crypto`; riesame con Better Auth prima del gestionale |
| ~~**D276**~~ | Versione di Node (R2) | **DR-389**: Node 26.12.1 su `bookworm-slim` per digest |
| ~~**D277**~~ | Contenuto e durata dei log (R3) | **DR-390**: niente IP in chiaro né query; digest con sale dell'IP; rotazione 10 MB × 5 |
| ~~**D278**~~ | Sessioni e conferma per le operazioni delicate (R9) | **DR-391**: 14 giorni, 8 ore di inattività, cookie di sessione; conferma entro 10 minuti per gli account |
| ~~**D279**~~ | Perimetro della T6 | **DR-392**: alti, medi tranne R12 e R14 (W5), bassi R18, R19, R22, R25, R26a, R26c, R27, R28 |
| ~~**D280**~~ | T6j e T6k nella T6 | **DR-393**: restano nella T6, prima del commit |
| ~~**D281**~~ | Nucleo a 772 righe con il TOTP | **DR-395**: quarta deroga, soglia del nucleo 800, riesame con Better Auth prima del gestionale |
| ~~**D282**~~ | Conferma anche per leggere gli account | **DR-396**: sì, ogni rotta con `users.manage` |
| ~~**D283**~~ | Reimpostazione del secondo fattore | **DR-397**: solo il manutentore da CLI |
| ~~**D284**~~ | Rischio della prima attivazione | **DR-398**: accettato, password temporanea su canale sicuro |
| ~~**D285**~~ | Rotazione di `TOTP_ENCRYPTION_KEY` | **DR-399**: nessuna in Fase 1, reimpostazione di tutti i secondi fattori se compromessa |
| ~~**D286**~~ | N1: corsa sui tentativi (alto) | **DR-400**: coda in memoria per account nei 7 punti, tetto di 10 al minuto per sessione su codice e conferma, un solo processo API scritto in ADR-007 |
| ~~**D287**~~ | N2: ricerca e redirect esenti per la via del sito | **DR-401**: il sito inoltra l'indirizzo del visitatore, esenzione tolta, prova inversa di N8 |
| ~~**D288**~~ | N3: fiducia nella sottorete `app` | **DR-402**: `APP_SUBNET` obbligatoria e diversa per ambiente; fiducia nella sottorete accettata |
| ~~**D289**~~ | Bassi del riesame | **DR-403**: N4, N5, N8 subito; N6 e timer di R25 alla W5; N9 e R27 nel rapporto |
| ~~**D290**~~ | Risorse Docker di prova | **DR-404**: volumi e immagini di prova elencati cancellati alla chiusura della T8 |

Conseguenze sulle attività:

- **T6** comprende il TOTP (DR-384): prova prima, dipendenza dichiarata con motivo (PLAN §5),
  conteggio delle righe rifatto con la regola invariata; se il nucleo supera 500, stop e
  ripresentazione prima di proseguire.
- **T6** comprende `pnpm audit --prod` nella CI (DR-386), con eccezioni motivate e versionate.
- **T8** produce un handoff al Centro per l'approvazione scritta del rischio di DR-385; finché
  manca, nessun dato del Centro sul server (si somma alla condizione di DR-374).
- Il rapporto (T8) dichiara il limite di DR-383 e il rischio accettato di DR-387.

## 5. Rischi e rientro

| Rischio | Mitigazione |
|---|---|
| Il revisore conferma ciò che gli si suggerisce | riceve codice e perimetro, non ipotesi; il coordinatore riproduce ogni critico o alto |
| Un vero segreto nella cronologia | rotazione prima di tutto; riscrittura della storia solo su conferma esplicita, con piano di rientro |
| La scansione stampa un segreto | `--redact`, rapporti nella scratchpad, nel repository solo conteggi e verdetti |
| Il TOTP allunga la wave e ritarda i dati sul server | la W5 senza dati prosegue (DR-374); il TOTP è l'ultima correzione di T6, dopo critici e alti |
| Il Centro non approva per iscritto il rischio di DR-385 | nessun dato del Centro sul server; la decisione si riapre con le opzioni A e B |
| Il nucleo dell'autenticazione supera 500 righe | stop e ripresentazione (ADR-007 §6); la regola di conteggio non si cambia |
| Prove Docker in parallelo che scadono sotto carico (W3) | prove in primo piano, una suite Docker alla volta, tempo massimo esplicito |
| Dati reali esposti al revisore o all'agente | nessun accesso a `source-private/`, `.env`, dump o database di sviluppo; solo seme sintetico |

## 6. Assunzioni dichiarate

- Il codice da rivedere è quello di `1afed56` più le correzioni della wave; le immagini sono
  costruite dallo stesso commit.
- Gli esiti si basano su codice e configurazione: lo stato reale del server (firewall, SSH,
  aggiornamenti) è verificato nella W5 con il suo handoff.
- I requisiti del parere MI-06 sono **requisiti da valutare**, non conformità: l'esito tecnico
  non sostituisce 1F-11.
- Nessuna dipendenza npm nuova senza dichiararla (PLAN §5); gitleaks e lo scanner delle immagini
  girano in contenitore fissato per digest e non entrano nelle immagini di produzione.
