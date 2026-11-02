# AUDIT — Fase 1G

**Stato: AUDIT ESEGUITO, FASE NON CHIUSA.** Audit della `1G-W10` (T5), 2026-11-02. La fase
si chiude solo con l'approvazione dell'utente del collaudo redazionale, in
`docs/qa/cms-editability-report.md` §12 (condizione 7 del gate). Ogni criterio di
[`CONTEXT.md`](CONTEXT.md) §7 ha un esito eseguito o un passo dichiarato della wave che lo
completa.

**Metodo (DR-207, come la 1E).**
- **Verifiche brevi:** rieseguite il 2026-11-02 sul codice della wave, cioè `5c761ca` con le
  correzioni della T2b (DR-345) e il testo di DR-343. Il commit della wave nasce nella T7.
- **Verifiche lunghe:** citate con data e commit, insieme alla prova che il codice misurato non
  è cambiato:
  - il confronto visivo integrale (T10 della `1G-W9`);
  - il collaudo su `ec640c2`.

Dalla fotografia della misura del confronto integrale (`959963cd`, 2026-10-29) al codice
della wave, fuori da `apps/admin` sono cambiati soltanto:
- il commento di `apps/web/src/styles/blocks.css:353`;
- `apps/web/public/fonts/fontawesome/LEGGIMI.txt`, entrambi per DR-343;
- prove automatiche ed e2e.

Sito, API e pacchetti resi sul sito sono quindi identici (`git diff --stat 959963cd` su
`apps/web`, `packages/blocks`, `packages/contracts` e `apps/api/src/modules/public`).

---

## 1. Esito

| | |
|---|---|
| Criteri della Fase 1G | **38**: 1G-1…1G-28 e 1D-28…1D-37 |
| Superati | **38** |
| Completati da un passo dichiarato della wave | **0**: 1G-23 completato nella T7 (CI 41395242290) |
| Falliti | **0** |

## 2. I criteri di uscita, uno per uno

### Collaudo redazionale — `acceptance-criteria.md` §5

Esiti, tempi e chi li ha eseguiti in `cms-editability-report.md` §4. I compiti dell'agente
attestano che la funzione riesce, non che la redazione ci riesce da sola (DR-290).

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1G-1 | Creare, pubblicare e mettere a menu una pagina, senza assistenza | HO-036, dall'utente (2026-10-27, `e61d20b`): riuscito con difficoltà, per W8-01 e W8-04, oggi risolti. Ripetuto dall'agente nella `1G-W9` su `aaedbf5`: riuscito in 32 s | ✅ |
| 1G-2 | Testo e immagine di una pagina Gutenberg | HO-037, dall'utente: riuscito. Ripetuto dall'agente su `ec640c2` il 2026-10-31: riuscito senza difficoltà, dopo la correzione di W9-N2 (`collaudo-1G-W9.md` §9) | ✅ |
| 1G-3 | Testo e immagine di una pagina Divi convertita | HO-038, dall'utente: riuscito (dichiarato), 2 min | ✅ |
| 1G-4 | Contenuto con un blocco di riserva; avviso comprensibile | HO-039 (agente): blocchi identici byte per byte. L'avviso era capito a metà (W8-21): riscritto nella `1G-W9`, prova `html-fallback-editor.test.tsx` | ✅ |
| 1G-5 | Sostituire un'immagine e il testo alternativo; nuova immagine in ogni dimensione | HO-040 (agente): file sostituito in tutte le varianti. W8-10 e W8-11 risolti (DR-305, DR-312). Ripetuto nella `1G-W9`: riuscito | ✅ |
| 1G-6 | Ordine di due voci di menu | HO-041 (agente): riuscito a schermo e da telefono | ✅ |
| 1G-7 | Titolo SEO e il suo effetto | HO-042 (agente): in `<title>`, `og:title` e scheda del browser | ✅ |
| 1G-8 | Redirect da un vecchio indirizzo | HO-043 (agente): 404 → 301. W8-17 risolto. «Che cosa copre» collaudato nella T2 della `1G-W10` | ✅ |
| 1G-9 | Chi ha modificato un contenuto e quando | HO-044 (agente): persona e minuto esatti, nessuna password nel registro | ✅ |
| 1G-10 | Dopo ogni modifica la pagina pubblica corrisponde all'anteprima | HO-045: uguale in 9 pubblicazioni su 9 (W8-13 risolto, DR-293). T2 della `1G-W10` su `ec640c2`: `prova-anteprima.ts` **106/106** identici (DR-341) | ✅ |

