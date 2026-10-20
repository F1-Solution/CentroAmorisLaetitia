# Schema PostgreSQL — Fase 1B, wave `1B-W2`

Forma canonica in [`schema.sql`](schema.sql). Questo documento spiega **perché** lo
schema è fatto così e dimostra che ogni tabella risponde a un requisito.

| | |
|---|---|
| **Stato** | **proposta** — nessuna migrazione viene eseguita prima dell'approvazione delle ADR (D5, DR-035) |
| **Convenzione** | inglese `snake_case` (DR-036, supera DR-H05 e RN-07) |
| **Perimetro** | sito pubblico e CMS minimo della Fase 1 (DR-033). Nessuna tabella della fase gestionale |
| **Verifica eseguita** | lo schema è stato **applicato per intero su PostgreSQL 17** in un container temporaneo, poi distrutto. Esito: nessun errore |

---

## 1. Verifica già fatta

Non è uno schema scritto a mano e mai provato. È stato applicato davvero, e sono
stati provati i vincoli che contano:

| Prova | Esito |
|---|---|
| Applicazione completa dello schema su PostgreSQL 17 | ✅ nessun errore |
| I **107 percorsi reali** di pagine e articoli, presi da `url-matrix.csv`, rispettano il vincolo di forma di `contents.path` | ✅ 107 su 107 |
| Un contenuto `published` senza data di pubblicazione | ✅ **rifiutato** |
| Un articolo con un contenuto padre | ✅ **rifiutato** |
| Una voce di menu di tipo `content` che punta a un URL | ✅ **rifiutata** |
| Un media con percorso pubblico fuori da `/media/` | ✅ **rifiutato** |
| Ricerca full-text in italiano su testo di prova sintetico | ✅ funzionante, con radici |

I dati usati nelle prove sono **sintetici** e il database è stato distrutto.

## 2. Come è organizzato

| # | Gruppo | Tabelle | Requisiti |
|---|---|---|---|
| 1 | Persone, ruoli, sessioni, audit | `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions`, `audit_log` | RU-01, RU-02, RU-05, RN-03 |
| 2 | Media | `media`, `media_variants` | RC-03 |
| 3 | Contenuti | `contents`, `content_revisions`, `content_drafts` | RC-01, RC-03, DR-068 |
| 4 | Tassonomie | `terms`, `content_terms` | RC-01, RC-03 |
| 5 | Menu | `menus`, `menu_items` | RC-01, RC-03 |
| 6 | SEO | `seo_templates`, `content_seo`, `term_seo` | RC-04, RC-05, RC-06 |
| 7 | Redirect | `redirects` | RC-07 |
| 8 | Form | `forms`, `form_notifications`, `form_submissions` | parità delle 23 pagine con form |
| 9 | Documenti e carosello | `documents`, `document_terms`, `sliders`, `slider_slides` | parità |
| 10 | Impostazioni | `settings` | RC-03, RC-05, RC-09, RC-10, RC-11 |
| 11 | Migrazione | `import_runs`, `import_id_map`, `import_issues` | idempotenza dell'import |
| 12 | Conservazione legacy | `legacy_email_log`, `legacy_download_stats` | DR-026 |

**33 tabelle.** Nessuna riguarda appuntamenti, corsi, soci, contabilità o documenti
riservati oltre alla conservazione: il gate vieta di costruirle e lo schema lo
rispetta.

> **Correzione dichiarata del 2026-09-20.** Erano 32. **DR-068** aggiunge
> `content_drafts`, le copie di lavoro dell'editor, con la migrazione `0002`. È la
> seconda modifica a uno schema approvato in Fase 1B dopo DR-059, e come quella
> avviene **con una decisione registrata**, non di iniziativa. La stessa migrazione
> aggiunge `sessions.active_role_id` e due colonne ad `audit_log` per **DR-067**.

## 3. Tracciabilità completa: ogni tabella a un requisito

