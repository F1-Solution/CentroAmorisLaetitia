# MI-06 — Ambito della verifica privacy e legale

**Destinatario:** il professionista (avvocato o consulente privacy) incaricato della
verifica MI-06 prima della messa in produzione del nuovo sito.
**Preparato il:** 2026-10-28, su decisione del Centro registrata come DR-303.
**Natura del documento:** descrizione del perimetro e delle domande. Contiene solo
descrizioni, categorie e conteggi.

> **Questo documento non attesta alcuna conformità**, né al GDPR né ad altra norma.
> Non è un parere, non è un registro dei trattamenti e non è un'informativa. Descrive
> che cosa c'è e che cosa si farà, perché un professionista possa dire che cosa
> serve. Le scelte tecniche già prese sono indicate come tali: nessuna è stata
> validata sul piano legale.

**Che cosa non contiene, per scelta:** nessun dato reale, nessun nome di persona,
nessun contenuto di compilazioni, nessun indirizzo email, nessuna credenziale.
Se per rispondere servono informazioni ulteriori, si veda il §8.

---

## 1. Il titolare e il contesto

| | |
|---|---|
| **Titolare del trattamento (presunto)** | Centro per la Famiglia Amoris Laetitia, associazione del terzo settore con sede a Terni, che opera con volontari. Va confermato dal professionista (§6, domanda 8) |
| **Attività** | consultorio familiare: consulenze familiari e di coppia, anche per minori e a distanza; corsi e seminari aperti alla cittadinanza (genitorialità, relazioni di coppia, crescita personale, formazione per consulenti); adesione all'associazione |
| **Sito attuale** | `www.centroamorislaetitia.it`, realizzato con WordPress su un hosting condiviso |
| **Progetto** | sostituzione del sito con un sistema nuovo, sviluppato su misura, con un'area amministrativa per la redazione dei contenuti |
| **Contratti e costi** | intestati al Centro, che paga (DR-302) |
| **Sviluppo e manutenzione** | una sola persona, che sviluppa e manterrà il sistema e ha accesso tecnico ai dati (§6, domanda 8) |

Una precisazione di perimetro: in questa prima fase il nuovo sistema **non** gestisce
appuntamenti, cartelle delle consulenze, soci, pagamenti o contabilità. Queste funzioni
sono previste più avanti e saranno oggetto di una verifica separata (§7).

---

## 2. Che cosa fa il sito oggi

Il sito attuale, oltre a pubblicare pagine e notizie:

| Funzione | Come avviene oggi |
|---|---|
| **Moduli di iscrizione** | 25 moduli pubblicati. 24 sono iscrizioni a corsi o seminari, 1 è l'adesione all'associazione. Tutti prevedono un pagamento tramite PayPal |
| **Conservazione delle compilazioni** | le compilazioni restano nel database del sito: **425** in tutto, su 24 moduli |
| **Notifiche email** | 39 notifiche configurate: a ogni invio partono email con il contenuto della compilazione |
| **Iscrizione a liste email** | un componente collega i moduli a un servizio di newsletter esterno |
| **Modulo di contatto** | un modulo generico che invia un'email al Centro, senza conservare il messaggio sul sito |
| **Statistiche di visita** | Google Analytics, in due versioni |
| **Banner dei cookie** | servito da un fornitore esterno |
| **Finestre promozionali** | un componente esterno per finestre e raccolta contatti |
| **Video e mappa** | video di YouTube e mappa di Google incorporati nelle pagine |
| **Caratteri tipografici** | scaricati dai server di Google |
| **Documenti scaricabili** | 4 moduli in PDF per le consulenze (adulti, minori, a distanza, a distanza per minori), più 10 moduli in PDF con informativa privacy (uno generico e nove di iscrizione a corsi). Sono **moduli in bianco**, non compilati |
| **Area riservata** | un componente, oggi disattivato, conteneva 4 documenti riservati: anche questi sono **moduli in bianco** per le consulenze |
| **Informativa** | due pagine pubbliche: «Informativa privacy» e «Informazioni sui cookie» |

