# MI-06 — Bozza di risposta alle domande del §6

**Preparato dal:** manutentore del sistema, il 2026-11-07, come supporto alla verifica MI-06.
**Natura del documento:** bozza di lavoro con le risposte alle domande 1–13 del §6 del documento
MI-06, nella forma richiesta dal §8 (Domanda / Risposta / Testo / Priorità / Azione).

> **Avvertenza.** Questa bozza non è un parere legale e non sostituisce la verifica del
> professionista incaricato (DR-303). È un documento di lavoro: le risposte sono proposte di
> regola da confermare, correggere o scartare, sulla base di GDPR, linee guida del Garante
> per la protezione dei dati personali e prassi correnti. Dove la risposta dipende da scelte
> del Centro (per esempio finalità fiscali residue) è indicato esplicitamente.

**Legenda.** Priorità: **P** = prima della messa in produzione; **S** = può seguire, con
termine indicato. Azione: **Centro** (contratti, nomine, registro), **Manutentore**
(regole tecniche del sistema), **Centro + Manutentore** quando serve una decisione congiunta.

---

## 6.1 Base giuridica

| Domanda | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **1a** — base giuridica delle 425 compilazioni storiche | Iscrizioni a corsi/seminari a pagamento: art. 6.1.b (misure precontrattuali su richiesta dell'interessato). Adesione all'associazione: art. 6.1.b (gestione del rapporto associativo). Il contesto «consultorio» **non** rende automaticamente i dati categorie particolari ex art. 9: l'art. 9 si applica solo se i dati rivelano per loro natura salute, vita sessuale, convinzioni ecc. I dati anagrafici e di contatto di un iscritto a un corso non lo sono; **possono** esserlo i campi di testo libero. Poiché il Centro equipara questi dati a dati sanitari (RN-02) e il contenuto non è verificato, la regola operativa proposta è: trattarli **come se** potessero contenere categorie particolari (minimizzazione, accessi limitati, cancellazione anticipata — vedi domanda 2). **Trasferimento al nuovo sistema:** stesso titolare, stesse finalità, stesso supporto (database): non serve consenso nuovo né passaggio specifico. Va verificato che l'informativa pubblicata all'epoca coprisse la conservazione per finalità amministrative; se inadeguata, l'informativa aggiornata del nuovo sito (domanda 5a) copre il proseguimento del trattamento, con nota in pagina che i dati di iscrizioni pregresse sono conservati solo per finalità amministrative e fiscali. | Nota da inserire nell'informativa: vedi Allegato A, §A1 | P (la verifica dell'informativa storica); S (60 giorni) per la nota agli interessati, se il professionista la ritiene necessaria | Manutentore (verifica testi storici); Centro (decisione su eventuale comunicazione agli interessati) |
| **1b** — base giuridica delle nuove compilazioni | Moduli di iscrizione a corsi: art. 6.1.b. Modulo di adesione all'associazione: art. 6.1.b. Modulo di contatto: art. 6.1.b (richiesta dell'interessato) oppure art. 6.1.f; non serve consenso. Non ci sono finalità di profilazione o newsletter: nessun consenso richiesto per l'iscrizione in sé. Per i campi di testo libero (40 occorrenze), che possono raccogliere categorie particolari: ridurre al minimo i campi e inserire l'avviso di non inserire informazioni su salute o terze persone (Allegato A, §A2). Se un modulo dovesse richiedere dati ex art. 9 in modo strutturato, la base diventa il consenso esplicito ex art. 9.2.a: da valutare caso per caso. | Avviso per i campi di testo libero: Allegato A, §A2 | P | Manutentore (campi e avvisi nei moduli) |
| **1c** — base giuridica delle notifiche email | L'invio delle notifiche alla casella del Centro è parte del trattamento di gestione dell'iscrizione: stessa base giuridica del modulo corrispondente (1b). Non è una comunicazione a terzi: il Centro è unico destinatario. Il punto critico non è la base ma il **canale**: la posta elettronica viaggia in chiaro fra i server — vedere domanda 11 sulla riduzione del contenuto delle email. | — | P (la decisione sul contenuto delle email, domanda 11) | Manutentore |

## 6.2 Conservazione e cancellazione

