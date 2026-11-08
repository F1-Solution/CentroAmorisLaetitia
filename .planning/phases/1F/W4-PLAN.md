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

- [ ] gitleaks in contenitore, sola lettura, senza rete: `git` sull'intera cronologia di tutti i
  rami, `dir` sul working tree (escluse le cartelle ignorate da Git, **mai** `source-private/`),
  `--redact`, rapporto JSON nella scratchpad, mai nel repository.
- [ ] gitleaks `dir` sul filesystem esportato di ciascuna delle cinque immagini
  (`docker export` delle immagini costruite da `1afed56`), a integrazione di `check-image.mjs`.
- [ ] Triage: per ogni rilievo, file, commit, regola e verdetto (vero, falso positivo, dato
  sintetico). Un vero segreto in cronologia **non** si cancella riscrivendo la storia senza
  conferma: prima rotazione del segreto, poi proposta all'utente con impatto e rientro.
- [ ] Prova sentinella: un segreto finto in un file temporaneo non tracciato fa rilevare la
  scansione (poi il file si toglie). Esito in rapporto: conteggi, regole, verdetti; nessun valore.

### T2 — Dipendenze e immagini

- [ ] `pnpm audit --prod` (JSON) sull'intero workspace; elenco per severità, pacchetto, percorso.
- [ ] Scansione delle cinque immagini (DR-386) (pacchetti di sistema e `node_modules`).
- [ ] Triage: raggiungibilità dal codice o dal contenitore, correzione disponibile, proposta.
  Nessun aggiornamento di dipendenza in questa attività: le correzioni vanno in T6.

### T3 — Prove di ADR-007 §8 sullo stack d'immagini

Stack `amoris-production` locale dalle immagini di `1afed56`, seme sintetico, attraverso Caddy.

- [ ] Limitazione dei tentativi: per account e per IP, ritardo progressivo; **l'IP che conta è
  quello del client visto da Caddy**: prova che un `X-Forwarded-For` falsificato dal client non
  sposta il conteggio (rossa se lo sposta).
- [ ] Revoca: una sessione revocata, e tutte le sessioni di una persona, rifiutate alla richiesta
  successiva; rotazione del token dopo accesso e cambio password.
- [ ] Cookie in produzione: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, nessun dominio esteso;
  CSRF rifiutato senza il token a doppio invio su ogni rotta che modifica.
- [ ] Enumerazione: stesso messaggio e tempi confrontabili per utente inesistente e password errata.
- [ ] `pnpm --filter api` prova del conteggio delle righe verde, regola invariata; il numero entra
  nel rapporto.
- [ ] Dati: nessun IP in chiaro in `sessions`, `audit_log`, `form_submissions` dello stack
  sintetico (interrogazione che conta le corrispondenze a un'espressione di indirizzo, senza
  stampare valori). Stack fermato con `down`; volumi rimossi su conferma.

Le prove che non esistono ancora si scrivono qui come prove automatiche, non come controlli a mano.

### T4 — Revisione del revisore separato

Agente `security-reviewer`, sola lettura, contesto nuovo. Riceve: il perimetro qui sotto, i
riferimenti del preambolo, gli esiti grezzi di T1–T3. Non riceve: ipotesi su dove stiano i
problemi. Non legge `source-private/`, file `.env`, dump né il database di sviluppo.

- [ ] Autenticazione: i 12 controlli di ADR-007 §3.1 uno per uno; area amministrativa e mappa
  delle aree; ruoli e permessi; durata delle sessioni (il parere non convalida 12 ore / 30 giorni).
- [ ] Ogni rotta dell'API: autenticazione, permesso, CSRF, validazione d'ingresso, limiti di
  dimensione, errori che non trapelano dettagli; rotte pubbliche `/forms` e `/media`.
- [ ] Tre tabelle: chi le legge e le scrive, digest con sale, `audit_log.detail`, log applicativi
  e del servizio di backup, esportazioni.
- [ ] Caricamenti e servizio di pulizia: tipi, dimensioni, percorso, isolamento del contenitore.
- [ ] `Caddyfile`: TLS, HSTS, intestazioni, CSP, instradamento, staging non indicizzabile e
  protetto (DR-375).
- [ ] Compose e immagini: utenti, capacità, reti, porte, segreti nell'ambiente, separazione
  effettiva di staging e produzione sullo stesso server (MI-06 domanda 12), credenziali di MinIO.
