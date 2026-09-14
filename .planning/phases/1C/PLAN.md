# PLAN — Fase 1C · Fondazione locale

Piano eseguibile. Una riga in `PROGRESS.md` per ogni wave completata, un commit per
wave. Le wave si eseguono in ordine: ognuna dipende dalla precedente.

Contesto e criteri di uscita: [`CONTEXT.md`](CONTEXT.md).

---

## Wave

| Wave | Che cosa produce | Come si verifica |
|---|---|---|
| `1C-W0` | Questo piano e `CONTEXT.md` | I due file esistono e non sono vuoti |
| `1C-W1` | Scaffold del monorepo: workspace pnpm, Turborepo, TypeScript strict condiviso, ESLint, Prettier, `.gitignore` riscritto, versioni fissate | `pnpm install` riesce; `git check-ignore` non esclude più `packages/`; `pnpm lint` e `pnpm typecheck` passano a vuoto |
| `1C-W2` | Ambiente locale in container: PostgreSQL 17, MinIO con i due bucket, Caddy, `.env.example` | I servizi si avviano e diventano sani; i bucket esistono; nessun segreto nel repository |
| `1C-W3` | `packages/db`: schema Drizzle delle 29 tabelle, migrazione iniziale, script di migrazione e di confronto | La migrazione si applica su PostgreSQL 17 e il confronto con `schema.sql` non trova differenze |
| `1C-W4` | `apps/api`: Fastify, configurazione validata con Zod, health check, OpenAPI, gestione errori, log | `/health/live` e `/health/ready` si comportano come previsto anche con il database spento; senza una variabile obbligatoria il servizio non parte |
| `1C-W5` | `apps/web` e `apps/admin`: due applicazioni Next.js minime, con le regole di ADR-008 §3.3 | Le due applicazioni si costruiscono; `apps/admin` risponde `noindex`; la regola di lint fallisce se `apps/web` importa da `packages/ui` |
| `1C-W6` | Fondazione dei test: Vitest, React Testing Library, integrazione su PostgreSQL vero, Playwright, copertura | `pnpm test` passa; esiste almeno un test per ciascuno dei tre tipi |
| `1C-W7` | CI minima su GitHub Actions | Il workflow esegue gli stessi comandi della macchina di sviluppo |
| `1C-W8` | `AUDIT.md`: verifica degli undici criteri di uscita, difetti trovati e corretti | Ogni criterio ha un esito eseguito, non affermato |

## Struttura del repository al termine

Deriva da ADR-008 §3.1. Le cartelle che la 1C **non** crea sono marcate.

```
apps/
  web/        Next.js — sito pubblico. Nessun service worker, nessun manifest.
  admin/      Next.js — area amministrativa. noindex.
  api/        Fastify — API.
  importer/   non in 1C: nasce in Fase 1D
packages/
  config/     TypeScript, ESLint e Prettier condivisi
  db/         schema Drizzle e migrazioni
  contracts/  schemi Zod condivisi
  blocks/     non in 1C: nasce in Fase 1D
  ui/         componenti dell'area amministrativa — in 1C esiste vuoto, solo per
              rendere verificabile la regola di lint di ADR-008 §3.3
infra/
  compose/    docker-compose e Caddyfile
```

## Dipendenze previste, e la ADR che le autorizza

Nessun pacchetto entra senza una riga in questa tabella. Le aggiunte non previste si
dichiarano nell'audit.

| Pacchetto | Dove | Autorizzato da |
|---|---|---|
| `typescript`, `@types/node` | tutto | DR-004 |
| `turbo` | radice | DR-003 |
| `eslint`, `prettier` e i relativi plugin | tutto | `CLAUDE.md` §Stack |
| `fastify`, `@fastify/cookie`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/swagger` | `apps/api` | ADR-001 §5 |
| `fastify-type-provider-zod`, `zod` | `apps/api`, `packages/contracts` | ADR-001 §3 |
| `drizzle-orm`, `drizzle-kit`, `postgres` | `packages/db` | ADR-002 §5 |
| `next`, `react`, `react-dom` | `apps/web`, `apps/admin` | DR-001 |
| `vitest`, `@testing-library/react`, `@playwright/test` | tutto | DR-007 |
| immagini `postgres:17`, `minio/minio`, `caddy` | `infra/compose` | ADR-003, ADR-009, DR-005 |

## Cosa questa fase non dimostrerà

Va detto adesso, per non doverlo dire dopo:

- Non dimostra che il sito nuovo somiglierà a quello vecchio: la parità è la 1E.
- Non dimostra che i contenuti si possono importare: lo dimostra la 1D con i conteggi.
- Non dimostra che il CMS è usabile da un redattore: lo dimostra la 1G.
- Non fa avanzare il gate di Fase 1 di una sola delle quindici condizioni.

## Conferme richieste all'utente durante la fase

Nessuna, se la fase resta nel perimetro dichiarato. Restano a conferma obbligatoria,
e **non** avvengono in 1C: deploy, DNS, certificati, invio di email, pagamenti,
import reali, migrazioni su database di produzione.