---

## 3. Che cosa farà il nuovo sito

### 3.1 Il sito pubblico

| Aspetto | Comportamento previsto |
|---|---|
| **Aspetto** | identico a quello attuale, pagina per pagina, comprese le due pagine di informativa, che oggi sono copiate **così come sono** |
| **Terze parti all'apertura delle pagine** | **nessuna** (DR-107): niente statistiche di visita, niente finestre promozionali, niente banner di un fornitore esterno, caratteri tipografici ospitati sul server del sito |
| **Video** | al posto del video c'è un'immagine di copertina; il video si carica **solo se la persona fa clic**, dalla versione di YouTube che dichiara di non usare cookie di profilazione (DR-122) |
| **Mappa** | come il video: immagine di copertina, mappa di Google caricata **solo al clic** (DR-121) |
| **Banner dei cookie** | **oggi non c'è.** Nel confronto con il sito attuale è stato registrato come difformità accettata, in attesa di questa verifica (DR-124) |
| **Pagamenti** | il sito non incassa nulla. Dopo l'invio di un modulo compare un collegamento a PayPal con l'importo; il pagamento avviene su PayPal, senza alcun collegamento automatico con l'iscrizione (DR-039) |
| **Newsletter** | l'iscrizione a liste esterne non viene riprodotta |

### 3.2 I moduli

| | Quantità |
|---|---|
| Moduli | **26**: i 25 di iscrizione più il modulo di contatto, ricostruito |
| Notifiche email configurate | **40** |
| Campi per modulo | da 3 a 22, in media 12 |
| Campi obbligatori, in totale | 130 |

**Categorie di dati richieste dai moduli** (occorrenze dei tipi di campo, su tutti i
moduli):

| Categoria | Occorrenze |
|---|---|
| Nome e cognome | 33 |
| Data (in genere di nascita) | 32 |
| Email | 31 |
| Telefono | 30 |
| Indirizzo | 29 |
| Scelte fra opzioni | 30 a scelta singola, 5 a scelta multipla |
| Testo libero | 40 |
| Importo da pagare | 27 |
| Numero | 1 |

Le etichette ricorrenti sono nome, luogo e data di nascita, indirizzo, telefono, email.
Nei percorsi di coppia la stessa serie è ripetuta per due persone. I campi di testo
libero possono contenere qualunque cosa la persona scriva.

**Che cosa succede a un invio:**

1. il sito controlla i dati e li **salva nel database** prima di ogni altra cosa;
2. invia le notifiche email al Centro, con il contenuto della compilazione, tramite la
   **posta di Aruba** con una casella del Centro (DR-301);
3. mostra il messaggio di conferma e, se previsto, il collegamento a PayPal.

Insieme ai dati del modulo si conservano la data dell'invio, il tipo di browser e una
**impronta irreversibile dell'indirizzo IP** (non l'indirizzo in chiaro), che serve a
limitare gli invii automatici. Non c'è alcun captcha di terze parti.

L'invio delle email verso destinatari reali non è ancora attivo: si attiverà solo dopo
una prova con destinatari interni e una conferma esplicita del Centro.

### 3.3 Le 425 compilazioni storiche

Per decisione del Centro (DR-026), tutte le compilazioni del sito attuale vengono
trasferite nel nuovo sistema, **senza selezione e senza pulizia**. La valutazione privacy
è stata rinviata a questa verifica, non annullata.

| Dato | Quantità |
|---|---|
| Compilazioni | **425**, su 24 moduli |
| Valori di campo | 3.710 |
| Metadati tecnici delle compilazioni | 206 voci |
| Registro degli errori di invio email del vecchio sito | 187 righe, che contengono indirizzi di destinatari |
| Account del vecchio sito | 1, quello di amministrazione |
| Statistiche di scaricamento | 1 riga, con indirizzo IP conservato solo come impronta |