- [ ] Backup: chi può cancellare le istantanee, uscita della rete `backup-out`, custodia (DR-380).
- [ ] CI e catena di fornitura: permessi del `GITHUB_TOKEN`, azioni per etichetta o per SHA,
  immagini di base per digest, lockfile.
- [ ] Requisiti tecnici del parere MI-06 (3e, 7b, 12) con esito per ciascuno.
- [ ] Rapporto: per ogni rilievo severità, file e riga, scenario concreto, correzione proposta.

### T5 — Decisioni sugli esiti

- [ ] Coordinatore: verifica di ogni rilievo critico o alto sul codice (riproduzione o prova),
  scarto motivato dei falsi positivi.
- [ ] Rilievi che chiedono una scelta (costo, UX, architettura, rischio da accettare): `grill-me`,
  round di massimo 5, numeri da D275; registrazione in `decision-register.md`.

### T6 — Correzioni (Sonnet, prova prima)

Ordine: critici, alti, medi decisi in T5, rinvii W4 del README §9. Per ciascuna correzione la
prova rossa prima, poi verde. Correzioni già prevedibili, da confermare con gli esiti:

- [ ] Utente di servizio di MinIO limitato ai due bucket per l'API (README §9), creato da
  `objects-init`; prova: l'API non elenca né scrive fuori dai due bucket.
- [ ] Regole `DOCKER-USER` per la rete `backup-out` (solo Storage Box sulla porta 23 e DNS):
  script e prova in un contenitore Linux con privilegi di rete, **applicazione sul server nella
  W5** con il suo handoff.
- [ ] `/health/ready` dell'API e archivio a oggetti: secondo l'esito del revisore.
- [ ] TOTP nell'area amministrativa (DR-384); `pnpm audit --prod` nella CI (DR-386).
- [ ] Se il conteggio delle righe di autenticazione supera 500 nel nucleo: **stop** e
  ripresentazione all'utente (ADR-007 §6, DR-070), senza cambiare la regola.

### T7 — Riesame e verifica

- [ ] Il revisore riesamina il solo diff delle correzioni; nessun critico o alto aperto.
- [ ] Verifica come la CI (W4-10), `test:images`, `check-image`, e2e attraverso Caddy sullo stack
  d'immagini; nuova scansione gitleaks del working tree.
- [ ] Sito e area ricompilati per lo sviluppo, server spenti, volumi di prova rimossi su conferma.

### T8 — Documenti e chiusura

- [ ] `docs/deploy/security-review-1F.md`: perimetro, metodo e versioni degli strumenti, esiti per
  area, 12 controlli di ADR-007, tre tabelle, scansioni (solo conteggi e verdetti), rilievi con
  severità ed esito, rischi accettati con DR, rinvii a wave nominate, limiti della revisione.
- [ ] ADR-007 (§8, esito 1F), `database-schema.md` §8 punto 5, `infra/deploy/README.md` §9,
  CONTEXT §4, PLAN §8 aggiornati; handoff per azioni sul server nate dagli esiti (eseguiti in W5).
- [ ] Audit di chiusura della wave contro W4-1…W4-11 **prima** della richiesta di commit.
- [ ] Commit e push su conferma; CI verde; riga `PHASE:1F WAVE:1F-W4 STATUS:complete`.

## 4. Decisioni

Prese il 2026-11-08 (round con `grill-with-ui`, riepilogo in [`W4-decisioni.md`](W4-decisioni.md)).

| id | Decisione | Esito |
|---|---|---|
| ~~**D270**~~ | Chi è il revisore separato | **DR-383**: agente `security-reviewer` a contesto nuovo; il rapporto dichiara di non essere un audit umano |
| ~~**D271**~~ | MFA per gli accessi privilegiati | **DR-384**: TOTP nell'area amministrativa per tutti gli account, prima della produzione; superamento delle 500 righe ripresentato (ADR-007 §6) |
| ~~**D272**~~ | Cifratura a riposo delle tre tabelle | **DR-385**: solo backup e trasporto cifrati; rischio residuo **approvato per iscritto dal Centro** prima dei dati sul server |
| ~~**D273**~~ | Audit delle dipendenze e delle immagini | **DR-386**: una tantum nella W4; `pnpm audit --prod` bloccante su critici e alti nella CI |
| ~~**D274**~~ | Segreti nell'ambiente dei contenitori | **DR-387**: rischio accettato in Fase 1; si riapre se la revisione trova un percorso di esposizione |

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
