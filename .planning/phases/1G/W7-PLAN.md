# Piano della wave 1G-W7 — Non regressione e preparazione del collaudo

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice nelle
> attività che cambiano codice (T1, T2). Protocollo `PROGRESS.md`: un commento datato dopo
> ogni attività, una sola riga `STATUS:complete` a fine wave. Nessun commit senza conferma:
> il controller fotografa il lavoro fra un'attività e l'altra
> (`.superpowers/sdd/strumenti-1G/snap.sh`).

Scritto il 2026-10-26, dopo la chiusura della `1G-W6` (commit `922baef`).

**Obiettivo:** chiudere il codice della Fase 1G con i due cambi già decisi (`next` aggiornato,
DR-255; codec ammessi, DR-264), dimostrare che la parità approvata non è peggiorata (1G-21,
1G-22, 1G-23), registrare la caccia al contenuto scritto nel codice (1G-26) e la matrice di
editabilità attesa, e preparare l'ambiente di collaudo con i suoi account e un handoff per
compito, così che la `1G-W8` cominci con una sola azione dell'utente.

**Architettura.**

- **Codice.** Due soli cambi, all'inizio: `next` da 16.3.5 a 16.4.3 in sito e area (T1), e
  l'elenco dei codec ammessi da `ffmpeg` (T2). Dopo la T3 il codice è congelato fino alla
  `1G-W9`: ciò che la wave misura è ciò che l'utente collauderà.
- **Non regressione.** Gli strumenti di `tests/visual/` si **eseguono**, non si cambiano
  (`PLAN.md` §2). La cattura integrale segue il metodo della `1E-W7`: la cattura accettata si
  sposta in una cartella datata, la nuova prende il suo posto, `confronto-tutto.ts` produce
  i nuovi esiti, e un confronto vista per vista con l'ultimo stato accettato applica la
  regola di D163.
- **Ambiente di collaudo (DR-215, DR-223).** Database, archivio a oggetti, API, area e sito
  dedicati, secondo D162, creati e ripristinati da script nel repository, su conferma. Il
  database di sviluppo non si scrive.
- **Handoff.** Un documento per compito (1G-1…1G-17), che dice **che cosa** ottenere e come
  riconoscere il risultato sul sito, mai **come** farlo nell'interfaccia: il collaudo misura
  se la redazione ci riesce da sola (`acceptance-criteria.md` §5).

**Stack:** Next.js, Fastify, PostgreSQL, MinIO, Playwright e gli script di `tests/visual/`.

- **Dipendenze:** `next` 16.4.3 al posto di 16.3.5 (DR-255). Nessun'altra.
- **Migrazioni:** nessuna.

**Riferimenti:**

- `CONTEXT.md` §4, §5 (RG-03, RG-05, RG-07), §7 (1G-21…1G-26); `PLAN.md` §1, §2, §7 righe 1 e
  3, §8.
- DR-162, DR-203, DR-210, DR-213…DR-215, DR-221, DR-223, DR-226, DR-243, DR-248, DR-255,
  DR-264.
