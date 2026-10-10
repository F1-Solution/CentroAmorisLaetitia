# PLAN — Fase 1E · Ricostruzione React e parità visiva

Piano eseguibile. Una riga in `PROGRESS.md` per ogni wave completata, un commit per
wave, ognuno con la sua conferma. Le dipendenze reali fra wave sono nella tabella
§3, perché non tutte sono lineari.

Contesto, vincoli e criteri di uscita: [`CONTEXT.md`](CONTEXT.md).
Metodo del confronto: [`docs/qa/visual-regression-plan.md`](../../../docs/qa/visual-regression-plan.md).

**Obiettivo in una frase:** costruire su `apps/web` il sito pubblico alimentato dal
database e portare all'utente le prove misurate della sua fedeltà al sito
WordPress, per la UAT di parità.

---

## 1. Wave

| Wave | Che cosa produce | Come si verifica |
|---|---|---|
| `1E-W0` | Questi due documenti; revisione datata di ADR-005 §3.3 regola 2 (attuazione di DR-071); le decisioni D33…D37 portate all'utente | I file esistono e non sono vuoti; ADR-005 ha la riga di revisione; nessuna decisione bloccante aperta prima della `1E-W1` |
| `1E-W1` | **Riferimento.** Avvio dell'istanza congelata di `tools/wp-reference/`; configurazione di cattura Playwright con versione fissata, viewport e condizioni del §3–§5 del piano del confronto; misura del rumore di fondo; catture di riferimento su tutta la matrice in `docs/qa/screenshots/`, cartella esclusa da Git con un'impronta per immagine nel rapporto (DR-106); metadati e menu dell'istanza; controprova sul sito online su 10 URL, in sola lettura | 1E-1 misurato e registrato **prima** di qualunque confronto; catture per i 585 confronti di DR-112; esito della controprova registrato (1E-10); nessuna immagine con dati personali archiviata senza mascheratura annotata |
| `1E-W2` | **Lettura pubblica.** Il modulo pubblico di sola lettura di DR-104: contenuti pubblicati per percorso, menu per l'anonimo, SEO risolto, impostazioni pubbliche, risoluzione dei redirect; `/media/*` servito con uno stream dal bucket pubblico; 301 da `/wp-content/uploads/*`; dati della sitemap | Prova negativa per ogni rotta (1E-16): bozza, contenuto ritirato, documento riservato, compilazione, account → mai restituiti; OpenAPI aggiornata e provata |
| `1E-W3` | **Token e stili.** Token di colore, carattere, spaziatura, griglia e breakpoint estratti dal CSS reso dell'istanza (`et-cache`), non stimati; Open Sans in file locali (DR-107); foglio di stile dei blocchi con l'elenco chiuso delle proprietà personalizzate di DR-071 | Ogni token cita la regola sorgente da cui viene; test sull'HTML reso che rifiuta proprietà ordinarie in linea (1E-15); contrasto misurato sui colori estratti (A-8) |
| `1E-W4` | **Template e rotte.** Intestazione, menu a tre livelli, piè di pagina; pagina, articolo, archivio di categoria con paginazione e suffisso in italiano, 404, `robots.txt`, sitemap; titolo principale per le 29 pagine di DR-040; resa sul server a ogni richiesta, senza cache intermedia (DR-105); redirect e 301 serviti dall'applicazione | Ogni URL della matrice risponde con lo stato atteso; menu anonimo di 41 voci (1E-7); 1E-12, 1E-13, 1E-14 eseguiti; nessuno scroll orizzontale alle viewport del piano |
| `1E-W5` | **Blocchi dinamici e form.** Resa vera di `slider`, `video`, `map`, `post_list`, `form`; richiesta d'invio dei form salvata nel database, senza email (DR-108); rimando di pagamento di DR-039; nessuna chiamata a terzi: video e mappa al clic con copertina, nessuna analisi né popup (DR-107) | Ogni blocco ha prove di resa; i form si inviano solo con dati sintetici e l'esito si legge dal servizio; nessuna email parte; nessuna chiamata a terzi oltre quelle decise |
| `1E-W6` | **Confronto e correzione.** Catture del sito nuovo nello stesso ambiente della `1E-W1`; diff con la soglia dichiarata; classificazione di ogni differenza con tutti i campi richiesti; correzioni, a ciclo, senza degradare l'editabilità | 1E-2, 1E-3, 1E-4, 1E-5 eseguiti; nessuna differenza `bloccante` o `maggiore` aperta, oppure elencata per l'approvazione; 1E-19 eseguito dopo ogni giro di correzioni |
| `1E-W7` | **Verifiche non visive e manuali.** Metadati su 117 URL; 180 redirect nei due sensi; verifiche manuali sugli 81 URL ad alta priorità (menu, hover, fuoco, form, navigazione mobile, caratteri, immagini, embed); A-1…A-8; console e rete | 1E-6, 1E-8, 1E-9, 1E-17 e A-1…A-8 registrati per URL |
| `1E-W8` | **Rapporto e audit.** `docs/qa/visual-parity-report.md` con ambiente, soglia, maschere, differenze e il loro stato; `AUDIT.md` con i criteri del `CONTEXT.md` §7 eseguiti uno per uno | Ogni criterio ha un esito eseguito; poi **stop** e richiesta della UAT all'utente. Nessuna dichiarazione di parità |

