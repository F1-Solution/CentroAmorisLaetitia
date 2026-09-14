# CONTEXT — Fase 1D · Importazione e CMS minimo

Creato il 2026-09-15, nella wave `1D-W0`. Prerequisito richiesto da `CLAUDE.md`
§«GSD Workflow Prerequisites»: la fase si apre con una wave di sola pianificazione,
come la 1C.

Sblocco della fase: **DR-044 e DR-045** del 2026-09-15 chiudono HO-004, che era
l'ultima decisione bloccante della Fase 1B.

---

## 1. Perimetro

La Fase 1D porta **i dati dentro il sistema nuovo** e costruisce **l'interfaccia
minima per modificarli**. Alla sua fine il database contiene i contenuti del sito
reale, i file stanno nello storage a oggetti, e una persona autenticata può
modificare pagine, articoli, media, menu, SEO, redirect e impostazioni.

Non contiene ancora una sola pagina del sito pubblico: quella è la Fase 1E.

Dentro il perimetro:

- `packages/blocks`: modello Zod dei 14 tipi di blocco (ADR-005 §3.2),
  sanificazione a elenco chiuso (ADR-005 §3.5), serializzatore deterministico
  blocchi → HTML (ADR-005 §3.6), componenti di resa React (ADR-006 §3.3);
- `apps/importer`: il programma a riga di comando descritto da
  `docs/migration/importer-spec.md`, con le 17 fasi, il preflight, l'idempotenza,
  il rollback e il rapporto;
- i convertitori Gutenberg → blocchi, Divi → blocchi, HTML nudo → `rich_text`
  (`docs/migration/divi-shortcode-strategy.md`);
- `apps/api`: rotte di lettura e scrittura per contenuti, media, menu, SEO,
  redirect, impostazioni e tassonomie; sessioni e permessi secondo ADR-007;
  OpenAPI aggiornata;
- `packages/ui`: attuazione del sistema di design scelto con DR-044 e DR-048;
- `apps/admin`: guscio con navigazione per aree (DR-045), accesso, elenco e
  modifica dei contenuti, editor dell'albero dei blocchi, TipTap dentro
  `rich_text` (ADR-006), editor del blocco di riserva, anteprima con i componenti
  di `packages/blocks`;
- l'esecuzione reale dell'import in locale, con rapporto di completezza.

Fuori dal perimetro, e non si comincia:

- **il sito pubblico**: nessuna rotta, nessun template, nessun design token estratto
  dal CSS reso. È la Fase 1E (`divi-shortcode-strategy.md` §6);
- **la resa pubblica dei form e l'endpoint di invio** `POST /forms/{slug}/submissions`
  (ADR-010 §4.3): i form si **importano** come dati, non si **rendono**. Senza sito
  pubblico non c'è dove renderli;
- **l'invio di email**: `CLAUDE.md` lo colloca fra le azioni a conferma obbligatoria
  e ADR-010 §4.5 lo prova in Fase 1F. In 1D si importano le 39 notifiche come dati,
  e non si installa alcuna libreria di invio;
- **il trattamento del campo `payment-single`**: DR-039 lo risolve con un rimando
  configurabile per form, che vive nella resa pubblica, cioè in 1E;
- il confronto visivo, la parità, gli screenshot: Fase 1E;
- il collaudo redazionale con un redattore vero: Fase 1G;
- il recupero password, gli inviti, il secondo fattore: ADR-007 §3.1 controllo 11 li
  mette fuori perimetro;
- **qualunque cosa la fase gestionale contenga**: il gate lo vieta, e DR-045 non
  autorizza a costruire le aree Segreteria, Tesoreria, Formazione, Consulenza. In
  Fase 1 esistono due sole aree, **Redazione** e **Impostazioni**.

## 2. Stato in ingresso