- `docs/qa/visual-parity-report.md` §11-§13; `docs/qa/verifiche/audit-1E-W7.md`;
  `.planning/phases/1E/AUDIT.md`; HO-031.

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W7-1 | DR-255: sito e area girano con `next` 16.4.3; nessun avviso noto di `next` resta aperto | `pnpm-lock.yaml`; build, prove ed e2e verdi |
| W7-2 | DR-264: un MP4 con video `h264` o `hevc` e audio `aac` si carica ripulito; ogni altro codec audio o video si rifiuta con `400 MEDIA_FILE_INVALID`, senza scritture | prove dell'API con file sintetici |
| W7-3 | 1G-23: verifica come la CI verde in locale e in CI | lint, Prettier, tipi, build, prove, `db:verify`, copertura, e2e; corsa della CI |
| W7-4 | 1G-21: confronto visivo integrale delle 585 viste; nessuna vista peggiorata secondo D163, oppure ogni vista peggiorata corretta o accettata dall'utente voce per voce | `docs/qa/confronto/esiti-1G-W7.csv`, `visual-parity-report.md` §14 |
| W7-5 | 1G-22: 1E-19 4/4; menu 41/41; metadati 0 difformi; redirect 181/181; stati 292/292 | `prova-1e-19.json`, `verifica-sito.ts`, `verifica-metadati.ts`, `verifica-redirect.ts`, `stati-matrice.py` |
| W7-6 | 1G-26: ogni testo visibile scritto nel codice del sito è elencato per file e riga, con la sua origine e il motivo per cui non è (o non deve essere) modificabile | `docs/qa/contenuto-nel-codice.md` |
| W7-7 | Matrice di editabilità **attesa**: ogni tipo di contenuto e ogni campo dell'inventario, con dove si modifica, il compito che lo collauda e i campi volutamente non modificabili di DR-218; la colonna dell'esito resta vuota per la `1G-W8` | `docs/qa/editability-matrix.csv` |
| W7-8 | L'ambiente di collaudo risponde (sito, area, API), ha le compilazioni svuotate, il proprio archivio dei media e due account sintetici, `redazione` e `amministrazione`, creati dall'utente | HO-034 eseguito; controllo dell'agente in sola lettura |
| W7-9 | Un handoff per compito 1G-1…1G-17, indicizzato, con i criteri 1D-28…1D-37 e HO-006 (DR-226) assegnati ad almeno un compito | `docs/handoff/HO-036…HO-052`, `README.md` |
| W7-10 | La wave si ferma con la richiesta del collaudo all'utente | messaggio finale |

## 2. Fatti accertati il 2026-10-26

### 2.1 `next` (DR-255)

