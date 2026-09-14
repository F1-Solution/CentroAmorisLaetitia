# CONTEXT — Fase 1C · Fondazione locale

Creato il 2026-09-14. Prerequisito richiesto da `CLAUDE.md` §«GSD Workflow
Prerequisites»: prima di questa wave il file non esisteva, ed è la ragione per cui
la Fase 1C si apre con una wave `1C-W0` di sola pianificazione.

---

## 1. Perimetro

La Fase 1C **costruisce l'impalcatura e nient'altro**. Alla sua fine esiste un
monorepo che si installa, si avvia, si migra, si verifica e si integra in CI, ma che
non contiene ancora un solo contenuto del sito né una sola schermata del CMS.

Dentro il perimetro:

- monorepo pnpm + Turborepo, TypeScript strict, ESLint, Prettier;
- `infra/compose` con PostgreSQL e MinIO, più il reverse proxy per lo sviluppo;
- `.env.example` e validazione della configurazione all'avvio;
- `packages/db`: schema Drizzle corrispondente a `docs/architecture/schema.sql` e
  **migrazione iniziale eseguita davvero** su PostgreSQL 17;
- `apps/api`: servizio Fastify con health check, OpenAPI e gestione errori;
- `apps/web` e `apps/admin`: due applicazioni Next.js allo stato minimo;
- fondazione dei test: Vitest, React Testing Library, test di integrazione su
  PostgreSQL vero, Playwright;
- CI minima su GitHub Actions.

Fuori dal perimetro, e non si comincia:

- qualunque importazione di contenuti (è la Fase 1D);
- qualunque schermata del CMS o componente di design (è la Fase 1D, e dipende da
  HO-004);
- qualunque parte del sito pubblico e qualunque design token estratto dal sito
  (è la Fase 1E);
- autenticazione funzionante: lo schema c'è, il codice no (ADR-007 si realizza in 1D);
- qualunque cosa la fase gestionale contenga: il gate lo vieta.

## 2. Stato in ingresso

| Voce | Valore |
|---|---|
| Fase 1A | approvata il 2026-09-14 (DR-031) |
| Fase 1B | approvata il 2026-09-14, audit in `.planning/phases/1B/AUDIT.md` |
| Dieci ADR | **approvate in blocco** il 2026-09-14 (DR-038) |
| Gate assoluto di Fase 1 | **NON superato** — la 1C non lo fa avanzare |
| Decisioni registrate | DR-001 … DR-043 |
| Decisioni aperte che toccano questa fase | nessuna bloccante. HO-004 blocca la 1D, non la 1C |

L'ambiente della macchina di sviluppo, misurato e non assunto: Node **v25.0.0**,
pnpm **11.6.0**, Docker **29.7.2** con Compose **v5.5.0**, Git **2.55.0**, Windows 11.

## 3. Fatti che vincolano questa fase

| # | Fatto | Fonte | Conseguenza |
|---|---|---|---|
| F-01 | Il primo rilascio è sito pubblico **più** CMS minimo | DR-033 | Servono da subito due applicazioni Next e un'API di scrittura, non un sito statico |
| F-02 | Le due applicazioni Next non parlano al database | ADR-008 §3.3 regola 4 | Solo `apps/api` e `apps/importer` toccano PostgreSQL |
| F-03 | `apps/web` non registra service worker né manifest | ADR-008 §3.3 regola 1 | Un service worker falserebbe i confronti visivi della 1E |
| F-04 | `apps/web` non importa da `packages/ui` | ADR-008 §3.3 regola 3 | Va verificato da una regola di lint, non dalla buona volontà |
| F-05 | Lo schema è in inglese `snake_case` | DR-036 | Drizzle con `casing: 'snake_case'`, senza annotazioni per campo |
| F-06 | Le migrazioni sono un passo esplicito del rilascio | ADR-009 §4.4 | Nessuna migrazione all'avvio dell'applicazione |
| F-07 | La configurazione si valida all'avvio con Zod | ADR-009 §4.3 | Se manca una variabile obbligatoria il servizio non parte e dice quale |
| F-08 | I redirect sono dati, non configurazione del proxy | ADR-003 §3.5 | Nel `Caddyfile` non entra nessuna regola di redirect di contenuto |
| F-09 | Due bucket separati, `media-public` e `media-private` | ADR-004 §3.6 | Il bootstrap di MinIO li crea entrambi, con politiche diverse |
| F-10 | Lo schema di 1B-W2 ha **32 tabelle** e si applica su PostgreSQL 17 | `1B-W2`, audit controllo 9; conteggio corretto in 1C-W3 | La migrazione Drizzle deve produrre lo stesso risultato, e va dimostrato |