**Natura dei dati.** Sono iscrizioni a corsi e seminari e adesioni all'associazione.
Un documento interno del progetto le descrive anche come «richieste di consulenza»:
in assenza di una verifica sui contenuti, che per regola non si fa, conviene trattarle
con la stessa cautela. Per il Centro i dati di chi si rivolge al consultorio sono
equiparati a dati sanitari (requisito RN-02). **Non è stato verificato** se fra le
compilazioni ce ne siano relative a minori.

**Periodo:** non misurato in questo documento; si può fornire un conteggio per anno,
senza contenuti, se serve (§8).

**Dove stanno oggi** (copie esistenti al 2026-10-28):

| Luogo | Che cosa contiene |
|---|---|
| Server dell'hosting attuale | il sito WordPress in funzione, che continua a ricevere compilazioni |
| Computer del manutentore — copia del backup del sito del 2026-09-13 | backup completo del sito e del suo database, usato come sorgente del trasferimento |
| Computer del manutentore — copia di riferimento del vecchio sito | una ricostruzione locale del sito attuale, usata per il confronto visivo; è prevista la sua distruzione |
| Computer del manutentore — database di sviluppo del nuovo sistema | le 425 compilazioni e gli altri dati della tabella sopra |
| Computer del manutentore — copie di salvataggio di quel database | fatte prima di ogni operazione rischiosa, fuori dal codice del progetto |
| Ambiente di collaudo sullo stesso computer | copia del database **con le compilazioni svuotate** e gli account disattivati |

Nessun dato reale si trova nel codice del progetto, nei documenti, nei test, nelle
immagini di prova o nei registri tecnici: è una regola applicata dal primo giorno
(DR-010). Il codice del progetto è conservato su un servizio esterno di gestione del
codice, che quindi **non** riceve dati personali.

**Dove andranno:** nel database del server di produzione (§3.6).

### 3.4 L'area amministrativa

| Aspetto | Comportamento |
|---|---|
| **Chi entra** | pochi account personali, nell'ordine di 1-3 persone; nessuna registrazione libera, nessun recupero della password via email |
| **Ruoli** | due: **Redazione** (pagine, notizie, immagini, documenti, menu, indirizzi) e **Amministrazione** (account, impostazioni del sito, registro delle attività). Una persona può averli entrambi, ma ne usa **uno alla volta** e il sistema rifiuta ciò che il ruolo in uso non consente |
| **Compilazioni dei moduli** | **oggi nessuna schermata le mostra.** Si leggono solo accedendo direttamente al database, cioè solo il manutentore tecnico |
| **Accesso** | password conservate in forma non reversibile; sessioni che scadono dopo 12 ore di inattività e in ogni caso dopo 30 giorni; tentativi falliti limitati; le modifiche al proprio account chiedono la password attuale |
| **Copie di lavoro** | l'editor salva automaticamente bozze dei contenuti redazionali. Non contengono dati di terzi, ma sono materiale non pubblicato con una propria conservazione da definire |

### 3.5 Il registro delle attività

Il sistema registra chi ha fatto che cosa, e quando: accessi riusciti e falliti,
disconnessioni, cambi di password, modifiche a contenuti, impostazioni e account.

- Il registro contiene **identificativi**, non contenuti: non riporta i dati delle
  compilazioni né altri dati personali di terzi.
- Gli indirizzi IP sono conservati solo come impronta irreversibile.
- Le righe non si modificano e non si cancellano dall'applicazione.
- **Per quanto tempo si conserva non è ancora stabilito.**
- Dalla `1G-W9` il registro conserva anche il **nome dell'oggetto** toccato (nome del file, titolo, indirizzo), che resta dopo l'eliminazione: se un nome contiene dati di una persona, resta nel registro. La regola di conservazione va definita con questa verifica (DR-315).

### 3.6 Server, backup e fornitori

