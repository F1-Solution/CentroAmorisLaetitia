# Decisioni richieste (`grill-me`) — Round 4

2026-09-14, alla chiusura della Fase 1B. I round precedenti sono in
[`open-questions.md`](open-questions.md) e
[`open-questions-round-2.md`](open-questions-round-2.md). Le risposte del **Round 3**
non hanno avuto un documento di domande: sono state date direttamente e registrate
come DR-031…DR-037.

**Cosa è bloccato:** la Fase 1C. Nessuno scaffold, nessuna dipendenza, nessuna
migrazione parte prima di D15.

**Cosa ho già verificato da solo, e su cui non ti chiedo nulla:** lo schema
PostgreSQL applicato davvero su PostgreSQL 17 con i vincoli provati; i 137 nomi di
metadato della sorgente classificati uno per uno; i 10 shortcode del page builder e
i 12 blocchi dell'editor con destinazione dichiarata; le 41 voci di menu
effettivamente pubbliche; i template SEO estratti e la baseline dei metadati
misurata su 117 indirizzi; i 6 redirect da indirizzi storici che nessuno aveva
censito; i 32 rapporti di contrasto delle proposte di design ricalcolati.

Quattro decisioni. Più le cinque domande di design, che stanno nell'handoff
[`../handoff/HO-004-scelta-ui-ux-area-amministrativa.md`](../handoff/HO-004-scelta-ui-ux-area-amministrativa.md)
per non mescolare cose che si scelgono con criteri diversi.

---

## Bloccanti

### D15. Approvazione delle dieci ADR

- **Decisione da prendere:** se approvare le dieci ADR di
  [`../decisions/adr/`](../decisions/adr/), e con quale metodo.
- **Perché è necessaria ora:** D5 e DR-035 vietano qualunque scaffold e qualunque
  dipendenza prima che le ADR siano approvate. Senza questa risposta la Fase 1C non
  parte.
- **Che cosa decidono, in sintesi:** Fastify per l'API · Drizzle per il database ·
  Caddy davanti · media su percorsi nuovi con redirect dai vecchi · contenuti come
  documento a blocchi con blocco di riserva · TipTap dentro i blocchi di testo ·
  sessioni proprie con riesame obbligatorio prima della fase gestionale · due
  applicazioni distinte per sito e amministrazione · Docker Compose su un host ·
  form come dati.
- **Opzione A:** approvarle **in blocco**. Rapido, ma dieci decisioni in una firma.
- **Opzione B:** approvarle **una per una**, dicendo di ciascuna sì, no o «rivedila».
  Più lento, ma è il metodo che il registro delle decisioni presuppone.
- **Opzione C:** approvarne alcune e rimandarne altre. In pratica: le tre chieste da
  te (API, database, proxy) adesso, le altre dopo.
- **Raccomandazione:** **Opzione B**, ma con una precisazione onesta: se leggerle
  tutte è troppo, le tre che pesano davvero sono **ADR-002** (il database, quasi
  irreversibile), **ADR-005** (il modello dei contenuti, la meno reversibile di
  tutte) e **ADR-007** (l'autenticazione, l'unica in cui propongo di scrivere codice
  di sicurezza invece di adottarne). Le altre sette si cambiano in giorni, non in
  settimane.
- **Impatto:**
  - tempi: senza approvazione la Fase 1C è ferma.
  - costi: nessuno. Tutte le tecnologie proposte sono gratuite e autogestite.
  - rischi: ADR-007 è quella con il rischio più alto e lo dichiara apertamente nel
    suo §6; se preferisci una libreria collaudata anche a costo di più peso, dillo e
    si adotta Better Auth.
  - privacy: nessuno diretto.
  - manutenzione: ogni ADR dichiara il proprio costo di ripensamento.
- **Default vietato:** in assenza di risposta non scaffoldo il monorepo, non
  installo alcuna dipendenza, non eseguo alcuna migrazione.

---

### D14. I form del sito incassano pagamenti: cosa ne facciamo

- **Decisione da prendere:** come si comportano, nel primo rilascio, i 25 form di
  iscrizione.
