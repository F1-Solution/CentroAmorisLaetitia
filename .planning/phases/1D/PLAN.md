# PLAN — Fase 1D · Importazione e CMS minimo

Piano eseguibile. Una riga in `PROGRESS.md` per ogni wave completata, un commit per
wave. Le wave si eseguono nell'ordine dichiarato; le dipendenze reali fra wave sono
nella tabella §3, perché non tutte sono lineari.

Contesto e criteri di uscita: [`CONTEXT.md`](CONTEXT.md).
Decisioni di dettaglio sul modello: [`BLOCK-MODEL.md`](BLOCK-MODEL.md).
Decisioni di dettaglio sull'importer: [`IMPORTER-DESIGN.md`](IMPORTER-DESIGN.md).

---

## 1. Wave

| Wave | Che cosa produce | Come si verifica |
|---|---|---|
| `1D-W0` | Questi quattro documenti; le righe DR-044…DR-048 nel registro delle decisioni; `docs/design/design-system.md`, documento unico che fonde la UI 1 «Scrivania» e la UX B «Aree di responsabilità» (HO-004 §10 punto 3), prodotto in questa wave e consumato dalla `1D-W7` | I cinque file esistono e non sono vuoti; il documento di design cita DR-044, DR-045, DR-047 e DR-048 e dichiara la tensione fra DR-045 e DR-047 senza risolverla. **Verificato il 2026-09-15**: `docs/design/design-system.md` esiste, 832 righe, e il suo capitolo 11 elenca sette decisioni non approvate, che si sommano a quelle del §7 di questo piano |
| `1D-W1` | `packages/blocks`: schemi Zod dei 14 tipi (`BLOCK-MODEL.md` §3), generatore dell'identificatore stabile (§4), sanificatore a elenco chiuso (§5), serializzatore deterministico (§6), componenti di resa React dei 14 tipi, test unitari | Ogni schema rifiuta ciò che deve rifiutare, con un test per tipo; `sanifica(sanifica(x)) === sanifica(x)` su tutta la batteria; `serializza(d) === serializza(d)` su documenti generati; ogni tipo ha un componente di resa e un test di resa |
| `1D-W2` | `apps/importer`: interfaccia a riga di comando con i cinque comandi e le opzioni comuni (`importer-spec.md` §3), lettore del dump (`IMPORTER-DESIGN.md` §3), lettore del formato serializzato di PHP, lettore di `uploads/`, gli **8 controlli di preflight**, `import_runs`/`import_issues`, rapporto testuale e JSON | `importer plan` senza argomenti termina senza scrivere, dimostrato dal confronto del database; il lettore estrae **53** tabelle e i conteggi per tabella coincidono con `wp-to-postgres-mapping.md` §1; ognuno degli 8 controlli è provato **fallendo**, su sorgenti sintetiche alterate; il numero di file attesi in `uploads/` è **misurato e scritto** (RD-07) |
| `1D-W3` | Convertitori: Gutenberg → blocchi, Divi → blocchi, HTML nudo → `rich_text`; fusione dei paragrafi contigui; conteggio del blocco di riserva e verifica della soglia; test unitari su fixture **sintetiche** | Ognuno dei 12 tipi Gutenberg e dei 10 shortcode Divi di `divi-shortcode-strategy.md` §2 e §4 ha almeno un caso di prova; un attributo sconosciuto produce una riga `import_issues` e **non** finisce in stile in linea; il calcolo della soglia è provato con numeri noti, sopra e sotto |
| `1D-W4` | Fasi di import 1–10: `settings`, `users`, `media` con caricamento nei due bucket, `terms`, `contents`, `relations`, `menus`, `seo`, `documents`, `sliders` | Ogni fase è una transazione: provata annullandola di proposito; l'errore su un elemento sintetico corrotto non ferma la fase e produce una riga `error`; `import_id_map` ha una riga per ogni entità creata; il caricamento del file avviene **prima** della riga in `media` |
| `1D-W5` | Fasi 11–16: `forms`, `submissions`, `legacy`, `redirects`, `rewrite`, `verify`; idempotenza completa; protezione del lavoro redazionale (`importer-spec.md` §6.3); `rollback` | Due `apply` di fila producono lo stesso stato, confrontato strutturalmente; un contenuto modificato dopo l'ultima esecuzione **non** viene sovrascritto e compare in testa al rapporto; dopo `rewrite`, **zero** occorrenze di `wp-content/uploads`; `rollback` riporta allo stato precedente e **rifiuta** di procedere se c'è stato lavoro redazionale |
| `1D-W6` | `apps/api`: moduli `auth`, `content`, `media`, `menu`, `seo`, `redirects`, `settings`, `terms` (ADR-001 §3 punto 1); sessioni opache e i 12 controlli di ADR-007 §3.1; permessi come unione dei ruoli; hook unico di audit; OpenAPI rigenerata e test | Ognuno dei 12 controlli di ADR-007 ha un test che passa, escluso il controllo 11 dichiarato fuori perimetro; la logica di autenticazione è **contata in righe** contro la soglia di ADR-007 §6, che dal 2026-09-21 è 500 (DR-070); un test fallisce se `openapi.json` cambia senza dichiarazione; ogni scrittura produce una riga di audit log |
| `1D-W7` | `packages/ui`: token del sistema di design in variabili CSS native (tema chiaro e scuro), carattere d'interfaccia self-hosted, primitive — bottone, campo, casella, badge di stato, tabella, pannello laterale, modale, notifica, stato vuoto, stato di errore | Ogni coppia di colori dichiarata in `ui-proposals.md` proposta 1 §2 è **ricalcolata** e confrontata con il valore dichiarato; l'anello di focus è presente su ogni elemento focalizzabile; nessuna primitiva importa da `packages/blocks`; test di componente per ogni primitiva |
| `1D-W8a` | `apps/admin`: accesso e uscita; **commutatore di ruolo** e schermata di scelta dell'area; guscio con navigazione per aree (Redazione, Impostazioni) e ambiente attivo dichiarato in ogni schermata; elenco dei contenuti con filtri e impaginazione. `apps/api` e `packages/db`: ruolo attivo nella sessione, restrizione dei permessi al ruolo attivo, rifiuto dei dati di un'altra area, ruolo nel registro delle operazioni, tabella delle **copie di lavoro** e sua migrazione | Il criterio 24 riscritto è eseguito nell'applicazione avviata: il commutatore esiste, l'ambiente attivo è scritto in parole compiute, un'azione non permessa nel ruolo attivo **non si mostra**; una richiesta su dati di un'altra area è **respinta dal servizio** anche con il permesso, provato con un test; ogni riga del registro porta il ruolo |
| `1D-W8b` | `apps/admin`: editor del contenuto con salvataggio automatico sulla copia di lavoro e pubblicazione su comando esplicito; editor dell'albero dei blocchi; TipTap dentro `rich_text` con lo schema del §3.1 di ADR-006; editor del blocco di riserva con evidenziazione; anteprima con i componenti di `packages/blocks` | I criteri 1D-28, 1D-29, 1D-30 e 1D-36 sono eseguiti nell'applicazione avviata; l'anteprima importa **gli stessi** componenti del sito, verificato dal grafo delle importazioni; incollare markup non ammesso lo **ripulisce visibilmente**, non in silenzio; aprire e salvare senza modifiche non cambia il **contenuto**, provato sul contenuto e non sulla bozza |
| `1D-W9` | `apps/admin`: media con caricamento, sostituzione, eliminazione, testo alternativo e didascalia; menu con annidamento e i quattro casi di visibilità; SEO per contenuto e template globali; redirect; impostazioni globali | I criteri 1D-31…1D-35 sono eseguiti nell'applicazione avviata; i quattro casi di `menu_items.visibility` sono tutti impostabili e il vincolo che vieta i ruoli dove non servono **fallisce** quando deve |
| `1D-W10` | Test di andata e ritorno su tutti i contenuti; test end-to-end Playwright sui flussi del CMS; test di idempotenza dell'import su sottoinsieme **sintetico**; misura della copertura | L'andata e ritorno non produce differenze; i flussi end-to-end passano contro le applicazioni avviate; la copertura è misurata e riportata; la CI esegue **solo** le suite sintetiche |
| `1D-W11` | Esecuzione reale in locale: `plan`, poi `apply --confirm`, poi `apply --confirm` di nuovo; rapporto di completezza in `docs/migration/import-completeness-report.md` — **soli conteggi** | Tutti i conteggi di `database-schema.md` §6 coincidono; le soglie del blocco di riserva sono rispettate; l'esito è `success`; il rapporto viene **letto** per verificare che non contenga dati personali prima di essere scritto nel repository |
| `1D-W12` | `AUDIT.md`: i 28 criteri di uscita eseguiti uno per uno, difetti trovati e corretti, dipendenze installate e ciò che le autorizza, stato del gate | Ogni criterio ha un esito **eseguito**, non affermato; le dipendenze non previste nel §4 di questo piano sono dichiarate con il motivo, come in 1C |

