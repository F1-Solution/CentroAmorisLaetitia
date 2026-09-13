# Decisioni richieste (grill-me) — Round 2

2026-09-13. Il Round 1 è in [`open-questions.md`](open-questions.md).

**Esito del Round 1:** D1 e D4 chiuse; D2 chiusa sullo standard di fedeltà e sulle
sorgenti, **aperta** sul punto dell'istanza di riferimento (prosegue come D2b);
D3 **riaperta**, perché la risposta non copre la domanda posta. Registrate in
[`../decisions/decision-register.md`](../decisions/decision-register.md) le
decisioni DR-012…DR-024.

**Cosa è bloccato:** l'avvio della wave `1A-W1`.

**Cosa ho già verificato da solo:** il backup del 2026-09-13 è un'installazione
WordPress completa (21.350 file, 875 MB); WordPress **7.1**, non 6.9 come dicevano
i documenti storici; Divi 4.18.0 senza child theme; 18 plugin; **1.546** file in
`uploads/`, che ora coprono **2017–2026** — il backup di marzo si fermava al 2021,
e questo chiude il rischio R-02; dump di 11,6 MB con **53 tabelle**, schema
identico a quello di marzo; Docker 29.7.2 e Compose v5.5.0 disponibili; gli agenti
di design (UI Designer, UX Architect, UX Researcher, Brand Guardian, UI Finish-Gate
Reviewer) installati a livello utente. Non chiedo nulla di tutto questo.

---

## Bloccanti

### D2b. Istanza WordPress di riferimento

- **Decisione da prendere:** come produrre gli screenshot sorgente per la parità visiva.
- **Perché è necessaria ora:** senza un WordPress che renda le pagine non esistono
  screenshot sorgente, quindi la Fase 1E non ha criteri di accettazione e il gate
  non è superabile. Istruzioni complete in
  [`../handoff/HO-001-istanza-riferimento-wordpress.md`](../handoff/HO-001-istanza-riferimento-wordpress.md).
- **Opzione A:** la costruisco io in Docker dal backup e dal dump, poi la congelo.
  Tu non esegui alcun comando: serve solo la tua approvazione su tre punti —
  container MySQL/PHP locale, caricamento del dump reale, nessun invio di email.
- **Opzione B:** la avvii tu con un tuo stack PHP/MySQL, seguendo il §6 di HO-001.
- **Opzione C:** solo il sito online, senza riferimento congelato.
- **Raccomandazione:** Opzione A. Docker c'è già, il riferimento resta immutabile
  per tutta la Fase 1E, e non ti costa lavoro. L'Opzione C la userei comunque in
  aggiunta, come controprova su un campione di pagine, mai al posto di A.
- **Impatto:**
  - tempi: A costa mezza giornata a me e nulla a te; B costa tempo tuo; C non costa
    nulla ma allunga la 1E e rende il gate meno oggettivo.
  - costi: nessuno.
  - rischi: con C il sito in produzione cambia durante lo sviluppo e invalida
    confronti già approvati.
  - privacy: A e B caricano il dump reale, con dati personali, in un'istanza locale:
    non esposta in rete, mai committata, distrutta a fine Fase 1E.
  - manutenzione: A e B aggiungono uno strumento di test per la durata della Fase 1.
- **Default vietato:** in assenza di risposta non avvio alcun container, non carico
  alcun dump e non definisco i criteri di accettazione visivi.

---

### D3 (riaperta). Ambito dell'importazione dei dati

- **Decisione da prendere:** **quali classi di contenuto** importare in PostgreSQL.
- **Perché la riapro:** hai risposto «il dump contiene tutto quello che serve», ed è
  vero — ho verificato che il dump è completo. Ma la domanda non era se il dump
  fosse completo: era **quanto** di quel dump portare nel sistema nuovo. Il dump
  contiene anche le compilazioni reali dei form di iscrizione ai corsi e di
  richiesta consulenza, gli account utente con email e hash delle password, i
  commenti, il tracciamento dei download per utente e i log di invio email.
  Importarli significa trattare dati personali in un sistema che non ha ancora
  ruoli, audit log né policy di conservazione. Non lo faccio senza che tu lo dica.
- **Opzione A — minimale:** pagine, articoli, tassonomie, menu, metadati SEO, media
  e redirect. Nessun dato personale. Gli utenti del CMS li crei nuovi, a mano: sono
  pochi.
- **Opzione B — minimale più utenze redazionali:** come A, più i soli account con
  ruolo editoriale, senza password, con reset obbligatorio al primo accesso.
- **Opzione C — estesa:** come B, più le compilazioni storiche dei form e le
  statistiche di download, per conservare lo storico delle iscrizioni ai corsi.
- **Raccomandazione:** Opzione A per la Fase 1, ed è una raccomandazione forte.
  Copre integralmente ciò che serve al sito pubblico, e lo storico delle iscrizioni
  ha senso recuperarlo quando esisterà il modello dati della fase gestionale che lo
  accoglie — non prima, dentro tabelle provvisorie.
