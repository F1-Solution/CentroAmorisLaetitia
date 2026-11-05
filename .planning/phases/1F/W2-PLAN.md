# Piano della wave 1F-W2 — Immagini e Compose di produzione

> **Per chi esegue:** passi con caselle `- [ ]`. Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Prima la prova che fallisce,
> poi il codice. Nessun commit senza la sua conferma.

Scritto il 2026-11-04, dopo la chiusura della `1F-W1` (`8929cdd`, CI 41862513527 verde;
riga in `PROGRESS.md` con `88711b9`). Esecuzione di codice: **Sonnet** (PLAN §2).
Decisioni: D225 = A (DR-356), D228 = C (DR-357), D249 = A (DR-358), D250 = A (DR-359),
D251 = A (DR-360), registrate il 2026-11-04.

**Obiettivo:** lo stack di produzione parte **in locale** dalle immagini costruite dalla CI,
con dati sintetici, e supera health check ed e2e, senza segreti nelle immagini.

Nessun server, nessun dominio, nessun DNS, nessun dato del Centro: tutto in locale e in CI.

**Riferimenti:** ADR-003 (Caddy), ADR-008 (applicazioni), ADR-009 §4 (forma), ADR-012 §4
(requisiti della pulizia per la 1F), DR-080 (impacchettamento dell'API), DR-101 (immagini di
MinIO per digest), DR-196 (`SITE_URL`), DR-253 (cache dei media), DR-263 (contenitore della
pulizia), DR-296 (staging come progetto separato), DR-297 (MinIO).

---

## 1. Dove sta il codice (letto il 2026-11-04 su `88711b9`)

| Punto | File | Che cosa conta per la wave |
|---|---|---|
| Compose di sviluppo | `infra/compose/docker-compose.yml` | solo `db`, `objects`, `objects-init` e `caddy` nel profilo `proxy`; MinIO per digest (DR-101); `caddy:2-alpine` senza versione fissa |
| Caddy di sviluppo | `infra/compose/Caddyfile` | instradamento `/api/*`, `/media/*`, `/admin*`, resto al sito; nessun HSTS e nessuna CSP (rinviati alla 1F, ADR-003 §3) |
| CI | `.github/workflows/ci.yml` | un solo lavoro, `permissions: contents: read`; nessuna immagine costruita |
| API | `apps/api/package.json` | `start` gira con `tsx`; `build` con `tsc` produce un `dist` che Node non esegue (DR-080) |
| Health dell'API | `apps/api/src/routes/health.ts` | `/health/live` e `/health/ready` (solo database; l'archivio non è controllato) |
| Health di sito e area | `apps/web/src/app`, `apps/admin/src/app` | **nessuna rotta di stato** (ADR-009 §4.6 la chiede per ogni servizio) |
| Next | `apps/web/next.config.ts`, `apps/admin/next.config.ts` | nessun `output: 'standalone'`; l'area ha `basePath: '/admin'` |
| Indirizzi nel browser | `apps/admin/src/lib/api.ts:15`, `upload.ts:17`, `siteUrl.ts:4`, `apps/web/src/lib/api.ts:11`, `proxy.ts:21` | `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_SITE_URL` si fissano **nella build**: un'immagine costruita per lo staging non è quella della produzione (D251) |
| Pulizia dei metadati | `apps/api/src/modules/media/scrub.ts:104`, `:312` | `execFile` del programma locale (`QPDF_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH`) in `tmpdir()`: con un contenitore separato l'API non può lanciarlo così (D250) |
| Migrazioni | `packages/db/scripts/migrate.ts` | si eseguono con `tsx`; ADR-009 §4.4 le vuole come passo esplicito, non all'avvio |
| e2e | `playwright.config.ts:47-71` | avvia da sé API, sito e area su porte separate: serve un modo per puntarlo allo stack di immagini |
| Strumenti | `.nvmrc` = `25.0.0`; Docker 29.9.2, Compose 5.6.1 in locale | le immagini di base usano la stessa versione di Node |