| Fatto | Fonte |
|---|---|
| Sito e area dichiarano `next ^16.3.5`; il lockfile risolve 16.3.5; `react` e `react-dom` 19.3.0; `eslint-config-next` non è usato | `apps/web/package.json:17`, `apps/admin/package.json:27`, `pnpm-lock.yaml:2922` |
| 16.3.5 è colpita da sei avvisi pubblicati dopo il suo rilascio, tre critici (fra cui l'esecuzione di codice in `/_next/image` con SVG) e uno alto; tutti corretti in 16.4.1 | GitHub Security Advisories di `vercel/next.js`; note di 16.3.8 e 16.4.1 |
| 16.4.3 (2026-10-23) è l'ultima stabile; rispetto a 16.4.1 aggiunge solo correzioni (Turbopack, font, `proxy.ts`, OpenTelemetry); dipendenze `react` e `node` invariate; nessun cambio incompatibile dichiarato per le app esistenti | registro npm; note di 16.4.0…16.4.3; blog «Next.js 16.4» |

### 2.2 Codec (DR-264)

| Fatto | Fonte |
|---|---|
| Gli argomenti di `ffmpeg` nascono in `mp4Args` (input forzato `-f mov`, `-map 0:V?`, `-map 0:a?`, `-c copy`, `-fs`) | `apps/api/src/modules/media/scrub.ts:177-210` |
| Con `-codec_whitelist` limitato, un MP4 con un codec fuori elenco fallisce in `avformat_find_stream_info`: l'uscita non nulla diventa già `ScrubUnreadableError`, cioè `400 MEDIA_FILE_INVALID` | revisione di sicurezza della `1G-W6` (M2); `scrub.ts:68` |
| I file MP4 delle prove li genera `buildMp4()`; nessuna prova controlla i codec | `apps/api/tests/_support/syntheticFiles.ts`, `mediaScrub.test.ts:181` |

### 2.3 Non regressione

| Fatto | Fonte |
|---|---|
| Esiti accettati: `esiti.csv`, 585 viste (548 fallito, 40 superato, 3 da esaminare) dopo DR-162 e DR-203; viste poi cambiate e accettate: 9 di archivio (DR-243, `esiti-1G-W4-DR-243.csv`) e la ricerca (DR-248, `esiti-1G-W5-DR-248.csv`); le 15 di `/download/` identiche (`esiti-1G-W6-download.csv`) | `docs/qa/confronto/`, `visual-parity-report.md` §11-§13 |
| Le catture accettate sono in `docs/qa/screenshots/sito/` (fuori da Git), quelle cambiate dopo in `sito-1G-W4/` e `sito-1G-W5/`; per una ricattura la `1E-W7` ha spostato la cartella in `sito-<data>-prima-<motivo>/` | cartelle presenti; `PROGRESS.md` 1E-W7 |
| `cattura-sito.ts` scrive in `docs/qa/screenshots/sito/`, ripartibile, due pagine per volta; `confronto-tutto.ts` legge `riferimento/`, `sito/` e `maschere.json` e scrive `esiti.csv` | `tests/visual/cattura-sito.ts:19-21`, `confronto-tutto.ts:12-25` |
| Nessuna formula di «vista peggiorata» in DR-162 o DR-203; l'audit della `1E-W7` ha usato la percentuale verso il riferimento | `decision-register.md:1398, 1504`; `audit-1E-W7.md:31-36` |
| Menu 41/41 è la parte menu di `verifica-sito.ts`; metadati, redirect e interazioni richiedono l'istanza di riferimento su `:8088` | `tests/visual/verifica-sito.ts:25-53`; `verifica-metadati.ts:13-14`; `verifica-redirect.ts:15-17` |
| 1E-19 e la prova dell'anteprima entrano con un account sintetico di Redazione (`QA_PASSWORD`); 1E-19 **scrive** 4 salvataggi senza modifiche e 4 righe di registro; l'anteprima scrive solo sessione e accessi. L'ultima esecuzione (HO-031) l'ha fatta l'utente sul database di sviluppo, con copia | `tests/visual/prova-1e-19.ts:21-30, 164`; HO-031 §3-bis |
| Memoria libera oggi: 6,2 GB; la cattura integrale ne vuole almeno 6 (HO-014) | lettura del 2026-10-26 |

### 2.4 Ambiente di collaudo

| Fatto | Fonte |
|---|---|
| DR-215: database separato copiato da quello di sviluppo, compilazioni svuotate, API e sito dedicati; DR-223: bucket dedicato copiato da quello di sviluppo | `decision-register.md:1554, 1567`; `DECISIONI-1G.md:60-71` |
| Il compose ha un solo Postgres e un solo MinIO; `create-buckets.sh` crea bucket vuoti; nessuno script copia un bucket | `infra/compose/docker-compose.yml`, `create-buckets.sh:11-20` |
| L'area incorpora l'indirizzo dell'API alla compilazione; sito e area scrivono sempre in `.next`, quindi compilazioni di sviluppo, e2e e collaudo si sovrascrivono; l'anteprima vuole sito e area sullo stesso host | `apps/admin/src/lib/api.ts:15`; nessun `distDir`; `.planning/phases/1E/AUDIT.md:87`; `W5-PLAN.md` |
| `account:create` accetta qualunque database su `localhost`; il ruolo deve esistere | `apps/api/src/accounts/localAccount.ts:15, 59-64` |
| Porte libere: 3300-3302 | `tests/e2e/support/ambiente.ts:46-50`; `riavvia-sviluppo.ps1` |

### 2.5 Contenuto nel codice e matrice

| Fatto | Fonte |
|---|---|
| Nessun inventario del contenuto scritto nel codice; testi visibili in `Views.tsx`, `HeaderSearch.tsx`, `SiteHeader.tsx`, `MobileNav.tsx`, `not-found.tsx`, `SiteFooter.tsx`, `structuredData.ts`, `page.tsx`; `format.ts` ha i nomi dei mesi | ricerca del 2026-10-26 |
| `docs/qa/editability-matrix.csv` non esiste; l'inventario di `DECISIONI-1G.md` §5 fotografa il codice **prima** della `1G-W1` | `DECISIONI-1G.md:151-175` |

## 3. Decisioni

### 3.1 Richieste prima di eseguire

Risposte del 2026-10-26: **D161 = A** (DR-265), **D162 = A** (DR-266), **D163 = A** (DR-267); piano approvato.

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D161** | Dove si eseguono 1E-19 e la prova dell'anteprima (1G-22), che entrano con un account e scrivono 4 salvataggi | **A** — sull'ambiente di collaudo appena creato, eseguite dall'utente con l'account sintetico di Redazione (HO-035); prima della `1G-W8` l'ambiente si ripristina, così i 4 salvataggi non restano nel collaudo · **B** — sul database di sviluppo, come HO-031, con copia di salvataggio · **C** — su una terza copia temporanea del database, cancellata dopo | **A**: nessuna scrittura sul database di sviluppo, stessi dati, e la prova vale anche come primo controllo che l'ambiente di collaudo funzioni | eseguire le due prove o scrivere su qualunque database |
| **D162** | Come convivono ambiente di sviluppo e ambiente di collaudo, dato che le compilazioni di Next si sovrascrivono | **A** — una copia di lavoro Git separata (`git worktree`, fuori dal repository) fissata sul commit da collaudare, con installazione e compilazioni proprie; porte 3300 (sito), 3301 (area), 3302 (API); database `amoris_collaudo` nello stesso Postgres; bucket `collaudo-public` e `collaudo-private` nello stesso MinIO; durante il collaudo i server di sviluppo si spengono per la memoria · **B** — stessa copia di lavoro, con una cartella di compilazione configurabile (`distDir` da variabile) in sito e area: un piccolo cambio di codice · **C** — nessuna separazione: durante il collaudo le compilazioni di sviluppo si rifanno per il collaudo, e dopo si rifanno per lo sviluppo | **A**: il collaudo gira su una versione esatta e immobile anche mentre la `1G-W9` cambia il codice, e nessun file dell'applicazione cambia per ospitarlo | creare database, bucket, cartelle o processi del collaudo |
| **D163** | Che cosa conta come vista **peggiorata** nel confronto integrale (1G-21), che nessuna decisione definisce | **A** — una vista è invariata se è identica byte per byte all'ultima cattura accettata; altrimenti è non peggiorata se la sua differenza dal riferimento non supera la percentuale accettata, ed è peggiorata se la supera anche di poco; le peggiorate bloccano finché non sono corrette o accettate da te una per una, come in DR-203 · **B** — ogni vista non identica all'ultima cattura accettata ti si mostra per l'accettazione, qualunque sia la percentuale · **C** — come A, ma con una tolleranza di 0,05 punti sotto cui una differenza conta come rumore | **A**: è la regola già usata dall'audit della `1E-W7`, misurabile senza giudizio, e ti porta solo le viste che si allontanano dal riferimento | dichiarare 1G-21 soddisfatto |

### 3.2 Scelte già prese (dentro le decisioni esistenti)

| # | Scelta | Motivo |
|---|---|---|
| S1 | `next` `^16.4.3` in `apps/web` e `apps/admin`; lockfile su 16.4.3. Nessun altro pacchetto cambia | DR-255 chiede ≥ 16.4.1; 16.4.3 ha tutte le correzioni di sicurezza e solo correzioni in più |
| S2 | `ffmpeg` riceve `-codec_whitelist h264,hevc,aac` fra le opzioni d'ingresso, prima di `-i`. Un MP4 con video `h264` o `hevc` e audio `aac` (o senza audio) si accetta; uno con un altro codec video o audio si rifiuta con `400 MEDIA_FILE_INVALID`. Le tracce dati e di sottotitoli, che la pulizia toglie comunque, non devono far rifiutare il file: se `-codec_whitelist` le rifiuta, la T2 si ferma e lo riporta al controller | DR-264; la revisione di sicurezza ha provato l'opzione |
| S3 | Le prove dei MP4 passano a file sintetici `h264`/`aac` (`libx264` è nelle compilazioni di `ffmpeg` usate in sviluppo e in CI) | i file `mpeg4` di oggi verrebbero rifiutati |
| S4 | Il codice si congela dopo la T3: nessuna modifica fino alla `1G-W9`, salvo una vista peggiorata da correggere (T4) | il collaudo e la non regressione devono riguardare lo stesso codice |
| S5 | Cattura integrale con il metodo della `1E-W7`: `sito/` → `sito-2026-10-xx-prima-1G-W7/`, `esiti.csv` → `esiti-prima-1G-W7.csv`; `maschere.json` invariato; nuova cattura in `sito/`; `confronto-tutto.ts`; poi lo script fuori da Git `.superpowers/sdd/strumenti-1G/w7-confronto.ts` confronta ogni vista con l'ultima cattura accettata (`sito-1G-W4/` per le 9 viste di DR-243, `sito-1G-W5/` per la ricerca di DR-248, altrimenti la cartella spostata) e scrive `docs/qa/confronto/esiti-1G-W7.csv` | stessi strumenti e stesse maschere degli esiti accettati |
| S6 | Prima della cattura: almeno 6 GB liberi, server di collaudo spenti, istanza di riferimento spenta; se la memoria manca, handoff per liberarla (come HO-014) | RG-07 |
| S7 | Gli handoff dei compiti dicono l'obiettivo, i dati di partenza sintetici da usare, come riconoscere la riuscita sul sito e che cosa annotare (esito, minuti, difficoltà); non contengono passi dell'interfaccia | il collaudo misura l'uso senza assistenza (`acceptance-criteria.md` §5) |
| S8 | Account del collaudo: `redazione` e `amministrazione`, con indirizzi `*@example.invalid`, creati **dall'utente** con `account:create` sul database di collaudo; le password non passano mai dall'agente | `CONTEXT.md` §4; HO-031 §3-bis |
| S9 | Nella copia del database di collaudo si svuotano `form_submissions` (DR-215) e le sessioni; gli account copiati dallo sviluppo si disattivano, così nel collaudo entrano solo i due sintetici | privacy; il collaudo non deve usare l'account personale |
| S10 | Gli script dell'ambiente stanno in `tools/collaudo/` (PowerShell, come gli handoff): `crea.ps1` (copia database e bucket, svuota, disattiva gli account copiati), `avvia.ps1`, `ferma.ps1`; il ripristino è `crea.ps1` sopra un ambiente esistente, che prima lo cancella. Ogni esecuzione di `crea.ps1` è una conferma (`PLAN.md` §7, riga 3) | ambiente ripristinabile con un comando |
| S11 | In `.github/workflows/ci.yml` il limite del job passa da 25 a 40 minuti | il 2026-10-26 la prima corsa di `922baef` è stata annullata al minuto 25 perché `apt` ha scaricato `ffmpeg` a 59 kB/s (17 minuti); una corsa normale dura circa 21 minuti |

## 4. Struttura dei file

| Percorso | Che cosa |
|---|---|
| `apps/web/package.json`, `apps/admin/package.json`, `pnpm-lock.yaml` | `next` 16.4.3 (S1) |
| `.github/workflows/ci.yml` | limite del job a 40 minuti (S11) |
| `apps/api/src/modules/media/scrub.ts`; `apps/api/tests/mediaScrub.test.ts`, `_support/syntheticFiles.ts`; `docs/decisions/adr/ADR-012-pulizia-dei-metadati.md` | codec ammessi (S2, S3) |
| `docs/qa/confronto/esiti.csv`, `esiti-prima-1G-W7.csv`, `esiti-1G-W7.csv`; `docs/qa/visual-parity-report.md` §14; `docs/qa/verifiche/*` rigenerati dagli script | non regressione |
| `docs/qa/contenuto-nel-codice.md` (nuovo) | 1G-26 |
| `docs/qa/editability-matrix.csv` (nuovo) | matrice attesa |
| `tools/collaudo/crea.ps1`, `avvia.ps1`, `ferma.ps1`, `README.md` (nuovi) | ambiente di collaudo (S10) |
| `docs/handoff/HO-034…HO-052` (nuovi), `docs/handoff/README.md` | ambiente, prove sul collaudo, compiti |
| `.planning/phases/1G/PLAN.md`, `PROGRESS.md`, `docs/decisions/decision-register.md` | stato e decisioni |

## 5. Interfacce

```text
# Ambiente di collaudo (con D162 = A)
copia di lavoro:  C:\work\amoris-collaudo   (git worktree, commit da collaudare)
sito:             http://127.0.0.1:3300
area:             http://127.0.0.1:3301/admin
API:              http://127.0.0.1:3302
database:         amoris_collaudo           (stesso Postgres di sviluppo)
bucket:           collaudo-public, collaudo-private (stesso MinIO)

tools/collaudo/crea.ps1  -Commit <sha>   # copia, svuota, disattiva; chiede conferma testuale
tools/collaudo/avvia.ps1                 # compila se serve e avvia i tre servizi
tools/collaudo/ferma.ps1                 # ferma i tre servizi
```

`crea.ps1` stampa solo conteggi (contenuti, media, oggetti copiati, compilazioni svuotate,
account disattivati), mai nomi, indirizzi o valori.

## 6. Revisione di attenzione

1. **Avvisi di `next` e `/_next/image`.** Dopo l'aggiornamento, le immagini servite da
   `/_next/image` restano identiche nella cattura (la cattura le confronta già).
2. **MP4 con sottotitoli o traccia dati.** Un MP4 `h264`/`aac` con una traccia di
   sottotitoli e una di dati si accetta e ne esce senza (S2); se no, la T2 si ferma.
3. **MP4 senza audio** si accetta.
4. **Cattura interrotta per memoria.** Si riprende da `sito.jsonl`, senza ripartire.
5. **Viste cambiate da DR-243 e DR-248.** Si confrontano con le loro catture accettate, non
   con quelle del 2026-10-18 (S5).
6. **Istanza di riferimento.** Si accende solo per metadati, redirect e interazioni, e si
   spegne subito dopo.
7. **Copia del bucket.** Copia con `mc mirror` dentro il contenitore MinIO; nessun file
   passa dalla cartella del repository; il bucket riservato del collaudo resta senza accesso
   anonimo.
8. **Account copiati dallo sviluppo.** Restano nel database di collaudo ma disattivati:
   nessuno entra con l'account personale.
9. **Handoff che spiegano troppo.** Un handoff che descrive i clic invalida il compito:
   la revisione della T8 lo controlla.
10. **1E-19 sul collaudo (D161 = A).** I 4 salvataggi senza modifiche restano nel
    database di collaudo finché la `1G-W8` non lo ripristina: la `1G-W8` comincia con il
    ripristino.

## 7. Attività

### T0 — Decisioni D161-D163 e preparazione
- [x] Registrare le risposte (DR-265…) e aggiornare questo piano e `PLAN.md` §8.
- [x] Commento in `PROGRESS.md`.

### T1 — `next` 16.4.3 (DR-255, S1)
**File:** `apps/web/package.json`, `apps/admin/package.json`, `pnpm-lock.yaml`.
- [ ] `pnpm --filter @amoris/web --filter @amoris/admin add next@^16.4.3`; il lockfile
  risolve 16.4.3 e nient'altro cambia di versione maggiore o minore (`git diff pnpm-lock.yaml`
  letto e riassunto).
