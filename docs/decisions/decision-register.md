# Registro delle decisioni

Append-only. Una riga per decisione, **mai riscritta**. Una decisione che cambia si
registra come nuova voce che **supera** la precedente, citandola.

Si registra solo ciò che l'utente ha effettivamente approvato, non la
raccomandazione dell'agente. Nessun dato personale, credenziale o recapito.

> Questo file sostituisce `docs/discovery/decision-register.md`, che ora rimanda qui.

---

## 1. Direttiva di progetto (2026-09-13)

| id | data | decisione | opzione scelta | opzioni scartate | motivo | approvata da | ambito | reversibile |
|---|---|---|---|---|---|---|---|---|
| DR-001 | 2026-09-13 | Stack di destinazione | React + Next.js, Node.js + TypeScript, PostgreSQL | .NET / Blazor / MAUI | Direttiva | Proprietario | Tutto il sistema | no, senza ADR |
| DR-002 | 2026-09-13 | Nessuna dipendenza WordPress/PHP/MySQL/MariaDB a runtime | WordPress solo come sorgente | WordPress headless | Direttiva | Proprietario | Runtime | no |
| DR-003 | 2026-09-13 | Monorepo pnpm workspace + Turborepo | pnpm + Turborepo | npm, yarn, multi-repo | Direttiva | Proprietario | Repository | sì, con ADR |
| DR-004 | 2026-09-13 | TypeScript strict ovunque | strict | non-strict | Direttiva | Proprietario | Codice | no |
| DR-005 | 2026-09-13 | Storage media S3-compatible, MinIO in sviluppo | S3 + MinIO | Azure Blob | Direttiva | Proprietario | Media | sì, con ADR |
| DR-006 | 2026-09-13 | Docker Compose per sviluppo e deployment iniziale | Docker Compose | Azure App Service | Direttiva | Proprietario | Infrastruttura | sì, con ADR |
| DR-007 | 2026-09-13 | Test: Vitest, RTL, Playwright, integrazione su PostgreSQL | stack Node | xUnit, bUnit | Direttiva | Proprietario | Qualità | sì, con ADR |
| DR-008 | 2026-09-13 | CI su GitHub Actions | GitHub Actions | altri CI | Direttiva | Proprietario | CI | sì, con ADR |
| DR-009 | 2026-09-13 | Gate assoluto di Fase 1 | Gate attivo | Sviluppo parallelo | Direttiva | Proprietario | Roadmap | no |
| DR-010 | 2026-09-13 | Solo dati sintetici in sviluppo, test, seed, screenshot, documentazione | Dati sintetici | Dati reali anonimizzati | Direttiva e privacy | Proprietario | Privacy | no |
| DR-011 | 2026-09-13 | `source-private/` e `source-readonly/` non modificabili | Sola lettura | — | Direttiva | Proprietario | Sorgenti | no |

---

## 2. Round 1 di `grill-me` — risposte del 2026-09-13

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-012 | 2026-09-13 | Sorte della codebase .NET (D1) | **Si riparte da zero.** L'utente l'ha rimossa deliberatamente; può rimetterla a disposizione se serve | Recupero in sola lettura | «preferisco riniziare da zero visto che ho scelto un altro stack tecnologico» | Proprietario | Tutto il progetto | sì — il codice è recuperabile su richiesta | D1 |
| DR-013 | 2026-09-13 | Creazione dei file di governo nella radice (D4) | **Autorizzata.** Creati `ROADMAP.md`, `CLAUDE.md`, `PROGRESS.md` | Scritti dall'utente | «Puoi creare i 3 file certo» | Proprietario | Repository | sì | D4 |
| DR-014 | 2026-09-13 | Standard di fedeltà visiva (D2) | **Pixel-perfect obbligatorio.** Supera il «simile» di `prompt_iniziale.md` | Fedeltà approssimata | «La corrispondenza DEVE essere pixel-perfect» | Proprietario | Fase 1E e gate | no | D2, C-04 |
| DR-015 | 2026-09-13 | Sorgente autorevole per la migrazione | **Backup del 2026-09-13**: `source-private/wordpress-2026-09-13/` (installazione completa) e `source-private/BackupDB-2026-09-13/` (dump). Il materiale di marzo è superato | Backup di marzo 2026 | Fornito dall'utente come «nuovo backup fatto oggi» | Proprietario | Fase 1A e successive | no | D2 |
| DR-016 | 2026-09-13 | Accesso al sito online | **Consentito in sola lettura** su `https://www.centroamorislaetitia.it` | Nessun accesso esterno | «puoi usare quella online se l'accesso è in sola lettura» | Proprietario | Fase 1A, 1E | sì | D2 |
| DR-017 | 2026-09-13 | App mobile | **PWA installabile** in Node.js + React | .NET MAUI (ADR-003 storica), app native | «penso vadano bene Node.js e React con una PWA installabile come app» | Proprietario | Fase post-gate | sì, con ADR | **supera DR-H07**; M-07 |
| DR-018 | 2026-09-13 | Aspetto dell'area amministrativa | **Non deve assomigliare a WordPress.** Design proprio, scelto dall'utente | Riproduzione dell'admin WordPress | «il backend non deve assomigliare a Wordpress» | Proprietario | Fase 1B, 1D | no | — |
| DR-019 | 2026-09-13 | Processo di scelta del design dell'area amministrativa | **4 proposte di UI** (color scheme e layout) e **4 proposte di UX**, prodotte dagli agenti di design, fra cui l'utente sceglie | Design deciso dall'agente | «vorrei usare gli UI designer e UX designer … per avere almeno 4 proposte di UI + 4 proposte di UX» | Proprietario | Fase 1B | sì | — |
| DR-020 | 2026-09-13 | Formato obbligatorio di chiusura di ogni risposta | Tabella stato fasi + tabella azioni bloccanti attese dall'utente + prompt successivo suggerito | Formato libero | «così ripulisco il contesto e puoi ripartire più leggero» | Proprietario | Interazione | sì | — |
| DR-021 | 2026-09-13 | Documenti di handoff | **Obbligatori** in `docs/handoff/` per ogni azione richiesta all'utente, con istruzioni passo passo | Istruzioni solo in chat | «crea un documento di handoff in cui mi spieghi passo passo» | Proprietario | Interazione | sì | — |
| DR-022 | 2026-09-13 | Riesame delle decisioni storiche | L'utente chiede di **risottoporre** anche le decisioni che derivano dai vecchi file in `source-private/` | Darle per acquisite | «non ricordo tutte le decisioni prese nelle scorse sessioni» | Proprietario | Tutte le fasi | — | DR-H01…H07 |
| DR-023 | 2026-09-13 | Percorso del registro decisioni (D9) | **`docs/decisions/decision-register.md`**, come previsto dalla skill `grill-me` | `docs/discovery/` | Convenzione già fissata dalla skill | Proprietario (per convenzione) | Documentazione | sì | D9 |
| DR-024 | 2026-09-13 | Approvazione della Fase 0 | **Approvata** | — | «La fase 0 è approvata» | Proprietario | Roadmap | no | — |

---

## 3. Decisioni storiche in attesa di riconferma

L'utente ha chiesto (DR-022) che queste vengano risottoposte. Finché non sono
riconfermate **non sono vincolanti** e non autorizzano alcuna implementazione.

| id | data originale | decisione storica | stato oggi |
|---|---|---|---|
| DR-H01 | 2026-03-03 | PostgreSQL come motore di database | **assorbita** da DR-001 |
| DR-H02 | 2026-03-03 | Regole di disponibilità stanze configurabili da admin, non hardcoded | da riconfermare — fase gestionale |
| DR-H03 | 2026-03-03 | RUNTS basato sul Rendiconto per Cassa Mod. D ufficiale | da riconfermare — richiede validazione professionale |
| DR-H04 | 2026-03-03 | Commenti, documentazione e messaggi utente in italiano | **applicata** in `CLAUDE.md`, da riconfermare formalmente |
| DR-H05 | 2026-03-03 | Nomi di tabelle e colonne in italiano snake_case | **aperta** — vedi D7 |
| DR-H06 | 2026-03-03 | WhatsApp escluso dalla versione corrente | **aperta** — vedi D8 |
| DR-H07 | 2026-03-03 | App desktop e mobile con .NET MAUI | **superata** da DR-017 |

---

## 4. Decisioni prese in autonomia dall'agente

Solo scelte reversibili e di forma.

| id | data | decisione | motivo | reversibile |
|---|---|---|---|---|
| DR-A01 | 2026-09-13 | Documenti di progetto in italiano | Coerenza con DR-H04 e con la direttiva | sì |
| DR-A02 | 2026-09-13 | `credenziali.txt` non aperto | Vincolo privacy, nessuna necessità | sì |
| DR-A03 | 2026-09-13 | `modelli/` inventariato per nome e natura, non per contenuto | Dati reali finanziari e personali | sì |
| DR-A04 | 2026-09-13 | Conteggi WordPress ricavati dalla sorgente, non dai documenti storici | I documenti contengono conteggi discordanti | sì |
| DR-A05 | 2026-09-13 | Aggiunta della Fase 1G (collaudo redazionale del CMS) | Richiesta dalla condizione 7 del gate, assente dall'elenco della direttiva | sì |
| DR-A06 | 2026-09-13 | `wp-config.php` del backup non stampato | Contiene credenziali del database | sì |

---

## 5. Round 2 di `grill-me` — risposte del 2026-09-13

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-025 | 2026-09-13 | Istanza di riferimento (D2b) | **Opzione A** — costruita in Docker dal backup e dal dump, poi congelata | Stack PHP/MySQL dell'utente; solo sito online | «Opzione A ottima» | Proprietario | Fase 1A, 1E | sì — l'istanza si distrugge a fine 1E | D2b, HO-001 |
| DR-026 | 2026-09-13 | Ambito dell'importazione (D3) | **Opzione C — importare tutto, senza bonifica dei dati** | Import minimale; minimale più utenze redazionali | «Ho bisogno che quei dati siano presenti anche se le verifiche di privacy le aggiungeremo dopo» | Proprietario | Schema PostgreSQL, importer, privacy | sì, ma la cancellazione successiva va progettata | D3, R-04, MI-06 |
| DR-027 | 2026-09-13 | Politica di commit | Commit **e push** alla fine di ogni fase o wave, anche in assenza di test; lavoro direttamente su `main` | Feature branch e pull request | «Sono l'unico a lavorare sul progetto» | Proprietario | Git | sì | — |
| DR-028 | 2026-09-13 | Perimetro delle proposte UI/UX (D10) | **Opzione B** — proposte sull'intera area amministrativa futura, con il CMS come primo modulo | Solo perimetro CMS | — | Proprietario | Fase 1B | sì | D10 |
| DR-029 | 2026-09-13 | Riconferma delle decisioni storiche (D11) | **Opzione A** — poche per volta, quando la fase che le riguarda sta per partire | Documento unico da approvare in blocco | — | Proprietario | Tutte le fasi | sì | D11, DR-022 |
| DR-030 | 2026-09-13 | Perimetro della PWA (D12) | **Opzione A** — la PWA riguarda **solo l'area di backend**, dopo il gate. Il sito pubblico resta un sito, senza manifest né service worker | PWA già in Fase 1 | «L'area di backend è l'unica che va sulla PWA» | Proprietario | Fase 1E e fasi post-gate | sì | D12, DR-017 |

### Nota sulla portata di DR-026

La decisione è registrata come espressa dall'utente: si importa **tutto**, senza
bonifica. Restano vincolanti, perché riguardano un ambito diverso e non sono state
revocate:

- **DR-010** continua ad applicarsi a test, seed, fixture, screenshot, log,
  documentazione e Git: lì i dati reali non entrano comunque.
- La valutazione privacy delle 425 compilazioni di form è **rimandata**, non
  cancellata: è tracciata come rischio R-04 e come input mancante MI-06, e richiede
  **validazione legale** prima della messa in produzione.

---

## 6. Decisioni ancora aperte

Nessuna viene registrata qui prima di una risposta esplicita dell'utente.

Aperte al 2026-09-13: **D5** (ADR su framework API, ORM, reverse proxy), **D6**
(hosting, provider e costi), **D7** (lingua dei nomi di tabelle e colonne), **D8**
(WhatsApp), più gli input mancanti **MI-01**, **MI-02**, **MI-03** e **MI-10** che
diventeranno decisioni nel Round 3, all'apertura della Fase 1B.

---

## 7. Round 3 — risposte del 2026-09-14, apertura della Fase 1B

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-031 | 2026-09-14 | Approvazione della Fase 1A | **Approvata** | — | «Fase 1A: approvata» | Proprietario | Roadmap | no | — |
| DR-032 | 2026-09-14 | Comportamento dei form in Fase 1 (MI-01) | **Form minimale che recapita per email.** In fase gestionale sarà sostituito da form generati dinamicamente dal backend | Form resi ma disabilitati; pagina che rimanda a un contatto | «form minimale via email (poi dovrà essere sostituita da form generati dinamicamente tramite backend)» | Proprietario | Fase 1B, 1D, 1E | sì — la sostituzione è già prevista | MI-01, R-11 |
| DR-033 | 2026-09-14 | Destinazione dei 4 documenti riservati e ambito del primo deploy (MI-02) | **I 4 file devono essere presenti anche nella futura area riservata.** Il **primo deploy** deve avere il frontend pixel-perfect **e** un backend minimale che consenta di **aggiungere e modificare pagine** | Documenti inaccessibili fino alla fase gestionale; primo deploy di solo frontend | «I 4 file devono essere presenti anche nella futura area riservata … il primo deploy deve avere il frontend pixel-perfect uguale ma deve anche avere il backend minimale per poter aggiungere/modificare pagine» | Proprietario | Fase 1B, 1D, 1F, gate | no | MI-02 |
| DR-034 | 2026-09-14 | Perimetro di parità delle pagine allegato (MI-10) | **Le 170 pagine allegato restano 301** e il comportamento va mantenuto. Non sono pagine visibili: rimandano all'allegato | Portarle nel perimetro visivo (293 URL invece di 123) | «Le pagine 301 vanno bene, non sono pagine visibili ma rimandano all'allegato e vorrei mantenere questo comportamento» | Proprietario | Fase 1B, 1D, 1E | sì | MI-10, R-09 |
| DR-035 | 2026-09-14 | Metodo di scelta su framework API, ORM e reverse proxy (D5) | **Tre ADR argomentate portate in Fase 1B**, con scelta dell'utente sulle ADR | Scelta secca anticipata | «porta tre ADR argomentate in Fase 1B» | Proprietario | Fase 1B | — | D5 |
| DR-036 | 2026-09-14 | Lingua dei nomi di tabelle e colonne (D7) | **Opzione B — tutto in inglese snake_case**, allineato ai nomi dei modelli | Italiano snake_case con mappatura nell'ORM | «Tutto in inglese snake_case, allineato ai nomi dei modelli» | Proprietario | Schema, ORM | no, senza ADR | D7 — **supera DR-H05 e RN-07** |
| DR-037 | 2026-09-14 | Ambiente PHP e database di produzione (MI-03, HO-002) | **PHP 7.4.33** con supporto a interi a 64 bit, estensione **`mysqli`**, server database **MySQL 5.6.51-91.0-log**. L'utente autorizza la lettura di `https://www.centroamorislaetitia.it/ver.php` per i valori di ambiente | — | Risposta all'handoff HO-002 | Proprietario | Riproducibilità, Fase 1B, 1F | — | MI-03, HO-002 |