## 2. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W2-1 | Immagini | `web`, `admin`, `api`, pulizia e `migrate` si costruiscono da Dockerfile del repository; immagini di base fissate per versione **e** digest; utente non `root`; nessuna etichetta `latest` |
| W2-2 | Stato dei servizi | ogni servizio ha un health check nel Compose e risponde «sano»; sito e area hanno una rotta di stato con la sua prova (rossa prima) |
| W2-3 | Stack locale | `docker compose -p amoris-prod-locale … up --wait` parte dalle immagini, con `.env` sintetico; migrazioni come passo separato; bucket creati |
| W2-4 | e2e contro le immagini | la suite e2e intera verde contro lo stack di immagini, attraverso Caddy, con dati sintetici |
| W2-5 | Pulizia separata | il contenitore della pulizia: senza accesso a Internet, utente dedicato, file system in sola lettura salvo la cartella temporanea con quota, limite di memoria ≈ 1 GB; verificato con `docker inspect` e con una prova che il file oltre il limite si rifiuta (DR-263, ADR-012 §4) |
| W2-6 | Staging | stesso Compose con progetto, porte, volumi, database e bucket propri (DR-296); i due progetti partono insieme in locale senza toccarsi |
| W2-7 | Caddy di produzione | HTTP → HTTPS, HSTS, intestazioni di sicurezza, compressione, cache dei media secondo DR-253; provato in locale con un certificato interno di Caddy; nessun redirect di contenuto (ADR-003 §3.5) |
| W2-8 | Nessun segreto (1F-4) | nessun `.env`, chiave o file di `source-private/` nelle immagini: elenco dei file di ogni immagine controllato da uno script in CI; `.dockerignore` provato |
| W2-9 | CI | le immagini si costruiscono con l'hash del commit come etichetta e si conservano in GHCR (DR-356); nessuna chiave del server nella CI in questa wave (DR-357: arriva nella W5) |
| W2-10 | Nessuna regressione | verifica come la CI (frozen, lint, Prettier sui file di Git, typecheck, build, test, db:verify, copertura ≥ 80 %, e2e in sviluppo) |
| W2-11 | Documenti e chiusura | `infra/deploy/README.md` con avvio, arresto e verifica locali; revisione; commit e push su conferma; CI verde; riga `STATUS:complete` |

## 3. Attività

Percorsi nuovi (fissati qui come chiede PLAN §4): `infra/docker/` per i Dockerfile,
`infra/deploy/` per Compose, `Caddyfile` ed esempio d'ambiente di produzione.
`infra/compose/` resta lo sviluppo e non cambia.

### T0 — Linea di base

- [x] `PROGRESS.md` letto; nessuna riga `1F-W2 STATUS:complete`.
- [x] Decisioni D225, D228, D249, D250, D251 registrate (DR-356…DR-360).
- [x] Database e oggetti di sviluppo in salute; nessun server di sviluppo acceso.
- [x] Prezzi e limiti di GHCR per i repository privati riletti sulla pagina ufficiale, con data:
  il 2026-11-04 `docs.github.com/en/billing/concepts/product-billing/github-packages` dice
  «Container image storage and bandwidth for the Container registry is currently free», con
  un mese di preavviso per i cambi.

### T1 — Rotte di stato di sito e area (prova prima)

- [x] Prove in `apps/web/tests/` e `apps/admin/tests/`: la rotta di stato risponde 200 con
  `{ status: 'ok' }`, senza interrogare l'API; **rosse** prima (rotta assente).
- [x] Rotta in `apps/web/src/app/health/live/route.ts` e
  `apps/admin/src/app/health/live/route.ts` (`/admin/health/live` per il `basePath`).
- [x] Verificare che nessun contenuto importato usi il percorso `/health/`: conteggio sul
  database di sviluppo in sola lettura (0 contenuti su 108, 0 termini, 0 redirect).
