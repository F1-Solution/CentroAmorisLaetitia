# Piano della wave 1E-W7 — Verifiche non visive e manuali

> **Per chi esegue:** sotto-skill richiesta `superpowers:executing-plans` (o
> `superpowers:subagent-driven-development`). Passi con caselle `- [ ]`.
> Protocollo `PROGRESS.md`: un commento datato dopo ogni attività, una sola riga
> `STATUS:complete` a fine wave, dopo l'audit dei criteri del §1.

Scritto il 2026-10-17, dopo la chiusura della `1E-W6` (DR-165, commit `1a107c0`).

**Obiettivo:** misurare e registrare, URL per URL, ciò che il confronto delle
immagini non dimostra — metadati, redirect, interazioni, accessibilità di base,
console e rete — sul sito nuovo avviato con l'import reale in locale.

**Architettura:** script di misura `tsx` accanto a quelli della `1E-W1`…`1E-W6`
in `tests/visual/` (decisione **D77**), che leggono il sito nuovo e, dove serve un
termine di paragone, l'istanza di riferimento congelata. Le funzioni pure
(estrazione, classificazione) stanno in moduli propri con prove `tsx --test`.
Gli esiti vanno in `docs/qa/verifiche/` come CSV per URL più un riepilogo.

**Stack:** Playwright 1.63.0 già fissato (`tests/visual/condizioni.ts`), `tsx`,
runner di prova di Node. **Nessuna dipendenza nuova.**

**Riferimenti:** `CONTEXT.md` §7, `PLAN.md` §1, `docs/qa/visual-regression-plan.md`
§8–§10, `docs/qa/acceptance-criteria.md` §6, `docs/migration/wp-to-postgres-mapping.md` §3.2.

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| 1E-8 | Metadati | 117 URL di `seo-rendered-baseline.csv`, 11 campi per URL, ogni differenza classificata `identico` / `correzione DR-040` / `difforme`; più `robots.txt`, 6 sitemap, 2 feed (§9 del piano del confronto) |
| 1E-9 | Redirect nei due sensi | **181** regole (170 + 4 + 6 + 1 a prefisso provata su 20 file): stato e destinazione senza seguire; controllo simmetrico sui 293 indirizzi della matrice |
| 1E-6 | Verifiche manuali | 81 URL ad alta priorità × le 9 voci del §8, esito per URL e per voce |
| 1E-17 | Console e rete | 81 URL × 6 viewport: zero errori in console, zero richieste fallite, zero richieste a terzi |
| A-1…A-8 | Accessibilità di base | esito per URL sugli 81, A-8 sui colori estratti |

Ogni `difforme` o `non superato` è elencato con causa; nessuno si corregge senza
l'analisi d'impatto approvata (metodo della `1E-W6`). La wave è completa quando
ogni cella ha un esito eseguito e le difformità sono **approvate o corrette**.

## 2. Fatti accertati il 2026-10-17

| Fatto | Fonte |
|---|---|
| Sito nuovo su `127.0.0.1:3200` e istanza di riferimento su `localhost:8088` rispondono 200; `amoris-dev-db`, `amoris-dev-objects`, `wpref-*` avviati | `docker ps`, `curl` |
| Gli 81 URL ad alta priorità sono 78 pagine, 2 di sistema, 1 di errore | `url-matrix.csv`, colonna `priorita_parita` |
| La matrice ha 117 indirizzi 200, 173 301, 2 302, 1 404 | idem, `stato_misurato` |
| Le regole di redirect sono **181**, non 180: DR-065 ha recuperato l'allegato 341 | mapping §3.2 |
| `tests/visual/stati-matrice.py` verifica già stato e destinazione dei 292 indirizzi; non copre il campione dei 20 file a prefisso né il senso inverso come controllo dichiarato | lettura del file |
| `tests/visual/verifica-sito.ts` copre già menu (1E-7), scorrimento orizzontale, `lang` (A-6), service worker (1E-12) | lettura del file |
| `metadati-riferimento.ts` contiene l'estrazione degli 11 campi dall'HTML servito senza JavaScript | lettura del file |
| Le prove end-to-end (`tests/e2e`) girano su un seme **sintetico**: gli 81 URL reali lì non esistono | `playwright.config.ts`, `prepara.ts` |
| A-8: il colore d'accento non supera il contrasto; DR-115 ne rinvia la correzione a dopo l'approvazione della parità | DR-115 |
| La macchina ha interrotto due volte le catture per memoria (HO-014): gli script vanno a un browser, sequenziali, ripartibili | `PROGRESS.md` 1E-W6 |

