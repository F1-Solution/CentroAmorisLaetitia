# ROADMAP — Centro per la Famiglia Amoris Laetitia

Derivata da `docs/discovery/phase-plan.md`. Una fase non parte senza approvazione
esplicita della precedente. Le decisioni approvate sono in
`docs/decisions/decision-register.md`.

## Prodotto finale

Piattaforma con sito pubblico pixel-perfect rispetto all'attuale sito WordPress,
frontend React + Next.js, backend Node.js + TypeScript, PostgreSQL, CMS interno,
futura area gestionale del consultorio, deployment containerizzato.

Il runtime finale **non dipende** da WordPress, PHP, MySQL o MariaDB.

---

## Gate assoluto di Fase 1

Nessuna fase gestionale può essere **pianificata**, avviata o rilasciata finché il
gate non è superato per intero. Le 15 condizioni sono elencate in
`docs/discovery/phase-plan.md` §3 e verificate dalla skill `deployment-gate`.

**Stato: NON SUPERATO.**

---

## Milestone

| # | Milestone | Fasi | Stato |
|---|---|---|---|
| M0 | Discovery e consolidamento requisiti | 0 | **approvata** 2026-09-13 |
| M1 | Migrazione WordPress → piattaforma nuova, pixel-perfect, in produzione | 1A–1G | in corso — 1A, 1B e 1C approvate |
| M2 | Fase gestionale del consultorio | da definire | **bloccata dal gate** |

---

## Fasi

### Fase 0 — Discovery (sola lettura) — **APPROVATA**

Output in `docs/discovery/`: indice documenti, requisiti consolidati, registro
decisioni, matrice legacy→target, decisioni aperte, piano di fase.

### Fase 1A — Audit WordPress (sola lettura)

Sorgente autorevole: `source-private/wordpress-2026-09-13/` (installazione completa)
e `source-private/BackupDB-2026-09-13/` (dump, 53 tabelle). Il materiale di marzo
in `source-private/wordpress/` è **superato** e vale solo come riscontro storico.

| Wave | Attività | Output |
|---|---|---|
| `1A-W1` | Inventario tecnico: versioni, tema, plugin, page builder, CPT, tassonomie, shortcode, form, SEO, redirect, cache, font, CSS/JS, dipendenze esterne | `docs/migration/wp-source-inventory.md` |
| `1A-W2` | Inventario contenuti da dump: pagine, articoli, CPT, allegati, termini, menu, con stato, gerarchia e date | `docs/migration/content-inventory.csv` |
| `1A-W3` | Matrice URL completa, inclusi URL numerici, alias, allegati, feed, tassonomie | `docs/migration/url-matrix.csv` |
| `1A-W4` | Mappa plugin → funzionalità pubblica osservabile, con destinazione dichiarata | `docs/migration/plugin-and-feature-map.md` |
| `1A-W5` | Rischi di migrazione e input mancanti | `docs/migration/migration-risks.md`, `docs/migration/missing-inputs.md` |

### Fase 1B — Architettura della migrazione e piano eseguibile — **APPROVATA** 2026-09-14

Otto wave eseguite il 2026-09-14, audit superato (`.planning/phases/1B/AUDIT.md`).

| Wave | Output |
|---|---|
| `1B-W0` | `docs/migration/source-supplementary-findings.md`, `public-menu.csv`, `seo-rendered-baseline.csv` |
| `1B-W1` | dieci ADR in `docs/decisions/adr/` — **tutte in stato di proposta** |
| `1B-W2` | `docs/architecture/schema.sql`, `database-schema.md` — 32 tabelle, verificate su PostgreSQL 17 |
| `1B-W3` | `docs/migration/wp-to-postgres-mapping.md` — 53 tabelle e 137 chiavi meta classificate |
| `1B-W4` | `docs/migration/importer-spec.md` |
| `1B-W5` | `docs/migration/divi-shortcode-strategy.md` |
| `1B-W6` | `docs/qa/visual-regression-plan.md`, `acceptance-criteria.md` |
| `1B-W7` | `docs/design/ui-proposals.md`, `ux-proposals.md` — 4 + 4 proposte |

Round 4 chiuso il 2026-09-14: **D15** (ADR approvate in blocco, DR-038), **D14**
(opzione B, DR-039), **D13** (opzione C, DR-040), **D16** (opzione A, DR-041).
Le dieci ADR sono **approvate** e il vincolo di D5 è soddisfatto.

HO-004 chiusa il 2026-09-15 con le cinque decisioni DR-044…DR-048. La Fase 1B è
pienamente chiusa.

Il backend **non deve assomigliare a WordPress**: vincolo rispettato da tutte e otto
le proposte di design.

### Fase 1C — Fondazione locale — **APPROVATA 2026-09-15**

Otto wave eseguite il 2026-09-14, audit superato
(`.planning/phases/1C/AUDIT.md`): 11 criteri di uscita su 11, 11 difetti trovati e
corretti, CI verde alla prima corsa.