## 2. Chi esegue, che cosa tocca

Regola: **Sonnet** per il codice, **Haiku** per la documentazione. Le wave che
producono un documento ma il cui contenuto è l'esito di controlli eseguiti restano a
Sonnet, perché l'esecuzione viene prima della stesura.

| Wave | Agente | File toccati |
|---|---|---|
| `1D-W0` | agente di pianificazione per i quattro documenti di fase; **Haiku** per `docs/design/design-system.md` | `.planning/phases/1D/*`, `docs/decisions/decision-register.md`, `docs/design/design-system.md`, `ROADMAP.md`, `PROGRESS.md` |
| `1D-W1` | **Sonnet** | `packages/blocks/**` (nuovo), `packages/config` se serve una configurazione di lint, `pnpm-workspace.yaml` |
| `1D-W2` | **Sonnet** | `apps/importer/**` (nuovo), `.gitignore` per la cartella delle fixture reali, `package.json` di radice per gli script |
| `1D-W3` | **Sonnet** | `apps/importer/src/convert/**`, fixture sintetiche in `apps/importer/tests/fixtures/**` |
| `1D-W4` | **Sonnet** | `apps/importer/src/stages/**`, `apps/importer/src/persistence/**`, `packages/db` se emergono correzioni di schema |
| `1D-W5` | **Sonnet** | `apps/importer/src/stages/**`, `apps/importer/src/rollback/**`, `apps/importer/src/report/**` |
| `1D-W6` | **Sonnet** | `apps/api/src/**`, `packages/contracts/src/**`, `packages/db/src` in sola lettura |
| `1D-W7` | **Sonnet** | `packages/ui/**` |
| `1D-W8a` | **Sonnet** | `apps/admin/**`, `packages/ui` per le primitive mancanti, **`apps/api/src/**`, `packages/db/**` e `packages/contracts/src/**`**: DR-067 e DR-068 allargano il perimetro oltre quanto questo piano dichiarava, ed è scritto nelle note del Round 11 del registro |
| `1D-W8b` | **Sonnet** | `apps/admin/**`, `packages/ui` per le primitive mancanti, **`packages/blocks/src/ids.ts` e `import-ids.ts`**: la derivazione degli identificatori dalla sorgente usa `node:crypto`, che nel bundle di un browser non esiste, e ADR-006 §3.3 impone che l'anteprima importi lo stesso pacchetto del sito. I due usi sono separati in due moduli e l'importer prende il suo da `@amoris/blocks/import-ids`. Nessun comportamento cambia: lo dichiara un test sul grafo delle importazioni |
| `1D-W9` | **Sonnet** | `apps/admin/**`, **`apps/api/src/**` e `packages/ui/src/layout/**`**: il Round 14 allarga il perimetro oltre quanto questa riga dichiarava. DR-074 aggiunge la rotta che sostituisce il file di un media, DR-075 la rotta che elenca i ruoli, DR-077 estende il controllo di eliminazione ai media citati dentro i blocchi — tre cose che i criteri 1D-31 e 1D-32 pretendono e che l'interfaccia da sola non può fare. In `packages/ui` entrano due correzioni: `MenuTreeEditor` riconosce le voci che puntano a una categoria, e `Dialog` e `SidePanel` smettono di riportare il fuoco al primo campo a ogni resa, difetto della `1D-W7` che rendeva impossibile scrivere nel secondo campo di un pannello. È la terza wave della fase che allarga il perimetro, dopo la `1D-W8a` e la `1D-W8b` |
| `1D-W10` | **Sonnet** | `apps/admin/tests/**`, `tests/e2e/**`, `.github/workflows/ci.yml` |
| `1D-W11` | **Sonnet** | nessun file sorgente; scrive solo `docs/migration/import-completeness-report.md`. La sorgente resta in sola lettura |
| `1D-W12` | **Sonnet** per l'esecuzione dei controlli e la stesura | `.planning/phases/1D/AUDIT.md`, correzioni puntuali dove i controlli falliscono |