- **Impatto:**
  - tempi: A è la più rapida; C aggiunge giorni di mapping e bonifica.
  - costi: nessuno.
  - rischi: C importa dati personali prima che esistano i controlli che li proteggono.
  - privacy: A non tratta dati personali; B ne tratta una quantità minima; C richiede
    base giuridica, informativa e tempi di conservazione definiti, con verifica legale.
  - manutenzione: C lascia nel database dati di cui nessuna funzione ha bisogno.
- **Default vietato:** in assenza di risposta non importo alcun dato personale e non
  progetto tabelle destinate a contenerne.

---

## Differibili

### D10. Ambito e criteri delle proposte di UI e UX per l'area amministrativa

- **Termine:** prima della wave di design della Fase 1B.
- **Decisione da prendere:** su quale perimetro gli agenti di design devono produrre
  le 4 proposte di UI e le 4 di UX (DR-019).
- **Perché non è bloccante ora:** la Fase 1A non tocca il design.
- **Opzione A — perimetro Fase 1:** le proposte coprono solo il CMS (pagine,
  articoli, media, menu, SEO, redirect, impostazioni). Più rapido, ma il design
  potrebbe non reggere quando arriveranno contabilità, appuntamenti e documenti.
- **Opzione B — perimetro completo:** le proposte coprono l'intera area
  amministrativa futura, con il CMS come primo modulo realizzato. Più lento, ma il
  sistema di design nasce già capace di reggere la complessità che hai descritto.
- **Raccomandazione:** Opzione B. Hai detto che il backend è «molto complesso e pieno
  di opzioni»: è esattamente il caso in cui progettare la navigazione sul solo CMS
  porta a rifare tutto alla prima fase gestionale. Progettare per il tutto e
  costruire il CMS non viola il gate, perché il gate vieta di **costruire** le
  funzioni gestionali, non di prevederne lo spazio nella navigazione.
- **Impatto:**
  - tempi: B aggiunge 1–2 giorni alla Fase 1B.
  - costi: nessuno.
  - rischi: A rischia un rifacimento completo del design alla prima fase gestionale.
  - privacy: le proposte usano **solo dati sintetici**, mai contenuti reali.
  - manutenzione: B produce un sistema di design più duraturo.
- **Default vietato:** non avvio gli agenti di design prima di questa decisione.

---

### D11. Metodo per riconfermare le decisioni storiche

- **Termine:** entro la fine della Fase 1B.
- **Decisione da prendere:** come farti riesaminare le decisioni prese nelle sessioni
  precedenti, che hai detto di non ricordare (DR-022).
- **Perché non è bloccante ora:** nessuna di esse serve alla Fase 1A. Restano **non
  vincolanti** finché non le riconfermi, e il registro lo dichiara.
- **Opzione A:** le porto poche per volta, dentro i round `grill-me`, quando la fase
  che le riguarda sta per partire.
- **Opzione B:** un documento unico con tutte le decisioni storiche riesaminate, da
  leggere e approvare in blocco.
- **Raccomandazione:** Opzione A. La B ti costringe a decidere su fasi lontane senza
  il contesto che le rende comprensibili, ed è proprio così che si dimentica perché
  si è deciso qualcosa.
- **Impatto:**
  - tempi: A distribuisce il carico; B lo concentra in una sessione lunga.
  - costi: nessuno.
  - rischi: con A una decisione storica può restare non riconfermata a lungo; lo
    rendo visibile nel registro.
  - privacy: nessuno.
  - manutenzione: A mantiene il registro allineato alle fasi.
- **Default vietato:** non tratto alcuna decisione storica come vincolante finché non
  la riconfermi.

---

### D12. Effetti della scelta PWA sulla Fase 1

- **Termine:** entro la fine della Fase 1B.
- **Decisione da prendere:** se la PWA (DR-017) debba condizionare già il sito
  pubblico, o riguardare solo l'area autenticata dopo il gate.
- **Perché non è bloccante ora:** nessuna delle due strade cambia la Fase 1A.
- **Opzione A:** la PWA riguarda solo l'area autenticata, dopo il gate. Il sito
  pubblico resta un sito, senza service worker né manifest.
- **Opzione B:** manifest e service worker già in Fase 1, con il sito pubblico
  installabile e navigabile offline.
- **Raccomandazione:** Opzione A. Un service worker introduce una cache che può
  servire pagine vecchie e falsare i confronti visivi proprio mentre stai approvando
  la parità: è il momento peggiore per aggiungerlo.
- **Impatto:**
  - tempi: B aggiunge lavoro alla Fase 1E.
  - costi: nessuno.
  - rischi: B rischia di inquinare la visual regression e rende più difficile
    diagnosticare le difformità.
  - privacy: nessuno.
  - manutenzione: B anticipa la gestione delle versioni della cache.
- **Default vietato:** non aggiungo manifest né service worker in Fase 1.

---

## Impatto se si rimanda

- **D2b:** la Fase 1E non ha criteri oggettivi e il gate non è superabile. È il
  rimando più costoso.
- **D3:** lo schema PostgreSQL non è progettabile e la Fase 1B resta ferma. La
  Fase 1A può comunque procedere.
- **D10:** nessun impatto fino alla wave di design della 1B.
- **D11:** le decisioni storiche restano non vincolanti; nessun blocco immediato.
- **D12:** nessun impatto fino alla 1E.
