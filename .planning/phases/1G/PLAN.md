# PLAN — Fase 1G · Collaudo redazionale del CMS

Piano di fase. Una riga in `PROGRESS.md` per ogni wave completata, un commit per wave,
ognuno con la sua conferma. Ogni wave di sviluppo riceve, prima di partire, il suo piano
di dettaglio (`Wn-PLAN.md`), come la `1E-W7` e la `1E-W8`: file da toccare, prove da
scrivere prima del codice, comandi di verifica.

Contesto, vincoli e criteri di uscita: [`CONTEXT.md`](CONTEXT.md).
Decisioni di perimetro: [`DECISIONI-1G.md`](DECISIONI-1G.md) (DR-213…DR-221).

**Obiettivo in una frase:** dare all'area amministrativa ciò che manca perché un
redattore modifichi davvero da solo ogni contenuto pubblico del sito, e provarlo con
l'utente nel ruolo di redattore, per l'approvazione della condizione 7 del gate.

---

## 1. Wave

| Wave | Che cosa produce | Come si verifica |
|---|---|---|
| `1G-W0` | `DECISIONI-1G.md`, questi due documenti, D110…D122 registrate (DR-213…DR-226) | I file esistono e non sono vuoti; nessuna decisione bloccante aperta prima della wave che la richiede |
| `1G-W1` | **Account e ruoli** (DR-219, DR-220). Permesso `users.manage`; ruolo `amministrazione` (impostazioni del sito, persone e permessi, registro) separato da `redazione`; migrazione e seme sintetico aggiornati; rotte degli account (elenco, crea, disattiva, reimposta password) con le regole di ADR-007; schermata «Persone e permessi»; comando di creazione del primo account conservato. Esito di D120 applicato ad ADR-007 | Prove prima del codice; prove negative per ruolo via interfaccia, indirizzo e API (1G-17 per «Persone e permessi»); account disattivato rifiutato; nessuna password nei log; **revisione di sicurezza** senza esiti critici o alti aperti (1G-18) |
| `1G-W2` | **Registro delle operazioni** (DR-216 A). Rotta di lettura, filtrabile per contenuto, autore, periodo, solo con il ruolo `amministrazione`; schermata «Registro delle operazioni»; «ultima modifica di X il Y» nell'editor, visibile alla redazione | 1G-9 eseguibile da prove; 1G-17 per il registro; 1G-20: nessuna voce 404 |
| `1G-W3` | **Indirizzi dei contenuti** (DR-216 D). Slug e genitore nell'editor; alla modifica, nella stessa transazione: redirect 301 dal vecchio indirizzo, percorsi delle figlie ricalcolati, redirect anche per loro; nessuna catena (un redirect che punta a un indirizzo a sua volta rediretto si riscrive verso la destinazione finale) e nessun ciclo | 1G-11: prove su gerarchia a tre livelli, su slug riportato al valore originale, su collisione di percorso; 181/181 redirect e 293 indirizzi della matrice invariati |
| `1G-W4` | **Campi, categorie, eliminazione** (DR-217 A, B, C). Estratto e immagine in evidenza nell'editor; assegnazione delle categorie a un contenuto (API e interfaccia), creazione e rinomina delle categorie; eliminazione con conferma e rifiuto spiegato se ha figlie | 1G-12, 1G-13 da prove; il sito mostra estratto, immagine e archivio di categoria aggiornati |
| `1G-W5` | **Media e anteprima** (DR-216 B, C; DR-217 D). Dimensioni derivate rigenerate alla sostituzione, con le stesse misure e gli stessi ritagli dell'import (esito di D121); elenco dei tipi ammessi e messaggi in italiano; anteprima della bozza sul sito pubblico, con autorizzazione, `noindex`, nessuna cache | 1G-5 da prove su ogni dimensione; 1G-14; 1G-19 prova negativa da anonimo; anteprima e pagina pubblicata identiche dopo la pubblicazione, con il metodo di confronto di 1E-19 (DR-202: HTML senza il payload RSC) |
| `1G-W6` | **Documenti e caroselli** (DR-218, DR-257, DR-260). Rotte e schermate per sostituire file, titolo e descrizione dei documenti scaricabili, con «Ultimo aggiornamento» dalla data della modifica; per sostituire, aggiungere, togliere e riordinare le immagini di un carosello e cambiarne i testi; blocco «Presentazione a scorrimento» inseribile nell'editor. **Metadati** (DR-254, DR-258, DR-259): PDF e MP4 caricati o sostituiti ripuliti con `qpdf` e `ffmpeg` (ADR-012). Dettaglio in `W6-PLAN.md` | 1G-15 da prove ed e2e, documenti e caroselli; i 4 documenti riservati restano irraggiungibili e spariscono dall'area (1E-16 rieseguito); prove con file sintetici della pulizia |
| `1G-W7` | **Non regressione e preparazione del collaudo.** Confronto visivo integrale; 1E-19, menu, metadati, redirect, stati; verifica come la CI; caccia al contenuto scritto nel codice; matrice di editabilità attesa; ambiente di collaudo (esito di D119) con HO dedicato; account sintetici `redazione` e `amministrazione`; un handoff per compito (1G-1…1G-10 e i casi di 1G-11…1G-17) | 1G-21, 1G-22, 1G-23, 1G-26 registrati; ambiente risponde; handoff pronti. **Stop**: richiesta del collaudo all'utente |
| `1G-W8` | **Collaudo con l'utente** (DR-214, DR-221). L'utente esegue i compiti; l'agente osserva il sito, registra esito, tempo, console, e classifica ogni difetto | Ogni compito con esito e tempo; 1D-28…1D-37 coperti; 1G-24; elenco dei difetti con severità |
| `1G-W9` | **Correzione dei difetti e nuovo collaudo** dei soli compiti interessati | Ogni difetto `risolto` con prova, oppure `approvato` dall'utente voce per voce (1G-28) |
| `1G-W10` | **Rapporto e audit.** `docs/qa/cms-editability-report.md`, `docs/qa/editability-matrix.csv`, `AUDIT.md` con i criteri del `CONTEXT.md` §7 eseguiti uno per uno; rimozione dei contenuti e degli account di prova (1G-27) | Ogni criterio ha un esito eseguito; poi **stop** e richiesta di approvazione del collaudo redazionale |