### Criteri della 1D collaudati in 1G — `acceptance-criteria.md` §3.4

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1D-28…1D-37 | Ognuno eseguito dall'interfaccia almeno una volta, con esito nella matrice | `cms-editability-report.md` §5: ogni criterio con le righe della matrice e il compito. 1D-36: 1E-19 **5/5** su `ec640c2` (T2) | ✅ |

### Criteri aggiunti dalle decisioni della fase

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1G-11 | Slug o genitore: redirect, percorsi delle figlie, nessuna catena né ciclo, 181 redirect invariati | HO-046 (agente, 2026-10-28): sempre un solo 301, figlie aggiornate, redirect preesistenti invariati. Ciclo spiegato dopo W8-22 | ✅ |
| 1G-12 | Estratto, immagine in evidenza e categorie di una notizia; il sito li mostra | HO-047 (agente): in home, archivio e ricerca | ✅ |
| 1G-13 | Eliminare con conferma; rifiuto spiegato se ha figlie | HO-048 e ripetizione della `1G-W9`: riuscito. Ritiro e cancellazione della pagina iniziale rifiutati (DR-314) | ✅ |
| 1G-14 | File non ammesso o troppo grande rifiutato in italiano | HO-049 (agente): SVG, HTML, EXE, finto PNG e PNG da 21 MB rifiutati in italiano | ✅ |
| 1G-15 | Documento e carosello modificabili, con effetto sul sito | HO-050 (agente). Titoli delle slide a vista nella `1G-W9` (W8-26) | ✅ |
| 1G-16 | L'amministrazione crea, disattiva e reimposta; il disattivato non entra | HO-051 e ripetizione della `1G-W9`: riuscito (W8-27, W8-28 risolti) | ✅ |
| 1G-17 | La redazione non raggiunge persone e registro da menu, indirizzo né API | HO-052 (agente): rinvio a «Pagine», API 403 senza dati, anonimo 401. Rieseguito il 2026-11-02: e2e `account.spec.ts` «chi ha solo il ruolo di redazione non raggiunge persone e permessi» verde (e2e 67/67) | ✅ |
| 1G-18 | Revisioni di sicurezza senza critici o alti aperti; 12 controlli di ADR-007 | Revisioni di sicurezza delle wave `1G-W1`…`1G-W9` senza esiti critici o alti aperti (`PROGRESS.md`). La T2b non tocca rotte né permessi; la sua revisione non segnala problemi di sicurezza. `adr007Controls.test.ts` verde nella verifica del 2026-11-02. Riserve della T11b: **M1** corretto in parte (la richiesta fallita si ritenta, ma non si può interrompere e non ha un tetto di concorrenza); **M2** (avviso «cambia subito sul sito» con proxy e cache in produzione) passa alla `1F-W4` | ✅ con riserve dichiarate |
| 1G-19 | Anteprima non raggiungibile da anonimo, `noindex`, fuori dalla sitemap | e2e `anteprima.spec.ts` (anonimo e Impostazioni ricevono 404; `noindex`) e `apps/web/tests/preview.test.ts` verdi il 2026-11-02. Nella T2: le bozze rispondono 404 da anonimo | ✅ |
| 1G-20 | Nessuna voce dell'area risponde 404 | prove «voce di navigazione (1G-20)» di `categories.test.tsx`, `documents.test.tsx` e «ogni voce di Redazione ha la sua pagina» di `sliders.test.tsx` verdi il 2026-11-02 | ✅ |