| Domanda | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **2** — le 425 compilazioni storiche: conservare, ridurre, cancellare | Regola proposta: **ridurre**, non conservare integralmente. Le finalità residue sono solo gli obblighi fiscali/contabili sulle somme incassate (conservazione dei documenti contabili: 10 anni, art. 2220 c.c.); non esistono finalità di contatto (la newsletter non è riprodotta). Procedura: (1) conteggio per anno (§8 del MI-06); (2) per le compilazioni oltre il decennio rilevante ai fini fiscali: **cancellazione integrale**; (3) per quelle entro il termine: **riduzione** ai soli dati necessari (nome e cognome, corso/attività, importo, data) e cancellazione di email, telefono, indirizzo, data e luogo di nascita, testo libero e metadati. Se il Centro conferma di non avere esigenze fiscali o di altro tipo sulle iscrizioni più vecchie, la cancellazione può essere integrale e anticipata. La cautela RN-02 (dati equiparati a sanitari) spinge verso la riduzione, non verso la conservazione. | — | P (definire la regola prima di importare in produzione); esecuzione: S, entro 30 giorni dalla decisione | Centro (decisione sulla finalità fiscale residua); Manutentore (strumenti di riduzione e conteggi) |
| **3a** — tempi di conservazione delle nuove compilazioni | Regola proposta: dati di iscrizione conservati **24 mesi** dalla data di invio per la gestione del corso (comunicazioni, contestazioni, elenchi); alla scadenza, riduzione ai soli dati fiscali (nome, attività, importo, data) conservati fino a **10 anni** dall'evento, poi cancellazione. Modulo di contatto: cancellazione a **12 mesi** (nessuna finalità ulteriore). Adesione all'associazione: dati conservati fino alla cessazione dell'adesione + 10 anni per gli obblighi contabili. | I tempi vanno dichiarati nell'informativa (Allegato A, §A1) | P (la regola deve essere nel sistema prima della produzione) | Manutentore (attuazione tecnica); Centro (conferma dei termini) |
| **3b** — registro errori email (187 righe) e riga statistiche di scaricamento | Nessuna finalità residua: **cancellazione al passaggio**, non importarli nel nuovo sistema. Se servisse una traccia della migrazione, bastano i conteggi (senza dati personali). | — | P | Manutentore |
| **3c** — registro delle attività | Finalità: sicurezza dell'area amministrativa e accertamento di abusi. Conservazione proporzionata: **12 mesi** con eliminazione automatica a rullo. Vale anche per i nomi degli oggetti toccati introdotti dalla `1G-W9` (DR-315): la regola si applica all'intera riga, non solo ad alcune colonne. 12 mesi è il termine di riferimento comune per i log di sicurezza; se il professionista ritiene il rischio elevato può arrivare a 24. | — | P (la regola va implementata; il termine può essere confermato dal professionista) | Manutentore (implementazione); Centro (conferma del termine) |
| **3d** — copie di lavoro dei contenuti redazionali | Non contengono dati di terzi: la conservazione è una scelta di progetto. Regola proposta: bozze non pubblicate conservate **12 mesi** dall'ultima modifica, poi eliminazione automatica; eliminazione immediata alla chiusura dell'account di appartenenza. | — | S (90 giorni) | Manutentore |
| **3e** — backup | Non serve che la cancellazione si propaghi ai backup: è prassi accettata che un dato cancellato sopravviva nei backup fino alla scadenza del ciclo, a tre condizioni: (1) la politica di conservazione lo dichiara esplicitamente; (2) l'informativa lo dichiara; (3) la procedura di ripristino prevede che un backup ripristinato venga **bonificato** (ri-applicazione delle cancellazioni maturate). La finestra massima è quella del ciclo di rotazione: 6 mesi (7 giornalieri, 4 settimanali, 6 mensili). Da registrare come regola tecnica. | Menzione nell'informativa: Allegato A, §A1 | P (la regola scritta); S (30 giorni) per la procedura di ripristino | Manutentore |
| **4** — copie esistenti elencate al §3.3 | Regola: ogni copia ha una scadenza e una prova di distruzione. (i) Copia di riferimento del vecchio sito: **distruzione immediata** (già prevista). (ii) Copie di salvataggio del database di sviluppo: distruzione **al termine della migrazione**, dopo la riconciliazione dei conteggi. (iii) Backup del vecchio sito del 2026-09-13: conservato fino alla stabilizzazione del nuovo sito, **max 90 giorni** dalla messa in produzione, poi distruzione. (iv) Dati sul vecchio hosting: ultimo trasferimento, poi **richiesta di cancellazione definitiva** al fornitore con conferma scritta e chiusura del contratto. (v) Da quel momento il computer del manutentore lavora solo con dati sintetici (DR-010). Prova della cancellazione: conferma scritta del fornitore per i dati in hosting; per le copie locali, **verbale interno firmato** con data ed elenco delle copie distrutte, conservato dal Centro. Tempi complessivi: tutto risolto entro 90 giorni dalla produzione. | — | P (le richieste al fornitore hosting si preparano prima); esecuzione: S, 90 giorni | Manutentore (copie locali, verbali); Centro (richieste e conferme con il fornitore hosting) |

