# Piano della wave 1G-W6 — Documenti scaricabili, caroselli, metadati di video e PDF

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice
> (`superpowers:test-driven-development`). Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Nessun commit senza
> conferma: il controller fotografa il lavoro fra un'attività e l'altra
> (`.superpowers/sdd/strumenti-1G/snap.sh`).

Scritto il 2026-10-26, dopo la chiusura della `1G-W5` (commit `e9788fd`, CI `40276150604`
verde).

**Obiettivo:** la redazione cambia da sola titolo, descrizione e file dei documenti
scaricabili pubblici, e il sito lo mostra subito (1G-15). I 4 documenti riservati restano
irraggiungibili dal sito e spariscono anche dall'area (1E-16, DR-218). Ogni PDF e ogni
video caricato o sostituito dal CMS si salva senza metadati nascosti, come autore,
programma, date e posizione (DR-254). La redazione cambia immagini, ordine e testi
dell'unico carosello e lo mette in una pagina con il blocco «Presentazione a scorrimento»
(D153 = B, DR-257).

Decisioni chiuse il 2026-10-26: D153 = B, D154 = A, D155 = C, D156 = A, D157 = A
(DR-257…261). Il piano è aggiornato per D153 = B: §1 (W6-5), §2.3, §3.2 (S16-S21), §4,
§5, §6, §7 (T4b, T4c, T7, T8), §8, §9.

**Architettura.**

- **Documenti.** Un modulo nuovo, `apps/api/src/modules/documents/`, nell'area Redazione:
  elenco, dettaglio e modifica di titolo e descrizione dei soli documenti pubblici. Il file
  si sostituisce con la rotta dei media della `1G-W5`, che ne applica già tutte le regole.
  Nella stessa transazione, il servizio dei media aggiorna la data di modifica dei
  documenti che citano quel file. L'area ha una schermata «Documenti» nel gruppo Corredo.
- **Riservati.** Le rotte dei media dell'area escludono i media riservati: non si elencano
  e, cercati per id, rispondono `404`.
- **Caroselli (DR-257).** Un modulo nuovo, `apps/api/src/modules/sliders/`, legge i
  caroselli e ne sostituisce l'elenco ordinato delle slide in una transazione. L'area ha
  una schermata «Caroselli» nel gruppo Corredo. L'editor inserisce il blocco `slider`
  scegliendo un carosello esistente. Il sito non cambia: la lettura pubblica risolve già
  il blocco (`public/page.ts:60`) e `Slider.tsx` lo disegna.
- **Metadati (DR-254).** Il file si ripulisce in `media/scrub.ts`, dopo il riconoscimento
  del tipo e prima dell'impronta e della scrittura. Lo strumento è quello di D154 e una
  ADR nuova lo registra (ADR-012). Un file che non si riesce a ripulire non si salva.

**Stack:** Fastify, Zod, Drizzle, Next.js, `packages/ui`, Vitest, Playwright.

- **Dipendenze nuove:** solo quelle di D154, dichiarate in ADR-012 e in `PROGRESS.md`.
- **Migrazione:** `0009`, solo con D156 = A: una colonna nullabile `documents.modified_at`.
  Si applica al database di sviluppo su conferma, dopo una copia di salvataggio
  (`PLAN.md` §7, riga 2).

**Riferimenti:**

- `CONTEXT.md` §1, §5 (RG-03), §7 (1G-15, 1G-21, 1G-22); `PLAN.md` §1-§3, §5, §8.
- DR-033, DR-074, DR-123, DR-161, DR-218, DR-251, DR-254, DR-256, DR-257…261; D75, D115.
- ADR-004 §3.6; ADR-009; ADR-008.
- `W5-PLAN.md` S3-S7, S9-S11; `DECISIONI-1G.md` §5; `.planning/phases/1D/BLOCK-MODEL.md`
  §«document» e §«slider».

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W6-1 | 1G-15, documenti: dalla schermata «Documenti» la redazione cambia titolo e descrizione di un documento pubblico e ne sostituisce il PDF. Subito dopo, `/download/<slug>/`, la categoria dei download e la ricerca mostrano i valori nuovi, il collegamento «Download» scarica il file nuovo e «Ultimo aggiornamento» ha la data della modifica (D156) | prove dell'API, del sito e dell'area, e2e |
| W6-2 | 1E-16 rieseguito, con i riservati fuori anche dall'area. I 4 documenti riservati e i loro media mancano da `GET /media`, dalle rotte dei documenti, dalla ricerca e dalla sitemap. Ogni rotta per id risponde `404`, e sul sito ogni indirizzo dei 4 file risponde `404` | prove, e2e, verifica in sola lettura sul database e sul sito di sviluppo (solo conteggi) |
| W6-3 | Eliminare un media citato da un documento o da una slide risponde `409 MEDIA_IN_USE` con il titolo che lo cita, senza scritture: mai `500` e mai una slide svuotata | prove dell'API |
| W6-4 | DR-254: un PDF o un MP4 caricato o sostituito dal CMS si salva senza i metadati di S12, e con il contenuto intatto (stesse pagine; stesse tracce audio e video, stessa durata). Un file che non si ripulisce non si salva. I file importati restano byte per byte (D155). ADR-012 è approvata | prove con file sintetici, e2e, ADR-012 |
| W6-5 | 1G-15, caroselli (DR-257): dalla schermata «Caroselli» la redazione sostituisce, aggiunge, toglie e riordina le immagini del carosello e ne cambia i testi. Dall'editor inserisce il blocco «Presentazione a scorrimento» scegliendo un carosello. Dopo la pubblicazione la pagina mostra le immagini nell'ordine salvato, e una modifica successiva al carosello si vede subito sulla pagina. Nessun contenuto importato cambia | prove dell'API e dell'area, e2e |
| W6-6 | D157: i residui scelti hanno codice stabile e messaggio in italiano, e non escono mai come `500` | prove dell'API |
| W6-7 | Non regressione: le viste `/download/…` e le categorie dei download nella matrice sono identiche alla cattura accettata; redirect 181/181; stati 292/292 | cattura di T8, `verifica-redirect.ts`, `stati-matrice.py` |
| W6-8 | La verifica come la CI è verde, in locale e in CI con gli strumenti di D154 installati | lint, Prettier, tipi, build, test, `db:verify`, copertura, e2e |

## 2. Fatti accertati il 2026-10-26

### 2.1 Documenti