- [x] Il `proxy` del sito esclude `health/` dal suo filtro, così la rotta non chiede
  redirect all'API. Il sito ha `trailingSlash`: il health check del Compose usa
  `/health/live/` (senza barra risponde 308).
- [x] `/health/ready` dell'API controlla anche l'archivio a oggetti? **No** in questa wave:
  cambierebbe il contratto; si annota per la W4.

### T2 — Next in modalità `standalone`

- [x] `output: 'standalone'` e `outputFileTracingRoot` alla radice del monorepo in
  `apps/web/next.config.ts` e `apps/admin/next.config.ts`.
- [x] `pnpm build`, e2e di sviluppo verdi (`next start` resta com'è per Playwright): 69/69.
- [x] DR-360: in produzione `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_SITE_URL` vuoti danno
  indirizzi relativi (`/api`, `/media`, sito sulla stessa origine); prova rossa prima per
  `api.ts`, `upload.ts`, `siteUrl.ts` dell'area e `api.ts`, `proxy.ts` del sito; in
  sviluppo il valore assoluto di `.env` resta valido. Il sito, lato server, usa `API_URL`
  interno al Compose.
  - Area: `apps/admin/src/lib/apiBase.ts` (assente → `http://localhost:3002`, vuoto → `/api`,
    assoluto senza barra finale), usata da `api.ts` e `upload.ts`; prova
    `api-base-1f.test.ts` 4/5 rossa prima. `siteUrl.ts` era già relativo con il valore
    vuoto (`content-preview.test.tsx`): nessuna modifica.
  - Sito: `apps/web/src/lib/apiUrl.ts` (`API_URL`, poi `NEXT_PUBLIC_API_URL`, i vuoti valgono
    assenti), usata da `api.ts`, `proxy.ts` e `next.config.ts`; prova `api-url-1f.test.ts`
    6/8 rossa prima (il vuoto diventava un indirizzo relativo che il server non sa chiamare).
  - `turbo.json`: la cache della build dipende anche da `NEXT_PUBLIC_SITE_URL` e `API_URL`.
  - Build con le due variabili vuote: 0 `localhost` nei file statici di sito e area.
    `apiBase()` legge la variabile in linea perché la build tolga il ramo del predefinito.
    `server.js` di `standalone` contro una finta API: `API_URL` letto all'avvio da proxy e
    pagine; `/health/live/` e `/admin/health/live` 200.
  - **Per la T7:** le riscritture di `next.config.ts` (`/media/*`, `/forms/*`) si fissano nella
    build; in produzione Caddy deve instradare all'API anche `/forms/*`, non solo `/media/*`, e
    togliere il prefisso `/api` (`handle_path`), perché l'API risponde dalla radice.
  - **Per la T9:** il controllo di W2-8 cerca `localhost` nei file statici; nei file del server
    il predefinito di sviluppo resta come testo e non è un errore.

### T3 — Impacchettamento dell'API (DR-358)

- [x] Prova di fumo rossa prima: `apps/api/tests/bundle-1f.test.ts` 6/6 rossa (script di
  impacchettamento assente), poi 6/6 verde: build, soli esterni nativi (dal metafile),
  migrazioni in `dist/drizzle`, `node dist/server.js` con `NODE_ENV=production` e database
  spento risponde 200 a `/health/live`, migrazioni e `account:create` dal bundle su un
  database temporaneo (hash `$argon2id$`, password mai stampata).
- [x] DR-358: `apps/api/scripts/bundle.mjs` (ESM, `node22`, chunk condivisi, sourcemap,
  `require`/`__dirname` dal banner); esterni solo `sharp` e `@node-rs/argon2`.
  `build` di `apps/api` ora è il bundle; tolto `tsconfig.build.json` (il suo `dist` non era
  eseguibile da Node, e nessuno lo usava). Uscite: `dist/server.js`, `dist/bin/migrate.js`,
  `dist/bin/account-create.js`, `dist/drizzle/`.
- [x] Lo stesso per le migrazioni (`packages/db/scripts/migrate.ts`, invariato: cerca
  `../drizzle` accanto a `bin/`) e per `account:create`.
- [x] `pnpm --filter @amoris/api deploy --prod --legacy` in una cartella temporanea, poi tolti
  tutti i pacchetti di primo livello tranne `sharp` e `@node-rs`: servizio 200 su
  `/health/live` (503 su `/health/ready` col database spento), `bin/migrate.js` e
  `bin/account-create.js` partono e rispondono con i loro messaggi.
  - **Per la T4:** `deploy` scrive `production: true` nello stato del workspace locale e i
    comandi `pnpm` successivi chiedono un `install --production`; si ripara con
    `pnpm install --frozen-lockfile --offline`. Nel Dockerfile non tocca nulla.
  - **Per la T4:** senza `TEMP`/`TMPDIR` il servizio registra «cartella temporanea non
    letta»; nell'immagine `/tmp` deve esistere ed essere scrivibile.
  - **Per la W8:** `account:create` rifiuta un database che non sia su `localhost`
    (salvaguardia di 1G); nel Compose di produzione il database è `db`, quindi la creazione
    del primo amministratore va decisa prima della W8.
- [x] Nuove dipendenze (PLAN §5): `esbuild` 0.28.2 esatta, solo di sviluppo in `apps/api`,
  per il bundle di DR-358. Era già nel lockfile tramite `tsx` e `vite`: nessun pacchetto
  nuovo scaricato.

### T4 — Dockerfile delle applicazioni

- [x] `infra/docker/web.Dockerfile`, `admin.Dockerfile`, `api.Dockerfile`, con costruzione
  a più stadi da `pnpm install --frozen-lockfile` e `pnpm deploy` o il `standalone` di Next.
- [x] Base: `node:25.0.0-…-slim` (glibc, per i binari di `sharp`) fissata per digest.
- [x] Utente non `root`; nessuna cartella scrivibile oltre quelle dichiarate; `NODE_ENV=production`.
- [x] `.dockerignore` alla radice: esclude `.env*` (non `.env.example`), `source-private/`,
  `source-readonly/`, `.reference/`, `.superpowers/`, `.planning/`, `coverage/`,
  `test-results/`, `node_modules/`, `.git/`.
- [x] Prove: `pnpm test:images` (`infra/docker/tests`, richiede Docker, fuori da `pnpm test`)
  39/39.
  - **Nota:** `pnpm deploy --legacy` ripete la risoluzione; con `--offline` non ha i metadati
    dei pacchetti facoltativi di piattaforma e scarta in silenzio i binari Linux di `sharp` e
    `@node-rs/argon2`. Il deploy dell'API gira quindi in rete (stesse versioni del lockfile,
    verificato) e la build fallisce se i due moduli non si caricano.