| Voce | Valore |
|---|---|
| Fase 1A | approvata il 2026-09-14 (DR-031) |
| Fase 1B | approvata il 2026-09-14, audit in `.planning/phases/1B/AUDIT.md` |
| Fase 1C | completata il 2026-09-14, audit superato, 11 criteri su 11 |
| Dieci ADR | **approvate** il 2026-09-14 (DR-038) |
| Decisioni di design | **DR-044…DR-048**, 2026-09-15, chiudono HO-004 |
| Decisioni registrate | DR-001 … DR-049 |
| Gate assoluto di Fase 1 | **NON superato**. La 1D non lo supera; ne soddisfa alcune condizioni |
| Decisioni aperte che toccano questa fase | **la lettura delle aree** (DR-045 + DR-047), aperta nel registro con termine «prima della wave 1D-W8» |

Stato reale del repository, verificato e non assunto:

| Cartella | Stato |
|---|---|
| `apps/api` | esiste — Fastify, configurazione validata, `/health/live`, `/health/ready`, OpenAPI. Quattro file sorgente |
| `apps/web`, `apps/admin` | esistono — due applicazioni Next.js allo stato minimo |
| `packages/db` | esiste — schema Drizzle delle 32 tabelle, migrazione iniziale, `pnpm db:verify` |
| `packages/contracts` | esiste — schemi condivisi: `health`, `errors` |
| `packages/config` | esiste — TypeScript, ESLint, Prettier condivisi |
| `packages/ui` | esiste **vuoto**: solo `src/index.ts`, creato in 1C per rendere verificabile la regola di lint di ADR-008 §3.3 regola 3 |
| `packages/blocks` | **non esiste**: nasce in `1D-W1` |
| `apps/importer` | **non esiste**: nasce in `1D-W2` |

## 3. Fatti che vincolano questa fase

