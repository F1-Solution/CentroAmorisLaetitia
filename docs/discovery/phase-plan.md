# Piano di fase — Centro per la Famiglia Amoris Laetitia

Prodotto in Fase 0. **Non eseguibile**: ogni fase parte solo dopo approvazione
esplicita della precedente.

Skill superpowers usata: `superpowers-phase-planning`, perché l'attività è la
pianificazione incrementale di un progetto a fasi con un gate vincolante.

---

## 1. Stato dei prerequisiti

| File | Presente | Non vuoto | Note |
|---|---|---|---|
| `ROADMAP.md` (radice) | **no** | — | l'omonimo sta in `source-private/planning/`, scritto per lo stack .NET |
| `CLAUDE.md` (radice) | **no** | — | idem |
| `PROGRESS.md` (radice) | **no** | — | va creato prima della prima wave |
| `.planning/phases/<fase>/CONTEXT.md` | no | — | previsto dalla Fase 1B in poi |
| `.planning/phases/<fase>/PLAN.md` | no | — | idem |
| `docs/discovery/*` | **sì** | sì | prodotti ora |

**Condizione di stop attiva.** Tre prerequisiti obbligatori mancano. La loro
creazione è oggetto della domanda **D4**.

---

## 2. Posizione nell'ordine delle fasi

| | Fase |
|---|---|
| Precedente | Fase 1E — Ricostruzione React e parità visiva: **approvata il 2026-10-19** (DR-211) |
| **Corrente** | **Fase 1G — Collaudo redazionale del CMS: pianificazione avviata il 2026-10-19** |
| Successiva | Fase 1F — Staging e produzione |

Aggiornato il 2026-10-19. Fasi 0, 1A, 1B, 1C, 1D e 1E approvate; stato per wave in
`PROGRESS.md`.

---

## 3. Stato del gate di Fase 1

**NON SUPERATO.** Aggiornato il 2026-10-19, alla chiusura della Fase 1E: 12 condizioni
soddisfatte, 3 aperte (7, 14, 15).

| # | Condizione | Stato |
|---|---|---|
| 1 | Audit read-only della sorgente | soddisfatta — Fase 1A |
| 2 | Inventario di pagine, articoli, CPT, media, tassonomie, menu, widget, opzioni, URL | soddisfatta — Fase 1A |
| 3 | Copertura di bozze, private, protette, gerarchie, contenuti non a menu | soddisfatta — Fasi 1A e 1D |
| 4 | Importer idempotente con dry-run, report, mapping ID, errori isolati | soddisfatta — Fase 1D |
| 5 | Import in PostgreSQL di contenuti, menu, SEO, media, URL, redirect | soddisfatta in locale — Fase 1D, `import-completeness-report.md` |
| 6 | Frontend React fedele a layout, componenti, font, colori, spacing, responsive | soddisfatta — Fase 1E, DR-210 |
| 7 | CMS che consenta davvero di modificare contenuti, media, menu, SEO, redirect, impostazioni | **aperta** — CMS costruito in 1D, collaudo redazionale in Fase 1G |
| 8 | Matrice URL completa | soddisfatta — Fasi 1A e 1E |
| 9 | Screenshot desktop/tablet/mobile con visual regression e report | soddisfatta — Fase 1E, `visual-parity-report.md` |
| 10 | Difformità residue documentate e approvate | soddisfatta — DR-162, DR-203 e decisioni nominative |
| 11 | Verifica di redirect, sitemap, robots, canonical, Open Graph, 404, form | soddisfatta in locale — Fase 1E (1E-8, 1E-9, form 24/24); si ripete in 1F |
| 12 | Build, test, lint, typecheck verdi | soddisfatta — CI `39201139144` su `ca9e39b` |
| 13 | UAT di parità firmata dall'utente | soddisfatta — DR-210, 2026-10-18 |
| 14 | Piano di produzione approvato | **aperta** — Fase 1F |
| 15 | Deploy su staging e produzione verificati, rollback testato | **aperta** — Fase 1F |

Nessuna fase gestionale può essere **pianificata**, avviata o rilasciata prima che
il gate sia superato per intero.

---

## 4. Avanzamento

`PROGRESS.md` non esiste. Nessuna wave risulta completata. Non ci sono interruzioni
da rate limit da recuperare: questa è la prima sessione del progetto.

---

## 5. Piano proposto

Ogni wave ha un identificativo stabile. Nessuna wave parte senza l'approvazione
della precedente. Il criterio di "fatto" è verificabile da un terzo, non opinabile.

