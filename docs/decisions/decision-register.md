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

## 37. Round 28 — risposta del 2026-10-09, pianificazione della Fase 1E

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-104 | 2026-10-09 | Come legge i dati il sito pubblico (D33) | **Opzione A** — un modulo pubblico di sola lettura nell'API: rotte anonime che restituiscono solo i contenuti pubblicati, menu, SEO, impostazioni pubbliche, redirect, più la rotta che serve `/media/*` dal bucket pubblico; prova negativa per ogni rotta | B — il sito chiama le rotte della redazione dal server, con un account tecnico | «D33 = A» | Proprietario | Fase 1E `1E-W2`, `apps/api`, `apps/web` | sì | ADR-008 §3.3 regola 4, ADR-004 §3.6, `.planning/phases/1E/PLAN.md` |
| DR-105 | 2026-10-09 | Come si rende e si aggiorna una pagina pubblica (D34) | **Opzione A** — resa sul server a ogni richiesta, senza cache intermedia: ogni modifica è visibile subito | B — HTML statico rigenerato su richiesta dell'API alla pubblicazione (era la raccomandazione) | «D34 = A» | Proprietario | Fase 1E `1E-W4`, `apps/web`; carico dell'API in Fase 1F | sì | ADR-008 («statico dove possibile»), criterio 1G-10 |
| DR-106 | 2026-10-09 | Regole del confronto visivo (D35) | **Opzione C** — le 6 viewport a scala 1 di `visual-regression-plan.md` (594 confronti, Chromium a versione fissata); immagini in `docs/qa/screenshots/` **fuori da Git** (`.gitignore`); nel rapporto un'impronta per ogni immagine | A — il piano della 1B così com'è, immagini fuori da Git senza cartella fissa; B — 3 viewport a scala 1/2/3 della skill, immagini in Git | «D35 = C» | Proprietario | Fase 1E `1E-W1`, `1E-W6`, skill `wordpress-visual-parity` e `deployment-gate` | parziale: le catture di riferimento si fanno una volta | `visual-regression-plan.md` §3 e §11 |
| DR-107 | 2026-10-09 | Terze parti nel sito pubblico (D36) | **Opzione A** — nessuna chiamata a terzi in 1E: Open Sans in file locali, nessuna analisi, nessun popup, video e mappa caricati solo al clic con un'immagine di copertina equivalente, banner dei cookie mascherato e approvato come difformità; la politica di consenso si decide in Fase 1F con la verifica legale | B — riprodurre tutto come nella sorgente | «D36 = A» | Proprietario | Fase 1E `1E-W3`, `1E-W5`; Fase 1F | sì | MI-06, MI-08, `plugin-and-feature-map.md` |
| DR-108 | 2026-10-09 | I form in Fase 1E (D37) | **Opzione A** — resa dei 25 form e richiesta d'invio salvata nel database, con validazione lato servizio e l'antispam di ADR-010; provata solo con dati sintetici; **nessuna email** fino alla Fase 1F | B — sola resa, invio non attivo fino alla 1F | «D37 = A» | Proprietario | Fase 1E `1E-W5`, `apps/api`, `packages/blocks` | sì | ADR-010 §4.3 e §4.5, DR-039, DR-094, DR-098 |

### Conseguenze dichiarate

- **DR-105 scarta la raccomandazione.** Il sito non tiene copie dell'HTML: ogni
  pagina interroga l'API a ogni richiesta. ADR-008 diceva «statico dove
  possibile»; la scelta resta compatibile perché nessuna ADR lo imponeva, ma il
  carico dell'API va misurato nelle prove di prestazione della Fase 1F.
- **DR-106** fissa `docs/qa/screenshots/` come cartella delle prove per il
  `deployment-gate`, fuori da Git: va conservata fino all'approvazione della
  parità, e la sua perdita costringerebbe a ricatturare.
- **DR-107 non dichiara alcuna conformità** sui cookie o sul tracciamento: la
  rimanda alla verifica del professionista (MI-06), prima della Fase 1F.

## 38. Round 29 — risposta del 2026-10-10, controllo sui media e documenti del confronto

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-109 | 2026-10-10 | Media citati per indirizzo dentro un blocco `html` scritto a mano (D38) | **Opzione A** — il controllo di eliminazione cerca nei blocchi, oltre all'identificativo, anche l'indirizzo pubblico del media e quelli delle sue dimensioni derivate; una prova per caso | B — accettare il limite dichiarato, con un avviso fisso nell'editor del blocco | «D38 = A» | Proprietario | Fase 1E `1E-W2`, `apps/api` modulo media | sì | DR-077 |
| DR-110 | 2026-10-10 | Stato di `visual-regression-plan.md` e `acceptance-criteria.md` (D39) | **Opzione A** — entrambi **approvati** e allineati alle decisioni successive alla 1B, con una tabella di revisioni datata: cartella e impronte di DR-106, criteri sospesi risolti da DR-039 e DR-040, criteri 1E-13…1E-19; viewport, soglie e numero dei confronti invariati | B — revisione dell'utente prima dell'approvazione | «D39 = A» | Proprietario | Fase 1E, gate condizioni 6, 9, 10 | sì | DR-038, DR-106, `.planning/phases/1E/CONTEXT.md` §7 |

### Attuazione, 2026-10-10

| Voce | Stato |
|---|---|
| **Attuazione di DR-110** | **Fatta**: i due documenti portano lo stato «approvato» e la revisione datata |
| **Attuazione di DR-109** | Nella `1E-W2`, prima di servire `/media/*` al pubblico |

Una lettura da dichiarare: per **S-2** (le 45 pagine senza description) DR-040 è
stato letto come «una description presente nel sito nuovo e assente nella
sorgente è una correzione attesa»; **scrivere** quelle description non è lavoro
della 1E. Se l'utente intendeva altro, va detto prima della `1E-W7`.

## 39. Round 30 — risposta del 2026-10-10, esiti della cattura del riferimento

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-111 | 2026-10-10 | Riferimento delle 4 pagine in cui l'istanza diverge dal sito online (D40) | **Opzione A** — il riferimento di `/dal-vizioso-al-virtuoso/`, `/corso-per-consulenti-familiari-vecchia-pagina/`, `/riparte-il-corso-per-consulenti-familiari/` (video di YouTube) e `/i-prossimi-corsi-del-centro/` (file con maiuscole diverse) si cattura dal sito online, in sola lettura, nelle stesse condizioni | B — correggere l'istanza (chiamate verso YouTube, nomi di file senza distinzione di maiuscole) e ricatturare da lì; C — tenere le catture dell'istanza e dichiarare le 4 pagine come divergenze note | «D40 = A» | Proprietario | Fase 1E `1E-W1`, `docs/qa/visual-parity-report.md` | sì | `visual-regression-plan.md` §1, DR-016, HO-001 |
| DR-112 | 2026-10-10 | Il conteggio del criterio 1E-2 (D41) | **Opzione A** — **585** confronti: i 567 della matrice che hanno aspetto proprio, più le 4 pagine di destinazione dei documenti e le pagine 2 e 3 dell'archivio delle notizie, a 3 viewport | B — 567, con le 18 catture in più non vincolanti | «D41 = A» | Proprietario | criterio 1E-2, `acceptance-criteria.md`, `visual-regression-plan.md` §2 | sì | DR-106, DR-110 |
| DR-113 | 2026-10-10 | La soglia di superamento automatico con un rumore di fondo misurato di zero (D42) | **Opzione A** — lettura letterale del §6.3: tre volte il rumore, cioè **0 %**. Supera da solo solo il confronto identico al pixel; fino allo 0,50 % si esamina a mano; oltre è fallito | B — soglia automatica allo 0,10 %, il tetto del piano | «D42 = A» | Proprietario | Fase 1E `1E-W6`, criterio 1E-3 | sì | `visual-regression-plan.md` §6.3 |

### Attuazioni del 2026-10-10 nella `1E-W2`

| Voce | Stato |
|---|---|
| **Attuazione di DR-104** | **Fatta e provata.** Modulo `public` dell'API, sola lettura, senza area né permessi, sotto `/public`: contenuto per percorso (con media, carosello, documenti e SEO risolto), menu per chi non ha fatto accesso, impostazioni da un elenco chiuso, redirect, articoli, tassonomie, documenti, mappa del sito; e i file dei media a `/media/…` dal bucket pubblico. Prova negativa per ogni rotta (criterio 1E-16): 29 prove. Revisione di sicurezza indipendente: nessun problema grave; applicati un tetto alla paginazione, il divieto per un redirect a prefisso di portare il percorso verso un altro dominio, e un limite di profondità al menu. Sui dati locali veri il menu dà 41 voci su 41 identiche a `public-menu.csv` |
| **Attuazione di DR-109** | **Fatta e provata.** Il controllo di eliminazione cerca anche l'indirizzo del media e delle sue dimensioni derivate, così come sono e codificati |

Due regole di attuazione, dichiarate perché non scritte in alcun documento: una voce
di menu senza titolo prende il titolo del suo bersaglio, come in WordPress; la
descrizione SEO, se manca la sovrascrittura, è l'estratto o l'inizio del testo
tagliato a 160 caratteri (DR-040), da confrontare con la sorgente nella `1E-W7`.

**Rilievo aperto:** l'importer non scrive `settings['site.home_content_id']`, che
`wp-to-postgres-mapping.md` §5 prevede da `page_on_front` e che
`IMPORTER-DESIGN.md` §11.4 rimandava «a più tardi». Il modulo pubblico la legge; finché
manca, sui dati locali `/` non ha contenuto. Decisione **D43**.

## 40. Round 31 — risposta del 2026-10-10, la pagina iniziale

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-114 | 2026-10-10 | Come si popola `settings['site.home_content_id']`, che l'importer non scriveva (D43) | **Opzione A** — l'importer la scrive nella fase `contents`, da `page_on_front` con `show_on_front = page`, con prove sintetiche; poi copia di salvataggio e riesecuzione di `apply --confirm` sul database locale, su conferma | B — un selettore della pagina iniziale nelle Impostazioni, da usare a mano a ogni import | «D43 = A» | Proprietario | `apps/importer` fase `contents`, database locale, import finale della Fase 1F | sì | `wp-to-postgres-mapping.md` §5, `IMPORTER-DESIGN.md` §11.4, DR-104 |

### Attuazioni del 2026-10-10 nella `1E-W3`

| Voce | Stato |
|---|---|
| **Attuazione di DR-114** | **Fatta e provata** nell'importer: la fase `contents` scrive `site.home_content_id`. Due prove nuove, rosse prima e verdi dopo; suite dell'importer 292 su 292. `plan` sui dati veri: tutto aggiornato sul posto, nessun errore. La riesecuzione di `apply --confirm` attende la conferma dell'utente |
| **Attuazione di DR-071** | **Fatta e provata.** La resa React dei blocchi con spaziature scrive le proprietà personalizzate dell'elenco chiuso; il foglio di stile del sito le usa con il predefinito di Divi come ripiego. Il serializzatore no: `content_html` non porta le proprietà di presentazione (`BLOCK-MODEL.md` §6.1), quindi nessun contenuto cambia e nessuna riesecuzione dell'import serve per questo |
| **Attuazione di DR-107 per il carattere** | **Fatta**: Open Sans v44 in file locali, gli stessi 20 file e le stesse 100 dichiarazioni che Google serve alla sorgente |

**Rilievo:** il colore d'accento della sorgente non supera il criterio A-8 (2,75 sul bianco).
Decisione **D44**.

## 41. Round 32 — risposta del 2026-10-10, contrasto del colore d'accento

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-115 | 2026-10-10 | Il colore d'accento `#2ea3f2` (2,75 sul bianco) e il testo dei campi `#999` su `#eee` (2,46) non superano il criterio A-8 (D44) | **Opzione C** — fedeltà per la parità: i colori si riproducono come sono e A-8 risulta non superato su due coppie, difetto della sorgente da approvare nella UAT; la correzione si pianifica come modifica dopo l'approvazione della parità | A — fedeltà piena senza correzione successiva; B — correggere subito, con una difformità visibile su ogni pagina | «D44 = C» | Proprietario | Fase 1E `1E-W6`, `1E-W8`, UAT; dopo la parità | sì | `docs/design/public-site-tokens.md` §5 |

### Attuazioni del 2026-10-10 dopo la conferma

| Voce | Stato |
|---|---|
| **Riesecuzione dell'import per DR-114** | **Fatta su conferma.** Copia di salvataggio `~/amoris-backup/amoris-prima-DR-114-2026-10-10.dump` (438 KB, 34 tabelle con dati); `apply --confirm`, esecuzione `5100992c`, esito **`success`**. Verifiche: `site.home_content_id` punta al contenuto che nella sorgente era la pagina 62; `/public/content?path=/` risponde 200 con la home; `/public/redirect?path=/home/` risponde 301 verso `/` |

### Rilievi della `1E-W4`

- **L'elenco degli articoli della home non è stato importato.** Lo shortcode
  `[catposts name="News" thumb="true"]` sta in HTML libero, fuori dai blocchi
  Gutenberg, e il lettore dei blocchi scarta quel testo per costruzione
  (`apps/importer/src/convert/gutenberg/comments.ts`). Misurato su tutti i 64
  contenuti Gutenberg: è l'unico testo perso. Decisione **D45**.
- **Logo e piè di pagina non sono dati.** Il logo è un'opzione del tema
  (`et_divi.divi_logo`), il testo del piè di pagina un widget HTML dell'area
  `sidebar-2`; nessuno dei due è nella mappatura approvata. Decisione **D46**.
- **Il titolo delle pagine costruite con Divi.** Il tema mostra il titolo solo se la
  pagina non usa il Divi Builder (`_et_pb_use_builder`); l'importer non lo considera.
  Con questa regola il titolo previsto coincide con la sorgente su 73 pagine su 78; le
  altre 5 sono 4 pagine con il Builder attivo e contenuto Gutenberg, e `/contatti/`,
  il cui `h1` è il titolo del form (`1E-W5`). Decisione **D48**.
- **Regole di presentazione del tema** lette da `et_divi` e attuate nei template, non
  contenuto: 6 articoli per pagina negli archivi (`divi_catnum_posts`), testo
  dell'archivio troncato a 270 caratteri (`divi_use_excerpt = false`), data
  `j M Y`. Il suffisso di paginazione del titolo è in italiano, « - Pagina N», al
  posto del « - Page N» della sorgente (DR-040).
- **Un contenuto pubblicato vince su un redirect con lo stesso percorso**, come in
  WordPress: un solo caso, `/pronti-a-ripartire/`, articolo che condivide lo slug con
  una pagina allegato importata.


## 42. Round 33 — risposta del 2026-10-11, rilievi della `1E-W4`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-116 | 2026-10-11 | L'HTML fuori dai blocchi Gutenberg, scartato dal convertitore (D45) | **Opzione A** — il convertitore lo conserva e converte `[catposts]` nel blocco `post_list`; prove; riesecuzione dell'import | B — aggiungere a mano il blocco alla home dal CMS | «D45 = A» | Proprietario | `apps/importer` convertitore Gutenberg, home | sì | `divi-shortcode-strategy.md` §2.1, `BLOCK-MODEL.md` §3.11 |
| DR-117 | 2026-10-11 | Logo e testo del piè di pagina (D46) | **Opzione A** — l'importer scrive due impostazioni, `site.logo_media_id` (da `et_divi.divi_logo`) e `site.footer_html` (dal widget HTML dell'area del piè di pagina, sanificato), modificabili dalle Impostazioni e lette dal sito | B — piè di pagina come contenuto a blocchi | «D46 = A» | Proprietario | `apps/importer`, `apps/api` lettura pubblica, `apps/web` | sì | `wp-to-postgres-mapping.md` §5, DR-104 |
| DR-118 | 2026-10-11 | Criterio 1E-15 e blocchi di riserva `html` (D47) | **Opzione A** — il criterio vale per l'HTML che il sistema genera; i blocchi di riserva conservano il markup della sorgente per costruzione (ADR-005 §3.4) e le loro dichiarazioni in linea si contano e si dichiarano nel rapporto | B — trasformare in classi gli stili dei blocchi di riserva | «D47 = A» | Proprietario | criterio 1E-15, `acceptance-criteria.md`, rapporto di parità | sì | DR-071, ADR-005 §3.3–§3.4 |
| DR-119 | 2026-10-11 | `show_title` delle pagine costruite con Divi (D48) | **Opzione A** — l'importer mette `show_title` a falso per le pagine con `_et_pb_use_builder = on`, come fa il tema; prove; riesecuzione dell'import | B — regola nel sito dal formato d'origine | «D48 = A» | Proprietario | `apps/importer` fase `contents`, criterio 1E-14 | sì | DR-040 |

### Attuazioni del 2026-10-12 dopo la conferma

| Voce | Stato |
|---|---|
| **Commit e push delle correzioni di DR-116…119** | Fatti su conferma: `08bad93` |
| **Riesecuzione dell'import** | **Fatta su conferma, due volte.** Copia `~/amoris-backup/amoris-prima-DR-116-119-2026-10-12.dump` (34 tabelle con dati); esecuzione `1245a919`, esito `success`, ma senza il logo: l'opzione del tema contiene un oggetto PHP serializzato e la lettura falliva. Corretta con una prova; nuova copia `amoris-prima-DR-117-logo-2026-10-12.dump`; esecuzione `0a1abf95`, esito `success`, conteggi identici alla prima (idempotenza) |
| **Verifiche nel database** | `site.logo_media_id` → `2017/09/logo_header_2.png`; `site.footer_html` presente; la home contiene il blocco `post_list` (tutte le categorie, 10 articoli, miniatura, data, estratto, come la configurazione salvata); `show_title` falso per 30 pagine |

### Rilievi del 2026-10-12

- **Il piè di pagina perdeva allineamento e stili** nel sito: il componente lo rifiltrava con l'elenco chiuso del testo ricco. Ora toglie solo il markup pericoloso, come all'import (DR-117, DR-118).
- **La rimozione del markup pericoloso non toglieva gli indirizzi `javascript:`, `vbscript:`, `data:`**: ora li toglie, anche nei blocchi di riserva. Nessun contenuto importato ne conteneva.
- **Titolo nascosto in più**: con `show_title` falso il sito aggiungeva un `h1` nascosto anche dove il contenuto ha già il suo (`/contest-fotografico-selfiemotions/`, 2 `h1` contro 1 della sorgente). Corretto.
- **L'elenco degli articoli della home salta il più recente** nella sorgente (`offset 1` della configurazione salvata): il blocco `post_list` non ha questo parametro. Da trattare nella resa del blocco, `1E-W5`.
- **`next-route-announcer`**: Next.js aggiunge a runtime un elemento con `position` in linea, per l'accessibilità; la verifica lo conta a parte, non come HTML generato dal sistema.
- **Scorrimento orizzontale su `/informazioni-sui-cookie/` a 390 e 360 px**: lo causa la tabella dei cookie, che sporge anche nella sorgente (710 px contro 464). Decisione **D49**.

## 43. Round 34 — risposta del 2026-10-12, rilievo della `1E-W4`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-120 | 2026-10-12 | Scorrimento orizzontale di `/informazioni-sui-cookie/` a 390 e 360 px, presente anche nella sorgente (D49) | **Opzione A** — la tabella scorre nel proprio riquadro e la pagina non scorre; difformità da mascherare e approvare nella `1E-W6` | B — comportamento della sorgente, eccezione dichiarata al criterio | «D49 = A» | Proprietario | `apps/web` stili, criterio d'uscita della `1E-W4`, `1E-W6` | sì | `.planning/phases/1E/PLAN.md` §3 |

### Esiti della `1E-W5` (2026-10-12)