| # | Fatto | Fonte | Conseguenza |
|---|---|---|---|
| F-01 | I contenuti sono **108**: 57 Gutenberg, 47 Divi, 4 HTML nudo. **Nessuno misto** | ADR-005 §1; `divi-shortcode-strategy.md` §1 | La famiglia si sceglie per contenuto, senza riconoscere confini interni fra due sintassi |
| F-02 | L'insieme dei blocchi è **chiuso a 14 tipi** e non si allarga in Fase 1 | ADR-005 §3.2 | Aggiungere un tipo richiede una nota nella ADR, cioè una decisione dell'utente |
| F-03 | Il corpo è un documento JSON in `jsonb`, validato da Zod **in scrittura e in lettura** | ADR-005 §3.1 | La validazione non è un controllo dell'editor: è un confine del sistema |
| F-04 | `content_html` è una **cache** rigenerata a ogni salvataggio, mai modificata a mano | ADR-005 §3.6 | Serve un serializzatore deterministico, altrimenti il confronto fra due versioni è rumore |
| F-05 | Aprire un contenuto e salvarlo **senza modifiche** non deve cambiare né i blocchi né l'HTML reso | ADR-005 §7; ADR-006 §7; criterio 1D-36 | È il criterio discriminante di tutta la fase: sanificazione idempotente e serializzazione totale |
| F-06 | I blocchi di riserva `html` non superano il **10% dei blocchi non contenitori** e **15 contenuti su 108** | ADR-005 §3.4 | La soglia si misura e si stampa nel rapporto, non si stima |
| F-07 | Gli attributi Divi senza corrispondente diventano **classi dichiarate**, mai stile in linea generato | ADR-005 §3.3 regola 2 | Verificabile: `content_html` non contiene dichiarazioni CSS in linea. Vedi §8, punto aperto 1 |
| F-08 | L'elenco degli elementi e attributi ammessi in `rich_text` è chiuso e deriva dalla **misura** della sorgente, non da una lista generica di sicurezza | ADR-005 §3.5 | `style` in linea, `script`, `iframe`, `form`, `data-*` e i gestori `on*` sono esclusi |
| F-09 | `h1` non è ammesso in `rich_text`: il titolo appartiene al template | ADR-005 §3.5 | L'editor lo rifiuta; DR-040 chiede di **restituire** un `h1` a 29 pagine, e lo farà il template in 1E |
| F-10 | Il percorso pubblico dei media è `/media/<anno>/<mese>/<nome>` e i nomi **non si normalizzano** | ADR-004 §3.1 | Qualunque ripulitura del nome farebbe divergere il `srcset` |
| F-11 | Tutti i **1.546** file si importano byte per byte, varianti comprese. **Non si rigenerano** | ADR-004 §3.2 | Nessuna libreria di elaborazione immagini entra in questa fase |
| F-12 | La riscrittura dei riferimenti è **una regola sola in un punto solo**, ed è una **fase separata** dell'import | ADR-004 §3.3; `importer-spec.md` §4.1 | Il convertitore dei blocchi non riscrive nulla: se lo facesse, un riferimento sfuggito sarebbe irrintracciabile |
| F-13 | Due bucket, `media-public` e `media-private`. L'applicazione **serve i file in stream**, non reindirizza allo storage | ADR-004 §3.6 | I 4 documenti riservati non sono raggiungibili nemmeno indovinando il nome |
| F-14 | L'esecuzione senza argomenti **non scrive nulla**; `apply` senza `--confirm` non scrive | `importer-spec.md` §2 principio 2, §3 | La scrittura non parte per inerzia |
| F-15 | Una chiave meta non classificata **fa fallire** l'import | `importer-spec.md` §5 controllo 3; `wp-to-postgres-mapping.md` §10 punto 2 | È l'unico controllo che intercetta un dato che si sta perdendo in silenzio |
| F-16 | Ogni fase è una transazione; l'errore su un **elemento** non ferma la fase | `importer-spec.md` §7 | Con 108 contenuti serve l'elenco completo di ciò che non funziona, non il primo problema |
| F-17 | Se un conteggio atteso non coincide, l'esito **non è `success`**, anche senza errori | `importer-spec.md` §8.2 | I numeri attesi stanno in `database-schema.md` §6 e vanno scritti nel codice |
| F-18 | Il rapporto **non contiene dati personali**: conteggi, identificatori, percorsi | `importer-spec.md` §8.3 | Deve essere sicuro da incollare |
| F-19 | Le compilazioni dei form **non si aggiornano mai**: solo inserimento se assenti | `importer-spec.md` §6.2 | Sono un fatto storico, non uno stato |
| F-20 | Un contenuto modificato nel CMS **dopo** l'ultima esecuzione riuscita non viene sovrascritto | `importer-spec.md` §6.3 | Senza questa protezione il secondo import distrugge lavoro redazionale |
| F-21 | Le sessioni sono **opache**, il token si conserva come digest, e i 12 controlli di ADR-007 §3.1 **non sono facoltativi** | ADR-007 §3.1 | Ognuno ha un test in questa fase. ADR-007 §8 li assegnava alla Fase 1C, che però non ha costruito l'autenticazione: l'obbligo cade qui |
| F-22 | Se la logica di autenticazione supera le **300 righe**, si adotta Better Auth «senza discutere» | ADR-007 §6 contromisura 3 | È una soglia da misurare in `1D-W6`, non da stimare |
| F-23 | Le autorizzazioni si esprimono come **permessi**, mai confrontando il nome del ruolo | ADR-007 §3.2 | In Fase 1: `content.read`, `content.write`, `content.publish`, `media.write`, `settings.write`, `submissions.read` |
| F-24 | **DR-047**: tutti i ruoli sono attivi insieme, unione dei permessi, **nessuna commutazione di ruolo** | DR-047 | L'area amministrativa **non** ha un commutatore di ruolo. Vedi §8, punto aperto 2 |
| F-25 | **DR-044**: UI «Scrivania». **DR-048**: carattere d'interfaccia distinto da quello del sito pubblico | DR-044, DR-048 | Inter come carattere d'interfaccia, come propone `ui-proposals.md` proposta 1 §3; Open Sans resta al sito pubblico |
| F-26 | **DR-045**: UX «Le aree di responsabilità». In Fase 1 le aree sono **due**: Redazione e Impostazioni | DR-045; `ux-proposals.md` §4.2 versione 1 | Le altre quattro aree non si costruiscono né si abbozzano: il gate lo vieta |
| F-27 | `apps/web` **non importa** da `packages/ui`; `packages/blocks` è invece usato da **entrambe** le applicazioni Next | ADR-008 §3.1, §3.3 regola 3 | La regola di lint deve continuare a colpire solo `@amoris/ui`, e non `@amoris/blocks` |
| F-28 | Nessuna applicazione Next parla al database. L'unica eccezione è `apps/importer` | ADR-008 §3.3 regola 4 e §3.4 | L'importer usa `@amoris/db`, l'area amministrativa usa `apps/api` |
| F-29 | Il dump è un solo file SQL di **11.559.721 byte**, 16.892 righe, **53** `CREATE TABLE`, **169** `INSERT INTO`, riga più lunga **1.738.438** caratteri | misurato il 2026-09-15 su `source-private/BackupDB-2026-09-13/Sql1138799_1.sql` | Gli `INSERT` sono estesi e multi-riga: un lettore riga per riga non basta, serve un lettore per istruzione |
| F-30 | L'intestazione del dump dichiara **BackWPup 5.7.6**, prefisso `wp_`, `SET NAMES utf8mb4`. 52 tabelle `MyISAM`, 1 `InnoDB`; 32 `CHARSET=utf8`, 21 `utf8mb4` | stessa misura | La versione del server MySQL **non è dichiarata** nel file: non la si assume |
| F-31 | Valori serializzati da PHP sono presenti in `_wp_attachment_metadata`, `wp_capabilities`, `aioseo_options`, `et_divi` e nei parametri del carosello | `wp-to-postgres-mapping.md` §3.4, §4.5, §5, §8 | Serve un lettore del formato serializzato di PHP, con lunghezze in **byte** e non in caratteri |
| F-32 | DR-040 chiede di correggere i metadati non visibili e di restituire il titolo principale alle 29 pagine che non ce l'hanno | DR-040 | In 1D si importano i **template** SEO corretti; la resa del titolo è 1E |
| F-33 | DR-010 vieta i dati reali in test, fixture, log, screenshot, documentazione e Git. I test su dati reali girano **solo in locale** | DR-010; `importer-spec.md` §11 | La CI non vede mai la sorgente: tutte le fixture di questa fase sono **sintetiche** |

