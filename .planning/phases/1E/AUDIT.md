# AUDIT — Fase 1E

**Stato: FASE CHIUSA il 2026-10-19 (DR-211).** Audit eseguito il 2026-10-18, prima
della UAT; UAT approvata dall'utente lo stesso giorno (DR-210), registrata in
`docs/qa/visual-parity-report.md` §12 (condizione 13 del gate). Ogni criterio di uscita
di [`CONTEXT.md`](CONTEXT.md) §7 ha un esito **eseguito**.

Metodo deciso da **DR-207**: le verifiche brevi si sono rieseguite il 2026-10-18 sul
commit pubblicato `3d0d651`. Le verifiche lunghe si citano con data e commit: dopo di
esse il codice è cambiato solo per l'etichetta del campo di ricerca (DR-205), con resa
identica al byte su 7 catture, e per la formattazione (`3d0d651`, testo invariato).

Ambiente: sito nuovo su `127.0.0.1:3200` (`next start`, `SITE_URL=http://127.0.0.1:3200`),
API su `127.0.0.1:3002`, database di sviluppo con l'import reale in locale, istanza di
riferimento congelata su `localhost:8088`. Strumenti di misura nel rapporto, §1.

---

## 1. Esito

| | |
|---|---|
| Criteri della Fase 1E | **27**: 1E-1…1E-19 e A-1…A-8 |
| Superati alla misura | **24** |
| Non superati alla soglia automatica, con le differenze **approvate dall'utente** (1E-11) | **3**: 1E-3, 1E-4, 1E-14 (parte del confronto) |
| Criteri falliti senza approvazione | **0** |
| Criteri in attesa | **0** |

Lettura onesta: il confronto al pixel **non** dà l'identità. Su 591 confronti 40 sono
identici, 3 da esaminare, 548 sopra la soglia; tutte le viste non identiche sono state
esaminate dall'utente e accettate, indirizzo per indirizzo (DR-162, DR-203). Il giudizio
sulla parità resta all'utente, nella UAT.

## 2. I criteri di uscita, uno per uno