### Fase 1A — Audit WordPress (sola lettura)

Prerequisiti: approvazione della Fase 0; D1, D3 e D4 chiuse.

| Wave | Attività | Criterio di "fatto" |
|---|---|---|
| `1A-W1` | Inventario tecnico della sorgente: versione, tema e versione, child theme, prefisso tabelle, plugin attivi, page builder, CPT, tassonomie, shortcode, form, plugin SEO, redirect, cache, font, CSS/JS, dipendenze esterne | `docs/migration/wp-source-inventory.md` esiste, ogni voce ha il file o la tabella da cui è ricavata, nessuna voce "da verificare" |
| `1A-W2` | Inventario dei contenuti da dump ed export incrociati: ogni pagina, articolo, CPT, allegato, termine, voce di menu, con stato, gerarchia, autore, date | `docs/migration/content-inventory.csv` ha una riga per contenuto; i totali coincidono con quelli del dump; i contenuti non presenti nel menu e le bozze sono marcati |
| `1A-W3` | Matrice URL: ogni URL pubblico raggiungibile, inclusi URL numerici, alias, allegati, feed, paginazioni, tassonomie | `docs/migration/url-matrix.csv` con URL, tipo, stato HTTP atteso, contenuto di destinazione, presenza a menu |
| `1A-W4` | Mappa plugin → funzionalità osservabile sul sito pubblico, con indicazione di cosa va ricostruito e cosa decade | `docs/migration/plugin-and-feature-map.md`: ognuno dei 18 plugin ha una destinazione dichiarata |
| `1A-W5` | Rischi di migrazione e input mancanti | `docs/migration/migration-risks.md` e `docs/migration/missing-inputs.md`; ogni rischio ha probabilità, impatto e mitigazione; ogni input mancante ha chi lo fornisce |

Esito: **stop**, round `grill-me`, attesa di conferma.

Rischi noti: Divi 4.18 è un page builder a shortcode con rendering JavaScript —
il contenuto delle pagine non è HTML semantico; i file in `uploads/` si fermano al
2021 mentre esistono contenuti più recenti, quindi alcuni media potrebbero mancare.
Rientro: se i media mancano, la Fase 1A si chiude ugualmente elencandoli in
`missing-inputs.md`, e il loro recupero diventa un input a suo carico.

---

### Fase 1B — Architettura della migrazione e piano eseguibile

Prerequisiti: approvazione della 1A; D5 e D7 chiuse.

| Wave | Attività | Criterio di "fatto" |
|---|---|---|
| `1B-W1` | ADR su framework API, ORM, storage, struttura admin, autenticazione, editor dei contenuti, modello a blocchi, hosting | una ADR per decisione, con contesto, opzioni, scelta, conseguenze; nessuna ADR senza alternativa scartata |
| `1B-W2` | Schema PostgreSQL per CMS e migrazione | schema in DDL o nel linguaggio dell'ORM scelto, con vincoli, indici e chiavi; ogni tabella riconducibile a un requisito di `requirements-consolidated.md` |
| `1B-W3` | Mapping di dettaglio WordPress → PostgreSQL, campo per campo, incluso SEO da All in One SEO | ogni colonna sorgente ha destinazione o motivo di esclusione |
| `1B-W4` | Specifica dell'importer: idempotenza, dry-run, mapping ID sorgente, report, isolamento errori, rollback | specifica che definisce cosa accade rieseguendo l'import due volte di fila |
| `1B-W5` | Strategia per Gutenberg, shortcode e page builder, e conversione progressiva: HTML sanitizzato per la fedeltà iniziale, blocchi React per l'editabilità | per ogni tipo di shortcode Divi rilevato in 1A, la destinazione dichiarata |
| `1B-W6` | Piano di visual regression, criteri oggettivi di accettazione, piano di deploy, backup e rollback | soglie di diff numeriche e motivate; viewport e versioni di browser fissate |

Esito: **stop** prima di qualunque scaffold, installazione o scrittura di codice.

---

### Fase 1C — Fondazione locale

Prerequisiti: approvazione della 1B.