## 4. Vincoli non negoziabili

- **Nessun dato reale** in fixture, test, seed, esempi, log, rapporti, documentazione,
  commit o messaggi. I 108 contenuti reali, le 425 compilazioni e i 187 destinatari
  di `legacy_email_log` restano nel database locale e non escono da lì (DR-010,
  `database-schema.md` §7).
- **`source-private/` non si tocca mai**, in nessuna fase dell'import (DR-011,
  `importer-spec.md` §2 principio 3). Nessuna scrittura, nessuna rinomina, nessuna
  estrazione dei backup annidati.
- **Nessuna dipendenza fuori dalle ADR.** Ogni pacchetto installato ha una riga in
  `PLAN.md` §«Dipendenze previste»; le aggiunte non previste si dichiarano
  nell'audit, come è stato fatto in 1C.
- **Nessuna fase gestionale**, nemmeno abbozzata: né schermate, né tabelle, né rotte,
  né voci di menu «in preparazione».
- **Nessun invio di email** e **nessun import verso un database che non sia quello
  locale**.
- **Nessuna resa del sito pubblico**: se nasce una rotta pubblica, la 1E parte da un
  lavoro non pianificato e la parità si misura su qualcosa che nessuno ha deciso.
- Documentazione e commenti in italiano; nomi di codice in inglese (DR-036, DR-H04).

