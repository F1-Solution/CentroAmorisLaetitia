# Centro per la Famiglia Amoris Laetitia — piattaforma

Sostituzione del sito WordPress `www.centroamorislaetitia.it` con una piattaforma
React + Next.js, Node.js + TypeScript e PostgreSQL, dotata di CMS interno e, dopo il
gate di Fase 1, di un'area gestionale per il consultorio.

WordPress è **solo la sorgente** dei contenuti. Il runtime finale non dipende da
WordPress, PHP, MySQL o MariaDB.

## Dove si legge cosa

| Domanda | File |
|---|---|
| Che cosa si sta costruendo, in che ordine | [`ROADMAP.md`](ROADMAP.md) |
| Come si lavora su questo progetto | [`CLAUDE.md`](CLAUDE.md) |
| Che cosa è stato deciso e da chi | [`docs/decisions/decision-register.md`](docs/decisions/decision-register.md) |
| Perché è stato deciso così | [`docs/decisions/adr/`](docs/decisions/adr/) |
| Com'è fatto il database | [`docs/architecture/database-schema.md`](docs/architecture/database-schema.md) |
| A che punto è il lavoro | [`PROGRESS.md`](PROGRESS.md) |
| Cosa serve fare a mano | [`docs/handoff/`](docs/handoff/) |

## Struttura

```
apps/web      sito pubblico (Next.js)
apps/admin    area amministrativa (Next.js)
apps/api      API (Fastify)
packages/db   schema e migrazioni (Drizzle)
packages/…    configurazione condivisa, contratti, componenti
infra/compose ambiente locale in container
docs/         documentazione di progetto
```

Le regole che tengono in piedi questa divisione sono in
[ADR-008](docs/decisions/adr/ADR-008-struttura-applicazioni.md) §3.3, e alcune sono
verificate dal lint e dai test, non affidate alla memoria.

## Requisiti

Node **25** (vedi `.nvmrc`), pnpm **11**, Docker con Compose.

## Avvio in locale

```bash
cp .env.example .env        # valori di sviluppo, nessun segreto vero
pnpm install
pnpm compose:up             # PostgreSQL e MinIO
pnpm db:migrate             # migrazioni: passo esplicito, mai all'avvio
pnpm dev
```

| Indirizzo | Che cosa |
|---|---|
| `http://localhost:3000` | sito pubblico |
| `http://localhost:3001` | area amministrativa |
| `http://localhost:3002/health/live` | API, stato del servizio |
| `http://localhost:9001` | console di MinIO |

## Comandi

| Comando | Che cosa fa |
|---|---|
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | controlli su tutto il monorepo |
| `pnpm test` | unità e integrazione (l'integrazione richiede PostgreSQL avviato) |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate` | genera una migrazione dalle modifiche allo schema |
| `pnpm db:verify` | confronta il database con `docs/architecture/schema.sql` |
| `pnpm compose:reset` | **distrugge** i dati locali e riparte da zero |

## Due regole che non si negoziano

- **Nessun dato reale** in codice, test, seed, fixture, screenshot o documentazione.
  Il Centro tratta consulenze familiari, minori e dati economici.
- **`source-private/` non si modifica mai** ed è escluso da Git.
