# CONTEXT — Fase 1E · Ricostruzione React e parità visiva

Creato il 2026-10-09, nella wave `1E-W0`. Prerequisito richiesto da `CLAUDE.md`
§«GSD Workflow Prerequisites»: la fase si apre con una wave di sola
pianificazione, come la 1C e la 1D.

Sblocco della fase: **DR-103** del 2026-10-09 chiude la Fase 1D. L'altro
prerequisito di `docs/discovery/phase-plan.md` per la 1E, «D2 chiusa», è
soddisfatto da **DR-014** (pixel-perfect obbligatorio).

---

## 1. Perimetro

La Fase 1E costruisce **il sito pubblico** su `apps/web` e ne **misura** la
fedeltà al sito WordPress. Alla sua fine ogni URL della matrice ha una risposta
del sito nuovo, i 594 confronti visivi sono eseguiti, ogni difformità residua è
elencata, e la fase si ferma per chiedere all'utente la **UAT di parità**.

Dentro il perimetro:

- **riferimento**: avvio dell'istanza congelata di `tools/wp-reference/` (DR-025),
  cattura delle immagini di riferimento e misura del rumore di fondo
  (`visual-regression-plan.md` §3–§6); controprova su 10 URL del sito online in
  sola lettura (DR-016);
- **lettura pubblica dei dati**: oggi ogni rotta dell'API sta nell'area
  «redazione» o «impostazioni» e non esiste una lettura anonima. Il sito pubblico
  non parla al database (ADR-008 §3.3 regola 4): serve una lettura pubblica dei
  soli contenuti pubblicati, dei menu, del SEO, delle impostazioni e dei redirect
  (**DR-104**: modulo pubblico di sola lettura nell'API);
- **media pubblici**: Caddy instrada già `/media/*` verso l'API (ADR-003), ma
  l'API non ha una rotta anonima che li serva; i 301 da `/wp-content/uploads/*`
  (ADR-004);
- **redirect**: le 180 regole servite dall'applicazione, mai dal proxy (ADR-003
  §3); il criterio 16 della 1D, spostato qui da **DR-094**;
- **design token** estratti dal CSS reso della sorgente, non stimati a occhio
  (`divi-shortcode-strategy.md` §6); le spaziature di Divi come proprietà
  personalizzate CSS (**DR-071**, ADR-005 §3.3 regola 2 riformulata il 2026-10-09);
- **template e rotte**: intestazione, menu a tre livelli con 41 voci per
  l'anonimo, piè di pagina, pagina, articolo, archivio di categoria con
  paginazione, 404, `robots.txt`, sitemap; il titolo principale restituito alle 29
  pagine che non ce l'hanno, reso identico al testo che oggi lo sostituisce
  (**DR-040**), e il suffisso di paginazione in italiano;
- **i cinque blocchi oggi segnaposto** in `packages/blocks`: `slider` (12 slide),
  `video` (7), `map` (1), `post_list`, `form`;
- **i form**: resa dei 25 form e della richiesta d'invio
  `POST /forms/{slug}/submissions` (ADR-010 §4.3), il rimando di pagamento di
  **DR-039**, il form del modulo di contatto di Divi (**DR-094**, **DR-098**) —
  salvata nel database e senza email (**DR-108**);
- **confronto visivo**: le catture del sito nuovo, i diff, la classificazione, la
  correzione delle difformità «senza degradare l'editabilità del CMS»
  (`phase-plan.md` 1E-W5);
- **verifiche non visive**: metadati su 117 URL contro
  `seo-rendered-baseline.csv`, 180 redirect nei due sensi, verifiche manuali sugli
  81 URL ad alta priorità, accessibilità di base A-1…A-8, console e rete;
- **il rapporto** `docs/qa/visual-parity-report.md` e la richiesta di UAT.

Fuori dal perimetro, e non si comincia:

- **la dichiarazione di parità**: la fase prepara le prove, l'approvazione è
  dell'utente e si scrive nel rapporto. Senza di essa il termine «pixel-perfect»
  non si usa;
- **il collaudo redazionale**: è la Fase 1G, che si svolge in parallelo ma è una
  fase a sé (condizione 7 del gate). La 1E deve solo non peggiorare
  l'editabilità;
- **l'invio di email**: azione a conferma obbligatoria, provata in Fase 1F
  (ADR-010 §4.5). In 1E nessuna email parte;
- **staging, produzione, DNS, certificati, Content-Security-Policy**: Fase 1F
  (ADR-003, ADR-009);
- **WebP e caricamento differito delle immagini**: ADR-004 §3.7 li esclude dalla
  1E, perché cambierebbero la resa da confrontare;
- **le 170 pagine allegato**: restano 301 e sono fuori dal confronto (DR-034);
- **la stampa**: fuori perimetro (DR-041), e il rapporto lo scrive;
- **qualunque cosa della fase gestionale**: il gate lo vieta.

## 2. Stato in ingresso

