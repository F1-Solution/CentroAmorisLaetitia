# AUDIT — Fase 1C

Eseguito il 2026-09-14, **prima** di dichiarare la fase completa, come impone
`CLAUDE.md` («Prima di qualunque completamento di milestone o fase, eseguire prima
il passo di audit e validazione»).

Verifica gli undici criteri di uscita di [`CONTEXT.md`](CONTEXT.md) §7. Ogni
criterio è stato **eseguito**: dove c'è un numero, quel numero è stato misurato.

---

## 1. Esito

| | |
|---|---|
| Criteri di uscita verificati | **11 su 11** |
| Difetti trovati e **corretti** durante la fase | **11** |
| Difetti trovati e **non** corretti, dichiarati qui | **1** |
| Errori della fase precedente scoperti e corretti | **2** |

## 2. I criteri di uscita, uno per uno

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1 | `pnpm install` funziona da zero; lockfile versionato; versioni fissate | `pnpm install --frozen-lockfile` in locale e installazione pulita in CI, da repository appena clonato | ✅ |
| 2 | I servizi si avviano, diventano sani, i due bucket esistono | `docker compose ps` riporta `db` e `objects` **healthy**; `mc ls` elenca `media-private` e `media-public` | ✅ |
| 3 | La migrazione applica **32 tabelle** e non diverge dalla forma canonica | due database veri costruiti e confrontati sul catalogo di PostgreSQL: 32 tabelle, 275 colonne, 21 valori enumerati, 107 vincoli, 79 indici, **tutti identici** | ✅ |
| 4 | `live` risponde sempre; `ready` risponde `503` senza database | database **fermato davvero** con `docker compose stop db`: `live` 200, `ready` 503; riacceso: `ready` 200 | ✅ |
| 5 | Senza una variabile obbligatoria il servizio non parte e dice quale | avviato senza `DATABASE_URL`: esce con codice `78` e nomina la variabile | ✅ |
| 6 | Nessun service worker né manifest sul sito; `noindex` sull'area amministrativa; la regola di lint fallisce davvero | 0 registrazioni di service worker nel pacchetto costruito, `/manifest.webmanifest`, `/manifest.json` e `/sw.js` rispondono 404, `X-Robots-Tag: noindex, nofollow, noarchive` presente; un file di prova che importa da `@amoris/ui` **fa fallire il lint**, poi rimosso | ✅ |
| 7 | `lint`, `typecheck`, `build`, `test` passano | 7 pacchetti per lint e tipi, 3 build, 4 suite di test: tutti verdi, in locale e in CI | ✅ |
| 8 | Almeno un test unitario, uno di integrazione e uno end-to-end | **24 test**: 9 unitari (schemi condivisi, configurazione), 1 di componente, 8 di integrazione su PostgreSQL vero, 6 end-to-end su Chromium | ✅ |
| 9 | La CI esegue gli stessi comandi della macchina di sviluppo | esecuzione `34873600522` su GitHub Actions: **verde alla prima corsa**, compresi il confronto dello schema e le prove end-to-end | ✅ |
| 10 | Nessun dato reale, nessun segreto nel repository | ricerca su tutti i file tracciati: nessun IBAN, nessun codice fiscale, `.env` non tracciato. **Un indirizzo email istituzionale trovato**: vedi §5 | ⚠️ vedi §5 |
| 11 | `PROGRESS.md` ha una riga per wave | 8 righe `PHASE:1C` su 8 wave | ✅ |

## 3. Gli undici difetti trovati e corretti

Elencati perché un audit che non trova nulla non è un audit. I primi quattro sono i
significativi; gli altri sono attrito, ma andavano comunque risolti.