- [ ] Build di sito e area; prove di `@amoris/web` e `@amoris/admin`; e2e completo.
- [ ] Commento in `PROGRESS.md` con le versioni prima e dopo.

### T2 — Codec ammessi (DR-264, S2, S3)
**File:** `scrub.ts`, `mediaScrub.test.ts`, `_support/syntheticFiles.ts`, ADR-012.
- [ ] Prove (falliscono): MP4 `h264`+`aac` accettato e ripulito; `hevc` accettato; video
  senza audio accettato; video `mpeg4` rifiutato (`ScrubUnreadableError`, `400` sulla
  rotta, nessuna scrittura); audio `mp3` rifiutato; `h264`+`aac` con sottotitoli e traccia
  dati accettato e ripulito (S2).
- [ ] Attuazione; prove di `@amoris/api` verdi (con `QPDF_PATH`); ADR-012 aggiornata
  (requisito attuato, non più «da attuare»).
- [ ] Commento in `PROGRESS.md`.

### T3 — Verifica come la CI e congelamento (1G-23 in locale)
- [ ] `ci.yml`: `timeout-minutes: 40` (S11).
- [ ] `verifica-ci.sh` (lint, Prettier, tipi, build, prove, `db:verify`, copertura, e2e).
- [ ] Revisione del codice di T1 e T2 e revisione di sicurezza di T2.
- [ ] Ricompilare e riavviare i server di sviluppo. Da qui il codice è congelato (S4).

