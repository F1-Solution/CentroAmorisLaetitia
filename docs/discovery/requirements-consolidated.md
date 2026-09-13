# Requisiti consolidati — Centro per la Famiglia Amoris Laetitia

Consolidamento di sola lettura dei documenti storici in `source-private/planning/`.
Fonte primaria: `docs/prompt_iniziale.md`. Le **scelte tecnologiche** dei documenti
storici non sono riportate qui come requisiti: stanno in
[`legacy-to-target-mapping.md`](legacy-to-target-mapping.md).

Legenda stato: **V** = vincolante e confermato · **S** = superato dalla nuova
direttiva tecnologica · **A** = ambiguo, serve decisione (vedi `open-questions.md`).

---

## 1. Contesto e vision

Il Centro Amoris Laetitia è un consultorio familiare del terzo settore, con sede a
Terni, in cui operano volontari. Eroga consulenze familiari e corsi aperti alla
cittadinanza (autoconsapevolezza, genitorialità, formazione per consulenti familiari).

| ID | Requisito | Stato |
|---|---|---|
| RB-01 | Sistema a **tenant singolo**: gestisce un solo centro | V |
| RB-02 | Utenti simultanei previsti **< 100**; ~100 documenti/mese | V |
| RB-03 | Team di sviluppo: **1 persona** | V |
| RB-04 | Disponibilità *best effort*; risposte < 3 s, preferibile < 1 s | V |
| RB-05 | Sito pubblico + area autenticata; il sito attuale è la referenza grafica | V |
| RB-06 | Il software deve coprire sito, gestionale e (futuro) desktop/mobile | V |

---

## 2. Ruoli e autorizzazioni

| ID | Requisito | Stato |
|---|---|---|
| RU-01 | Ruoli: amministratore, consiglio direttivo, direttore/direttrice, segreteria, tesoriere, docenti/formatori, utenti dei corsi, consulenti familiari (volontari), utenti delle consulenze, soci | V |
| RU-02 | **Ruoli multipli per la stessa persona** (es. amministratore + tesoriere + segretario + socio) | V |
| RU-03 | Utenti anonimi esistono solo sul sito pubblico | V |
| RU-04 | Gli **utenti delle consulenze non devono comparire negli elenchi utenti**; visibili solo ad amministratore e segreteria | V — vincolo privacy forte |
| RU-05 | Audit log obbligatorio: chi, quando, quale operazione, per ogni operazione di backend | V |

---

## 3. Sito pubblico e CMS *(ambito della Fase 1 — l'unica autorizzata)*

| ID | Requisito | Stato |
|---|---|---|
| RC-01 | Il nuovo sito deve riprodurre l'aspetto del sito WordPress attuale; **il menu del frontend sarà uguale** | V |
| RC-02 | Standard di fedeltà: il prompt storico dice "simile"; la direttiva attuale impone **pixel-perfect provato** | **A** — vedi D2 |
| RC-03 | CMS interno per creare/modificare pagine, menu, foto, contenuti | V |
| RC-04 | Gestione SEO per pagina: title, meta description, og:title, og:description, og:image, canonical, slug editabile | V |
| RC-05 | Sitemap XML automatica, `robots.txt` configurabile, breadcrumb JSON-LD | V |
| RC-06 | Markup Schema.org: Organization, LocalBusiness, Event, Course | V |
| RC-07 | Redirect 301 dagli URL storici; preservazione della struttura degli slug | V |
| RC-08 | Performance: PageSpeed > 80, immagini WebP, lazy loading | V |
| RC-09 | Parole chiave target: consultorio familiare Terni, consulenza familiare Terni, corsi per genitori Terni, corsi di coppia Terni, consulenti familiari Umbria, Centro Amoris Laetitia | V |
| RC-10 | Analytics GA4 già in uso sul sito sorgente (ID di misurazione documentato in `prompt_iniziale.md`) | V |
| RC-11 | Sede da riportare nei contatti/mappa: Piazza del Duomo 11, 05100 Terni | V |

---

## 4. Anagrafica e profilo *(fase gestionale — dopo il gate)*

| ID | Requisito | Stato |
|---|---|---|
| RA-01 | Anagrafica completa per ogni persona; consenso GDPR **raccolto prima** dei dati | V |
| RA-02 | Dall'anagrafica si ricavano **registro volontari** (Codice del Terzo Settore) e **libro soci** | V |
| RA-03 | Profilo utente con nome, cognome, email, telefono, indirizzo, data di nascita, codice fiscale | V |
| RA-04 | **Precompilazione automatica** dei form dal profilo, con possibilità di modifica prima dell'invio | V |
| RA-05 | Quota sociale annuale entro il 30 aprile; pagamenti da ottobre in poi valgono per l'anno successivo | V |

---

## 5. Appuntamenti, consulenze, stanze *(fase gestionale)*