## 3. Struttura dei file

| File | Responsabilità |
|---|---|
| `tests/visual/metadati.ts` (nuovo) | estrazione degli 11 campi da un HTML; spostata da `metadati-riferimento.ts`, che la importa |
| `tests/visual/classifica-metadati.ts` (nuovo) | `classifica(riferimento, sito): Esito[]` con le regole DR-040 |
| `tests/visual/verifica-metadati.ts` (nuovo) | 117 URL + `robots.txt`, sitemap, feed → `docs/qa/verifiche/metadati.csv` |
| `tests/visual/verifica-redirect.ts` (nuovo) | 181 regole e controllo simmetrico → `docs/qa/verifiche/redirect.csv` |
| `tests/visual/verifica-interazioni.ts` (nuovo) | voci 1, 2, 3, 5, 6, 7, 8 del §8 sugli 81 URL, sito e riferimento → `interazioni.csv` + catture degli stati in `docs/qa/screenshots/verifiche/` (fuori da Git, DR-106) |
| `tests/visual/verifica-accessibilita.ts` (nuovo) | A-1…A-7 e voce 4 (form) del §8 → `accessibilita.csv` |
| `tests/visual/verifica-console.ts` (nuovo) | 1E-17 → `console.csv` |
| `tests/visual/contrasto.ts` (nuovo) | rapporto di contrasto WCAG da due colori; A-8 sui token di `apps/web/src/styles/tokens.css` |
| `tests/visual/prove/*.test.ts` (nuovo) | prove delle funzioni pure, `pnpm exec tsx --test "tests/visual/prove/*.test.ts"` |
| `docs/qa/verifiche/riepilogo.md` (nuovo) | tabella per criterio, difformità, cause |

Nessun file di `apps/**` o `packages/**` si tocca in questa wave se non dopo
un'analisi d'impatto approvata.

## 4. Attività

### T1 — Metadati (1E-8)