### T4 — Confronto visivo integrale (1G-21, D163, S5, S6)
- [ ] Memoria ≥ 6 GB (altrimenti handoff); server di collaudo e istanza di riferimento
  spenti.
- [ ] Spostare `sito/` ed `esiti.csv` (S5); `cattura-sito.ts` sulle 585 viste; controllo che
  il giornale abbia 585 righe valide; `confronto-tutto.ts`.
- [ ] `w7-confronto.ts`: per vista, «invariata», «non peggiorata» o «peggiorata» secondo
  D163, con impronte e percentuali, in `esiti-1G-W7.csv`.
- [ ] Ogni vista peggiorata: causa trovata (`superpowers:systematic-debugging`); se è un
  difetto del codice della 1G, correzione con prova e ricattura delle viste interessate;
  altrimenti scheda nel rapporto e accettazione chiesta all'utente voce per voce.
- [ ] `visual-parity-report.md` §14 con i conteggi; commento in `PROGRESS.md`.

### T5 — Menu, metadati, redirect, stati (1G-22 senza 1E-19)
- [ ] `verifica-sito.ts` (menu 41/41, un `h1`, nessuno scorrimento orizzontale).
- [ ] Istanza di riferimento accesa; `verifica-metadati.ts` (0 difformi rispetto alle
  difformità accettate), `verifica-redirect.ts` (181/181); istanza spenta;
  `stati-matrice.py` (292/292).