| Elemento | Situazione |
|---|---|
| **Server** | un solo server virtuale **in UE**, con sito pubblico, area amministrativa, database e archivio dei file. Il fornitore è da scegliere fra **Hetzner** (Germania o Finlandia), **OVHcloud** (sedi europee; il Regno Unito va escluso) e **Aruba** (Italia), dopo un confronto che comprende anche il contratto per il trattamento dei dati (DR-295) |
| **Ambiente di prova** | sullo stesso server, separato da quello di produzione (DR-296) |
| **Archivio dei file** | sullo stesso server, non presso un servizio esterno (DR-297) |
| **Backup** | giornalieri, del database e dei file; **cifrati prima dell'invio** e trasferiti presso **un altro fornitore in UE**, da scegliere; la chiave è custodita dal manutentore (DR-298). Conservazione tecnica prevista: 7 giornalieri, 4 settimanali, 6 mensili. Ne segue che un dato cancellato resta nei backup **fino a circa sei mesi** |
| **Cifratura del database sul server** | non ancora decisa: si valuta nella revisione di sicurezza prima della produzione |
| **Dominio e DNS** | restano presso Aruba (DR-300) |
| **Invio email** | posta di Aruba, con una casella del Centro (DR-301) |
| **Terze parti solo su azione della persona** | YouTube e Google Maps al clic; PayPal al clic sul collegamento di pagamento |
| **Registri tecnici del server** | senza dati personali, per regola di progetto |

**Strumenti di sviluppo.** Lo sviluppo si avvale anche di un assistente di programmazione
basato su intelligenza artificiale, che lavora sul computer del manutentore. Le regole
del progetto gli vietano di leggere o riportare dati reali: i controlli sui dati
importati producono solo conteggi. Lo segnaliamo perché sullo stesso computer i dati
reali sono presenti (§3.3).

---

## 4. Riassunto delle categorie di interessati

| Interessati | Dati | Dove |
|---|---|---|
| Persone che si sono iscritte a corsi o all'associazione, in passato | anagrafica, contatti, data e luogo di nascita, indirizzo, scelte e testo libero; per le coppie due persone | le 425 compilazioni |
| Persone che si iscriveranno o scriveranno al Centro | come sopra, più il modulo di contatto | nuove compilazioni ed email al Centro |
| Destinatari di email del vecchio sito | indirizzi email | registro degli errori di invio, 187 righe |
| Persone che lavorano nell'area amministrativa | nome, email, ruoli, attività svolte | account e registro delle attività |
| Visitatori del sito | impronta dell'indirizzo IP e tipo di browser, solo se inviano un modulo o tentano un accesso | database |
| Possibili minori | non verificato | eventualmente nelle compilazioni |

---

## 5. Decisioni del Centro che riguardano questa verifica

| Riferimento | Contenuto |
|---|---|
| DR-010 | solo dati sintetici in sviluppo, prove, immagini e documentazione |
| DR-026 | trasferire tutti i dati del vecchio sito, senza pulizia; la valutazione privacy è rinviata, non cancellata |
| DR-039 | dopo l'invio, collegamento a PayPal con l'importo; nessun collegamento automatico fra iscrizione e pagamento |
| DR-067 | un solo ruolo attivo per volta; il sistema rifiuta i dati di un'altra area |
| DR-073 | il professionista si coinvolge prima della messa in produzione; nel frattempo valgono le regole tecniche già in vigore, che non sono una validazione |
| DR-107 | nessuna terza parte all'apertura delle pagine; la politica di consenso si decide con questa verifica |
| DR-121, DR-122 | mappa e video caricati solo al clic |
| DR-124 | assenza del banner dei cookie accettata come difformità provvisoria |
| DR-295…DR-302 | fornitore del server da confrontare, backup cifrati presso altro fornitore UE, dominio e posta su Aruba, contratti intestati al Centro |
| DR-303 | la verifica parte subito, con questo documento |

---

## 6. Le domande

Le domande sono numerate per facilitare la risposta. Dove possibile, ci serve una
regola applicabile («si conserva per X», «si cancella quando Y», «serve il testo Z»).

### 6.1 Base giuridica