| Voce | Stato al 2026-10-09 |
|---|---|
| `apps/web` | Next ^16.3.5, React ^19.3: `layout.tsx` con `lang="it"`, una home segnaposto, `robots.ts` che esclude solo `/admin`. Non legge alcun dato e non dipende da `@amoris/blocks` |
| `packages/blocks` | 14 tipi, ognuno con un componente di resa; 9 rendono contenuto reale, 5 sono segnaposto (`slider`, `video`, `map`, `post_list`, `form`). Oggi li usa solo l'anteprima dell'area amministrativa |
| `apps/api` | Nessuna lettura anonima; `/media`, `/media/:id`, `/media/:id/file` solo nell'area «redazione» |
| Database locale | Import reale completo, esito `success` (`import-completeness-report.md` §10): 108 contenuti, 170 media, 64 voci di menu, 180 redirect, 25 form |
| Storage locale | Immagini Chainguard (DR-101); 1477 oggetti pubblici, 4 riservati |
| Istanza di riferimento | `tools/wp-reference/` (MariaDB 10.11, PHP 8.2/Apache, solo loopback): copia di lavoro `.reference/html` e volume `wpref_dbdata` presenti, **nessun container avviato** |
| Matrice URL | `docs/migration/url-matrix.csv`, 293 righe: 81 ad alta priorità, 36 a media, 175 a bassa |
| Riferimenti non visivi | `seo-rendered-baseline.csv` (117 URL), `public-menu.csv` (41 voci) |
| Piano del confronto | `docs/qa/visual-regression-plan.md` e `acceptance-criteria.md`, prodotti nella `1B-W6`; il loro stato dice ancora «proposta» |
| `docs/qa/screenshots/` | Non esiste |

## 3. Fatti che vincolano questa fase

| Fatto | Fonte |
|---|---|
| Pixel-perfect obbligatorio | DR-014 |
| Sito online consentito **in sola lettura** | DR-016 |
| L'istanza di riferimento è congelata e **si distrugge a fine 1E** | DR-025 |
| Nessun manifest né service worker sul sito pubblico | DR-030, ADR-008 §3.3, criterio 1E-12 |
| Le 170 pagine allegato restano 301, escluse dal confronto | DR-034 |
| Form con pagamento: raccolta più rimando a PayPal | DR-039 |
| Metadati non visibili corretti, `h1` restituito a 29 pagine | DR-040 |
| Stampa fuori perimetro | DR-041 |
| Spaziature di Divi come proprietà personalizzate CSS | DR-071, ADR-005 §3.3 regola 2 |
| I 301 degli URL storici sono della 1E | DR-094 |
| Resa sul server, HTML statico dove possibile; il sito non parla al database; nessun import da `packages/ui` | ADR-008 |
| Nessun redirect di contenuto nel proxy; cache dei soli asset con impronta | ADR-003 §3 |
| Percorsi `/media/AAAA/MM/file`; bucket pubblico letto attraverso l'applicazione, mai con URL firmati; riservato non raggiungibile | ADR-004 §3.6 |
| L'anteprima dell'editor usa gli stessi componenti del sito | ADR-006 §3.3 |
| `content_html` è una cache che serve al confronto | ADR-005 §3.6 |
| Le 23 pagine con form devono superare il confronto | ADR-010 |
| Tema Divi 4.18.0 senza child theme; Open Sans 300–800 con corsivi da Google Fonts; icone di Divi | `wp-source-inventory.md` |
| Plugin con effetto pubblico: All in One SEO, Cookie Notice (banner da CDN esterno), MonsterInsights (GA4 e UA), Slider Revolution, Category Posts, SHK Hide Title, WPForms, Download Manager, OptinMonster | `plugin-and-feature-map.md` |
| `et-cache` dell'istanza di riferimento mai rigenerata; cattura una volta sola all'inizio della fase | `divi-shortcode-strategy.md` |

## 4. Vincoli non negoziabili

- **Privacy.** Nessun dato personale negli screenshot archiviati, nei log, nel
  rapporto. Le immagini di riferimento contengono pagine pubbliche del sito vero:
  stanno in `docs/qa/screenshots/` e restano fuori da Git, con un'impronta per
  immagine nel rapporto (**DR-106**). I form si provano solo con dati sintetici; nessuna compilazione vera.
- **Sorgente in sola lettura.** L'istanza di riferimento lavora su una copia
  (`.reference/html`); `source-private/` resta byte per byte com'è.
- **La soglia non si alza.** Si decide una volta, si scrive, non si cambia per
  far passare un confronto (`visual-regression-plan.md` §7).
- **Nessuna maschera implicita.** Ogni maschera ha selettore, motivo, coordinate
  e data, ed è approvata dall'utente (criterio 1E-5).
- **L'editabilità non peggiora.** Una correzione visiva che sposta il testo fuori
  dal modello a blocchi, o scrive contenuto nel codice, è una regressione.
- **Conferme obbligatorie.** Nessun deploy, nessuna email, nessuna cancellazione
  senza conferma puntuale. La distruzione dell'istanza di riferimento a fine fase
  (DR-025) è una cancellazione e si chiede.

## 5. Rischi noti in ingresso