## 2. Chi esegue, che cosa tocca

Regola della 1D: **Sonnet** per il codice, **Haiku** per la documentazione; le wave
il cui documento è l'esito di controlli eseguiti restano a Sonnet.

| Wave | Agente | File toccati |
|---|---|---|
| `1E-W0` | pianificazione | `.planning/phases/1E/*`, `docs/decisions/adr/ADR-005-*.md`, `docs/decisions/decision-register.md`, `ROADMAP.md`, `PROGRESS.md` |
| `1E-W1` | **Sonnet** | `tools/wp-reference/**` solo per l'avvio, configurazione di cattura nel repository (cartella decisa nella wave e dichiarata), `docs/qa/` per gli esiti, `.gitignore` per `docs/qa/screenshots/` |
| `1E-W2` | **Sonnet** | `apps/api/src/**`, `packages/contracts/src/**`, `infra/compose/Caddyfile` solo se l'instradamento cambia |
| `1E-W3` | **Sonnet** | `apps/web/**`, `packages/blocks/src/render/**` per classi e proprietà personalizzate |
| `1E-W4` | **Sonnet** | `apps/web/**`, `packages/blocks/**` |
| `1E-W5` | **Sonnet** | `packages/blocks/src/render/**`, `apps/web/**`, `apps/api/src/**` per l'invio dei form |
| `1E-W6` | **Sonnet** | `apps/web/**`, `packages/blocks/**`, `docs/qa/` |
| `1E-W7` | **Sonnet** | `tests/e2e/**`, `docs/qa/` |
| `1E-W8` | **Sonnet** | `docs/qa/visual-parity-report.md`, `.planning/phases/1E/AUDIT.md` |

## 3. Dipendenze fra wave

| Wave | Dipende da | Perché |
|---|---|---|
| `1E-W1` | `1E-W0` | Perimetro e cartella delle catture fissati da DR-106; piano del confronto approvato da DR-110 |
| `1E-W2` | `1E-W0` | Lettura pubblica di DR-104; controllo sui media di DR-109 prima di servirli |
| `1E-W3` | `1E-W1` | I token si estraggono dal CSS reso dell'istanza avviata |
| `1E-W4` | `1E-W2`, `1E-W3` | Le rotte leggono dalla lettura pubblica e usano i token |
| `1E-W5` | `1E-W4` | I blocchi vivono nei template |
| `1E-W6` | `1E-W1`, `1E-W5` | Si confronta solo quando tutte le rotte rendono tutto |
| `1E-W7` | `1E-W6` | Le verifiche manuali si fanno sulla resa corretta, non su quella da correggere |
| `1E-W8` | tutte | Il rapporto raccoglie gli esiti |

La 1G può partire quando la `1E-W4` rende le pagine pubbliche: il suo criterio
1G-10 confronta la pagina pubblica con l'anteprima.

## 4. Struttura del repository al termine

| Percorso | Novità |
|---|---|
| `apps/web/src/app/**` | rotte del sito pubblico |
| `apps/web/src/styles/**` | token e fogli di stile estratti |
| `apps/api/src/modules/public/**` | lettura anonima (DR-104) |
| `packages/blocks/src/render/**` | i cinque blocchi oggi segnaposto, resi |
| configurazione di cattura e diff | cartella dichiarata nella `1E-W1` |
| `docs/qa/visual-parity-report.md` | nuovo |
| `.planning/phases/1E/AUDIT.md` | nuovo |

## 5. Dipendenze previste