## 2. Chi esegue, che cosa tocca

Regola della 1D: **Sonnet** per il codice, **Haiku** per la documentazione; le wave il cui
documento è l'esito di controlli eseguiti restano a Sonnet. La revisione di sicurezza della
`1G-W1` è affidata a un revisore separato (`security-reviewer`).

| Wave | Agente | File toccati |
|---|---|---|
| `1G-W0` | pianificazione | `.planning/phases/1G/*`, `docs/decisions/decision-register.md`, `ROADMAP.md`, `PROGRESS.md` |
| `1G-W1` | **Sonnet** + revisore di sicurezza | `apps/api/src/auth/**`, `apps/api/src/modules/` (nuovo modulo degli account), `packages/db/src/schema/**` e migrazione, `packages/contracts/src/**`, `apps/admin/src/**`, seme sintetico, `docs/decisions/adr/ADR-007-*.md` secondo D120 |
| `1G-W2` | **Sonnet** | `apps/api/src/modules/` (lettura del registro), `apps/admin/src/**`, `packages/contracts/src/**` |
| `1G-W3` | **Sonnet** | `apps/api/src/modules/content/**`, `apps/api/src/modules/redirects/**`, `apps/admin/src/components/` dell'editor |
| `1G-W4` | **Sonnet** | `apps/api/src/modules/content/**`, `apps/api/src/modules/terms/**`, `apps/admin/src/**`, `apps/web/**` solo se archivi o elenchi non leggono già i nuovi valori |
| `1G-W5` | **Sonnet** | `apps/api/src/modules/media/**`, `apps/api/src/modules/public/**`, `apps/web/src/app/**` per l'anteprima, `apps/admin/src/**` |
| `1G-W6` | **Sonnet** | `apps/api/src/modules/` (documenti, caroselli), `apps/admin/src/**`, `packages/contracts/src/**` |
| `1G-W7` | **Sonnet** | `tests/e2e/**`, `tests/visual/**` solo per eseguire, `docs/qa/`, `docs/handoff/`, configurazione dell'ambiente di collaudo |
| `1G-W8` | **Sonnet** (osserva e registra) | `docs/qa/`, `docs/handoff/` |
| `1G-W9` | **Sonnet** | secondo i difetti, dichiarati nel piano di dettaglio |
| `1G-W10` | **Sonnet** | `docs/qa/cms-editability-report.md`, `docs/qa/editability-matrix.csv`, `.planning/phases/1G/AUDIT.md` |

## 3. Dipendenze fra wave