| id | Rischio | Mitigazione |
|---|---|---|
| RE-01 | L'istanza di riferimento diverge dal sito online (R-15) o rende diversamente per la versione di PHP e del database (R-16) | Controprova su 10 URL (1E-10); se diverge, fa fede l'online (`visual-regression-plan.md` §2) |
| RE-02 | Il CSS di Divi non si riproduce con token e classi senza tornare allo stile in linea | ADR-005 §3.3 regola 2 riformulata; un test sull'HTML reso rifiuta ogni proprietà ordinaria in linea |
| RE-03 | Rumore di fondo della catena di cattura sopra lo 0,10 % | 1E-1 si misura **prima** di qualunque confronto; se supera, ci si ferma e si chiede |
| RE-04 | Componenti di terze parti (banner dei cookie, analisi, popup, video, mappa) rendono in modo non deterministico | Nessuna chiamata a terzi in 1E (**DR-107**); difformità dichiarate e approvate |
| RE-05 | Le pagine catturate mostrano dati personali pubblicati sul sito | Esame delle catture prima di archiviarle; mascheratura annotata nel rapporto |
| RE-06 | Lavoro sproporzionato su difformità minori | Triage per severità; l'utente approva per iscritto le difformità accettate (1E-11) |
| RE-07 | Lettura pubblica che espone bozze, contenuti riservati o i 4 documenti di `media-private` | Prove negative per ogni rotta pubblica, come il criterio 15 della 1D |
| RE-08 | L'invio dei form scrive dati veri in locale | Solo dati sintetici nelle prove; nessuna email (DR-108) |

## 6. Output attesi

Elencati in [`PLAN.md`](PLAN.md), wave per wave.

## 7. Criteri di uscita

Una fase non si dichiara conclusa per affermazione. Ognuno di questi criteri viene
**eseguito** nell'audit della fase e il suo esito registrato in `AUDIT.md`.

**Parità visiva — `acceptance-criteria.md` §4, invariati**

| # | Criterio | Soglia |
|---|---|---|
| 1E-1 | Rumore di fondo della catena di cattura misurato | sotto lo 0,10 % |
| 1E-2 | Confronti eseguiti | **585** (DR-112) |
| 1E-3 | Differenza per confronto | 0 % automatico (DR-113); fino allo 0,50 % esaminato; > 0,50 % fallito |
| 1E-4 | Nessuna area contigua di differenza | oltre 32 × 32 px |
| 1E-5 | Ogni maschera dichiarata, motivata, con coordinate | elenco nel rapporto |
| 1E-6 | Verifiche manuali sugli 81 URL ad alta priorità | §8 del piano |
| 1E-7 | Menu reso a un anonimo | 41 voci, gerarchia ed etichette identiche |
| 1E-8 | Metadati contro `seo-rendered-baseline.csv` | 117 URL, esito per URL, difformità classificate secondo DR-040 |
| 1E-9 | Redirect nei due sensi | 180 regole |
| 1E-10 | Controprova sul sito online | 10 URL, nessuna divergenza dell'istanza |
| 1E-11 | Difformità residue elencate e **approvate dall'utente** | condizione 10 del gate |
| 1E-12 | Nessun service worker sul sito pubblico | ADR-008 §3.3 |

**Accessibilità di base — `acceptance-criteria.md` §6:** A-1…A-8, eseguiti.
A-7 segue DR-040.

**Criteri aggiunti da decisioni successive al piano della 1B**

| # | Criterio | Fonte |
|---|---|---|
| 1E-13 | Gli URL storici rispondono 301 verso la destinazione registrata, serviti dall'applicazione | DR-094 (ex criterio 16 della 1D) |
| 1E-14 | Le 29 pagine hanno un `h1`, reso identico al testo che oggi lo sostituisce, e i loro confronti superano la soglia | DR-040 |
| 1E-15 | Nessuna proprietà CSS ordinaria in linea nell'HTML che il sistema genera; solo proprietà personalizzate dell'elenco chiuso. Le dichiarazioni dei blocchi di riserva `html` si contano e si dichiarano (DR-118) | DR-071, ADR-005 §3.3 regola 2 |
| 1E-16 | La lettura pubblica non espone bozze, contenuti ritirati, account, compilazioni né i 4 documenti riservati: prova negativa per ogni rotta | ADR-004 §3.6, ADR-007 |
| 1E-17 | Zero errori in console e zero richieste fallite sugli 81 URL ad alta priorità | skill `wordpress-visual-parity` |
| 1E-18 | `lint`, `typecheck`, `build`, `test`, end-to-end verdi in locale e in CI | condizione 12 del gate |
| 1E-19 | Aprire e salvare senza modifiche un contenuto non cambia la pagina pubblica | ADR-005 §7, a protezione dell'editabilità |

La fase **non** si chiude con l'audit: si chiude con la UAT dell'utente,
registrata in `docs/qa/visual-parity-report.md` (condizione 13 del gate).

## 8. Assunzioni vietate e decisioni richieste

Le decisioni sono in [`PLAN.md`](PLAN.md) §8: D33…D37 chiuse da DR-104…DR-108,
D38 e D39 chiuse da DR-109 e DR-110.
Nessuna wave dalla `1E-W1` in avanti parte con una decisione bloccante aperta.