## 4. Vincoli non negoziabili

- **Nessun dato reale**, in nessun file: seed, fixture, test, esempi, log, README.
- **Nessun segreto** nel repository. `.env.example` con valori fittizi sì; `.env`
  con valori veri mai. Le credenziali dell'ambiente locale sono di sviluppo e non
  vanno riusate altrove.
- **Nessuna dipendenza fuori dalle ADR.** Ogni pacchetto installato deve essere
  riconducibile a una ADR approvata o alla direttiva; le aggiunte non previste si
  dichiarano nel `PLAN.md` e nell'audit.
- **Nessuna fase gestionale**, nemmeno abbozzata.
- **Nessuna migrazione su database che non sia quello locale usa e getta.**
- Documentazione e commenti in italiano; nomi di codice in inglese (DR-H04, DR-036).

## 5. Rischi noti in ingresso

| # | Rischio | Mitigazione prevista |
|---|---|---|
| RC-01 | Il `.gitignore` attuale è quello di Visual Studio e contiene `**/[Pp]ackages/*`: **escluderebbe l'intera cartella `packages/`** del monorepo | Riscritto nella wave `1C-W1`, verificando con `git check-ignore` che i percorsi del monorepo non siano più esclusi |
| RC-02 | Node 25 è più recente di quanto alcuni strumenti dichiarino di supportare | Versione fissata in `.nvmrc` e in `engines`; la CI gira sulla stessa versione della macchina di sviluppo |
| RC-03 | Lo schema Drizzle può divergere in silenzio da `schema.sql`, che resta la forma canonica | Confronto automatico fra i due database reali, tabella per tabella e colonna per colonna, nella wave `1C-W3` |
| RC-04 | Su Windows i percorsi e i fine riga possono rompere gli script | Comandi solo via script di pacchetto, nessun percorso assoluto, `.gitattributes` per i fine riga |

## 6. Output attesi

Elencati in [`PLAN.md`](PLAN.md), wave per wave.

## 7. Criteri di uscita

Una fase non si dichiara conclusa per affermazione: ognuno di questi criteri viene
**eseguito** nella wave di audit e il suo esito registrato.

1. `pnpm install` funziona da zero e il lockfile è versionato; le versioni di Node
   e pnpm sono fissate nel repository.
2. `docker compose up` avvia PostgreSQL e MinIO; entrambi diventano sani; i due
   bucket esistono.
3. La migrazione iniziale applica su PostgreSQL 17 **le 32 tabelle** dello schema di
   1B-W2, e il confronto automatico con `schema.sql` non trova differenze di
   tabelle, colonne o tipi.
4. `GET /health/live` risponde sempre; `GET /health/ready` risponde `503` quando il
   database non è raggiungibile e `200` quando lo è. Verificato spegnendo il
   database, non per affermazione.
5. Tolta una variabile d'ambiente obbligatoria, il servizio **non parte** e il
   messaggio dice quale manca.
6. `apps/web` non serve manifest né registra service worker; `apps/admin` risponde
   con `X-Robots-Tag: noindex, nofollow`; la regola di lint che vieta l'import da
   `packages/ui` in `apps/web` **fallisce davvero** se qualcuno lo scrive.
7. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` passano tutti.
8. Esiste almeno un test unitario, un test di integrazione su PostgreSQL vero e un
   test end-to-end che passa contro le applicazioni avviate.
9. La CI di GitHub Actions esegue gli stessi comandi della macchina di sviluppo.
10. Nessun dato reale e nessun segreto nel repository: verificato con una ricerca,
    non a memoria.
11. `PROGRESS.md` ha una riga per ogni wave completata.