### Note sulla portata del Round 3

- **DR-033** cambia il contenuto del primo rilascio: il gate di Fase 1 non si supera
  con il solo sito pubblico, ma con sito pubblico **più** CMS minimo capace di
  creare e modificare pagine. Non è una fase gestionale: è il requisito RC-03, già
  in perimetro.
- **DR-033** non autorizza la costruzione dell'area riservata: dichiara che i 4
  documenti **dovranno** comparirvi quando esisterà. In Fase 1 restano non pubblici
  e vanno conservati, non esposti.
- **DR-032** impone che il form recapiti davvero. Un endpoint che invia email
  richiede un mittente configurato, e rientra fra le azioni che `CLAUDE.md`
  sottopone a **conferma obbligatoria** prima dell'attivazione.
- **DR-036** supera DR-H05 e rende non più applicabile il requisito **RN-07**.
- **DR-037** registra una **difformità di ambiente**: la produzione gira su PHP
  7.4.33 e MySQL 5.6, mentre l'istanza di riferimento usa PHP 8.2 e MariaDB 10.11.
  Trattata come rischio **R-16** in `docs/migration/migration-risks.md`.

### Stato delle decisioni aperte al 2026-09-14

Chiuse in questo round: **D5**, **D7**, **MI-01**, **MI-02**, **MI-03**, **MI-10**.
Restano aperte **D6** (hosting, provider e costi — termine Fase 1F) e **D8**
(WhatsApp — dopo il gate), più le decisioni nuove aperte dalla Fase 1B, raccolte
nel Round 4.

---

## 8. Round 4 — risposte del 2026-09-14, chiusura della Fase 1B

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-038 | 2026-09-14 | Approvazione delle dieci ADR (D15) | **Opzione A — approvate in blocco** | Approvazione una per una; approvazione parziale | «ADR approvate in blocco» | Proprietario | Tutta la Fase 1 e seguenti | secondo quanto dichiara ciascuna ADR al §6 | D15, DR-035, ADR-001…ADR-010 |
| DR-039 | 2026-09-14 | Comportamento dei form con pagamento (D14) | **Opzione B — raccolta più rimando a PayPal**: il form resta identico, dopo l'invio compare il collegamento al pagamento con l'importo. Nessuna riconciliazione automatica | Raccolta senza pagamento; parità piena del pagamento | «Opzione B» | Proprietario | Fase 1D, 1E, ADR-010 | sì — il collegamento è configurabile per form | D14, DR-032, ADR-010 §2 |
| DR-040 | 2026-09-14 | Difetti di qualità del sito attuale (D13) | **Opzione C — correggere i metadati non visibili e restituire il titolo principale alle 29 pagine che non ce l'hanno**, reso graficamente identico al testo che oggi lo sostituisce | Riprodurre i difetti; correggere i soli metadati | «Opzione C» | Proprietario | Fase 1D, 1E, criteri di parità | sì | D13 |
| DR-041 | 2026-09-14 | Foglio di stile per la stampa (D16) | **Opzione A — fuori perimetro**: non si confronta e non si riproduce | Confronto su un campione di pagine | «Opzione A» | Proprietario | Fase 1E | sì — rientra con un giro di confronti dedicato | D16 |
| DR-042 | 2026-09-14 | Sorte della pagina di diagnostica in produzione (HO-003) | **Protezione con password anziché cancellazione.** L'utente chiede i due file da caricare | Cancellazione del file; rinomina | «Vorrei farlo proteggendolo con password. Dammi i due file da caricare» | Proprietario | Sito in produzione, rischio R-17 | sì | HO-003, R-17 |
| DR-043 | 2026-09-14 | Politica di push | **Al commit finale di ogni fase segue sempre la push**, senza chiedere conferma volta per volta | Conferma puntuale a ogni push | «da ora in poi al commit finale di ogni fase puoi sempre far seguire la push» | Proprietario | Git | sì — revocabile in qualunque momento | DR-027, `CLAUDE.md` §«Conferma obbligatoria» |

### Note sulla portata del Round 4

- **DR-038** sblocca la Fase 1C. Da questo momento le dieci ADR passano da
  `proposta` ad **`approvata`**, con due precisazioni che restano vere perché sono
  scritte nelle ADR stesse e non sono state revocate:
  - **ADR-009** approva la **forma** del deployment (Docker Compose su host singolo).
    La scelta del **fornitore** resta la decisione aperta **D6**, con termine
    all'inizio della Fase 1F.
  - **ADR-007** dichiara nel proprio §6 di essere la scelta a rischio più alto e di
    imporre un **riesame obbligatorio** prima della fase gestionale. L'approvazione
    in blocco non cancella quel riesame: lo conferma.
- **DR-039** chiude il conflitto dichiarato in ADR-010 §6. L'importo e il
  collegamento di pagamento diventano **dati del form**, non codice, coerentemente
  con ADR-010 §4.1. Nessun trattamento della transazione entra in Fase 1: il Centro
  incassa su PayPal come oggi e la verifica resta manuale.
- **DR-040** amplia il perimetro di lavoro della Fase 1E di 29 pagine da
  riverificare al pixel dopo l'introduzione del titolo principale. Il titolo si
  aggiunge con la resa grafica del testo che oggi lo sostituisce: se il confronto
  visivo rileva uno scostamento sopra soglia, prevale la parità e la pagina torna
  in discussione.
- **DR-041** non autorizza a dichiarare «verificata» la resa in stampa: la dichiara
  **fuori perimetro**, che è un'affermazione diversa e va scritta come tale nel
  rapporto di parità.
- **DR-042** non chiude il rischio **R-17**: lo riduce. La protezione con password
  toglie la pagina agli scanner automatici, ma il file resta sul server. Il rischio
  si chiude con la rimozione, che resta la strada consigliata e che il passaggio in
  produzione della Fase 1F renderà comunque naturale.
- **DR-043** non estende l'autorizzazione oltre la push: restano a **conferma
  obbligatoria** deploy, DNS, certificati, email, pagamenti, import reali,
  migrazioni su database di produzione, cancellazioni e modifiche a dati reali.

### Decisioni rimaste aperte dopo il Round 4

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni | prima della produzione. **Richiede un professionista** |
| **HO-004** | Le cinque domande sul design dell'area amministrativa | **in attesa**: l'utente ha chiesto uno strumento di scelta visiva prima di rispondere. Prodotto in questa sessione, vedi `docs/design/chooser/` |

---

## 9. Round 5 — risposte del 2026-09-15, chiusura di HO-004 e HO-005

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-044 | 2026-09-15 | D-UI-1 — proposta di UI di base per l'area amministrativa | **(a) Scrivania** — banco di lavoro denso, due colonne di navigazione permanenti, blu istituzionale su grigi freddi | Accoglienza, Comando, Quaderno | risposta a HO-004, senza motivazione dichiarata | Proprietario | Fase 1D | sì, con ADR | HO-004 §6 |
| DR-045 | 2026-09-15 | D-UX-1 — proposta di UX di base | **(b) Le aree di responsabilità** | La scrivania dei compiti, Il registro degli oggetti, L'anno associativo | risposta a HO-004, senza motivazione dichiarata | Proprietario | Fase 1D | sì, con ADR | HO-004 §6 |
| DR-046 | 2026-09-15 | D-UX-2 — organizzazione del Centro | **(a) sì, le persone hanno ruoli abbastanza distinti** | (b) poche persone fanno di tutto, (c) via di mezzo | risposta a HO-004, senza motivazione dichiarata | Proprietario | Fase 1D | — | HO-004 §6 |
| DR-047 | 2026-09-15 | D-UX-3 — funzionamento del cambio di ruolo | **(b) tutti i ruoli insieme, unione dei permessi, nessuna commutazione** | (a) un solo ruolo attivo per volta, (c) tutti attivi con filtro visivo | risposta a HO-004, senza motivazione dichiarata | Proprietario | Fase 1D, registro operazioni | — | HO-004 §6 |
| DR-048 | 2026-09-15 | D-UI-2 — carattere dell'area amministrativa | **(b) un carattere d'interfaccia distinto** da quello del sito pubblico | (a) Open Sans ovunque | risposta a HO-004, senza motivazione dichiarata | Proprietario | Fase 1D, identità | — | HO-004 §6, DR-018 |
| DR-049 | 2026-09-15 | HO-005 — protezione con password della pagina di diagnostica | **eseguita dall'utente**. Attua DR-042 | — | «HO-005: fatto» | Proprietario | Produzione, R-17 | — | HO-005, DR-042, R-17 |

### Note sulla portata del Round 5

- **DR-044 e DR-045 sbloccano la Fase 1D**: HO-004 era l'ultima decisione bloccante della
  1B. La UI e la UX scelte diventano un documento unico di sistema di design prodotto in Fase
  1D (HO-004 §10 punto 3).

- **DR-046 conferma** la premessa su cui poggia la proposta B: la domanda D-UX-2 era quella che
  poteva ribaltare la raccomandazione, e non la ribalta.

- **DR-047 è una scelta contraria alla raccomandazione**, che era (a). Va scritto così, perché
  il registro serve a ricordare che cosa è stato scelto e non che cosa era consigliato.
  Conseguenze da dichiarare: l'interfaccia non ha un commutatore di ruolo; i permessi sono
  l'unione di quelli dei ruoli della persona; il registro delle operazioni non potrà attribuire
  un'azione al ruolo con cui è stata compiuta, perché non esiste un ruolo attivo. HO-004
  dichiarava questa la scelta **più costosa da cambiare dopo**: resta vero.

- **Tensione fra DR-045 e DR-047, aperta**: la proposta UX B nasce sull'idea di riconfigurare
  l'ambiente in base alla veste scelta, mentre DR-047 esclude la commutazione. La lettura
  proposta dall'agente è che le aree restino un fatto di **navigazione e raggruppamento**, non
  di permesso. **Questa lettura non è approvata**: va confermata dall'utente e finché non lo è
  resta un'assunzione. In Fase 1 esistono comunque solo le aree «Redazione» e «Impostazioni»,
  quindi oggi la tensione ha effetti limitati.

- **DR-048** non è una scelta tecnica ma di identità: l'area amministrativa deve essere
  riconoscibilmente un'altra cosa dal sito pubblico, coerentemente con DR-018.

- **DR-049 non chiude il rischio R-17**: lo riduce, come già scritto in DR-042. Il file
  resta sul server e sparirà con il passaggio in produzione della Fase 1F.

### Decisioni rimaste aperte dopo il Round 5

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni | prima della produzione. **Richiede un professionista** |
| **Lettura delle aree come navigazione** | Confermare che DR-045 e DR-047 insieme significano: le aree sono navigazione e raggruppamento, **non** controllo di permesso | prima della wave 1D-W8 |

---

## 10. Round 6 — risposte del 2026-09-15, revisione di D-UX-3 e chiusura di tre decisioni di design

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-050 | 2026-09-15 | D-UX-3 — funzionamento del cambio di ruolo, **seconda decisione** | **(a) un solo ruolo attivo per volta, scelto esplicitamente**: l'interfaccia mostra solo ciò che quel ruolo può fare | (b) tutti i ruoli insieme, (c) tutti attivi con filtro visivo | Cambia la decisione D-UX-3 con (a) Un solo ruolo attivo per volta, scelto esplicitamente | Proprietario | Fase 1D, registro operazioni, intestazione | — | **supera DR-047**; HO-004 §6; DR-045 |
| DR-051 | 2026-09-15 | Tema scuro dell'area amministrativa nel primo rilascio | **token definiti ora, verifica dopo il primo rilascio**: i valori dei due temi entrano subito come variabili CSS, ma in Fase 1 si verifica e si collauda **solo il tema chiaro** | Realizzato e verificato subito; non previsto | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, design system | sì | HO-004 §7; `docs/design/design-system.md` cap. 11 decisione 1 |
| DR-052 | 2026-09-15 | Carattere d'interfaccia dell'area amministrativa | **Inter variabile, ospitato sul server del progetto** | Altra famiglia libera; pila di caratteri di sistema | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, identità, dipendenze | — | DR-048; `docs/design/design-system.md` cap. 3 e cap. 11 decisione 3 |
| DR-053 | 2026-09-15 | Prestiti dalle altre proposte di UI | **rinviata**: l'utente ha chiesto di vedere i tre prestiti descritti uno per uno prima di scegliere | — | Dimmi quali sono, poi scelgo | Proprietario | Fase 1D, proposte di UI | — | DR-044; HO-004 §5 |

### Note sulla portata del Round 6