## 6.3 Informative e testi dei moduli

| Domanda | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **5a** — testo delle pagine «Informativa privacy» e «Informazioni sui cookie» | Le due pagine **non** vanno copiate dal vecchio sito: descrivevano strumenti non più usati (Google Analytics, banner esterno, newsletter, finestre promozionali) e mancherebbero basi giuridiche e tempi di conservazione. Vanno riscritte con i contenuti art. 13 GDPR: titolare e contatti; finalità e base giuridica di ciascun trattamento (iscrizioni, contatto, gestione area amministrativa, backup); categorie di dati; destinatari (fornitore del server in UE, fornitore backup in UE, Aruba per posta e dominio; Google e PayPal **al clic** come titolari autonomi); tempi di conservazione (domande 2–3); sopravvivenza nei backup fino a 6 mesi; diritti dell'interessato e reclamo al Garante. La pagina cookie dichiara: solo cookie tecnici di sessione, nessun tracciamento all'apertura delle pagine, video e mappa caricati solo al clic. Scheletro completo: Allegato A, §A1. | Allegato A, §A1 (scheletro) e §A3 (pagina cookie) | P | Manutentore (pubblicazione); Centro (conferma dei contenuti, dati del titolare) |
| **5b** — informativa nei moduli | Sì: ogni modulo deve riportare, sopra il pulsante di invio, una **nota breve** con rimando all'informativa completa. Non serve una casella di consenso: la base è contrattuale/precontrattuale (art. 6.1.b), il consenso non è la base e una spunta non necessaria è da evitare. La casella serve solo se e dove la base è il consenso (dati ex art. 9 strutturati, eventuali usi ulteriori). Testo proposto: Allegato A, §A2. | Allegato A, §A2 | P | Manutentore |
| **5c** — moduli PDF «con informativa privacy» | Vanno **aggiornati o ritirati**: contengono riferimenti a strumenti e finalità non più attuali. Se restano scaricabili dal nuovo sito con testi vecchi, l'aggiornamento è necessario prima della produzione; se si preferisce, si può ritirarli e sostituirli con un rimando alle pagine del sito. La revisione dei contenuti sostanziali dei PDF resta fuori perimetro (§7). | — | P se restano pubblicati; S (60 giorni) se ritirati | Centro (decisione); Manutentore (sostituzione file) |

## 6.4 Cookie e contenuti esterni

| Domanda | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **6** — serve un banner dei cookie? | **No.** Con nessuna terza parte all'apertura delle pagine e soli cookie tecnici, non c'è nulla per cui chiedere consenso: le linee guida del Garante n. 231/2021 richiedono il consenso solo per cookie e strumenti di tracciamento non tecnici, mentre per i cookie tecnici basta l'informativa. L'assenza del banner (difformità accettata, DR-124) si risolve così: basta la pagina «Informazioni sui cookie» aggiornata (domanda 5a). | — | P (pagina cookie aggiornata) | Manutentore |
| **6a** — il clic sulla copertina di video/mappa basta? | Sì, **a condizione che l'immagine di copertina sia ospitata sul server del sito** (com'è previsto) e che accanto alla copertina compaia un testo che dichiara cosa succede con il clic. Il clic su un elemento con informativa contestuale è «azione positiva inequivocabile» e nessun cookie non tecnico viene installato prima della scelta, che è esattamente ciò che le linee guida 231/2021 richiedono. Il testo accanto alla copertina va considerato parte della soluzione, non un extra. | Allegato A, §A4 | P | Manutentore |
| **6b** — cookie tecnico di sessione dell'area amministrativa | Richiede solo **informativa** (nella pagina cookie), nessun consenso: è un cookie tecnico di autenticazione. Nessun'altra misura specifica. | Allegato A, §A3 | P (menzione nella pagina) | Manutentore |
| **6c** — future statistiche di visita | Condizioni per farne a meno del consenso: strumento **self-hosted** (nessun cookie di terze parti), nessun identificativo persistente, IP troncato o ridotto a impronta, dati aggregati, conservazione breve (es. 12 mesi). In quel caso: solo aggiornamento dell'informativa. Se invece si usassero cookie di terze parti o finalità di profilazione: banner con comandi Accetta/Rifiuta (X) secondo le linee guida 231/2021. Regola da registrare come vincolo di progetto. | — | S (si applica solo se e quando si introducono le statistiche) | Manutentore |