## 5. Rischi noti in ingresso

| # | Rischio | Mitigazione prevista |
|---|---|---|
| RD-01 | **Il convertitore Divi è la componente più delicata della fase** (ADR-005 §5). Una conversione incompleta si manifesta come testo perso, il danno peggiore di una migrazione | Ogni shortcode ha una destinazione dichiarata (`divi-shortcode-strategy.md` §2); ogni attributo è conservato, scartato o **sconosciuto**, e lo sconosciuto produce una riga in `import_issues`; blocco di riserva come rete, con soglia misurata |
| RD-02 | Il lettore del dump può interpretare male una sequenza di escape di MySQL e **perdere o corrompere righe in silenzio** | Conteggio per tabella confrontato con i volumi già misurati in 1A e 1B (`database-schema.md` §6, `wp-to-postgres-mapping.md` §1.1); prova esaustiva del tokenizzatore su dump **sintetici** che contengono tutte le sequenze di escape; se i conteggi non tornano, la strada alternativa è dichiarata in `IMPORTER-DESIGN.md` §3 e diventa una decisione dell'utente |
| RD-03 | **L'andata e ritorno fallisce** perché TipTap normalizza il markup a modo proprio: riscrive `b` in `strong`, riordina attributi, sposta spazi | Schema di ProseMirror dichiarato elemento per elemento (ADR-006 §3.1); sanificazione **idempotente** provata come proprietà; serializzazione con ordine totale degli attributi (`BLOCK-MODEL.md` §5); il blocco di riserva **non** passa dall'editor di testo ricco (ADR-006 §3.4) |
| RD-04 | La **soglia del blocco di riserva** viene superata e la conversione va rivista prima della 1E | La soglia si misura a ogni esecuzione, anche in `plan`. Se supera, l'esito non è `success`. Si scopre in `1D-W3` su fixture e in `1D-W11` sul vero, non alla fine della 1E |
| RD-05 | Una fixture con dati reali entra in Git o in CI | Le fixture reali stanno in una cartella esclusa da Git e i test che le usano sono in una suite separata, che **non** è nel comando della CI. Verificato nell'audit con una ricerca sui file tracciati, come in 1C |
| RD-06 | Quattro elementi della sorgente sono **dichiarati non noti** e vanno esaminati in questa fase: `[hash]` (2), `[UID]` (4), `footnotes` (183 righe), `custom_css` (1) | `wp-to-postgres-mapping.md` §11 li elenca come punti aperti. Si guarda l'HTML reso della pagina che li contiene e si decide con quel dato, non alla cieca; l'esito si registra in `wp-to-postgres-mapping.md` |
| RD-07 | Il numero **esatto** di file attesi in `uploads/` al netto delle sei cartelle escluse **non è scritto in alcun documento**: si conosce il totale 1.546 e la stima «circa 1.376» delle varianti | Il preflight controllo 7 richiede un numero atteso: si **misura** in `1D-W2` e lo si scrive in `IMPORTER-DESIGN.md`, invece di assumerlo. Finché non è misurato il controllo non è scrivibile |
| RD-08 | **DR-045 e DR-047 tirano in direzioni opposte**: la UX B nasce sull'idea di riconfigurare l'ambiente scegliendo la veste, DR-047 esclude la commutazione | La lettura proposta è nel §8 punto 2 ed è **già registrata come aperta** nel registro delle decisioni, con termine «prima della wave 1D-W8». Non si dà per approvata |
| RD-09 | L'attrito di Windows, pnpm 11 e degli script di installazione ha prodotto **5 difetti su 11** in Fase 1C | Stessa disciplina: comandi solo via script di pacchetto, nessun percorso assoluto, ogni script di installazione non approvato dichiarato in `pnpm-workspace.yaml` con il motivo |
| RD-10 | La regola di lint di ADR-008 §3.3 regola 3 può essere **allentata per sbaglio** quando `packages/blocks` comincia a essere importato dal sito | La regola colpisce `@amoris/ui` e **non** `@amoris/blocks`. Un test di lint negativo — un file di prova che importa da `@amoris/ui` e fa fallire il lint — si riesegue nell'audit, come in 1C |
| RD-11 | L'autenticazione è **codice di sicurezza scritto in casa**, la scelta a rischio più alto di tutte le ADR | ADR-007 §6: i 12 controlli sono una lista di verifica con un test ciascuno; il conteggio delle righe si misura in `1D-W6`; la security review resta alla Fase 1F e qui non si dichiara alcuna sicurezza |
| RD-12 | L'import reale di `1D-W11` scrive **dati personali** nel database locale: 425 compilazioni, 187 destinatari, 1 account | Nessuna riga esce dal database: né rapporto, né log, né screenshot, né audit. Il rapporto contiene solo conteggi (F-18). MI-06 resta aperta e nessuna conformità si dichiara |