| Tabella | Requisito o decisione | Perché esiste |
|---|---|---|
| `users` | RU-01, DR-033 | Il primo rilascio ha un CMS: serve chi vi accede |
| `roles`, `user_roles` | **RU-02** | Più ruoli sulla stessa persona. Dalla wave `1G-W1` i ruoli sono due: `editor`, etichetta «Redazione», e `amministrazione` (DR-220, DR-229, migrazione `0008`). La relazione esisteva già: aggiungerla dopo costerebbe una migrazione su dati reali |
| `permissions`, `role_permissions` | RU-01 | Le autorizzazioni si esprimono come permessi, mai confrontando il nome del ruolo (ADR-007 §3.2). Otto permessi (DR-227): `content.read`, `content.write`, `content.publish`, `media.write`, `settings.write` della redazione; `users.manage`, `audit.read`, `site.settings.write` dell'amministrazione |
| `sessions` | ADR-007 | Sessioni opache revocabili; si conserva il digest, mai il token |
| `audit_log` | **RU-05, RN-03** | Obbligatorio dal primo giorno. Append-only |
| `media` | RC-03, ADR-004 | 170 allegati |
| `media_variants` | ADR-004 §3.2 | Le dimensioni derivate sono referenziate nei `srcset`: servirle sbagliate cambia il layout |
| `contents` | RC-01, RC-03, ADR-005 | Pagine e articoli, come documento a blocchi |
| `content_revisions` | RC-03 | Cronologia redazionale. Le 837 revisioni di WordPress **non** si importano |
| `content_drafts` | **DR-068** | Copia di lavoro su cui l'editor salva da solo. Il contenuto pubblicato cambia solo su comando, ed è per questo che il criterio 1D-36 si verifica su `contents`. Una copia per persona e per contenuto: ADR-006 §3.2 rimanda la modifica collaborativa |
| `terms`, `content_terms` | RC-01 | 2 categorie, 0 tag |
| `menus`, `menu_items` | **RC-01** | «Il menu del frontend sarà uguale». 64 voci, 41 pubbliche |
| `seo_templates` | RC-04, RC-05, R-10 | Si migrano le **regole**, non i 282 record |
| `content_seo`, `term_seo` | **RC-04** | Sovrascrittura per contenuto. Nasce quasi vuota, ed è corretto |
| `redirects` | **RC-07**, DR-034 | 180 regole, come dati modificabili dal CMS |
| `forms`, `form_notifications` | ADR-010 | 25 definizioni, 39 notifiche |
| `form_submissions` | DR-026 | 425 compilazioni. **Dati personali**, vedi §7 |
| `documents` | parità, DR-033 | 4 moduli pubblici più 4 file riservati conservati |
| `document_terms` | parità | Classificazione dei documenti scaricabili, con la stessa tassonomia dei contenuti |
| `sliders`, `slider_slides` | parità | 1 carosello, 12 slide |
| `settings` | RC-03, RC-05, RC-10, RC-11 | Impostazioni globali modificabili |
| `import_runs`, `import_id_map`, `import_issues` | 1B-W4 | Rendono l'import **rieseguibile** e le anomalie **contate** |
| `legacy_email_log`, `legacy_download_stats` | DR-026 | Solo conservazione. Nessuna funzione le usa |

## 4. Le scelte che meritano una spiegazione

### 4.1 Un'unica tabella `contents` per pagine e articoli

Pagine e articoli differiscono per gerarchia, tassonomie e presenza negli archivi —
non per struttura. Due tabelle quasi identiche significherebbero due volte ogni
query, ogni indice, ogni componente. Un `CHECK` impedisce agli articoli di avere un
padre, perché nella sorgente nessuno ce l'ha.

### 4.2 `path` materializzato e unico

L'instradamento è la parte più visitata del sito. Un percorso materializzato e unico
risolve una richiesta con un indice, invece di risalire la gerarchia a ogni
richiesta. Costo: va ricalcolato quando un contenuto cambia genitore o slug — con 78
pagine è un'operazione da millisecondi, ed è il momento giusto per creare in
automatico il redirect dal vecchio percorso (RC-07).