- **Perché è necessaria ora:** hai deciso (DR-032) «form minimale che recapita per
  email». Misurando la sorgente ho scoperto un fatto che non era noto quando l'hai
  deciso: **tutti e 25 i form hanno i pagamenti PayPal attivi**, con importi reali da
  35 a 240 euro. Non sono form di contatto, sono moduli di iscrizione con pagamento.
  Un «form minimale via email» non può riprodurre il pagamento, e i pagamenti sono
  una funzione che il gate colloca dopo, non prima.
- **Opzione A — raccolta senza pagamento:** il form resta identico, senza la parte
  di pagamento. All'invio: «la richiesta è arrivata, sarai ricontattato per il
  pagamento». La segreteria incassa a mano.
- **Opzione B — raccolta più rimando a PayPal:** il form resta identico; dopo
  l'invio compare un collegamento al pagamento PayPal del Centro con l'importo
  indicato. Nessuna riconciliazione automatica: chi ha pagato lo si verifica a mano.
- **Opzione C — parità piena del pagamento:** come oggi. **Richiede una deroga
  esplicita al gate**, perché costruisce in Fase 1 una funzione della fase
  gestionale.
- **Raccomandazione:** **Opzione B**. L'opzione A sposta sulla segreteria un lavoro
  che oggi non fa, su 24 corsi; la B mantiene il percorso della persona che si
  iscrive quasi identico a quello attuale, e lascia manuale solo la verifica, che è
  un compito di controllo e non di sollecito. La C non la raccomando: aprire il
  cantiere dei pagamenti prima del gate è esattamente ciò che il gate esiste per
  impedire.
- **Impatto:**
  - tempi: A e B sono equivalenti, pochi giorni; C aggiunge settimane.
  - costi: nessuno per A e B.
  - rischi: con A e B il rischio è organizzativo, non tecnico, e ricade sulla
    segreteria. Con C il rischio è di governo del progetto.
  - privacy: identica nelle tre: i dati raccolti sono gli stessi di oggi.
  - manutenzione: B aggiunge un collegamento configurabile per form.
- **Default vietato:** in assenza di risposta non pubblico alcun form che appaia
  funzionante senza esserlo, e non costruisco alcun trattamento del campo di
  pagamento.

---

## Differibili, ma con termine

### D13. Difetti di qualità già presenti nel sito attuale

- **Termine:** prima dell'inizio della Fase 1E.
- **Decisione da prendere:** se riprodurre fedelmente alcuni difetti del sito
  attuale, o correggerli.
- **Che cosa ho misurato**, sulle 80 pagine che rispondono:
  - **29 pagine non emettono alcun titolo principale** nel codice. Sono quasi tutte
    quelle costruite con il page builder, che sostituisce il titolo con testo
    formattato. Per chi usa uno screen reader, quelle pagine non hanno un titolo.
  - **45 pagine non hanno la descrizione** che i motori di ricerca mostrano sotto il
    titolo nei risultati.
  - **Nessuna pagina del sito ha un'immagine di anteprima** per la condivisione
    sui social: chi condivide un link vede un rettangolo vuoto.
  - Le pagine 2 e 3 dell'archivio articoli hanno il titolo che finisce con
    «Page 2», in inglese.
- **Opzione A — riprodurre tutto fedelmente**, difetti compresi.
- **Opzione B — correggere i soli metadati non visibili**: descrizione, immagine di
  anteprima, suffisso in italiano. **La pagina resta identica a vedersi.**
- **Opzione C — correggere anche il titolo principale**, restituendolo alle 29
  pagine che non ce l'hanno, reso graficamente identico al testo che oggi lo
  sostituisce.
- **Raccomandazione:** **Opzione C**. Motivo: il difetto del titolo è un problema di
  accessibilità, e il Centro è un ente del terzo settore che si rivolge anche a
  persone con disabilità; correggerlo non costa quasi nulla adesso e costerebbe una
  revisione di 29 pagine dopo. La resa visiva resta la stessa, e ogni pagina toccata
  passa comunque dal confronto al pixel.
  Se preferisci la massima prudenza sulla parità, la B è una scelta difendibile: non
  tocca nulla di visibile.