| Wave | Attività | Criterio di "fatto" |
|---|---|---|
| `1C-W1` | Monorepo pnpm + Turborepo, TypeScript strict, ESLint, Prettier | `pnpm install` e `pnpm lint` completano senza errori su una macchina pulita |
| `1C-W2` | Docker Compose con PostgreSQL e MinIO, `.env.example`, script di backup e restore | `docker compose up` porta i servizi in stato healthy; il restore di un backup ripristina lo stato |
| `1C-W3` | Migrazioni iniziali, health check, CI GitHub Actions minima | la CI è verde sul branch; le migrazioni si applicano su database vuoto |
| `1C-W4` | Moduli minimi Web, API e Admin necessari al solo sito pubblico | l'applicazione si avvia e risponde all'health check |
| `1C-W5` | Fondazione dei test: Vitest, React Testing Library, Playwright, integrazione su PostgreSQL | almeno un test verde per ciascun livello, eseguiti dalla CI |

Esito: **stop** con report.

---

### Fase 1D — Importazione e CMS minimo

Prerequisiti: approvazione della 1C; D3 chiusa.

| Wave | Attività | Criterio di "fatto" |
|---|---|---|
| `1D-W1` | Importer con dry-run, idempotenza, batch, log strutturati, source map, riepilogo e report errori | due esecuzioni consecutive producono lo stesso stato del database; il dry-run non scrive nulla |
| `1D-W2` | Import dei media verso lo storage locale | ogni allegato inventariato in 1A è importato o elencato fra i mancanti con la causa |
| `1D-W3` | Ricostruzione di menu, routing, pagine, articoli, tassonomie, SEO e redirect | ogni URL della matrice risolve come atteso |
| `1D-W4` | CMS minimo per l'editing verificabile | si veda la Fase 1G |
| `1D-W5` | Report automatico di completezza e incongruenze | il report confronta i conteggi importati con l'inventario di 1A e segnala ogni scostamento |

Vincolo: import eseguito **solo** su copie di sviluppo. Nessun import reale senza
conferma puntuale.

Esito: **stop**.

---

### Fase 1E — Ricostruzione React e parità visiva

Prerequisiti: approvazione della 1D; D2 chiusa.

| Wave | Attività | Criterio di "fatto" |
|---|---|---|
| `1E-W1` | Design token e component library ricavati dal sito originale | token estratti dal CSS sorgente, non stimati a occhio |
| `1E-W2` | Tutte le route e i template | ogni URL della matrice ha una route che risponde |
| `1E-W3` | Verifica responsive su desktop, tablet e mobile | nessun overflow orizzontale, nessuna rottura di layout alle viewport concordate |
| `1E-W4` | Screenshot e visual diff Playwright | ogni URL della matrice ha uno screenshot per viewport e un risultato di diff |
| `1E-W5` | Correzione delle difformità senza degradare l'editabilità del CMS | ogni difformità è chiusa oppure documentata con motivazione |
| `1E-W6` | Report QA e matrice URL completata | `docs/qa/visual-parity-report.md` con URL, viewport, stato, risultato diff, problemi, decisione |

Verifiche manuali obbligatorie, non sostituibili dalla diff: interazioni, hover,
menu, form, navigazione mobile, caricamento dei font, immagini, breakpoint, embed,
accessibilità di base.

Esito: **stop** e richiesta di **UAT esplicita**. UAT approvata il 2026-10-18 (DR-210),
fase chiusa il 2026-10-19 (DR-211).

---

### Fase 1G — Collaudo redazionale del CMS

Prerequisiti: 1D e 1E sostanzialmente complete. Si svolge in parallelo alla 1E.

| Wave | Attività | Criterio di "fatto" |
|---|---|---|
| `1G-W1` | Collaudo di editing su contenuti, articoli, media, menu, SEO, redirect, impostazioni globali | per ogni tipo, una modifica reale eseguita dall'interfaccia è visibile sul sito pubblico e sopravvive a un riavvio |

Questa fase non è nell'elenco della direttiva ma è richiesta dalla condizione 7
del gate e dalla skill `cms-editability-qa`. È aggiunta qui esplicitamente perché
il gate non è superabile senza.

---

### Fase 1F — Staging e produzione

Prerequisiti: gate di Fase 1 superato; D6 chiusa; approvazione esplicita.

| Wave | Attività | Criterio di "fatto" |
|---|---|---|
| `1F-W1` | Staging isolato | ambiente raggiungibile, separato dalla produzione, con dati non reali |
| `1F-W2` | Security review, prova di backup e restore, smoke test, test di performance essenziali, piano di rollback | il restore è stato eseguito davvero, non solo documentato |
| `1F-W3` | Proposta di provider e costi reali aggiornati | round `grill-me` con confronto; nessun acquisto senza conferma |
| `1F-W4` | Deploy in produzione | solo dopo approvazione puntuale |
| `1F-W5` | Verifica post-deploy: DNS, SSL, URL, redirect, sitemap, robots, login CMS, media, form, log, health check, backup, restore, monitoraggio | ogni voce con esito registrato |
| `1F-W6` | Report di rilascio firmabile | `docs/deploy/` contiene il report e gli esiti degli smoke test |