Nessuna è autorizzata da questo piano: ognuna si dichiara nella wave che la
introduce, con il motivo, e l'audit le confronta con questo elenco.

| Possibile dipendenza | Perché potrebbe servire | Alternativa senza dipendenza |
|---|---|---|
| libreria di confronto per pixel e lettura PNG, solo sviluppo — **introdotte nella `1E-W1`**: `pixelmatch` 7.2.0 e `pngjs` 7.0.0, con `@types/pngjs` 6.0.5, fissate senza intervallo; Playwright fissato a 1.63.0 | il criterio 1E-4 chiede l'area contigua massima, che il confronto integrato di Playwright non riporta | analisi dell'immagine di differenza scritta nel progetto |
| carattere Open Sans in file locali | DR-107: nessuna chiamata a Google Fonts | nessuna: i file sono un asset, non un pacchetto |
| libreria per il carosello | Slider Revolution non si porta; 12 slide | carosello scritto nel progetto |

Nessun client PHP o WordPress entra nel runtime: l'istanza di riferimento è uno
strumento di misura e si distrugge a fine fase (DR-025).

## 6. Cosa questa fase non dimostrerà

- **Non dichiara la parità.** Prepara le prove; la parità la approva l'utente
  nella UAT.
- **Non dimostra che un redattore sappia usare il CMS.** È la Fase 1G.
- **Non manda email** e non dimostra che le notifiche arrivino: Fase 1F.
- **Non dimostra sicurezza né prestazioni in produzione**: security review e
  prove di carico sono della 1F.
- **Non dichiara conformità GDPR, sulla privacy dei cookie o fiscale.** MI-06
  resta aperta e richiede un professionista; la politica di consenso di DR-107 va
  verificata da lui prima della 1F.
- **Non tocca la sorgente.** `source-private/` resta byte per byte com'è.

## 7. Conferme richieste all'utente durante la fase

| # | Quando | Che cosa |
|---|---|---|
| 1 | alla fine di ogni wave | commit e push |
| 2 | `1E-W1` | Nessuna, oltre al commit: avviare l'istanza locale è già deciso da DR-025, e il sito online si legge in sola lettura per DR-016 |
| 3 | `1E-W6` | Le maschere e le difformità che si propone di accettare, voce per voce |
| 4 | `1E-W8` | La UAT di parità |
| 5 | a fine fase | La **distruzione** dell'istanza di riferimento (DR-025): è una cancellazione |

Restano a conferma obbligatoria e **non** avvengono in questa fase: deploy, DNS,
certificati, configurazione e invio di email, pagamenti, migrazioni su database
di produzione, modifiche a dati reali fuori dal database locale.

## 8. Assunzioni vietate e decisioni richieste

Il primo round della 1E è chiuso il 2026-10-09:

| id | Decisione | Esito |
|---|---|---|
| ~~**D33**~~ | Come legge i dati il sito pubblico | **DR-104**: modulo pubblico di sola lettura nell'API |
| ~~**D34**~~ | Resa e aggiornamento delle pagine pubbliche | **DR-105**: resa sul server a ogni richiesta |
| ~~**D35**~~ | Regole del confronto | **DR-106**: 6 viewport, 594 confronti, `docs/qa/screenshots/` fuori da Git |
| ~~**D36**~~ | Terze parti | **DR-107**: nessuna chiamata a terzi in 1E |
| ~~**D37**~~ | Form | **DR-108**: resa e invio salvato, nessuna email |

Secondo round, chiuso il 2026-10-10:

| id | Decisione | Esito |
|---|---|---|
| ~~**D38**~~ | Media citati dentro un blocco `html` | **DR-109**: il controllo cerca anche gli indirizzi, attuato nella `1E-W2` |
| ~~**D39**~~ | Documenti del confronto della 1B | **DR-110**: approvati e allineati |

Terzo round, aperto il 2026-10-10 nella `1E-W2`:

| id | Decisione | Tipo | Termine |
|---|---|---|---|
| ~~**D43**~~ | Come si popola `settings['site.home_content_id']` | chiusa da **DR-114**: la scrive l'importer; riesecuzione dell'import su conferma | — |
| **D44** | Il colore d'accento `#2ea3f2` (collegamenti, menu, bottoni) ha contrasto 2,75 sul bianco e non supera il criterio A-8; il testo dei campi `#999` su `#eee` ha 2,46: fedeltà o correzione | differibile | prima della `1E-W6` |