## 6.5 Fornitori e contratti

| Domanda | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **7a** — fornitore del server (Hetzner, OVHcloud, Aruba) | Serve un **contratto per il trattamento dei dati ex art. 28** (DPA): i tre candidati ne offrono uno standard, da verificare e firmare prima dell'attivazione. Da controllare prima di firmare: sede effettiva dei data center in UE (per OVHcloud escludere il Regno Unito, già previsto da DR-295); elenco dei sub-responsabili e meccanismo di opposizione; misure di sicurezza dichiarate (certificazioni, cifratura); obblighi in caso di violazione; assenza di trasferimenti extra-UE o, se presenti, garanzie adeguate (clausole contrattuali tipo); giurisdizione del fornitore (eventuali leggi extra-UE che possano obbligare il fornitore a divulgare dati). | — | P | Centro (firma); Manutentore (confronto tecnico, DR-295) |
| **7b** — fornitore dei backup | Come il server: **DPA ex art. 28** + sede UE. La cifratura prima dell'invio (DR-298) è già una misura adeguata: nel contratto dichiararla e verificare che il fornitore non possa accedere ai dati in chiaro. La custodia della chiave: vedere domanda 12. | — | P | Centro (firma); Manutentore (scelta tecnica) |
| **7c** — Aruba (posta e dominio) | Per il servizio di posta: **DPA ex art. 28** per l'uso delle caselle del Centro (Aruba lo fornisce; va comunque sottoscritto). Per la registrazione del dominio non serve un contratto art. 28: i dati del registrant sono quelli del Centro e non c'è trattamento per suo conto. Da verificare: sede UE del servizio di posta. | — | P | Centro |
| **7d** — Google (YouTube/Maps al clic) e PayPal | Sono **titolari autonomi** del trattamento che fanno quando la persona arriva su di loro: non serve un contratto art. 28 con il Centro. **Sì, va detto nell'informativa**, con l'indicazione che il caricamento avviene solo su azione della persona e con il rimando alle informative di Google e PayPal. È l'unico obbligo del Centro in quanto «intermediario tecnico». | Allegato A, §A1 (destinatari) e §A4 | P (menzione nell'informativa) | Manutentore |
| **7e** — servizio esterno del codice | Non serve nulla: non riceve dati personali (regola DR-010). L'unico impegno è mantenerlo così, cioè continuare a escludere dati reali dal codice, dai documenti e dai registri. Da registrare come condizione permanente di progetto. | — | — | Manutentore |

## 6.6 Registro dei trattamenti e valutazione d'impatto

| Domanda | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **8** — registro dei trattamenti | **Sì, il Centro deve tenerlo.** L'esonero per le organizzazioni con meno di 250 dipendenti (art. 30.5) non si applica: i trattamenti non sono occasionali e possono includere categorie particolari ex art. 9; il Garante ha chiarito che le associazioni rientrano fra le «organizzazioni» e che quelle che trattano dati di soggetti vulnerabili o categorie particolari devono tenere il registro. Voci che questo progetto aggiunge: (1) gestione iscrizioni a corsi e seminari via moduli web; (2) modulo di contatto; (3) area amministrativa (account, ruoli, registro attività); (4) backup e disaster recovery; (5) caselle di posta e notifiche; (6) migrazione dei dati storici. Schema delle voci: Allegato B. | Allegato B | P (il registro deve esistere prima della produzione, anche in forma semplificata) | Centro (titolare del registro); Manutentore (fornisce le informazioni tecniche di ogni voce) |
| **9** — serve una DPIA? | **Sì, ed è consigliabile farla ora per questa fase.** L'elenco del Garante (provvedimento 11 ottobre 2018) include i trattamenti **non occasionali di dati di soggetti vulnerabili** (minori) e i trattamenti di **categorie particolari** collegati ad altri dati: il consultorio può far ricadere entrambi i criteri (RN-02, minori possibili nelle compilazioni). Il perimetro attuale (solo iscrizioni) è al limite, ma la combinazione di dati equiparati a sanitari, possibili minori, 425 compilazioni storiche e area riservata giustifica una DPIA **ora**, strutturata per essere **aggiornata** (non rifatta) quando arriverà la fase gestionale. La risposta alla domanda del §7 è quindi: la DPIA non anticipa la fase gestionale, la copre per estensione al momento giusto. | — | P | Centro (proprietà del documento); Manutentore (misure tecniche e descrizione dei trattamenti) |