| Fatto | Fonte |
|---|---|
| Un documento è una riga di `documents` (slug, titolo, descrizione, `is_private`, `published_at`, `updated_at`) più un media obbligatorio (`on delete restrict`). Non è un contenuto | `packages/db/src/schema/documents.ts:19-47` |
| Pubblici e riservati si distinguono con `documents.is_private`, `media.is_private` e il bucket `media-private`. ADR-004 §3.6: nessun accesso pubblico ai riservati | `documents.ts:33`, `media.ts:38-39`, ADR-004 §3.6 |
| Sorgente: 8 documenti, 4 pubblici (`wpdmpro`) e 4 riservati (`cuar_private_file`). Lo slug è la destinazione dei 4 redirect da `wpdmpro` | `apps/importer/src/stages/documents/index.ts:181-184`, `stages/redirects/rules.ts:104-119` |
| Nessuna rotta redazionale per i documenti né un permesso proprio. Il PDF si sostituisce già con `PUT /media/:id/file`, ma la sostituzione non tocca `documents` | `apps/api/src/app.ts:254-264`, `auth/permissions.ts:10-30`, `media/service.ts:473-510` |
| `/download/<slug>/` mostra titolo, descrizione, peso, «Data di creazione» e «Ultimo aggiornamento»: tutte e due le date con `publishedAt`. Il JSON-LD usa `updatedAt` come `dateModified`, che per gli importati è l'istante dell'import | `apps/web/src/components/Views.tsx:309-316, 320-325`, `page.tsx:285-289`, `documents/index.ts:462` |
| Il blocco `document` dentro le pagine rende solo l'etichetta, senza collegamento (1 occorrenza nella sorgente). Il collegamento sta solo su `/download/<slug>/` | `packages/blocks/src/render/DocBlock.tsx:9-19`, `non-divi-shortcodes.ts:159-196` |
| La ricerca prende i documenti filtrando solo `documents.is_private`; `/public/documents` filtra anche `media.is_private` | `public/search.ts:151-153`, `public/service.ts:689` |

### 2.2 Riservati nell'area

| Fatto | Fonte |
|---|---|
| `GET /media` non filtra `is_private`: la redazione vede nome e titolo dei 4 file riservati | `media/service.ts:52-72` |
| `PUT /media/:id/file` sostituisce anche un riservato, scrivendo nel bucket privato. `DELETE` lo cancella dal bucket privato | `media/service.ts:487, 587` |
| Il controllo «media in uso» guarda solo `contents`. Eliminare il media di un documento viola il vincolo, e la risposta è presumibilmente un `500`. Eliminare il media di una slide la svuota senza avviso (`on delete set null`) | `media/service.ts:530-574`, `documents.ts:26-28, 85` |

### 2.3 Caroselli

| Fatto | Fonte |
|---|---|
| Tabelle `sliders` e `slider_slides` (posizione, media, `heading`, `body`, collegamento). Nessuna colonna per il testo alternativo: il sito usa `heading` | `documents.ts:63-94`, `packages/blocks/src/render/Slider.tsx:58` |
| Nei dati c'è 1 carosello, «Slider home», con 12 slide. **Nessun contenuto ha un blocco `slider`**. La home pubblicata della sorgente non lo mostra, e la verifica è stata tolta con DR-123 | `docs/migration/source-supplementary-findings.md:202-210`, `decision-register.md` DR-123 |
| L'editor non crea blocchi «Presentazione a scorrimento», per scelta di perimetro: oggi una modifica al carosello non si vedrebbe sul sito | `apps/admin/src/lib/editor/tree.ts:39-48`, `CONTEXT.md` §1 |
| Lettura del 2026-10-26 sul database di sviluppo, solo numeri: 1 carosello, 12 slide in posizione da 1 a 12, tutte con un'immagine pubblica; 9 con `heading`, nessuna con `body` o collegamento. 0 contenuti con un blocco `slider`. Documenti: 4 pubblici e 4 riservati, tutti PDF | `SELECT` di conteggio, nessun valore |
| Il blocco `slider` ha solo `sliderId` e `classes`. La lettura pubblica raccoglie i `sliderId` dei blocchi e restituisce le slide con le loro immagini. `Slider.tsx` le disegna, con lo stile in `blocks.css`. Il sito legge con `cache: 'no-store'` | `packages/blocks/src/schema/slider.ts`, `public/service.ts:85, 454-490`, `public/page.ts:60-62`, `apps/web/src/styles/blocks.css`, `apps/web/src/lib/api.ts:31` |
| Nell'area, un blocco `slider` esistente cade nel ramo «Questo blocco non si modifica qui» del pannello. L'etichetta «Presentazione a scorrimento» esiste già in `packages/ui`. `MediaPicker` sceglie un'immagine pubblica in «Elenchi e archivi» | `BlockInspector.tsx:163-171`, `packages/ui/src/editor/block-types.ts:42`, `ContentListingPanel.tsx:8, 116-120` |
| `slider_slides` ha un vincolo unico su (`slider_id`, `position`), non differibile; `media_id` va a `NULL` se il media si elimina | `documents.ts:77-94` |

### 2.4 Metadati di video e PDF (DR-254)

| Fatto | Fonte |
|---|---|
| Le immagini escono da `sharp` senza EXIF né GPS (D145-A). PDF e MP4 si salvano byte per byte come arrivano | `W5-PLAN.md` S8, S10; `media/service.ts` |
| Tipi e limiti: PDF fino a 20 MB, MP4 fino a 100 MB, riconosciuti dal contenuto | `packages/contracts/src/mediaRules.ts:26-31, 64-65`, `media/fileType.ts:84` |
| In un PDF autore e programma stanno nel dizionario Info e nel flusso XMP del catalogo. Un aggiornamento incrementale lascia nel file le versioni vecchie, finché non lo si riscrive da capo | documentazione di `qpdf` e di ExifTool (§«PDF») |
| In un MP4 la posizione sta nei riquadri `udta` (`©xyz`) o `meta` (chiave ISO 6709), e alcune camere la registrano come traccia dati. `ffmpeg -map_metadata -1` agisce sui riquadri noti; le tracce si tolgono solo scegliendo quali copiare | documentazione e segnalazioni di `ffmpeg` |
| Nessun pacchetto per PDF o MP4 nel lockfile. Sulla macchina di sviluppo c'è `ffmpeg` 9.0.2 e non c'è `qpdf`. La CI gira su `ubuntu-latest` senza installare programmi di sistema, e Ubuntu 24.04 distribuisce `qpdf` 11.9.0 | `pnpm-lock.yaml`, lettura del 2026-10-26, `.github/workflows/ci.yml:30, 84-128` |
| L'immagine di produzione non esiste ancora: la sceglie la 1F (ADR-009) | `docs/decisions/adr/ADR-009-hosting-e-deployment.md` |
| Nel database di sviluppo: PDF 52 (4 riservati), MP4 2, tutti importati | `W5-PLAN.md` §2.2 |

### 2.5 Prove ed e2e

| Fatto | Fonte |
|---|---|
| Il seme e2e ha solo 2 PNG: nessun documento né carosello. Nessun e2e tocca documenti o caroselli | `apps/api/tools/seedSintetico.ts:174-191`, `tests/e2e/cms/*.spec.ts` |
| Le prove di 1E-16 sono unitarie | `apps/api/tests/publicRead.test.ts:113-147, 858-872`, `publicSearch.test.ts:168-171` |
| L'elenco delle azioni del registro è chiuso, e una prova lo confronta con i sorgenti | `apps/api/src/modules/audit/actions.ts:4-40`, `apps/admin/src/lib/auditLabels.ts` |
| Un import di `packages/contracts` con suffisso `.js` ha rotto la build dell'area nella `1G-W5` (T4): la build dell'area è un passo obbligatorio | `PROGRESS.md`, 1G-W5 T4 |

## 3. Decisioni

### 3.1 Richieste prima di eseguire