- [ ] Commento in `PROGRESS.md` con gli esiti.

### T6 — Contenuto nel codice e matrice attesa (1G-26, W7-6, W7-7)
- [ ] Leggere per intero `apps/web/src/**` e i componenti di `packages/blocks` resi sul
  sito; elencare in `docs/qa/contenuto-nel-codice.md` ogni testo visibile o letto da un
  lettore di schermo: file e riga, testo, origine (tema della sorgente, formattazione,
  accessibilità, dato dalle impostazioni), modificabile sì/no e perché.
- [ ] `docs/qa/editability-matrix.csv`: colonne `tipo,campo,dove_si_modifica,compito,criterio,atteso,esito_collaudo,note`;
  una riga per tipo di contenuto e campo dell'inventario aggiornato alla `1G-W6`; i campi
  di DR-218 con `atteso = non modificabile in Fase 1`.
- [ ] Commento in `PROGRESS.md`.

### T7 — Ambiente di collaudo (D162, S8-S10) e prove sul collaudo (D161)
- [ ] `tools/collaudo/*` con `README.md`; prove degli script su un nome di prova
  (`amoris_collaudo_prova`, `collaudo-prova-*`) creati e cancellati dallo script stesso, solo
  dopo la conferma dell'esecuzione vera.
- [ ] **HO-034** — creazione dell'ambiente: comando, file, impatto, ritorno indietro,
  verifica; poi i due account sintetici creati dall'utente. **Conferma obbligatoria.**