1. Qual è la base giuridica corretta per:
   a. le **425 compilazioni storiche**, raccolte con il sito attuale e con l'informativa
      allora pubblicata;
   b. le **nuove compilazioni** dei moduli di iscrizione e del modulo di contatto;
   c. le **notifiche email** che riportano i dati della compilazione nella casella del
      Centro?
   Rientrano fra le categorie particolari di dati (art. 9 GDPR), visto il contesto di un
   consultorio familiare? Il **trasferimento** delle compilazioni dal vecchio al nuovo
   sistema richiede un passaggio specifico (informazione agli interessati, altro)?

### 6.2 Conservazione e cancellazione

2. Per le **425 compilazioni storiche**: vanno conservate, ridotte o cancellate? Se
   conservate, per quanto tempo e con quale criterio (per esempio dalla data
   dell'iscrizione, dalla fine del corso, dalla cessazione dell'adesione)? Se ridotte,
   quali dati si possono togliere?
3. Quali tempi di conservazione valgono per:
   a. le nuove compilazioni;
   b. il registro degli errori di invio email del vecchio sito (187 righe) e la riga
      delle statistiche di scaricamento;
   c. il **registro delle attività** dell'area amministrativa;
   d. le **copie di lavoro** dei contenuti redazionali;
   e. i **backup** (oggi previsti fino a circa sei mesi): una cancellazione deve
      propagarsi ai backup, o basta che scadano?
4. Che cosa va fatto delle **copie esistenti** elencate al §3.3: il backup del vecchio
   sito sul computer del manutentore, le copie di salvataggio del database di sviluppo,
   la copia di riferimento del vecchio sito, e i dati che restano sul vecchio hosting
   dopo il passaggio. Con quali tempi e con quale prova della cancellazione?

### 6.3 Informative e testi dei moduli

5. Le pagine «Informativa privacy» e «Informazioni sui cookie» sono oggi copiate dal
   sito attuale, che usava Google Analytics, un banner esterno, finestre promozionali e
   una newsletter: il nuovo sito non usa più questi strumenti. Ci serve:
   a. il testo, o le indicazioni per il testo, delle due pagine aggiornate;
   b. se ogni modulo deve riportare un'informativa breve, un rimando o una casella di
      presa visione o di consenso, e con quale testo;
   c. se i moduli in PDF «con informativa privacy» ancora scaricabili vanno aggiornati
      o ritirati.

### 6.4 Cookie e contenuti esterni

6. Con il comportamento descritto al §3.1 (nessuna terza parte all'apertura, video e
   mappa solo al clic, nessuna statistica di visita), serve un **banner dei cookie**?
   In particolare:
   a. il clic sull'immagine di copertina di un video o della mappa vale come scelta
      sufficiente, o serve un consenso specifico prima del caricamento, con un testo
      accanto alla copertina?
   b. il cookie tecnico di sessione dell'area amministrativa richiede qualcosa?
   c. se in futuro si volessero statistiche di visita, a quali condizioni?

### 6.5 Fornitori e contratti