**File:** `tests/visual/metadati.ts`, `classifica-metadati.ts`,
`verifica-metadati.ts`, `prove/classifica-metadati.test.ts`; modifica di
`metadati-riferimento.ts` (solo l'import).

**Interfacce prodotte:**
`leggiMetadati(page, indirizzo): Promise<{ valori: Metadati; byte: number }>` (lettura nel browser senza JavaScript, come nella `1E-W1`) ·
`classificaCampo(campo: Campo, rif: string, sito: string): { esito: 'identico'|'correzione DR-040'|'difforme'; motivo: string }`

- [ ] Spostare l'estrazione da `metadati-riferimento.ts` a `metadati.ts`; rieseguire `metadati-riferimento.ts` e controllare che `docs/qa/riferimento/metadati.csv` resti identico (`git diff --exit-code`).
- [ ] Scrivere le prove del classificatore, prima del codice. Casi minimi:
  `h1` vuoto in sorgente e presente nel sito per una delle 29 pagine → `correzione DR-040`;
  description vuota in sorgente (S-2) e generata nel sito → `correzione DR-040`;
  suffisso di paginazione inglese → italiano → `correzione DR-040`;
  spazi doppi o entità diverse con lo stesso testo normalizzato → `identico`;
  `title` diverso per una parola → `difforme`;
  `og_image` con `/wp-content/uploads/` contro `/media/` stesso file → `identico`.
- [ ] `pnpm exec tsx --test "tests/visual/prove/*.test.ts"` → FAIL, poi implementare, → PASS.
- [ ] `verifica-metadati.ts`: per ogni URL 200 della baseline, HTML senza JavaScript dal sito nuovo, classifica, scrive una riga per URL×campo; poi `robots.txt` (testo), indice della sitemap e figlie (numero di URL per figlia), 2 feed (numero di elementi).
- [ ] Eseguire `SITO=http://127.0.0.1:3200 pnpm exec tsx tests/visual/verifica-metadati.ts`. Atteso: 117 URL letti; il numero di `difforme` riportato.
- [ ] Commento in `PROGRESS.md`.

### T2 — Redirect nei due sensi (1E-9)

**File:** `tests/visual/verifica-redirect.ts`, `prove/redirect.test.ts`.

- [ ] Prove della funzione `attesoPer(riga): { stato: number; destinazione: string }` sui 4 gruppi del §10 e sulla traduzione `/wp-content/uploads/` → `/media/`.
- [ ] Le 181 regole si leggono dalla lettura pubblica dei redirect dell'API (non dal database); per ognuna `fetch` con `redirect: 'manual'`: stato 301 e `location` uguale all'atteso.
- [ ] Prefisso: 20 file a campione presi con seme fisso dall'elenco dei media pubblici, stampato nel CSV per la ripetibilità.
- [ ] Controllo simmetrico sui 293 indirizzi: nessun `200` della matrice risponde 3xx, nessun `301` risponde 200; i 2 `302` e il `404` hanno l'esito registrato a parte.
- [ ] Eseguire; atteso 181/181 e 0 inversioni, altrimenti elenco.
- [ ] Commento in `PROGRESS.md`.

### T3 — Interazioni del §8 (1E-6, voci 1, 2, 3, 5, 6, 7, 8)

Metodo secondo **D76**. Con l'opzione raccomandata ogni voce si misura sul sito
**e** sull'istanza di riferimento, e si confronta:

| Voce | Misura automatica |
|---|---|
| 1 hover | stili calcolati (`color`, `background-color`, `text-decoration`, `opacity`, `border-color`) prima e durante il passaggio del puntatore su voci di menu, bottoni, link del contenuto; uguali alla sorgente |
| 2 menu | apertura di ogni sottomenu al passaggio e da tastiera, terzo livello visibile, chiusura all'uscita |
| 3 mobile | a 390 e 360: apertura, scorrimento della lista, chiusura; nessuna voce fuori schermo |
| 5 caratteri | `document.fonts` caricati entro il primo disegno; nessuno spostamento: posizione del primo `h1`/paragrafo identica fra 100 ms e caricamento completo (CLS da `PerformanceObserver` = 0) |
| 6 immagini | per ogni `img` visibile: `naturalWidth` servita contro quella scelta dalla sorgente alla stessa viewport (ADR-004 §3.2) |
| 7 punti di rottura | secondo **D78** |
| 8 incorporati | 7 video e 1 mappa: copertina, clic, iframe del dominio deciso (DR-121, DR-122) creato solo dopo il clic |

- [ ] Prove delle funzioni pure: confronto di stili con tolleranza 0 sui colori normalizzati in `rgb()`; `cls(eventi)`.
- [ ] Script sequenziale, un browser, ripresa da un file di stato in `docs/qa/screenshots/verifiche/stato.json` (lezione di HO-014).
- [ ] Catture degli stati (hover, menu aperto, menu mobile) per il giudizio dell'utente, se D76 = A.
- [ ] Eseguire; esito per URL × voce in `interazioni.csv`.
- [ ] Commento in `PROGRESS.md`.

### T4 — Accessibilità di base e form (A-1…A-7, voce 4 e 9 del §8)

| Criterio | Misura |
|---|---|
| A-1 | Tab ripetuto dall'inizio alla fine: ogni elemento interattivo visibile raggiunto, nessuna trappola (si torna all'inizio) |
| A-2 | a ogni passo: contorno o cambio di stile misurabile sull'elemento a fuoco; ordine del fuoco monotono con la posizione visiva (alto→basso, sinistra→destra per riga) |
| A-3 | menu mobile aperto e chiuso con Invio/Spazio ed Esc a 390 e 360 |
| A-4 | `img` senza `alt` = errore; `alt` vuoto ammesso solo per le decorative (elenco nel CSV per la revisione) |
| A-5 | ogni `input`/`select`/`textarea` dei 23 form con `label[for]`, `aria-label` o `aria-labelledby` |
| A-6 | ripresa da `verifica-sito.ts` |
| A-7 | un solo `h1`, nessun salto di livello maggiore di uno |
| §8 voce 4 | per ogni form: invio vuoto → messaggi di validazione visibili; invio con **dati sintetici** → messaggio di conferma; nessuna email (DR-108) |

- [ ] Prove delle funzioni pure (ordine visivo, salti di titolo).
- [ ] Le compilazioni sintetiche si cancellano dal database locale **solo su conferma** (è una cancellazione): handoff dedicato se servono.
- [ ] Eseguire; `accessibilita.csv`.
- [ ] Commento in `PROGRESS.md`.