| ID | Requisito | Stato |
|---|---|---|
| RP-01 | Una consulenza può avere **1–2 consulenti** e **1+ utenti** | V |
| RP-02 | Il consulente propone una data che **tutti gli attori devono accettare** | V |
| RP-03 | La **segreteria è sempre avvisata** | V |
| RP-04 | Check di disponibilità stanze prima di inserire evento o consulenza | V |
| RP-05 | Regola stanze: 3 stanze → max 3 consulenze, oppure 2 consulenze + 1 gruppo; **mai più di un gruppo contemporaneamente** (gruppo = corso da 8 persone in su) | V |
| RP-06 | Le regole stanze devono essere **configurabili da interfaccia admin**, non hardcoded | V |
| RP-07 | Sincronizzazione con uno o più calendari Google | V |
| RP-08 | Ogni evento ha titolo, luogo con coordinate GPS, link Google Maps | V |
| RP-09 | Calendario filtrato per area di interesse: gli iscritti a un corso vedono il corso; le consulenze le vedono solo i consulenti di quella consulenza, gli utenti coinvolti, il direttore e la segreteria | V — vincolo privacy forte |

---

## 6. Corsi, eventi, form *(fase gestionale)*

| ID | Requisito | Stato |
|---|---|---|
| RF-01 | Form di iscrizione per ogni corso; calendario eventi; registro presenze | V |
| RF-02 | Campi minimi per corso: nome, cognome, indirizzo, telefono, email | V |
| RF-03 | **Form builder** con campi: testo, email, telefono, data, numero, textarea, dropdown, checkbox, radio, upload file, firma digitale | V |
| RF-04 | Campi obbligatori e validazioni configurabili | V |
| RF-05 | **Template di form** duplicabili e modificabili per corso | V |
| RF-06 | Collegamento form ↔ corso/evento; risposte aggregate scaricabili in Excel/CSV | V |
| RF-07 | Pagamento online integrato nel form di iscrizione | V |
| RF-08 | Gruppi: uno per corso, più gruppi definibili dall'utente (es. equipe volontari) | V |
| RF-09 | La segreteria può inviare messaggi ai singoli gruppi/corsi da ogni client | V |
| RF-10 | **QR code per corso/evento** che punta a una pagina con tracking dello scan prima del redirect | V |
| RF-11 | **Supervisione**: evento speciale riservato a consulenti familiari, tirocinanti e allievi del 3º anno se autorizzati; chi la tiene va pagato come i docenti | V |

---

## 7. Documentazione e documenti *(fase gestionale)*

| ID | Requisito | Stato |
|---|---|---|
| RD-01 | Tipi di documento: verbali CdA, verbali equipe, verbali assemblea, documenti contabili, bilanci interni, bilanci RUNTS, bandi di gara, documenti corsi/progetti | V |
| RD-02 | Upload in immagine, PDF, PDF scansionato; **OCR** su immagini e scansioni | V |
| RD-03 | Documenti prelevabili e archiviabili su **Google Drive** | V |
| RD-04 | Gruppi di documenti con ruoli abilitati in lettura e scrittura | V |
| RD-05 | Permessi anche per singolo utente su singolo documento | V |
| RD-06 | Ogni utente può caricare file propri e sceglierne la visibilità | V |
| RD-07 | Documenti di corsi e progetti accessibili solo all'equipe volontari | V |

---

## 8. Comunicazioni *(fase gestionale)*

| ID | Requisito | Stato |
|---|---|---|
| RM-01 | Newsletter interna (sostituto di Mailchimp) con database contatti | V |
| RM-02 | Iscrizione newsletter dal sito con **target multipli** (scuole, parrocchie, istituzioni, corsisti, …) | V |
| RM-03 | Ricevuta automatica per ogni pagamento | V |
| RM-04 | Conferma automatica per ogni iscrizione a corso | V |
| RM-05 | Testi email redigibili e persistiti a database | V |
| RM-06 | Promemoria il giorno prima degli appuntamenti, canale a scelta dell'utente (app / email / SMS) | V |
| RM-07 | Provider SMS con tier mensile gratuito | A — provider da scegliere |
| RM-08 | Invii filtrati per tag (es. chi ha frequentato un certo corso in passato) | V |
| RM-09 | Promemoria tesoriere: pagamento fatture, singole lezioni corso consulenti, Training Group, docenti | V |
| RM-10 | Promemoria tesoriere: dal 1º marzo, ogni giorno, richiesta Certificazioni Uniche ai fornitori finché non caricate a DB | V |
| RM-11 | Promemoria tesoriere: dal 1º ottobre, ogni giorno, richiesta 770 finché non pagato e ricevuta caricata | V |
| RM-12 | Comunicazioni via **WhatsApp** previo consenso | **A** — la ADR storica lo esclude, `prompt_iniziale` lo chiede |
| RM-13 | Notifiche push browser e mobile | V |