7. Per ciascun fornitore, che cosa serve (contratto per il trattamento dei dati ai sensi
   dell'art. 28, verifiche su sede e leggi extra-UE, altro) e che cosa va controllato
   prima di firmare:
   a. il fornitore del server, fra i tre del §3.6;
   b. il fornitore dei backup, in UE, da scegliere;
   c. Aruba, per la posta usata dai moduli e per il dominio;
   d. Google (YouTube e Maps al clic) e PayPal (al clic): sono titolari autonomi, e
      serve dirlo nell'informativa?
   e. il servizio esterno che conserva il codice, che non riceve dati personali: serve
      qualcosa?

### 6.6 Registro dei trattamenti e valutazione d'impatto

8. Il Centro deve tenere o aggiornare il **registro dei trattamenti**? Se sì, quali voci
   aggiunge questo progetto? Ci serve, se possibile, uno schema delle voci.
9. Serve una **valutazione d'impatto (DPIA)**, considerando che si trattano dati di
   persone che si rivolgono a un consultorio familiare, possibili dati di minori, e che
   in una fase successiva il sistema gestirà consulenze e documenti? Se sì, va fatta
   ora per questa fase o insieme alla fase gestionale?

### 6.7 Ruoli e accessi

10. Ruoli privacy: confermare che il Centro è titolare, e indicare la posizione del
    **manutentore**, che sviluppa il sistema e accede tecnicamente ai dati (autorizzato,
    responsabile esterno, altro), e quella delle persone che useranno l'area
    amministrativa. Serve una nomina o un'istruzione scritta?
11. Chi può **leggere le compilazioni** e da dove? Oggi solo dal database. Va prevista
    una schermata nell'area amministrativa, e per quale ruolo? Le notifiche email con i
    dati completi vanno bene, o conviene che l'email avvisi soltanto e i dati si leggano
    nell'area?
12. Servono misure specifiche su: cifratura del database sul server, custodia della
    chiave dei backup (oggi presso il manutentore, mentre i contratti sono intestati al
    Centro), autenticazione a due fattori, presenza di dati reali sul computer del
    manutentore e uso di un assistente di programmazione basato su IA su quel computer?
13. Prima del passaggio, il vecchio sito continua a ricevere compilazioni, che andranno
    trasferite con un ultimo aggiornamento: ci sono cautele per questo passaggio e per
    lo spegnimento del vecchio sito?

---

## 7. Che cosa NON è chiesto

- Una dichiarazione di conformità generale del Centro: si chiede di verificare il
  perimetro descritto qui.
- La **fase gestionale** futura (appuntamenti, consulenze, soci, documenti con permessi,
  pagamenti, contabilità, comunicazioni anche via WhatsApp, applicazione installabile):
  non è ancora progettata e sarà oggetto di una verifica separata. La domanda 9 chiede
  solo se la DPIA debba anticiparla.
- Una verifica della **sicurezza informatica** o del codice: è prevista una revisione
  tecnica separata prima della produzione.
- Aspetti **fiscali** o **contabili** dei pagamenti e delle quote associative.
- L'aspetto grafico del sito e i contenuti redazionali, salvo i testi di informativa e
  dei moduli.
- La revisione dei moduli in PDF per le consulenze, salvo quanto chiesto alla domanda 5c.

---

## 8. Che cosa ci serve in cambio

**Forma della risposta.** Un parere scritto, anche sintetico, che per ogni domanda del
§6 indichi:

| Colonna | Contenuto |
|---|---|
| Domanda | il numero (1…13, con la lettera dove c'è) |
| Risposta | la regola da applicare, o «non applicabile» con il motivo |
| Testo | dove serve un testo per il sito (informativa, moduli, banner), il testo o le indicazioni per scriverlo |
| Priorità | **prima della produzione** oppure **può seguire**, con un termine |
| Azione | chi deve fare che cosa: il Centro (contratti, nomine, registro) o il manutentore (regole tecniche) |

Le risposte diventano regole tecniche del sistema e vengono registrate fra le decisioni
del progetto; le parti che richiedono documenti del Centro (contratti, nomine, registro
dei trattamenti) restano a carico del Centro.

**Informazioni aggiuntive.** Se servono per rispondere, si possono fornire senza dati
reali:

- conteggi per anno o per modulo delle compilazioni;
- l'elenco delle etichette dei campi di ciascun modulo, senza valori;
- conteggi di compilazioni che rispondono a un criterio indicato dal professionista
  (per esempio date di nascita che indicano un minore), senza mostrare le compilazioni;
- una dimostrazione dell'area amministrativa con dati sintetici.

**Non verranno forniti:** copie del database, estratti delle compilazioni, accessi
all'area amministrativa o al server.

---

## 9. Riferimenti interni

Per chi segue il progetto, non per il professionista: registro delle decisioni
(`docs/decisions/decision-register.md`, voci citate), ADR-007 (accesso e sessioni),
ADR-009 (forma del rilascio), ADR-010 (moduli), `docs/architecture/database-schema.md`
§7 e §8, `docs/migration/plugin-and-feature-map.md`, `.planning/phases/1F/CONTEXT.md`,
rischio R-04 in `docs/migration/migration-risks.md`, input MI-06 in
`docs/migration/missing-inputs.md`.
