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