- [ ] Dopo la conferma: `crea.ps1`, `avvia.ps1`; controllo in sola lettura (sito, area,
  API rispondono; compilazioni 0; account attivi 2; oggetti copiati = oggetti di sviluppo).
- [ ] **HO-035** — 1E-19 e anteprima sul collaudo (con D161 = A), eseguite dall'utente.
- [ ] Commento in `PROGRESS.md`.

### T8 — Handoff dei compiti (W7-9, S7)
- [ ] HO-036…HO-052, uno per compito 1G-1…1G-17, con: obiettivo; ruolo e account; dati di
  partenza sintetici; come riconoscere la riuscita sul sito; che cosa annotare (esito,
  minuti, difficoltà, messaggi visti); come segnalarlo. Nessun passo dell'interfaccia.
- [ ] Assegnare 1D-28…1D-37 e HO-006 (DR-226) ai compiti, nella matrice e negli handoff.
- [ ] `docs/handoff/README.md` aggiornato; revisione di tutti gli handoff contro S7.

### T9 — Verifica e chiusura
- [ ] Revisione dell'intera wave (codice, documenti, script dell'ambiente).
- [ ] Riga `PHASE:1G WAVE:1G-W7 STATUS:complete`; commit e push **su conferma**; controllo
  della CI (1G-23 in CI).
