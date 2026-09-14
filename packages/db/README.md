# @amoris/db

Schema PostgreSQL e migrazioni. Strumento scelto da
[ADR-002](../../docs/decisions/adr/ADR-002-orm.md): **Drizzle** con `drizzle-kit`.

## Due file, una sola verità

| File | Ruolo |
|---|---|
| [`docs/architecture/schema.sql`](../../docs/architecture/schema.sql) | forma **canonica e leggibile**, prodotta e verificata nella wave 1B-W2 |
| `src/schema/*.ts` | definizione **eseguibile**, da cui nascono le migrazioni |

Devono corrispondere. Che corrispondano **non è un'intenzione**: lo dimostra
`pnpm db:verify`, che costruisce due database veri — uno dalle migrazioni, uno
dallo schema canonico — e confronta tabelle, colonne, tipi enumerati, vincoli e
indici interrogando il catalogo di PostgreSQL. Il comando gira in CI.

I **nomi** di vincoli e indici sono deliberatamente esclusi dal confronto:
drizzle-kit nomina le chiavi esterne diversamente da PostgreSQL, e un nome diverso
non è una differenza di struttura. Le differenze di nome sono riportate come nota.

## Comandi

```bash
pnpm db:generate     # genera una migrazione dalle modifiche a src/schema
pnpm db:migrate      # applica le migrazioni (passo esplicito, mai all'avvio)
pnpm db:verify       # dimostra la corrispondenza con la forma canonica
```

## Dopo ogni `db:generate`: leggere il file

ADR-002 §5 lo rende obbligatorio, non consigliato. Due cose vanno controllate a
occhio, perché sono limiti noti di drizzle-kit incontrati su questo schema:

1. **Le estensioni non vengono generate.** `pgcrypto`, `citext` e `unaccent`
   stanno in testa a `0000_schema_iniziale.sql` e sono state aggiunte a mano.
   Senza, falliscono `gen_random_uuid()`, il tipo `citext` e la ricerca senza
   accenti.
2. **Le espressioni `CHECK` vengono troncate al primo punto e virgola.** I due
   vincoli `contents_path_shape` e `terms_path_shape` contengono un `;` dentro la
   classe di caratteri dell'espressione regolare, e drizzle-kit taglia lì. Nel file
   sono riportati per intero.

Se una delle due cose sfuggisse a una rigenerazione futura, `pnpm db:verify`
fallisce: è quello il controllo, non la diligenza di chi rigenera.

## Cosa contiene lo schema

29 tabelle, 8 tipi enumerati. Tracciabilità tabella per tabella verso i requisiti
in [`database-schema.md`](../../docs/architecture/database-schema.md) §3.

Tre punti che conviene conoscere prima di toccare qualcosa:

- **`contents.search_vector` è una colonna generata**, in italiano, con pesi
  A/B/C su titolo, sommario e testo. Non si scrive: non può divergere.
- **I redirect sono dati** (`redirects`), non configurazione del reverse proxy:
  è ciò che li rende modificabili dal CMS (ADR-003 §3.5, requisito RC-07).
- **`form_submissions` e `legacy_email_log` contengono dati personali di terzi.**
  Nessuna loro riga compare in documentazione, log, screenshot, fixture o Git
  (DR-010). La verifica legale MI-06 è obbligatoria prima della produzione.

## Convenzione dei nomi

Inglese, `snake_case`, per decisione **DR-036**. Drizzle la applica per
convenzione (`casing: 'snake_case'`), non annotazione per annotazione: in
TypeScript le proprietà restano in `camelCase` e nessuno mantiene due nomi a mano.