## 6.7 Ruoli e accessi

| Domanda | Risposta | Testo | Priorità | Azione |
|---|---|---|---|---|
| **10** — ruoli privacy | **Centro = titolare** (confermato: determina finalità e mezzi, paga i contratti). **Manutentore = responsabile del trattamento esterno ex art. 28**: sviluppa, mantiene e accede tecnicamente ai dati in modo continuativo su istruzioni del Centro; serve un **incarico scritto ex art. 28** (oggetto, durata, natura e finalità, categorie di dati e interessati, obblighi e misure). Se il professionista ritiene più corretto qualificarlo come incaricato interno, la nomina scritta resta comunque dovuta; la qualifica di responsabile esterno è però la più difendibile per un esterno con accesso tecnico autonomo. **Persone dell'area amministrativa = incaricate del trattamento**: servono **nomina scritta** con istruzioni e impegno di riservatezza, per ciascuna persona, revocabile. | — | P (nomine e incarico prima della produzione) | Centro (nomine e incarico art. 28); Manutentore (fornisce il testo tecnico dell'incarico) |
| **11** — chi può leggere le compilazioni | Regola di minimizzazione: le compilazioni si leggono **solo dal ruolo Amministrazione** (non Redazione), dall'area amministrativa, non dal database. Una **schermata di sola lettura** nell'area amministrativa è preferibile all'accesso diretto al database: passa dai ruoli, lascia traccia nel registro attività ed esclude l'accesso tecnico come via ordinaria. Sulle **notifiche email**: l'email con tutti i dati in chiaro viaggia su un canale non cifrato fra i server; la regola consigliata è **email di solo avviso** («nuova iscrizione al corso X», senza contenuto) e lettura dei dati nell'area riservata via HTTPS. Se il Centro preferisce mantenere il contenuto nell'email, va accettato formalmente il rischio del canale. | — | P (è una decisione di design che cambia il flusso delle notifiche) | Centro (decisione); Manutentore (schermata e modifica delle notifiche) |
| **12** — misure specifiche | **Cifratura del database sul server: sì**, almeno cifratura del disco (LUKS o equivalente), compatibile con la revisione di sicurezza prevista; raccomandata per dati equiparati a sanitari. **Chiave dei backup:** la custodia esclusiva presso il manutentore, con contratti intestati al Centro, è criticabile: regola proposta — **consegna formale della chiave a una persona designata del Centro** (verbale di consegna e sostituzione a ogni rotazione) oppure doppia custodia (manutentore + Centro). **Autenticazione a due fattori: sì**, per l'area amministrativa (app authenticator o equivalente, senza SMS) e per l'accesso al server. **Dati reali sul computer del manutentore:** ammessi solo fino al termine della migrazione (domanda 4), con disco cifrato; poi solo dati sintetici (DR-010). **Assistente di programmazione IA:** le regole attuali (solo conteggi, mai contenuti) sono adeguate; da integrare con il divieto di trasmettere file o dati reali ai servizi dell'assistente e con la verifica che l'agente non possa leggere il database di sviluppo. | — | P (cifratura disco, 2FA, consegna chiave); S (30 giorni) per le verifiche sull'assistente IA | Manutentore (misure tecniche); Centro (consegna chiave, verbali) |
| **13** — cautele per il passaggio e lo spegnimento del vecchio sito | Cautele proposte: (1) **finestra di passaggio dichiarata**: il vecchio sito smette di accettare iscrizioni in un momento noto (avviso in pagina); (2) **ultimo trasferimento** delle compilazioni ricevute fino a quel momento, con riconciliazione dei conteggi (numero righe e valori prima/dopo, senza contenuti); (3) **backup di sicurezza** del vecchio sito prima dello spegnimento (è la copia del 2026-09-13, con la scadenza della domanda 4); (4) **richiesta di cancellazione definitiva** dei dati al fornitore hosting, con conferma scritta, e chiusura del contratto; (5) aggiornamento DNS e verifica che il vecchio dominio non serva più nulla; (6) tutto documentato nel registro delle decisioni con le conferme allegate. Nessuna informativa specifica agli interessati oltre a quanto alla domanda 1a. | — | P (la procedura si prepara prima; lo spegnimento avviene con la produzione) | Manutentore (procedura e riconciliazione); Centro (richieste al fornitore hosting) |