## 3. Dipendenze fra wave

| Wave | Dipende da | Perché |
|---|---|---|
| `1D-W1` | `1D-W0` | `BLOCK-MODEL.md` è ciò che rende la wave eseguibile senza inventare |
| `1D-W2` | `1D-W0` | indipendente dal modello a blocchi: legge la sorgente, non converte |
| `1D-W3` | `1D-W1`, `1D-W2` | i convertitori producono blocchi validati e leggono dalla sorgente |
| `1D-W4` | `1D-W3` | la fase `contents` chiama i convertitori |
| `1D-W5` | `1D-W4` | `rewrite` e `verify` operano su ciò che le fasi precedenti hanno scritto |
| `1D-W6` | `1D-W1` | le rotte di scrittura validano i blocchi con gli stessi schemi Zod |
| `1D-W7` | `1D-W0` | dipende dal documento di design, **non** dal codice: può procedere in parallelo a `1D-W2`…`1D-W5` |
| `1D-W8a` | `1D-W6`, `1D-W7` | guscio e commutatore hanno bisogno dell'API e delle primitive; non dipende da `packages/blocks` |
| `1D-W8b` | `1D-W1`, `1D-W8a` | editor e anteprima hanno bisogno dei blocchi e del guscio. D4 è chiusa da DR-069: la wave è sbloccata |
| `1D-W9` | `1D-W8a` | riusa il guscio e le primitive |
| `1D-W10` | `1D-W5`, `1D-W9` | prova l'insieme |
| `1D-W11` | `1D-W10` | non si esegue l'import vero prima che i test passino |
| `1D-W12` | tutte | è l'audit |