| # | Difetto | Come è stato trovato | Correzione |
|---|---|---|---|
| 1 | **Il `.gitignore` ereditato escludeva l'intera cartella `packages/`.** Era quello di Visual Studio, con `**/[Pp]ackages/*` | previsto come rischio RC-01 e verificato con `git check-ignore` | riscritto per un monorepo Node; verificato che nessun percorso del monorepo sia più escluso |
| 2 | **drizzle-kit tronca le espressioni `CHECK` al primo punto e virgola.** I vincoli `contents_path_shape` e `terms_path_shape` contengono un `;` dentro la classe di caratteri dell'espressione regolare: la migrazione generata era **SQL non valido** e falliva all'applicazione | la migrazione non si applicava | espressioni riportate per intero nella migrazione; il difetto è documentato in `packages/db/README.md` e `pnpm db:verify` lo intercetta se torna |
| 3 | **Gli indici discendenti divergevano dalla forma canonica.** Drizzle genera `DESC NULLS LAST`, mentre in PostgreSQL `DESC` implica `NULLS FIRST`: cinque indici ordinavano i valori nulli in modo diverso dallo schema approvato | dal confronto automatico dei due database | `.nullsFirst()` esplicito sui cinque indici; confronto di nuovo identico |
| 4 | **Le immagini MinIO non sono più pubbliche su Docker Hub.** `docker compose up` falliva con «pull access denied» | all'avvio dello stack | immagini prese da `quay.io`, con la versione fissata |
| 5 | **pnpm 11 interrompe ogni comando** quando una dipendenza annidata ha uno script di installazione non approvato (esbuild, sotto `tsx` e `drizzle-kit`) | `pnpm lint` falliva senza mai eseguire il lint | script dichiarato ignorato di proposito in `pnpm-workspace.yaml`, con il motivo scritto |
| 6 | **`@amoris/ui` non poteva eseguire il lint**: il binario di ESLint arrivava da una dipendenza di un altro pacchetto, e con il collegamento isolato non era raggiungibile | `pnpm lint` | `eslint` dichiarato dove viene usato |
| 7 | **`@types/node` mancante** dove il TypeScript condiviso lo richiede | `pnpm typecheck` | dichiarato nei pacchetti che lo usano |
| 8 | **`apps/api` importava direttamente l'ORM**, contro ADR-008 §3.3 regola 4, che vuole l'accesso al database in un pacchetto solo | `pnpm typecheck` ha segnalato la dipendenza non dichiarata, e la dipendenza non andava dichiarata: andava rimossa | la verifica di raggiungibilità è diventata `ping()` dentro `@amoris/db` |
| 9 | **Il messaggio di configurazione mancante era in inglese**, contro la regola di lingua del progetto | prova di avvio senza `DATABASE_URL` | messaggio riscritto in italiano |
| 10 | **Opzione di Fastify deprecata** (`disableRequestLogging`), che sarebbe stata rimossa in Fastify 6 | avviso durante i test | rimossa; il silenzio nei test si ottiene dal livello di log |
| 11 | **Prettier voleva riformattare 55 documenti già approvati** della Fase 1B | `pnpm format:check` | la documentazione è esclusa dalla formattazione automatica: riformattarla produrrebbe un diff enorme su documenti validati, e il formato non è un difetto |

## 4. I due errori della Fase 1B, scoperti qui

Il confronto automatico dello schema ha contato le tabelle sul database vero,
invece che sull'elenco scritto a mano. Il conteggio non tornava.

| Voce | Dichiarato in 1B | Misurato in 1C |
|---|---|---|
| Tabelle dello schema | 29 | **32** |
| Tabelle con una riga propria nella tracciabilità | «29 su 29» | 31 su 32 — mancava `document_terms` |

Corretti in `database-schema.md`, in `ROADMAP.md` e con un'errata in
[`../1B/AUDIT.md`](../1B/AUDIT.md) §7. Nessuno dei due incide sullo schema, che è
corretto e si applica: incidono sul fatto che un controllo dichiarato superato era
stato eseguito sull'elenco e non sul database. Da ora `pnpm db:verify` lo esegue sul
database, e gira in CI.

## 5. Il difetto dichiarato e **non** corretto

Nel file `docs/migration/seo-rendered-baseline.csv`, prodotto nella wave 1B-W0,
compare **un indirizzo email istituzionale del Centro**. Non è stato rimosso, e il
motivo va scritto invece che sottinteso:

- è l'indirizzo della segreteria, **già pubblicato sul sito**, e appartiene
  all'organizzazione, non a una persona: non rientra fra i dati che `CLAUDE.md`
  vieta (segreti, token, password, IBAN, dati sanitari, anagrafiche complete);