- [ ] **Stop:** richiesta del collaudo all'utente (`1G-W8`).

## 8. Cosa la wave non fa

- Non esegue il collaudo: lo fa l'utente nella `1G-W8`.
- Non cambia il codice dopo la T3, salvo la correzione di una vista peggiorata.
- Non scrive sul database di sviluppo, né sui suoi bucket.
- Non corregge i minori parcheggiati per la `1G-W9`.
- Non cambia gli strumenti di `tests/visual/` né le maschere.
- Non crea l'immagine di produzione né il contenitore separato dei programmi (DR-263, 1F).
- Non cancella l'istanza di riferimento (HO-017, dopo la 1G).

## 9. Rischi

| Rischio | Mitigazione |
|---|---|
| `next` 16.4.3 cambia la resa di qualche vista | cattura integrale dopo l'aggiornamento; ogni vista peggiorata si esamina (T4) |
| Memoria insufficiente per la cattura (6,2 GB liberi oggi) | S6; cattura ripartibile; handoff per liberare memoria |
| `-codec_whitelist` rifiuta MP4 con tracce che la pulizia toglierebbe | prova esplicita (S2); fermata e decisione del controller |
| Due copie di lavoro (D162 = A) occupano disco e memoria | collaudo acceso solo durante il collaudo (RG-07); server di sviluppo spenti in quel momento |
| Gli handoff guidano troppo e il collaudo non misura l'autonomia | S7; revisione della T8 |
| Un account personale entra nel collaudo | S9: account copiati disattivati |
| Il ripristino dell'ambiente cancella il lavoro del collaudo | il ripristino è sempre su conferma, e la `1G-W8` registra gli esiti prima |

## 10. Estensione del 2026-10-27 (DR-268…DR-285)

Le decisioni della prima fermata aggiungono codice prima del congelamento: il congelamento (S4)
si sposta dopo la T2i, e la verifica come la CI (T3) si ripete. Brief di dettaglio in
`.superpowers/sdd/W7-PLAN/task-2X-brief.md`.

| Attività | Decisioni | Che cosa |
|---|---|---|
| T2b | DR-269, DR-270, DR-277 | fatta: impostazioni lette dal sito, testi dell'area, selettore telefonico |
| T2c | DR-273, DR-284 | `htmlLimitedBots` in `apps/web`; titolo di riserva e 404 da «Titolo del sito» |
| T2d | DR-283 | blocco «Immagine» inseribile dall'editor; motivo vero per gli altri blocchi |
| T2e | DR-278 | mostrare il titolo, primo piano, immagine in evidenza delle pagine, spazio fra le colonne, tipo di dati strutturati |
| T2f | DR-279 | configurazione dei blocchi «Video», «Mappa», «Documento» |
| T2g | DR-280 | categorie: descrizione, genitore (con redirect 301), SEO dell'archivio, eliminazione |
| T2h | DR-281 | documenti: creazione ed eliminazione |
| T2i | DR-282 | nome ed email di un account; revisione di sicurezza |
| T2k | DR-287 | blocco «Documento»: collegamento alla scheda `/download/<slug>/`, inseribile dall'editor |
| T2l | DR-288 | password attuale per ogni modifica al proprio account; ADR-007; revisione di sicurezza |
| T2j | DR-271…DR-288 | `contenuto-nel-codice.md`, matrice e handoff aggiornati alle funzioni nuove |

Regole comuni: ogni effetto sul sito segue la sorgente WordPress dove la sorgente aveva il campo;
con i dati attuali l'HTML del sito resta identico (la T4 lo verifica); prove prima del codice;
revisione per attività; revisione di sicurezza per T2f, T2g, T2h, T2i.