| Wave | Dipende da | Perché |
|---|---|---|
| `1G-W1` | `1G-W0`, DR-224 | La forma della deroga ad ADR-007 va decisa prima di scrivere le rotte |
| `1G-W2` | `1G-W1` | Il registro appartiene al ruolo `amministrazione` |
| `1G-W3` | `1G-W0` | Indipendente dagli account; può procedere in parallelo alla `1G-W2` su file separati |
| `1G-W4` | `1G-W3` | Stesso editor e stesso servizio dei contenuti: in sequenza per evitare conflitti |
| `1G-W5` | `1G-W0`, DR-225 | La rigenerazione dipende dalla scelta della libreria |
| `1G-W6` | `1G-W5` | La sostituzione dei file dei documenti riusa le regole sui tipi ammessi |
| `1G-W7` | `1G-W1`…`1G-W6`, DR-223, DR-226 | Si confronta e si prepara il collaudo solo a funzioni complete |
| `1G-W8` | `1G-W7` | Il collaudo richiede ambiente, account e handoff |
| `1G-W9` | `1G-W8` | Corregge ciò che il collaudo trova |
| `1G-W10` | tutte | Il rapporto raccoglie gli esiti |

Dopo l'approvazione del collaudo: HO-017 (distruzione dell'istanza di riferimento, DR-212),
poi la Fase 1F.

## 4. Struttura del repository al termine

| Percorso | Novità |
|---|---|
| `apps/api/src/modules/` | modulo degli account; lettura del registro; documenti e caroselli in scrittura |
| `apps/admin/src/app/impostazioni/persone/` | «Persone e permessi» |
| `apps/admin/src/app/impostazioni/registro/` | «Registro delle operazioni» |
| `apps/admin/src/app/redazione/` | schermate di documenti e caroselli (percorso fissato nel piano di dettaglio) |
| `apps/web/src/app/` | rotta dell'anteprima della bozza |
| `packages/db` | migrazione: permesso `users.manage`, ruolo `amministrazione`, eventuali colonne per lo stato dell'account |
| `docs/qa/cms-editability-report.md`, `docs/qa/editability-matrix.csv` | nuovi |
| `.planning/phases/1G/AUDIT.md` | nuovo |

## 5. Dipendenze previste

Nessuna è autorizzata da questo piano: ognuna si dichiara nella wave che la introduce, con
il motivo, e l'audit le confronta con questo elenco.

| Possibile dipendenza | Perché potrebbe servire | Alternativa senza dipendenza |
|---|---|---|
| libreria di elaborazione delle immagini (per esempio `sharp`), solo in `apps/api` | rigenerare le dimensioni derivate alla sostituzione (DR-216 C): oggi nel progetto non esiste alcuna elaborazione delle immagini | D121, opzione B: togliere le derivate del media sostituito e servire l'originale |
| riconoscimento del tipo di file dal contenuto | rifiutare un file il cui nome dichiara un tipo diverso dal contenuto (DR-217 D) | controllo delle prime firme dei formati ammessi, scritto nel progetto |

Nessun client PHP o WordPress entra nel runtime.

## 6. Cosa questa fase non dimostrerà

- **Non dimostra che il Centro sappia usare il CMS**: lo collauda l'utente nel ruolo di
  redattore (DR-214). Un collaudo con una persona del Centro resta possibile in seguito.
- **Non rende modificabili** revisioni, programmazione, contenuti privati, form e
  compilazioni, widget, ruoli ulteriori (DR-218).
- **Non dimostra sicurezza in produzione**: la revisione di sicurezza riguarda le rotte
  nuove; la security review completa è della 1F.
- **Non crea account in produzione**: il percorso di creazione del primo account in
  produzione è della 1F.
- **Non dichiara conformità GDPR** sulla gestione degli account o del registro: serve
  validazione umana.
- **Non tocca la sorgente.** `source-private/` resta byte per byte com'è.

## 7. Conferme richieste all'utente durante la fase

| # | Quando | Che cosa |
|---|---|---|
| 1 | alla fine di ogni wave | commit e push |
| 2 | `1G-W1`, `1G-W3`…`1G-W6` | ogni migrazione applicata al database di sviluppo, con copia di salvataggio |
| 3 | `1G-W7` | creazione e ripristino dell'ambiente di collaudo (copia del database, svuotamento delle compilazioni, bucket) |
| 4 | `1G-W8` | il collaudo stesso, compito per compito |
| 5 | `1G-W9` | i difetti da accettare invece di correggere, voce per voce |
| 6 | `1G-W10` | la rimozione dei contenuti e degli account di prova; l'approvazione del collaudo redazionale |

Restano a conferma obbligatoria e **non** avvengono in questa fase: deploy, DNS,
certificati, configurazione e invio di email, pagamenti, migrazioni su database di
produzione, modifiche al database di sviluppo fuori dalle migrazioni confermate.