### T5 — Contenitore della pulizia (DR-359)

- [ ] Prova rossa prima: con il contenitore spento, un PDF caricato si rifiuta con il
  messaggio di oggi (programmi assenti), le immagini si caricano.
- [ ] `infra/docker/scrub.Dockerfile` con `qpdf` 12.4.2, `ffmpeg` e `ffprobe` 9.0.2 dagli
  stessi binari e dalle stesse impronte della CI (`ci.yml`, DR-268).
- [ ] DR-359: piccolo servizio HTTP di pulizia (Node, nessun framework nuovo) su una rete
  Docker `internal: true`, raggiungibile solo dall'API; l'API gli invia il file e riceve
  quello ripulito, con gli stessi esiti di oggi (programmi assenti, file illeggibile,
  codec rifiutato). Nuova chiave d'ambiente per l'indirizzo del servizio; senza, l'API
  usa i programmi locali come in sviluppo e in CI. Cartella temporanea `tmpfs` con quota.
  Un segreto condiviso fra API e servizio, perché la rete interna non basta da sola.
- [ ] Prove: un PDF e un MP4 sintetici si ripuliscono attraverso il contenitore; un file
  che supera il limite di memoria si rifiuta; dal contenitore nessuna connessione verso
  Internet (`curl` o `getent` falliscono).