Il vincolo di forma è stato provato sui 107 percorsi reali: li accetta tutti.

### 4.3 `search_vector` come colonna generata

Se fosse aggiornato dall'applicazione, prima o poi qualcuno inserirebbe una riga
senza aggiornarlo e la ricerca perderebbe contenuti in silenzio. Come colonna
generata **non può divergere**. La configurazione è `italian`: cerca «famiglia» e
trova «famiglie».

### 4.4 Tre colonne per il contenuto: `blocks`, `content_html`, `content_text`

Non è ridondanza, sono tre usi diversi (ADR-005 §3.6):

| Colonna | Ruolo | Chi la scrive |
|---|---|---|
| `blocks` | **la verità** | l'editor |
| `content_html` | cache di resa, per confronti | rigenerata a ogni salvataggio |
| `content_text` | solo testo, per ricerca e per la description generata dai template | rigenerata a ogni salvataggio |

Se divergono, hanno ragione i blocchi.

### 4.5 `menu_items.visibility` invece di un booleano

Perché la sorgente ha **quattro** casi distinti, misurati in `1B-W0` §3: pubblica
(41 voci), nascosta a tutti (20), visibile ai soli autenticati (1), limitata a ruoli
specifici (2). Un booleano ne perderebbe due, e con essi il motivo per cui quelle
voci esistono.

Un `CHECK` impedisce di elencare ruoli quando la visibilità non li usa: è il tipo di
incoerenza che, senza vincolo, si accumula in silenzio.

### 4.6 `redirects` come tabella e non come configurazione del proxy

RC-07 chiede redirect gestibili; ADR-003 §3 tiene il proxy fuori dal dominio
applicativo. Con 180 regole, tenerle in un file significherebbe un rilascio per ogni
correzione. `kind = 'prefix'` consente **una sola** regola per gli oltre 1.500 file
dei media, invece di 1.546.

### 4.7 `forms.requires_payment`

È un vincolo di sicurezza travestito da colonna. La decisione D14 sui pagamenti è
aperta (R-19): finché non è risolta, nessun form con pagamento deve apparire
funzionante. La colonna consente al sito di rifiutarsi di renderlo, invece di
affidarsi al fatto che qualcuno si ricordi.

### 4.8 `legacy_*`: conservare senza fingere di usare

DR-026 dice di importare tutto. Mettere i log di invio email in una tabella
`email_log` suggerirebbe che il sistema li usi: non è vero. Il prefisso `legacy_`
dichiara che sono dati conservati e non alimentati, e che **la loro cancellazione è
un tema aperto** (MI-06), non una dimenticanza.

## 5. Cosa lo schema **non** contiene, e perché

| Assente | Motivo |
|---|---|
| Commenti | 0 in tutto il sito, chiusi di default (`1B-W0` §8.8) |
| Tag | tassonomia presente ma 0 termini usati; la struttura li regge senza tabelle dedicate |
| Appuntamenti, stanze, corsi, soci, contabilità, documenti con permessi fini | **fase gestionale**, vietata dal gate |
| Utenti delle consulenze | RU-04. Non esistono in Fase 1, e quando esisteranno non staranno in `users` con gli altri |
| Pagine di archivio degli articoli | `page_for_posts = 0`: non esiste nella sorgente, non va inventata (`1B-W0` §8.2) |
| Tabelle per `event_listing` e `cuar_log_event` | plugin disattivati, residui senza effetto pubblico (1A §5) |
| Multilingua | il sito è solo `it_IT` |
| Segreti e chiavi API | stanno in variabili d'ambiente (ADR-009 §4.3), mai a database |

## 6. Volumi attesi dopo l'import