Divieti attivi per tutta la fase: nessun acquisto, nessuna modifica DNS, nessun
deploy, nessun invio di email, senza conferma puntuale e non ereditata.

---

## 6. Fasi successive

Non pianificabili, non descrivibili in dettaglio e non avviabili prima
dell'approvazione della Fase 1F: gestione utenti, soci e ruoli; corsi, iscrizioni,
quote, presenze, supervisione; consultorio e appuntamenti; documenti; contabilità e
rendiconti RUNTS; form builder; comunicazioni; analytics e SEO evoluta; PWA o
mobile; hardening, disaster recovery, manuali e formazione.

---

## 7. Rischi e piano di rientro

| # | Rischio | Probabilità | Impatto | Mitigazione | Rientro |
|---|---|---|---|---|---|
| R-01 | Divi genera markup non semantico: la fedeltà visiva richiede di replicare CSS e comportamenti del page builder | alta | alto | Estrarre i token reali dal CSS sorgente in 1E-W1; affrontare per prime le pagine più complesse | Ridurre l'ambito pixel-perfect a un elenco concordato di pagine, con la sua approvazione |
| R-02 | Media successivi al 2021 assenti dal backup | media | medio | Verificarlo in 1A-W2 confrontando i riferimenti con i file presenti | Elenco in `missing-inputs.md`; recupero a suo carico |
| R-03 | Senza istanza WordPress di riferimento non esistono screenshot sorgente | alta | alto | Chiuso da D2 prima della 1E | Se D2 resta aperta, la 1E non parte |
| R-04 | Il dump contiene dati personali reali | certa | alto | Import limitato da D3; dump mai committato, mai pubblicato, mai nei log | Se un dato personale finisce nel repository: stop, rimozione, rotazione dei segreti, verifica della cronologia |
| R-05 | I documenti storici contengono conteggi errati (C-06, C-07, C-08, C-09) | certa | medio | In Fase 1A fa fede solo la sorgente | Nessuno: già mitigato |
| R-06 | Tensione fra fedeltà visiva ed editabilità del CMS: l'HTML fedele è poco editabile, i blocchi React sono editabili ma divergono | alta | alto | Strategia di conversione progressiva definita in 1B-W5; Fase 1G verifica l'editabilità reale | Se le due cose non convivono su una pagina, la decisione è sua, non mia |
| R-07 | Team di una persona: la Fase 1 è lunga e le interruzioni sono probabili | alta | medio | Protocollo `PROGRESS.md` dopo ogni wave; nessuna wave completata viene rieseguita | Alla ripresa, riporto ultima wave completata e wave rimanenti prima di proseguire |

---

## 8. Assunzioni dichiarate

1. La sorgente autorevole per l'audit è il materiale in `source-private/wordpress/`,
   non i documenti storici che lo descrivono.
2. L'export WXR del 2026-03-04 e il dump SQL si riferiscono allo stesso stato del
   sito. Da verificare in 1A-W2.
3. Il sito sorgente è in italiano e monolingua. Nessun plugin multilingua compare
   fra i 18 attivi.
4. La Fase 1 riguarda il **solo sito pubblico** più il CMS necessario a governarlo.
   L'area riservata WordPress (`WP Customer Area`, `/area-riservata/`) non è in
   ambito: la sua ricostruzione appartiene alla fase gestionale.
5. Nessun contenuto è protetto da password o privato, in base ai soli stati
   presenti nell'export. Da riverificare sul dump in 1A-W2.
6. La Fase 1G è necessaria al gate anche se non compare nell'elenco della direttiva.

Nessuna di queste assunzioni autorizza un'implementazione: se una si rivela falsa
in Fase 1A, il piano si ferma e si riapre un round `grill-me`.

---

## 9. Decisioni aperte

Nove, numerate in [`open-questions.md`](open-questions.md): **D1–D4 bloccanti**,
D5–D9 differibili con termine indicato.

Essendo maggiori di zero, **l'esecuzione non inizia**.

---

## 10. Prossimo passo proposto

Risposta alle quattro domande bloccanti **D1–D4**. Alla loro chiusura registro le
decisioni nel registro, creo i tre file di governo se D4 lo consente, e apro la
Fase 1A partendo dalla wave `1A-W1`.