| Wave | Output |
|---|---|
| `1C-W0` | `.planning/phases/1C/CONTEXT.md`, `PLAN.md` |
| `1C-W1` | monorepo pnpm + Turborepo, TypeScript strict, ESLint, Prettier, `.gitignore` riscritto |
| `1C-W2` | `infra/compose/` — PostgreSQL 17 con collazione italiana, storage a oggetti con i due bucket, `Caddyfile`, `.env.example` |
| `1C-W3` | `packages/db` — schema Drizzle delle 32 tabelle, migrazione iniziale, `pnpm db:verify` |
| `1C-W4` | `apps/api` — Fastify, configurazione validata all'avvio, stato del servizio, OpenAPI |
| `1C-W5` | `apps/web` e `apps/admin` — due applicazioni distinte, con le regole di ADR-008 §3.3 verificate |
| `1C-W6` | fondazione dei test: 24 test su tre livelli |
| `1C-W7` | `.github/workflows/ci.yml` |

Il gate di Fase 1 **non avanza**: questa fase costruisce l'impalcatura, non il
prodotto.

### Fase 1D — Importazione e CMS minimo

Importer idempotente con dry-run, import media, ricostruzione di menu, routing,
contenuti, tassonomie, SEO e redirect, CMS minimo, report di completezza.

| Wave | Attività | Output |
|---|---|---|
| `1D-W0` | Pianificazione della fase, sistema di design, registrazione delle decisioni | `.planning/phases/1D/CONTEXT.md`, `PLAN.md`, `BLOCK-MODEL.md`, `IMPORTER-DESIGN.md`, `docs/design/design-system.md` |
| `1D-W1` | Modello dei 14 blocchi di ADR-005: schemi Zod, sanificazione a elenco chiuso, serializzatore in HTML, componenti di resa | `packages/blocks` |
| `1D-W2` | Impalcatura dell'importer: riga di comando, lettura della sorgente, gli 8 controlli preliminari, registro delle esecuzioni e delle anomalie, rapporto | `apps/importer` |
| `1D-W3` | Convertitori da Gutenberg, da Divi e da HTML nudo a blocchi, con conteggio e soglia del blocco di riserva | convertitori e test unitari |
| `1D-W4` | Fasi di import 1–10: impostazioni, utenti, media e caricamento nel bucket, termini, contenuti, relazioni, menu, SEO, documenti, carosello | — |
| `1D-W5` | Fasi 11–16: form, compilazioni, tabelle storiche, redirect, riscrittura dei riferimenti ai media, verifica. Idempotenza e rientro | — |
| `1D-W6` | Rotte dell'API per contenuti, media, menu, SEO, redirect, impostazioni e tassonomie; sessioni; OpenAPI | `apps/api` |
| `1D-W7` | Attuazione del sistema di design: token e componenti dell'area amministrativa | `packages/ui` |
| `1D-W8` | CMS: navigazione per aree, accesso, elenco e modifica dei contenuti, editor dell'albero dei blocchi, anteprima | `apps/admin` |
| `1D-W9` | CMS: media, menu, SEO, redirect, impostazioni | `apps/admin` |
| `1D-W10` | Test di andata e ritorno su tutti i contenuti, E2E sul CMS, copertura | — |
| `1D-W11` | Esecuzione reale dell'import in locale e rapporto di completezza | `docs/migration/import-report.md` |
| `1D-W12` | Audit della fase | `.planning/phases/1D/AUDIT.md` |

### Fase 1E — Ricostruzione React e parità visiva

Design token dal sito originale, tutte le route e i template, responsive,
screenshot e visual diff Playwright, chiusura delle difformità, report QA in
`docs/qa/visual-parity-report.md`.

### Fase 1G — Collaudo redazionale del CMS

Verifica che contenuti, articoli, media, menu, SEO, redirect e impostazioni siano
**realmente** modificabili dall'interfaccia. Richiesta dalla condizione 7 del gate.
Si svolge in parallelo alla 1E.

### Fase 1F — Staging e produzione

Staging isolato, security review, prova di backup e restore, smoke test,
performance, piano di rollback, proposta provider e costi, deploy solo dopo
approvazione puntuale, verifica post-deploy, report di rilascio in `docs/deploy/`.

---

## Fasi successive — bloccate dal gate

Non pianificabili prima dell'approvazione della Fase 1F: utenti, soci e ruoli ·
corsi, iscrizioni, quote, presenze, supervisione · consultorio e appuntamenti ·
documenti · contabilità, prima nota, movimenti bancari, rendiconti RUNTS ·
form builder · comunicazioni email, WhatsApp, newsletter, social · analytics e SEO
evoluta · **PWA installabile** (sostituisce l'app nativa) · hardening, disaster
recovery, manuali e formazione.

---

## Avanzamento

Stato per wave in `PROGRESS.md`. Decisioni aperte in
`docs/discovery/open-questions.md`.