### Non regressione

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1G-21 | Confronto visivo integrale senza viste peggiorate | Citato: T10 della `1G-W9` (2026-10-29), 591/591 catture, 585 accettate invariate, 0 peggiorate (`visual-parity-report.md` §15). Codice del sito invariato da allora (vedi Metodo) | ✅ |
| 1G-22 | 1E-19 4/4; menu 41/41; metadati 0 difformi; redirect 181/181; stati 292/292 | 1E-19 **5/5** sul collaudo il 2026-11-01: il campione dello script è di 5 contenuti dalla `1G-W7` (home, pagine senza titolo, modulo, uno per tipo). Strumenti rieseguiti il 2026-11-02 su sito 3200 e API 3002 ricompilati dal codice della wave, istanza di riferimento accesa solo per metadati e redirect: `verifica-sito.ts` menu **41/41**, un `h1` per pagina, lingua `it`, 0 service worker; `stati-matrice.py` **292/292**; `verifica-metadati.ts` 117 URL, **0 difformi**; `verifica-redirect.ts` **181/181**, 0 inversioni. Scorrimento orizzontale 4 casi sulle tre pagine Gutenberg note e stili in linea di `verifica-sito-w4.json` variabili fra una corsa e l'altra, come nella `1G-W9` (misura a `domcontentloaded`). La verifica dei redirect aggiorna il contatore degli usi (DR-308) dei 180 redirect usati nel database di sviluppo | ✅ |
| 1G-23 | `lint`, Prettier, `typecheck`, `build`, `test`, `db:verify`, copertura, e2e verdi in locale e in CI | In locale il 2026-11-02: installazione bloccata, `lint`, `typecheck`, `build`, `db:verify` verdi; e2e **67/67**; Prettier verde sui file di Git (il primo giro si era fermato su «riga di comando troppo lunga», rieseguito a blocchi); `pnpm test` verde al secondo giro (8 pacchetti, 268 file) e copertura **93,67 %** con 3047 prove. Al primo giro 5 prove di `apps/web` sono scadute a 5 s e 2 di `apps/api/tests/documents.test.ts` hanno dato un `updated_at` fuori ordine, tutte in file non toccati; da sole verdi, e verdi nel giro completo successivo. CI remota: run **41395242290** su `7cbf965`, «Lint, tipi, build, test» **success** (2026-11-02, 05:38-06:06 UTC) | ✅ |
| 1G-24 | Zero errori in console durante i cicli di modifica | `1G-W9` e T2 della `1G-W10`: nessun errore dell'applicazione; restano i rifiuti voluti e gli avvisi di precaricamento dei CSS (O4) | ✅ |

### Esiti del collaudo — skill `cms-editability-qa`

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1G-25 | Matrice con ogni tipo dell'inventario e i campi di DR-218 | `editability-matrix.csv`, 151 righe, colonne della skill; controllo con script: 11 tipi su 11, nessuna riga «modificabile» senza esito (T1 e T2 della `1G-W10`) | ✅ |
| 1G-26 | Caccia al contenuto nel codice, esito per file e riga | `contenuto-nel-codice.md`, 79 voci in 17 file; file cambiati dopo `0dd1efb` esaminati nella T3 | ✅ |
| 1G-27 | Contenuti e account di prova rimossi e dichiarati | T6 del 2026-11-02, secondo DR-340 e su conferma: `crea.ps1 -Rimuovi` ha tolto database, 2 bucket, copia di lavoro e cartella di stato con le credenziali dell'agente; verifica dopo la rimozione «Niente da rimuovere», sviluppo intatto. Residui e verifica in `cms-editability-report.md` §10 | ✅ |
| 1G-28 | Ogni difetto chiuso o approvato, voce per voce | 49 difetti (`cms-editability-report.md` §7): 45 risolti, 2 chiusi (W8-02 non più riscontrato, W8-08 non era un difetto), 2 approvati e rinviati alla 1F (W9-N7 con DR-330, W9-N8 con DR-336), 0 aperti | ✅ |

## 3. Difetti trovati durante l'audit

Nessuno. I tre difetti bassi della T2 (W10-N1…W10-N3) sono stati corretti nella T2b prima dell'audit (DR-344…DR-346), con prove che fallivano prima della correzione e una revisione del codice approvata (0 critici, 0 alti).

## 4. Che cosa resta

1. **Approvazione dell'utente** del collaudo redazionale, in `cms-editability-report.md` §12.
   Poi HO-017 (DR-212) e la Fase 1F (DR-337).