---

## Allegato A — Testi proposti

### A1. Scheletro dell'«Informativa privacy» (pagina pubblica)

> **Centro per la Famiglia Amoris Laetitia** — Terni
> (indirizzo, email, telefono — dati del Centro)
>
> **Titolare del trattamento.** Il Centro per la Famiglia Amoris Laetitia è titolare del
> trattamento dei dati personali raccolti da questo sito.
>
> **Finalità e base giuridica.**
> 1. Gestione delle iscrizioni a corsi e seminari (base: art. 6.1.b GDPR — esecuzione di
>    misure precontrattuali su richiesta dell'interessato).
> 2. Gestione delle adesioni all'associazione (base: art. 6.1.b).
> 3. Risposta alle richieste inviate con il modulo di contatto (base: art. 6.1.b).
> 4. Funzionamento e sicurezza dell'area riservata del sito (base: art. 6.1.f — interesse
>    legittimo alla sicurezza del sistema).
> 5. Copie di sicurezza (backup) dei dati, cifrate e conservate presso un fornitore
>    nell'Unione europea (base: art. 6.1.c e 6.1.f — obblighi di legge e sicurezza).
>
> **Categorie di dati.** Nome e cognome, data e luogo di nascita, indirizzo, telefono, email,
> scelte di iscrizione, testo eventualmente inserito nei campi liberi, data di invio,
> tipo di browser e impronta irreversibile dell'indirizzo IP (mai l'indirizzo in chiaro).
>
> **Destinatari.** Fornitore del server e dei servizi di posta, nell'Unione europea, in
> qualità di responsabili del trattamento; fornitori di backup, nell'Unione europea. I
> pagamenti avvengono su PayPal e i video e le mappe si caricano da Google **solo dopo un
> clic esplicito**: in quei casi i dati sono trattati da Google Ireland Ltd. e PayPal come
> **titolari autonomi**, secondo le rispettive informative (link).
>
> **Conservazione.** Iscrizioni: 24 mesi per la gestione, poi riduzione ai soli dati
> fiscali fino a 10 anni. Richieste di contatto: 12 mesi. Account e registro delle
> attività: fino alla chiusura dell'account / 12 mesi. I dati cancellati possono restare
> nelle copie di sicurezza cifrate fino a un massimo di 6 mesi.
>
> **Diritti.** In qualunque momento è possibile esercitare i diritti di accesso,
> rettifica, cancellazione, limitazione, portabilità e opposizione, scrivendo a [email].
> È possibile proporre reclamo al Garante per la protezione dei dati personali.
>
> *Le iscrizioni raccolte con il sito precedente sono conservate solo per finalità
> amministrative e fiscali, nei limiti descritti sopra.*

### A2. Nota breve per i moduli (sopra il pulsante di invio)

> Inviando questo modulo autorizzi il trattamento dei tuoi dati per gestire la tua
> iscrizione, come descritto nell'[Informativa privacy](/informativa-privacy).
> Ti chiediamo di non inserire informazioni sulla tua salute o su altre persone.

### A3. Scheletro della pagina «Informazioni sui cookie»