## 8. Assunzioni vietate e decisioni richieste

Primo round, chiuso il 2026-10-19 (pagina di grill):

| id | Decisione | Esito |
|---|---|---|
| ~~**D110**~~ | Perimetro | **DR-213**: colmare le lacune, poi collaudo, correzione, nuovo collaudo |
| ~~**D111**~~ | Chi collauda | **DR-214**: l'utente come redattore, un handoff per compito |
| ~~**D112**~~ | Database del collaudo | **DR-215**: separato, compilazioni svuotate |
| ~~**D113**~~ | Lacune per i compiti 1G | **DR-216**: registro, anteprima, derivate, slug e genitore |
| ~~**D114**~~ | Altre lacune | **DR-217**: estratto e immagine, categorie, eliminazione, tipi di file |
| ~~**D115**~~ | Non modificabile in Fase 1 | **DR-218**: rinviato tutto tranne documenti e caroselli |
| ~~**D116**~~ | «Persone e permessi» | **DR-219**: schermata minima, revisione di sicurezza |
| ~~**D117**~~ | Ruoli | **DR-220**: `redazione` e `amministrazione`, `users.manage` |
| ~~**D118**~~ | Tempo ragionevole | **DR-221**: registrato, non vincolante, oltre 10 minuti difetto di usabilità |

Secondo round, chiuso il 2026-10-19 insieme all'approvazione del piano (**DR-222**):

| id | Decisione | Esito |
|---|---|---|
| ~~**D119**~~ | Archivio dei media del collaudo | **DR-223**: bucket dedicato copiato da quello di sviluppo |
| ~~**D120**~~ | Deroga ad ADR-007 | **DR-224**: revisione datata di ADR-007 nella `1G-W1` |
| ~~**D121**~~ | Rigenerazione delle dimensioni derivate | **DR-225**: libreria di elaborazione delle immagini in `apps/api`, dichiarata nella `1G-W5` |
| ~~**D122**~~ | HO-006 | **DR-226**: assorbito nel collaudo della `1G-W8` |

Decisioni delle wave che cambiano le wave successive:

| id | Decisione | Esito |
|---|---|---|
| ~~**D150**~~ | Metadati di MP4 e PDF caricati dal CMS | **DR-254**: pulizia con uno strumento nuovo, ADR e dipendenza da pianificare prima della `1G-W7` |
| ~~**D151**~~ | `next` 16.3.5 con avvisi di sicurezza critici | **DR-255**: aggiornamento a ≥ 16.4.1 all'inizio della `1G-W7` |
| ~~**D153**~~ | Caroselli | **DR-257**: schermata e blocco «Presentazione a scorrimento» nell'editor, nella `1G-W6` |
| ~~**D154**~~ | Strumento per ripulire PDF e MP4 | **DR-258**: `qpdf` e `ffmpeg` in processo separato, ADR-012; requisito dell'immagine della 1F |
| ~~**D155**~~ | File da ripulire | **DR-259**: solo i nuovi; misura degli importati, decisione prima della 1F |
| ~~**D157**~~ | Residui minori della `1G-W5` | **DR-261**: N3, «Preamble» e N6 nella `1G-W6`; gli altri alla `1G-W9` o alla 1F |
| ~~**D158**~~ | `qpdf` ≥ 11.10 in CI | **DR-262**: binario ufficiale 12.4.2 scaricato con l'impronta SHA-256 controllata |
| ~~**D159**~~ | Limite di memoria di `qpdf` e `ffmpeg` | **DR-263**: contenitore separato con limite di memoria, senza rete, utente dedicato; requisito dell'immagine della 1F |
| ~~**D160**~~ | Codec video ammessi nei caricamenti | **DR-264**: solo `h264`, `hevc` e `aac`, da attuare prima della 1F |
| ~~**D161**~~ | Dove si eseguono 1E-19 e l'anteprima | **DR-265**: sull'ambiente di collaudo, dall'utente (HO-035); ripristino prima della `1G-W8` |
| ~~**D162**~~ | Convivenza di sviluppo e collaudo | **DR-266**: `git worktree` separato, porte 3300-3302, `amoris_collaudo`, bucket `collaudo-*` |
| ~~**D163**~~ | Vista peggiorata nel confronto integrale | **DR-267**: identica all'ultima accettata, oppure entro la percentuale accettata verso il riferimento; oltre, correzione o accettazione voce per voce |

Nessuna wave parte con una decisione bloccante aperta.