## 6. Output attesi

Elencati in [`PLAN.md`](PLAN.md), wave per wave. Le decisioni di dettaglio che
rendono eseguibili le wave `1D-W1` e `1D-W3` stanno in
[`BLOCK-MODEL.md`](BLOCK-MODEL.md); quelle che rendono eseguibili le wave `1D-W2`,
`1D-W4` e `1D-W5` stanno in [`IMPORTER-DESIGN.md`](IMPORTER-DESIGN.md).

## 7. Criteri di uscita

Una fase non si dichiara conclusa per affermazione. Ognuno di questi criteri viene
**eseguito** nella wave `1D-W12` e il suo esito registrato in `AUDIT.md`. Dove c'è
un numero, quel numero va misurato.

I criteri 1–8 sono quelli di `importer-spec.md` §14, riportati senza modifiche di
sostanza. I criteri 9–12 vengono da ADR-005 §3.4 e §7. I criteri 13–16 vengono da
ADR-004 §7. I restanti attuano `acceptance-criteria.md` §3.

**Importer — da `importer-spec.md` §14**

1. `plan` **non scrive nulla**, dimostrato confrontando il database prima e dopo.
2. `apply` due volte di fila produce **lo stesso stato**, confrontato strutturalmente
   escluse le marche temporali.
3. Tutti i conteggi attesi di `database-schema.md` §6 **coincidono**: 108 contenuti,
   170 media, circa 1.376 varianti, 3 termini, 64 voci di menu, 180 redirect, 25 form,
   39 notifiche, 425 compilazioni, 8 documenti, 12 slide, 1 utente, 2 righe
   `content_seo`.
4. **Zero** riferimenti `wp-content/uploads` rimasti in `contents.blocks`,
   `contents.content_html`, `slider_slides` e `settings`.
5. **Zero** righe di gravità `error` in `import_issues`.
6. Le soglie sui blocchi di riserva di ADR-005 §3.4 sono rispettate: **≤ 10%** dei
   blocchi non contenitori e **≤ 15** contenuti su 108.
7. Il rapporto **non contiene alcun dato personale**: verificato ispezionando il
   rapporto, non affermato.
8. `rollback --run <id>` riporta il database allo stato precedente, **dimostrato**.

**Modello a blocchi — da ADR-005 e ADR-006**

9. Ognuno dei 108 contenuti produce un documento **valido** secondo lo schema Zod:
   108 su 108, contato.
10. **Zero** occorrenze di `[et_pb_` e di `<!-- wp:` nel testo convertito
    (`divi-shortcode-strategy.md` §7 controllo 3).
11. **Andata e ritorno**: per tutti e 108 i contenuti, `parse → serializza`
    nell'editor senza modifiche restituisce blocchi e `content_html` **identici**.
    Eseguito in locale su dati reali; l'esito è un numero, mai un contenuto.