Chiuse il 2026-10-26: D153 = **B** (DR-257, diversa dalla raccomandazione), D154 = **A**
(DR-258), D155 = **C** (DR-259), D156 = **A** (DR-260), D157 = **A** (DR-261). La tabella
resta come scritta prima della risposta.

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D153** | Caroselli. DR-218 li vuole modificabili, ma nessuna pagina mostra l'unico carosello (§2.3): una modifica oggi non si vedrebbe, e 1G-15 chiede «con effetto sul sito» | **A** — si tolgono dalla 1G. Restano nei dati, non modificabili, e il rapporto di collaudo li dichiara «presenti nei dati, non pubblicati». 1G-15 vale per i documenti. Supera in parte DR-218 · **B** — schermata dei caroselli (sostituire, aggiungere, togliere e riordinare le immagini, testo di ciascuna) **e** un blocco «Presentazione a scorrimento» inseribile nell'editor, che sceglie un carosello esistente. Toglie per questo solo blocco l'esclusione di `CONTEXT.md` §1, e costa circa metà wave in più · **C** — solo la schermata, senza blocco: l'effetto si prova su una pagina sintetica, ma sul sito non si vede finché nessuno lo usa | **A**: nessun contenuto pubblico da aggiornare, e il collaudo non avrebbe nulla da osservare. Un carosello sulla home cambierebbe la parità approvata ed è una funzione nuova, da decidere dopo il gate | costruire o togliere i caroselli senza decisione |
| **D154** | Strumento per ripulire PDF e MP4 (ADR-012) | **A** — due programmi esterni chiamati dall'API in un processo separato. Il PDF lo riscrive da capo `qpdf` senza Info né XMP, e restano solo gli oggetti raggiungibili, quindi anche le revisioni vecchie spariscono. L'MP4 lo ricompone `ffmpeg` copiando i flussi, senza ricodifica: solo le tracce audio e video, senza metadati. Vanno installati in sviluppo, in CI e nell'immagine della 1F · **B** — solo pacchetti npm. PDF con `@cantoo/pdf-lib` (fork mantenuto di `pdf-lib`, JavaScript puro), con il codice che toglie Info, XMP e gli oggetti non raggiungibili. MP4 con codice scritto nel progetto, che toglie i riquadri dei metadati e ricalcola gli spostamenti. Una traccia dati di posizione perde il riferimento, ma i suoi byte restano nel file · **C** — `exiftool` (Perl) per l'MP4 e `qpdf` per il PDF, perché `exiftool` sul PDF aggiunge un aggiornamento e il dato vecchio resta recuperabile. Servono tre programmi; una traccia dati di posizione resta | **A**: è l'unica opzione che toglie davvero anche la posizione registrata come traccia, e il PDF lo riscrive uno strumento fatto per questo. Il costo è l'installazione in tre ambienti, più un analizzatore ampio (`ffmpeg`) su file non fidati, isolato in un processo con tempo limite. Le licenze vanno fatte verificare da una persona: `ffmpeg` è LGPL o GPL secondo la compilazione, `qpdf` è Apache-2.0 | introdurre dipendenze o programmi senza ADR approvata |
| **D155** | Quali file si ripuliscono | **A** — solo quelli caricati o sostituiti dal CMS da ora in poi. Gli importati restano byte per byte, come le immagini (W5, S11) · **B** — anche i PDF e gli MP4 pubblici importati, una volta sola, con copia di salvataggio e conferma. Cambiano peso e impronta dei download pubblici, ed è una scrittura su dati reali · **C** — A, più una misura in sola lettura: quanti PDF e MP4 pubblici importati contengono autore, programma, date o posizione, **solo numeri** e mai i valori. Sugli importati si decide con quei numeri, prima della 1F | **C**: la pulizia vale da subito per ciò che entra, e per i file già pubblicati da WordPress si decide su un dato misurato invece che su un'ipotesi | ripulire o lasciare i file importati senza decisione |
| **D156** | Documenti: quali campi e quale data | **A** — titolo, descrizione e file. «Ultimo aggiornamento» mostra la data dell'ultima modifica fatta dal CMS, da una colonna nuova `modified_at`, vuota per i 4 importati, che quindi restano identici. Richiede la migrazione `0009` · **B** — solo titolo e file, alla lettera di DR-218. Date invariate, nessuna migrazione · **C** — titolo, descrizione e file, date invariate, nessuna migrazione: dopo una sostituzione, «Ultimo aggiornamento» resta la data di pubblicazione | **A**: chi scarica un modulo vede che è aggiornato, come in Download Manager. La descrizione è testo pubblico della stessa scheda. Le 4 pagine importate non cambiano | aggiungere colonne o cambiare la resa delle date senza decisione |
| **D157** | Rilievi minori residui della `1G-W5`:<br>• N3: oltre 30 caricamenti al minuto, `429` in inglese con `INTERNAL_ERROR`;<br>• residuo di N1: il messaggio «Preamble terminated early» non è tradotto;<br>• N6: il campo `err` dell'SDK può portare la chiave nel log;<br>• N2: video da 100 MB su archivio remoto oltre 30 s, quindi `500`;<br>• timeout dell'archivio in `500`;<br>• N4: errore al `COMMIT` con oggetti orfani;<br>• N5: descrizione OpenAPI del `503`;<br>• `prova-1e-19.ts` lascia la sessione aperta | **A** — nella 1G-W6 solo quelli sulle rotte che la wave tocca di nuovo: N3, «Preamble» ed N6. Gli altri restano elencati per la `1G-W9` o la 1F · **B** — tutti nella 1G-W6 · **C** — nessuno: restano elencati per il collaudo e la 1F | **A**: N3 e «Preamble» sono messaggi in inglese su caricamenti, cioè 1G-14, e N6 riguarda il log. Gli altri chiedono un archivio remoto o lo script di un'altra prova | correggere o rinviare i residui senza decisione |

Se una risposta è diversa dalla raccomandazione, aggiornare §3.2, §4, §5 e le attività
interessate prima di eseguirle.

### 3.2 Scelte di dettaglio dichiarate (rivedibili)

**Documenti (DR-218, D156)**