> Questo sito non usa cookie di profilazione né strumenti di tracciamento di terze parti.
> Non carica contenuti esterni all'apertura delle pagine. Usa soltanto **cookie tecnici**:
> un cookie di sessione per l'accesso all'area riservata del Centro, che scade alla
> chiusura della sessione, e nessun altro. Video e mappe si caricano dai server di Google
> solo dopo un tuo clic esplicito (vedi l'avviso accanto all'elemento). Non è quindi
> richiesto alcun consenso ai cookie, ai sensi delle linee guida del Garante
> (provvedimento n. 231 del 10 giugno 2021).

### A4. Testo accanto alle copertine di video e mappa

> **Video:** «Il video è ospitato su YouTube (Google). Caricandolo, i tuoi dati saranno
> trattati da Google secondo la sua informativa: [link].»
> **Mappa:** «La mappa è ospitata da Google Maps. Caricandola, i tuoi dati saranno
> trattati da Google secondo la sua informativa: [link].»

---

## Allegato B — Schema delle voci del registro dei trattamenti (art. 30)

Colonne per ogni voce: **finalità** · **categorie di interessati** · **categorie di dati** ·
**base giuridica** · **destinatari** · **trasferimenti extra-UE** · **termini di
conservazione** · **misure di sicurezza**.

| # | Voce | Finalità | Interessati | Dati | Destinatari | Conservazione |
|---|---|---|---|---|---|---|
| 1 | Iscrizioni a corsi e seminari via moduli web | gestione iscrizione e pagamento del corso | iscritti (anche coppie, possibili minori) | anagrafica, contatti, data/luogo di nascita, scelte, testo libero, metadati di invio | fornitore server (art. 28), PayPal (titolare autonomo) | 24 mesi, poi riduzione a 10 anni |
| 2 | Adesione all'associazione | gestione del rapporto associativo | aderenti | anagrafica, contatti, scelte | fornitore server (art. 28) | fino a cessazione + 10 anni |
| 3 | Modulo di contatto | risposta alle richieste | richiedenti | nome, email, testo | fornitore server, posta (art. 28) | 12 mesi |
| 4 | Area amministrativa | redazione contenuti e gestione del sito | redattori e amministratori | nome, email, ruoli, hash password, registro attività | nessuno | account fino a chiusura; registro 12 mesi |
| 5 | Backup | continuità del servizio, ripristino | tutti i precedenti | come le voci 1–4 | fornitore backup UE (art. 28) | ciclo di rotazione, max 6 mesi |
| 6 | Posta elettronica | notifiche delle compilazioni e comunicazioni | come le voci 1–3 | contenuto delle notifiche | Aruba (art. 28) | come le voci 1–3 |
| 7 | Migrazione dati storici | trasferimento iscrizioni dal vecchio sito | iscritti storici | come voce 1 | nessuno (operazione interna) | si chiude con la distruzione delle copie (90 giorni) |

Trasferimenti extra-UE: **nessuno** per tutte le voci (server, backup e posta in UE;
Google e PayPal trattano da titolari autonomi solo su azione dell'interessato).

---

## Fonti

- Regolamento (UE) 2016/679 (GDPR), articoli 6, 9, 13, 28, 30, 35: https://eur-lex.europa.eu/legal-content/IT/ALL/?uri=CELEX:32016R0679
- Garante per la protezione dei dati personali, Linee guida cookie e altri strumenti di tracciamento, provvedimento n. 231 del 10 giugno 2021: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9677876
- Garante, FAQ Cookie (informativa e consenso, cookie tecnici e analytics): https://www.garanteprivacy.it/faq/Cookie
- Garante, Elenco delle tipologie di trattamenti soggetti a DPIA, provvedimento dell'11 ottobre 2018: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979
- Garante, Valutazione di impatto (DPIA), criteri: https://www.garanteprivacy.it/valutazione-d-impatto-della-protezione-dei-dati-dpia-
- Garante, Registro delle attività di trattamento (associazioni e casi di obbligo sotto i 250 dipendenti): https://www.garanteprivacy.it/registro-delle-attivita-di-trattamento
- Garante, chiarimenti sul consenso via click e selezione di elementi della pagina: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/4006878
- Codice civile, art. 2220 (conservazione delle scritture contabili, 10 anni): https://www.normattiva.it/uri-res/N2Lsurn?urn:urn:rn:si:codice.civile:2220

---

*Bozza di lavoro da sottoporre al professionista incaricato della verifica MI-06 (DR-303).
Le risposte, una volta confermate, diventano regole tecniche del sistema e vengono
registrate fra le decisioni del progetto.*