### Parità visiva — `acceptance-criteria.md` §4

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1E-1 | Rumore di fondo sotto lo 0,10 % | `1E-W1`, 2026-10-10: seconda passata su 585 catture, 577 a zero, 8 diverse solo nelle aree poi mascherate; rumore fuori maschera **0 %** (`docs/qa/riferimento/rumore.csv`, rapporto §4). Soglia automatica fissata allo 0 % (DR-113) | ✅ |
| 1E-2 | 585 confronti (DR-112) | ultimo confronto integrale, 2026-10-18 (`audit-1E-W7.md` §2): **591 righe, 585 viste distinte** su 116 indirizzi (alcune destinazioni di redirect valgono per più indirizzi; 3 viste della pagina nuova di DR-181) — `docs/qa/confronto/esiti.csv` | ✅ |
| 1E-3 | 0 % automatico; fino a 0,50 % esaminato; oltre fallito | stesso confronto: **40 superati, 3 da esaminare, 548 falliti**. Nessuna vista peggiorata rispetto allo stato accettato. Tutte le non superate esaminate dall'utente nei report «Bozze di parità» e accettate (DR-162: 112 indirizzi, 544 viste; DR-203: 25 indirizzi, 50 viste cambiate dopo la T7) | ⚠️ approvato con difformità |
| 1E-4 | Nessuna area contigua oltre 32 × 32 px | stesso confronto, colonna `aree_oltre_32`: 384 viste senza, **207 con almeno un'area**; tutte comprese nelle viste accettate del criterio precedente | ⚠️ approvato con difformità |
| 1E-5 | Maschere dichiarate, motivate, con coordinate | 4 approvate in HO-015: banner dei cookie (DR-124), mappa `.blk-map` (DR-125), video `.blk-video` (DR-126), tabella dei cookie a 390 e 360 (DR-127); coordinate calcolate a ogni cattura da `tests/visual/maschere.ts`, numero per vista nella colonna `maschere` di `esiti.csv` (29 viste mascherate) | ✅ |
| 1E-6 | Verifiche manuali sugli 81 URL | `1E-W7`, 2026-10-18 (`audit-1E-W7.md`, `interazioni.csv`): menu e mobile 79/79; hover 75/79, le 4 restanti sono lo sfondo del link «Iscrizioni» accettato (DR-204); immagini 77/79, le 2 restanti accettate (DR-197); caratteri e punti di rottura come la sorgente; incorporati: il sito non carica YouTube all'apertura (DR-107, DR-122); voce 4 form **24/24** (`accessibilita-form-HO-026.csv`) | ✅ |
| 1E-7 | Menu dell'anonimo, 41 voci | 2026-10-18, `tests/visual/verifica-sito.ts`: **41 rese, 41 attese, 0 diverse** (`docs/migration/public-menu.csv`) | ✅ |
| 1E-8 | Metadati contro la baseline | 2026-10-18, `tests/visual/verifica-metadati.ts`: **117 URL, 5 identici, 112 con sole correzioni DR-040, 0 difformi**; `robots.txt`, sitemap e feed in `metadati-sistema.csv` | ✅ |
| 1E-9 | Redirect nei due sensi | 2026-10-18, `tests/visual/verifica-redirect.ts`: **181/181 regole**, **0 inversioni** sui 293 indirizzi della matrice (`redirect.csv`, `redirect-simmetrico.csv`) | ✅ |
| 1E-10 | Controprova sul sito online | `1E-W1`, 2026-10-10 (rapporto §6): 8 URL su 10 identici al pixel; `/contatti/` diverso solo nella domanda di controllo; 1 divergenza spiegata (video di YouTube che l'istanza non può chiedere) e risolta prendendo dal sito online il riferimento di 4 pagine (DR-111) | ✅ |
| 1E-11 | Difformità residue elencate e approvate | DR-162 e DR-203 (scelta per indirizzo nei report, `decisioni-report-DR-162.csv`, `decisioni-report-1E-W7.csv`); nominative: DR-115, DR-120, DR-124…128, DR-159…161, DR-163, DR-164, DR-197, DR-204; difetti ereditati da correggere dopo la UAT: DR-115, DR-169 | ✅ |
| 1E-12 | Nessun service worker | 2026-10-18: `verifica-sito.ts` 0 registrati; e2e «non registra alcun service worker» e «non serve alcun manifest» verdi (`pnpm test:e2e` 31/31) | ✅ |

### Accessibilità di base — `acceptance-criteria.md` §6

Misura sugli 81 URL ad alta priorità, `1E-W7` (`accessibilita.csv`, `contrasto.csv`); A-5
rimisurata il 2026-10-18 dopo DR-205 (`accessibilita-DR-205.csv`). «Ereditato» = stesso
difetto misurato anche sul riferimento.

| # | Criterio | Esito misurato | Esito |
|---|---|---|---|
| A-1 | Tastiera | 79/79 | ✅ |
| A-2 | Fuoco visibile e ordine | 77/79; 2 con un'inversione d'ordine ereditata | ✅ ereditato, DR-169 |
| A-3 | Menu mobile da tastiera | 79/79 | ✅ |
| A-4 | Testi alternativi | 79/79 | ✅ |
| A-5 | Etichette dei campi | **79/79** dopo DR-205 | ✅ |
| A-6 | Lingua | 79/79 | ✅ |
| A-7 | Titoli | 73/79; 6 con salti di livello ereditati; `h1` secondo DR-040 | ✅ ereditato, DR-169 |
| A-8 | Contrasto | 13 coppie: 9 conformi; 2 non conformi decise da DR-115; 2 non conformi ereditate (asterisco `#f00` su bianco, segnaposto `#757575` su `#eee`, uguali sul riferimento il 2026-10-18), da correggere dopo la UAT (DR-169) | ✅ ereditato, DR-115, DR-169 |

### Criteri aggiunti da decisioni successive

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1E-13 | URL storici in 301 dall'applicazione | 2026-10-18: le 181 regole di 1E-9 sono servite dal sito; stati della matrice **292/292** (`tests/visual/stati-matrice.py`) | ✅ |
| 1E-14 | Le 29 pagine di DR-040 con un `h1` uguale al testo che lo sostituiva; i loro confronti sotto la soglia | `h1`: 2026-10-18, 0 pagine senza esattamente un `h1` (`verifica-sito.ts`); testo dell'`h1` confrontato in 1E-8 come correzione DR-040 (34 righe, 33 URL, 0 difformi). Confronti: non tutti sotto la soglia, compresi nelle viste accettate di 1E-3 | ⚠️ `h1` superato; confronto approvato con difformità |
| 1E-15 | Nessuna proprietà CSS ordinaria in linea generata | 2026-10-18, `verifica-sito.ts`: **0** fuori dall'elenco chiuso; 117 dichiarazioni copiate dalla sorgente nei blocchi di riserva e nel piè di pagina, dichiarate come vuole DR-118; prove di `packages/blocks` verdi | ✅ |
| 1E-16 | La lettura pubblica non espone bozze, ritirati, account, compilazioni, documenti riservati | prove negative per rotta in `apps/api/tests/publicRead.test.ts` e `publicSearch.test.ts`, verdi il 2026-10-18 (API 246/246) | ✅ |
| 1E-17 | Zero errori in console e richieste fallite | `1E-W7`, 2026-10-18: **486/486** misure a zero, 81 URL × 6 viewport (`console.csv`) | ✅ |
| 1E-18 | `lint`, `typecheck`, `build`, `test`, e2e verdi in locale e in CI | locale, 2026-10-18 su `3d0d651`: lint, Prettier, tipi, build, prove (8 pacchetti, 1.516 prove), `db:verify`, copertura, e2e 31/31; CI: run 39162695632 su `3d0d651`, **success** | ✅ |
| 1E-19 | Aprire e salvare senza modifiche non cambia la pagina pubblica | 2026-10-18, dopo DR-201 e DR-202: **4/4 identici**, home compresa; nel database cambia solo `updated_at` (`docs/qa/verifiche/analisi-1E-19-HO-026.md` §7, `docs/qa/confronto/prova-1e-19.json`) | ✅ |

## 3. Difetti trovati durante l'audit

| Difetto | Esito |
|---|---|
| La CI era rossa su `1a107c0` e `3a9ea79` per il solo controllo di formattazione (Prettier), che le verifiche locali non eseguivano | corretto con `3d0d651` (10 file, testo invariato); verifica locale ora allineata a tutti i passi della CI |
| Dopo `pnpm test:e2e` la compilazione del sito punta all'API di prova (`127.0.0.1:3102`) e il sito su `:3200` risponde con errori | non è un difetto del sito: la preparazione degli e2e ricompila `apps/web`. Rimedio di procedura: ricompilare e riavviare dopo ogni e2e (fatto il 2026-10-18, 292/292) |
| Lo scorrimento orizzontale di `/parlarsi-con-il-cuore/`, `/sguardi-damore/`, `/sguardi-damore-2/` a 390 e 360 px differiva dalla misura salvata nella `1E-W4` | rimisurato su sito e riferimento il 2026-10-18: **identico** (+17 px a 390, +44 px a 360 in entrambi); difetto della sorgente già accettato (rapporto §10) |

## 4. Dipendenze introdotte nella fase

Confronto con `PLAN.md` §5 (`git diff e63308a^ HEAD` sui `package.json`):

| Dipendenza | Dove | Autorizzazione |
|---|---|---|
| `@playwright/test` fissata a 1.63.0 (prima `^1.57.0`) | radice, sviluppo | `PLAN.md` §5, `1E-W1` |
| `pixelmatch` 7.2.0, `pngjs` 7.0.0, `@types/pngjs` 6.0.5 | radice, sviluppo | `PLAN.md` §5, `1E-W1` |
| `intl-tel-input` 29.5.3 | `apps/web`, `packages/blocks` | DR-132, ADR-011 |
| Open Sans e un sottoinsieme di ETmodules in file locali | `apps/web/public/fonts/` | DR-107, DR-143 (asset, non pacchetti) |

Il carosello è scritto nel progetto: nessuna libreria. Nessun client PHP o WordPress nel
runtime.

## 5. Che cosa resta

| Passo | Riferimento |
|---|---|
| ~~UAT di parità dell'utente~~ | ✅ approvata il 2026-10-18 (DR-210); compilazione di prova cancellata il 2026-10-19 |
| ~~Chiusura della fase~~ | ✅ 2026-10-19 (DR-211) |
| Distruzione dell'istanza di riferimento | HO-017, rinviata a dopo la Fase 1G (DR-212), su conferma (DR-025) |
| Correzioni dei difetti ereditati che cambiano la resa | dopo la UAT, DR-115 e DR-169 |
| Gate gestionale | non superato: dopo la UAT serve il deploy verificato (Fase 1F, `deployment-gate`) |