12. La sanificazione è **idempotente**: `sanifica(sanifica(x)) === sanifica(x)` su
    una batteria di casi sintetici che copre l'intero elenco chiuso di ADR-005 §3.5,
    compresi gli elementi e gli attributi **non** ammessi.

**Media e URL — da ADR-004 §7**

13. Il numero di oggetti in `media-public` è pari ai file della sorgente **meno** le
    sei cartelle escluse di ADR-004 §3.2, con il numero atteso misurato in `1D-W2` e
    scritto, non assunto (vedi RD-07).
14. Il **checksum** di ogni file caricato coincide con quello del file sorgente: 100%.
15. I **4 documenti riservati** non sono raggiungibili da un anonimo nemmeno
    conoscendo il nome del file: prova **negativa** eseguita.
16. Un campione di URL storici `/wp-content/uploads/...` risponde **301** alla
    destinazione `/media/...` attesa, e i **6 slug storici** di
    `wp-to-postgres-mapping.md` §3.3 rispondono 301 al contenuto attuale.

**API e sessioni — da ADR-007 e ADR-001**

17. I **12 controlli** di ADR-007 §3.1 sono attuati e **ognuno ha un test che passa**.
    Il controllo 11, il recupero password, è fuori perimetro e questo va scritto.
18. La logica di autenticazione è stata **contata in righe** e il numero è riportato
    nell'audit, con l'esito rispetto alla soglia di 300 righe di ADR-007 §6.
19. `GET /openapi.json` è generata dagli schemi, e un test **fallisce** se la
    specifica cambia senza che la modifica sia dichiarata (ADR-001 §3 punto 4).
20. Ogni richiesta che modifica dati produce **una riga di audit log**, scritta da un
    hook unico (ADR-001 §3 punto 3; criterio 1D-37).

**CMS — da `acceptance-criteria.md` §3.4**

21. I criteri **1D-28…1D-35** sono eseguiti uno per uno nell'area amministrativa
    avviata: creare, modificare, pubblicare e ritirare una pagina e un articolo;
    modificare testo e immagini dentro i blocchi; aggiungere, spostare ed eliminare
    blocchi dentro una colonna; caricare, sostituire ed eliminare un media; modificare
    il menu; modificare SEO e template; creare, modificare e disattivare un redirect;
    modificare le impostazioni globali.
22. L'**anteprima** dell'area amministrativa usa gli stessi componenti di resa di
    `packages/blocks` del sito pubblico: verificato dal grafo delle importazioni, non
    a occhio (ADR-006 §3.3).
23. Il blocco di riserva si modifica in un'area di testo con evidenziazione della
    sintassi, **non** con l'editor di testo ricco, e mostra l'avviso (ADR-006 §3.4).
24. L'area amministrativa **non ha un commutatore di ruolo**, e i permessi di una
    persona sono l'**unione** di quelli dei suoi ruoli (DR-047).

**Struttura e igiene**

25. `apps/web` non importa da `packages/ui`: la regola di lint **fallisce davvero**
    quando qualcuno lo scrive, riverificata con un file di prova poi rimosso.
26. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` passano, in locale e in CI.
27. Nessun dato reale e nessun segreto fra i file **tracciati** da Git: verificato con
    una ricerca, non a memoria. Le fixture reali non sono tracciate, e la CI non le usa.
28. `PROGRESS.md` ha una riga per ogni wave completata di questa fase.

## 8. Assunzioni vietate e decisioni richieste

Tre punti non si risolvono in silenzio.

### 1. Gli spazi di Divi e il divieto di stile in linea

ADR-005 §3.3 regola 2 dice: classi dichiarate, **mai stile in linea generato
automaticamente**. Ma `custom_padding` di Divi contiene valori arbitrari per modulo
(`divi-shortcode-strategy.md` §3.1), e valori arbitrari non si esprimono con un
vocabolario chiuso di classi senza perdere fedeltà.

Le tre strade sono in `BLOCK-MODEL.md` §7. La lettura che propongo è la terza: il
contenitore del blocco può portare **solo proprietà personalizzate CSS**
(`--blk-pad-top: 54px`), che sono **valori**, non regole; le regole restano nel
foglio di stile. Resta formalmente un attributo `style`, quindi va detto e non
nascosto.

**Questa decisione non blocca la `1D-W1`**: il modello conserva comunque il valore in
una proprietà tipizzata, e come venga dipinto è lavoro della Fase 1E, dove il CSS si
estrae dal reso (`divi-shortcode-strategy.md` §6). Blocca invece la formulazione del
criterio di uscita: finché non è decisa, il divieto si enuncia come «nessuna
**dichiarazione** CSS in linea», non «nessun attributo `style`».

**Default vietato.** Da chiedere all'utente entro l'inizio della Fase 1E.

### 2. Che cosa sono le aree, dopo DR-047 — blocca `1D-W8`

DR-045 sceglie la UX «Le aree di responsabilità», il cui principio è: *si sceglie in
quale veste si lavora e l'intera applicazione si riconfigura* (`ux-proposals.md`
§4.1). DR-047 sceglie l'opposto sul ruolo: tutti i ruoli attivi insieme, unione dei
permessi, nessuna commutazione.

Presi alla lettera insieme, il §4.4 punto 2 di `ux-proposals.md` — «la sessione è
vincolata all'area», e il sistema rifiuta dati di un'altra area *anche se il permesso
ci sarebbe* — **non è attuabile**: senza un'area attiva scelta, non c'è nulla a cui
vincolare la sessione.

La lettura che propongo, e che **non do per approvata**:

> Le aree sono un fatto di **navigazione e di raggruppamento**, non di permesso. Il
> primo livello dell'area amministrativa resta l'elenco delle aree; entrare in
> un'area cambia ciò che si vede, non ciò che si può fare. I permessi sono l'unione
> di quelli di tutti i ruoli della persona, sempre attivi. Nessun commutatore di
> ruolo, nessuna sessione vincolata all'area, nessuna soglia d'ingresso.

Tre ragioni per cui è questa e non un'altra: DR-047 è esplicito e più recente, e su
un conflitto fra il meccanismo dei permessi e una proposta di architettura
dell'informazione vince il primo; il registro delle operazioni non può attribuire
un'azione a un ruolo che non esiste come stato, e questo è già scritto nelle note di
DR-047; in Fase 1 esistono due sole aree, Redazione e Impostazioni, entrambe
accessibili all'unico account, quindi oggi la differenza fra le due letture non
cambia una sola schermata.

Due conseguenze che l'utente deve conoscere prima di confermare: il §4.4 di
`ux-proposals.md` — la separazione d'ambiente come protezione della riservatezza,
descritta lì come «il meccanismo più forte delle quattro» — **decade**, e la
riservatezza dell'area Consulenza andrà ottenuta con i permessi, quando quella fase
sarà pianificabile; l'attribuzione di un'azione all'area in cui è stata compiuta
(`ux-proposals.md` §4.3) non è più possibile, e l'audit log registrerà chi e cosa,
non in quale veste.

**Default vietato.** È già iscritta nel registro delle decisioni come aperta, con
termine «prima della wave 1D-W8».

### 3. Il trascinamento dei blocchi nell'editor — non bloccante

ADR-006 §3.2 mette in perimetro «aggiungere, spostare, eliminare blocchi dentro una
colonna», senza dire **come** si sposta. Propongo comandi espliciti — sposta su,
sposta giù, sposta in — invece del trascinamento: sono accessibili da tastiera, non
richiedono alcuna libreria, e la Fase 1G collauda che un redattore ci riesca, non che
sia piacevole. Se l'utente si aspetta il trascinamento va detto adesso, perché è una
dipendenza in più e un rischio di accessibilità.

**Default vietato sul trascinamento**: in assenza di risposta si realizzano i comandi
espliciti, e questo è ciò che la 1G collauderà.