| # | Scelta | Motivo |
|---|---|---|
| S1 | Modulo `documents/` nell'area Redazione:<br>• `GET /documents` e `GET /documents/:id` con `content.read`;<br>• `PATCH /documents/:id` con `content.write`.<br>Solo documenti con `documents.is_private = false` **e** `media.is_private = false`: un riservato risponde `404` come un id inesistente. Titolo ripulito dagli spazi, da 1 a 300 caratteri; descrizione fino a 5000 caratteri, salvata `NULL` se vuota. Sono testo, mai HTML. Ogni modifica scrive `modified_at` (D156-A) e `updated_at`, con l'azione di registro `document.update` sull'entità `document` | nessuna rotta esiste; i permessi sono quelli dei contenuti, perché il ruolo `redazione` li ha già |
| S2 | Il file si sostituisce **solo** con `PUT /media/:id/file`, con tutte le regole della W5: stesso tipo, limiti, conferma, D146 per le anteprime citate. Nella stessa transazione il servizio dei media aggiorna `modified_at` e `updated_at` dei documenti che citano quel media, da qualunque schermata parta la sostituzione | una sola strada per sostituire un file, quindi una sola regola |
| S3 | Non si cambiano slug e categorie dei download, e non si creano né si eliminano documenti | lo slug è la destinazione di 4 redirect; DR-218 chiede file e titolo |
| S4 | Sito: «Ultimo aggiornamento» = `modifiedAt ?? publishedAt`; «Data di creazione» e JSON-LD invariati. `/public/documents` e `/public/documents/:slug` aggiungono `modifiedAt`. Con `modified_at` nullo l'HTML delle 4 pagine non cambia | parità approvata intatta; la data cambia solo dopo una modifica vera |
| S5 | Area: voce «Documenti» nel gruppo Corredo.<br>• `/redazione/documenti`: titolo, file, peso, «Ultimo aggiornamento», «Apri sul sito».<br>• `/redazione/documenti/[id]`: titolo e descrizione con «Salva»; il file con «Sostituisci il file» (`MediaUploader` con `accept` PDF, controllo prima dell'invio e conferma della W5).<br>Etichetta del registro: «Ha modificato il documento» | stessi componenti e stessi messaggi della libreria dei media |

**Riservati e media citati (DR-218, ADR-004 §3.6)**

| # | Scelta | Motivo |
|---|---|---|
| S6 | `GET /media` esclude i media riservati. `GET`, `PATCH`, `PUT /file` e `DELETE /media/:id` su un riservato rispondono `404` come un media inesistente, senza scritture | DR-218 li vuole non modificabili; oggi la redazione ne vede i nomi e può sostituirli |
| S7 | `DELETE /media/:id` di un media citato da un documento o da una slide → `409 MEDIA_IN_USE`, con il titolo del documento o del carosello nel messaggio della W5, senza scritture | oggi il documento dà un errore del vincolo e la slide si svuota senza avviso |
| S8 | Il corpus della ricerca filtra anche `media.is_private = false`, come `/public/documents` | una sola regola dei riservati in tutte le letture pubbliche |

**Pulizia dei metadati (DR-254, D154, D155)**

| # | Scelta | Motivo |
|---|---|---|
| S9 | `media/scrub.ts` si chiama nel caricamento e nella sostituzione, dopo il riconoscimento del tipo e prima dell'impronta, per PDF e MP4. Peso, impronta e byte salvati sono quelli del file ripulito. Le immagini restano a `sharp` (D145-A) | un solo punto per ogni file che entra |
| S10 | Con D154 = A:<br>• processo separato senza shell (`execFile` con argomenti in un array);<br>• file temporanei con nomi generati, mai quello del caricamento, in una cartella propria che si cancella sempre;<br>• tempo limite di 30 s per un PDF e 120 s per un MP4, uscita letta con un limite;<br>• percorsi dei programmi da configurazione (`QPDF_PATH`, `FFMPEG_PATH`), con il `PATH` come default.<br>Comandi indicativi, quelli esatti li fissa ADR-012:<br>• PDF: `qpdf --remove-info --remove-metadata` con riscrittura completa;<br>• MP4: `ffmpeg -map 0:v? -map 0:a? -map_metadata -1 -map_chapters -1 -c copy -fflags +bitexact`, mantenendo l'indice in testa se c'era | il file arriva dal browser; un nome ostile non deve raggiungere un comando |
| S11 | Un file che lo strumento non legge → `400 MEDIA_FILE_INVALID`, con il messaggio della W5. Uno strumento assente o oltre il tempo → `503 MEDIA_SCRUB_UNAVAILABLE`: «Il caricamento di PDF e video è sospeso: il servizio non riesce a ripulire i file. Avvisa chi gestisce il sito.». Il log riporta l'id e lo strumento, mai il nome del file. Nessun file non ripulito si salva mai. Le immagini non dipendono da questi strumenti | in caso di dubbio si rifiuta il file, invece di salvarlo |
| S12 | **Che cosa deve sparire** (prove con file sintetici generati nella prova):<br>• **PDF:** dizionario Info (autore, programma, titolo, date) e XMP del catalogo, comprese le versioni vecchie di un aggiornamento incrementale;<br>• **MP4:** `udta`, `meta`, riquadri XMP `uuid`, capitoli e tracce che non siano audio o video.<br>Non spariscono, e ADR-012 lo dichiara: le immagini dentro un PDF con i propri EXIF, il testo visibile, la `ModDate` che `qpdf` conserva | la prova misura l'assenza delle stringhe sintetiche nei byte; il limite resta scritto |
| S13 | CI: il flusso installa i due programmi prima delle prove e ne stampa le versioni. Sviluppo: HO-032 per installare `qpdf` (`ffmpeg` c'è già). ADR-012 li elenca come requisito dell'immagine della 1F | le prove girano davvero con gli strumenti, in tutti e due gli ambienti |
| S14 | Misura di D155-C: uno script fuori Git legge in sola lettura i PDF e gli MP4 pubblici importati e conta quelli con autore, programma, date, XMP o posizione. Solo numeri, scritti in ADR-012 §«Verifica»; nessun nome di file, titolo o valore | i valori possono essere dati personali |

**Caroselli (DR-257)**

| # | Scelta | Motivo |
|---|---|---|
| S16 | Modulo `sliders/` nell'area Redazione:<br>• `GET /sliders` e `GET /sliders/:id` con `content.read`;<br>• `PUT /sliders/:id/slides` con `content.write`, che sostituisce l'**elenco ordinato** delle slide in una transazione, con il carosello bloccato (`for update`).<br>Ogni voce ha `id` facoltativo, `mediaId`, `heading` e `body`. Una slide elencata con `id` conserva collegamento, `settings` e `legacyId`. Una slide non elencata si toglie, una voce senza `id` nasce con collegamento nullo e `settings` vuoti. Le posizioni si riscrivono da 1 a n, come nell'import, senza violare il vincolo unico. Da 1 a 50 voci. Un `id` di un altro carosello → `400 SLIDER_SLIDE_INVALID`; un media inesistente, riservato o non immagine → `400 SLIDER_MEDIA_INVALID`. `heading` ripulito dagli spazi, fino a 300 caratteri; `body` fino a 2000; vuoti → `NULL`; sono testo, mai HTML. Scrive `sliders.updated_at` e la riga di registro `slider.update` sull'entità `slider` | una sola richiesta per sostituire, aggiungere, togliere e riordinare: lo stato salvato è sempre quello che la schermata mostrava |
| S17 | Non si creano né si eliminano caroselli; non si cambiano titolo, chiave e `settings` del carosello, né i collegamenti delle slide | DR-218 e D153-B chiedono immagini, ordine e testo; i collegamenti sono 0 nei dati |
| S18 | `GET /sliders/:id` restituisce anche `usedIn`, cioè i contenuti il cui `blocks` cita l'id, con la stessa ricerca testuale di `citedBy` dei media (al massimo 10) | la schermata dice dove si vedrà la modifica |
| S19 | Area: voce «Caroselli» nel gruppo Corredo.<br>• `/redazione/caroselli`: titolo, numero di immagini e di pagine che lo mostrano.<br>• `/redazione/caroselli/[id]`: le slide in ordine, ognuna con miniatura, campi «Titolo» e «Testo», «Sposta su», «Sposta giù», «Cambia immagine» e «Togli»; poi «Aggiungi un'immagine» e un solo «Salva». La scelta usa `MediaPicker` con le sole immagini pubbliche. L'ultima slide non si toglie («Un carosello ha almeno un'immagine»).<br>• Sotto «Titolo», il testo d'aiuto «È anche la descrizione dell'immagine per chi usa un lettore di schermo.». La sezione «Pagine che lo mostrano» ha i collegamenti all'editor; se è vuota: «Nessuna pagina lo mostra. Per farlo vedere sul sito, inserisci il blocco «Presentazione a scorrimento» in una pagina.».<br>Etichetta del registro: «Ha modificato il carosello» | stessi componenti della libreria dei media e di «Elenchi e archivi»; `heading` è il testo alternativo sul sito (`Slider.tsx:58`) |
| S20 | Editor: `slider` entra in `CREATABLE_TYPES`. Scegliendo «Presentazione a scorrimento», l'editor chiede quale carosello, con una scelta da `GET /sliders` e il pulsante «Inserisci». Il blocco nasce con lo schema `sliderPropsSchema` e il `sliderId` scelto. `UNCREATABLE_REASON` non nomina più la presentazione. Nel pannello del blocco `slider`: scelta «Carosello» fra quelli esistenti e il collegamento «Modifica le immagini del carosello» a `/redazione/caroselli/<id>`. L'anteprima dell'editor non cambia: l'effetto si vede con «Anteprima sul sito» (DR-252) e dopo la pubblicazione | lo schema di `packages/blocks` resta la sola autorità sul blocco; nessun identificatore scritto a mano |
| S21 | `CONTEXT.md` §1: l'esclusione dei blocchi nuovi non vale più per la presentazione, con il rimando a DR-257 | il documento di fase resta coerente con la decisione |

**Prove**

| # | Scelta | Motivo |
|---|---|---|
| S15 | Il seme e2e riceve un documento pubblico e uno riservato, sintetici, ognuno con il suo PDF generato e un nome di prova; e un carosello sintetico con 3 slide sulle PNG del seme. Nessun dato reale | oggi l'e2e non ha documenti né caroselli |

## 4. Struttura dei file

| Percorso | Che cosa |
|---|---|
| `apps/api/src/modules/documents/routes.ts`, `service.ts`, `schemas.ts` (nuovi); `apps/api/src/app.ts` | rotte dei documenti (S1) |
| `packages/db/src/schema/documents.ts`, `packages/db/drizzle/0009_*.sql`, `docs/architecture/schema.sql` | `modified_at` (D156-A) |
| `apps/api/src/modules/media/service.ts`, `routes.ts`, `scrub.ts` (nuovo); `apps/api/src/config.ts`; `packages/contracts/src/mediaRules.ts` | riservati esclusi, media citati, data dei documenti, pulizia, codice `MEDIA_SCRUB_UNAVAILABLE` |
| `apps/api/src/modules/public/schemas.ts`, `service.ts`, `search.ts` | `modifiedAt`; filtro dei riservati nella ricerca |
| `apps/api/src/modules/audit/actions.ts`, `apps/admin/src/lib/auditLabels.ts` | `document.update`, `slider.update` |
| `apps/api/src/modules/sliders/routes.ts`, `service.ts`, `schemas.ts` (nuovi); `apps/api/tests/sliders.test.ts` (nuovo) | rotte dei caroselli (S16-S18) |
| `apps/admin/src/app/redazione/caroselli/` (nuovo), `src/components/sliders/` (nuovo); `src/lib/editor/tree.ts`, `src/components/editor/BlockInspector.tsx`, `ContentEditor.tsx`; `apps/admin/tests/sliders.test.tsx` (nuovo), prove dell'editor | schermata «Caroselli» e blocco nell'editor (S19, S20) |
| `.planning/phases/1G/CONTEXT.md` | S21 |
| `apps/web/src/components/Views.tsx`, `src/lib/api.ts` | «Ultimo aggiornamento» (S4) |
| `apps/admin/src/app/redazione/documenti/` (nuovo), `src/components/documents/` (nuovo), `src/lib/areas.ts` | schermata «Documenti» (S5) |
| `apps/api/tests/documents.test.ts`, `mediaPrivate.test.ts`, `mediaScrub.test.ts` (nuovi); `publicRead.test.ts`, `publicSearch.test.ts`, `openapi.snapshot.json` | prove dell'API |
| `apps/web/tests/documentView.test.tsx`; `apps/admin/tests/documents.test.tsx` (nuovi) | prove del sito e dell'area |
| `tests/e2e/cms/documenti.spec.ts` (nuovo), `media.spec.ts`; `apps/api/tools/seedSintetico.ts` | e2e e seme (S15) |
| `.github/workflows/ci.yml`, `.env.example` | strumenti in CI, percorsi (S13) |
| `docs/decisions/adr/ADR-012-pulizia-dei-metadati.md` (nuova), `adr/README.md` | ADR di D154 |
| `docs/handoff/HO-032-*.md`, `docs/handoff/README.md` | installazione di `qpdf` in sviluppo |
| `.planning/phases/1G/PLAN.md` | riga della `1G-W6` secondo D153 e DR-254 |

## 5. Interfacce

| Rotta | Permesso | Risposta |
|---|---|---|
| `GET /documents` | `content.read`, area Redazione | i documenti pubblici, ordinati per titolo |
| `GET /documents/:id` | `content.read` | un documento pubblico; riservato o inesistente `404` |
| `PATCH /documents/:id` | `content.write` | `200` con il documento; `400` per titolo o descrizione non validi; `404` |
| `GET /media`, `GET/PATCH/PUT/DELETE /media/:id` (esistenti) | come oggi | senza riservati (S6); `409 MEDIA_IN_USE` per documenti e slide (S7) |
| `POST /media`, `PUT /media/:id/file` (esistenti) | `media.write` | PDF e MP4 ripuliti (S9); `503 MEDIA_SCRUB_UNAVAILABLE` (S11) |
| `GET /public/documents`, `/public/documents/:slug` (esistenti) | nessuno | aggiungono `modifiedAt` |
| `GET /sliders` | `content.read` | i caroselli, ordinati per titolo |
| `GET /sliders/:id` | `content.read` | un carosello con slide e `usedIn`; inesistente `404` |
| `PUT /sliders/:id/slides` | `content.write` | `200` con il carosello; `400 SLIDER_SLIDE_INVALID`, `SLIDER_MEDIA_INVALID` o validazione; `404` |

```ts
// Forma di GET /documents/:id
interface EditorialDocument {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;   // D156-A
  sitePath: string;            // `/download/<slug>/`
  file: { mediaId: string; fileName: string; mimeType: string; byteSize: number; publicPath: string };
}

// PATCH /documents/:id — almeno un campo
interface DocumentUpdate { title?: string; description?: string | null }

// apps/api/src/modules/media/scrub.ts
type ScrubbableMime = 'application/pdf' | 'video/mp4';
interface ScrubTools { qpdfPath: string; ffmpegPath: string; pdfTimeoutMs: number; videoTimeoutMs: number }
function scrubFile(mime: ScrubbableMime, input: Buffer, tools: ScrubTools): Promise<Buffer>;
// errori: ScrubUnreadableError → MEDIA_FILE_INVALID; ScrubUnavailableError → MEDIA_SCRUB_UNAVAILABLE

// Forma di GET /sliders
interface SliderSummary { id: string; title: string; slideCount: number; usedInCount: number; updatedAt: string }

// Forma di GET /sliders/:id
interface EditorialSlider {
  id: string;
  title: string;
  updatedAt: string;
  slides: Array<{
    id: string;
    position: number;            // da 1 a n
    mediaId: string | null;
    heading: string | null;
    body: string | null;
    image: { fileName: string; publicPath: string } | null;
  }>;
  usedIn: Array<{ id: string; title: string; type: string }>;
}

// PUT /sliders/:id/slides — l'elenco nell'ordine voluto, da 1 a 50 voci
interface SlidesReplace {
  slides: Array<{ id?: string; mediaId: string; heading: string | null; body: string | null }>;
}

// apps/admin/src/lib/editor/tree.ts
function createBlock(type: BlockType, options?: { sliderId?: string }): ModelBlock;
function insertBlock(doc: BlockDocument, parentId: string | null, type: BlockType,
  options?: { sliderId?: string }): { document: BlockDocument; insertedId: string };
```

## 6. Revisione di attenzione

1. **Documento pubblico il cui file non è un PDF.** Se la verifica di T1 ne trova uno, la
   sostituzione segue la regola del tipo uguale. Se il tipo non è fra quelli di DR-251, la
   schermata lo dice prima dell'invio, invece di far fallire la richiesta.
2. **PDF protetti.** Un PDF con la sola password del proprietario (permessi di stampa o
   copia) si ripulisce e resta apribile. Uno con password di apertura non si legge, e si
   rifiuta con `MEDIA_FILE_INVALID`.
3. **MP4 particolari.** Indice in testa o in coda, traccia dati di posizione, capitoli,
   video senza audio: escono solo audio e video, senza riquadri di metadati e con la
   stessa durata.
4. **Nomi ostili.** Un nome come `-i.pdf`, `a;b.mp4` o con spazi non raggiunge mai un
   comando: i file temporanei hanno nomi generati.
5. **Strumento assente o lento.** Si risponde `503` in italiano, senza scritture, e il log
   non riporta il nome. Le immagini si caricano lo stesso.
6. **Sostituzione dalla libreria dei media.** Anche se non parte dalla schermata
   «Documenti», aggiorna «Ultimo aggiornamento» del documento che cita il file.
7. **Titolo.** Solo spazi o oltre 300 caratteri → `400`. Con `<b>` resta testo sul sito,
   nella ricerca e nel `<title>`.
8. **Riordino completo.** Invertire tutte le 12 slide in una sola richiesta non viola il
   vincolo unico delle posizioni, e una richiesta che fallisce a metà non lascia posizioni
   intermedie.
9. **Due schede aperte sullo stesso carosello.** Vince l'ultimo «Salva», per intero: lo
   stato salvato è sempre un elenco che una persona ha visto. Il registro le mostra tutte
   e due.
10. **Slide senza immagine.** Una slide importata con `media_id` nullo si mostra con
    l'avviso «Immagine mancante», e per salvare le si sceglie un'immagine o la si toglie.
11. **Testo della slide con `<b>` o con un collegamento.** Resta testo: React lo rende
    come testo, e non nasce alcun collegamento.

## 7. Attività

### T0 — Decisioni D153-D157 e preparazione
- [x] Portarle all'utente con `grill-me` e registrare le risposte in
  `decision-register.md` (DR-257…261). Se sono diverse dalla raccomandazione, aggiornare
  §3.2, §4, §5 e le attività prima di eseguire. Fatto il 2026-10-26: D153 = B, piano
  aggiornato.
- [x] Aggiornare in `PLAN.md` la riga della `1G-W6` (DR-254, esito di D153) e §8; S21 in
  `CONTEXT.md` §1.
- [x] Con D154 = A: scrivere e consegnare HO-032 (installare `qpdf` in sviluppo, verificare
  `qpdf --version` e `ffmpeg -version`), così che sia pronto per la T5.

### T1 — Riservati fuori dall'area e media citati (S6-S8)
**File:** `media/service.ts`, `media/routes.ts`, `public/search.ts`, `tests/mediaPrivate.test.ts`,
`publicSearch.test.ts`, snapshot OpenAPI.
- [ ] Verifica in sola lettura sul database di sviluppo, con soli numeri: documenti
  pubblici e riservati, tipo dei file dei pubblici, media citati da slide.
- [ ] Prove (falliscono):
  - `GET /media` non elenca un media riservato sintetico;
  - `GET`, `PATCH`, `PUT /file` e `DELETE` su quel media rispondono `404`, e l'oggetto nel
    bucket privato resta byte per byte;
  - `DELETE` del media di un documento e di una slide → `409 MEDIA_IN_USE` con il titolo,
    e righe e oggetti invariati;
  - la ricerca non restituisce un documento pubblico con il media riservato.
- [ ] Attuazione; prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`.

### T2 — Documenti nell'API (S1-S3, D156)
**File:** modulo `documents/`, `app.ts`, `media/service.ts`, `public/schemas.ts`,
`public/service.ts`, `audit/actions.ts`, schema e migrazione `0009`, `schema.sql`,
`tests/documents.test.ts`, `publicRead.test.ts`.
- [ ] Prove (falliscono):
  - **elenco e dettaglio:** solo i pubblici; riservato e inesistente `404`; anonimo `401`;
    sessione Impostazioni `403`;
  - **modifica:** titolo e descrizione salvati, descrizione vuota `NULL`, titolo vuoto o
    troppo lungo `400`; `modified_at` e `updated_at` scritti; riga di registro
    `document.update`; senza `content.write` `403`;
  - **sostituzione** con `PUT /media/:id/file` di un PDF citato: `modified_at` del
    documento aggiornato nella stessa transazione, e invariato se la sostituzione fallisce;
  - **lettura pubblica:** `/public/documents/:slug` restituisce titolo, descrizione e
    `modifiedAt` nuovi; un documento importato ha `modifiedAt: null`.
- [ ] Migrazione `0009` e `db:verify`. Prima di applicarla al database di sviluppo:
  copia di salvataggio e **conferma** dell'utente.
- [ ] Attuazione; prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`.

### T3 — Documenti nel sito (S4)
**File:** `Views.tsx`, `apps/web/src/lib/api.ts`, `apps/web/tests/documentView.test.tsx`.
- [ ] Prove (falliscono): con `modifiedAt` nullo l'HTML della scheda è identico a quello di
  oggi (istantanea presa **prima** della modifica); con `modifiedAt` impostato «Ultimo
  aggiornamento» lo mostra, mentre «Data di creazione» e JSON-LD restano.
- [ ] Attuazione; prove verdi; commento in `PROGRESS.md`.

### T4 — Schermata «Documenti» (S5)
**File:** `apps/admin/src/app/redazione/documenti/`, `src/components/documents/`,
`src/lib/areas.ts`, `auditLabels.ts`, `apps/admin/tests/documents.test.tsx`.
- [ ] Prove (falliscono):
  - la voce «Documenti» è in Corredo, e la prova di 1G-20 non trova voci `404`;
  - l'elenco mostra titolo, file, peso e data, e «Apri sul sito» porta a
    `/download/<slug>/`;
  - «Salva» invia solo i campi cambiati, e i messaggi `400` si leggono in italiano;
  - «Sostituisci il file» accetta solo PDF, chiede conferma e, con «Annulla», non invia
    nulla;
  - l'etichetta «Ha modificato il documento» compare nel registro.
- [ ] Attuazione con i componenti di `packages/ui`; tastiera ed etichette; prove verdi;
  **build dell'area** (`pnpm --filter admin build`); commento in `PROGRESS.md`.

### T4b — Caroselli nell'API (S16-S18, DR-257)
**File:** modulo `sliders/`, `app.ts`, `audit/actions.ts`, `tests/sliders.test.ts`,
snapshot OpenAPI.
- [ ] Prove (falliscono):
  - **lettura:** elenco con `slideCount` e `usedInCount`; dettaglio con slide in ordine,
    immagine e `usedIn` di un contenuto sintetico con il blocco; inesistente `404`;
    anonimo `401`; sessione Impostazioni `403`;
  - **sostituzione dell'elenco:** riordino completo (inversione), aggiunta, rimozione,
    cambio d'immagine e di testo in una richiesta; posizioni da 1 a n; collegamento,
    `settings` e `legacyId` conservati per le slide elencate; `updated_at` e riga di
    registro `slider.update`;
  - **rifiuti senza scritture:** `id` di un altro carosello, media inesistente, riservato
    o PDF, 0 o 51 voci, `heading` oltre 300 caratteri → `400` con il codice di S16; senza
    `content.write` `403`;
  - **sul sito:** dopo la sostituzione, `GET /public/content` della pagina sintetica con il
    blocco restituisce le slide nell'ordine nuovo.
- [ ] Attuazione; prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`.

### T4c — Schermata «Caroselli» e blocco nell'editor (S19-S21)
**File:** `apps/admin/src/app/redazione/caroselli/`, `src/components/sliders/`,
`src/lib/areas.ts`, `auditLabels.ts`, `src/lib/editor/tree.ts`,
`src/components/editor/BlockInspector.tsx`, `ContentEditor.tsx`, prove dell'area,
`CONTEXT.md` §1.
- [ ] Prove (falliscono):
  - la voce «Caroselli» è in Corredo, e la prova di 1G-20 non trova voci `404`;
  - «Sposta su» e «Sposta giù», «Togli», «Aggiungi un'immagine» e «Cambia immagine»
    cambiano l'elenco mostrato; «Salva» invia l'elenco intero nell'ordine mostrato;
    l'ultima slide non si toglie; i `400` si leggono in italiano;
  - «Pagine che lo mostrano» elenca i contenuti con il collegamento, o il testo di S19;
  - l'editor offre «Presentazione a scorrimento»; senza scegliere un carosello «Inserisci»
    non agisce; il blocco nato passa `blockNodeSchema` con il `sliderId` scelto;
  - nel pannello del blocco si cambia carosello e c'è il collegamento alla schermata;
  - l'etichetta «Ha modificato il carosello» compare nel registro.
- [ ] Attuazione con i componenti di `packages/ui`; tastiera ed etichette; prove verdi;
  **build dell'area**; commento in `PROGRESS.md`. S21 è già in `CONTEXT.md` dalla T0.

### T5 — ADR-012 e pulizia dei metadati (S9-S14, DR-254)
**File:** ADR-012, `adr/README.md`, `media/scrub.ts`, `media/service.ts`, `config.ts`,
`mediaRules.ts`, `.env.example`, `.github/workflows/ci.yml`, `tests/mediaScrub.test.ts`.
- [x] Prerequisito: HO-032 eseguito il 2026-10-26 (`qpdf` 12.4.2 in
  `C:\Program Files\qpdf 12.4.2\bin\qpdf.exe`, fuori dal `PATH` di sistema; `ffmpeg`
  9.0.2 nel `PATH`). Ubuntu 24.04 ha `qpdf` 11.9.0, senza le opzioni di S10: con
  D158 = A (DR-262) la CI scarica il binario ufficiale.
- [ ] **CI (DR-262)**, nel lavoro `verifica` prima di «Test unitari e di integrazione», un
  passo «Programmi per la pulizia dei metadati» che:
  - installa `ffmpeg` con `sudo apt-get install -y --no-install-recommends ffmpeg`;
  - scarica `https://github.com/qpdf/qpdf/releases/download/v12.4.2/qpdf-12.4.2-bin-linux-x86_64.zip`;
  - lo controlla con `sha256sum -c` contro
    `db367d897829f22c4198ce1094143c9d467bd6ee7dfabc44ba6f02056b24f8b1` (letta il
    2026-10-26 dalla release e dal file `qpdf-12.4.2.sha256` del manutentore), e si ferma
    se non coincide;
  - lo estrae in `$RUNNER_TEMP/qpdf`, aggiunge `$RUNNER_TEMP/qpdf/bin` a `$GITHUB_PATH`
    e stampa `qpdf --version` e `ffmpeg -version`.

  Versione e impronta stanno in due variabili del passo, con un commento che dice di
  aggiornarle insieme. `runs-on` non cambia.
- [ ] **Sicurezza dei processi**, oltre a S10:
  - `ffmpeg` riceve `-nostdin -hide_banner -loglevel error -protocol_whitelist file
    -f mov` prima di `-i`, così un file che si finge MP4 non apre playlist né altri file,
    e scrive con `-movflags +faststart`;
  - `qpdf` riscrive con `--remove-info --remove-metadata`; l'uscita 0 e l'uscita 3
    (avvisi, file scritto) valgono come riuscita, ogni altra come file illeggibile;
  - l'uscita dei programmi letta al massimo per 64 KB e mai copiata nel log, che riporta
    solo strumento, codice di uscita e durata;
  - il file ripulito si rilegge con il limite di peso del suo tipo; oltre, lo stesso
    rifiuto di un caricamento troppo pesante.
- [ ] Scrivere ADR-012 secondo il §«Come leggerle» dell'indice, con l'esito di D154, i
  comandi esatti, le versioni minime, i limiti di S12, le licenze da far verificare e il
  requisito per l'immagine della 1F.
- [ ] Prove (falliscono), con file sintetici generati nella prova:
  - **PDF** con Info (autore e programma sintetici), XMP e un aggiornamento incrementale
    con un autore vecchio: dopo la pulizia nessuna delle stringhe sintetiche resta nei
    byte, e il numero di pagine è lo stesso;
  - **MP4** generato con `ffmpeg -f lavfi`, con `location`, `artist`, un riquadro XMP e una
    traccia dati: dopo la pulizia nessuna delle stringhe resta, e le tracce audio e video e
    la durata sono le stesse;
  - **caricamento e sostituzione** salvano il file ripulito, con peso e impronta coerenti;
  - **rifiuti:** file illeggibile `400`; programma assente e tempo scaduto `503`, senza
    scritture, e il nome del file non compare nel log;
  - nessuna chiamata per le immagini.
- [ ] Attuazione; installazione in CI; prove verdi in locale; commento in `PROGRESS.md` con
  le dipendenze dichiarate.
- [ ] Misura di D155-C (S14): numeri in ADR-012 §«Verifica».

### T6 — Residui di D157
**File:** secondo l'esito; con A: `app.ts`, `media/multipartErrors.ts`, gestione del log
degli errori dell'archivio, `mediaRules.ts`, prove.
- [ ] Prove (falliscono):
  - oltre il limite di frequenza: `429 MEDIA_RATE_LIMITED`, messaggio in italiano;
  - «Preamble terminated early» diventa `400 MEDIA_UPLOAD_INVALID`, e un errore di
    un'altra rotta resta `500` (DR-256);
  - il log degli errori dell'archivio non contiene la chiave.
- [ ] Attuazione; prove verdi; commento in `PROGRESS.md`.

### T7 — Prove end-to-end
**File:** `tests/e2e/cms/documenti.spec.ts`, `media.spec.ts`, `seedSintetico.ts`.
- [ ] Seme (S15).
- [ ] **Documenti**, come redazione:
  - cambia titolo e descrizione del documento sintetico: `/download/<slug>/`, la
    categoria e la ricerca li mostrano;
  - sostituisce il PDF: il collegamento «Download» serve la nuova impronta, il file non ha
    l'autore sintetico, e «Ultimo aggiornamento» ha la data di oggi;
  - il documento riservato non è nell'elenco; il suo `/download/<slug>/` e l'indirizzo
    del file rispondono `404`; `GET /media/<id>` risponde `404`.
- [ ] **Caroselli** (`caroselli.spec.ts`), come redazione:
  - inserisce il blocco «Presentazione a scorrimento» in una pagina sintetica, sceglie il
    carosello sintetico e pubblica: la pagina sul sito mostra le 3 immagini nell'ordine;
  - dalla schermata «Caroselli» inverte l'ordine, cambia un titolo, toglie una slide e ne
    aggiunge una: la pagina mostra subito il nuovo ordine, il titolo nuovo come testo
    alternativo e il numero giusto di slide;
  - eliminare dalla libreria un media usato da una slide risponde con il messaggio di S7.
- [ ] **Media:** un MP4 sintetico con posizione, caricato, si scarica senza.
- [ ] Verdi due volte di fila; commento in `PROGRESS.md`.

### T8 — Verifica e chiusura
- [ ] **Revisioni senza esiti critici o alti aperti:**
  - revisione del codice dell'intera wave (`code-reviewer`);
  - revisione di sicurezza (`security-reviewer`): processi esterni (argomenti, file
    temporanei, tempi, memoria, uscita), file non fidati dati agli strumenti, esclusione
    dei riservati in ogni rotta, autorizzazione delle rotte dei documenti, log.
- [ ] **Verifica come la CI:** `pnpm lint`, `npx prettier --check . --end-of-line auto`,
  `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:verify`, `pnpm test:coverage`,
  `pnpm test:e2e`. Poi ricompilare e riavviare sito, area e API di sviluppo
  (`riavvia-sviluppo.ps1`).
- [ ] **1E-16 sul sito di sviluppo:** uno script fuori Git legge gli indirizzi dei 4 file
  riservati e dei loro `/download/` e verifica che rispondano `404`. Stampa solo i conteggi.
- [ ] **Parità:** le viste `/download/…` e delle categorie dei download nella matrice,
  catturate e confrontate con la cattura accettata, devono risultare identiche.
- [ ] **Non regressione**, con l'istanza di riferimento in sola lettura: redirect 181/181
  e stati 292 conformi. Poi si ferma l'istanza.
- [ ] Riga `PHASE:1G WAVE:1G-W6 STATUS:complete`; commit e push **su conferma**; controllo
  della CI.

## 8. Cosa la wave non fa

- Non crea né elimina documenti; non cambia slug né categorie dei download (S3).
- Non trasforma in collegamento il blocco `document` dentro le pagine, che mostra solo
  l'etichetta: è la resa approvata. Si osserva nel collaudo.
- Non tocca i 4 riservati: né file né righe. Smette solo di mostrarli all'area.
- Non ripulisce i file importati (D155) e non cambia la pulizia delle immagini (D145).
- Non porta `qpdf` e `ffmpeg` in produzione: l'immagine è della 1F, e ADR-012 lo chiede.
- Non aggiorna `next`: lo fa la `1G-W7` (DR-255).
- Non cambia il contatore dei download (D75, DR-161).
- Non scrive sul database di sviluppo, salvo la migrazione `0009` confermata e le righe
  delle sessioni degli script.
- Non crea né elimina caroselli, e non ne cambia titolo, chiave, impostazioni o i
  collegamenti delle slide (S17). Non cambia la resa del carosello sul sito.
- Non inserisce il blocco «Presentazione a scorrimento» in alcun contenuto vero: lo fa,
  se vuole, la redazione. Le prove usano solo contenuti sintetici.

## 9. Rischi

| Rischio | Mitigazione |
|---|---|
| Uno strumento manca in uno dei tre ambienti | rifiuto `503` senza scritture (S11); installazione in CI (S13); HO-032; requisito in ADR-012 per la 1F |
| `ffmpeg` analizza file non fidati con un codice molto ampio: anche con `-c copy` apre il decoder dichiarato nel file (revisione di sicurezza della T8, M2) | processo separato con ambiente ridotto, `-f mov` e `-protocol_whitelist file`, limite di scrittura `-fs`, tempo limite, tipo e limiti già controllati dalla W5. Limite di memoria in un contenitore separato (DR-263) ed elenco dei codec `h264`, `hevc`, `aac` (DR-264), prima della 1F. Isolamento e aggiornamenti del programma nell'immagine della 1F (ADR-012) |
| `qpdf` 11.9.0 di Ubuntu 24.04 non ha le opzioni scelte | D158 = A (DR-262): binario ufficiale 12.4.2 scaricato in CI, con l'impronta controllata |
| Licenze dei programmi | uso come processo separato, non collegato; verifica legale umana, non dichiarata |
| La pulizia riduce il rischio senza azzerarlo: restano gli EXIF delle immagini dentro i PDF e il testo visibile | limiti scritti in ADR-012 (S12); parere di chi segue la privacy del Centro, non una dichiarazione di conformità |
| La migrazione sul database di sviluppo | colonna nullabile, nessun dato cambia; copia di salvataggio e conferma |
| Le pagine `/download/` cambiano aspetto | `modified_at` nullo per i 4 importati; istantanea in T3 e cattura in T8 |
| Memoria e disco: file fino a 100 MB in memoria e su disco temporaneo | limiti e semaforo della W5; cartella temporanea sempre cancellata |
| Il seme e2e cambia e altre prove contano i media | le prove che contano i media si aggiornano nella T7, con il motivo |
| Un carosello inserito in una pagina vera cambia una vista della matrice approvata | è una scelta della redazione dopo il rilascio, non della wave; il collaudo della `1G-W8` lo prova su una pagina sintetica dell'ambiente di collaudo |
| Il carosello sul sito non è stato confrontato con la sorgente: nessuna pagina pubblicata lo mostrava (DR-123) | resa invariata da `1E`; il collaudo osserva la pagina sintetica; un difetto di resa va nella `1G-W9` |
| Il lavoro della wave cresce di circa metà (D153 = B) | T4b e T4c separate, ognuna con la propria revisione; T5 resta indipendente |