- **Impatto:**
  - tempi: B è quasi gratuita; C aggiunge una verifica visiva su 29 pagine.
  - costi: nessuno.
  - rischi: A porta avanti un difetto di accessibilità e una SEO peggiore del
    necessario; C introduce un rischio di parità su 29 pagine, che il confronto al
    pixel intercetta.
  - privacy: nessuno.
  - manutenzione: con B e C il CMS nasce con i metadati corretti fin dall'inizio.
- **Default vietato:** in assenza di risposta i metadati non entrano nel giudizio di
  parità: li registro come osservazioni, senza dichiarare né superamento né
  fallimento.

---

### D16. Il foglio di stile per la stampa rientra nella parità?

- **Termine:** prima dell'inizio della Fase 1E.
- **Decisione da prendere:** se la resa in stampa delle pagine debba essere
  confrontata.
- **Perché non è bloccante:** il tema attuale ha un foglio di stile per la stampa,
  ma nessun requisito lo menziona e nessuna misura dice che qualcuno stampi le
  pagine del sito.
- **Opzione A:** fuori perimetro. Non si confronta e non si riproduce.
- **Opzione B:** dentro il perimetro, con confronto su un campione di pagine.
- **Raccomandazione:** **Opzione A**, a meno che tu sappia che qualcuno stampi
  davvero qualcosa dal sito — per esempio i moduli di consulenza. Se è così, dimmi
  quali pagine e le includo, ma come campione, non tutte.
- **Impatto:**
  - tempi: B aggiunge mezza giornata alla Fase 1E.
  - costi: nessuno.
  - rischi: con A, se qualcuno stampasse abitualmente una pagina, la difformità
    emergerebbe dopo il rilascio.
  - privacy: nessuno.
  - manutenzione: trascurabile in entrambi i casi.
- **Default vietato:** non dichiaro la stampa «verificata» se non l'ho confrontata.

---

## Impatto se si rimanda

- **D15:** la Fase 1C non parte. È il rimando che ferma il progetto.
- **D14:** si può progettare e importare tutto il resto dei form, ma nessun form va
  online. In pratica blocca la conclusione della Fase 1E su 23 pagine.
- **D13:** nessun blocco. I metadati restano fuori dal giudizio di parità, e la
  decisione si prende con i confronti in mano, che è anche un buon momento.
- **D16:** nessun blocco.

## Promemoria delle decisioni già aperte e non ancora scadute

| id | Contenuto | Termine |
|---|---|---|
| **D6** | Fornitore, dominio, costi, collocazione dei dati | inizio Fase 1F |
| **D8** | WhatsApp nelle comunicazioni | dopo il gate |
| **MI-06** | Verifica privacy e legale sulle 425 compilazioni | prima della produzione. **Richiede un professionista** |
| **HO-003** | Rimozione della pagina di diagnostica dal sito in produzione | appena puoi |
| **HO-004** | Le cinque domande sul design dell'area amministrativa | prima della Fase 1D |

---

## Esiti — risposte ricevute il 2026-09-14

| id | Risposta dell'utente | Registrata come |
|---|---|---|
| **D15** | Opzione A — **ADR approvate in blocco** | DR-038 |
| **D14** | Opzione B — raccolta più rimando al pagamento PayPal | DR-039 |
| **D13** | Opzione C — metadati corretti **e** titolo principale restituito alle 29 pagine | DR-040 |
| **D16** | Opzione A — foglio di stile per la stampa **fuori perimetro** | DR-041 |
| **HO-003** | Protezione con password anziché cancellazione; file consegnati | DR-042, HO-005 |
| **HO-004** | **Non ancora risposta.** L'utente ha chiesto uno strumento di scelta visiva: prodotto in `docs/design/chooser/` | — |
| Push di Fase 1B | Autorizzata, e autorizzata in via permanente al commit finale di ogni fase | DR-043 |

Le tre raccomandazioni disattese vanno dette: su **D15** raccomandavo l'approvazione
una per una e l'utente ha scelto il blocco; le precisazioni su ADR-007 e ADR-009
restano scritte nelle ADR e valgono comunque. Su **D13** e **D16** la scelta coincide
con la raccomandazione. Su **D14** pure.

Restano aperte **D6** (fornitore, termine Fase 1F), **D8** (WhatsApp, dopo il gate),
**MI-06** (verifica legale, richiede un professionista) e **HO-004** (cinque domande
di design, termine prima della Fase 1D).