### T5 — Console e rete (1E-17)

- [ ] Sugli 81 URL alle 6 viewport: `console` di tipo `error`, `pageerror`, `requestfailed`, risposte ≥ 400, richieste a host diversi dal sito.
- [ ] Atteso 0 in ogni colonna; altrimenti elenco con URL e risorsa.
- [ ] Commento in `PROGRESS.md`.

### T6 — Contrasto (A-8)

- [ ] Prova di `contrasto(a, b)` su coppie note (nero/bianco = 21; `#777`/bianco ≈ 4,48).
- [ ] Tutte le coppie testo/sfondo **usate** nelle pagine, misurate sugli stili calcolati degli 81 URL, non solo sui token.
- [ ] Classificazione: conforme (≥ 4,5:1, ≥ 3:1 per testo grande) / non conforme già decisa da DR-115 / non conforme nuova.

### T7 — Riepilogo, difformità e audit della wave

- [ ] `docs/qa/verifiche/riepilogo.md`: una tabella per criterio con superati/non superati, e le difformità con causa.
- [ ] Le difformità vanno all'utente nello stesso formato del report della `1E-W6` (artifact con scelta per voce), secondo **D79**.
- [ ] Le correzioni approvate seguono il metodo della `1E-W6`: analisi d'impatto, prove, `lint`/`typecheck`/`test` verdi, 1E-19 rieseguito.
- [ ] Audit: ogni criterio del §1 rieseguito dopo l'ultima correzione; solo allora la riga `STATUS:complete` e la richiesta di commit.

## 5. Rischi

| id | Rischio | Mitigazione |
|---|---|---|
| R7-1 | Arresto per memoria a metà di una verifica lunga | un browser, sequenziale, stato su file, ripresa dall'ultimo URL |
| R7-2 | Difetti della sorgente (Divi) misurati come difetti del sito nuovo | ogni verifica interattiva gira anche sul riferimento; un difetto presente in entrambi si classifica a parte (D79) |
| R7-3 | Le prove dei form scrivono compilazioni nel database locale | solo dati sintetici; cancellazione su conferma |
| R7-4 | Una correzione di accessibilità cambia la resa e rompe la parità accettata | ogni correzione rifà il confronto delle viste toccate |
| R7-5 | Hover e fuoco giudicati solo da numeri | catture degli stati sottoposte all'utente (D76) |

## 6. Assunzioni dichiarate

- I due siti restano avviati per tutta la wave; nessun import viene rieseguito se
  non per una correzione approvata.
- Le 181 regole di redirect sono quelle della lettura pubblica dell'API; se il loro
  numero differisce da 181 ci si ferma.
- Le viewport sono quelle di `condizioni.ts` (DR-106).

## 7. Decisioni aperte

| id | Decisione | Opzioni | Raccomandazione |
|---|---|---|---|
| **D76** | Come si eseguono le «verifiche manuali» del §8 | **A** misura automatica sul sito e sul riferimento + catture degli stati giudicate dall'utente in un report · **B** solo misura automatica · **C** l'utente le esegue a mano con una lista (handoff, 81 URL × 9 voci) | **A** |
| **D77** | Dove vivono gli script | **A** `tests/visual/`, sui dati reali in locale, come le wave precedenti; deviazione da `PLAN.md` §2 registrata · **B** `tests/e2e/`, come scritto nel piano: non praticabile, il seme è sintetico e i dati reali nel seme sono vietati | **A** |
| **D78** | Significato di «senza salti» nel ridimensionamento 1440→360 | **A** passo di 10 px su sito e riferimento: nessuno scorrimento orizzontale e stesse larghezze di passaggio dei layout (menu mobile, colonne) · **B** passo di 10 px sul solo sito, solo scorrimento orizzontale · **C** come A più l'altezza della pagina a ogni passo con tolleranza | **A** |
| **D79** | Difetti di accessibilità ereditati dalla sorgente | **A** correggere subito ciò che non cambia la resa (etichette collegate, attributi ARIA); elencare per il redattore i testi alternativi mancanti, senza inventarli; rinviare dopo la UAT, come DR-115, ciò che cambia la resa (contrasto, contorno del fuoco) · **B** registrare tutto senza correggere · **C** correggere tutto ora | **A** |

Chiuse il 2026-10-17: D76…D79 = A (**DR-166…169**).