Le due catene — importer (`W2`→`W5`) e interfaccia (`W7`→`W9`) — si incontrano solo
in `W10`. `W6` sta in mezzo e serve a entrambe.

## 4. Struttura del repository al termine

Deriva da ADR-008 §3.1. In **grassetto** ciò che questa fase crea.

```
apps/
  web/        Next.js — sito pubblico. Invariato in questa fase: nessuna rotta nuova.
  admin/      Next.js — area amministrativa. Due aree: Redazione, Impostazioni.
  api/        Fastify — otto moduli di dominio, sessioni, audit, OpenAPI.
  importer/   **nuovo** — programma a riga di comando della migrazione.
packages/
  config/     TypeScript, ESLint e Prettier condivisi.
  db/         schema Drizzle e migrazioni. Invariato, salvo correzioni emerse.
  contracts/  schemi Zod condivisi fra API e client.
  blocks/     **nuovo** — modello dei 14 blocchi, sanificatore, serializzatore,
              componenti di resa. Usato da web, admin e importer.
  ui/         **riempito** — token e primitive dell'area amministrativa.
              Non importato da apps/web.
infra/
  compose/    invariato.
```

Dentro `apps/importer`, la struttura dei moduli e la responsabilità di ciascuno sono
in `IMPORTER-DESIGN.md` §2.