- il file è la **baseline misurata** dei metadati resi, e serve al confronto di
  parità della Fase 1E: l'indirizzo compare dentro una descrizione SEO, e
  oscurarlo renderebbe il confronto impossibile proprio sulle pagine di contatto.

Va però detto che il controllo 14 dell'audit di Fase 1B dichiarava «nessun indirizzo
email reale nei documenti nuovi». L'affermazione era **troppo ampia**: valeva per i
documenti, non per i dati misurati. La formulazione corretta è quella di questo
paragrafo.

Se preferisci che l'indirizzo sparisca comunque dal repository, si può fare, ma
comporta rifare la baseline con un segnaposto e tenerne una copia fuori da Git:
dimmelo e lo faccio.

## 6. Dipendenze installate, e che cosa le autorizza

`PLAN.md` impone che nessun pacchetto entri senza una riga. Queste sono le
dipendenze dirette, comprese quelle **non previste** nel piano, che vanno
dichiarate qui.

| Pacchetto | Dove | Autorizzato da |
|---|---|---|
| `typescript`, `@types/node` | ovunque | DR-004 |
| `turbo` | radice | DR-003 |
| `prettier`, `eslint` | ovunque | `CLAUDE.md` §Stack |
| `fastify`, `@fastify/cors`, `@fastify/swagger`, `fastify-type-provider-zod`, `zod` | `apps/api` | ADR-001 §5 |
| `drizzle-orm`, `drizzle-kit`, `postgres` | `packages/db` | ADR-002 §5 |
| `next`, `react`, `react-dom` | `apps/web`, `apps/admin` | DR-001 |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test` | test | DR-007 |
| **Non previste nel piano, aggiunte con motivo** | | |
| `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks`, `globals` | `packages/config` | sono i plugin senza i quali ESLint non conosce TypeScript né React. Sono l'attuazione di «ESLint» della direttiva, non una scelta in più |
| `@types/react`, `@types/react-dom` | applicazioni Next | tipi di React, richiesti da TypeScript strict |
| `tsx` | `packages/db`, `apps/api` | esegue TypeScript senza un passo di compilazione per gli script di migrazione e lo sviluppo. Non entra in produzione |
| `@vitejs/plugin-react`, `jsdom` | `apps/web` | React Testing Library ha bisogno di un ambiente DOM e della trasformazione JSX. Richiesti da DR-007, non aggiuntivi |

Nessuna dipendenza a pagamento, nessuna non manutenuta, nessun plugin installato di
iniziativa oltre a questi.

**Non** installate di proposito, benché previste da ADR-001 §5: `@fastify/cookie`,
`@fastify/rate-limit`, `@fastify/multipart`. Servono a sessioni, form e media, che
nascono in Fase 1D: installarle adesso significherebbe tenere dipendenze inutilizzate.

## 7. Che cosa questo audit **non** dimostra

- **Non fa avanzare il gate di Fase 1 di una sola delle quindici condizioni.** Restano
  soddisfatte le stesse tre della fase precedente, che riguardano la conoscenza della
  sorgente, non il prodotto.
- Non dimostra che il sito nuovo somiglierà a quello vecchio: la parità è la Fase 1E.
- Non dimostra che i contenuti si possono importare: lo dimostra la Fase 1D con i
  conteggi.
- Non dimostra che il CMS sia usabile da un redattore: lo dimostra la Fase 1G.
- Non dimostra alcuna conformità GDPR o fiscale, che richiede validazione umana (MI-06).
- **Non dimostra che il progetto sia sicuro.** La revisione di sicurezza è prevista in
  Fase 1F: qui non c'è autenticazione, non c'è sessione, non c'è un solo dato reale.

## 8. Stato del gate dopo questa fase

**NON SUPERATO**, e la Fase 1C non poteva superarlo: costruisce l'impalcatura, non il
prodotto. Ciò che aggiunge è la possibilità di **verificare** — schema, stato del
servizio, regole strutturali — con comandi che girano da soli a ogni modifica.
