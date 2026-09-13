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