| Tabella | Righe attese |
|---|---|
| `contents` | 108 (78 pagine + 29 articoli + 1 bozza) |
| `media` | **178** (170 dalla fase `media` + 8 create dalla fase `documents`: 4 pubblici da `uploads/download-manager-files/` per DR-060, 4 riservati da `wp-content/customer-area/storage/` per DR-058) |
| `media_variants` | circa 1.376 |
| `terms` | **4** (2 `category` + 1 `wpdmcategory` + 1 `cuar_private_file_category` — DR-061) |
| `menu_items` | **64** |
| `redirects` | **181** (170 allegati + 4 documenti + 6 slug storici + 1 con carattere jolly). Rivisto il 2026-09-30: era 180 perché l'allegato 341 non si ritrovava, e DR-065 lo recupera |
| `forms` | 26 — 25 di WPForms più il modulo di contatto di Divi (DR-094, 2026-10-07) |
| `form_notifications` | 40 — 39 di WPForms più quella del modulo di contatto di Divi (DR-098, 2026-10-07) |
| `form_submissions` | **425** |
| `documents` | 8 (4 pubblici + 4 riservati) |
| `slider_slides` | 12 |
| `users` | 1 |
| `seo_templates` | circa 7 |
| `content_seo` | **2** — e va bene così: la sorgente ha 2 title personalizzati |

Sono numeri **verificabili**: la Fase 1D li confronta uno per uno e l'import non si
dichiara riuscito se non coincidono.

## 7. Privacy e dati personali

Tre tabelle contengono dati personali reali dopo l'import:

| Tabella | Righe | Natura |
|---|---|---|
| `form_submissions` | 425 | iscrizioni a corsi e richieste di consulenza. **Categoria che RN-02 equipara alla privacy medica** |
| `legacy_email_log` | 187 | destinatari di email |
| `users` | 1 | l'unico account amministratore |

Regole vincolanti, che valgono dal primo giorno:

1. Nessuna riga di queste tabelle entra in documentazione, log applicativi,
   screenshot, fixture o Git (DR-010).
2. `audit_log.detail` **non** contiene dati personali di terzi: contiene
   identificatori, non contenuti.
3. Indirizzi IP solo come digest con sale, mai in chiaro — in `sessions`,
   `audit_log`, `form_submissions`.
4. In Fase 1 le compilazioni sono leggibili solo con il permesso
   `submissions.read`, che ha il solo amministratore.
5. Cifratura a riposo, tempi di conservazione e procedura di cancellazione
   **richiedono validazione legale** (MI-06) prima della produzione. Qui non si
   dichiara alcuna conformità.
6. `content_drafts` conserva versioni intermedie di contenuti redazionali. Non
   contiene dati personali di terzi, ma è **materiale non pubblicato**: rientra
   nelle regole di conservazione del punto 5, e la wave `1D-W8a` dichiara quando
   una copia di lavoro viene eliminata (DR-068).

## 8. Punti che restano aperti

| # | Questione | Dove si chiude |
|---|---|---|
| 1 | Campo `payment-single` dei form: cosa se ne fa | decisione **D14**, ADR-010 §6 |
| 2 | Se riprodurre o correggere i difetti di metadati della sorgente | decisione **D13**, R-18 |
| 3 | Se il ruolo attivo è uno per volta o è l'unione dei permessi | domanda delle proposte di UX; lo schema regge entrambe |
| 4 | Conservazione e cancellazione delle 425 compilazioni | MI-06, **validazione legale** |
| 5 | Cifratura a riposo delle tabelle con dati personali | Fase 1F, con la security review |

## 9. Verifica prevista

**Fase 1C:** lo schema Drizzle di `packages/db` genera una migrazione iniziale che
corrisponde a questo file; la migrazione si applica da zero su un database vuoto e
si riesegue senza errori.

**Fase 1D:** i volumi del §6 coincidono; `import_issues` non contiene righe di
gravità `error`; `import_id_map` copre ogni riga importata.

**Fase 1F:** security review sulle tre tabelle del §7; nessun indirizzo IP in chiaro
in alcuna tabella.