### T6 — Compose di produzione e di staging

- [ ] `infra/deploy/compose.yml`: `caddy`, `web`, `admin`, `api`, scrub, `db`, `objects`,
  `objects-init`; `migrate` nel profilo `release`, mai all'avvio (ADR-009 §4.4); il
  servizio `backup` arriva nella W3.
- [ ] Etichetta delle immagini da variabile (`IMAGE_TAG`) **senza valore predefinito**: senza,
  il Compose non parte.
- [ ] Solo Caddy pubblica porte; `db` e `objects` su una rete interna; limiti di memoria per
  servizio, con la somma di produzione e staging sotto gli 8 GB di DR-334.
- [ ] Staging: stesso file, progetto `amoris-staging`, `.env` proprio, porte proprie, volumi
  propri; in staging `X-Robots-Tag: noindex` su tutto e `robots.txt` che rifiuta (PLAN W5).
- [ ] `caddy` fissato per versione e digest.

### T7 — `Caddyfile` di produzione

- [ ] `infra/deploy/Caddyfile`: indirizzo del sito da variabile; HTTP → HTTPS; HSTS
  (`max-age` breve all'inizio, senza `preload`, finché il passaggio non è verificato);
  intestazioni di oggi più `Permissions-Policy`; `encode zstd gzip`.
- [ ] Cache dei media: Caddy non sovrascrive il `Cache-Control` dell'API (DR-253, `no-cache`).
  La politica definitiva e la CSP sono D252 e D253 (§4), da chiedere prima di questa attività.
- [ ] Prova locale con `tls internal` e un nome `*.localhost`: redirect, intestazioni, HTTP/2.

### T8 — Esempio d'ambiente di produzione

- [ ] `infra/deploy/.env.production.example`: tutte le chiavi di `apps/api/src/config.ts`,
  di sito, area, Caddy e Compose, con segnaposto evidenti (`CAMBIA-…`) e il comando per
  generare ciascun segreto; nessun valore riusabile.
- [ ] Prova: un controllo confronta le chiavi dell'esempio con quelle lette dalla
  configurazione dell'API; manca una chiave → rosso.

### T9 — CI delle immagini (DR-356, DR-357)

- [ ] Nuovo lavoro in `.github/workflows/`, dopo «Verifica», solo su `main`: costruzione
  delle cinque immagini, etichetta = hash completo del commit, pubblicate in GHCR privato.
- [ ] Permessi minimi del lavoro: `contents: read`, `packages: write`.
- [ ] Script di controllo dei file delle immagini (W2-8), che fallisce se trova `.env`,
  `source-private`, chiavi private o `*.pem`.
- [ ] Nessun rilascio sul server in questa wave: il lavoro di rilascio di DR-357 (avvio a
  mano, ambiente con approvazione, chiave SSH nei segreti) si scrive nella W5, quando il
  server esiste.

### T10 — Prova dello stack locale

- [ ] Stack di produzione e di staging insieme in locale, da immagini costruite in locale
  con la stessa ricetta della CI; `migrate`, bucket, seme sintetico (`pnpm db:seed` o il suo
  equivalente nell'immagine).
- [ ] e2e contro lo stack: Playwright con una variabile che salta `webServer` e punta a Caddy
  (`tests/e2e/support/ambiente.ts`); suite intera verde.
- [ ] `docker inspect` di ogni servizio: utente, rete, limiti, file system (W2-5).
- [ ] Stack fermati e volumi locali di prova rimossi **su conferma** (PLAN §7 riga 7).

### T11 — Revisione e verifica

- [ ] Revisione (`code-reviewer`) di Dockerfile, Compose, `Caddyfile`, CI; esiti critici e
  alti corretti. La security review completa resta alla W4.
- [ ] Verifica come la CI (memorie del progetto: Prettier solo sui file di Git, `QPDF_PATH`
  per le prove, rieseguire da soli i file con timeout sotto carico).

### T12 — Documenti e chiusura

- [ ] `infra/deploy/README.md`; `CONTEXT.md` §4; dipendenze nuove confrontate con PLAN §5.
- [ ] Commit e push **su conferma**; CI verde, immagini pubblicate in GHCR; riga
  `PHASE:1F WAVE:1F-W2 STATUS:complete`.

## 4. Decisioni

Primo round, risposte del 2026-11-04:

| Id | Domanda | Opzioni | Esito | Attività |
|---|---|---|---|---|
| ~~D225~~ → **DR-356** (A) | Dove si conservano le immagini | **A** registro di GitHub (GHCR), privato · **B** costruzione sul server, senza registro · **C** registro di un altro fornitore | GHCR privato | T9 |
| ~~D228~~ → **DR-357** (C) | Chi esegue i comandi sul server | **A** l'utente, da handoff · **B** GitHub Actions avviata a mano, con approvazione dell'ambiente e chiave SSH nei segreti · **C** misto: impianto da handoff, rilasci da B | misto; il lavoro di rilascio nella W5 | T9, W5 |
| ~~D249~~ → **DR-358** (A) | Come si esegue l'API in produzione (DR-080) | **A** bundle con `esbuild`, eseguito da `node` · **B** `tsx` anche in produzione · **C** `tsc` con import corretti in tutti i pacchetti | bundle `esbuild` | T3 |
| ~~D250~~ → **DR-359** (A) | Come l'API usa `qpdf` e `ffmpeg` nel contenitore separato (DR-263) | **A** servizio di pulizia su una rete Docker interna senza uscita · **B** cartella condivisa come coda · **C** programmi nell'immagine dell'API | servizio su rete interna | T5 |
| ~~D251~~ → **DR-360** (A) | Indirizzi fissati nella build di Next | **A** indirizzi relativi, stessa immagine · **B** un'immagine per ambiente · **C** indirizzi letti all'avvio | indirizzi relativi | T2 |

Differibili, secondo round:

| Id | Domanda | Termine |
|---|---|---|
| **D252** | Content-Security-Policy di produzione: subito applicata, solo «report-only», o rinviata alla W4 | prima della T7 |
| **D253** | Politica definitiva della cache dei media (DR-253 la lascia alla 1F) | prima della T7 |

## 5. Cosa la wave non fa

- Nessun server, nessun acquisto, nessun DNS o certificato pubblico (W5, W8).
- Nessun servizio `backup` (W3) e nessuna security review completa (W4).
- Nessun dato reale nelle immagini, nei volumi di prova o nei registri della CI.
- Nessuna modifica di API, database o contratti oltre alle rotte di stato e a ciò che
  DR-359 richiede.

## 6. Rischi

| Rischio | Mitigazione |
|---|---|
| `sharp` e i binari nativi (`@node-rs/argon2`) non funzionano nell'immagine | base glibc della stessa versione di Node; prova di caricamento di un'immagine nella T10 |
| Il `standalone` di Next nel monorepo dimentica file dei pacchetti di lavoro | e2e completi contro l'immagine, non solo il health check |
| Indirizzi assoluti rimasti nella build | ricerca di `localhost` nei file costruiti delle immagini, nello script di W2-8 |
| Limite di memoria della pulizia troppo basso per un MP4 legittimo da 100 MB | taratura sul server nella W5 (DR-338); qui il limite si prova solo con un caso sintetico |
| Produzione e staging superano gli 8 GB | limiti per servizio sommati in `infra/deploy/README.md` |
| Costo o limiti del registro cambiati | rilettura con data nella T0 |
| Timeout di `apps/web` sotto carico (memoria del progetto) | rieseguire da soli i file in timeout, poi la copertura |