- **Blocchi resi**: carosello scritto nel progetto, video e mappa con copertina e caricamento solo al clic, elenco degli articoli dalla lettura pubblica (con il nuovo parametro `offset`), form generati dalla definizione con invio salvato e nessuna email (DR-107, DR-108).
- **Rimando di pagamento (DR-039)**: la configurazione PayPal Standard di ogni form si importa dalla sorgente (conto, modalità, donazione o acquisto, valuta EUR); l'indirizzo compare **solo nella risposta all'invio**, come nella sorgente, mai nei dati della pagina.
- **`h1` di `/contatti/`**: il titolo del modulo di contatto di Divi si rende come `h1`, «Richiesta informazioni», come nella sorgente (1E-14).
- **Revisione del codice**: nessun rilievo critico; corretto l'indirizzo della copertina del video, che ora passa dal controllo degli schemi. Rischi residui dichiarati: l'invio pubblico non ha CSRF (non c'è sessione), quindi un sito terzo può far inviare il modulo dai browser dei visitatori aggirando il limite per IP; il conteggio dei tentativi non è atomico. Le `options` dei campi escono nella lettura pubblica già filtrate dall'importer: quando il CMS potrà scrivere i form, il filtro va ripetuto in lettura.
- **Il carosello non è usato da nessun contenuto importato** (12 slide in `slider_slides`, nessun blocco `slider`): resa provata solo dai test.
- **In attesa di conferma**: riesecuzione dell'import per portare nel database `offset` della home e la configurazione di pagamento dei 22 form. Decisioni **D50** e **D51**.

### Esiti parziali della `1E-W6` (2026-10-12)

- **Cattura interrotta**: 475 catture su 585, per mancanza di memoria della macchina (due catture partite in parallelo per errore). Il confronto parziale non vale come esito dei criteri 1E-2…1E-4. Serve una ricattura integrale con memoria libera.
- **Causa A, «a capo» non trasformati** (bloccante): l'importer ora applica `wpautop()` come la resa della sorgente, ma non ai contenuti Gutenberg, perché WordPress non lo fa. Effettiva solo dopo la riesecuzione dell'import.
- **Causa B, immagini allineate a sinistra o a destra** (maggiore): regole del tema riportate nel foglio di stile, effettive subito.
- **1E-19 eseguito su 4 contenuti**: aprire e salvare senza modifiche non cambia la pagina pubblica. Per la prova è stato creato un account locale sintetico di ruolo editor, non cancellato.
- **Carosello della home**: nella sorgente pubblicata non c'è. Lo shortcode è solo in revisioni vecchie della home e la cattura di riferimento non lo mostra. Il punto 10 del §8 di `visual-regression-plan.md` va rivisto: decisione **D52**.

## 44. Round 35 — risposta del 2026-10-13, rilievi della `1E-W5` e della `1E-W6`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-121 | 2026-10-13 | Mappa dopo il clic (D50) | **Opzione A** — incorporazione di Google Maps senza chiave, caricata solo al clic, come la sorgente | B — OpenStreetMap; C — solo un collegamento a Google Maps | «D50=A» | Proprietario | `packages/blocks` resa della mappa | sì | DR-107, MI-05 |
| DR-122 | 2026-10-13 | Video dopo il clic (D51) | **Opzione A** — `youtube-nocookie.com` | B — `youtube.com` come la sorgente | «D51=A» | Proprietario | `packages/blocks` resa del video | sì | DR-107 |
| DR-123 | 2026-10-13 | Verifica del carosello della home (D52) | **Opzione A** — tolta dal §8 di `visual-regression-plan.md`, con riga di revisione | B — lasciata e dichiarata non applicabile | «D52=A» | Proprietario | `docs/qa/visual-regression-plan.md` §8 | sì | esiti parziali della `1E-W6` |

Nella stessa risposta: **HO-013 confermato** (riesecuzione dell'import in locale), **HO-014 fatto** (9,3 GB liberi), conferma di commit e push della `1E-W5` e della `1E-W6`; l'account locale di prova della `1E-W6` resta.

## 45. Round 36 — risposta del 2026-10-13, HO-015

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-124 | 2026-10-13 | HO-015 voce 1: banner dei cookie della sorgente assente nel sito nuovo | **approvata** come maschera su tutte le pagine | da correggere | «1 approvata» | Proprietario | confronto visivo, rapporto di parità | sì | DR-107, MI-08 |
| DR-125 | 2026-10-13 | HO-015 voce 2: mappa con copertina e caricamento al clic | **approvata** come maschera `.blk-map` su `/contatti/` e `/dove-siamo/` | da correggere | «2 approvata» | Proprietario | confronto visivo, rapporto di parità | sì | DR-107, DR-121 |
| DR-126 | 2026-10-13 | HO-015 voce 3: video con copertina e caricamento al clic | **approvata** come maschera `.blk-video` su `/riparte-il-corso-per-consulenti-familiari/` e `/dal-vizioso-al-virtuoso/` | da correggere | «3 approvata» | Proprietario | confronto visivo, rapporto di parità | sì | DR-107, DR-122 |
| DR-127 | 2026-10-13 | HO-015 voce 4: tabella dei cookie che scorre nel proprio riquadro a 390 e 360 px | **approvata** come difformità mascherata | da correggere | «4 approvata» | Proprietario | `/informazioni-sui-cookie/` | sì | DR-120 |
| DR-128 | 2026-10-13 | HO-015 voce 5: suffisso di paginazione «- Pagina N» nel titolo del documento | **approvata** come difformità | da correggere | «5 approvata» | Proprietario | archivi paginati | sì | DR-040 |

Le maschere 2 e 3 restano da rimisurare dopo le correzioni delle famiglie A–D; l'approvazione vale per la voce, non per le coordinate attuali.

## 46. Round 37 — risposta del 2026-10-13, analisi d'impatto delle famiglie A–D della `1E-W6`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-129 | 2026-10-13 | Analisi d'impatto A–D e modifiche fuori dal perimetro della `1E-W6` | **approvata**, con modifiche ad `apps/importer` e `apps/api` | — | «Approvo l'analisi A–D e le modifiche ad apps/importer e apps/api» | Proprietario | `apps/importer`, `apps/api`, `packages/blocks`, `apps/web` | sì | `docs/qa/confronto/analisi-impatto-A-D.md`, PLAN §2 |
| DR-130 | 2026-10-13 | Primo articolo dell'elenco della home (D53) | **Opzione A** — come la sorgente: `offset` del plugin contato da 1, si parte dal più recente | B — mantenere il salto del più recente | «D53=A» | Proprietario | importer `[catposts]`, home | sì | supera il rilievo del 2026-10-12 su DR-116 e HO-013 |
| DR-131 | 2026-10-13 | `/bacheca/` (D54) | **Opzione A** — lo stesso testo della sorgente, statico e modificabile dal CMS | B — pagina vuota come difformità; C — tolta con redirect | «D54=A» | Proprietario | importer, shortcode `[wpdm_user_dashboard]` | sì | `divi-shortcode-strategy.md` §2.1 |
| DR-132 | 2026-10-13 | Campo telefono con bandiera (D55) | **Opzione A** — intl-tel-input servita dal sito, con ADR | B — campo semplice come difformità | «D55=A» | Proprietario | `packages/blocks` resa del form | sì | ADR da scrivere |
| DR-133 | 2026-10-13 | Forma dei valori dei campi composti (D56) | **Opzione A** — un oggetto per campo (`first`/`last`, indirizzo); conferma email controllata e non salvata | B — sotto-campi come voci separate | «D56=A» | Proprietario | API invio dei form, vista delle compilazioni | sì | ADR-010 |
| DR-134 | 2026-10-13 | Geometria delle colonne Gutenberg (D57) | **Opzione B** — la riga ricorda l'origine; righe Gutenberg in flex con passaggio a 781 px e `flex-basis` conservata | A — geometria Divi per tutte | «D57=B» | Proprietario | schema dei blocchi, importer, CSS | sì | analisi A–D §B |

Ordine di lavoro indicato dall'utente: A e B, poi D e C.

## 47. Round 38 — risposta del 2026-10-13, famiglia J e HO-018

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-135 | 2026-10-13 | Correzione J: link interni assoluti spezzati in `https:/…` | **approvata** (J1 normalizzazione solo per indirizzi relativi allo schema, J2 prova, J3 import) | — | «Approvo la correzione J» | Proprietario | `apps/importer` normalizzazione degli indirizzi | sì | `docs/qa/confronto/analisi-impatto-A-D.md` §J |

Nella stessa risposta: **HO-018 confermato** (riesecuzione dell'import in locale), poi verifica a vista di home, `/corsi-2022-2023/`, `/registrazione-sguardi-damore/`, ricattura e nuovo confronto della `1E-W6`.

## 48. Round 39 — risposta del 2026-10-13, D58

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-136 | 2026-10-13 | Famiglia d'origine di `/bacheca/` (D58) | **Opzione A** — riconoscere la famiglia sul testo originale, ripartizione 57/47/4 | B — accettare 56/47/5 e aggiornare la prova | «D58=A» | Proprietario | importer, fase dei contenuti | sì | DR-131, `classificazione.md` §4 |

## 49. Round 40 — risposta del 2026-10-13, analisi K–M e D59–D61

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-137 | 2026-10-13 | Analisi d'impatto K, L, G, C+, M e attuazione di D58 | **approvata**, nell'ordine K, C+ e M, L, G con D58, poi HO per l'import | — | «Approvo l'analisi K-M» | Proprietario | `packages/blocks`, `apps/web`, `apps/importer`, `apps/api`, `packages/db`, `apps/admin` | sì | `docs/qa/confronto/analisi-impatto-K-M.md` |
| DR-138 | 2026-10-13 | Immagini Gutenberg con dimensione ridotta (D59) | **Opzione A** — si mostra la variante scelta nella sorgente (`image.variant`) | B — sempre l'originale | «D59=A» | Proprietario | importer Gutenberg, resa delle immagini | sì | K-bis |
| DR-139 | 2026-10-13 | Dove conservare il layout della barra laterale (D60) | **Opzione A** — colonna `page_layout` dei contenuti, letta dal sito e modificabile dal CMS | B — solo importata | «D60=A» | Proprietario | schema, API, area amministrativa, sito | sì | famiglia G |
| DR-140 | 2026-10-13 | Indirizzo e segnaposti sotto la mappa (D61) | **Opzione A** — nascosti come la sorgente | B — visibili come difformità | «D61=A» | Proprietario | resa della mappa | sì | famiglia M |

Nella stessa risposta: conferma di commit e push del lavoro della `1E-W6`.

## 50. Round 41 — risposta del 2026-10-13, HO-019 e D62

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-141 | 2026-10-13 | Indicatore di focus da tastiera nei form (D62) | **Opzione A** — contorno visibile solo con la tastiera (`:focus-visible`) | B — solo il bordo `#999` della sorgente | «D62=A» | Proprietario | resa dei form del sito pubblico | sì | `analisi-impatto-K-M.md` |

Nella stessa risposta: **HO-019 confermato** (migrazione 0003 e import in locale), poi verifica a vista di layout e barre, ricattura e nuovo confronto della `1E-W6`.

Risposta del 2026-10-14: commit e push confermati; contorno di focus anche al clic nei campi di testo (comportamento standard di `:focus-visible`) accettato — «Contorno dei form ok così» (nota a DR-141).

## 51. Round 42 — risposta del 2026-10-14, analisi E-F e D63-D65

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-142 | 2026-10-14 | Analisi d'impatto E (testata) ed F (piè di pagina) | **approvata**, nell'ordine E1, F1-F2, E5, poi E2-E4, con prove e ricattura | — | «Approvo l'analisi E-F» | Proprietario | `apps/web`, `apps/api` | sì | `docs/qa/confronto/analisi-impatto-E-F.md` |
| DR-143 | 2026-10-14 | Font delle icone (D63) | **Opzione A** — font `ETmodules` della sorgente ridotto ai glifi usati; licenza da verificare da una persona prima del rilascio | B — glifi ridisegnati in SVG | «D63=A» | Proprietario | stili del sito pubblico | sì | E2 |
| DR-144 | 2026-10-14 | Ricerca del sito pubblico (D64) | **Opzione A** — icona, modulo e pagina dei risultati come la sorgente, lettura pubblica nuova nell'API | B — solo icona e modulo; C — difformità | «D64=A» | Proprietario | API pubblica, sito, matrice | sì | E3 |
| DR-145 | 2026-10-14 | Spazio sotto la testata (D65) | **Opzione A** — testata `sticky` sopra i 980 px | B — script; C — valori fissi | «D65=A» | Proprietario | stili della testata | sì | E4 |

## 52. Round 43 — risposta del 2026-10-14, HO-020

Nessuna nuova decisione. **HO-020 confermato** — «HO-020: confermo migrazione e import in locale.» — poi confronto della ricerca con la sorgente, verifica a vista, ricattura e nuovo confronto della `1E-W6`. Esito in `docs/qa/confronto/ricerca-E3.md`.

## 53. Round 44 — risposta del 2026-10-14, D66-D69

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-146 | 2026-10-14 | Frase di ricerca fra due paragrafi (D66) | **Opzione A** — blocchi separati da un a capo nel testo visibile, frase cercata dentro un blocco; nuovo import su conferma | B — differenza registrata | «D66=A» | Proprietario | estrazione del testo, ricerca | sì | `ricerca-E3.md` |
| DR-147 | 2026-10-14 | Contorno di focus nel campo di ricerca (D67) | **Opzione A** — contorno come DR-141 | B — nessun contorno | «D67=A» | Proprietario | testata | sì | `ricerca-E3.md` |
| DR-148 | 2026-10-14 | Sottomenu nascosti con la testata `sticky` (D68) | **Opzione A** — sottomenu chiusi fuori dal calcolo dell'altezza, stessa dissolvenza | B — testata `fixed` con script | «D68=A» | Proprietario | testata | sì | `ricerca-E3.md` |
| DR-149 | 2026-10-14 | Spaziatura per pagina `et_pb_gutters` (D69) | **Opzione A** — `_et_pb_gutter_width` importato per contenuto, classe sul `body`, 2 come valore del tema; migrazione e import su conferma | B — regola fissa `gutters2` | «D69=A» | Proprietario | importer, schema, API, sito | sì | `ricerca-E3.md` |
| DR-150 | 2026-10-14 | Correzione del campo di ricerca e ordine di lavoro | **approvati**: (b), (a), campo, (c), risultati; analisi d'impatto, correzioni, ricattura | — | «Approvo la correzione del campo di ricerca e l'ordine…» | Proprietario | `apps/web`, `apps/api`, `apps/importer` | sì | `ricerca-E3.md` §5 |

## 54. Round 45 — risposta del 2026-10-16, HO-021 e D70

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-151 | 2026-10-16 | Tipografia di WordPress ed emoji nell'estratto (D70) | **Opzione A** — `wptexturize` portato nell'import, estratto contato sulla forma scritta da WordPress | B — solo virgolette; C — difformità | «D70=A» | Proprietario | importer, testi e titoli, estratti | sì | `analisi-impatto-ricerca-E3.md` |

Nella stessa risposta: **HO-021 confermato** (migrazione 0005 e import in locale), poi ripresa della ricattura e confronto della `1E-W6`. Contorno del campo di ricerca: risposta lasciata come «ok/da rivedere», quindi **non decisa**; resta come attuato (DR-147, contorno interno al campo) finché non si sceglie.

## 55. Round 46 — risposta del 2026-10-16, D70 e contorno della ricerca

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-152 | 2026-10-16 | Elenco dei punti di D70 | **approvato**: porto di `wptexturize` nell'import, estratti contati come Divi, HO-022 | — | «approvo l'elenco di D70» | Proprietario | importer, `apps/web` | sì | `analisi-impatto-ricerca-E3.md`, sezione D70 |
| DR-153 | 2026-10-16 | Contorno del campo di ricerca come attuato (dentro il campo) | **approvato** | da rivedere | «Contorno della ricerca: ok» | Proprietario | testata | sì | DR-147 |

## 56. Round 47 — risposta del 2026-10-16, HO-022 e §7

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-154 | 2026-10-16 | Correzioni dell'esame delle 13 coppie | **approvate**: freccia del menu (`position: relative`), logo (`translate3d`), interlinea `1.7em`, rimisura della maschera della mappa | — | «Approvo le quattro correzioni del §7» | Proprietario | stili del sito, `maschere.json` | sì | `ricerca-E3.md` §7 |

Nella stessa risposta: **HO-022 confermato** (import in locale), poi ricattura, confronto e verifica della tipografia della `1E-W6`.

## 57. Round 48 — risposta del 2026-10-16, D71 e D72

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-155 | 2026-10-16 | Peso delle virgolette negli estratti (D71) | **Opzione A** — l'importer conserva la forma del testo grezzo da cui si conta l'estratto e il sito la usa; i contenuti scritti dal CMS contano i caratteri come sono; migrazione e import su conferma | B — peso 7 per tutte e difformità | «D71=A» | Proprietario | importer, schema, API, estratti di archivio e ricerca | sì | `ricerca-E3.md` §8 |
| DR-156 | 2026-10-16 | Descrizione del campo di pagamento nei form (D72) | **Opzione A** — testo del bonifico mostrato come nella sorgente, coordinate bancarie dell'associazione pubbliche | B — campo senza descrizione e difformità | «D72=A» | Proprietario | form | sì | `ricerca-E3.md` §8 |

Nella stessa risposta: analisi per famiglie delle coppie fallite, con le altezze peggiorate e migliorate nell'ultimo giro (`analisi-famiglie-DR-154.md`). Verifica successiva su DR-156: il testo è già reso come nella sorgente (compare scegliendo «Bonifico», stessa altezza); nessuna modifica al prodotto, vedi `analisi-famiglie-DR-154.md` §4.

## 58. Round 49 — risposta del 2026-10-16, analisi per famiglie dopo DR-154

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-157 | 2026-10-16 | Correzioni di stile Q, P, N, S, V e ordine di lavoro | **approvati**: Q, P, N, S, V e l'ordine del §6 (stili; importer con D71, R, U1 e un solo import su conferma; resa T, U2–U3) | — | «approvo Q, P, N, S, V e l'ordine del §6» | Proprietario | `apps/web`, `packages/blocks`, `apps/importer` | sì | `analisi-famiglie-DR-154.md` §3, §6 |
| DR-158 | 2026-10-16 | Punti di attuazione di D71 | **approvati**: D71-1…D71-8 | — | «approvo D71-1…8» | Proprietario | schema, importer, API, sito | sì | `analisi-famiglie-DR-154.md` §4 |
| DR-159 | 2026-10-16 | Grassetto non chiuso nel testo del bonifico (D73) | **Opzione A** — il sito chiude il tag, difformità approvata | B — riprodurre | «D73=correggi e registra come difformità» | Proprietario | 10 form | sì | `analisi-famiglie-DR-154.md` §3.8 |
| DR-160 | 2026-10-16 | Articolo 332 nell'archivio (D74) | **Opzione A** — DR-063 invariata, voce in meno nell'archivio registrata come difformità | B — elencarlo | «D74=correggi e registra come difformità» | Proprietario | archivio, ricerca | sì | `analisi-famiglie-DR-154.md` §3.10 |
| DR-161 | 2026-10-16 | Scheda del pacchetto nei download (D75) | **Opzione A** — scheda come la sorgente, senza contatore dei download (difformità) | B — con contatore; C — solo «Scarica» | «D75=come la sorgente ma senza contatore dei download» | Proprietario | 4 pagine di download | sì | `analisi-famiglie-DR-154.md` §3.10 |

Nella stessa risposta: richiesta di un **report visivo** delle difformità a fine correzioni, con gli screenshot affiancati e la scelta «accettabile / non accettabile» per ciascuna. Interpretazione registrata per D74: «correggi» letto come opzione A (nessun cambio di DR-063, difformità registrata), da confermare nel report.

## 59. Round 50 — scelte del 2026-10-16 nel report «Bozze di parità visiva»

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-162 | 2026-10-16 | Difformità residue della `1E-W6`, indirizzo per indirizzo | **accettabili tutte**: 112 indirizzi su 112 con viste non superate (544 viste a 1440–360 px), nessuno da correggere, nessuna nota | da correggere | scelta «Accettabile» su ogni scheda del report, poi «ho deciso nel report» | Proprietario | sito pubblico, 112 indirizzi | sì | `docs/qa/confronto/decisioni-report-DR-162.csv`, artifact «Bozze di parità visiva» |
| DR-163 | 2026-10-16 | Captcha aritmetico del modulo di `/contatti/` | **difformità accettata**: il sito non lo mostra, vale il campo esca (ADR-010) | riprodurre il captcha | scheda di `/contatti/` accettata con la nota «Da decidere: captcha» | Proprietario | modulo di contatto | sì | DR-162 |
| DR-164 | 2026-10-16 | Lettura di «correggi» in D74 | **confermata l'opzione A** (DR-160): voce in meno nell'archivio, DR-063 invariata | — | schede di `/category/news/page/3/` e `/?s=corso` accettate con la nota della difformità | Proprietario | archivio, ricerca | sì | DR-160 |

L'accettazione vale per la `1E-W6`; non è l'approvazione della parità del gate pre-gestionale, che resta da dare esplicitamente in `docs/qa/visual-parity-report.md` dopo `1E-W7` e `1E-W8`.

## 60. Round 51 — risposta del 2026-10-17, chiusura della `1E-W6`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-165 | 2026-10-17 | Chiusura della `1E-W6` e commit delle modifiche | **chiusa**: criteri d'uscita soddisfatti (DR-162…164, 1E-19 4/4), commit autorizzato | tenere aperta la wave | «1E-W6: confermo la chiusura della wave e il commit delle modifiche; poi pianifica la 1E-W7» | Proprietario | Fase 1E | sì | `PROGRESS.md`, DR-162…164 |

## 61. Round 52 — risposta del 2026-10-17, metodo della `1E-W7`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-166 | 2026-10-17 | Verifiche manuali del §8 (D76) | **Opzione A** — misura automatica su sito e riferimento, catture degli stati giudicate dall'utente in un report | B — solo automatica; C — a mano con una lista | «D76=A» | Proprietario | 81 URL ad alta priorità | sì | `W7-PLAN.md` §7 |
| DR-167 | 2026-10-17 | Dove vivono gli script della `1E-W7` (D77) | **Opzione A** — `tests/visual/` sui dati reali in locale; deviazione da `PLAN.md` §2 | B — `tests/e2e/` (seme sintetico) | «D77=A» | Proprietario | `tests/visual/`, `docs/qa/verifiche/` | sì | `W7-PLAN.md` §7 |
| DR-168 | 2026-10-17 | «Senza salti» da 1440 a 360 px (D78) | **Opzione A** — passo di 10 px su sito e riferimento: nessuno scorrimento orizzontale, stesse larghezze di passaggio dei layout | B — solo sito; C — anche altezza con tolleranza | «D78=A» | Proprietario | §8 voce 7 | sì | `W7-PLAN.md` §7 |
| DR-169 | 2026-10-17 | Difetti di accessibilità ereditati (D79) | **Opzione A** — subito ciò che non cambia la resa; alt mancanti elencati per il redattore, non inventati; dopo la UAT ciò che cambia la resa | B — solo registrare; C — tutto ora | «D79=A» | Proprietario | A-1…A-8 | sì | `W7-PLAN.md` §7, DR-115 |

Nella stessa risposta l'utente ha confermato il push di `1a107c0`, eseguito il 2026-10-17.

## 62. Round 53 — risposta del 2026-10-17, difformità dei metadati della `1E-W7` (T1)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-170 | 2026-10-17 | M1 dati strutturati Schema.org | **Opzione A** — JSON-LD equivalente alla sorgente per tipo di contenuto | B — minimo; C — nessuno | raccomandazione accettata nella pagina delle domande | Proprietario | sito pubblico, 113 URL | sì | `docs/qa/verifiche/decisioni-metadati-M1-M8.md` |
| DR-171 | 2026-10-17 | M2 description troncata | **Opzione A** — taglio a 160 caratteri con «…», correzione voluta | B — lunghezza della sorgente; C — senza «…» | idem | Proprietario | 37 URL | sì | idem |
| DR-172 | 2026-10-17 | M3 apici e lineette nei metadati | **Opzione A** — dritti nei metadati, tipografici solo nel corpo | B — tipografici ovunque | idem | Proprietario | 9 URL, feed | sì | idem |
| DR-173 | 2026-10-17 | M4 description diversa | **Opzione C** — description dei metadati dal testo, estratto invariato negli elenchi; normalizzazione dei 7 casi minori | A — anche negli elenchi; B — solo segnalazione al redattore | idem | Proprietario | 9 URL | sì | idem |
| DR-174 | 2026-10-17 | M5 segnaposto SEO non risolti | **Opzione A** — variabili tradotte all'import, title corretto (DR-040); import su conferma | B — riprodurre; C — correzione manuale | idem | Proprietario | importer, 1 URL | sì | idem |
| DR-175 | 2026-10-17 | M6 paginazione dell'archivio | **Opzione B** — canonical autoreferenziale e indicizzabile, correzione DR-040 | A — come la sorgente; C — noindex, follow | idem | Proprietario | 2 URL | sì | idem |
| DR-176 | 2026-10-17 | M7 `robots.txt` | **Opzione A** — `Disallow: /admin` e riga `Sitemap:` assoluta | B — anche le regole WordPress; C — invariato | idem | Proprietario | `robots.txt` | sì | idem |
| DR-177 | 2026-10-17 | M8 sitemap | **Opzione A** — sitemap unica con i 5 percorsi mancanti (113/113) | B — indice con figlie; C — invariata | idem | Proprietario | `sitemap.xml` | sì | idem |
| DR-178 | 2026-10-17 | Accesso al CMS e vecchio `/wp-admin/` | **Opzione A** — CMS su `/admin`; `/wp-admin/` e `/wp-login.php` 404 | B — 301 al login; C — 301 temporaneo | «L'accesso al backend del nuovo CMS deve diventare /admin e non /wp-admin/»; raccomandazione accettata | Proprietario | proxy, sito, handoff ai redattori | sì | idem, T2 |

Le correzioni si attuano nella T7 dopo l'analisi d'impatto approvata; nessuna è attuata con questa registrazione.

## 63. Round 54 — risposta del 2026-10-18, analisi d'impatto della T7 (`1E-W7`)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-179 | 2026-10-18 | Apici e lineette nei title (D80); **supera in parte DR-172** | **Opzione A** — dritti solo in `description`, `og:description` e titolo del feed; title tipografici come la sorgente | B — DR-172 alla lettera, title compresi | «D80=A» | Proprietario | metadati, 9 URL e feed | sì | `docs/qa/verifiche/analisi-impatto-T7.md` §1, DR-172 |
| DR-180 | 2026-10-18 | Description per tipo di contenuto (D81); **supera in parte DR-173** | **Opzione A** — come All in One SEO: articoli dall'estratto, pagine dal testo; estratto negli elenchi invariato | B — estratto sempre ignorato | «D81=A» | Proprietario | metadati, importer, API | sì | idem, DR-173 |
| DR-181 | 2026-10-18 | `/download-category/moduli-consulenze/` (D82) | **Opzione A** — pagina vera con l'elenco dei moduli pubblici, in sitemap, con cattura e confronto | B — 301 e fuori sitemap; C — 404 e fuori sitemap | «D82=A» | Proprietario | API, sito, matrice di parità | sì | idem, DR-177 |
| DR-182 | 2026-10-18 | `Person` nei dati strutturati (D83) | **Opzione A** — esclusa; difformità registrata come correzione voluta di DR-170 | B — riprodotta con Gravatar e pagina d'autore; C — autore = organizzazione | «D83=A» | Proprietario | JSON-LD dei 29 articoli | sì | idem, DR-170 |
| DR-183 | 2026-10-18 | Riconoscimento delle derivate Divi (D84) | **Opzione A** — euristica per larghezza (480/980/1280, stessa proporzione) nel renderer, senza import | B — `size_name` con migrazione e import | «D84=A» | Proprietario | `packages/blocks`, 26 URL da ricatturare | sì | idem §3 I2 |

Nella stessa risposta l'utente ha approvato l'elenco dei punti da toccare di
`analisi-impatto-T7.md` e chiesto l'attuazione del gruppo 1 (F1, A3-1, I1 senza freccia, M2, M6, M7).

## 64. Round 55 — risposta del 2026-10-18, T7 della `1E-W7` (round 2)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-184 | 2026-10-18 | Dove si corregge I3, video `.mp4` (D85) | **Opzione A** — nell'importer: tipo calcolato dopo la riscrittura in `/media/`; blocchi rigenerati con l'import `contents` di M3/M4 | B — eccezione nel renderer; C — modifica manuale dei 4 blocchi | «D85=A» | Proprietario | importer, 2 pagine | sì | `analisi-impatto-T7.md` §3 I3 |
| DR-185 | 2026-10-18 | Campi dell'organizzazione nel JSON-LD (D88) | **Opzione B** — oltre a `name` e `url`: logo, indirizzo, telefono e profili social, da impostazioni del CMS | A — solo `name` e `url` come la sorgente | «D88=B» | Proprietario | impostazioni, importer, sito | sì | idem §1 M1, DR-170 |
| DR-186 | 2026-10-18 | `dateModified` (D89) | **Opzione B** — colonna con il `post_modified` della sorgente nella migrazione 0007 e nello stesso import; poi aggiornata dalle modifiche dal CMS | A — data dell'import; C — non dichiarata | «D89=B» | Proprietario | DB, importer, API, sito | sì | idem |
| DR-187 | 2026-10-18 | `CollectionPage`, `SearchResultsPage`, 404 nel JSON-LD (D90) | **Opzione A** — inclusi, come la sorgente | B — solo i tipi elencati in DR-170 | «D90=A» | Proprietario | sito | sì | idem, DR-170 |
| DR-188 | 2026-10-18 | Canonical, `og:url`, `og:image` assoluti (D91) | **Opzione A** — assoluti con `metadataBase` da `SITE_URL` | B — relativi | «D91=A» | Proprietario | metadati di tutte le pagine | sì | idem |

## 65. Round 56 — risposta del 2026-10-18, T7 della `1E-W7` (round 3)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-189 | 2026-10-18 | Richieste a intervalli per i media (D86) | **Opzione A** — subito: `206 Partial Content` e `Accept-Ranges` nella rotta dei media e nella lettura dallo storage | B — nella Fase 1F | «D86=A» | Proprietario | API, video `.mp4` | sì | `analisi-impatto-T7.md` §3 I3, DR-184 |
| DR-190 | 2026-10-18 | Ambito di Esc sul menu per telefono (D87) | **Opzione A** — solo con il fuoco nel menu, come già attuato | B — da qualunque punto della pagina | «D87=A» | Proprietario | testata | sì | idem §4 A3-1 |
| DR-191 | 2026-10-18 | Riga di sovrascrittura del title di M5 (D92) | **Opzione A** — tenuta, tradotta in `{title} - {site_title}`; righe SEO importate 2 | B — non importata perché uguale al modello | «D92=A» | Proprietario | importer `seo` | sì | idem §1 M5, DR-174 |
| DR-192 | 2026-10-18 | Impostazioni `seo.robots_txt` e `seo.sitemap_enabled` (D93) | **Opzione A** — nascoste nel CMS, dato conservato; `robots.txt` fissato da DR-176 | B — rese attive; C — visibili con etichetta «non in uso» | «D93=A» | Proprietario | CMS, impostazioni | sì | idem §1 M7, DR-176 |
| DR-193 | 2026-10-18 | Percorso della categoria dei moduli (D94) | **Opzione A** — nell'importer: termine salvato come `/download-category/…` con l'import di M3/M4 | B — traduzione nell'API a ogni lettura | «D94=A» | Proprietario | importer `terms`, pagina di DR-181 | sì | idem §1 M8, DR-181 |

Nella stessa conversazione: il form visibile su `/registrazione-seminario-autostima-e-assertivita/`
(commentato nella sorgente), emerso nella T3, non si richiede: è già accettato in DR-162.

## 66. Round 57 — risposta del 2026-10-18, T7 della `1E-W7` (round 4)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-194 | 2026-10-18 | Differenze minori dell'hover (D95) | **Opzione A** — freccia, bordo e spaziatura del bottone «Invia» come Divi, glifo `5` aggiunto al sottoinsieme del font; sfondo bianco dei 4 link accettato | B — accettare entrambe; C — riprodurre entrambe allentando il sanitizer | «D95=A» | Proprietario | CSS, font locale, `/contatti/` | sì | `analisi-impatto-T7.md` §3 I1, DR-143 |
| DR-195 | 2026-10-18 | Blocchi con la regola Divi di `srcset`/`sizes` (D96) | **Opzione A** — tutte le immagini con derivate Divi, come il filtro globale della sorgente | B — solo immagini e media+testo | «D96=A» | Proprietario | `packages/blocks`, ricattura delle viste toccate | sì | idem §3 I2, DR-183 |
| DR-196 | 2026-10-18 | `SITE_URL` in produzione (D97) | **Opzione A** — errore chiaro alla prima richiesta se manca, non alla compilazione; variabile nell'ambiente di e2e e CI | B — predefinito con avviso | «D97=A» | Proprietario | sito, e2e, CI, deploy | sì | idem §1 M7, DR-188 |
| DR-197 | 2026-10-18 | Caso D di I2 (D99) | **Opzione B** — accettato come difformità: 2 immagini su `/servizi/` e `/sostegno-alla-genitorialita/`, solo a 390 e 360 px | A — indicatore all'import | «D99=B» | Proprietario | 2 immagini | sì | idem §3 I2 |

Nella stessa risposta l'utente ha chiesto l'attuazione dei gruppi 2 e 3 e l'handoff della migrazione 0007 e dell'import.

## 67. Round 58 — risposta del 2026-10-18, testi delle briciole e conferma di HO-025

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-198 | 2026-10-18 | Testi delle briciole di ricerca e 404 nel JSON-LD (D100) | **Opzione A** — «Risultati della ricerca per «…»» e «404 - Pagina non trovata», correzione voluta (estensione di DR-040) | B — testi inglesi della sorgente | «D100=A» | Proprietario | JSON-LD di ricerca e 404 | sì | `analisi-impatto-T7.md` §9 |

Nella stessa risposta l'utente ha confermato HO-025 (migrazione 0007 e import in locale), per una sola esecuzione.
| DR-199 | 2026-10-18 | Correzione della prova 1E-19 (D101) | **Opzione A** — la prova invia il testo calcolato dai blocchi come il CMS; corretta l'espressione regolare degli spazi nel confronto della data di modifica | B — l'API confronta l'HTML con blocchi senza testo | «D101=A» | Proprietario | prova 1E-19, API contenuti | sì | `analisi-1E-19-HO-026.md` |
| DR-200 | 2026-10-18 | Ripristino della description di `/corsi-2022-2023/` (D102) | **Opzione A** — un solo aggiornamento del campo col valore della copia di HO-026, in transazione | B — `pg_restore --clean` dell'intera copia | «D102=A» | Proprietario | database locale | sì | HO-027 |

Nella stessa risposta l'utente ha confermato HO-027 (ripristino e nuova prova 1E-19 in locale) e la ripresa della voce 4 con cancellazione delle compilazioni sintetiche.
| DR-201 | 2026-10-18 | Salvataggio di contenuti col titolo vuoto (D103) | **Opzione A** — in modifica l'API accetta il titolo vuoto solo per i contenuti che già lo hanno vuoto | B — titolo vuoto per tutti · C — titolo obbligatorio chiesto dall'editor | «D103=A» | Proprietario | API contenuti | sì | `analisi-1E-19-HO-026.md` §6.2 |
| DR-202 | 2026-10-18 | Confronto della prova 1E-19 (D104) | **Opzione A** — HTML senza gli script del payload RSC, più `<head>`, più `modified_at` e `description_source` nel database | B — payload deterministico · C — screenshot | «D104=A» | Proprietario | prova 1E-19 | sì | `analisi-1E-19-HO-026.md` §6.1 |

Nella stessa risposta l'utente ha confermato HO-028: nuova esecuzione di 1E-19, ripresa della voce 4 con cancellazione delle compilazioni sintetiche, e2e, riavvio del sito e report visivo.

## 68. Round 59 — scelte del report «Bozze di parità 1E-W7», 2026-10-18

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-203 | 2026-10-18 | Viste cambiate dopo la T7 (DR-183, DR-195) e pagina nuova di DR-181 | **accettabili tutte**: 25 indirizzi su 25, 50 viste cambiate (48 non superate), nessuna da correggere, nessuna nota | da correggere | scelta «Accettabile» su ogni scheda del report, poi «ho deciso nel report 1E-W7» | Proprietario | sito pubblico, 25 indirizzi | sì | `docs/qa/verifiche/decisioni-report-1E-W7.csv`, artifact «Bozze di parità 1E-W7», DR-162 |

Nella stessa risposta l'utente ha chiesto la ripresa della voce 4 con cancellazione delle compilazioni sintetiche, le prove e2e, il riavvio del sito e la chiusura dell'audit.

## 69. Round 60 — risposta del 2026-10-18, ultime difformità dell'audit della `1E-W7`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-204 | 2026-10-18 | Sfondo bianco del link «Iscrizioni» al passaggio in 4 pagine (D105) | **Opzione A** — difformità accettata, invisibile sul bianco | B — conservare `background-color` in linea sui link, con reimport | «D105=A» | Proprietario | 4 pagine, hover | sì | HO-029, `analisi-impatto-T7.md` §3 I1 |
| DR-205 | 2026-10-18 | Etichetta accessibile del campo di ricerca (D106) | **Opzione A** — etichetta nascosta «Cerca» ora, con prova; A-5 rimisurata | B — dopo la UAT | «D106=A» | Proprietario | testata del sito, A-5 | sì | HO-029, DR-169 |

Nella stessa risposta l'utente ha chiesto la correzione di D106 con prova, la nuova misura di A-5 e la proposta di chiusura della `1E-W7` e del commit.

## 70. Round 61 — risposta del 2026-10-18, chiusura della `1E-W7`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-206 | 2026-10-18 | Chiusura della `1E-W7` e commit delle modifiche | **chiusa**: audit eseguito, difformità approvate o corrette (DR-203…205), commit autorizzato senza push | tenere aperta la wave | «1E-W7: confermo la chiusura della wave e il commit delle modifiche; poi pianifica la 1E-W8» | Proprietario | Fase 1E | sì | `docs/qa/verifiche/audit-1E-W7.md`, `PROGRESS.md` |

## 71. Round 62 — risposta del 2026-10-18, piano della `1E-W8`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-207 | 2026-10-18 | Criteri rieseguiti nell'audit della fase (D107) | **Opzione A** — verifiche brevi rieseguite, quelle lunghe citate con data e commit | B — tutto rieseguito | «D107=A» | Proprietario | `AUDIT.md` della 1E | sì | `W8-PLAN.md` §7 |
| DR-208 | 2026-10-18 | Prova del form nella UAT (D108) | **Opzione A** — l'utente invia un form con dati inventati; la compilazione si cancella dopo, su conferma | B — nessun invio · C — database sintetico degli e2e | «D108=A» | Proprietario | HO-016, database locale | sì | idem, HO-024 |
| DR-209 | 2026-10-18 | Formula dell'approvazione della UAT (D109) | **Opzione A** — «approvo la parità pixel-perfect del sito pubblico, con le difformità accettate elencate nel rapporto» | B — formula attuale più conferma separata | «D109=A» | Proprietario | HO-016, rapporto, gate | sì | idem, `deployment-gate` |

Nella stessa risposta l'utente ha chiesto l'esecuzione della T1 e ha confermato il commit di formattazione e il push.

## 72. Round 63 — risposta del 2026-10-18, UAT di parità (HO-016)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-210 | 2026-10-18 | UAT di parità visiva del sito pubblico (condizione 13 del gate) | **approvata**: «HO-016: approvo la parità pixel-perfect del sito pubblico, con le difformità accettate elencate nel rapporto. Form inviato alle 23:46 ora locale» | non approvare, con elenco di differenze | formula di DR-209 | Proprietario | sito pubblico, gate | sì (una nuova voce può superarla) | `docs/qa/visual-parity-report.md` §12, HO-016, DR-162, DR-203 |

## 73. Round 64 — risposta del 2026-10-19, chiusura della Fase 1E

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-211 | 2026-10-19 | Chiudere la Fase 1E | **chiusa** sulle prove di `AUDIT.md` (27 criteri: 24 superati, 3 approvati con difformità) e sulla UAT di DR-210; CI `39201139144` verde | tenere aperta la fase | «Confermo la chiusura della Fase 1E (aggiornamenti di AUDIT, ROADMAP, phase-plan, PROGRESS), commit e push» | Proprietario | Fase 1E, `ROADMAP.md`, gate (condizioni 6, 9, 10, 13) | sì | `.planning/phases/1E/AUDIT.md`, DR-210 |
| DR-212 | 2026-10-19 | Momento della distruzione dell'istanza di riferimento (HO-017) | **rinviata a dopo la Fase 1G** | distruggerla alla chiusura della 1E | «HO-017 rimandato a dopo la 1G» | Proprietario | istanza di riferimento locale | sì | HO-017, DR-025 |

Nella stessa risposta l'utente ha confermato commit e push e ha chiesto di avviare la pianificazione della Fase 1G.

## 74. Round 65 — pianificazione della Fase 1G, risposte del 2026-10-19 (pagina di grill)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-213 | 2026-10-19 | Perimetro della Fase 1G (D110) | **Opzione B** — prima si colmano le lacune necessarie ai criteri 1G e 1D-28…1D-37, poi collaudo con l'utente, poi correzione dei difetti e ricollaudo | A — solo collaudo · C — tutte le lacune, comprese revisioni, programmazione, form, documenti e caroselli | raccomandazione accettata sulla pagina di grill | Proprietario | Fase 1G | sì | `.planning/phases/1G/DECISIONI-1G.md` |
| DR-214 | 2026-10-19 | Chi esegue i compiti del collaudo (D111) | **Opzione A** — l'utente, nel ruolo di redattore, con un handoff per compito; l'agente prepara, osserva e registra | B — una persona del Centro · C — l'agente con Playwright | raccomandazione accettata sulla pagina di grill | Proprietario | Fase 1G, condizione 7 del gate | sì | `acceptance-criteria.md` §5 |
| DR-215 | 2026-10-19 | Database del collaudo (D112) | **Opzione A** — database separato copiato da quello di sviluppo, compilazioni dei form svuotate nella copia, API e sito dedicati | B — database di sviluppo con copia e ripristino · C — database sintetico degli e2e | raccomandazione accettata sulla pagina di grill | Proprietario | ambiente locale della 1G | sì | DR-210, `privacy-safe-development` |
| DR-216 | 2026-10-19 | Lacune da colmare per i compiti 1G-1…1G-10 (D113) | **A, B, C, D** — registro delle operazioni leggibile con «ultima modifica» nell'editor; anteprima della bozza sul sito pubblico; rigenerazione delle dimensioni derivate alla sostituzione di un media; slug e genitore modificabili con redirect automatico e ricalcolo dei percorsi delle figlie | nessuna | «D113=A,B,C,D» | Proprietario | Fase 1G, `apps/admin`, `apps/api`, `apps/web` | sì | `DECISIONI-1G.md` |
| DR-217 | 2026-10-19 | Altre lacune da colmare (D114) | **A, B, C, D** — estratto e immagine in evidenza nell'editor; assegnazione e gestione delle categorie; eliminazione dei contenuti con conferma; tipi di file ammessi e messaggi in italiano | nessuna | «D114=A,B,C,D» | Proprietario | Fase 1G | sì | idem |
| DR-218 | 2026-10-19 | Che cosa resta non modificabile in Fase 1 (D115) | **Opzione B** — rinviati a dopo il gate revisioni, programmazione, contenuti privati, form e compilazioni, widget della barra laterale, utenti e ruoli; documenti scaricabili e caroselli modificabili nella 1G. La sorte della voce «Persone e permessi» è decisa a parte (D116) | A — tutto rinviato · C — anche revisioni | «D115=B però dimmi quali sono le voci che danno errore 404 così decido se vanno nascoste o risolte» | Proprietario | Fase 1G, perimetro del collaudo | sì | idem |
| DR-219 | 2026-10-19 | Voce «Persone e permessi» dell'area Impostazioni (D116) | **Opzione B** — schermata minima: elenco degli account, crea, disattiva, reimposta password; da sottoporre a revisione di sicurezza | A — nasconderla fino a dopo il gate (era la raccomandazione) · C — sola lettura | scelta sulla pagina di grill | Proprietario | Fase 1G, `apps/admin`, `apps/api`, ADR-007 | sì | `DECISIONI-1G.md`, ADR-007 §3.2 |
| DR-220 | 2026-10-19 | Ruoli in Fase 1 e gestione degli account (D117) | **Opzione B** — due ruoli: «redazione» (contenuti, media, menu, SEO, redirect) e «amministrazione» (impostazioni del sito, persone e permessi, registro), con il nuovo permesso `users.manage` | A — un solo ruolo con tutti i permessi · C — tre ruoli con flusso di approvazione | raccomandazione accettata sulla pagina di grill | Proprietario | Fase 1G, permessi, ADR-007 §3.2 | sì | DR-050, DR-067, DR-219 |
| DR-221 | 2026-10-19 | Significato di «entro un tempo ragionevole» nel collaudo (D118) | **Opzione C** — tempo registrato per ogni compito, non vincolante; oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento | A — nessun limite · B — limite fisso di 10 minuti | raccomandazione accettata sulla pagina di grill | Proprietario | Fase 1G, `acceptance-criteria.md` §5 | sì | DR-214 |

## 75. Round 66 — risposta del 2026-10-19, approvazione del piano della Fase 1G

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-222 | 2026-10-19 | Piano della Fase 1G | **approvato**: `CONTEXT.md` (criteri 1G-1…1G-28) e `PLAN.md` (11 wave) | modificarlo | «Fase 1G: approvo il piano» | Proprietario | Fase 1G | sì | `.planning/phases/1G/CONTEXT.md`, `PLAN.md` |
| DR-223 | 2026-10-19 | Archivio dei media del collaudo (D119) | **Opzione A** — bucket dedicato copiato da quello di sviluppo | B — stesso bucket con copia e ripristino | «D119=A» | Proprietario | ambiente di collaudo, `1G-W7` | sì | DR-215 |
| DR-224 | 2026-10-19 | Deroga ad ADR-007 per la gestione degli account (D120) | **Opzione A** — revisione datata di ADR-007 | B — sola dichiarazione nel `CONTEXT.md` | «D120=A» | Proprietario | ADR-007, `1G-W1` | sì | DR-219 |
| DR-225 | 2026-10-19 | Rigenerazione delle dimensioni derivate (D121) | **Opzione A** — libreria di elaborazione delle immagini in `apps/api`, stesse misure e ritagli dell'import | B — togliere le derivate e servire l'originale | «D121=A» | Proprietario | `apps/api`, `1G-W5`, dipendenza nuova | sì | DR-216 |
| DR-226 | 2026-10-19 | HO-006 aperto dalla 1D (D122) | **Opzione A** — assorbito nel collaudo della `1G-W8` e chiuso lì | B — eseguito prima, a parte | «D122=A» | Proprietario | HO-006, `1G-W8` | sì | DR-214 |

Nella stessa risposta l'utente ha chiesto di chiudere la `1G-W0` con commit e push e di scrivere il piano di dettaglio della `1G-W1`.

## 76. Round 67 — risposta del 2026-10-20, decisioni della `1G-W1`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-227 | 2026-10-20 | Permessi che attuano DR-220 (D123) | **Opzione A** — `users.manage`, `audit.read`, `site.settings.write` nuovi; `settings.write` resta per SEO e redirect e porta solo all'area Redazione; la redazione perde «Impostazioni del sito» | B — solo `users.manage` · C — `users.manage` e `audit.read` | «D123=A» | Proprietario | permessi, aree, `1G-W1` | sì | `W1-PLAN.md` §3, DR-220 |
| DR-228 | 2026-10-20 | Reimpostazione della password senza email (D124) | **Opzione A** — password temporanea generata dal sistema, mostrata una sola volta, sessioni revocate, cambio obbligatorio al primo accesso | B — scritta dall'amministrazione · C — collegamento monouso | «D124=A» | Proprietario | account, `1G-W1` | sì | idem, DR-219 |
| DR-229 | 2026-10-20 | Chiavi dei ruoli (D125) | **Opzione A** — chiave `editor` mantenuta e rietichettata «Redazione»; nuovo ruolo `amministrazione`; seme sintetico allineato | B — rinominare `editor` in `redazione` | «D125=A» | Proprietario | ruoli, seme, `1G-W1` | sì | idem |

Nella stessa risposta l'utente ha chiesto l'esecuzione della `1G-W1` secondo `W1-PLAN.md`, con fermata alle conferme previste.

## 77. Round 68 — risposta del 2026-10-20, decisioni della `1G-W2`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-230 | 2026-10-20 | Che cosa mostra il registro delle operazioni (D126) | **Opzione A** — tutte le righe scritte (modifiche, accessi, cambi d'area, invii dei form del sito, operazioni rifiutate), con filtri e vista predefinita «Modifiche al sito» | B — solo modifiche dall'area amministrativa · C — senza invii dei form | «D126=A» | Proprietario | registro, `1G-W2` | sì | `W2-PLAN.md` §3 |
| DR-231 | 2026-10-20 | Fonte di «ultima modifica di X il Y» (D127) | **Opzione A** — dal registro: ultima operazione riuscita fra creazione, modifica, pubblicazione, ritiro e titolo SEO; copie di lavoro escluse; altrimenti data della sorgente | B — colonna `updated_by` | «D127=A» | Proprietario | editor, `1G-W2` | sì | idem |
| DR-232 | 2026-10-20 | Conservazione delle righe del registro (D128) | **Opzione A** — non decisa nella `1G-W2`; registro append-only senza scadenza; durata portata alla 1F con il parere di chi segue la privacy del Centro | B — durata decisa ora | «D128=A» | Proprietario | registro, privacy, Fase 1F | sì | idem, `CLAUDE.md` §Privacy |

Nella stessa risposta l'utente ha chiesto l'esecuzione della `1G-W2` secondo `W2-PLAN.md`, con fermata alle conferme previste.

## 78. Round 69 — risposta del 2026-10-21, chiusura della `1G-W2`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-233 | 2026-10-21 | Copie di lavoro nella vista «Modifiche al sito» del registro (D129) | **Opzione B** — i salvataggi e gli scarti delle copie di lavoro escono dalla vista predefinita; restano in «Tutte le operazioni» e con il filtro per operazione | A — lasciarli nella vista predefinita (`W2-PLAN.md` §5) | «D129=B» | Proprietario | registro, `1G-W3` (termine: `1G-W7`) | sì | DR-230, `W2-PLAN.md` §5 |

Nella stessa risposta l'utente ha confermato commit e push della `1G-W2` e chiesto il piano di dettaglio della `1G-W3`.

## 79. Round 70 — risposta del 2026-10-21, decisioni della `1G-W3`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-234 | 2026-10-21 | Regole che puntano al vecchio indirizzo di un contenuto spostato (D130) | **Opzione A** — tutte le regole esatte che vi puntano, comprese quelle della migrazione, si riscrivono verso il nuovo indirizzo; «181 invariati» di 1G-11 si legge «le 181 regole restano e ognuna porta in un passo alla pagina giusta» | B — riscritte solo le manuali e automatiche · C — spostamento rifiutato se vi punta una regola della migrazione | «D130=A» | Proprietario | redirect, `1G-W3`, 1G-11 | sì | `W3-PLAN.md` §3 |
| DR-235 | 2026-10-21 | Regole già presenti sugli indirizzi coinvolti (D131) | **Opzione A** — in partenza la regola nascosta dal contenuto prende come destinazione il nuovo indirizzo; in arrivo una regola automatica si toglie, una manuale o della migrazione fa rifiutare lo spostamento con un messaggio che la indica | B — regola nascosta lasciata com'è · C — ogni regola coinvolta modificata o tolta da sé | «D131=A» | Proprietario | redirect, `1G-W3` | sì | idem |
| DR-236 | 2026-10-21 | Riferimenti scritti a mano al vecchio indirizzo (D132) | **Opzione A** — nessuna riscrittura; l'anteprima avvisa se un canonical o una voce di menu personalizzata indica un vecchio indirizzo | B — riscritti canonical e voci di menu · C — come B più i collegamenti nel testo | «D132=A» | Proprietario | editor, SEO, menu, `1G-W3` | sì | idem, 1E-19 |
| DR-237 | 2026-10-21 | Slug di primo livello che il sito usa per sé (D133) | **Opzione A** — rifiutati al primo livello, alla creazione e al cambio d'indirizzo, con messaggio in italiano; nessun contenuto esistente toccato | B — nessun controllo | «D133=A» | Proprietario | contenuti, `1G-W3` | sì | idem |

Nella stessa risposta l'utente ha approvato `W3-PLAN.md` e chiesto l'esecuzione della `1G-W3`, con fermata alle conferme previste.

## 80. Round 71 — risposta del 2026-10-21, decisioni emerse dalle revisioni finali della `1G-W3`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-238 | 2026-10-21 | Ritorno all'indirizzo originale con una regola nascosta riusata al primo spostamento (D134) | **Opzione A** — la regola riusata come redirect automatico diventa `origin = 'automatic'`; al ritorno si toglie come ogni regola automatica | B — origine conservata, regola tolta al ritorno se punta allo stesso contenuto · C — ritorno rifiutato | «D134=A» | Proprietario | redirect, `1G-W3` | sì | `W3-PLAN.md` §10, DR-235 |
| DR-239 | 2026-10-21 | Regola automatica sull'indirizzo d'arrivo di una bozza (D135) | **Opzione A** — si toglie solo se il contenuto che arriva è pubblicato; la conferma dell'editor si apre anche quando il piano riscrive o toglie una regola (S6 esteso) | B — tolta comunque, con conferma estesa · C — come prima | «D135=A» | Proprietario | redirect, editor, `1G-W3` | sì | idem, DR-235 |
| DR-240 | 2026-10-21 | Slug con segmenti di punto e codifiche percentuali (D136) | **Opzione A** — rifiutati: codifiche `%xx` incomplete, slug che decodificato è `.`/`..` o contiene `/`, `\`, caratteri di controllo; slug riservati sulla forma decodificata; controlli di catena e anello su percorsi normalizzati | B — slug ristretto a `[a-z0-9-]` · C — nessun cambio | «D136=A» | Proprietario | contenuti, sicurezza, `1G-W3` | sì | idem, DR-237 |
| DR-241 | 2026-10-21 | Destinazioni `//host` e `/\host` nelle regole manuali (D137) | **Opzione A** — rifiutate nello schema dell'API; sito pubblico e proxy invariati | B — anche il proxy · C — rinvio alla 1F | «D137=A» | Proprietario | redirect manuali, sicurezza, `1G-W3` | sì | idem |
| DR-242 | 2026-10-21 | Permessi del cambio d'indirizzo (D138) | **Opzione A** — oltre a `content.write`, serve `settings.write` quando il piano tocca regole esistenti e `content.publish` quando sposta un contenuto pubblicato | B — solo `content.write` (raccomandazione dell'agente, non scelta) | «D138=A» | Proprietario | permessi, `1G-W3` | sì | idem, ADR-007 |

Nella stessa risposta l'utente ha chiesto l'ondata finale di correzioni e la T6 di `W3-PLAN.md`, con fermata prima del commit.

## 81. Round 72 — risposta del 2026-10-21, decisioni della `1G-W4`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-243 | 2026-10-21 | Dove il sito mostra l'estratto di una notizia (D139) | **Opzione B** — anche archivio e ricerca mostrano l'estratto quando c'è, oltre a «Elenco articoli», feed e meta description; le viste di archivio e ricerca che cambiano sono una difformità di parità da accettare nella `1G-W7` | A — archivio e ricerca con l'inizio del testo, come Divi (raccomandazione dell'agente, non scelta) | «D139=B» | Proprietario | sito pubblico, parità, `1G-W4` (accettazione: `1G-W7`) | sì | `W4-PLAN.md` §3, DR-210, 1G-12, 1G-21 |
| DR-244 | 2026-10-21 | Slug di una categoria (D140) | **Opzione A** — rinominare cambia solo il nome; lo slug si sceglie alla creazione, proposto dal nome, e poi non cambia | B — slug modificabile con redirect 301 automatico · C — slug modificabile senza redirect | «D140=A» | Proprietario | categorie, `1G-W4` | sì | idem, DR-217 B |
| DR-245 | 2026-10-21 | Una notizia senza categoria (D141) | **Opzione A** — per pubblicare una notizia serve almeno una categoria; l'ultima categoria di una notizia pubblicata non si toglie; nessuna categoria predefinita | B — «Senza categoria» come categoria predefinita · C — nessun obbligo | «D141=A» | Proprietario | categorie, pubblicazione, `1G-W4` | sì | idem, D115 |
| DR-246 | 2026-10-21 | Come si elimina un contenuto (D142) | **Opzione A** — eliminazione definitiva; con il contenuto spariscono copia di lavoro, SEO e legami alle categorie; il registro conserva titolo e indirizzo; conferma scrivendo il titolo; per un contenuto pubblicato serve anche `content.publish` | B — definitiva con il solo `content.write` · C — cestino recuperabile | «D142=A» | Proprietario | eliminazione, permessi, `1G-W4` | sì | idem, DR-217 C, DR-242 |
| DR-247 | 2026-10-21 | Che cosa succede a ciò che punta al contenuto eliminato (D143) | **Opzione A** — rifiuto spiegato se ha figlie, se è in un menu (voci elencate, da togliere prima dal menu) o se è la pagina iniziale; le regole di redirect verso il suo indirizzo restano e la conferma le elenca; il suo indirizzo risponde 404 | B — voci di menu tolte insieme al contenuto · C — regole verso il suo indirizzo disattivate | «D143=A» | Proprietario | eliminazione, menu, redirect, `1G-W4` | sì | idem, 1G-13 |

Nella stessa risposta l'utente ha approvato `W4-PLAN.md` e chiesto l'esecuzione della `1G-W4`, con fermata alle conferme previste.

## 82. Round 73 — risposta del 2026-10-22, chiusura della `1G-W4`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-248 | 2026-10-22 | Estratti delle pagine nei risultati della ricerca (D144) | **Opzione B** — l'estratto in archivio e ricerca vale solo per le notizie; le pagine nella ricerca tornano all'inizio del testo, con una nuova cattura delle viste interessate | A — estratti delle pagine mostrati come farebbe Divi · C — estratti mostrati e campo «Estratto» anche per le pagine | «D144=B» | Proprietario | sito pubblico, ricerca, parità, `1G-W5` | sì | DR-243, `W4-PLAN.md` S10, `visual-parity-report.md` §13.1 |

Nella stessa risposta l'utente ha confermato commit e push della `1G-W4`.

## 83. Round 74 — risposta del 2026-10-23, decisioni della `1G-W5`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-249 | 2026-10-23 | Quando nascono le dimensioni derivate e che cosa resta dell'originale (D145) | **Opzione A** — al caricamento e alla sostituzione, tutte le misure di WordPress e Divi dell'import; originale oltre 2560 px ridotto a 2560 sul lato lungo; originale riscritto senza i metadati della fotocamera (posizione compresa), con l'orientamento applicato | B — originale fino a 2560 px conservato byte per byte · C — derivate solo alla sostituzione | «D145=A» | Proprietario | media, privacy, `1G-W5` | sì | `W5-PLAN.md` §3, DR-225, `W4-PLAN.md` §6 caso 4 |
| DR-250 | 2026-10-23 | Derivate citate dai contenuti che la sostituzione farebbe sparire (D146) | **Opzione A** — rifiuto spiegato prima di scrivere, `409 MEDIA_VARIANT_IN_USE` con i titoli dei contenuti; nessun contenuto cambia da solo | B — riscrittura automatica dei blocchi · C — nessun controllo | «D146=A» | Proprietario | media, contenuti, `1G-W5` | sì | idem, DR-074 |
| DR-251 | 2026-10-23 | Tipi di file ammessi e limiti di peso (D147) | **Opzione A** — JPEG, PNG, WebP fino a 20 MB e 50 milioni di pixel; PDF fino a 20 MB; MP4 fino a 100 MB; SVG e HTML esclusi | B — solo i tipi presenti, limite unico 64 MB · C — anche GIF e documenti Office, limite unico 100 MB | «D147=A» | Proprietario | media, `1G-W5`, `1G-W6`, 1G-14 | sì | idem, DR-217 D |
| DR-252 | 2026-10-23 | Come si raggiunge l'anteprima sul sito (D148) | **Opzione A** — con la sessione dell'area amministrativa: `/anteprima/<id>/` solo per chi è entrato in Redazione con `content.read`, `404` per chiunque altro | B — collegamento firmato con scadenza · C — entrambi | «D148=A» | Proprietario | sito pubblico, sessioni, `1G-W5`, 1G-19 | sì | idem, DR-216 B, ADR-007, ADR-008 |
| DR-253 | 2026-10-23 | Cache dei file dei media dopo una sostituzione (D149) | **Opzione A** — subito `Cache-Control: no-cache` sui file dei media; la politica definitiva resta alla 1F | B — nessuna intestazione fino alla 1F · C — `max-age=300` | «D149=A» | Proprietario | media, cache, `1G-W5` (politica definitiva: Fase 1F) | sì | idem, DR-074, 1G-5 |

Nella stessa risposta l'utente ha approvato `W5-PLAN.md` e chiesto l'esecuzione della `1G-W5`, con fermata alle conferme previste.

## 84. Round 75 — risposta del 2026-10-23, decisioni emerse dalle revisioni finali della `1G-W5`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-254 | 2026-10-23 | Metadati di video e PDF caricati dal CMS (D150) | **Opzione B** — ripulire MP4 e PDF dai metadati (posizione, autore) con uno strumento nuovo, da scegliere con una ADR e una dipendenza dichiarata; da pianificare prima della `1G-W7` | A — MP4 con posizione rifiutati, PDF invariati (raccomandazione dell'agente, non scelta) · C — nessun controllo, rischio dichiarato | «D150=B» | Proprietario | media, privacy, dipendenze, ADR (termine: prima della `1G-W7`) | sì | `W5-PLAN.md` §9, DR-249, revisione di sicurezza della `1G-W5` (MEDIUM-3) |
| DR-255 | 2026-10-23 | Aggiornamento di `next` 16.3.5, con avvisi di sicurezza critici (D151) | **Opzione A** — aggiornare a ≥ 16.4.1 all'inizio della `1G-W7`, prima del confronto visivo integrale | B — disattivare subito `/_next/image` e aggiornare nella 1F · C — tutto alla 1F | «D151=A» | Proprietario | sito, area, dipendenze, `1G-W7` | sì | revisione di sicurezza della `1G-W5`, 1G-21 |
| DR-256 | 2026-10-23 | Regressione N1 nata dall'ultimo giro di correzioni della `1G-W5` (D152) | **Opzione A** — correzione mirata subito: la traduzione degli errori di caricamento vale solo per i caricamenti dei media, con prova che un errore di un'altra rotta resti 500 e vada nel log | B — correzione nella `1G-W6` · C — togliere la traduzione per parola chiave | «D152=A» | Proprietario | API, gestione degli errori, `1G-W5` | sì | ri-revisione del giro finale della `1G-W5` |

Nella stessa risposta l'utente ha chiesto di correggere N1 e chiudere la `1G-W5`, con fermata prima del commit. La stessa risposta dichiara HO-031 eseguito con gli esiti del modello («N/N»): nel repository e nel database non ce n'è traccia (nessuna copia di salvataggio, nessun file di esiti, nessun accesso dell'account di prova), quindi HO-031 resta aperto.

## 85. Round 76 — risposta del 2026-10-26, decisioni della `1G-W6`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-257 | 2026-10-26 | Caroselli modificabili, con effetto sul sito (D153) | **Opzione B** — schermata dei caroselli (sostituire, aggiungere, togliere e riordinare le immagini, testo di ciascuna) **e** blocco «Presentazione a scorrimento» inseribile nell'editor, che sceglie un carosello esistente; per questo solo blocco cade l'esclusione di `CONTEXT.md` §1 | A — caroselli tolti dalla 1G, «presenti nei dati, non pubblicati» (raccomandazione dell'agente, non scelta) · C — solo la schermata, senza blocco | «D153=B» | Proprietario | API, area amministrativa, editor, `CONTEXT.md` §1, `1G-W6`, 1G-15 | sì | `W6-PLAN.md` §2.3, §3.1; DR-218, DR-123 |
| DR-258 | 2026-10-26 | Strumento per ripulire PDF e MP4 dai metadati (D154) | **Opzione A** — due programmi esterni chiamati dall'API in un processo separato: `qpdf` riscrive il PDF senza Info né XMP, `ffmpeg` ricompone l'MP4 copiando le sole tracce audio e video, senza ricodifica e senza metadati; installati in sviluppo, in CI e nell'immagine della 1F; ADR-012 | B — solo pacchetti npm (`@cantoo/pdf-lib` e codice del progetto per l'MP4) · C — `exiftool` per l'MP4 e `qpdf` per il PDF | «D154=A» | Proprietario | API dei media, CI, ambiente di sviluppo, immagine della 1F, ADR-012; licenze da far verificare a una persona | sì | `W6-PLAN.md` §2.4, §3.1, S9-S13; DR-254 |
| DR-259 | 2026-10-26 | Quali PDF e MP4 si ripuliscono (D155) | **Opzione C** — solo quelli caricati o sostituiti dal CMS da ora in poi; gli importati restano byte per byte; in più una misura in sola lettura, solo numeri e mai valori, di quanti PDF e MP4 pubblici importati contengono autore, programma, date o posizione. Sugli importati si decide con quei numeri, prima della 1F | A — solo i nuovi, senza misura · B — anche gli importati, una volta sola, con copia e conferma | «D155=C» | Proprietario | media, privacy, `1G-W6` (decisione sugli importati: prima della 1F) | sì | `W6-PLAN.md` S14; DR-254 |
| DR-260 | 2026-10-26 | Documenti scaricabili: campi modificabili e data mostrata (D156) | **Opzione A** — titolo, descrizione e file; «Ultimo aggiornamento» mostra la data dell'ultima modifica fatta dal CMS, da una colonna nuova `documents.modified_at`, vuota per i 4 importati, che quindi restano identici; migrazione `0009` | B — solo titolo e file, date invariate · C — titolo, descrizione e file, date invariate | «D156=A» | Proprietario | API, sito pubblico, area amministrativa, schema (migrazione `0009`), `1G-W6` | sì | `W6-PLAN.md` §2.1, S1-S5; DR-218 |
| DR-261 | 2026-10-26 | Rilievi minori residui della `1G-W5` (D157) | **Opzione A** — nella `1G-W6` solo quelli sulle rotte che la wave tocca di nuovo: N3 (`429` in inglese), il messaggio «Preamble terminated early», N6 (chiave nel log degli errori dell'archivio). Gli altri (N2, tempo scaduto dell'archivio, N4, N5, sessione lasciata aperta da `prova-1e-19.ts`) restano elencati per la `1G-W9` o la 1F | B — tutti nella `1G-W6` · C — nessuno | «D157=A» | Proprietario | API dei media, log, `1G-W6`, `1G-W9`, 1F | sì | `W6-PLAN.md` §3.1, T6; revisioni finali della `1G-W5` |

Nella stessa risposta l'utente ha approvato `W6-PLAN.md`, confermato la cancellazione della cartella di lavoro della `1G-W5` (eseguita il 2026-10-26) e chiesto l'esecuzione della `1G-W6`, con fermata alle conferme previste.

## 86. Round 77 — risposta del 2026-10-26, `qpdf` in CI per la `1G-W6`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-262 | 2026-10-26 | Da dove prende la CI un `qpdf` con `--remove-info` e `--remove-metadata`, che esistono dalla 11.10.0 mentre Ubuntu 24.04 distribuisce la 11.9.0 (D158) | **Opzione A** — la CI resta su `ubuntu-24.04` e scarica il binario ufficiale `qpdf-12.4.2-bin-linux-x86_64.zip` dalla release di qpdf, con l'impronta SHA-256 scritta nel flusso e controllata prima dell'uso; ADR-012 fissa come minimo la 11.10 | B — CI su `ubuntu-26.04` (anteprima pubblica) con `qpdf` 12.3.2 da apt · C — `qpdf` 11.9 da apt e rimozione di Info e XMP con la modalità JSON | «D158=A» | Proprietario | CI, ADR-012, `1G-W6` | sì | `W6-PLAN.md` T5, §9; DR-258 |

Nella stessa risposta l'utente ha dichiarato HO-032 eseguito (`qpdf version 12.4.2`), ha confermato HO-033 (migrazione `0009` sul database di sviluppo, eseguita il 2026-10-26 con copia `amoris-prima-HO-033-2026-10-26.dump`) e ha chiesto di proseguire la `1G-W6` con fermata prima del commit.

## 87. Round 78 — risposta del 2026-10-26, decisioni dalla revisione di sicurezza della `1G-W6`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-263 | 2026-10-26 | Limite di memoria di `qpdf` e `ffmpeg` (D159) | **Opzione A** — nell'immagine della 1F i due programmi girano in un contenitore separato, con un limite di memoria (ordine di grandezza 1 GB), senza rete e con un utente dedicato; oltre il limite il file si rifiuta | B — limite per processo dentro l'API (`prlimit`, solo Linux) e tempo dei PDF a 15 s · C — nessun limite | «D159=A» | Proprietario | immagine della 1F, ADR-012 (termine: prima della pianificazione della 1F) | sì | revisione di sicurezza della `1G-W6` (M1); ADR-012 |
| DR-264 | 2026-10-26 | Codec video ammessi nei caricamenti (D160) | **Opzione A** — solo `h264`, `hevc` e `aac`; gli altri MP4 si rifiutano con «file non valido» | B — elenco largo (`h264`, `hevc`, `av1`, `vp9`, `aac`, `mp3`, `opus`) · C — nessun elenco | «D160=A» | Proprietario | API dei media, ADR-012 (termine: prima della 1F) | sì | revisione di sicurezza della `1G-W6` (M2); ADR-012 |

Nella stessa risposta l'utente ha confermato commit e push della `1G-W6` e la cancellazione della cartella di lavoro della wave dopo il push, e ha chiesto il piano della `1G-W7`.

## 88. Round 79 — risposta del 2026-10-26, decisioni della `1G-W7`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-265 | 2026-10-26 | Dove si eseguono 1E-19 e la prova dell'anteprima, che entrano con un account e scrivono 4 salvataggi (D161) | **Opzione A** — sull'ambiente di collaudo appena creato, eseguite dall'utente con l'account sintetico di Redazione (HO-035); prima della `1G-W8` l'ambiente si ripristina, così i 4 salvataggi non restano nel collaudo | B — sul database di sviluppo, con copia di salvataggio · C — su una terza copia temporanea del database | «D161=A» | Proprietario | collaudo, database di collaudo, `1G-W7`, `1G-W8`, 1G-22 | sì | `W7-PLAN.md` §2.3, §3.1; HO-031 |
| DR-266 | 2026-10-26 | Come convivono ambiente di sviluppo e ambiente di collaudo (D162) | **Opzione A** — copia di lavoro Git separata (`git worktree`, fuori dal repository) fissata sul commit da collaudare, con installazione e compilazioni proprie; porte 3300 (sito), 3301 (area), 3302 (API); database `amoris_collaudo` nello stesso Postgres; bucket `collaudo-public` e `collaudo-private` nello stesso MinIO; durante il collaudo i server di sviluppo si spengono | B — stessa copia di lavoro con cartella di compilazione configurabile · C — nessuna separazione, compilazioni rifatte | «D162=A» | Proprietario | ambiente di collaudo, `tools/collaudo/`, `1G-W7`, `1G-W8` | sì | `W7-PLAN.md` §2.4, §3.1, §5; DR-215, DR-223 |
| DR-267 | 2026-10-26 | Che cosa conta come vista peggiorata nel confronto integrale (D163) | **Opzione A** — invariata se identica byte per byte all'ultima cattura accettata; altrimenti non peggiorata se la differenza dal riferimento non supera la percentuale accettata, peggiorata se la supera anche di poco; le peggiorate bloccano finché non sono corrette o accettate dall'utente una per una | B — ogni vista non identica mostrata per l'accettazione · C — come A con tolleranza di 0,05 punti | «D163=A» | Proprietario | parità visiva, `1G-W7`, 1G-21 | sì | `W7-PLAN.md` §2.3, §3.1, S5; DR-162, DR-203, `audit-1E-W7.md` |

Nella stessa risposta l'utente ha approvato `W7-PLAN.md` e chiesto l'esecuzione della `1G-W7`, con fermata alle conferme previste.

## 89. Round 80 — risposta del 2026-10-27, prima fermata della `1G-W7`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-268 | 2026-10-27 | Da dove prende `ffmpeg` la CI, dopo due corse annullate per `apt` lento (D164) | **Opzione A** — binario statico di versione fissa scaricato da GitHub con l'impronta SHA-256 controllata, come `qpdf`; `runs-on: ubuntu-24.04` | B — `apt` con limite a 60 minuti · C — `apt` con cache dei pacchetti | «D164=A» | Proprietario | CI, ADR-012 | sì | DR-262, `W7-PLAN.md` S11 |
| DR-269 | 2026-10-27 | Testi dell'area che dicono «la schermata dei media non esiste ancora» (D165) | **Opzione A** — corretti prima del commit su cui nasce il collaudo | B — alla `1G-W9` | «D165=A» | Proprietario | area amministrativa, `1G-W7` | sì | `docs/qa/contenuto-nel-codice.md`, T6 |
| DR-270 | 2026-10-27 | Impostazioni modificabili che il sito non legge: lingua, fuso orario, formati di data e ora, primo giorno della settimana, articoli per pagina (D166) | **Opzione C** — il sito le legge e ne applica l'effetto | A — dichiarate senza effetto in Fase 1 (raccomandazione dell'agente, non scelta) · B — nascoste nell'area | «D166=C» | Proprietario | sito pubblico, API, `1G-W7` (codice prima della cattura integrale) | sì | `contenuto-nel-codice.md` D4 |
| DR-271 | 2026-10-27 | Testi del sito scritti nel codice (D1-D7) e campi non offerti fuori da DR-218 (D167) | **Opzione B** — decisi voce per voce adesso | A — dopo il collaudo (raccomandazione dell'agente, non scelta) | «D167=B» | Proprietario | sito pubblico, area, matrice, `1G-W7` | sì | `contenuto-nel-codice.md` «Da decidere», `editability-matrix.csv` |
| DR-272 | 2026-10-27 | Pianificare la 1F durante il collaudo (D168) | **Opzione A** — sì, solo pianificazione (staging, provider e costi, backup e ripristino), senza acquisti né deploy | B — dopo l'approvazione della 1G | «D168=S» (letto come «sì») | Proprietario | Fase 1F | sì | ROADMAP, `phase-plan.md` §5 |

Nella stessa risposta l'utente ha dichiarato HO-053 fatto (9,2 GB liberi) e confermato commit e push del codice della wave e HO-034 (prova sui nomi di prova, poi creazione vera).

## 90. Round 81 — risposta del 2026-10-27, testi del sito scritti nel codice (D167 = B, round 1)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-273 | 2026-10-27 | Nome del sito scritto a mano nel titolo di riserva e nella 404 (D169, voce D1) | **Opzione A** — letto da «Titolo del sito» nelle impostazioni | B — fisso, dichiarato | «D169=A» | Proprietario | sito pubblico, `1G-W7` | sì | `contenuto-nel-codice.md` D1 |
| DR-274 | 2026-10-27 | Testi del tema: ricerca, paginazione, nessun risultato, 404 (D170, voce D2) | **Opzione A** — fissi, non modificabili in Fase 1, come nella sorgente | B — sezione «Testi del sito» | «D170=A» | Proprietario | sito pubblico, matrice | sì | idem D2 |
| DR-275 | 2026-10-27 | Etichette della scheda di un documento (D171, voce D3) | **Opzione A** — fisse, non modificabili in Fase 1 | B — etichetta del pulsante per documento | «D171=A» | Proprietario | sito pubblico, matrice | sì | idem D3 |
| DR-276 | 2026-10-27 | Etichette delle briciole nel JSON-LD (D172, voce D5) | **Opzione A** — fisse, non modificabili in Fase 1 | B — campi dei modelli SEO | «D172=A» | Proprietario | metadati, matrice | sì | idem D5 |
| DR-277 | 2026-10-27 | Testi dei moduli di contatto (D173, voci D6 e D7) | **Opzione A** — sotto-etichette fisse (DR-218); selettore del prefisso telefonico verificato nel browser e tradotto in italiano ora se in inglese | B — selettore alla `1G-W9` · C — sotto-etichette modificabili | «D173=A» | Proprietario | sito pubblico, moduli, `1G-W7` | sì | idem D6, D7 |

## 91. Round 82 — risposta del 2026-10-27, campi dell'area e decisioni nuove della `1G-W7`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-278 | 2026-10-27 | Campi di pagine e notizie senza interfaccia (D174) | **Opzione C** — modificabili tutti e cinque: mostrare il titolo, notizia in primo piano, immagine in evidenza delle pagine, larghezza dello spazio fra le colonne, tipo di dati strutturati (contenuto e modello SEO) | A — tutti dichiarati · B — solo titolo e primo piano (raccomandazione dell'agente, non scelta) | «D174=C» | Proprietario | area, API, sito, `1G-W7` | sì | `editability-matrix.csv` righe 15-17, 20, 49, 125 |
| DR-279 | 2026-10-27 | Configurazione dei blocchi «Video», «Mappa», «Documento» (D175) | **Opzione B** — pannello di configurazione nell'editor | A — dichiarata non modificabile (raccomandazione dell'agente, non scelta) | «D175=B» | Proprietario | editor, sito, sicurezza degli embed, privacy | sì | righe 32, 34 |
| DR-280 | 2026-10-27 | Categorie: descrizione, genitore, SEO dell'archivio, eliminazione (D176) | **Opzione C** — tutto modificabile | A — tutto dichiarato · B — solo «Elimina» (raccomandazione dell'agente, non scelta) | «D176=C» | Proprietario | API, area, sito, redirect | sì | righe 53-56 |
| DR-281 | 2026-10-27 | Documenti: creazione ed eliminazione (D177) | **Opzione B** — creazione ed eliminazione di un documento con titolo, file e categoria; menu e caroselli: creazione e campi secondari dichiarati non modificabili in Fase 1 | A — tutto dichiarato | «D177=B» | Proprietario | API, area, sito `/download/` | sì | righe 57-58, 91-93, 101-103 |
| DR-282 | 2026-10-27 | Impostazioni e account senza interfaccia (D178) | **Opzione B** — nome ed email di un account modificabili da «Persone e permessi»; `robots.txt`, sitemap e chiavi nuove dichiarati non modificabili in Fase 1 | A — tutto dichiarato (raccomandazione dell'agente, non scelta) | «D178=B» | Proprietario | API, area, sicurezza, dati personali | sì | righe 118, 120, 130 |
| DR-283 | 2026-10-27 | Inserire immagini nuove dall'editor (D179) | **Opzione A** — blocco «Immagine» inseribile con il selettore dei media e il testo alternativo; video, mappa, modulo, documento non inseribili con motivo vero | B — solo testo corretto | «D179=A» | Proprietario | editor, `1G-W7` | sì | `tree.ts:48-49` |
| DR-284 | 2026-10-27 | Attuazione di DR-273, nome del sito nella 404 (D180) | **Opzione A** — interruttore documentato di Next (`htmlLimitedBots`) perché i metadati arrivino prima della pagina, e titoli letti dalle impostazioni | B — rinuncia | «D180=A» | Proprietario | sito, configurazione di Next | sì | DR-273 |
| DR-285 | 2026-10-27 | Date pubblicate quando cambia il fuso (D181) | **Opzione B** — tutte le date si mostrano nel fuso scelto; difformità dichiarata rispetto a WordPress | A — come WordPress | «D181=B» | Proprietario | sito, parità | sì | DR-270 |

Nella stessa risposta l'utente ha chiesto che ogni round finisca con la tabella dello stato delle fasi e il prompt successivo.

## 92. Round 83 — risposta del 2026-10-27, migrazione `0010` e titolo delle notizie

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-286 | 2026-10-27 | Due notizie che in WordPress nascondevano il titolo (D182) | **Opzione A** — «Mostra il titolo» vale anche per le notizie; le due tornano senza titolo come nella sorgente | B — solo pagine, difformità dichiarata | «D182=A» | Proprietario | sito pubblico, parità, `1G-W7` | sì | DR-278, rapporto della T2e |

Nella stessa risposta l'utente ha confermato la migrazione `0010` sul database di sviluppo con copia di sicurezza (eseguita il 2026-10-27: copia `amoris-prima-0010-2026-10-27.dump`, 468.284 byte, 34 tabelle; migrazioni 10 → 11; colonna vuota; altri conteggi invariati).

## 93. Round 84 — risposta del 2026-10-27, blocco «Documento» e propria email

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-287 | 2026-10-27 | Resa del blocco «Documento» (D183) | **Opzione A** — sul sito il blocco porta alla scheda `/download/<slug>/` e diventa inseribile dall'editor | B — resta com'è, non inseribile, scelta del documento tolta | «D183=A» | Proprietario | sito pubblico, editor, `1G-W7` | sì | DR-279 |
| DR-288 | 2026-10-27 | Modifiche al proprio account (D184) | **Opzione C** — la password attuale si chiede per **ogni** modifica al proprio account, compresa la reimpostazione della propria password | A — come oggi con condizione per il recupero via email; B — password solo per la propria email | «D184=C» | Proprietario | area, API degli account, ADR-007, `1G-W7` | sì | DR-282, ADR-007 |

## 94. Round 85 — risposta del 2026-10-27, viste cambiate dalla Fase 1G

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-289 | 2026-10-27 | Accettazione nominativa delle viste cambiate dalla Fase 1G (1G-21) | **Accettate tutte e 18**: le 12 del §13 (DR-243, DR-248: estratti in `/category/news/` pagine 1-3 e `/?s=corso`) e le 6 del §14 (DR-286: titolo e data tolti dalle due notizie che nella sorgente li nascondevano) | accettare solo il §14; non accettare | «Accetto tutte e 18» | Proprietario | sito pubblico, parità, `1G-W7` | sì | `visual-parity-report.md` §13-14, `confronto/esiti-1G-W7.csv`, DR-210 |

## 95. Round 86 — risposta del 2026-10-28, chi esegue il collaudo

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-290 | 2026-10-28 | Chi esegue i compiti rimasti del collaudo (D185, modifica DR-214) | **Tutto all'agente** — l'agente esegue con Playwright i compiti e le prove accessorie di HO-038 (mappa), da HO-039 a HO-052; HO-036 e HO-037 restano eseguiti dall'utente. La condizione 7 non contiene più la prova che la redazione riesce da sola nei compiti eseguiti dall'agente: indebolimento del gate accettato esplicitamente | ibrido (agente per la verifica, utente per 1G-4…1G-9); sospendere il collaudo | «Il collaudo è troppo lungo per i tempi che ho a disposizione oggi e domani»; scelta «Tutto all'agente» | Proprietario | Fase 1G, condizione 7 del gate, `acceptance-criteria.md` §5 | sì | DR-214, DR-221 |
| DR-291 | 2026-10-28 | Account con cui l'agente entra nell'area del collaudo (D186) | **Account dell'agente** — due account sintetici solo sul collaudo, `@example.invalid`, password generate a caso e conservate in `C:\work\amoris-collaudo.stato`, fuori da Git e mai stampate | usare gli account dell'utente | scelta «Account agente» | Proprietario | ambiente di collaudo | sì | DR-290, HO-034 |

## 96. Round 87 — risposta del 2026-10-28, chiusura del collaudo

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-292 | 2026-10-28 | Campi della matrice con compito ma non verificati nel collaudo (D187) | **Passata di copertura** — un agente verifica con Playwright i 16 campi rimasti e riporta lo stato iniziale, prima della chiusura della `1G-W8` | chiudere con 16 righe «non verificato» | scelta «Passata di copertura» | Proprietario | `1G-W8`, `editability-matrix.csv` | sì | DR-290 |
| DR-293 | 2026-10-28 | «Salva» e «Salva il layout» su un contenuto pubblicato (D188, W8-13) | **Lasciare com'è, ma dirlo** — continuano ad aggiornare subito il sito; il pulsante diventa «Salva e aggiorna il sito» con un avviso, e HO-045 §4.2 si corregge | «Salva» solo nella copia di lavoro; lasciare tutto com'è | scelta «Lasciare com'è, ma dirlo» | Proprietario | editor, `1G-W9`, HO-045 | sì | DR-068 |
| DR-294 | 2026-10-28 | Cambiare l'immagine di un blocco Immagine (D189, W8-06) | **«Cambia immagine» nel blocco** — l'ispettore apre il selettore e chiede il testo alternativo; il cambio vale solo per quel blocco; «Sostituisci il file» in Media resta per cambiarlo ovunque | solo da Media, con l'avviso migliorato | scelta «Cambia immagine» | Proprietario | editor, `1G-W9` | sì | DR-283 |

## 97. Round 88 — risposta del 2026-10-28, pianificazione della 1F (DR-272)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-295 | 2026-10-28 | Fornitore del server (D6a) | **Rinviata a un confronto** fra Hetzner, un fornitore italiano e OVH, con prezzi, collocazione dei dati, DPA e backup; verificare che le VPS di OVH siano davvero disponibili in Europa | scegliere subito Hetzner, un fornitore italiano o OVH | «Prepara un confronto tra i 3 fornitori. Verifica che le VPS di OVH siano effettivamente disponibili in Europa» | Proprietario | Fase 1F, ADR-009 §6 | sì | D6, ADR-009 |
| DR-296 | 2026-10-28 | Forma dello staging (D190) | **Stesso server, progetto separato** — porte, database e volumi propri sul VPS di produzione | server piccolo separato; solo in locale | scelta «Stesso server, progetto separato» | Proprietario | Fase 1F | sì | ADR-009 |
| DR-297 | 2026-10-28 | Storage a oggetti in produzione (D191) | **MinIO sullo stesso server**, come in sviluppo; backup a nostro carico | S3 gestito in UE | scelta raccomandata | Proprietario | Fase 1F, ADR-009 §4.2 | sì | DR-005, ADR-004 |
| DR-298 | 2026-10-28 | Destinazione dei backup fuori dal server (D192) | **Altro fornitore UE, backup cifrati prima dell'invio**, con la chiave custodita dall'utente | stesso fornitore con servizio separato; disco o NAS del Centro | scelta raccomandata | Proprietario | Fase 1F, ADR-009 §4.5 | sì | RN-05 |

## 98. Round 89 — risposta del 2026-10-28, chiusura della `1G-W8`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-299 | 2026-10-28 | Chiusura della `1G-W8` con il criterio 1G-24 non soddisfatto | **Chiusa**, con 1G-24 (nessun errore in console) rinviato alla `1G-W9` insieme a W8-09 e W8-32; commit e push dei documenti confermati | tenere aperta la wave fino alla correzione | «Approvo la chiusura della 1G-W8 (1G-24 alla 1G-W9) e confermo commit e push dei documenti» | Proprietario | `1G-W8`, `1G-W9`, `acceptance-criteria.md` | sì | `collaudo-1G-W8.md` §3, DR-290, DR-292 |

## 99. Round 90 — risposta del 2026-10-28, secondo round della 1F

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-300 | 2026-10-28 | Dominio, DNS e Cloudflare (D193) | **Opzione A** — dominio e DNS restano su Aruba, senza Cloudflare; al passaggio si cambiano solo i record A/AAAA, la posta non si tocca | B — DNS presso il fornitore del server · C — DNS su Cloudflare senza proxy | «D193=A» | Proprietario | Fase 1F, ADR-009 §6 punti 2-3 | sì | DR-107 |
| DR-301 | 2026-10-28 | Invio delle email dei moduli (D194) | **Opzione A** — SMTP di Aruba con una casella del Centro | B — servizio transazionale UE · C — server di posta proprio | «D194=A» | Proprietario | Fase 1F, ADR-010 §4.5 | sì | DR-032 |
| DR-302 | 2026-10-28 | Costi ricorrenti (D195) | **Opzione A** — contratti e account intestati al Centro, che paga | B — l'utente paga e rifattura · C — intestati al Centro, anticipo dell'utente | «D195=A» | Proprietario | Fase 1F, ADR-009 §6 punto 6 | sì | DR-295 |
| DR-303 | 2026-10-28 | Tempi della verifica privacy e legale MI-06 (D196) | **Opzione A** — subito, in parallelo con la `1G-W9` e la pianificazione della 1F, con un documento di ambito preparato dall'agente senza dati reali | B — a staging pronto · C — subito prima della produzione | «D196=A» | Proprietario | MI-06, Fase 1F | sì | DR-073, DR-107 |
| DR-304 | 2026-10-28 | Piano della `1G-W9` | **Approvato** `W9-PLAN.md`; si eseguono T0 e T3-T8, D197-D200 al prossimo round | — | «Approvo W9-PLAN.md» | Proprietario | `1G-W9` | sì | DR-299 |

## 100. Round 91 — risposta del 2026-10-28, decisioni della `1G-W9`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-305 | 2026-10-28 | Testo alternativo e didascalia di Media (D197, W8-10) | **Opzione B** — se il blocco li lascia vuoti il sito usa quelli di Media anche dopo; il blocco li sovrascrive solo se compilati; «decorativa» salvata a parte | A — come WordPress, solo proposti all'inserimento · C — Media prevale sempre | «D197=B» | Proprietario | editor, sito, `1G-W9` T1 | sì | DR-283 |
| DR-306 | 2026-10-28 | Voci di menu riservate (D198, W8-14) | **Opzione A** — le opzioni restano; l'aiuto dice che oggi nessun visitatore vede quelle voci | B — tolte, 3 voci a «Nascosta» · C — visibili a chi è in Redazione | «D198=A» | Proprietario | menu, `1G-W9` T2 | sì | — |
| DR-307 | 2026-10-28 | Titoli delle slide con HTML importato (D199, W8-26) | **Opzione A** — il sito rende un sottoinsieme ammesso (a capo, centratura, icona) come la sorgente; l'editor lo mostra formattato; revisione di sicurezza | B — testo semplice con difformità | «D199=A» | Proprietario | sito, caroselli, `1G-W9` T2 | sì | — |
| DR-308 | 2026-10-28 | Contatore degli usi dei redirect (D200, W8-18) | **Opzione A** — contatore e data aggiornati a ogni uso, senza far attendere il visitatore | B — colonne tolte | «D200=A» | Proprietario | redirect, `1G-W9` T2 | sì | — |
| DR-309 | 2026-10-28 | Documento di ambito MI-06, §3.6 sull'assistente di programmazione | **Resta** nel documento | toglierlo | «Documento MI-06: lascia il §3.6» | Proprietario | MI-06, HO-054 | sì | DR-303 |

## 101. Round 92 — risposta del 2026-10-28, compilazioni dei moduli

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-310 | 2026-10-28 | Leggere le compilazioni dei moduli (D201) | **Opzione A** — schermata «Compilazioni» in sola lettura (elenco e dettaglio), permesso nuovo al solo amministratore, ogni consultazione nel registro; nella Fase 1F, prima della produzione e dopo il parere MI-06 | B — subito nella `1G-W9` · C — nessuna schermata, solo email | «D201=A» | Proprietario | Fase 1F, ADR-010 §4.5-4.6, permessi | sì | DR-301, DR-303, MI-06 |

## 102. Round 93 — risposta del 2026-10-29, decisioni emerse dalle revisioni della `1G-W9`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-311 | 2026-10-29 | Cuore nei titoli delle slide (D202, W8-26) | **Opzione A** — sottoinsieme locale di Font Awesome con il solo cuore, licenza da verificare | B — glifo del font Divi · C — carattere ♥ di sistema · D — difformità accettata | «D202=A» | Proprietario | sito, caroselli, `1G-W9` | sì | DR-307 |
| DR-312 | 2026-10-29 | Didascalia del media sui blocchi Immagine importati (D203, W8-10) | **Opzione B** — i blocchi importati non usano la didascalia del media (indicatore messo dall'importatore e sui blocchi già importati) | A — differenza accettata · C — didascalia tolta dal media | «D203=B» | Proprietario | sito, importatore, `1G-W9` | sì | DR-305 |
| DR-313 | 2026-10-29 | Titolo del media come riserva (D204, W8-12) | **Opzione A** — vale solo il titolo del blocco; l'aiuto di Media lo dice | B — riserva per i soli blocchi nuovi · C — riserva sempre | «D204=A» | Proprietario | sito, Media, `1G-W9` | sì | DR-305 |
| DR-314 | 2026-10-29 | Ritiro della pagina iniziale (D205) | **Opzione A** — ritirare la pagina iniziale è bloccato come eliminarla | B — lasciare com'è | «D205=A» | Proprietario | API dei contenuti, editor, `1G-W9` | sì | W8-38 |
| DR-315 | 2026-10-29 | Conservazione dei nomi nel registro delle attività (D206) | **Opzione A** — regola di conservazione da definire, con validazione privacy umana | B — conservazione illimitata accettata | «D206=A» | Proprietario | registro, privacy, MI-06 | sì | DR-303, W8-20 |

## 103. Round 94 — risposta del 2026-10-29, secondo round della `1G-W9`

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-316 | 2026-10-29 | Messaggio dopo «Elimina definitivamente» in Media (D207, W8-19) | **Opzione B** — «File eliminato.» | A — «Media eliminato.» | «D207=B» | Proprietario | Media, `1G-W9` | sì | W8-19, W8-25 |
| DR-317 | 2026-10-29 | Avviso «Indirizzo cambiato: entra di nuovo con il nuovo indirizzo.» dopo un accesso non riuscito (D208, W8-23) | **Opzione B** — resta finché non si entra | A — sparisce al primo tentativo | «D208=B» | Proprietario | accesso all'area, `1G-W9` | sì | W8-23 |
| DR-318 | 2026-10-29 | Le schermate di Redazione aspettano la verifica dell'accesso prima di leggere i dati (D209, W8-32) | **Opzione A** — sì, anche le 12 schermate di Redazione | B — solo le 3 di Impostazioni | «D209=A» | Proprietario | area, `1G-W9` T8 | sì | W8-32 |
| DR-319 | 2026-10-29 | `/auth/me` senza sessione (D210, W8-09) | **Opzione A** — risponde 204 | B — 401 come prima | «D210=A» | Proprietario | API di autenticazione, `1G-W9` T8 | sì | W8-09 |
| DR-320 | 2026-10-29 | «Media e testo» ed «Elenco di contenuti» nell'editor (D211, W9-N1) | **Opzione A** — un pannello per ciascuno: scelta dell'immagine come nel blocco Immagine per «Media e testo», categorie e numero di articoli per «Elenco di contenuti»; il messaggio usa i nomi italiani e resta solo per moduli e contenitori | B — scelta dell'immagine per «Media e testo», «Elenco di contenuti» tolto dall'inseritore · C — entrambi tolti dall'inseritore · D — solo il messaggio corretto | «D211=A» | Proprietario | editor, `1G-W9` | sì | ADR-006 §3.2, W9-N1 |

## 104. Round 95 — risposta del 2026-10-29, revisione della T10b

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-321 | 2026-10-29 | Testo alternativo del media nel blocco «Media e testo» (D212) | **Sì** — il selettore delle immagini passa anche il testo alternativo del media, senza seconda richiesta; si toccano `ImageInsertPicker.tsx` e 2 righe di `image-media-w9.test.tsx`, il blocco Immagine non cambia | no — nessun testo copiato | «Sì, tocca i due file» | Proprietario | editor, `1G-W9` T10b | sì | DR-320, DR-305 |
| DR-322 | 2026-10-29 | Messaggio senza categorie nel pannello di «Elenco di contenuti» (D213) | **Sì** — «Non ci sono ancora categorie: si creano dalla schermata «Categorie».», come nel pannello delle notizie | no — gruppo vuoto senza messaggio | «Sì, lo stesso testo» | Proprietario | editor, `1G-W9` T10b | sì | DR-320 |
| DR-323 | 2026-10-29 | Errore del campo «Numero di notizie» (D214) | **«Il numero di notizie è un intero da 1 a 50, o vuoto.»** | «Scrivi un numero da 1 a 50, oppure lascia vuoto.» | «Sì, così» | Proprietario | editor, `1G-W9` T10b | sì | DR-320 |

## 105. Round 96 — risposta del 2026-10-30, esiti della T11

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-324 | 2026-10-30 | Come si chiude W9-6 dopo la correzione di W9-N2 (D215) | **Opzione A** — prova automatica che fallisce prima della correzione e un e2e che scrive mentre arriva il salvataggio automatico; poi, ciascuno su conferma, nuovo commit locale, `crea.ps1` e 1G-2 ripetuto dall'agente sul collaudo | B — W9-6 chiuso sulle sole prove automatiche, senza ricreare il collaudo | «D215 = A» | Proprietario | editor, collaudo, `1G-W9` T11b | sì | W9-N2, W9-6 |
| DR-325 | 2026-10-30 | Difetti bassi W9-N3…W9-N6 (D216) | **Opzione A** — correggerli tutti e quattro insieme a W9-N2, solo nell'area: «Pagina iniziale» come nome negli elenchi (W9-N3), «Si può correggere.» (W9-N4), messaggio dopo scelta e rimozione dell'immagine in evidenza con l'avviso che il sito cambia subito (W9-N5), testo alternativo di Media nell'albero dei blocchi (W9-N6) | B — solo W9-N3 e W9-N4, gli altri rinviati alla 1F · C — tutti approvati come noti, rinviati alla 1F | «D216 = A» | Proprietario | area, `1G-W9` T11b | sì | W9-N3, W9-N4, W9-N5, W9-N6 |

## 106. Round 97 — risposta del 2026-10-30, indagine della T11b

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-326 | 2026-10-30 | Come dimostrare la causa della perdita di tasti a schermo di W9-N2 (D217) | **Opzione A** — riaccendere il collaudo esistente (commit `aaedbf5`) e ripetervi la prova strumentata su una pagina sintetica creata ed eliminata dall'area con gli account dell'agente; poi correggere. Vale come conferma puntuale per riaccendere il collaudo e scriverci la pagina sintetica | B — correggere subito e verificare solo nella ripetizione di 1G-2 dopo commit e `crea.ps1` | «D217 = A» | Proprietario | collaudo, editor, `1G-W9` T11b | sì | DR-324, W9-N2 |
| DR-327 | 2026-10-30 | Elenco delle modifiche per W9-N2 (a) e (b), W9-N4 e W9-N6 (D218) | **Opzione A** — approvato tutto: (b) la copia di lavoro resta da salvare se si è scritto durante il viaggio; (a) un testo già prodotto dall'editor non lo ricarica; W9-N4 «Si può correggere.»; W9-N6 testo alternativo del media, poi titolo del media, poi «immagine» | B — tutto tranne (a), in attesa dell'esito di D217 | «D218 = A» | Proprietario | editor, area, `1G-W9` T11b | sì | DR-325, W9-N2, W9-N4, W9-N6 |
| DR-328 | 2026-10-30 | Perimetro e nomi di W9-N3 (D219) | **Opzione A** — Menu › «Contenuto»: «Pagina iniziale» per la pagina iniziale, «Senza titolo» per gli altri; Impostazioni › «Pagina iniziale»: «Pagina iniziale (/home/)»; in più «Senza titolo» in «Dove compare» dei caroselli e nella finestra di eliminazione dei documenti | B — solo Menu e Impostazioni | «D219 = A» | Proprietario | area, `1G-W9` T11b | sì | DR-325, W9-N3 |
| DR-329 | 2026-10-30 | Testi dell'immagine in evidenza (D220, W9-N5) | **Opzione A** — dopo la scelta «Immagine salvata» con «Il sito usa già la nuova immagine in evidenza.» (pubblicato) o «Immagine in evidenza salvata.»; dopo la rimozione «Immagine tolta» con «Il sito non usa più un’immagine in evidenza.» (pubblicato) o «Immagine in evidenza tolta.»; solo se pubblicato, la nota «L’immagine scelta o tolta cambia subito sul sito, senza passare dall’anteprima.» | B — solo i due avvisi, senza la nota | «D220 = A» | Proprietario | area, `1G-W9` T11b | sì | DR-325, W9-N5 |

## 107. Round 98 — risposta del 2026-10-30, revisione della T11b

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-330 | 2026-10-30 | Salvataggi della copia di lavoro che si superano (D221, revisione F4/F5) | **Opzione B** — registrati come difetto noto W9-N7 e rinviati alla 1F | A — correggere ora: copie di lavoro una alla volta, con un limite di tempo per richiesta; «Scarta la copia di lavoro», «Salva» e «Pubblica» aspettano la copia in viaggio | «D221 = B» | Proprietario | editor, copia di lavoro, `1G-W9` T11b (correzione: Fase 1F) | sì | W9-N7, DR-327 |
| DR-331 | 2026-10-30 | Altri punti con titolo vuoto (D222, revisione F7) | **Opzione A** — nell'eliminazione di un contenuto «Senza titolo» per le pagine figlie, e per un contenuto senza titolo la conferma chiede di scrivere «Senza titolo»; un titolo fatto di soli spazi vale come vuoto | B — solo la conferma di eliminazione · C — rinvio alla 1F | «D222 = A» | Proprietario | area, `1G-W9` T11b | sì | DR-328, W9-N3 |

## 108. Round 99 — risposta del 2026-10-30, punti aperti per il rilascio

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-332 | 2026-10-30 | Licenza del sottoinsieme di Font Awesome con il solo cuore (DR-311) | **Verificata** dall'utente | — | «La licenza sul font del cuore è verificata» | Proprietario | sito, caroselli, `apps/web/public/fonts/fontawesome/` | sì | DR-311, W8-26 |
| DR-333 | 2026-10-30 | Testo del 503 quando l'archivio dei file non risponde in tempo (`MEDIA_STORE_TIMEOUT`, W6-6) | **Approvato**: «Il servizio che conserva i file non ha risposto in tempo: l'operazione non è stata completata. Riprova fra qualche minuto; se succede ancora, avvisa chi gestisce il sito.» | — | «anche il testo del 503 è approvato» | Proprietario | area, media, `1G-W9` T9 | sì | D157, W6-6 |

## 109. Round 100 — risposta del 2026-10-31, fornitore e backup della Fase 1F

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-334 | 2026-10-31 | Fornitore e piano del server (D223, conclude DR-295) | **Opzione A** — Aruba Cloud VPS O4A8: 4 vCPU, 8 GB, 80 GB, server in Italia, 11,79 € al mese IVA esclusa al 2026-10-30; prezzo e disponibilità da ricontrollare nel carrello al momento dell'ordine | B — OVHcloud VPS-2 (esaurito in UE il 2026-10-30) · C — Hetzner CPX32 (35,99 €) | «D223 = A» | Proprietario | Fase 1F, ADR-009 | sì | DR-295, DR-296, DR-297, DR-300, DR-301, DR-302, `.planning/phases/1F/confronto-fornitori-2026-10-30.md` |
| DR-335 | 2026-10-31 | Destinazione dei backup cifrati (D224, attua DR-298) | **Opzione A** — Hetzner Storage Box BX11: 1 TB a 3,20 € al mese, Germania o Finlandia, restic via SFTP; da verificare all'ordine che le copie interne non si possano cancellare dal server | B — Object Storage S3 di Scaleway · C — Object Storage S3 di OVH | «D224 = A» | Proprietario | Fase 1F, ADR-009 §4.5 | sì | DR-298, DR-334, MI-06 |

## 110. Round 101 — risposta del 2026-10-31, W9-N8 e piano della Fase 1F

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-336 | 2026-10-31 | «Ctrl+Home» premuto subito dopo il clic nel testo che a volte non sposta il cursore (D232, W9-N8, bassa) | **Opzione A** — registrato come difetto noto e rinviato alla `1F-W1`, insieme a W9-N7 | B — indagare e correggere ora nella `1G-W9` · C — accettarlo senza correzione | «D232 = A» | Proprietario | editor, `1G-W9` T12 (correzione: Fase 1F) | sì | W9-N8, DR-330, `docs/qa/collaudo-1G-W9.md` §9 |
| DR-337 | 2026-10-31 | Piano della Fase 1F (`.planning/phases/1F/PLAN.md`, wave `1F-W0`…`1F-W9`) | **Approvato** dall'utente; condizione 14 del gate. L'esecuzione resta dopo l'approvazione della 1G e HO-017 (DR-272); D225…D231 restano aperte con il loro termine | — | «Sul PLAN.md della 1F: approvato» | Proprietario | Fase 1F | sì | DR-272, DR-334, DR-335, `acceptance-criteria.md` §7 e §9 |

## 111. Round 102 — risposta del 2026-10-31, residuo N2 della 1G-W9

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-338 | 2026-10-31 | Archivio dei file lento con video grandi (N2, residuo di DR-261) e taratura dei suoi tempi (D233) | **Opzione A** — rinvio alla 1F: nella `1F-W5`, sul server, misurare un caricamento sintetico da 100 MB verso l'archivio sullo stesso server (DR-297), fissare i tempi e, se serve, il caricamento a parti | B — chiuderlo ora senza misura | «D233 = A» | Proprietario | media, Fase 1F | sì | DR-261, DR-297, DR-333, DR-334, `W9-PLAN.md` §7 |

## 112. Round 103 — risposta del 2026-11-01, piano della 1G-W10

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-339 | 2026-11-01 | Piano della `1G-W10` (`.planning/phases/1G/W10-PLAN.md`) | **Approvato**; si eseguono T1 e T3. Confermate a parte l'accensione del collaudo con `avvia.ps1` e le prove della T2 (tre campi con ripristino dall'area, 1E-19, anteprima) | — | «Approvo il W10-PLAN» · «Confermo l'accensione del collaudo con avvia.ps1 e le prove della T2» | Proprietario | `1G-W10` | sì | DR-290, DR-291, DR-207 |
| DR-340 | 2026-11-01 | Come si tolgono i residui del collaudo (D234, 1G-27) | **Opzione A** — smontare l'ambiente con `crea.ps1 -Rimuovi` (database, bucket, copia di lavoro) e la cartella di stato con le credenziali dell'agente; la cancellazione chiede una conferma a parte | B — togliere dall'area il media di prova e disattivare gli account dell'agente; l'ambiente resta · C — B adesso, A dopo l'approvazione della 1G | «D234 = A» | Proprietario | collaudo, `1G-W10` T6 | sì (si ricrea con `crea.ps1`) | DR-291, `W10-PLAN.md` §3 |
| DR-341 | 2026-11-01 | Chi riesegue 1E-19 e la prova dell'anteprima su `ec640c2` (D235) | **Opzione A** — l'agente, con l'account di Redazione dell'agente sul collaudo | B — l'utente, con HO-035 aggiornato · C — non rieseguirle e citare la `1G-W7` | «D235 = A» | Proprietario | collaudo, `1G-W10` T2 | sì | DR-265, DR-290, DR-291 |

## 113. Round 104 — risposta del 2026-11-01, perimetro della T2 e file della licenza del cuore

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-342 | 2026-11-01 | Campi nuovi della matrice senza esito sul collaudo (D236) | **Opzione A** — nella T2 si collaudano dall'interfaccia «Testo alternativo» di «Media e testo», «Categorie» e «Numero di notizie» di «Elenco di contenuti» su una pagina sintetica in bozza creata ed eliminata dall'area, verificati nell'anteprima senza pubblicare; le due bozze importate si aprono soltanto. Vale come conferma per creare ed eliminare la pagina sintetica | B — prove automatiche della T10b e vista nell'elenco · C — solo i pannelli | «D236 = A» | Proprietario | collaudo, `1G-W10` T2 | sì | DR-320…DR-323, DR-063, DR-064, DR-326 |
| DR-343 | 2026-11-01 | `LEGGIMI.txt` del font del cuore e commento di `blocks.css` che dicono la licenza «da verificare» (D237) | **Opzione B** — si correggono ora: dopo DR-332 la licenza è verificata | A — nella `1F-W1` · C — lasciati | «D237 = B» | Proprietario | sito, `apps/web/public/fonts/fontawesome/`, `1G-W10` | sì | DR-311, DR-332 |

## 114. Round 105 — risposta del 2026-11-01, difetti bassi della T2

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-344 | 2026-11-01 | Difetti bassi W10-N1, W10-N2, W10-N3 della T2 (D238) | **Opzione B** — corretti ora in una T2b: prove che falliscono prima, revisione, verifica come la CI, commit su conferma | A — rinvio alla `1F-W1` · C — accettati | «D238 = B» | Proprietario | area, editor, `1G-W10` T2b | sì | W10-PLAN.md §3 |

## 115. Round 106 — risposta del 2026-11-01, elenco delle modifiche della T2b

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-345 | 2026-11-01 | Elenco delle modifiche della T2b (D239) | **Approvato tutto**: W10-N1 nomi delle categorie nell'albero con una sola richiesta e solo se la pagina contiene un elenco; W10-N2 «Indirizzo risultante» col percorso salvato se slug e genitore non cambiano; W10-N3 intestazione dell'editor con «Senza titolo» (e «Pagina iniziale»); titolo di soli spazi come «Senza titolo» anche nell'elenco dei contenuti (DR-331); prove che falliscono prima | tutto tranne l'elenco dei contenuti · solo W10-N1 e W10-N3 | «Approva tutto» | Proprietario | area, `1G-W10` T2b | sì | DR-344, DR-331 |
| DR-346 | 2026-11-01 | Testo dell'albero accanto a «Elenco di contenuti» (D240, W10-N1) | **Opzione A** — categorie e numero di notizie: «Senza categoria · 3 notizie», «News, Senza categoria · 1 notizia»; senza categorie «tutte le categorie»; numero vuoto non scritto | B — solo le categorie · C — numero di categorie | «Categorie · numero» | Proprietario | editor, albero dei blocchi | sì | DR-345, W8-33 |

## 116. Round 107 — risposta del 2026-11-02, approvazione del collaudo redazionale

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-347 | 2026-11-02 | Collaudo redazionale della Fase 1G (condizione 7 del gate) | **Approvato** secondo `docs/qa/cms-editability-report.md`, con l'indebolimento di DR-290 e i difetti W9-N7 e W9-N8 rinviati alla 1F; condizione 7 soddisfatta | approvare con riserve · respingere | «Approvo il collaudo redazionale della Fase 1G (condizione 7 del gate): editabilità verificata secondo questo rapporto, con l'indebolimento di DR-290 e i difetti W9-N7 e W9-N8 rinviati alla 1F.» | Proprietario | Fase 1G, gate (condizione 7) | sì | DR-290, DR-330, DR-336, `cms-editability-report.md` §12, `.planning/phases/1G/AUDIT.md`, CI 41395242290 su `7cbf965` |
| DR-348 | 2026-11-02 | Chiusura formale della Fase 1G (D241) | **Opzione A** — chiusa nello stesso commit dei documenti di chiusura: `ROADMAP.md` (M1: 1A…1E e 1G approvate) e `phase-plan.md` (1G precedente, 1F corrente, da eseguire dopo HO-017) | B — chiusura in un commit successivo · C — dopo HO-017 | «D241 = A» | Proprietario | Fase 1G, `ROADMAP.md`, `phase-plan.md` | sì | DR-347, DR-211, DR-212, `.planning/phases/1G/AUDIT.md` |

## 117. Round 108 — risposta del 2026-11-02, distruzione dell'istanza di riferimento (HO-017)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-349 | 2026-11-02 | Distruzione dell'istanza WordPress di riferimento (HO-017, D242) | **Opzione B** — contenitori, volumi e immagine costruita `wpref-wp:latest` tolti con `down -v --rmi local`; eseguita lo stesso giorno | A — solo contenitori e volumi · C — rinvio | «HO-017: D242 = B, confermo la distruzione dell'istanza di riferimento.» | Proprietario | istanza di riferimento locale | sì (si ricostruisce con HO-001 da `source-private/`) | DR-025, DR-212, DR-348, HO-017 |

## 118. Round 109 — risposta del 2026-11-03, 1F-W1 e acquisto del server (HO-056)

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-350 | 2026-11-03 | Dove si corregge W9-N7 (D243) | **Opzione A** — solo nell'area: un salvataggio della copia di lavoro alla volta; «Scarta», «Salva» e «Pubblica» attendono quello in viaggio; nessuna modifica di API e database | B — anche 409 dal servizio su `baseUpdatedAt` superato · C — anche numero d'ordine con migrazione `0010` | «D243=A» | Proprietario | Fase 1F, `1F-W1` | sì | DR-330, `.planning/phases/1F/W1-PLAN.md` |
| DR-351 | 2026-11-03 | W9-N8 non riprodotto nell'ambiente e2e (D244) | **Opzione B** — correzione preventiva: «Ctrl+Home» e «Ctrl+Fine» gestiti dall'editor, con una prova che simula il ritardo | A — collaudo ricreato per la prova · C — chiuso come non riprodotto | «D244= B» | Proprietario | Fase 1F, `1F-W1` | sì | DR-336, `W1-PLAN.md` T3-T4 |
| DR-352 | 2026-11-03 | Quando si compra il server (D245) | **Opzione B** — alla `1F-W5`, come dice il PLAN; HO-056 resta preparato e non si esegue prima | A — adesso, server vuoto · C — adesso solo l'account | «D245= B» | Proprietario | Fase 1F, `1F-W5` | sì | DR-334, HO-056, PLAN §3 |
| DR-353 | 2026-11-03 | Sistema operativo del server (D246) | **Opzione A** — Ubuntu Server 24.04 LTS; se il carrello non lo offre, l'utente si ferma e segnala (HO-056 §10) | B — Debian 12 o 13 · C — il primo con supporto lungo nel carrello | «D246=A» | Proprietario | Fase 1F, server | sì, prima dei dati (reinstallazione) | DR-334, HO-056 |
| DR-354 | 2026-11-03 | Account Aruba per l'acquisto (D247) | **Opzione A** — l'account Aruba del Centro che ha già il dominio | B — account nuovo intestato al Centro | «D247=A» | Proprietario | Fase 1F, fornitori | sì | DR-300, DR-302, HO-056 |
| DR-355 | 2026-11-04 | Esiti non bloccanti della revisione della T5 della `1F-W1` (D248) | **Opzione B** — solo «Scarta la copia di lavoro» disattiva i pulsanti e mette in pausa l'editor mentre attende il salvataggio in viaggio, con la prova rossa prima; il tempo massimo sul `PUT` della copia e gli altri esiti bassi restano annotati | A — nessuna correzione · C — anche un tempo massimo di 15 s sul `PUT` della copia | «D248 = B» | Proprietario | Fase 1F, `1F-W1` | sì | DR-350, `W1-PLAN.md` §4 |

## 119. Round 110 — risposta del 2026-11-04, 1F-W2

| id | data | decisione | opzione scelta | opzioni scartate | motivo dichiarato dall'utente | approvata da | ambito | reversibile | riferimenti |
|---|---|---|---|---|---|---|---|---|---|
| DR-356 | 2026-11-04 | Dove si conservano le immagini (D225) | **Opzione A** — registro di GitHub (GHCR), privato; il server scarica con un token di sola lettura | B — costruzione sul server, senza registro · C — registro di un altro fornitore | «D225=A» | Proprietario | Fase 1F, CI, `1F-W2` T9 | sì | ADR-009 §4.7, `W2-PLAN.md` §4 |
| DR-357 | 2026-11-04 | Chi esegue i comandi sul server (D228) | **Opzione C** — misto: impianto del server da handoff eseguito dall'utente; rilasci ripetuti da GitHub Actions avviata a mano, con approvazione dell'ambiente e chiave SSH nei segreti del repository | A — sempre l'utente da handoff · B — tutto da GitHub Actions | «D228=C» | Proprietario | Fase 1F, CI, `1F-W5`, `1F-W8` | sì | ADR-009 §4.8, `deployment-gate`, `W2-PLAN.md` §4 |
| DR-358 | 2026-11-04 | Come si esegue l'API in produzione (D249) | **Opzione A** — bundle con `esbuild` eseguito da `node`, con i moduli nativi fuori dal bundle | B — `tsx` anche in produzione · C — `tsc` con le estensioni negli import di tutti i pacchetti | «D249=A» | Proprietario | `apps/api`, `packages/db`, `1F-W2` T3 | sì | DR-080, PLAN §5, `W2-PLAN.md` §4 |
| DR-359 | 2026-11-04 | Collegamento dell'API con il contenitore della pulizia (D250) | **Opzione A** — piccolo servizio di pulizia su una rete Docker interna senza uscita verso Internet, raggiungibile solo dall'API, che gli invia il file e riceve quello ripulito | B — cartella condivisa come coda, nessuna rete · C — programmi nell'immagine dell'API con limiti per processo | «D250=A» | Proprietario | `apps/api/src/modules/media`, `infra/`, `1F-W2` T5 | sì | DR-263, ADR-012 §4, `W2-PLAN.md` §4 |
| DR-360 | 2026-11-04 | Indirizzi fissati nella build di Next (D251) | **Opzione A** — indirizzi relativi in produzione, una sola immagine per staging e produzione; in sviluppo l'indirizzo assoluto resta possibile | B — un'immagine per ambiente · C — indirizzi letti all'avvio | «D251=A» | Proprietario | `apps/web`, `apps/admin`, `1F-W2` T2 | sì | ADR-003, PLAN W8, `W2-PLAN.md` §4 |
| DR-361 | 2026-11-05 | Dove vive il codice del servizio di pulizia (D254) | **Opzione A** — quarto ingresso del bundle dell'API (`dist/bin/scrub-server.js`) che riusa `scrub.ts`; l'immagine `scrub.Dockerfile` prende il bundle dallo stadio di build dell'API e aggiunge `qpdf` e `ffmpeg` | B — pacchetto `apps/scrub` con la logica spostata in `packages/scrub` | «D254=A» | Proprietario | `apps/api`, `infra/docker`, `1F-W2` T5 | sì | DR-358, DR-359, `W2-PLAN.md` §4 |
| DR-362 | 2026-11-05 | Come l'API si fa riconoscere dal servizio di pulizia (D255) | **Opzione A** — gettone fisso nell'intestazione `Authorization: Bearer`, confrontato a tempo costante, sulla sola rete interna | B — firma HMAC del contenuto con data, valida 60 s | «D255=A» | Proprietario | `apps/api`, `infra/`, `1F-W2` T5 | sì | DR-359 |
| DR-363 | 2026-11-05 | API configurata per il servizio di pulizia che non risponde (D256) | **Opzione A** — PDF e MP4 rifiutati con `MEDIA_SCRUB_UNAVAILABLE`, mai ripiego sui programmi locali; le immagini si caricano | B — ripiego sui programmi locali se presenti | «D256=A» | Proprietario | `apps/api/src/modules/media`, `1F-W2` T5 | sì | DR-359, DR-263 |
| DR-364 | 2026-11-05 | Content-Security-Policy di produzione (D252) | **Opzione B** — politica in `Content-Security-Policy-Report-Only` da Caddy (`self`, script e stili inline, `frame-src` YouTube, Vimeo, Google Maps, `object-src 'none'`, `base-uri`, `frame-ancestors`, `form-action` su `self`), senza indirizzo di raccolta delle segnalazioni; il passaggio alla CSP applicata si decide nella W4/W5 | A — applicata subito · C — nessuna CSP fino alla W4 | «D252=B» | Proprietario | `infra/deploy/caddy`, `1F-W2` T7 | sì | `W2-PLAN.md` §4, T7 |
| DR-365 | 2026-11-05 | Politica definitiva della cache dei media (D253) | **Opzione A** — resta `Cache-Control: no-cache` dall'API sui file `/media/…`; Caddy non tocca l'intestazione. Supera la natura provvisoria di DR-253 | B — `max-age` breve · C — indirizzo con versione e `immutable` | «D253=A» | Proprietario | `apps/api` (media pubblici), `infra/deploy/caddy`, `1F-W2` T7 | sì | DR-253, DR-074 |
| DR-366 | 2026-11-06 | Immagine del servizio `backup` (D257) | **Opzione A** — Dockerfile del repository: base fissata per digest, binario ufficiale di restic verificato con SHA-256, client PostgreSQL 17, `mc` dall'immagine Chainguard già in uso | B — `restic/restic` con il client PostgreSQL aggiunto · C — due contenitori con un volume condiviso | «D257=A» | Proprietario | `infra/docker`, CI, `1F-W3` T1 | sì | DR-335, DR-101, `W3-PLAN.md` §4 |
| DR-367 | 2026-11-06 | Avvio giornaliero del backup (D258) | **Opzione A** — timer di systemd sull'host che lancia `docker compose run --rm backup`; impianto nella `1F-W5` da handoff | B — contenitore sempre acceso con pianificatore interno · C — cron dell'host | «D258=A» | Proprietario | `infra/deploy`, `1F-W3` T2 e T4, `1F-W5` | sì | DR-357, ADR-009 §4.5 |
| DR-368 | 2026-11-06 | Copia degli oggetti nel backup (D259) | **Opzione A** — `mc mirror` dei due bucket in un volume di appoggio persistente, poi restic su quel volume | B — restic sul volume di MinIO · C — `rclone` | «D259=A» | Proprietario | `infra/deploy/backup`, `1F-W3` T2 e T3 | sì | DR-297, ADR-004 §3.6 |
| DR-369 | 2026-11-06 | Formato del dump di PostgreSQL (D260) | **Opzione A** — `pg_dump` formato custom senza compressione interna; deduplica e compressione da restic | B — SQL in chiaro · C — formato custom compresso | «D260=A» | Proprietario | `infra/deploy/backup`, `1F-W3` T2 e T3 | sì | ADR-009 §4.5 |
| DR-370 | 2026-11-06 | Destinazione di prova del backup in locale (D263) | **Opzione A** — contenitore SFTP locale, solo per le prove, fissato per digest; chiave SSH e `known_hosts` provati come sulla Storage Box | B — repository in cartella locale, SFTP solo nella `1F-W5` | «D263=A» | Proprietario | `infra/deploy/tests`, `1F-W3` T2 e T6 | sì | DR-335 |
| DR-371 | 2026-11-06 | Esito di ogni backup (D261) | **Opzione A** — riga JSON nel log (journal di systemd, DR-367) e file di stato in un volume con data, esito, durata, byte e identificativo; codice d'uscita diverso da 0 a ogni errore; avvisi con la sonda di D227 nella `1F-W8`; nessun nome di file né contenuto | B — anche email al Centro · C — solo log | «D261=A» | Proprietario | `infra/deploy/backup`, `1F-W3` T2 | sì | DR-367, D227 |
| DR-372 | 2026-11-06 | Ambienti sottoposti a backup (D262) | **Opzione A** — solo la produzione; lo staging contiene copie ricreabili | B — produzione e staging in repository separati | «D262=A» | Proprietario | `infra/deploy`, `1F-W3` T4, `1F-W5` | sì | DR-296, DR-335 |
| DR-373 | 2026-11-06 | Manutenzione del repository restic (D264) | **Opzione A** — `forget --prune` con 7/4/6 dopo ogni backup; `restic check` settimanale con rilettura del 10 % dei dati | B — `prune` settimanale, `check` mensile · C — solo `forget` | «D264=A» | Proprietario | `infra/deploy/backup`, `1F-W3` T2 | sì | ADR-009 §4.5 |
| DR-374 | 2026-11-06 | Accelerazione della Fase 1F (D265) | **Opzione B** — ordini di server e Storage Box e sollecito di MI-06 subito, in parallelo alla `1F-W3`; la `1F-W4` parte a W3 chiusa; la `1F-W5` avanza sul server **senza dati del Centro** (indurimento, Docker, staging vuoto) in parallelo alla W4; nessun dato del Centro sul server prima della chiusura della W4. Modifica PLAN §3; **supera DR-352** (acquisto del server nella `1F-W5`) | A — sequenza invariata, solo azioni esterne anticipate | «D265=B» | Proprietario | `.planning/phases/1F/PLAN.md` §3, `1F-W4`, `1F-W5` | sì | DR-337, DR-334, DR-335 |
| DR-375 | 2026-11-06 | Accesso allo staging (D226) | **Opzione A** — sottodominio con record DNS e accesso protetto da password; certificato provato come in produzione | B — solo tunnel SSH · C — indirizzo IP con password senza TLS valido | «D226=A» | Proprietario | `infra/deploy/caddy`, DNS su Aruba, `1F-W5` | sì | DR-300, DR-296 |
| DR-376 | 2026-11-06 | Sede della Storage Box dei backup (D266) | **Opzione A** — Germania | B — Finlandia | «D266=A» | Proprietario | HO-058, `1F-W5` | sì, prima dei backup | DR-335, DR-374 |
| DR-377 | 2026-11-06 | Esito riferito di MI-06 | Il professionista ha dato l'**ok sul documento** di ambito (`docs/legal/MI-06-ambito-verifica-privacy.md`); parere scritto **non allegato**, registrato senza allegato su richiesta dell'utente. Non contiene le regole per domanda chieste dal §8 del documento: 1F-11 resta aperto finché le risposte alle 13 domande non sono disponibili per la `1F-W6` | — | «ho avuto l'ok, registralo pure senza allegato» | Proprietario | MI-06, HO-054, `1F-W6`, 1F-11 | sì | DR-303, DR-310, DR-073 |
| DR-378 | 2026-11-06 | Destinazione SFTP di prova del backup (attuazione di DR-370) | Dockerfile **solo per le prove** `infra/deploy/tests/sftp-prova.Dockerfile` sulla base già fissata `postgres:17.11-alpine` per digest, con `openssh-server=10.3_p1-r2`; chiavi generate nella prova; mai nel Compose né nella CI di pubblicazione | immagine SFTP di terzi fissata per digest | «confermo il server SFTP di prova» | Proprietario | `infra/deploy/tests`, `1F-W3` T2 e T6 | no | DR-370, DR-366 |
| DR-379 | 2026-11-07 | Durata dei backup dopo il parere MI-06 (D267) | **Opzione B** — `forget` con 7 giornalieri e 4 settimanali, senza mensili: nessuna istantanea oltre circa 35 giorni. **Supera DR-373** per la sola conservazione; `forget --prune` dopo ogni backup e `check` settimanale al 10 % restano | A — 7/4/6 con giustificazione scritta del Centro · C — `--keep-within-daily 35d` | «D267=B» | Proprietario | `infra/deploy/backup`, `1F-W3` T8, informativa (`1F-W6`) | sì | DR-373, MI-06 parere 3e |
| DR-380 | 2026-11-07 | Custodia della password del repository e della chiave SSH dei backup (D268) | **Opzione A** — due copie cifrate, separate dal server e dai backup: una al manutentore, una in custodia istituzionale del Centro; prova di ripristino con la copia del Centro prima della produzione. **Integra DR-298** (la chiave non dipende più da una sola persona) | B — solo il manutentore · C — solo il Centro | «D268=A» | Proprietario | handoff della chiave (`1F-W5`), HO-058 | sì | DR-298, MI-06 parere 7b e 12 |
| DR-381 | 2026-11-07 | Cancellazioni da riapplicare dopo un ripristino (D269) | **Opzione A** — registro minimo delle cancellazioni (solo identificativi tecnici e data), riapplicato in modalità manutenzione dopo ogni ripristino e prima di riaprire il sito; si realizza nella `1F-W6` | B — nessun registro, sito chiuso e cancellazioni rifatte a mano | «D269=A» | Proprietario | `1F-W6`, README del ripristino | sì | MI-06 parere 3e |
| DR-382 | 2026-11-07 | Parere scritto MI-06 nel repository | `docs/legal/MI-06-parere-privacy.md` (risposte alle 13 domande) **va in Git**; aggiorna DR-377: le regole per domanda sono ora disponibili per la `1F-W6` (1F-11) | — | «il parere MI-06 va in Git» | Proprietario | MI-06, 1F-11, `1F-W6` | sì | DR-377 |
| DR-383 | 2026-11-08 | Revisore separato della security review (D270) | **Opzione A** — agente `security-reviewer` a contesto nuovo, che riceve codice e perimetro senza le ipotesi del coordinatore; il rapporto dichiara di non essere un audit umano indipendente | B — A più revisione umana esterna del rapporto e dell'autenticazione · C — penetration test esterno a pagamento | «D270=A» | Proprietario | `1F-W4` T4, `docs/deploy/security-review-1F.md` | sì | PLAN 1F §2, ADR-007 §6 e §8, MI-06 parere 12 |
| DR-384 | 2026-11-08 | MFA per gli accessi privilegiati (D271) | **Opzione A** — TOTP nell'area amministrativa per tutti gli account, prima della produzione; il superamento delle 500 righe del nucleo si ripresenta all'utente secondo ADR-007 §6, senza cambiare la regola di conteggio | B — misura equivalente (rete fidata o secondo fattore al proxy) · C — nessuna MFA in Fase 1 con rischio approvato dal Centro | «D271=A» | Proprietario | `1F-W4` T6, `apps/api/src/auth`, `apps/admin` | sì | MI-06 parere 12, ADR-007 §3.1 e §6, DR-070 |
| DR-385 | 2026-11-08 | Cifratura a riposo delle tre tabelle con dati personali (D272) | **Opzione C** — nessuna cifratura applicativa né del disco in Fase 1: cifrati solo i backup (DR-298) e il trasporto (TLS); il rischio residuo va **approvato per iscritto dal Centro** prima che dati del Centro arrivino sul server. Chiude `database-schema.md` §8 punto 5 | A — cifratura del disco del server · B — cifratura dei campi di `form_submissions` e `legacy_email_log` nella `1F-W6` | «D272=C» | Proprietario | `database-schema.md` §8, `1F-W4` rapporto, handoff al Centro, informativa (`1F-W6`) | sì | MI-06 parere 12, DR-298 |
| DR-386 | 2026-11-08 | Audit delle dipendenze e delle immagini (D273) | **Opzione B** — `pnpm audit --prod` e scansione delle cinque immagini una tantum nella `1F-W4`; `pnpm audit --prod` bloccante su critici e alti nella CI, con eccezioni motivate e versionate | A — solo una tantum · C — B più scansione delle immagini nella CI | «D273=B» | Proprietario | `.github/workflows/ci.yml`, `1F-W4` T2 e T6 | sì | PLAN 1F §5 |
| DR-387 | 2026-11-08 | Segreti nell'ambiente dei contenitori (D274) | **Opzione A** — rischio accettato in Fase 1: chi può eseguire `docker inspect` è già `root` di fatto; accesso al server ristretto (`1F-W5`). Si riapre se la revisione trova un percorso concreto di esposizione (log, rapporti d'errore, dump diagnostici) | B — segreti come file montati (`_FILE`) per API, backup e database | «D274=A» | Proprietario | `infra/deploy/README.md` §9, `1F-W4` T4 | sì | ADR-007 §3.1 controllo 12 |
| DR-388 | 2026-11-08 | TOTP oltre le 500 righe del nucleo (D275, rilievo R4 della `1F-W4`) | **Opzione B** — **terza deroga** ad ADR-007 §6 contromisura 3: la soglia del solo nucleo sale da 500 a **650** righe; il TOTP si scrive con `node:crypto`, senza dipendenze nuove; regola di conteggio invariata; il riesame di ADR-007 §3.3 con Better Auth resta obbligatorio prima della fase gestionale. Supera DR-070 sul punto della soglia; la deroga di DR-066 per il totale resta | A — adozione di Better Auth con il plugin a due fattori, come dice la regola scritta | «D275=B» | Proprietario | ADR-007 §6, `apps/api/tests/auth-line-count.json`, `1F-W4` T6 | sì — ADR-007 §7 dichiara la reversibilità alta | DR-066, DR-070, DR-384, rapporto T4 R4 |
| DR-389 | 2026-11-08 | Versione di Node per immagini, CI e sviluppo (D276, rilievo R2) | **Opzione B** — Node **26.12.1** (LTS attiva fino al 2029-04-30) su `bookworm-slim` fissato per digest, in `.nvmrc`, CI e nei cinque Dockerfile; per primo nella T6. Chiude l'uso di Node 25.0.0, fuori supporto dal 2026-06-01 e mai registrato in una DR | A — Node 24.22.1, LTS in manutenzione fino al 2028-04-30 | «D276=B» | Proprietario | `.nvmrc`, `infra/docker/*.Dockerfile`, `.github/workflows/ci.yml`, `1F-W4` T6 | sì | rapporto T4 R2, calendario di Node letto il 2026-11-08 |
| DR-390 | 2026-11-08 | Contenuto e durata dei log applicativi (D277, rilievo R3) | **Opzione B** — nei log dell'API solo metodo, percorso senza query, esito, durata, identificativo della richiesta e **digest con sale dell'IP** (lo stesso del database), per collegare un abuso ad `audit_log`; niente IP in chiaro né query; rotazione `json-file` 10 MB × 5 per servizio | A — nessun IP, nemmeno come digest · C — IP in chiaro con rotazione e sei mesi dichiarati nell'informativa | «D277=B» | Proprietario | `apps/api/src/app.ts`, `infra/deploy/compose.yml`, informativa (`1F-W6`) | sì | rapporto T4 R3, `database-schema.md` §7.3, MI-06 |
| DR-391 | 2026-11-08 | Durata delle sessioni e conferma per le operazioni delicate (D278, rilievo R9) | **Opzione A** — sessione di 14 giorni al massimo, 8 ore di inattività, cookie senza scadenza propria (finisce alla chiusura del browser); password o TOTP richiesti di nuovo per la gestione degli account se l'ultima conferma ha più di 10 minuti. Supera i 30 giorni e 12 ore dei valori attuali | B — 30 giorni e 12 ore, solo il TOTP · C — 7 giorni e 8 ore con la stessa conferma | «D278=A» | Proprietario | `apps/api/src/config.ts`, `apps/api/src/modules/auth`, `modules/accounts`, `1F-W4` T6 | sì | rapporto T4 R9, DR-384, DR-288 |
| DR-392 | 2026-11-08 | Perimetro delle correzioni della T6 della `1F-W4` (D279) | **Opzione A** — oltre agli alti (R1–R4): medi R5, R6, R7, R8, R10, R11, R15, R16, R17 corretti nella W4, R13 come script con prova (regole applicate sul server nella `1F-W5`), R9 secondo DR-391; R12 e R14 (Storage Box) rinviati alla `1F-W5` con handoff; bassi corretti R18, R19, R22, R25, R26a, R26c, R27, R28; bassi annotati: R20 e R21 alla `1F-W5` (DR-364), R24 nell'handoff della `1F-W5`, R23, R26b, R26d–f, R29 nel rapporto | B — solo alti e medi già previsti, altri medi accettati e rinviati alla `1F-W6` · C — tutti e 29 i rilievi nella W4 | «D279=A» | Proprietario | `1F-W4` T6 e T8, `1F-W5`, `docs/deploy/security-review-1F.md` | sì | rapporto T4, W4-PLAN criterio W4-6 |
| DR-393 | 2026-11-08 | T6j e T6k nella T6 della `1F-W4` (D280) | **Opzione A** — T6j (R18, R22, R25, R26a, R26c, R27) e T6k (sessioni di DR-391) restano nella T6, la T6k prima della T6l, entrambe prima del commit; conferma DR-391 e DR-392 | B — escluse, con modifica di DR-391, DR-392 e HO-060 | «D280=A» | Proprietario | `1F-W4` T6, HO-060 | sì | DR-391, DR-392, HO-060 |
| DR-394 | 2026-11-08 | Approvazione scritta del rischio residuo di DR-385 (HO-060) | **Approvato** — il Centro, titolare del trattamento, tramite il **legale rappresentante**, accetta per iscritto il 2026-11-08 la conservazione dei dati sul server senza cifratura a riposo per la sola Fase 1, con il testo di HO-060 §5 invariato; originale conservato dal Centro e dal manutentore, fuori da Git. Soddisfa la condizione di DR-385; resta DR-374 (nessun dato del Centro sul server prima della chiusura della `1F-W4`) | — | «HO-060 fatto: rischio di DR-385 approvato per iscritto il 2026-11-08 da legale rappresentante, originale conservato da Centro + manutentore» | Legale rappresentante del Centro, riferito dal proprietario | `1F-W4` rapporto della security review, HO-060, informativa (`1F-W6`) | sì: riesame prima della fase gestionale o di categorie di dati diverse | DR-385, DR-374, MI-06 parere 12 |
| DR-395 | 2026-11-08 | Nucleo di autenticazione a 772 righe con il TOTP, oltre la soglia di 650 (D281, rilievo R4 della `1F-W4`) | **Opzione A** — **quarta deroga** ad ADR-007 §6 contromisura 3: la soglia del solo nucleo sale da 650 a **800** righe; il TOTP resta come scritto e provato con `node:crypto`; regola di conteggio invariata; il riesame di ADR-007 §3.3 con Better Auth resta obbligatorio prima della fase gestionale. Supera DR-388 sul punto della soglia; la deroga di DR-066 per il totale resta | B — adozione di Better Auth con il plugin a due fattori, come dice la regola scritta | «D281=A» | Proprietario | ADR-007 §6, `apps/api/tools/countAuthLines.ts`, `apps/api/tests/auth-line-count.json`, `1F-W4` T6l | sì — ADR-007 §7 dichiara la reversibilità alta | DR-066, DR-070, DR-384, DR-388, rapporto T4 R4 |
| DR-396 | 2026-11-08 | Conferma recente anche per leggere gli account (D282) | **Opzione A** — ogni rotta che richiede il permesso `users.manage` chiede la conferma (password o TOTP) entro 10 minuti di DR-391, anche l'elenco e il dettaglio degli account | B — conferma solo per creazione, modifica, disattivazione, reimpostazione della password e ruoli | «D282=A» | Proprietario | `apps/api/src/modules/accounts`, `apps/admin`, `1F-W4` T6l | sì | DR-391, DR-384 |
| DR-397 | 2026-11-08 | Reimpostazione del secondo fattore di chi perde il dispositivo (D283) | **Opzione A** — solo il manutentore, da riga di comando sul server: il comando toglie il TOTP, revoca le sessioni della persona e lascia una riga nel registro; nessuna reimpostazione dall'area amministrativa | B — anche un account con `users.manage` dall'area, con conferma recente | «D283=A» | Proprietario | `apps/api/tools/resetSecondFactor.ts`, handoff della `1F-W5` | sì | DR-384, DR-391 |
| DR-398 | 2026-11-08 | Rischio della prima attivazione del TOTP (D284) | **Opzione A** — rischio accettato in Fase 1: chi conosce la password temporanea può attivare il proprio dispositivo prima della persona; rimedio con il comando di DR-397; la password temporanea si consegna su un canale sicuro e il cambio al primo accesso resta obbligatorio (DR-228) | B — attivazione solo con un codice monouso consegnato a parte dalla password | «D284=A» | Proprietario | creazione del primo account reale (`1F-W5`), handoff | sì | DR-228, DR-384, DR-397 |
| DR-399 | 2026-11-08 | Chiave di cifratura dei segreti TOTP (D285) | **Opzione A** — nessuna procedura di rotazione di `TOTP_ENCRYPTION_KEY` in Fase 1: la chiave si custodisce con gli altri segreti; se va persa o compromessa si reimpostano tutti i secondi fattori con il comando di DR-397 | B — comando di rotazione che decifra con la chiave vecchia e cifra con la nuova | «D285=A» | Proprietario | handoff dei segreti della `1F-W5` | sì | DR-387, DR-397 |