---

## 9. Pagamenti *(fase gestionale)*

| ID | Requisito | Stato |
|---|---|---|
| RG-01 | Pagamenti online sul sito, a basso costo di commissione | V |
| RG-02 | PayPal più una seconda piattaforma (Stripe indicato nei documenti) | V |
| RG-03 | Pagamenti singoli (iscrizione corso, quota associativa) e ricorrenti (quota annuale con reminder) | V |
| RG-04 | Utilizzabile sia dal web sia dall'app | V |

---

## 10. Contabilità *(fase gestionale)*

| ID | Requisito | Stato |
|---|---|---|
| RT-01 | Conversione **automatica** bilancio interno → bilancio RUNTS | V |
| RT-02 | Mappatura categoria interna → categoria RUNTS **editabile da database** | V |
| RT-03 | Base: Rendiconto per Cassa **Mod. D** (modello ufficiale presente in `modelli/`) | V |
| RT-04 | Import report bancari con scansione e **categorizzazione automatica**; se la categoria è nuova, chiedere al tesoriere | V |
| RT-05 | Import movimenti PayPal, preferibilmente via API mensile | V |
| RT-06 | Un clic per scaricare o inviare al commercialista le fatture per le Certificazioni Uniche | V |
| RT-07 | Funzioni tipo Socius: Prima Nota, anagrafica soci/clienti/fornitori/collaboratori, Rendiconto per Cassa Mod. D, scadenzario pagamenti e ritenute, attività e iscrizioni, compensi collaboratori, **centri di costo**, stampe PDF/Excel, import/export, **backup giornaliero** | V |

---

## 11. Social e statistiche *(fase gestionale)*

| ID | Requisito | Stato |
|---|---|---|
| RS-01 | Pubblicazione articolo sul sito e, con un clic o schedulata, su Facebook, Instagram e LinkedIn | V |
| RS-02 | Testo personalizzabile per canale; allegati immagine e video; stato per canale (pubblicato / in attesa / errore) | V |
| RS-03 | Gestione e rinnovo automatico dei token OAuth per piattaforma | V |
| RS-04 | Statistiche annuali o su intervallo libero (es. anno scolastico settembre–giugno) di corsi, eventi e iscritti | V |
| RS-05 | Dashboard admin con statistiche di utilizzo del sito da GA4 | V |
| RS-06 | Telemetria applicativa real-time (request rate, errori, performance) in dashboard | V — il **provider** indicato nei documenti storici è superato |

---

## 12. Requisiti non funzionali e privacy

| ID | Requisito | Stato |
|---|---|---|
| RN-01 | GDPR classico su tutta l'anagrafica | V |
| RN-02 | Gli utenti delle consulenze firmano un **consenso informato**; l'elenco dei fruitori è **dato sensibile equiparato a privacy medica** | V — massima priorità |
| RN-03 | Audit log su ogni operazione di backend | V |
| RN-04 | Operazioni batch e notturne (invii schedulati, letture dati esterni) | V |
| RN-05 | Backup giornaliero | V |
| RN-06 | Codice: commenti e messaggi utente in italiano; documentazione in italiano | V — indipendente dallo stack |
| RN-07 | Naming DB in italiano snake_case | **A** — da riconfermare con l'ORM Node (vedi D7) |

---

## 13. Documentazione richiesta *(dopo il gate, salvo la guida sviluppatore)*

| ID | Documento | Stato |
|---|---|---|
| RQ-01 | Manuale utente — sito web | V |
| RQ-02 | Manuale utente — app mobile | V — rinviato con la fase mobile |
| RQ-03 | Manuale amministratore | V |
| RQ-04 | Guida sviluppatore | V — da riscrivere per lo stack Node.js / Next.js |

---

## 14. Requisiti che la Fase 1 deve soddisfare per intero

Sottoinsieme effettivamente in ambito ora: **RB-01…06, RU-03, RC-01…11, RN-06**,
più i requisiti di editabilità redazionale derivati da RC-03 (pagine, articoli,
media, menu, SEO, redirect, impostazioni globali).

Tutto il resto è **fuori ambito** fino al superamento del gate di Fase 1.

---

## 15. Verifiche legali e professionali necessarie

Nessuna dichiarazione di conformità è possibile senza validazione umana. Richiedono
verifica esterna:

- trattamento dei dati delle consulenze (art. 9 GDPR) e conservazione del consenso informato;
- tempi di conservazione e cancellazione dei dati personali;
- adempimenti RUNTS e correttezza del Rendiconto per Cassa Mod. D;
- adempimenti fiscali (Certificazioni Uniche, 770) e ritenute sui compensi;
- registro volontari e libro soci secondo il Codice del Terzo Settore;
- informativa cookie e consenso analytics sul sito pubblico.