## 5. Dipendenze previste, e la ADR che le autorizza

Nessun pacchetto entra senza una riga in questa tabella. Le aggiunte non previste si
dichiarano in `AUDIT.md`, con il motivo, come è stato fatto in 1C.

| Pacchetto | Dove | Autorizzato da |
|---|---|---|
| `zod` | `packages/blocks`, `packages/contracts`, `apps/importer` | ADR-001 §3; ADR-005 §3.1 impone la validazione Zod in scrittura e in lettura |
| `parse5` | `packages/blocks` | ADR-005 §3.5 richiede un elenco chiuso applicato a HTML reale, e ADR-006 §7 un'andata e ritorno deterministica. Serve un analizzatore conforme alla specifica; il serializzatore resta **nostro**, perché l'ordine degli attributi e la forma dei tag vuoti sono decisioni di `BLOCK-MODEL.md` §6 e non possono essere delegate |
| `@aws-sdk/client-s3` | `apps/importer`, `apps/api` | ADR-004 §3.6 e DR-005 impongono uno storage S3-compatible, ma **non nominano alcuna libreria**. Si dichiara qui: client ufficiale, compatibile con MinIO, mantenuto |
| `@node-rs/argon2` **oppure** `argon2` | `apps/api` | ADR-007 §5: «una libreria per Argon2id. Nient'altro». La scelta fra le due si fa in `1D-W6` sul criterio della compilazione su Windows e in container, e si dichiara nell'audit |
| `@fastify/cookie` | `apps/api` | ADR-001 §5; ADR-007 §3.1 controllo 3. Prevista dal piano di 1C e **deliberatamente non installata** allora |
| `@fastify/rate-limit` | `apps/api` | ADR-001 §5; ADR-007 §3.1 controllo 8 |
| `@fastify/multipart` | `apps/api` | ADR-001 §5; criterio 1D-31, caricamento dei media |
| `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` e le sole estensioni che coprono l'elenco di ADR-005 §3.5 — installate il 2026-09-21: `@tiptap/extension-image`, `@tiptap/extension-table`, `@tiptap/extension-subscript`, `@tiptap/extension-superscript`. Sottolineato e collegamento sono già in `starter-kit`; citazione, codice e blocco di codice sono **spenti**, perché fuori dall'elenco chiuso | `apps/admin` | ADR-006 §5, che le nomina |
| ~~`codemirror`, `@codemirror/lang-html`, `@codemirror/state`, `@codemirror/view`~~ | ~~`apps/admin`~~ | ADR-006 §3.4: il blocco di riserva si modifica «in un'area di testo con evidenziazione della sintassi». **Non installati nella `1D-W8b`, e il motivo si dichiara**: `HtmlFallbackEditor` della `1D-W7` realizza già area di testo, evidenziazione e avviso permanente con una funzione propria di una ventina di righe, e il criterio di uscita 23 è soddisfatto da quella. Quattro pacchetti che non aggiungono nulla di richiesto sono una dipendenza inutile. Restano autorizzati: se l'evidenziazione propria si rivelasse insufficiente, entrano senza bisogno di una decisione nuova |
| `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0 — **installati il 2026-09-21** | `apps/admin` | **DR-069**, 2026-09-20. Nessuna ADR la autorizzava: la riga qui sotto fra le cose scritte in casa diceva l'opposto ed è superata. Scelta fra le librerie di trascinamento perché porta un **sensore da tastiera** di serie, quindi il percorso accessibile che il §9.3 del sistema di design impone nasce con il trascinamento e non dopo |
| `@radix-ui/react-*` — le sole primitive usate: menu, dialogo, pannello, selettore | `packages/ui` | DR-044, che sceglie la proposta 1; `ui-proposals.md` proposta 1 §9 le nomina |
| `@tanstack/react-table` | `packages/ui` | stessa fonte: proposta 1 §9, «solo logica di tabella» |
| carattere **Inter** variabile, `woff2`, sottoinsieme latino, **self-hosted** | `packages/ui` | DR-048 (carattere distinto da quello del sito pubblico); `ui-proposals.md` proposta 1 §3. Non è un pacchetto npm: è un file nel repository, con la sua licenza |
| `drizzle-orm`, `postgres` | `apps/importer` | ADR-002 §5; ADR-008 §3.3 regola 4, che ammette l'importer come unica eccezione all'accesso diretto al database |
| `tsx` | `apps/importer` | già in uso in `packages/db` e `apps/api` dalla 1C, per eseguire TypeScript senza un passo di compilazione. Non entra in produzione |

**Aggiunta del 2026-09-20 — DR-068 non introduce alcun pacchetto.** La copia di
lavoro è una tabella e una rotta: si realizza con `drizzle-orm` e Zod, già in
tabella. Nessuna libreria di salvataggio automatico, nessuna di gestione dello stato
oltre a quanto `apps/admin` già usa.

**Scritto in casa, senza pacchetto:**

| Componente | Perché non una libreria |
|---|---|
| Tokenizzatore del dump SQL | `IMPORTER-DESIGN.md` §3. Nessun pacchetto npm copre il dialetto di `mysqldump` con la fedeltà richiesta, e il codice che legge la sorgente autorevole deve essere leggibile per intero |
| Lettore del formato serializzato di PHP | circa 150 righe, formato semplice ma con lunghezze in **byte**. I valori contengono dati personali: un pacchetto in più è superficie in più per nessun guadagno |
| Serializzatore blocchi → HTML | `BLOCK-MODEL.md` §6: la determinatezza dipende da scelte nostre, non delegabili |
| ~~Spostamento dei blocchi nell'editor~~ | ~~comandi espliciti invece del trascinamento: nessuna libreria~~ — **superata il 2026-09-20 da DR-069**: si fa il trascinamento e la libreria entra in tabella qui sopra |

**Non si installano, ed è una scelta:** nessuna libreria di invio email — ADR-010 §4.5
la colloca in Fase 1F; nessuna libreria di elaborazione immagini — ADR-004 §3.2 vieta
di rigenerare le varianti; nessun client MySQL — vedi `IMPORTER-DESIGN.md` §3;
~~nessuna libreria di trascinamento~~ (superata da DR-069); nessuna libreria di componenti «vestita»
(`ui-proposals.md` proposta 1 §9).

## 6. Cosa questa fase non dimostrerà

Va detto adesso, per non doverlo dire dopo.

- **Non dimostra la parità visiva.** Non esiste una sola pagina pubblica nuova da
  confrontare. La parità è la Fase 1E e la sua prova è
  `docs/qa/visual-parity-report.md`.
- **Non dimostra che il CSS di Divi sia riproducibile.** `divi-shortcode-strategy.md`
  §6 dice che convertire i blocchi non basta: i design token si estraggono dal CSS
  reso, ed è lavoro della 1E. Questa fase conserva i **valori** nelle proprietà dei
  blocchi, non li dipinge.
- **Non dimostra che un redattore sappia usare il CMS.** Dimostra che le operazioni
  sono possibili; che siano comprensibili lo collauda la Fase 1G con una persona vera.
- **Non dimostra che i form funzionino.** Le 25 definizioni e le 425 compilazioni si
  importano; nessun form viene reso, nessun invio viene accettato, nessuna email parte.
- **Non dimostra che il sistema sia sicuro.** L'autenticazione esiste e ha i suoi
  test, ma la security review è della Fase 1F (ADR-007 §8).
- **Non dichiara alcuna conformità GDPR o fiscale.** MI-06 resta aperta e richiede un
  professionista.
- **Non fa avanzare il gate per intero.** Concorre alle condizioni 3, 4, 5 e 7 di
  `acceptance-criteria.md` §3, che restano da confermare dalla 1E e dalla 1G. Le
  condizioni sulla parità e sulla produzione restano intatte.
- **Non tocca la sorgente.** Al termine `source-private/` è byte per byte quella di
  prima, e l'audit lo verifica.

## 7. Conferme richieste all'utente durante la fase

| # | Quando | Che cosa | Se manca |
|---|---|---|---|
| 1 | ~~prima di `1D-W8`~~ | ~~La lettura delle aree dopo DR-047~~ — **chiusa il 2026-09-15 da DR-050**, che supera DR-047 e adotta «un solo ruolo attivo per volta». Le aree tornano a essere contesto di permesso e serve un commutatore di ruolo (`CONTEXT.md` §8 punto 2) | — |
| 2 | ~~prima di `1D-W8b`~~ | ~~Comandi espliciti invece del trascinamento per spostare i blocchi~~ — **chiusa il 2026-09-20 da DR-069**: si fa il **trascinamento**, con il percorso da tastiera che resta obbligatorio. Entra una libreria, dichiarata al §5 | — |
| 3 | **alla `1D-W11`, non prima** | L'esecuzione reale dell'import su dati reali. `CLAUDE.md` la colloca fra le azioni a conferma obbligatoria: «import reali non dry-run». Va mostrato comando, file coinvolti, impatto, backup e rollback, verifica successiva. **DR-072 stabilisce come ci si arriva**: `plan` si esegue senza conferma perché non scrive, il suo rapporto viene **letto** e mostrato, e la conferma riguarda solo `apply --confirm`, data sui conteggi veri. La decisione **non** è una pre-autorizzazione | La wave non parte. `plan` resta eseguibile senza conferma, perché non scrive |
| 3-bis | **prima di `1D-W7`** | I tre prestiti dalle altre proposte di UI. L'utente ha chiesto di vederli descritti prima di scegliere (DR-053) | La wave usa la proposta 1 pura e lo dichiara nell'audit |
| 4 | ~~entro l'inizio della 1E~~ | ~~Il trattamento degli spazi di Divi e il divieto di stile in linea (`CONTEXT.md` §8 punto 1)~~ — **chiusa il 2026-09-21 da DR-071**: sole proprietà personalizzate CSS. Resta da attuare la riformulazione di ADR-005 §3.3 regola 2, prima dell'inizio della 1E | — |
| 5 | se accade | Se il lettore del dump non regge la verifica dei conteggi, la strada alternativa introduce un client MySQL locale (`IMPORTER-DESIGN.md` §3.5): è una dipendenza che nessuna ADR autorizza | Ci si ferma e si chiede |
| 6 | se accade | Se la soglia del blocco di riserva viene superata, la conversione va rivista **prima** della 1E (ADR-005 §3.4): è una decisione sull'ambizione della conversione, non un dettaglio | Ci si ferma e si chiede |
| 7 | ~~se accade~~ | ~~Se la logica di autenticazione supera le 300 righe, ADR-007 §6 impone di adottare Better Auth «senza discutere»~~ — **accaduto e chiuso due volte**: misurata nella `1D-W6` a 342 righe il nucleo e 684 il totale, risolta il 2026-09-20 da **DR-066** con **deroga motivata**; risalita a 437 e 859 con la `1D-W8a` e ripresentata, risolta il 2026-09-21 da **DR-070**, che porta la soglia a **500**. Con 500 il nucleo la rispetta e il totale no: la deroga di DR-066 resta in vigore per il totale. Better Auth resta l'opzione del riesame di ADR-007 §3.3 | — |

Restano a conferma obbligatoria e **non** avvengono in questa fase: deploy, DNS,
certificati, configurazione e invio di email, pagamenti, migrazioni su database di
produzione, cancellazioni, modifiche a dati reali fuori dal database locale.

## 8. Assunzioni vietate e decisioni richieste

Le tre decisioni aperte sono quelle di [`CONTEXT.md`](CONTEXT.md) §8, riprese come
conferme nel §7 di questo piano ai punti 1, 2 e 4. Questo documento non ne aggiunge
di nuove: le voci 5, 6 e 7 del §7 non sono decisioni da prendere adesso, ma bivi
dichiarati in anticipo, da portare all'utente **se** si presentano.