- **DR-050 supera DR-047 e chiude la tensione aperta nel Round 5.** La contraddizione era fra DR-045 (la UX «Le aree di responsabilità», il cui principio è che si sceglie in che veste si lavora e l'applicazione si riconfigura) e DR-047 (nessuna commutazione di ruolo). L'utente non ha scelto fra le tre letture proposte nel Round 5: **ha cambiato D-UX-3**. La contraddizione quindi non si risolve con un'interpretazione, ma sparisce.

- **Conseguenze di DR-050**, da elencare: l'area amministrativa **ha** un commutatore di ruolo esplicito; la sessione è vincolata all'ambiente attivo, e il sistema rifiuta dati di un'altra area **anche quando il permesso ci sarebbe** (`ux-proposals.md` §4.4 punto 2, che torna valido); l'intestazione di ogni schermata mostra l'ambiente attivo; il registro delle operazioni **può** attribuire un'azione al ruolo con cui è stata compiuta. Si recupera la separazione della riservatezza come separazione di **ambiente**, che era la ragione principale per cui la proposta B era stata raccomandata.

- **Il costo va detto**: HO-004 dichiarava D-UX-3 «la scelta più costosa da cambiare dopo», perché tocca permessi, registro delle operazioni e intestazione di ogni schermata. Cambiarla adesso costa poco perché **nessuna riga di interfaccia era ancora stata scritta**: la wave `1D-W8` non era iniziata. Cambiarla di nuovo più avanti costerebbe molto di più.

- **DR-051 non promette un tema scuro funzionante nel primo rilascio**: promette che i valori esistono. Dichiararlo «pronto» senza la verifica sarebbe falso.

- **DR-052 non introduce alcuna dipendenza esterna a runtime**: il carattere è servito dal progetto, non da un servizio di terze parti.

- **DR-053 non è una decisione presa.** Finché non lo è, il documento di sistema di design descrive la proposta 1 senza i prestiti, e i capitoli che li citano restano da correggere.

### Decisioni rimaste aperte dopo il Round 6

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni. **Richiede un professionista** | prima della produzione |
| **DR-053** | I tre prestiti dalle altre proposte di UI | prima della wave `1D-W7` |
| **Spaziature di Divi** | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea di ADR-005 §3.3 regola 2 | prima dell'inizio della Fase 1E |

**La voce «Lettura delle aree come navigazione», aperta nel Round 5, è chiusa da DR-050**: la decisione di usare un solo ruolo attivo per volta elimina la tensione fra DR-045 e DR-047, perché non c'è più contraddizione su come funziona la commutazione.

---

## 11. Round 7 — risposte del 2026-09-15, adozione dei tre prestiti e chiusura di quattro decisioni di design

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-054 | 2026-09-15 | I tre prestiti dalle altre proposte di UI | **tutti e tre adottati**, con una condizione posta dall'utente: **resta l'interruttore per la densità piena**, e la scelta viene ricordata. I tre: (1) da «Accoglienza», densità comoda come predefinita, stati scritti per esteso, percorsi a passi numerati per le operazioni rare; (2) da «Comando», ricerca rapida da tastiera come acceleratore, che raggiunge solo l'ambiente attivo e non sostituisce mai i menu; (3) da «Quaderno», marcatore di riservatezza a tutta altezza sul lato | solo alcuni dei tre; nessuno | «Sì, l'importante è che rimanga l'interruttore per la densità piena» | Proprietario | Fase 1D | sì | **supera DR-053**; completa DR-044; HO-004 §5; `docs/design/design-system.md` cap. 5 e 6 |
| DR-055 | 2026-09-15 | Nome della seconda area e trattamento delle aree non costruite | **«Impostazioni»; le quattro aree non ancora costruite non compaiono affatto** | «Direzione»; aree future mostrate spente o «in arrivo» | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì | DR-045, `ux-proposals.md` §4.2, `design-system.md` cap. 7.2 |
| DR-056 | 2026-09-15 | Utente prioritario dell'area amministrativa | **chi entra ogni giorno**, con le mitigazioni per chi entra di rado | chi entra poche volte l'anno; entrambi con pari peso | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì | `ui-proposals.md` domanda 2, `design-system.md` cap. 11 |
| DR-057 | 2026-09-15 | Azioni non permesse in interfaccia | **non si mostrano** | si mostrano disabilitate con la spiegazione del perché | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì | DR-050, `design-system.md` cap. 8.3 |

### Note sulla portata del Round 7

- **DR-054 supera DR-053**, che aveva registrato il rinvio. Il rinvio era esso stesso una risposta, e resta a registro: DR-053 non si cancella.
- **La condizione di DR-054 è parte della decisione, non un dettaglio di attuazione.** L'interruttore per la densità piena deve esistere sempre; la scelta va ricordata **fra le sessioni** e conservata con l'account, non con il browser. Un'attuazione che dimentica la scelta a ogni accesso non soddisfa DR-054.
- **DR-054 cambia i valori predefiniti dell'interfaccia**: le righe delle tabelle nascono a 44 px invece che a 36, e sullo schermo entra circa un quinto di righe in meno. È il prezzo dichiarato, e l'interruttore è ciò che lo rende reversibile dall'utente e non dal codice.
- **Il prestito 2 è vincolato da DR-050**: la ricerca rapida raggiunge solo l'ambiente attivo. Se permettesse di saltare in un'altra area romperebbe la regola che la sessione è vincolata all'area, che è ciò su cui poggia la riservatezza.
- **DR-055 è stata presa sapendo che uno dei due argomenti a sostegno era caduto** con la revoca di DR-047. Va scritto, perché è il genere di cosa che si dimentica.
- **DR-056 non è una promessa generica**: le mitigazioni per chi entra di rado sono esattamente il prestito 1 di DR-054, e null'altro.
- **DR-057 è una regola trasversale**, non una scelta estetica: si applica a bottoni, bottoni con icona, barra delle azioni multiple, navigazione di sezione, navigazione di area e commutatore di ruolo.
- **Dopo questo round, `docs/design/design-system.md` non ha più decisioni aperte**: tutte e sette quelle del suo capitolo 11 sono chiuse.

### Decisioni rimaste aperte dopo il Round 7

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni. **Richiede un professionista** | prima della produzione |
| **Spaziature di Divi** | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea di ADR-005 §3.3 regola 2 | prima dell'inizio della Fase 1E |
| **Esecuzione reale dell'import** | `CLAUDE.md` la colloca fra le azioni a conferma obbligatoria: «import reali non dry-run» | prima della wave `1D-W11` |

**DR-054 chiude DR-053**: il rinvio sul quale l'utente aveva chiesto di vedere i tre prestiti descritti uno per uno è ora sciolto. DR-053 rimane a registro come decisione rinviata e successivamente superata.

---

## 12. Round 8 — risposte del 2026-09-15, chiusura di due decisioni su importazione e schema

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-058 | 2026-09-15 | Come si importano i 4 documenti riservati (`cuar_private_file`) | **Si aggiunge subito un secondo lettore di sorgente**, nella wave `1D-W5`, che legge `wp-content/customer-area/storage/` e porta i 4 file nel bucket `media-private` | Importare solo le schede e rimandare i file; lasciare i documenti riservati interamente fuori dalla Fase 1 | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì, con ADR | `IMPORTER-DESIGN.md` §11.6, ADR-004 §3.6, DR-033 |
| DR-059 | 2026-09-15 | Che cosa promette `rollback` dell'importer | **Si aggiunge una colonna alla tabella delle corrispondenze dell'import** (`import_id_map`), che registra se la riga è nata da una creazione o da un aggiornamento. `rollback` diventa corretto per qualunque esecuzione, non solo per la prima | `rollback` limitato al primo import, con elenco senza ripristino per le successive; togliere `rollback` dal perimetro e affidarsi al solo ripristino del backup | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì, con ADR | `IMPORTER-DESIGN.md` §10 punto 2 e §11.5, `importer-spec.md` §9 e §14 punto 8 |

### Note sulla portata del Round 8

- **DR-058 nasce da un fatto misurato che smentisce un presupposto**: ADR-004 §3.6 dava per scontato che i documenti riservati fossero allegati come gli altri. Non lo sono: non stanno in `uploads/` e nessuna riga di `wp_posts` li referenzia. La decisione non corregge l'ADR — **registra che il presupposto era incompleto**, e il lettore aggiuntivo è la conseguenza.

- **DR-058 rende vera una condizione di DR-033**: i 4 documenti «devono esistere per la futura area riservata». Senza i file esisterebbero solo le schede, che è una cosa diversa e andrebbe detta.

- **DR-058 non espone nulla**: i 4 file vanno in `media-private`, che ADR-004 §3.6 vuole senza alcun accesso pubblico, nemmeno indovinando il nome. In Fase 1 restano conservati e non raggiungibili.

- **Attenzione a una trappola documentata**: la cartella `download-manager-files`, esclusa da ADR-004 §3.2, contiene **4 PDF diversi con nomi simili** a quelli riservati. Chi avesse ragionato invece di guardare avrebbe importato i file sbagliati credendoli quelli giusti. Va scritto, perché è il genere di errore che si ripete.

- **DR-059 autorizza una modifica a uno schema approvato in Fase 1B.** È la prima. Va detto esplicitamente che lo schema delle 32 tabelle non è intoccabile ma si modifica **con una decisione registrata**, non di iniziativa.

- **La colonna non contiene dati personali**: registra soltanto se una riga è stata creata o aggiornata.

- **Perché serve**: senza quella distinzione, annullare la **seconda** esecuzione cancellerebbe righe che esistevano già, cioè distruggerebbe dati invece di ripristinarli. Il primo import si annulla correttamente anche senza; il secondo no.

- **DR-059 non rende `rollback` una rete di sicurezza generale.** `importer-spec.md` §9 dice già che `rollback` **rifiuta di procedere** se c'è stato lavoro redazionale dopo l'import, e che il ripristino del backup resta la strada più rapida e sicura per riportare a zero un database. Questo non cambia.

---

## 13. Round 9 — risposte del 2026-09-15, correzione di due documenti della Fase 1B

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-060 | 2026-09-15 | La cartella `uploads/download-manager-files`, che ADR-004 §3.2 esclude come «cartella di servizio» | **Si corregge l'esclusione**: la cartella esce dall'elenco e i suoi file entrano nell'archivio dei media. Contiene quattro moduli per le consulenze in PDF, cioè contenuto che il sito offre in scaricamento, non scarti di un plugin. **Le altre cinque cartelle escluse restano escluse** | Tenere la cartella esclusa e far prelevare alla sola fase dei documenti i quattro file mirati; lasciare i documenti senza file | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì, con ADR | `IMPORTER-DESIGN.md` §11.11, ADR-004 §3.2, DR-038 |
| DR-061 | 2026-09-15 | Quali tassonomie importa la fase `terms` | **Si importano anche `wpdmcategory` e `cuar_private_file_category`**, oltre a `category` | Importare la sola `wpdmcategory`; non importarne nessuna delle due | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì, con ADR | `IMPORTER-DESIGN.md` §11.12, `wp-to-postgres-mapping.md` §1 |

### Note sulla portata del Round 9

- **DR-060 corregge una classificazione sbagliata in ADR-004 approvata.** L'esclusione era stata decisa dal **nome della cartella**, non dal suo contenuto. La verifica diretta ha mostrato che dentro ci sono quattro moduli PDF che il sito offre davvero in scaricamento — non sono scarti di un plugin, sono contenuto. Mantenerla significherebbe perdere quattro documenti pubblici senza produrre errori: la perdita non si manifesterebbe come un guasto, ma come otto righe mancanti in una tabella che nessuno conta.

- **DR-060 non allarga l'importazione oltre questo**: `uploads/backwpup*`, `uploads/wpforms`, `uploads/aioseo`, `uploads/wpdm-cache`, `uploads/et_temp`, `wpdm-custom-tags` e `wpdm-file-type-icons` restano escluse. Quelle sono davvero cache, backup e risorse di plugin.

- **Attenzione ai nomi, che invitano all'errore**: i 4 file pubblici di questa cartella e i 4 documenti riservati di DR-058 hanno nomi quasi identici — gli stessi moduli, con o senza trattini. Sono **otto documenti distinti**, non quattro visti due volte. Va scritto perché è il genere di errore che si ripete.

- **DR-061 amplia ciò che il mapping della Fase 1B aveva classificato.** Senza, la tabella che lega documenti e tassonomie resterebbe vuota. Ha già un effetto visibile: **una voce di menu su 64** viene oggi saltata perché punta a un termine di `wpdmcategory`. Con DR-061 si recupera.

- **Entrambe le decisioni riguardano la Fase 1B, non solo la 1D**: ADR-004 e `wp-to-postgres-mapping.md` sono prodotti approvati, e vanno **corretti dichiarando la correzione**, non riscritti in silenzio. La correzione dei due documenti è lavoro di una wave di documentazione.

### Decisioni rimaste aperte dopo il Round 9

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni. **Richiede un professionista** | prima della produzione |
| **Spaziature di Divi** | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea di ADR-005 §3.3 regola 2 | prima dell'inizio della Fase 1E |
| **Esecuzione reale dell'import** | `CLAUDE.md` la colloca fra le azioni a conferma obbligatoria: «import reali non dry-run» | prima della wave `1D-W11` |
| **Due contenuti con percorso in collisione** | Slug condiviso fra tipi diversi in un caso, bozza senza slug nell'altro. Assegnare d'ufficio un percorso diverso è una modifica di URL, materia di parità e indicizzazione | wave `1D-W11` |
| **Un allegato non recuperabile** | Il database lo cerca con maiuscole diverse da quelle del file vero. Non si risolve rinominando, che ADR-004 §3.1 vieta per non far divergere il `srcset` | wave `1D-W11` |
| **Ordine delle fasi e soglia del blocco di riserva** | `contents` è la fase 5 e `forms` la 11, quindi il convertitore non può risolvere i moduli form: 24 dei 31 blocchi di riserva sono quelli, e la soglia di ADR-005 §3.4 resta superata (10,16 % su 10 %, 27 contenuti su 15). Nessuna delle fasi 9, 10, 11 dipende da `contents`. Spostarle prima è una modifica all'ordine obbligato di `importer-spec.md` §4, documento approvato in Fase 1B. Misurato in `IMPORTER-DESIGN.md` §11.19 | **prima della wave `1D-W10`** |
| ~~**Correzione di ADR-004 e del mapping**~~ | ~~DR-060 e DR-061 correggono due documenti approvati della Fase 1B: la correzione va scritta, dichiarandola~~ — **chiusa il 2026-09-16 nella wave `1D-W5a`**: ADR-004 §3.2 e `wp-to-postgres-mapping.md` sono stati corretti dichiarando la correzione, e `IMPORTER-DESIGN.md` §11.13 ne registra gli esiti misurati | — |

---

## 14. Round 10 — risposte del 2026-09-16, ordine delle fasi e le tre anomalie della sorgente

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-062 | 2026-09-16 | Ordine delle fasi di import e soglia del blocco di riserva | **Si riordinano le fasi**: `documents`, `sliders` e `forms` si eseguono **prima** di `contents`, così che i tre risolutori esistano quando il convertitore incontra i blocchi corrispondenti | Lasciare l'ordine e chiedere deroga alla soglia di ADR-005 §3.4; far girare `contents` due volte, la seconda con i risolutori disponibili | «confermo A, il riordino delle fasi 9, 10, 11 prima di contents» | Proprietario | Fase 1D, `importer-spec.md` §4 | sì, con ADR | `IMPORTER-DESIGN.md` §11.9 e §11.19, ADR-005 §3.4, `BLOCK-MODEL.md` §10.4 |
| DR-063 | 2026-09-16 | Percorso del contenuto `wp_posts` 332, articolo che condivide lo slug con la pagina 328 | **Si importa come bozza**, con percorso provvisorio che include `legacy_id` e non è pubblico. La pagina 328 conserva l'indirizzo | Non importarlo affatto; pubblicarlo a un indirizzo nuovo con suffisso | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, parità degli URL | sì | `IMPORTER-DESIGN.md` §11.10, `database-schema.md` vincolo `contents_path_unique` |
| DR-064 | 2026-09-16 | Percorso del contenuto `wp_posts` 1781, bozza senza titolo e senza slug | **Si importa come bozza**, con percorso provvisorio derivato da `legacy_id`, mai pubblicata | Non importarla e dichiarare l'esclusione nell'audit | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D | sì | `IMPORTER-DESIGN.md` §11.10 |
| DR-065 | 2026-09-16 | L'allegato 341, il cui nome su disco non corrisponde a quello del database | **Si cerca il file senza distinguere maiuscole e minuscole** e lo si archivia con la chiave che database e contenuti già usano. La stessa regola vale per tutte e dieci le misure, così il `srcset` resta coerente | Lasciarlo fuori e riprodurre il difetto della sorgente; verificare prima sul sito pubblico se l'immagine si veda davvero | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, archivio dei media | sì, con ADR | `IMPORTER-DESIGN.md` §11.7, ADR-004 §3.1 |

### Note sulla portata del Round 10

- **DR-062 modifica un ordine che `importer-spec.md` §4 dichiara non essere «una preferenza».** È la seconda volta che una decisione registrata corregge un documento approvato in Fase 1B, dopo DR-059. L'ordine nuovo non viola alcuna dipendenza dichiarata: la fase `documents` dipende da `media` e `terms`, `sliders` da `media`, `forms` dal solo `preflight` — nessuna delle tre da `contents`.

- **DR-062 è la sola delle tre opzioni che agisce sulla causa.** I 24 blocchi di riserva su 31 sono moduli form privi di risolutore, non conversioni fallite: con `resolveForm` disponibile la misura attesa scende a 7 blocchi su 305, cioè 2,30 %, su 4 contenuti, dentro entrambe le soglie di ADR-005 §3.4. Il numero coincide con la stima indipendente del §10.4 di `BLOCK-MODEL.md`.

- **La soglia resta da riverificare dopo il riordino, non da dichiarare.** Finché la misura non è rifatta con l'ordine nuovo, la soglia non si dichiara rispettata.

- **DR-063 e DR-064 non inventano indirizzi.** Entrambi i contenuti entrano come bozze: nessuna delle due assegna un URL pubblico che sulla sorgente non esisteva, che è ciò che rendeva la decisione non delegabile. Il conteggio dei contenuti resta 108.

- **DR-063 riguarda un contenuto già oggi irraggiungibile.** Il sito usa i permalink `/%postname%/`, dove pagine e articoli condividono lo stesso spazio dei nomi: dei due contenuti con lo stesso slug, uno solo è servito. La decisione non toglie al pubblico nulla che il pubblico oggi veda.

- **DR-065 non rinomina nulla, e per questo non viola ADR-004 §3.1.** Il divieto esiste perché rinominare farebbe divergere il `srcset`; qui la chiave di archiviazione resta **esattamente** quella che database e contenuti già citano, e a cambiare è solo il modo in cui il file viene ritrovato sul disco di origine. Il `srcset` non diverge perché tutte e dieci le misure seguono la stessa regola.

- **DR-065 può produrre una differenza dalla sorgente, e va dichiarata.** Sia il database sia il markup dei contenuti citano quell'immagine in una forma che sul disco non esiste: è verosimile che l'immagine sia **rotta anche sul sito attuale**. Se la verifica di parità lo conferma, il sito nuovo mostrerà un'immagine dove il vecchio ne mostra una rotta. La differenza va scritta in `docs/qa/visual-parity-report.md` con il motivo, non nascosta.

- **Nessuna delle quattro decisioni è attuata da questo round.** DR-062 si attua prima della wave `1D-W10`; DR-063, DR-064 e DR-065 prima della `1D-W11`. Restano aperte nella tabella qui sotto finché non sono in codice.

### Decisioni rimaste aperte dopo il Round 10

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni. **Richiede un professionista** | prima della produzione |
| **Spaziature di Divi** | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea di ADR-005 §3.3 regola 2 | prima dell'inizio della Fase 1E |
| **Esecuzione reale dell'import** | `CLAUDE.md` la colloca fra le azioni a conferma obbligatoria: «import reali non dry-run» | prima della wave `1D-W11` |
| **Attuazione di DR-062** | Riordino delle fasi in `importer-spec.md` §4 e nell'orchestratore, più la misura della soglia rifatta con l'ordine nuovo | prima della wave `1D-W10` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori dei due contenuti in bozza e ricerca insensibile alle maiuscole per l'allegato 341 | prima della wave `1D-W11` |
| **Soglia delle 300 righe di ADR-007 §6, superata** | Misurata nella wave `1D-W6` con la regola scritta in `apps/api/tools/countAuthLines.ts` e dichiarata in `apps/api/tests/auth-line-count.json`: **342 righe** il nucleo (crittografia, password, sessioni, permessi, limitazione dei tentativi, anti-CSRF, riconoscimento della sessione), **684** contando anche rotte e schemi del modulo `auth`. La soglia è 300. La contromisura 3 del §6 di ADR-007 dice che in questo caso «si adotta Better Auth senza discutere»: è un cambio di architettura e non si prende di iniziativa | **prima della chiusura della Fase 1D**, e comunque prima della security review della Fase 1F |
| **Permessi: unione dei ruoli o ruolo attivo** | Il criterio di uscita 24 cita DR-047 e chiede l'**unione** dei permessi; DR-050 lo supera e adotta «un solo ruolo attivo per volta». In Fase 1 la differenza non è osservabile, perché ADR-007 §3.2 prevede un solo ruolo, e il servizio calcola oggi l'unione. Va deciso quale delle due il servizio deve attuare quando il commutatore nascerà | prima della wave `1D-W8` |
| ~~**Due contenuti con percorso in collisione**~~ | ~~Slug condiviso fra tipi diversi in un caso, bozza senza slug nell'altro~~ — **chiusa il 2026-09-16 da DR-063 e DR-064** | — |
| ~~**Un allegato non recuperabile**~~ | ~~Il database lo cerca con maiuscole diverse da quelle del file vero~~ — **chiusa il 2026-09-16 da DR-065** | — |
| ~~**Ordine delle fasi e soglia del blocco di riserva**~~ | ~~`contents` è la fase 5 e `forms` la 11, quindi il convertitore non può risolvere i moduli form~~ — **chiusa il 2026-09-16 da DR-062** | — |

---

## 15. Round 11 — risposte del 2026-09-20, soglia di ADR-007, ruolo attivo e salvataggio

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-066 | 2026-09-20 | Soglia delle 300 righe di ADR-007 §6, misurata e superata nella wave `1D-W6` | **Deroga motivata**: in Fase 1 si resta sulle sessioni proprie, scrivendo nell'ADR perché la premessa della proporzione regge lo stesso. Better Auth resta l'opzione di riferimento del riesame obbligatorio di ADR-007 §3.3, prima della fase gestionale | Adottare Better Auth adesso, prima della `1D-W8`; deroga con adozione anticipata alla Fase 1F dentro la security review | «D1 = A» | Proprietario | ADR-007, Fase 1D, Fase 1F | sì — ADR-007 §7 dichiara la reversibilità alta | `apps/api/tests/auth-line-count.json`, ADR-007 §6 contromisura 3 e §3.3, `PLAN.md` §7 punto 7 |
| DR-067 | 2026-09-20 | Permessi e commutatore di ruolo nell'area amministrativa | **DR-050 si attua per intero**: commutatore di ruolo esplicito, ambiente attivo nell'intestazione di ogni schermata, sessione vincolata al ruolo attivo con rifiuto lato servizio dei dati di un'altra area anche quando il permesso ci sarebbe, registro delle operazioni che attribuisce l'azione al ruolo | Restare sull'unione dei permessi e rimandare il commutatore; commutatore nella sola interfaccia, con l'API che continua a valutare l'unione | «D2 = A» | Proprietario | Fase 1D, `apps/api`, `apps/admin`, criterio di uscita 24 | sì, con ADR | **chiude la discrepanza fra il criterio 24 (DR-047) e DR-050**; `CONTEXT.md` §8 punto 2; `design-system.md` cap. 8 |
| DR-068 | 2026-09-20 | Salvataggio nell'editor del contenuto | **Bozza automatica separata**: si salva in automatico su una copia di lavoro; il contenuto pubblicato cambia solo su comando esplicito | Solo salvataggio esplicito, senza copia di lavoro | «D3 = B» | Proprietario | Fase 1D, `packages/db`, `apps/api`, `apps/admin`, schema | sì, con ADR | criterio di uscita 1D-36 e requisito F-05; `design-system.md` componente 29; ADR-006 §3.2 |

### Note sulla portata del Round 11

- **DR-066 modifica una ADR approvata, e la modifica si dichiara.** ADR-007 §6 contromisura 3 dice «si adotta Better Auth **senza discutere**». La deroga va scritta dentro l'ADR come revisione datata, non lasciata nel solo registro: chi legge l'ADR fra un anno deve trovare lì perché la contromisura non è scattata. È la terza volta, dopo DR-059 e DR-062, che una decisione registrata corregge un documento approvato.

- **La deroga non cancella l'obbligo, lo sposta.** Il riesame di ADR-007 §3.3 resta vincolante prima della prima fase gestionale, e la verifica di ADR-007 §8 per la Fase 1F resta invariata: la security review deve coprire il modulo in modo esplicito. La misura delle righe non si rifà per far tornare il numero.

- **DR-067 comporta una correzione all'API già committata.** La wave `1D-W6` ha realizzato l'unione dei permessi dichiarando la discrepanza invece di risolverla. Con DR-067 la sessione deve portare il ruolo attivo e il servizio deve restringere di conseguenza: è lavoro della `1D-W8`, non una riscrittura della `1D-W6`.

- **DR-067 riscrive il criterio di uscita 24.** Il criterio diceva «l'area amministrativa **non ha** un commutatore di ruolo, e i permessi di una persona sono l'**unione** di quelli dei suoi ruoli (DR-047)». DR-047 è superata da DR-050 dal 2026-09-15 e il criterio non era stato adeguato. Ora dice il contrario, e la riga di verifica della `1D-W8` nel piano va corretta insieme.

- **DR-067 recupera la riservatezza come separazione di ambiente.** È il punto 5 delle conseguenze di `CONTEXT.md` §8, decaduto con DR-047 e ora valido: rilevante per una fase gestionale che tratterà consulenze familiari, minori e documenti.

- **DR-068 allarga il perimetro della `1D-W8` oltre quanto il piano dichiara.** Una copia di lavoro è una tabella nuova, quindi una migrazione, quindi un numero di versione dello schema diverso da quello che il controllo 5 del preflight dell'importer confronta, e un conteggio in più in `database-schema.md`. Il §2 del piano assegnava alla `1D-W8` i soli `apps/admin/**` e `packages/ui`. La conseguenza si dichiara qui e il piano si corregge.

- **DR-068 non indebolisce il criterio discriminante della fase.** Il criterio 1D-36 e il requisito F-05 — aprire un contenuto e salvarlo senza modifiche non cambia né i blocchi né l'HTML reso — restano veri **sul contenuto**, perché la copia di lavoro è un record distinto e il contenuto pubblicato si scrive solo su comando. Il test che lo prova va scritto contro il contenuto, non contro la bozza.

- **DR-068 ha una conseguenza di conservazione dei dati.** Le copie di lavoro sono versioni intermedie di contenuti: vanno incluse nelle regole di conservazione e cancellazione, e la `1D-W8` deve dichiarare quando una bozza viene eliminata. Non è una dichiarazione di conformità: resta materia da sottoporre a verifica professionale insieme a MI-06.

- **DR-068 interagisce con la protezione del lavoro redazionale dell'importer.** `importer-spec.md` §6.3 non sovrascrive un contenuto modificato dopo l'ultima esecuzione. Con una copia di lavoro esiste un secondo luogo in cui il lavoro redazionale può trovarsi, e la verifica va estesa a quello: da attuare prima della `1D-W11`.

- **Le sette risposte del 2026-09-15 sul sistema di design erano già registrate.** Il capitolo 11 di `docs/design/design-system.md` afferma che «vanno ancora iscritte»: l'affermazione è **superata** e risale alla wave `1D-W0`, scritta prima dei Round 6 e 7. La corrispondenza è: decisione 1 → DR-051, decisione 2 → DR-050, decisione 3 → DR-052, decisione 4 → DR-055, decisione 5 → DR-054, decisione 6 → DR-056, decisione 7 → DR-057. Nessuna voce nuova viene creata: si corregge il documento che dichiara il contrario.

### Decisioni rimaste aperte dopo il Round 11

| id | Contenuto | Termine |
|---|---|---|
| **D4** | **Come si spostano i blocchi nell'editor dell'albero**: comandi espliciti oppure trascinamento. Posta nel Round 11 e **rimasta senza risposta**. `PLAN.md` §5 dichiara che nessuna libreria di trascinamento è autorizzata e `CONTEXT.md` §8 punto 3 prevede una ricaduta sui comandi espliciti, ma la ricaduta **non si applica** senza risposta | **prima della wave `1D-W8b`** |
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni, **più** le regole di conservazione delle copie di lavoro introdotte da DR-068. **Richiede un professionista** | prima della produzione |
| **Spaziature di Divi** | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea di ADR-005 §3.3 regola 2 | prima dell'inizio della Fase 1E |
| **Esecuzione reale dell'import** | `CLAUDE.md` la colloca fra le azioni a conferma obbligatoria: «import reali non dry-run» | prima della wave `1D-W11` |
| **Attuazione di DR-062** | Riordino delle fasi in `importer-spec.md` §4 e nell'orchestratore, più la misura della soglia rifatta con l'ordine nuovo | prima della wave `1D-W10` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori dei due contenuti in bozza e ricerca insensibile alle maiuscole per l'allegato 341 | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estendere la verifica di `importer-spec.md` §6.3 al secondo luogo introdotto da DR-068 | prima della wave `1D-W11` |
| ~~**Soglia delle 300 righe di ADR-007 §6, superata**~~ | ~~Misurata nella wave `1D-W6`: 342 righe il nucleo, 684 il totale~~ — **chiusa il 2026-09-20 da DR-066**, deroga motivata scritta in ADR-007 | — |
| ~~**Permessi: unione dei ruoli o ruolo attivo**~~ | ~~Il criterio di uscita 24 cita DR-047 e chiede l'unione; DR-050 lo supera~~ — **chiusa il 2026-09-20 da DR-067**, che attua DR-050 per intero | — |

---

## 16. Round 11-bis — risposta del 2026-09-20 su D4

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-069 | 2026-09-20 | Come si spostano i blocchi nell'editor dell'albero | **Trascinamento.** L'opzione era rimasta senza risposta nel Round 11 ed è stata data separatamente | Comandi espliciti — sposta su, sposta giù, sposta in — senza alcuna libreria | «Per D4 scelgo l'opzione B» | Proprietario | Fase 1D, wave `1D-W8b`, dipendenze | sì | `CONTEXT.md` §8 punto 3, `PLAN.md` §5 e §7 punto 2, ADR-006 §3.2, `design-system.md` §9.3 |

### Note sulla portata di DR-069

- **Introduce una dipendenza che nessuna ADR autorizzava, e va dichiarata.** `PLAN.md` §5 elencava il trascinamento fra le cose «scritte in casa, senza pacchetto» e concludeva «nessuna libreria di trascinamento». La riga è superata da questa decisione: la libreria entra in tabella con il motivo, come 1C ha fatto per le aggiunte non previste.

- **Il trascinamento non sostituisce il percorso da tastiera, e il §9.3 non si deroga.** Un albero che si riordina solo col puntatore non è utilizzabile da chi non usa il puntatore, e `design-system.md` §9.3 chiede che ogni operazione sia raggiungibile da tastiera. La libreria scelta porta con sé un sensore da tastiera, quindi i due percorsi nascono insieme invece che l'uno dopo l'altro: il «raddoppio del lavoro» dichiarato nell'impatto del Round 11 risulta minore di quanto stimato, e va detto perché la stima era mia.

- **Che cosa la Fase 1G collauderà.** `CONTEXT.md` §8 punto 3 dava per collaudati i comandi espliciti. Con DR-069 la 1G collauda che un redattore riesca a spostare un blocco **trascinandolo**, e che chi usa la tastiera ci riesca lo stesso.

- **Perimetro invariato.** ADR-006 §3.2 continua a limitare lo spostamento a «dentro una colonna»: la decisione riguarda il **gesto**, non che cosa si può spostare.

### Decisioni rimaste aperte dopo il Round 11-bis

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni, più le regole di conservazione delle copie di lavoro introdotte da DR-068. **Richiede un professionista** | prima della produzione |
| **Spaziature di Divi** | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea di ADR-005 §3.3 regola 2 | prima dell'inizio della Fase 1E |
| **Esecuzione reale dell'import** | Azione a conferma obbligatoria: «import reali non dry-run» | prima della wave `1D-W11` |
| **Attuazione di DR-062** | Riordino delle fasi in `importer-spec.md` §4 e nell'orchestratore, più la misura della soglia rifatta | prima della wave `1D-W10` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori dei due contenuti in bozza e ricerca insensibile alle maiuscole per l'allegato 341 | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estendere la verifica di `importer-spec.md` §6.3 al secondo luogo introdotto da DR-068 | prima della wave `1D-W11` |
| **Crescita del nucleo di autenticazione** | La misura del 2026-09-20 dà **437** righe di nucleo contro le 342 del 2026-09-16, a fronte di una soglia di 300 e della deroga di DR-066, che dichiara di ripresentare la questione se il nucleo cresce. È ripresentata | prima della security review della Fase 1F |
| ~~**D4 — come si spostano i blocchi**~~ | ~~Comandi espliciti oppure trascinamento~~ — **chiusa il 2026-09-20 da DR-069**, trascinamento | — |

---

## 17. Round 12 — risposta del 2026-09-21, soglia dell'autenticazione portata a 500

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-070 | 2026-09-21 | Soglia di ADR-007 §6 contromisura 3, dopo la crescita del nucleo da 342 a 437 righe misurata nella `1D-W8a` | **La soglia sale da 300 a 500 righe.** Supera DR-066 sul punto della soglia, non sulla deroga: con 500, il nucleo (437) la rispetta e il totale (859) la supera ancora, quindi la deroga di DR-066 resta in vigore per la lettura del totale | Lasciare la soglia a 300 e ripresentare la questione a ogni crescita; adottare Better Auth adesso; restringere la definizione di nucleo escludendo audit e limitazione dei tentativi | «Rivediamo la soglia di DR-066, alzala a 500» | Proprietario | ADR-007 §6, `apps/api/tools/countAuthLines.ts`, `apps/api/tests/auth-line-count.json`, criteri 1C-7 e 18 | sì — ADR-007 §7 dichiara la reversibilità alta | ADR-007 revisione del 2026-09-21, `.planning/phases/1D/CONTEXT.md` F-22 e criterio 18, `PLAN.md` §7 punto 7, `docs/qa/acceptance-criteria.md` 1C-7 |

### Note sulla portata di DR-070

- **Alzare la soglia dopo aver visto il numero è l'operazione che la regola di conteggio serviva a rendere visibile, e resta visibile.** La regola di conteggio **non** è stata toccata e la misura **non** è stata rifatta: a cambiare è solo la soglia, e la dichiarazione in `apps/api/tests/auth-line-count.json` porta ora la soglia precedente, la data del cambio e l'esito separato per ciascuna delle due letture. È la differenza fra cambiare il metro e cambiare il limite: la seconda è una decisione dichiarabile, la prima no.

- **Non azzera la deroga di DR-066, e dirlo è il punto.** Con soglia 500 il totale resta a 859. La contromisura 3 continua a scattare su quella lettura, ed è la deroga motivata del 2026-09-20 — non la soglia nuova — a spiegare perché il progetto non adotta Better Auth in Fase 1.

- **Il riesame obbligatorio di ADR-007 §3.3 resta vincolante** prima della prima fase gestionale, con Better Auth come opzione di riferimento, e la security review della Fase 1F deve continuare a coprire il modulo in modo esplicito (ADR-007 §8). DR-070 non tocca nessuno dei due.

- **La voce aperta «Crescita del nucleo di autenticazione» si chiude qui**, ma solo per la misura del 2026-09-20. La clausola di DR-066 — se il nucleo cresce, la cosa si ripresenta — resta valida con il limite nuovo: sopra 500 righe di nucleo si torna a chiedere.

### Decisioni rimaste aperte dopo il Round 12

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni, più le regole di conservazione delle copie di lavoro introdotte da DR-068. **Richiede un professionista** | prima della produzione |
| **Spaziature di Divi** | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea di ADR-005 §3.3 regola 2 | prima dell'inizio della Fase 1E |
| **Esecuzione reale dell'import** | Azione a conferma obbligatoria: «import reali non dry-run» | prima della wave `1D-W11` |
| **Attuazione di DR-062** | Riordino delle fasi in `importer-spec.md` §4 e nell'orchestratore, più la misura della soglia rifatta | prima della wave `1D-W10` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori dei due contenuti in bozza e ricerca insensibile alle maiuscole per l'allegato 341 | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estendere la verifica di `importer-spec.md` §6.3 al secondo luogo introdotto da DR-068 | prima della wave `1D-W11` |
| ~~**Crescita del nucleo di autenticazione**~~ | ~~437 righe di nucleo contro una soglia di 300~~ — **chiusa il 2026-09-21 da DR-070**, che porta la soglia a 500. Si ripresenta se il nucleo supera 500 | — |

---

## 18. Round 13 — risposte del 2026-09-21, spaziature di Divi, import reale e MI-06

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-071 | 2026-09-21 | Come si rendono le spaziature per modulo di Divi senza violare il divieto di stile in linea | **Opzione C — sole proprietà personalizzate CSS** sul contenitore del blocco (`style="--blk-pad-top:54px"`), con le regole che le usano nel foglio di stile | A — classi da una scala di token, arrotondando i valori; B — stile in linea vero e proprio | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1E, ADR-005 §3.3 regola 2, `BLOCK-MODEL.md` §7.3, criterio di uscita della 1E | sì, con ADR | `CONTEXT.md` §8 punto 1, `BLOCK-MODEL.md` §7.3 strada C, `divi-shortcode-strategy.md` §3.1 e §6 |
| DR-072 | 2026-09-21 | Come si arriva all'esecuzione reale dell'import della `1D-W11` | **Opzione B — a due tempi**: `plan` si esegue senza conferma perché non scrive; il rapporto viene letto e ripulito e mostrato all'utente; la conferma riguarda **solo** `apply --confirm` e si dà sui conteggi veri | A — un solo documento di handoff e una conferma su descrizione; C — l'esecuzione la fa l'utente e l'agente produce solo l'handoff | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, wave `1D-W11`, `docs/handoff/` | sì | `PLAN.md` §7 punto 3, `CLAUDE.md` «conferma obbligatoria», RD-12 |
| DR-073 | 2026-09-21 | Quando si coinvolge il professionista di MI-06 e che cosa fa il progetto nel frattempo | **Opzione A — dossier adesso, professionista prima della Fase 1F**: si prepara in `docs/handoff/` l'inventario di categorie, volumi, collocazione, regole tecniche già in vigore e domande aperte. Il codice non cambia e la `1D-W11` non slitta | B — professionista prima della `1D-W11`, con la wave ferma al responso; C — perimetro ridotto, senza le 425 compilazioni, che avrebbe superato DR-026 | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | MI-06, Fase 1D, Fase 1F, `database-schema.md` §7 | sì | `database-schema.md` §7 regole 5 e 6, DR-026, DR-068, RD-12 |

### Note sulla portata delle tre decisioni

- **DR-071 obbliga a riformulare una regola approvata, e la riformulazione non è questa riga.** ADR-005 §3.3 regola 2 dice «mai stile in linea generato automaticamente»; la strada C produce un attributo `style`, che porta un **valore** e non una **regola**. La distinzione regge, ma va scritta dentro ADR-005 come revisione datata prima dell'inizio della Fase 1E: è la quarta volta, dopo DR-059, DR-062 e DR-066, che una decisione registrata corregge un documento approvato.

- **DR-071 non cambia nulla nel modello a blocchi né in questa fase.** Il valore è già conservato nella proprietà `padding` dal `1D-W1`; a cambiare è **come venga dipinto**, che è lavoro della 1E dove il CSS si estrae dal reso. Nessuna wave della Fase 1D si modifica per questo.

- **DR-072 non è una pre-autorizzazione, ed è la ragione per cui è stata posta così.** `CLAUDE.md` dice che una conferma vale per quella azione e non si eredita: questa decisione stabilisce **con quali prove** la conferma verrà chiesta, non la sostituisce. Alla `1D-W11` la richiesta di conferma su `apply --confirm` si fa comunque, con comando, file coinvolti, impatto, backup, rollback e verifica.

- **DR-072 aggiunge un obbligo di lettura.** Il rapporto di `plan` si legge **prima** di mostrarlo, perché RD-12 vieta che righe di dati personali escano dal database, e un rapporto che elenca anomalie potrebbe citarne.

- **DR-073 non dichiara alcuna conformità, e il dossier non è un parere.** È un inventario che serve al professionista per darne uno. Finché MI-06 è aperta, cifratura a riposo, tempi di conservazione e procedura di cancellazione restano non validati (`database-schema.md` §7 regola 5), e le copie di lavoro di DR-068 rientrano nello stesso perimetro (regola 6).

- **DR-073 lascia dati personali reali in un database locale più a lungo delle alternative, e va detto.** È la conseguenza dell'opzione scelta: le 425 compilazioni entrano con la `1D-W11` e restano fino al responso. Le regole del §7 di `database-schema.md` sono già in vigore e sono ciò che nel frattempo limita l'esposizione — non una validazione.

### Decisioni rimaste aperte dopo il Round 13

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni e sulle copie di lavoro. **Richiede un professionista.** Il *come* è deciso da DR-073; il *responso* no | prima della produzione |
| **Riformulazione di ADR-005 §3.3 regola 2** | Attuazione di DR-071: revisione datata dentro ADR-005 che distingue un valore da una regola, e criterio di uscita della 1E riformulato di conseguenza | prima dell'inizio della Fase 1E |
| **Dossier di MI-06** | Attuazione di DR-073: inventario in `docs/handoff/` | prima della Fase 1F, e comunque prima di portarlo al professionista |
| **Conferma puntuale di `apply --confirm`** | Attuazione di DR-072: la conferma vera, sui conteggi del rapporto di `plan` | alla wave `1D-W11`, non prima |
| **Attuazione di DR-062** | Riordino delle fasi in `importer-spec.md` §4 e nell'orchestratore, più la misura della soglia rifatta | prima della wave `1D-W10` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori dei due contenuti in bozza e ricerca insensibile alle maiuscole per l'allegato 341 | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estendere la verifica di `importer-spec.md` §6.3 al secondo luogo introdotto da DR-068 | prima della wave `1D-W11` |
| ~~**Spaziature di Divi**~~ | ~~Tre strade in `BLOCK-MODEL.md` §7.3~~ — **chiusa il 2026-09-21 da DR-071**, strada C | — |
| ~~**Esecuzione reale dell'import**~~ | ~~Come ci si arriva~~ — **chiusa il 2026-09-21 da DR-072**, a due tempi. La conferma puntuale resta dovuta | — |

---

## 19. Round 14 — risposte del 2026-09-22, media, menu, SEO ed eliminazione

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-074 | 2026-09-22 | Come si sostituisce il file di un media già esistente | **Opzione A — stessa chiave**: una rotta nuova riscrive i byte sulla chiave dell'archivio che il media già usa. Il percorso pubblico non cambia e ogni riferimento — blocchi, `srcset`, indirizzi storici — continua a funzionare | B — chiave nuova con `publicPath` aggiornato e indirizzi storici rotti; C — nessuna sostituzione, criterio 1D-31 soddisfatto solo in parte | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, wave `1D-W9`, `apps/api/src/modules/media`, criterio 1D-31 | sì | criterio 1D-31; ADR-004 §3.1 e §3.4; `PLAN.md` §2, che assegnava alla wave il solo `apps/admin/**` |
| DR-075 | 2026-09-22 | Da dove l'interfaccia prende i ruoli nel caso `roles` della visibilità di una voce di menu | **Opzione A — rotta di sola lettura che elenca i ruoli**, chiave ed etichetta, con permesso `content.read`; l'interfaccia mostra un elenco a spunte | B — chiavi di ruolo digitate a mano, validate solo dal servizio | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, wave `1D-W9`, `apps/api`, criterio 1D-32 | sì | criterio 1D-32; vincolo `menu_items_roles_only_when_needed`; ADR-007 §3.2 — nessun permesso nuovo |
| DR-076 | 2026-09-22 | Dove si modificano i metadati SEO di un singolo contenuto | **Opzione A — scheda dentro l'editor del contenuto**; la sezione «SEO e indirizzi» tiene i soli template globali e i redirect | B — tutto nella sezione «SEO e indirizzi», con un secondo elenco dei contenuti | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, wave `1D-W9`, `apps/admin`, criterio 1D-33 | sì | criterio 1D-33; `design-system.md` §7.2 e componente 47 |
| DR-077 | 2026-09-22 | Se l'eliminazione di un media va impedita quando il media è citato dentro i blocchi di un contenuto | **Opzione A — il servizio la impedisce**: il controllo si estende dai soli media in evidenza ai media citati dentro il documento a blocchi, e il rifiuto elenca i contenuti che lo citano | B — il servizio resta com'è e l'interfaccia avvisa prima della conferma; C — nulla cambia, difetto dichiarato in `AUDIT.md` | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, wave `1D-W9`, `apps/api/src/modules/media`, criterio 1D-31, parità di Fase 1E | sì | criterio 1D-31; il controllo esistente su `contents.featured_media_id`; `BLOCK-MODEL.md` §3 per i tipi che citano media |

### Note sulla portata delle quattro decisioni

- **Tre decisioni su quattro allargano il perimetro della wave oltre quanto `PLAN.md` §2 le assegnava.** La riga della `1D-W9` diceva `apps/admin/**`; DR-074, DR-075 e DR-077 la portano anche dentro `apps/api/src/**`. È la terza volta nella fase, dopo la `1D-W8a` e la `1D-W8b`, e il piano va corretto invece che smentito in silenzio.

- **DR-074 rende la sostituzione un'operazione non annullabile, e va detto.** Riscrivere sulla stessa chiave cancella il file precedente: non esiste versione da recuperare. La conferma in interfaccia lo dichiara.

- **DR-074 lascia scoperte le cache.** Un browser che ha già il file vecchio continua a mostrarlo fino alla scadenza. Non si risolve in Fase 1D: le intestazioni di cache dei media sono lavoro del reverse proxy, che è materia di Fase 1F.

- **DR-075 non introduce alcun permesso nuovo.** ADR-007 §3.2 fissa cinque permessi e la rotta si appoggia a `content.read`, come ogni altra lettura dei moduli di Redazione.

- **DR-077 non copre tutti i riferimenti possibili.** Copre i media in evidenza e i media citati dentro i blocchi; un media citato dentro il testo di un blocco di riserva `html`, scritto a mano, resta fuori dal controllo, e questo si dichiara in `AUDIT.md` invece di essere presentato come risolto.

### Decisioni rimaste aperte dopo il Round 14

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni e sulle copie di lavoro. **Richiede un professionista.** Il *come* è deciso da DR-073; il *responso* no | prima della produzione |
| **Riformulazione di ADR-005 §3.3 regola 2** | Attuazione di DR-071 | prima dell'inizio della Fase 1E |
| **Dossier di MI-06** | Attuazione di DR-073 | prima della Fase 1F |
| **Conferma puntuale di `apply --confirm`** | Attuazione di DR-072 | alla wave `1D-W11` |
| **Attuazione di DR-062** | Riordino delle fasi e misura della soglia rifatta | prima della wave `1D-W10` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori e ricerca insensibile alle maiuscole | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estensione della verifica di `importer-spec.md` §6.3 | prima della wave `1D-W11` |
| **Intestazioni di cache dei media** | Conseguenza di DR-074: la sostituzione sulla stessa chiave lascia le cache dei browser a servire il file vecchio | prima del deploy, con il reverse proxy di Fase 1F |
| **Media citati dentro un blocco di riserva `html`** | Conseguenza di DR-077: restano fuori dal controllo di eliminazione | prima della Fase 1E |

---

## 20. Round 15 — risposte del 2026-09-23, difetti trovati provando le schermate

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-078 | 2026-09-23 | Come i componenti di navigazione rendono i collegamenti, visto che un'ancora nuda ignora il percorso su cui l'area è pubblicata | **Opzione A — il componente riceve il collegamento**: i tre componenti accettano un componente-collegamento, con l'ancora come predefinito, e `apps/admin` passa quello di Next | B — indirizzi già prefissati da chi li scrive; C — `packages/ui` importa direttamente il collegamento di Next | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, `packages/ui`, `apps/admin` | sì | ADR-008 §3.2; `design-system.md` componenti 2, 3, 5 |
| DR-079 | 2026-09-23 | Se il servizio debba validare il documento a blocchi, che fino a oggi accettava qualunque cosa | **Opzione A — si chiude adesso**: la validazione entra al confine con gli schemi di `packages/blocks`, e il comando di popolamento costruisce il suo documento passando dagli stessi schemi | B — correggere il solo comando di popolamento e lasciare il servizio permissivo | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | Fase 1D, `apps/api`, ADR-005 §3.1 | sì | criterio 1D-36; `BLOCK-MODEL.md` §1 |
| DR-080 | 2026-09-23 | Come si rende compilabile `apps/api` con `packages/blocks`, che dalla `1D-W8b` non porta l'estensione negli import interni | **Opzione A — risoluzione «Bundler», come l'importer**: stessa scelta già presa e documentata per `apps/importer`. Il servizio gira con tsx sia in sviluppo sia con `start`, quindi oggi non cambia nulla | B — rimandare la validazione alla Fase 1F; C — validare nel servizio invece che nello schema della rotta, importando il pacchetto solo a runtime | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | `apps/api`, Fase 1F | sì | attua DR-079; `apps/importer/tsconfig.json`, nota del 2026-09-21 |
| DR-081 | 2026-09-23 | Che fare della pagina sintetica già scritta a database con il documento non valido | **Opzione A — riscrivere quella riga**, sola e sul posto | B — ricreare il volume locale da capo; C — lasciarla non apribile | scelta dell'opzione raccomandata, senza motivazione dichiarata | Proprietario | database locale di sviluppo, dati sintetici | sì | DR-079 |

### Note sulla portata delle quattro decisioni

- **Tre difetti su quattro erano invisibili alle prove, e per la stessa ragione.** Il CORS, i collegamenti e la validazione dei blocchi si vedono solo dove c'è un browser e un'applicazione servita sotto un percorso: le prove del servizio lo chiamano in processo, quelle dei componenti li rendono isolati. La `1D-W10` prevede prove end-to-end su applicazioni avviate, ed è lì che questa classe di difetti si intercetta: fino ad allora vale la prova a mano.

- **DR-080 sposta una conseguenza sulla Fase 1F, e va detto adesso.** Lo script di compilazione di `apps/api` continua a esistere ma il `dist` che produce porta import relativi senza estensione: Node non lo esegue così com'è. Oggi non lo usa nessuno, perché il servizio si avvia con tsx. Alla Fase 1F la scelta è fra un bundle e l'esecuzione con tsx, e non è una scelta rimandabile oltre.

- **DR-079 rende più severo ciò che il servizio accetta, e qualcosa che passava prima ora viene respinto.** Due prove interne portavano blocchi incompleti — senza le quattro chiavi che `BLOCK-MODEL.md` §1 pretende — e sono state completate. Se l'importer producesse documenti incompleti, ora se ne accorgerebbe il servizio: è l'esito voluto, e la `1D-W11` lo verificherà sui conteggi veri.

- **DR-081 riguarda dati sintetici su una macchina di sviluppo.** Nessun dato reale è stato toccato, e la riparazione si è rifiutata di procedere se la riga non fosse stata quella attesa: percorso `/pagina-di-prova/` e nessun identificativo di origine.

### Decisioni rimaste aperte dopo il Round 15

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale. **Richiede un professionista** | prima della produzione |
| **Impacchettamento del servizio** | Conseguenza di DR-080: bundle o esecuzione con tsx | Fase 1F, non oltre |
| **Riformulazione di ADR-005 §3.3 regola 2** | Attuazione di DR-071 | prima dell'inizio della Fase 1E |
| **Dossier di MI-06** | Attuazione di DR-073 | prima della Fase 1F |
| **Conferma puntuale di `apply --confirm`** | Attuazione di DR-072 | alla wave `1D-W11` |
| **Attuazione di DR-062** | Riordino delle fasi e misura della soglia rifatta | prima della wave `1D-W10` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori e ricerca insensibile alle maiuscole | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estensione della verifica di `importer-spec.md` §6.3 | prima della wave `1D-W11` |
| **Intestazioni di cache dei media** | Conseguenza di DR-074 | prima del deploy, con il reverse proxy di Fase 1F |
| **Media citati dentro un blocco di riserva `html`** | Conseguenza di DR-077 | prima della Fase 1E |

---

## 21. Attuazioni del 2026-09-24 — wave `1D-W10`

Questa sezione **non registra decisioni nuove**: registra l'attuazione di una
decisione già approvata e l'esito delle misure che ne dipendevano. Le decisioni
si prendono nei round, non nelle wave.

### Chiuse

| Voce aperta | Come è stata chiusa |
|---|---|
| **Attuazione di DR-062** — riordino delle fasi e misura della soglia rifatta, «prima della wave `1D-W10`» | **Fatta.** `documents`, `sliders` e `forms` sono diventate le fasi 5, 6 e 7, davanti a `contents`, in `stages/registry.ts` e in `importer-spec.md` §4, che porta una revisione datata. La fase `contents` costruisce i tre risolutori mancanti (`contents/entityResolvers.ts`). La soglia è stata **rimisurata sulla sorgente reale**: **8 blocchi di riserva su 305, cioè 2,62 %, su 5 contenuti** — dentro entrambe le soglie di ADR-005 §3.4, che l'ordine vecchio superava con 31 / 305 e 27 contenuti. Dettaglio e scostamento dalla stima in `IMPORTER-DESIGN.md` §11.20 |

### Quello che la misura ha detto, e che non era previsto

- **Restano 8 blocchi di riserva, non i 7 stimati.** La differenza è una sola
  cosa e non è un difetto: dei 24 moduli form che l'ordine vecchio non
  risolveva, 23 sono blocchi `wp:wpforms/form-selector` e ora si risolvono; il
  ventiquattresimo è l'unico `et_pb_contact_form` della sorgente, che **non ha
  una riga sorgente propria** e quindi nessuna entità `forms` a cui puntare.
  Resta un blocco di riserva finché ADR-010 non decida di costruirgli un form
  proprio. La stima lo aveva contato fra i risolvibili.

### Difetti trovati eseguendo, e corretti nella wave

- **Il seme sintetico scriveva un contenuto non canonico.** `seedSintetico.ts`
  inseriva i blocchi senza passarli dallo schema e senza derivare `contentHtml`
  e `contentText`. Conseguenza osservabile: aprire la pagina seminata e premere
  «Salva» la **riscriveva**, e il criterio 1D-36 risultava violato da un
  difetto del seme. L'hanno trovato le prove nel browser. Corretto: il
  documento passa da `blockDocumentSchema` e l'HTML si deriva dai blocchi.
- **`format:check` era già rosso su `main`**, e non su un file solo: il
  controllo di formattazione della CI falliva su oltre duecento file, mai
  passati da Prettier da quando il monorepo esiste. Corretto eseguendo
  `pnpm format` sull'intero repository. È una modifica grande e **solo di
  andata a capo**: nessuna riga di logica cambia.

  Due conseguenze, che vanno dette perché non sono cosmetiche:

  1. **Gli artefatti generati sono usciti da Prettier.** `packages/db/drizzle/`,
     `apps/api/tests/openapi.snapshot.json` e `tests/fixtures/block-corpus.json`
     sono scritti da uno strumento, non da una persona: riformattarli produce
     un diff enorme che non appartiene a nessuna modifica, e nel caso delle
     migrazioni tocca file che Drizzle confronta per calcolare la successiva.
     Sono stati aggiunti a `.prettierignore` e riportati alla forma che lo
     strumento produce.
  2. **Il conteggio delle righe di ADR-007 §6 è cambiato di due.**
     `auth/sessions.ts` passa da 188 a 190 righe eseguibili perché due righe
     lunghe sono andate a capo: il nucleo sale da 437 a **439** e il totale da
     859 a **861**. La lettura non cambia — il nucleo resta sotto la soglia di
     500 fissata da DR-070, il totale resta sopra e la deroga di DR-066 resta
     necessaria — ma la dichiarazione in `apps/api/tests/auth-line-count.json`
     è stata aggiornata, perché è il file che rende il conteggio verificabile.

### Decisioni rimaste aperte dopo la wave `1D-W10`

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale. **Richiede un professionista** | prima della produzione |
| **Impacchettamento del servizio** | Conseguenza di DR-080: bundle o esecuzione con tsx | Fase 1F, non oltre |
| **Riformulazione di ADR-005 §3.3 regola 2** | Attuazione di DR-071 | prima dell'inizio della Fase 1E |
| **Dossier di MI-06** | Attuazione di DR-073 | prima della Fase 1F |
| **Conferma puntuale di `apply --confirm`** | Attuazione di DR-072 | alla wave `1D-W11` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori e ricerca insensibile alle maiuscole | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estensione della verifica di `importer-spec.md` §6.3 | prima della wave `1D-W11` |
| **Intestazioni di cache dei media** | Conseguenza di DR-074 | prima del deploy, con il reverse proxy di Fase 1F |
| **Media citati dentro un blocco di riserva `html`** | Conseguenza di DR-077 | prima della Fase 1E |
| **Soglia di copertura vincolante** | La copertura è misurata (85,67 % istruzioni, 78,72 % diramazioni, 77,37 % funzioni) ma **nessuna soglia è applicata**, perché `pnpm test:coverage` non gira in CI. Se la si vuole vincolante va deciso dove misurarla e a quale numero | prima della chiusura della Fase 1D |
| **Un form proprio per `et_pb_contact_form`** | L'unico modulo di contatto di Divi resta un blocco di riserva perché non ha un'entità sorgente. Si costruisce o si accetta | prima della Fase 1E |
| ~~**Attuazione di DR-062**~~ | ~~Riordino delle fasi e misura della soglia rifatta~~ — **chiusa il 2026-09-24 dalla wave `1D-W10`** | — |

---

## 22. Round 16 — risposta del 2026-09-24, trascinamento nel menu

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-082 | 2026-09-24 | Come si sposta una voce di menu, che oggi si muove solo con i bottoni «Sposta su», «Sposta giù», «Indenta» e «Sporgi» | **Trascinamento, con due esiti distinti durante il movimento**: l'interfaccia distingue il rilascio che annida la voce **dentro** quella di arrivo, facendone un sottolivello, da quello che la colloca **accanto**, allo stesso livello. I bottoni restano | Trascinamento di solo riordino, com'è quello dei blocchi di DR-069, che non sa annidare; nessun trascinamento, soli bottoni, com'è oggi | «Per il menu ho deciso di aggiungere anche lo spostamento col drag and drop. Durante il movimento va distinto il lasciare un blocco "dentro" (sottolivello) o "accanto" (stesso livello)» | Proprietario | Fase 1D, `apps/admin`, `packages/ui`, criterio 1D-32 | sì | DR-069; `design-system.md` §9.3; `apps/admin/src/lib/menu/tree.ts` |

### Note sulla portata di DR-082

- **DR-082 riapre una wave già chiusa, e il piano va corretto invece che smentito in silenzio.** Il menu è stato rilasciato dalla `1D-W9`, che `PROGRESS.md` dà per completa il 2026-09-22. La decisione non si attua modificando una wave chiusa: richiede una wave nuova, e la collocazione nella sequenza **non è decisa** — vedi la tabella delle voci aperte. È la quinta volta nella fase che una decisione registrata allarga il perimetro di `PLAN.md` §2.

- **Il percorso da tastiera non è facoltativo, e non è un ripiego.** `design-system.md` §9.3 chiede che ogni operazione sia raggiungibile da tastiera: i quattro bottoni restano, ed è da essi che passano annidamento e sporgenza per chi non usa il puntatore. Vale il precedente di DR-069, dove il trascinamento dei blocchi convive con «Sposta su» e «Sposta giù».

- **Nessuna delle funzioni di spostamento che esistono oggi esprime la mossa richiesta.** `moveUp`, `moveDown`, `indent` e `outdent` muovono una voce **di un passo** rispetto a sé stessa; il trascinamento la porta in un punto arbitrario dell'albero. Serve un'operazione pura nuova — voce presa, voce di arrivo, e quale dei due esiti — con la rinumerazione fra fratelli che il modulo già impone e il rifiuto del caso che romperebbe l'albero: una voce non si può lasciare dentro il proprio sottoalbero.

- **DR-082 non dice come i due esiti si mostrino a schermo, e la differenza è tutta lì.** Un trascinamento che non fa vedere prima del rilascio se la voce finirà dentro o accanto non è quello che la decisione chiede. Il come — zona di rilascio divisa, rientro dell'indicatore, o altro — è materia della wave e va provato a schermo, non dichiarato.

- **Il trascinamento dei blocchi resta com'è, se non si decide altro.** DR-069 ha dato ai blocchi un riordino piatto. Se i due alberi debbano comportarsi allo stesso modo è una domanda aperta che questa decisione non chiude.

### Decisioni rimaste aperte dopo il Round 16

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale. **Richiede un professionista** | prima della produzione |
| **Impacchettamento del servizio** | Conseguenza di DR-080: bundle o esecuzione con tsx | Fase 1F, non oltre |
| **Riformulazione di ADR-005 §3.3 regola 2** | Attuazione di DR-071 | prima dell'inizio della Fase 1E |
| **Dossier di MI-06** | Attuazione di DR-073 | prima della Fase 1F |
| **Conferma puntuale di `apply --confirm`** | Attuazione di DR-072 | alla wave `1D-W11` |
| **Attuazione di DR-063, DR-064, DR-065** | Percorsi provvisori e ricerca insensibile alle maiuscole | prima della wave `1D-W11` |
| **Protezione del lavoro redazionale sulle copie di lavoro** | Estensione della verifica di `importer-spec.md` §6.3 | prima della wave `1D-W11` |
| **Collocazione della wave di DR-082** | Il trascinamento nel menu è deciso; **quando** si faccia, no. Non ha dipendenze dall'import e non blocca la `1D-W11` | prima della chiusura della Fase 1D |
| **Resa dei due esiti del trascinamento** | Come si veda, prima del rilascio, se la voce finisce dentro o accanto | alla wave di DR-082 |
| **Allineamento del trascinamento dei blocchi** | Se l'albero dei blocchi di DR-069 debba adottare la stessa mossa a due esiti o restare un riordino piatto | prima della chiusura della Fase 1D |
| **Intestazioni di cache dei media** | Conseguenza di DR-074 | prima del deploy, con il reverse proxy di Fase 1F |
| **Media citati dentro un blocco di riserva `html`** | Conseguenza di DR-077 | prima della Fase 1E |
| **Soglia di copertura vincolante** | Misurata, ma nessuna soglia applicata: `pnpm test:coverage` non gira in CI | prima della chiusura della Fase 1D |
| **Un form proprio per `et_pb_contact_form`** | L'unico modulo di contatto di Divi resta un blocco di riserva | prima della Fase 1E |

---

## 23. Round 17 — risposte del 2026-09-30, menu, blocchi e database vuoto

Con lo stesso messaggio l'utente **approva il piano della wave `1D-W11`**
(`.planning/phases/1D/W11-PLAN.md`) e dichiara chiuso HO-007 con esito «tutti i
test passati». L'approvazione del piano **non** è la conferma di DR-072: quella
si dà sui conteggi veri di `plan`, alla `1D-W11b`.

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-083 | 2026-09-30 | Quando si fa la wave che attua DR-082 | **Dopo la `1D-W11`**, prima dell'audit della `1D-W12` | Prima della `1D-W11`; in parallelo | «wave del menu dopo la 1D-W11» | Proprietario | Fase 1D, sequenza delle wave | sì | DR-082; `PLAN.md` §2 |
| DR-084 | 2026-09-30 | Come si vede, prima del rilascio, se la voce trascinata finisce dentro o accanto | **Zona di rilascio divisa e rientro dell'indicatore, insieme**: la voce di arrivo si divide in fasce — sopra e sotto per «accanto», centro per «dentro» — e l'indicatore di inserimento si sposta a destra quando l'esito è «dentro» | Una sola delle due rese | «Zona di rilascio divisa e rientro dell'indicatore» | Proprietario | Fase 1D, wave di DR-082, `packages/ui`, `apps/admin` | sì | DR-082; `design-system.md` §9.3 |
| DR-085 | 2026-09-30 | Se l'albero dei blocchi di DR-069 adotta la stessa mossa a due esiti | **Sì, si allinea**: il trascinamento dei blocchi distingue anch'esso «dentro» e «accanto», con la resa di DR-084 | Lasciare ai blocchi il riordino piatto | «trascinamento dei blocchi allineato alla stessa mossa» | Proprietario | Fase 1D, wave di DR-082, editor dell'albero dei blocchi | sì | DR-069, DR-082, `BLOCK-MODEL.md` |
| DR-086 | 2026-09-30 | Come si ottiene lo schema vuoto su cui misurare i conteggi della `1D-W11b` | **Si ricrea il solo database `amoris` da psql**, lasciando in piedi i volumi e gli altri database | Ricreare il volume con `pnpm compose:reset` | «database svuotato ricreando il solo database amoris da psql» | Proprietario | database locale di sviluppo, `1D-W11b` | no — i dati sintetici si ricreano con `pnpm db:seed` | `W11-PLAN.md` §4 |

### Note sulla portata del Round 17

- **DR-086 sceglie la strada, non autorizza il comando.** La cancellazione del
  database `amoris` resta un'azione a conferma obbligatoria: si mostra il
  comando esatto e si chiede, all'inizio della `1D-W11b`.
- **DR-085 allarga la wave di DR-082 dal solo menu ai blocchi.** Non tutti i
  blocchi possono contenere figli: la mossa «dentro» va rifiutata dove
  `BLOCK-MODEL.md` non ammette figli, e il rifiuto va mostrato durante il
  movimento, non dopo il rilascio.

### Chiuse dal Round 17

| Voce aperta | Come è stata chiusa |
|---|---|
| **Collocazione della wave di DR-082** | DR-083 |
| **Resa dei due esiti del trascinamento** | DR-084 |
| **Allineamento del trascinamento dei blocchi** | DR-085 |

---

## 24. Attuazioni del 2026-09-30 — wave `1D-W11a`

Questa sezione **non registra decisioni nuove**: registra l'attuazione di
decisioni già approvate. Dettaglio in `IMPORTER-DESIGN.md` §11.21.

### Chiuse

| Voce aperta | Come è stata chiusa |
|---|---|
| **Attuazione di DR-063, DR-064, DR-065** | **Fatta.** I due contenuti anomali nascono bozza con percorso provvisorio, la pagina conserva l'indirizzo; il file dell'allegato si cerca senza distinguere maiuscole e minuscole e si archivia con la chiave del database. Misurato sulla sorgente reale in sola lettura: `relations` 108 aggiornati e 0 errori, `media` 0 errori |
| **Protezione del lavoro redazionale sulle copie di lavoro** | **Fatta.** Una copia di lavoro più recente dell'ultima esecuzione riuscita protegge il contenuto nella fase `contents`, nella fase `relations` e nell'annullamento |

### Conseguenza dichiarata

- **`redirects` atteso passa da 180 a 181.** Con DR-065 l'allegato 341 si
  importa e la sua pagina allegato, presente in `url-matrix.csv`, produce il
  redirect. Corretti `database-schema.md` §6, `wp-to-postgres-mapping.md` §3.2
  e `W11-PLAN.md` §4.

### Rilievo che richiede una decisione

- **La protezione del contenuto pubblicato non scatta mai per il lavoro fatto
  nell'area di gestione.** Il criterio di `importer-spec.md` §6.3 legge
  `content_revisions`, ma il servizio non vi scrive mai; e dopo il salvataggio
  o la pubblicazione la copia di lavoro viene eliminata. Non tocca la prima
  esecuzione della `1D-W11`, su un database vuoto; tocca ogni riesecuzione dopo
  che un redattore ha lavorato, a partire dal delta finale della Fase 1F.

| id | Contenuto | Termine |
|---|---|---|
| **Traccia del lavoro redazionale pubblicato** | Come l'importer riconosce un contenuto modificato e pubblicato dall'area di gestione | prima di qualunque riesecuzione dell'import dopo l'uso del CMS, e comunque prima della Fase 1F |

---

## 25. Round 18 — risposta del 2026-09-30, traccia del lavoro redazionale pubblicato

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-087 | 2026-09-30 | Come l'importer riconosce un contenuto modificato e pubblicato dall'area di gestione, visto che il servizio non scrive in `content_revisions` | **Opzione A — `contents.updated_at`**: un contenuto con `updated_at` successivo alla fine dell'ultima esecuzione riuscita è protetto, come quello con una revisione o una copia di lavoro recente. Si tocca solo `apps/importer` | B — il servizio scrive `content_revisions` a ogni salvataggio e pubblicazione; C — entrambe | «Decisione 1 = A» | Proprietario | Fase 1D, `apps/importer`, `importer-spec.md` §6.3 | sì | registro §24, `IMPORTER-DESIGN.md` §11.21 |

### Note sulla portata di DR-087

- **La decisione non è ancora attuata.** Non tocca la `1D-W11b` né la `1D-W11c`, che partono da un database vuoto; va attuata prima di qualunque riesecuzione dopo l'uso del CMS.
- **L'errore possibile va nella direzione sicura.** Anche una scrittura non redazionale che aggiorni `updated_at` — per esempio il ritiro di un contenuto — lo protegge: il contenuto viene saltato con un avviso, e `--force-content` resta la via per sovrascriverlo.

### Decisioni rimaste aperte dopo il Round 18

| id | Contenuto | Termine |
|---|---|---|
| **Attuazione di DR-087** | Protezione su `contents.updated_at` in `contents`, `relations` e `rollback` | prima di qualunque riesecuzione dopo l'uso del CMS, e comunque prima della Fase 1F |

---

## 26. Round 19 — risposta del 2026-10-03, esito della `1D-W11` e scarto d'orologio

Contesto: dopo la correzione `1D-W11a-bis` il secondo `plan` dava ancora
`partial`, perché una verifica non eseguita degrada l'esito e «file nel bucket /
file attesi» non è mai eseguibile (HO-008 §3.3).

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-088 | 2026-10-03 | Come si rende raggiungibile il criterio 4 di `W11-PLAN.md` (esito `success`) | **Opzione A** — l'importer impara a elencare il bucket, così in `apply` la verifica «file nel bucket / file attesi» si esegue davvero; `plan` resta `partial` per questa sola ragione dichiarata, perché non carica file | B — una verifica non eseguibile non degrada l'esito; C — si modifica il criterio 4 accettando `partial` | «D17 = A» | Proprietario | Fase 1D, `apps/importer` | sì | HO-008 §3.3, `W11-PLAN.md` §7 |
| DR-089 | 2026-10-03 | Il commit della correzione `1D-W11a-bis` | **Opzione B** — prima si riallinea l'orologio della macchina virtuale di Docker, poi si rilancia `pnpm test` e si committa solo se è verde | A — committare subito con 2 prove fallite anche su HEAD | «D18 = B (orologio riallineato)» | Proprietario | Fase 1D, repository | sì | HO-008 §6.1 |
| DR-090 | 2026-10-03 | Come la protezione del lavoro redazionale smette di dipendere dall'allineamento degli orologi | **Opzione A** — la fine di un'esecuzione si registra con l'ora del database, la stessa delle copie di lavoro | B — requisito operativo di orologi sincronizzati (NTP), senza toccare il codice | «D19 = A» | Proprietario | Fase 1D, `apps/importer`, `importer-spec.md` §6.3 | sì | HO-008 §6 |

### Note sulla portata

- **DR-089 è attuata:** orologio riallineato dall'utente (scarto misurato 0 ms),
  `pnpm test` verde su tutti gli 8 pacchetti, 272 prove su 272 nell'importer.
- **DR-088 e DR-090 non sono ancora attuate.** Vanno fatte prima della `1D-W11c`
  (`apply`); DR-090 al più tardi insieme a DR-087.
- **Rilievo, non decisione:** `pnpm compose:up` non riesce più a scaricare
  l'immagine del servizio che crea i bucket (il registro risponde 401). Database e
  archiviazione sono ripartiti da soli e i bucket esistono già nel volume: non
  blocca la `1D-W11`, ma blocca chi ricrea l'ambiente da zero.

### Decisioni rimaste aperte dopo il Round 19

| id | Contenuto | Termine |
|---|---|---|
| **Attuazione di DR-087** | Protezione su `contents.updated_at` | prima di qualunque riesecuzione dopo l'uso del CMS, e comunque prima della Fase 1F |
| **Attuazione di DR-088 e DR-090** | Elenco del bucket ed ora del database per la fine dell'esecuzione | prima della `1D-W11c` |
| **Immagine del servizio che crea i bucket** | Come ricreare l'ambiente se l'immagine non è più scaricabile | prima di ricreare l'ambiente da zero |

---

## 27. Round 20 — risposta del 2026-10-03, portata di DR-090 e oggetti in più nel bucket

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-091 | 2026-10-03 | Fin dove arriva DR-090, visto che l'area di gestione scrive l'ora delle copie di lavoro con l'orologio di Node | **Opzione B** — tutte le ore del confronto vengono dal database: fine dell'esecuzione, copie di lavoro e `contents.updated_at` scritti dall'API e dall'importer. Tocca anche `apps/api`. Integra DR-090 | A — solo la fine dell'esecuzione; C — superare DR-090 con orologi sincronizzati | «D20 = B» | Proprietario | Fase 1D, `apps/importer`, `apps/api` | sì | `W11d-PLAN.md` D20, DR-087, DR-090 |
| DR-092 | 2026-10-03 | Oggetti nel bucket che l'import non attende (per esempio quelli del seme sintetico) | **Opzione A** — la verifica «file nel bucket / file attesi» conta solo i file attesi e mancanti; gli oggetti in più non la fanno fallire | B — il bucket deve coincidere con l'atteso, e il seme va cancellato prima di `apply` | «D21 = A» | Proprietario | Fase 1D, `apps/importer` | sì | `W11d-PLAN.md` D21, DR-088 |

---

## 28. Attuazione di DR-072 — conferma e import reale in locale, 2026-10-03/04

Questa sezione **non registra decisioni nuove**: registra l'attuazione di una
decisione già approvata.

| Voce aperta | Come è stata chiusa |
|---|---|
| **Conferma puntuale di `apply --confirm`** (attuazione di DR-072) | **Data dall'utente** sui conteggi del `plan` riportati in HO-008, con le parole: «HO-008 punto 2: confermo apply --confirm due volte sui conteggi mostrati». Eseguito il 2026-10-04 dopo la copia di salvataggio: due esecuzioni, entrambe con esito `success`, la seconda senza alcuna creazione. Dettaglio in `docs/migration/import-completeness-report.md` |

### Decisioni rimaste aperte dopo la `1D-W11`

| id | Contenuto | Termine |
|---|---|---|
| **Attuazione di DR-087** | Protezione su `contents.updated_at` | prima di qualunque riesecuzione dopo l'uso del CMS, e comunque prima della Fase 1F |
| **D22** | Immagine del servizio che crea i bucket, non più scaricabile | prima di ricreare l'ambiente da zero |
| **Attuazione di DR-040 per il suffisso di paginazione** | Il suffisso in inglese non è stato importato (`seo_templates` 6 invece di circa 7); la sua resa in italiano non ha una colonna propria | nella Fase 1E |

### Correzione al §28, 2026-10-04

La tabella «Decisioni rimaste aperte dopo la `1D-W11`» elencava solo le voci
nuove. Restano aperte anche queste, già registrate al Round 16 e non chiuse:

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** e il suo dossier (DR-073) | Verifica privacy e legale, richiede un professionista | prima della Fase 1F |
| **Impacchettamento del servizio** | Conseguenza di DR-080 | Fase 1F |
| **Riformulazione di ADR-005 §3.3 regola 2** | Attuazione di DR-071 | prima della Fase 1E |
| **Intestazioni di cache dei media** | Conseguenza di DR-074 | Fase 1F |
| **Media citati dentro un blocco di riserva `html`** | Conseguenza di DR-077 | prima della Fase 1E |
| **Soglia di copertura vincolante** | Misurata, nessuna soglia applicata | prima della chiusura della Fase 1D |
| **Un form proprio per `et_pb_contact_form`** | Unico modulo di contatto di Divi, oggi blocco di riserva | prima della Fase 1E |
| **Attuazione di DR-082, DR-084, DR-085** | Trascinamento a due esiti nel menu e nei blocchi; per DR-083 va fatta **prima** dell'audit `1D-W12` | prima della `1D-W12` |

---

## 29. Round 21 — risposta del 2026-10-04, prima dell'audit della Fase 1D

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-093 | 2026-10-04 | Ordine fra la wave del trascinamento e l'audit `1D-W12` | **Opzione A** — si conferma DR-083: prima la wave che attua DR-082, DR-084 e DR-085, poi l'audit | B — audit subito, trascinamento spostato alla Fase 1G | «D23 = A» | Proprietario | Fase 1D, sequenza delle wave | sì | DR-082, DR-083, DR-084, DR-085 |
| DR-094 | 2026-10-04 | Dove stanno il criterio di uscita 16 (301 degli indirizzi storici) e il modulo di contatto di Divi rimasto blocco di riserva (criterio 10) | **Opzione A** — il criterio 16 passa alla Fase 1E, che costruisce il sito pubblico che serve redirect e media; per `et_pb_contact_form` si costruisce un form proprio, come prevede ADR-010, prima della Fase 1E | B — criterio 16 in 1E e modulo accettato come blocco di riserva; C — gestore minimo dei redirect in 1D e form proprio | «D24 = A» | Proprietario | Fase 1D criteri 10 e 16, Fase 1E, ADR-010 | sì | `CONTEXT.md` §7, ADR-010 |
| DR-095 | 2026-10-04 | Soglia di copertura vincolante | **Opzione A** — `pnpm test:coverage` in CI con soglia dell'**80 %** | B — sola misura, senza soglia | «D25 = A» | Proprietario | CI, tutti i pacchetti | sì | registro Round 16 |
| DR-096 | 2026-10-04 | Come si dimostra il criterio di uscita 8 (l'annullamento riporta il database allo stato precedente) | **Opzione A** — vale la prova su dati sintetici già presente fra le prove | B — prova su dati reali con ripristino dalla copia | «D26 = A» | Proprietario | Fase 1D criterio 8 | sì | `CONTEXT.md` §7, DR-072 |

### Note sulla portata

- **DR-094** sposta il criterio 16 fuori dalla Fase 1D; il criterio 10 resta
  della 1D e si chiude con il form proprio. Il form va costruito prima della
  Fase 1E, quindi di fatto prima della chiusura della 1D.
- **DR-095** non è ancora attuata: oggi funzioni 77,37 % e diramazioni
  78,72 %, sotto la soglia.

### Decisioni rimaste aperte dopo il Round 21

| id | Contenuto | Termine |
|---|---|---|
| **Attuazione di DR-082, DR-084, DR-085** | Trascinamento a due esiti nel menu e nei blocchi | prima della `1D-W12` |
| **Attuazione di DR-094** | Form proprio per `et_pb_contact_form` | prima della Fase 1E |
| **Attuazione di DR-095** | Copertura in CI con soglia dell'80 % | prima della chiusura della Fase 1D |

---

## 30. Round 22 — risposta del 2026-10-04, perimetro dello spostamento dei blocchi

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-097 | 2026-10-04 | Fin dove si sposta un blocco trascinandolo, visto che ADR-006 §3.2 limita lo spostamento «dentro una colonna» e DR-085 chiede il rilascio «dentro» | **Opzione A** — dentro e accanto ovunque `BLOCK-MODEL.md` §3.15 ammetta quel tipo, anche fra contenitori diversi; la riga di ADR-006 §3.2 si riformula di conseguenza | B — solo nel contenitore di partenza e in quelli fratelli | «D27 = A» | Proprietario | Fase 1D, `apps/admin`, ADR-006 §3.2 | sì | DR-069, DR-085, `W9b-PLAN.md` D27 |

---

## 31. Attuazioni del 2026-10-07 — DR-094 e DR-095

Questa sezione **non registra decisioni nuove**: registra l'attuazione di
decisioni già approvate. Piano in `.planning/phases/1D/PRE-AUDIT-PLAN.md`.

| Voce aperta | Stato |
|---|---|
| **Attuazione di DR-094** — form proprio per `et_pb_contact_form` | **Codice fatto.** L'importer ricava dal modulo un form con quattro campi e lo cita con un blocco `form`. `plan` sulla sorgente vera: `forms` 26, blocchi di riserva 7 su 305 (2,30 %) in 4 contenuti. Resta l'`apply` reale, a conferma puntuale, e la notifica email (D28) |
| **Attuazione di DR-095** — copertura in CI all'80 % | **Fatta.** Soglia su istruzioni, diramazioni, funzioni e righe; passo «Copertura» in CI. Misura: 86,38 %, 80,02 %, 81,50 %, 86,38 % |

### Conseguenza dichiarata

- **`forms` atteso passa da 25 a 26**, in `database-schema.md` §6 e nei conteggi
  dell'importer: il modulo di contatto di Divi è ora un form proprio.

### Decisioni rimaste aperte

| id | Contenuto | Termine |
|---|---|---|
| **D28** | Notifica email del modulo di contatto: come nella sorgente, o nessuna finché non si collauda l'invio | prima dell'`apply` della `1D-W11e` |

## 32. Round 23 — risposta del 2026-10-07, notifica del modulo di contatto

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-098 | 2026-10-07 | La notifica email del form ricavato dal modulo di contatto di Divi | **Opzione A** — si crea la notifica come nella sorgente: destinazione l'indirizzo del Centro scritto nel modulo, testo con i campi | B — nessuna notifica finché non si collauda l'invio | «D28 = A» | Proprietario | Fase 1D, `apps/importer`, ADR-010 §4.3 | sì | DR-094, `PRE-AUDIT-PLAN.md` D28 |

### Note sulla portata

- **Si configura, non si invia.** In Fase 1D nessun servizio manda email: la
  notifica è un dato, che l'invio vero (ADR-010 §4.3) userà quando esisterà.
- **`form_notifications` atteso passa da 39 a 40.**

## 33. Round 24 — risposta del 2026-10-07, il conteggio di `users` nella verifica

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-099 | 2026-10-07 | Che cosa contano i volumi di tabella della fase `verify` | **Opzione A** — solo le righe nate dall'import (quelle nella mappa di corrispondenza), non quelle create a mano o nel CMS | B — lasciare il controllo com'è e accettare `partial` finché esiste l'account locale, o rimuoverlo prima di ogni import | «D29 = A» | Proprietario | Fase 1D, `apps/importer` fase `verify`, Fase 1F | sì | DR-098, HO-009, `import-completeness-report.md` §10 |

### Attuazione, 2026-10-07

| Voce | Stato |
|---|---|
| **Attuazione di DR-099** | **Fatta e provata.** Prova sintetica nuova, rossa prima della modifica (`users` 2 invece di 1) e verde dopo; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` verdi. `apply --confirm` rieseguito dopo la copia di salvataggio: esito **`success`** |

### Scostamento dichiarato nell'attuazione

La mappa di corrispondenza non copre ogni tabella contata. Dove manca si è
usato il segno più vicino che l'import lascia, senza cambiare lo schema:

| Tabella | Riga dell'import se |
|---|---|
| `contents`, `media`, `terms`, `menu_items`, `forms`, `documents`, `slider_slides`, `users` | il suo id è nella mappa |
| `form_notifications` | il form è nella mappa |
| `content_seo` | il contenuto è nella mappa |
| `redirects`, `form_submissions` | origine `migration` |

Limite noto: una notifica aggiunta nel CMS a un form importato, o la SEO data
nel CMS a un contenuto importato che nella sorgente non l'aveva, contano come
dell'import. Non succede in Fase 1D; va riconsiderato prima dell'import finale
della Fase 1F.

## 34. Round 25 — risposta del 2026-10-08, criterio di uscita 21

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-100 | 2026-10-08 | Come si chiude il criterio 21 per le parti di 1D-29…1D-34 non ancora eseguite nel browser | **Opzione A** — prove Playwright nuove, che restano come regressione e girano in CI | B — HO-006 eseguita a mano dall'utente, con l'esito registrato | «D30 = A» | Proprietario | Fase 1D, `tests/e2e/cms` | sì | `AUDIT.md` §2 criterio 21, HO-006 |

## 35. Round 26 — risposta del 2026-10-09, immagini di MinIO e difetto del §3.1

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-101 | 2026-10-09 | Da dove vengono le immagini di MinIO, ora che `quay.io/minio/minio` e `quay.io/minio/mc` non sono più scaricabili (D22) | **Opzione A** — immagini Chainguard di MinIO (`cgr.dev/chainguard/minio` e `cgr.dev/chainguard/minio-client`), fissate per digest | B — costruire l'immagine di MinIO dai sorgenti, a una release fissata; C — un altro server compatibile S3 (Garage o RustFS), con ADR | «D22 = A» | Proprietario | `infra/compose`, CI, ogni installazione da zero | sì | DR-005, ADR-004 §3.6, `AUDIT.md` §5 |
| DR-102 | 2026-10-09 | Come si corregge il difetto del §3.1 di `AUDIT.md`: una lettura dal servizio cancella ciò che si è appena scritto (D31) | **Opzione B** — i campi restano modificabili e le modifiche fatte nel frattempo si conservano: nell'editor nulla va perso durante il salvataggio, nel pannello SEO e nella scheda della voce di menu una lettura non tocca i campi già modificati | A — bloccare la modifica durante caricamento e salvataggio | «D31 = B» | Proprietario | `apps/admin`: editor del contenuto, SEO del contenuto, scheda della voce di menu | sì | `AUDIT.md` §3.1, DR-100 |

### Attuazione, 2026-10-09

| Voce | Stato |
|---|---|
| **Attuazione di DR-102** | **Fatta e provata.** Tre prove di componente nuove, rosse prima della correzione nei tre punti, compreso il menu, dove il difetto era solo dedotto; verdi dopo. Altre due dopo la revisione del codice: il salvataggio automatico resta fermo durante un salvataggio, e aprire un'altra voce di menu riparte dai suoi valori. Tolte dalle prove end-to-end le due attese che aggiravano il difetto: suite intera 30 su 30, le 7 prove di DR-100 21 su 21 in tre giri |
| **Attuazione di DR-101** | **Fatta per CI e installazioni nuove.** Server `minio:latest`, client `minio-client:latest-dev` (lo script dei bucket vuole una shell), entrambi per digest. Provato in un progetto Compose isolato: server sano, bucket creati, seconda esecuzione senza cambiamenti. Il volume di sviluppo esistente richiede un passo dell'utente (HO-012) |

### Conseguenze dichiarate di DR-101

| Voce | Effetto |
|---|---|
| Versione | il server passa da `RELEASE.2025-09-07T16-13-09Z` a `RELEASE.2026-09-22T19-25-18Z`; il client non dichiara una release (`DEVELOPMENT.GOGET`) |
| Utente | il server gira come utente 65532, non come root: un volume creato dall'immagine precedente va riassegnato una volta (HO-012), altrimenti il server non parte |
| Digest | Chainguard pubblica gratis solo `latest` e `latest-dev`: un digest vecchio può sparire. Se succede, la CI fallisce allo scaricamento e si aggiorna il digest |
| CI | il passo dell'archivio a oggetti ora crea i bucket in modo sincrono: `docker compose wait` falliva se il servizio di inizializzazione era già uscito |

## 36. Round 27 — risposta del 2026-10-09, chiusura della Fase 1D

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-103 | 2026-10-09 | Chiudere la Fase 1D (D32) | **Opzione A** — la Fase 1D è chiusa sulle prove di `AUDIT.md`: 28 criteri su 28, CI `37919066237` verde | B — non chiudere ancora, per una revisione dell'audit o per HO-009 | «D32 = A: registra la chiusura della Fase 1D» | Proprietario | Fase 1D, `ROADMAP.md` | sì | `.planning/phases/1D/AUDIT.md`, DR-094, DR-099…DR-102 |

La chiusura non tocca il gate pre-gestionale: mancano ancora la parità visiva
approvata e il deploy in produzione verificato. La Fase 1E si pianifica solo su
richiesta dell'utente. HO-009 è chiuso lo stesso giorno, su segnalazione
dell'utente.
