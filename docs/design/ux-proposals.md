# Proposte di UX per l'area amministrativa

**Progetto**: Centro per la Famiglia Amoris Laetitia — nuova piattaforma
**Data**: 2026-09-14
**Wave**: `1B-W7`
**Decisioni di riferimento**: DR-018 (l'area amministrativa non deve assomigliare a
WordPress), DR-019 (4 proposte di UI e 4 di UX fra cui sceglie il committente),
DR-028 (perimetro completo dell'area amministrativa futura, con il CMS come primo
modulo), DR-030 (la PWA riguarda solo l'area amministrativa, dopo il gate).

> **Queste sono proposte, non decisioni.** Nessuna delle quattro è stata scelta.
> Nessuna riga di codice, nessuno scaffold e nessuna dipendenza è stata prodotta
> a partire da questo documento. La scelta spetta al committente; la sezione finale
> elenca le domande a cui serve risposta per poter scegliere.

> **Perimetro di questo documento.** Qui si parla di **architettura
> dell'informazione, navigazione e flussi**. Colori, tipografia, spaziature,
> iconografia e stile visivo sono trattati nel documento separato
> `ui-proposals.md`. Dove qui si nomina un colore, lo si fa solo per indicare un
> **significato** (per esempio «stato riservato»), mai per indicare un valore.

> **Vincolo DR-018 applicato a tutte e quattro le proposte.** Nessuna propone una
> «Bacheca» a widget; nessuna usa come primo livello di navigazione l'elenco dei
> tipi di contenuto; nessuna adotta la spina dorsale «Articoli / Pagine / Media /
> Commenti». Le differenze fra le quattro non sono di etichetta: cambiano l'oggetto
> stesso attorno a cui la navigazione è costruita.

> **Dati.** Tutti i nomi, gli importi, i titoli e gli esempi di questo documento
> sono **inventati**. Nessun dato reale del Centro compare qui.

---

## 1. Utenti e compiti

Quattro profili sintetici, costruiti sul contesto reale del Centro (consultorio
familiare del terzo settore, gestito da volontari, meno di 100 utenti simultanei,
un solo sviluppatore). Nomi di fantasia.

| # | Profilo | Chi è | Compito principale | Frequenza di accesso | Competenza digitale |
|---|---|---|---|---|---|
| P1 | **Redazione** — «Marilena» | Volontaria, cura il sito pubblico | Pubblicare una notizia, aggiornare il testo di una pagina, cambiare una foto | 2–4 volte al mese | Media. Usa lo smartphone più del computer |
| P2 | **Segreteria** — «Donato» | Volontario, snodo operativo del Centro | Rispondere alle richieste, fissare e confermare appuntamenti, tenere aggiornata l'anagrafica, sapere sempre «a che punto siamo» | quasi ogni giorno | Media-alta. È l'unico che conosce tutto il sistema |
| P3 | **Tesoreria** — «Rosalba» | Volontaria, tiene la cassa e le quote | Registrare quote sociali, importare i movimenti, chiudere il rendiconto, non mancare le scadenze | a ondate stagionali: pochi accessi, poi settimane intense | Media. Lavora per elenchi e per totali |
| P4 | **Consulenza** — «Ernesto» | Consulente del consultorio | Vedere la propria agenda, accettare o riproporre una data, scrivere e rileggere le proprie note | 1–2 volte a settimana, sempre le stesse due schermate | Variabile. Non vuole imparare un gestionale |

**Osservazione che condiziona tutto il resto**: P1, P3 e P4 usano una porzione
piccolissima del sistema, e la usano di rado. Solo P2 ha una visione d'insieme.
Un'architettura che costringe P1, P3 e P4 ad attraversare il mondo di P2 per
arrivare alle proprie tre schermate è un'architettura sbagliata, per quanto
elegante sia il suo albero.

### Compiti ricorrenti e stagionali di riferimento

| Compito | Quando | Chi | Note |
|---|---|---|---|
| Quote sociali | entro il 30 aprile | P3, P2 | Picco annuale, coinvolge molte persone |
| Richiesta Certificazioni Uniche | dal 1° marzo | P3 | Finestra che si apre, non una data secca |
| Adempimento 770 | dal 1° ottobre | P3 | Come sopra |
| Aggiornamento sito per iniziative | continuo, a ondate | P1 | Spesso urgente e breve |
| Conferma appuntamenti | continuo | P2, P4 | Richiede risposta di più persone |

---

## 2. Criteri di valutazione comuni

Le quattro proposte sono confrontate sugli stessi otto criteri. La tabella con i
punteggi è al capitolo 7.

| Sigla | Criterio | Domanda a cui risponde |
|---|---|---|
| C1 | **Rientro dopo sei mesi** | Un volontario che non entra da mesi ritrova il suo compito senza chiedere aiuto? |
| C2 | **Costo del primo apprendimento** | Quanto serve, la prima volta, per capire dove si sta? |
| C3 | **Robustezza della riservatezza** | La separazione fra ciò che si può vedere e ciò che non si può vedere regge anche alla distrazione, non solo alla cattiva fede? |
| C4 | **Scalabilità da 1 a 9 moduli** | La navigazione che funziona con il solo CMS regge quando i moduli diventano nove? |
| C5 | **Ruoli multipli sulla stessa persona** | Chi è amministratore, tesoriere e socio capisce sempre in che veste sta agendo? |
| C6 | **Adeguatezza mobile / PWA** | I compiti che hanno senso da telefono sono davvero comodi da telefono? |
| C7 | **Costo di realizzazione** | Quanto costa a **un solo** sviluppatore costruirla e mantenerla? |
| C8 | **Scadenze e stagionalità** | I promemoria arrivano al momento giusto senza diventare rumore di fondo? |

Scala dei punteggi: **1** = inadeguato · **2** = debole · **3** = accettabile ·
**4** = buono · **5** = ottimo.

---

## 3. Proposta A — «La scrivania dei compiti»

### 3.1 Principio organizzatore in una frase

La navigazione è fatta di **cose da fare** (verbi), non di contenitori di dati: si
entra in una coda personale di lavoro e si sceglie un'azione, non una sezione.

### 3.2 Mappa della navigazione

**Versione 1 — solo CMS, Fase 1**

```
[Barra superiore]  Centro Amoris Laetitia · Area amministrativa
                   [ Cerca ]                    [ Chi sono io ▾ ]  [ ? Aiuto ]

HOME = «La mia scrivania»
├── Da fare ora                       ← coda personale, ordinata per urgenza
│   ├── (voce) «Bozza ferma da 9 giorni: Orari estivi»
│   └── (voce) «Nessuna immagine di copertina: Chi siamo»
├── Azioni rapide                     ← pulsanti-verbo, sempre gli stessi
│   ├── Pubblicare una notizia
│   ├── Modificare una pagina del sito
│   ├── Cambiare l'ordine delle voci di menu
│   └── Caricare una foto o un documento
└── Ultime cose che ho toccato io     ← elenco cronologico personale

[Secondo livello, raggiungibile ma non primario]
└── Il sito
    ├── Tutte le pagine e le notizie   (elenco unico filtrabile)
    ├── Menu e struttura
    ├── Archivio immagini e file
    └── Impostazioni del sito
        ├── Indirizzi e vecchi indirizzi (redirect)
        ├── Testi che compaiono ovunque (piè di pagina, contatti)
        └── Visibilità sui motori di ricerca
```

**Versione 2 — a regime, nove moduli**

```
HOME = «La mia scrivania»
├── Da fare ora                       ← coda unica, da tutti i moduli
│   ├── «Confermare la data proposta per un colloquio»      (Consultorio)
│   ├── «12 quote sociali non ancora registrate»            (Soci)
│   ├── «Verbale dell'assemblea da caricare»                (Documenti)
│   └── «Bozza ferma da 9 giorni: Orari estivi»             (Sito)
├── In attesa di altri                ← cose che ho avviato e aspettano qualcuno
├── Scadenze del periodo              ← finestra mobile: prossime 6 settimane
└── Azioni rapide                     ← filtrate sui permessi della persona
    ├── Pubblicare una notizia
    ├── Fissare un appuntamento
    ├── Registrare una quota
    ├── Registrare un movimento di cassa
    ├── Iscrivere una persona a un corso
    ├── Caricare un documento
    ├── Creare un modulo da compilare
    └── Scrivere a un gruppo di persone

[Secondo livello: «Gli archivi» — dove si va quando non si ha un compito ma una domanda]
└── Archivi
    ├── Il sito              (pagine, notizie, menu, file, impostazioni, SEO)
    ├── Le persone          (soci, volontari, docenti, consensi, libro soci)
    ├── I corsi e gli eventi (edizioni, iscrizioni, presenze, docenti, compensi)
    ├── L'agenda            (appuntamenti, stanze, disponibilità)
    ├── I documenti         (verbali, bilanci, bandi, gruppi e permessi)
    ├── I conti             (prima nota, movimenti, centri di costo, scadenzario)
    ├── I moduli            (modelli, moduli attivi, risposte)
    ├── Le comunicazioni    (messaggi inviati, liste, modelli)
    └── Statistiche e social

[Terzo livello: «Impostazioni» — fuori dal flusso quotidiano]
└── Impostazioni
    ├── Persone e permessi
    ├── Regole delle stanze e delle disponibilità
    ├── Promemoria e scadenze ricorrenti
    └── Registro delle attività (audit)
```

Il primo livello **non cresce** passando da uno a nove moduli: crescono le voci
dentro «Da fare ora» e i pulsanti dentro «Azioni rapide». È questa la ragione
principale per cui la proposta regge la crescita.

### 3.3 Modello dei ruoli

Non si «cambia ruolo»: i ruoli si **sommano** e producono un'unica coda. Chi è
amministratore, tesoriere e socio vede una sola scrivania che contiene i compiti
di tutti e tre.

- Ogni voce della coda porta un'**etichetta di provenienza** («Consultorio»,
  «Conti», «Sito») e, quando serve, un'etichetta di veste: *«stai per agire come
  tesoriere»*.
- Le azioni che hanno conseguenze verso terzi (inviare, protocollare, registrare
  un movimento, pubblicare) mostrano prima della conferma una riga fissa:
  **«Questa azione sarà registrata a nome di Rosalba, in qualità di tesoriere.»**
- Il menu «Chi sono io» in alto elenca le vesti possedute e serve a *filtrare* la
  scrivania, non a cambiare identità: «mostrami solo i compiti da tesoriere».
- Esiste un solo caso di cambio esplicito: entrare nell'**ambito riservato** del
  consultorio (vedi sotto), che non è un filtro ma un passaggio di soglia.

### 3.4 Trattamento della riservatezza

Meccanismo in quattro pezzi concreti.

1. **Due anagrafiche separate, non una con un campo.** Le persone che si rivolgono
   al consultorio vivono in un registro distinto da quello dei soci e dei
   volontari. Non sono record «nascosti» dello stesso elenco: sono un altro
   elenco, con un'altra tabella, un altro indice di ricerca e un altro insieme di
   permessi. Un errore di filtro in una schermata dei soci non può farli comparire,
   perché lì non ci sono.
2. **La coda dei compiti non trasporta contenuto riservato.** Se un consulente deve
   confermare un colloquio, la voce nella scrivania dice «Una proposta di data
   attende la tua risposta», non chi è coinvolto. Il dettaglio si apre solo
   entrando nell'ambito riservato.
3. **Soglia esplicita.** L'ambito riservato si apre da un'unica porta, con una
   schermata che dichiara: *«Stai entrando nell'area delle consulenze. Quello che
   vedi qui non va riportato altrove. L'accesso viene registrato.»* Da lì in poi
   una fascia permanente in cima allo schermo ricorda che si è dentro, e resta fino
   all'uscita o alla scadenza della sessione.
4. **Visibilità del singolo colloquio calcolata sui partecipanti, non sul ruolo.**
   Un colloquio è visibile a: i consulenti coinvolti, gli utenti coinvolti, il
   direttore, la segreteria. Nessun altro, nemmeno chi ha il ruolo di
   amministratore tecnico: per l'amministratore tecnico il colloquio esiste come
   riga di calendario occupata, senza nomi né contenuto.

### 3.5 Tre flussi passo per passo

**(a) Pubblicare una nuova pagina del sito e inserirla nel menu** — *7 clic*

1. Dalla scrivania, clic su **«Modificare il sito» → «Pubblicare una pagina»** (1).
2. Si apre un percorso guidato a quattro passi. Passo 1: titolo e testo. Si scrive.
   Clic su **Avanti** (2).
3. Passo 2: immagine di copertina. Clic su **Scegli dall'archivio** (3), clic
   sull'immagine (4).
4. Passo 3: **«Dove si trova questa pagina?»** — elenco delle voci di menu esistenti
   con segno di spunta. Clic sulla voce sotto cui inserirla (5), clic su **Avanti** (6).
5. Passo 4: riepilogo con anteprima ridotta e la frase «Sarà visibile a tutti su
   `.../nuova-pagina`». Clic su **Pubblica ora** (7).
6. Conferma: «Pubblicata. La trovi nel menu sotto *Il Centro*.» con due
   collegamenti: «Vedila sul sito» e «Torna alla scrivania».

*Nota*: l'inserimento nel menu è un **passo obbligatorio del percorso**, non una
sezione separata da ricordare. È la differenza principale rispetto a un CMS
tradizionale, dove pubblicare e mettere in menu sono due viaggi distinti.

**(b) Modificare testo e immagine di una pagina esistente e verificarne l'anteprima** — *8 clic*

1. Dalla scrivania: se la pagina è fra «Ultime cose che ho toccato io», clic diretto
   (1). Altrimenti clic su **«Modificare una pagina»** (1) e clic sul risultato di
   ricerca (2). Contiamo il caso peggiore: 2 clic.
2. La pagina si apre **così come appare sul sito**, con i blocchi modificabili al
   loro posto. Clic sul paragrafo da cambiare (3): diventa modificabile sul posto.
   Si scrive.
3. Clic sull'immagine (4) → si apre il pannello «Sostituisci» → clic su
   **Scegli un'altra immagine** (5) → clic sull'immagine nuova (6).
4. Clic su **«Come apparirà»** (7): l'anteprima occupa lo schermo intero, con
   selettore telefono / tablet / computer.
5. Clic su **«Salva e pubblica»** (8). Riga di conferma con «Annulla la modifica»
   disponibile per 30 secondi, e con lo storico versioni sempre raggiungibile dalla
   pagina stessa.

**(c) Trovare cosa devo fare oggi, entrando dopo sei mesi** — *0 clic*

1. Si entra. **La scrivania è già la risposta.**
2. In cima, una riga di riambientamento: *«Bentornata. L'ultima volta sei entrata a
   marzo. Da allora sono successe 3 cose che ti riguardano.»*
3. Sotto, «Da fare ora» con al massimo 5 voci, ciascuna scritta come frase
   compiuta: «Registrare 12 quote sociali arrivate a gennaio», non «Quote: 12».
4. Ogni voce ha un **«Perché lo vedo?»** che, cliccato, spiega: «Perché sei
   tesoriere e le quote vanno chiuse entro il 30 aprile».
5. Se la coda è vuota, non compare una schermata vuota ma la frase «Non c'è nulla
   in attesa di te» seguita dalle azioni rapide.

### 3.6 Promemoria e scadenze

- **Un solo posto**: la coda «Da fare ora» e la sua estensione «Scadenze del
  periodo». Non esistono notifiche che vivono altrove.
- Le scadenze ricorrenti (30 aprile, 1° marzo, 1° ottobre) sono **regole
  configurate una volta** in Impostazioni, che generano voci di coda al momento
  giusto, non un anno prima.
- **Anti-rumore**: una voce di coda ha tre destini e nessun altro — la si *fa*, la
  si *rimanda a una data* (torna quel giorno), la si *archivia con motivo*. Non
  esiste il semplice «chiudi»: chiudere senza motivo è il modo in cui le code
  diventano rumore.
- Le voci si spengono da sole quando la condizione che le ha generate non c'è più:
  se le 12 quote vengono registrate, la voce sparisce senza che nessuno la tocchi.
- Escalation: una voce ignorata per due volte cambia formulazione e, se prevista
  dalla regola, genera un avviso alla segreteria — non un secondo promemoria alla
  stessa persona.

### 3.7 Comportamento su mobile

| Compito | Telefono | Motivo |
|---|---|---|
| Leggere la coda e capire cosa fare | **Sì, primario** | È l'uso tipico: apro, vedo, decido |
| Confermare, accettare, rimandare, approvare | **Sì** | Un tocco, nessuna digitazione |
| Correggere un testo breve, cambiare una foto | **Sì** | Modifica sul posto, blocco per blocco |
| Caricare una foto appena scattata | **Sì, avvantaggiato** | La fotocamera è lì |
| Registrare una quota singola | **Sì** | Modulo corto |
| Scrivere una pagina nuova da zero | **Sconsigliato** | Possibile ma scomodo |
| Import bancario, riconciliazione, rendiconto | **No** | Tabelle larghe, confronti multipli |
| Costruire un modulo, gestire la matrice dei permessi | **No** | Manipolazione strutturale |
| Riordinare l'archivio immagini | **No** | Trascinamento multiplo |

**Degrado**: i compiti esclusi non spariscono e non si rompono. Compaiono con
l'etichetta *«Si fa meglio da computer»* e un pulsante **«Mandami il collegamento
via email»**, che recapita l'indirizzo esatto della schermata. Nessun vicolo cieco,
nessuna pagina che si apre e non funziona.

### 3.8 Audit log

- **Non è una sezione**: è la **storia di ogni oggetto**. Ogni pagina, socio,
  documento, movimento ha in fondo una scheda «Chi ha fatto cosa», sempre visibile
  a chi può vedere l'oggetto.
- La scheda è scritta in italiano corrente: «Il 12 marzo Donato ha cambiato il
  testo. Il 14 marzo Marilena ha sostituito la foto.»
- Il **registro completo e filtrabile** esiste in Impostazioni → *Registro delle
  attività*, e serve al direttore e all'amministratore. Ci si arriva anche da ogni
  scheda di oggetto, con «Mostra tutto quello che è successo».
- Gli accessi all'ambito riservato sono registrati **sempre**, anche quando non
  segue nessuna modifica, e sono consultabili dal direttore.

### 3.9 Punti deboli dichiarati

1. **La coda va alimentata, e alimentarla è lavoro vero.** Ogni modulo deve saper
   dire «questo genera un compito, questo no», con la regola giusta. Con un solo
   sviluppatore il rischio concreto è una coda che si riempie di voci inutili — e
   una coda inaffidabile fa crollare l'intera proposta, perché è l'unico punto
   d'ingresso. È la debolezza più seria delle quattro proposte.
2. **Chi ha una domanda invece di un compito è cittadino di seconda classe.**
   «Quante persone si sono iscritte al corso del 2025?» non è un compito: richiede
   di scendere al secondo livello, negli «Archivi», che è progettato come
   secondario e quindi meno curato.
3. **Rischio di doppia navigazione.** «Azioni rapide» e «Archivi» permettono di
   arrivare alla stessa schermata per due strade. Se non si è rigorosi, gli utenti
   imparano una sola strada e ignorano l'altra, e metà del sistema diventa
   invisibile.

---

## 4. Proposta B — «Le aree di responsabilità»

### 4.1 Principio organizzatore in una frase

Si sceglie **in quale veste si sta lavorando** (Redazione, Segreteria, Tesoreria,
Consulenza, Direzione) e l'intera applicazione si riconfigura su quella veste: ogni
area è un ambiente di lavoro chiuso, con il proprio menu, la propria home e i propri
dati.

### 4.2 Mappa della navigazione

**Versione 1 — solo CMS, Fase 1**

```
[Schermata di ingresso]  «In quale veste vuoi lavorare?»
   ┌──────────────────┐  ┌───────────────────┐
   │   REDAZIONE      │  │   DIREZIONE       │     ← solo le aree possedute
   │   3 cose aperte  │  │   nulla in sospeso│
   └──────────────────┘  └───────────────────┘
   (chi possiede una sola area la salta: entra diretto)

AREA REDAZIONE
├── Situazione dell'area            ← home: cosa è in bozza, cosa è online, cosa è fermo
├── Pagine e notizie                 (elenco unico, filtri: bozza / online / fermo)
├── Struttura del sito               (menu, indirizzi, vecchi indirizzi)
├── Immagini e file
└── Come ci trovano                  (SEO, testi di condivisione)

AREA DIREZIONE
├── Situazione generale
├── Chi può fare cosa                (persone e permessi)
├── Registro delle attività          (audit)
└── Impostazioni generali

[Barra permanente in alto]
  «Stai lavorando come: REDAZIONE ▾»    ← il cambio veste è sempre qui, un clic
```

**Versione 2 — a regime, nove moduli**

```
[Schermata di ingresso]  «In quale veste vuoi lavorare?»
  REDAZIONE · SEGRETERIA · TESORERIA · FORMAZIONE · CONSULENZA · DIREZIONE
  (ogni riquadro mostra un conteggio di cose aperte;
   le aree non possedute non compaiono)

AREA REDAZIONE          → come sopra, invariata

AREA SEGRETERIA
├── Situazione dell'area
├── Persone                 (soci, volontari, consensi, libro soci)
├── Agenda e stanze         (calendario, disponibilità, prenotazioni)
├── Iscrizioni              (corsi ed eventi, presenze)
├── Richieste in arrivo     (risposte ai moduli del sito)
├── Comunicazioni           (email, newsletter, SMS, promemoria)
└── Protocollo e documenti

AREA TESORERIA
├── Situazione dell'area     (saldo, scadenze prossime, cosa manca)
├── Quote sociali
├── Prima nota
├── Movimenti bancari        (import, categorizzazione, riconciliazione)
├── Centri di costo
├── Scadenzario e adempimenti
└── Rendiconto

AREA FORMAZIONE
├── Situazione dell'area
├── Corsi ed edizioni
├── Iscritti e presenze
├── Docenti e compensi
└── Supervisione             ← sotto-area a visibilità ristretta

AREA CONSULENZA              ← ambiente separato, ingresso con soglia
├── La mia agenda
├── I miei colloqui
├── Proposte di data da accettare
└── Le mie note

AREA DIREZIONE
├── Situazione generale      (una riga per area, senza dettagli riservati)
├── Chi può fare cosa
├── Registro delle attività
├── Statistiche
└── Impostazioni generali
```

Il primo livello passa da 2 aree a 6 aree. È l'unica delle quattro proposte in cui
il primo livello cresce — ma cresce di quattro voci in totale, non di nove.

### 4.3 Modello dei ruoli

È il punto di forza della proposta: **il ruolo non è un attributo invisibile, è il
luogo in cui ci si trova**.

- Chi possiede **una sola** area non vede mai la schermata di scelta: entra
  direttamente. Per P1 e P4 il concetto di «veste» non esiste proprio.
- Chi ne possiede più d'una vede la schermata di scelta all'ingresso e può cambiare
  da una barra permanente: **1 clic per aprire, 1 per scegliere**.
- L'area corrente è dichiarata in cima a ogni schermata, con parole: «Stai lavorando
  come **Tesoreria**». Non è un'icona, non è un colore soltanto: è una frase.
- Ogni azione che produce effetti è **firmata dall'area**: un movimento registrato
  in Tesoreria risulta «registrato da Rosalba, area Tesoreria». Se la stessa persona
  ha anche la veste di segretario, l'atto resta attribuito all'area in cui è stato
  compiuto.
- **Le aree non comunicano di nascosto.** Se da Tesoreria serve un dato che vive in
  Segreteria, compare un rimando esplicito: «Questo dato sta in Segreteria.
  Vuoi passare?» — e passare è un cambio di area tracciato.

### 4.4 Trattamento della riservatezza

È il meccanismo più forte delle quattro, perché non è un filtro ma una **separazione
di ambiente**.

1. **Consulenza è un'area a sé**, con il proprio insieme di dati. Le persone seguite
   dal consultorio esistono solo lì. Nessuna schermata di Segreteria o Tesoreria
   interroga quei dati, perché le loro schermate sono costruite su un altro insieme.
2. **La sessione è vincolata all'area.** Finché si sta in Tesoreria, le richieste al
   sistema portano il contesto «area = Tesoreria», e il sistema rifiuta di
   restituire dati di Consulenza *anche se l'account di quella persona avrebbe il
   permesso*. Il permesso non basta: serve essere nell'area giusta. È questo che
   rende la separazione non aggirabile per distrazione.
3. **Ingresso con soglia.** Entrare in Consulenza richiede una conferma esplicita
   e, se il committente lo vorrà, una seconda verifica d'identità. L'ingresso è
   registrato sempre.
4. **Doppia visibilità del calendario.** In Segreteria e in Direzione il calendario
   mostra i colloqui con i soli dati di servizio (quando, quale stanza, quale
   consulente, stato della conferma). In Consulenza il consulente coinvolto vede
   anche il contenuto. Le altre aree vedono la stanza occupata e nient'altro: né
   nome, né tipo di incontro.
5. **Uscita per inattività più severa** in Consulenza che altrove.

### 4.5 Tre flussi passo per passo

**(a) Pubblicare una nuova pagina del sito e inserirla nel menu** — *7 clic*
(*6 se la persona possiede la sola area Redazione*)

1. Ingresso: clic su **REDAZIONE** (1). Chi ha solo quest'area salta il passo.
2. Clic su **Pagine e notizie** (2).
3. Clic su **Nuova pagina** (3). Si scrive titolo e testo.
4. Clic su **Immagine di copertina** (4) → clic sull'immagine (5).
5. Clic su **Pubblica** (6).
6. Compare una richiesta, non un avviso: *«La pagina è online ma non è raggiungibile
   dal menu. Vuoi metterla nel menu?»* con l'elenco delle posizioni possibili. Clic
   sulla posizione scelta (7). La finestra si chiude da sola confermando.

**(b) Modificare testo e immagine di una pagina esistente e verificarne l'anteprima** — *9 clic*

1. Clic su **REDAZIONE** (1) — saltabile per chi ha una sola area.
2. Clic su **Pagine e notizie** (2).
3. Clic sulla pagina nell'elenco (3). Si apre l'editor a due riquadri: a sinistra il
   contenuto, a destra l'anteprima **sempre accesa**, che si aggiorna mentre si
   scrive.
4. Clic sul paragrafo (4), si scrive.
5. Clic sull'immagine (5) → **Sostituisci** (6) → clic sulla nuova (7).
6. L'anteprima è già visibile; per verificarla su telefono, clic sull'icona
   telefono nel riquadro di destra (8).
7. Clic su **Salva e pubblica** (9).

**(c) Trovare cosa devo fare oggi, entrando dopo sei mesi** — *1 clic*
(*0 per chi possiede una sola area*)

1. Si entra. La schermata di scelta mostra i riquadri delle proprie aree, ciascuno
   con un conteggio in chiaro: **«TESORERIA — 2 cose aperte, 1 scadenza vicina»**.
2. Clic sull'area che ha qualcosa in sospeso (1).
3. Si apre «Situazione dell'area»: un elenco breve in frasi compiute, preceduto da
   *«L'ultima volta sei entrata a marzo. Da allora: 12 quote sono arrivate, il
   termine del 30 aprile si avvicina.»*
4. Il rientro è guidato dal **luogo**: «io qui faccio la tesoriera, e la tesoreria mi
   sta dicendo queste due cose».

### 4.6 Promemoria e scadenze

- I promemoria **vivono nell'area a cui appartengono** e compaiono nel conteggio del
  riquadro d'ingresso. Le scadenze fiscali stanno in Tesoreria, non altrove.
- Chi possiede più aree non riceve una lista unica: riceve **conteggi separati per
  area**. È un vantaggio (nessuna mescolanza) e insieme un limite (serve entrare per
  vedere il dettaglio).
- Le scadenze ricorrenti sono definite come *adempimenti dell'area*, con finestra di
  apertura e termine: «Certificazioni Uniche — si apre il 1° marzo». L'area mostra
  l'adempimento solo dentro la sua finestra, mai prima.
- Spegnimento: un adempimento si chiude **dichiarandolo fatto**, con data e, se
  previsto, un allegato di prova. Il gesto produce una riga nel registro dell'area:
  è insieme il modo di spegnere il promemoria e di lasciarne traccia.
- **Un solo canale esterno**: l'email di riepilogo. Una sola email settimanale per
  persona, che elenca per area cosa è aperto. Nessuna notifica per singolo evento,
  salvo gli appuntamenti che richiedono una risposta.

### 4.7 Comportamento su mobile

Il telefono mostra **una sola area per volta**, a schermo intero, con il cambio veste
in un menu esplicito. Il concetto di area si traduce naturalmente sul piccolo
schermo, perché elimina la navigazione laterale.

| Compito | Telefono |
|---|---|
| Consulenza: agenda, accettare o riproporre una data | **Sì, primario** — è l'uso più frequente in assoluto |
| Segreteria: confermare, rispondere, consultare una scheda | **Sì** |
| Redazione: correzione breve, sostituzione immagine, pubblicazione di una notizia | **Sì** |
| Tesoreria: registrare una quota, consultare il saldo, spuntare un adempimento | **Sì, limitato** |
| Tesoreria: import bancario, riconciliazione, rendiconto | **No** |
| Direzione: matrice dei permessi | **No** |
| Formazione: presenze di un'intera edizione | **Parziale** — spunta sì, modifica strutturale no |

**Degrado**: ogni area dichiara in cima, su schermo stretto, quali delle sue voci
sono disponibili e quali no: *«Da telefono questa area ti permette di registrare
quote e consultare il saldo. L'import bancario e il rendiconto richiedono un
computer.»* Detto **prima**, non al momento del fallimento.

### 4.8 Audit log

- **Ogni area ha il proprio registro**, dentro l'area, con il vocabolario dell'area:
  in Tesoreria «chi ha registrato cosa», in Redazione «chi ha pubblicato cosa».
  È il registro che il responsabile dell'area consulta per fatto proprio.
- La **Direzione** ha il registro trasversale, che unisce i registri delle aree.
  Dei fatti di Consulenza mostra solo l'accaduto di servizio: «Ernesto ha aperto
  l'area Consulenza il 14 alle 9:20», mai il contenuto.
- Ogni oggetto porta comunque la propria storia breve in fondo alla scheda.
- Il registro dell'area è raggiungibile in 2 clic da dentro l'area, il che ne rende
  plausibile la consultazione ordinaria.

### 4.9 Punti deboli dichiarati

1. **Il lavoro che attraversa le aree diventa faticoso.** Iscrivere una persona a un
   corso e insieme registrarne la quota tocca Segreteria e Tesoreria: il lavoro
   reale non rispetta i confini organizzativi. Ogni attraversamento è un cambio di
   ambiente, e i cambi si pagano. Con un volontario che fa tutto da solo — caso
   frequente in un'associazione piccola — il costo è quotidiano.
2. **Le aree possono non corrispondere a come il Centro si pensa davvero.** Le sei
   aree qui proposte sono un'ipotesi. Se l'organizzazione reale è più fluida («qui
   facciamo tutti tutto»), l'architettura impone una formalità che non esiste e
   diventa un attrito.
3. **Chi possiede quattro vesti ha quattro home e nessuna visione d'insieme.** Il
   direttore e il segretario tuttofare devono ricostruire mentalmente il quadro
   complessivo entrando e uscendo. La schermata d'ingresso con i conteggi mitiga il
   problema, non lo risolve.

---

## 5. Proposta C — «Il registro degli oggetti»

### 5.1 Principio organizzatore in una frase

Tutto ciò che esiste nel sistema è un **oggetto schedato** (una pagina, una persona,
un documento, un movimento, un appuntamento, una risposta), e si lavora **cercando**
e **filtrando** gli oggetti anziché navigando un albero di sezioni.

### 5.2 Mappa della navigazione

**Versione 1 — solo CMS, Fase 1**

```
[Barra superiore, sempre presente]
   [ Cerca o scrivi un comando…  Ctrl+K ]      [ + Crea ]     [ Chi sono io ▾ ]

COLONNA SINISTRA = «Le mie viste»    ← elenchi salvati, non sezioni
├── ★ Assegnati a me
├── ★ Modificati di recente
├── ★ Bozze ferme da più di 7 giorni
├── ★ Pagine senza immagine
├── ── (separatore) ──
├── Tutti gli oggetti                ← elenco unico, tutti i tipi insieme
└── + Nuova vista                     ← l'utente crea le proprie

SCHERMATA PRINCIPALE = un elenco di schede, con barra di filtri sopra:
   Tipo: [ Pagina ▾ ]  Stato: [ Bozza ▾ ]  Chi: [ chiunque ▾ ]  Quando: [ sempre ▾ ]
   ┌────────────────────────────────────────────────────────┐
   │ ◻ Orari estivi              Pagina · Bozza · Marilena  │
   │ ◻ Chi siamo                 Pagina · Online · Donato   │
   │ ◻ Incontro del 12 ottobre   Notizia · Online · Marilena│
   └────────────────────────────────────────────────────────┘

SCHEDA DI UN OGGETTO (si apre di lato, non sostituisce l'elenco)
├── Contenuto            (modificabile sul posto)
├── Proprietà            (stato, indirizzo, posizione nel menu, visibilità sui motori)
├── Collegamenti         (in quali menu compare, quali pagine la citano)
└── Attività             (chi ha fatto cosa — vedi 5.8)
```

**Versione 2 — a regime, nove moduli**

```
[Barra superiore]  [ Cerca o scrivi un comando… ]  [ + Crea ]  [ Chi sono io ▾ ]

COLONNA SINISTRA
├── ★ Assegnati a me
├── ★ Scadenze entro 30 giorni
├── ★ In attesa di una mia risposta
├── ── I tipi di oggetto ──         ← non è il primo livello: è un filtro rapido
│   ├── Contenuti del sito
│   ├── Persone
│   ├── Appuntamenti
│   ├── Iscrizioni
│   ├── Documenti
│   ├── Movimenti
│   ├── Moduli e risposte
│   └── Comunicazioni
├── ── Le mie viste ──
│   ├── ★ Quote non pagate 2026
│   ├── ★ Documenti da protocollare
│   ├── ★ Movimenti senza categoria
│   └── + Nuova vista
└── ── Condivise con me ──          ← viste preparate dalla segreteria per gli altri
    ├── «Cosa deve fare il tesoriere ad aprile»
    └── «Corsi in partenza»

[ + Crea ]  apre un elenco unico di cose creabili, filtrato sui permessi:
   Pagina · Notizia · Persona · Appuntamento · Documento · Movimento ·
   Iscrizione · Modulo · Comunicazione

[ Impostazioni ] fuori dall'elenco, in fondo alla colonna.
```

La navigazione **non cambia forma** fra i due stati: cambiano i tipi disponibili nei
filtri e le viste salvate. È la proposta che scala con il minor lavoro strutturale.

### 5.3 Modello dei ruoli

- Il ruolo **non si sceglie**: determina cosa la ricerca trova e cosa il pulsante
  «Crea» offre. Chi non è tesoriere non trova i movimenti, e per lui la parola
  «movimento» semplicemente non produce risultati.
- Chi ha più ruoli ha **più tipi disponibili**, non più ambienti. Il menu «Chi sono
  io» elenca le vesti a scopo informativo: «Sei amministratore, tesoriere e socia».
- L'attribuzione degli atti è **automatica per tipo di oggetto**: registrare un
  movimento è per definizione un atto di tesoreria, e viene firmato così. Non si
  chiede alla persona in che veste stia agendo, perché l'oggetto lo determina già.
- Per le azioni con conseguenze rilevanti la scheda mostra, prima della conferma,
  la riga: **«Stai agendo come tesoriere. Questo atto sarà registrato.»**

### 5.4 Trattamento della riservatezza

Qui la riservatezza è **una proprietà dell'oggetto**, e la ricerca è il punto in cui
può rompersi. Il meccanismo deve quindi essere severo.

1. **Ogni oggetto porta una classificazione obbligatoria**: *pubblico*, *interno*,
   *riservato*. Non esiste oggetto senza classificazione; il valore predefinito per
   ogni tipo è deciso in fase di progettazione, non lasciato all'utente.
2. **Gli oggetti riservati non entrano nell'indice di ricerca generale.** Non sono
   «filtrati dopo»: non ci sono. Ricercarne il nome non produce nemmeno un risultato
   oscurato, perché anche un risultato oscurato rivela l'esistenza.
3. **Ambito riservato come modalità dichiarata.** Per lavorare sugli oggetti
   riservati si attiva esplicitamente l'ambito riservato dalla barra superiore. Da
   quel momento una fascia permanente lo dichiara, la ricerca include quegli
   oggetti, e ogni ricerca eseguita in quell'ambito è registrata. L'ambito scade da
   solo dopo un periodo breve di inattività.
4. **Le viste salvate non attraversano la riservatezza.** Una vista condivisa esegue
   la ricerca **con i permessi di chi la apre**, non di chi l'ha creata. Se la
   segreteria condivide una vista che contiene oggetti riservati, gli altri la
   aprono vuota.
5. **Nessuna esportazione silenziosa.** Esportare un elenco che contiene oggetti
   riservati richiede una conferma nominale ed è registrato come atto.

### 5.5 Tre flussi passo per passo

**(a) Pubblicare una nuova pagina del sito e inserirla nel menu** — *6 clic*
(*2 clic e due comandi da tastiera per chi usa la tastiera*)

1. Clic su **+ Crea** (1) → clic su **Pagina** (2).
   *Con la tastiera*: `Ctrl+K`, si digita «nuova pagina», Invio.
2. Si apre la scheda. Si scrive titolo e testo nel riquadro contenuto.
3. Nel riquadro **Proprietà**, clic su **Immagine** (3) → clic sull'immagine (4).
4. Sempre in Proprietà, la riga **«Posizione nel menu»** con elenco a discesa: clic,
   scelta della posizione (5).
5. Clic su **Pubblica** (6). La scheda resta aperta, lo stato passa a «Online».

*Nota*: la posizione nel menu è una **proprietà dell'oggetto pagina**, non una
sezione separata. Chi conosce il modello arriva prima di tutti; chi non lo conosce
deve però sapere che quella proprietà esiste — è il rovescio della medaglia.

**(b) Modificare testo e immagine di una pagina esistente e verificarne l'anteprima** — *7 clic*

1. Clic nella barra di ricerca (1), si digita «orari», clic sul risultato (2).
   *Con la tastiera*: `Ctrl+K`, «orari», Invio — 0 clic.
2. La scheda si apre di lato. Clic sul paragrafo (3), si scrive.
3. Clic sull'immagine in Proprietà (4) → clic su **Sostituisci** (5) → clic sulla
   nuova immagine (6).
4. Clic su **«Anteprima»** in cima alla scheda (7): la scheda si allarga e mostra la
   pagina come apparirà, con selettore di larghezza.
5. Salvataggio automatico continuo; la pubblicazione è un cambio di stato esplicito
   se la pagina era in bozza.

**(c) Trovare cosa devo fare oggi, entrando dopo sei mesi** — *0 clic, ma con una riserva seria*

1. Si entra. La vista predefinita è **★ Assegnati a me**, quindi tecnicamente
   l'informazione è già a schermo.
2. In cima compare la riga di riambientamento: *«Dall'ultimo accesso: 12 oggetti
   nuovi ti riguardano.»*
3. **La riserva**: l'elenco è composto di schede con nome, tipo, stato e data — un
   linguaggio da registro, non da conversazione. «Quota 2026 — Persona 118 — non
   pagata» richiede di ricordare che cosa significhi. Per mitigare, le viste
   predefinite hanno **titoli in forma di frase** («Le quote che devo ancora
   registrare») e ogni vista porta una riga di spiegazione sotto il titolo.
4. Chi non trova la propria vista deve **cercare**, e cercare richiede di sapere come
   si chiama la cosa. Dopo sei mesi, è esattamente ciò che manca.

### 5.6 Promemoria e scadenze

- Le scadenze sono una **proprietà degli oggetti**: un movimento ha una data di
  scadenza, un adempimento ha una finestra, una quota ha un termine.
- I promemoria non sono entità separate: sono **viste** costruite su quelle
  proprietà. «Scadenze entro 30 giorni» è una vista, non una funzione.
- **Vantaggio**: nessuna duplicazione, nessun promemoria che sopravvive alla cosa che
  lo ha generato. Se il movimento viene registrato, esce dalla vista.
- **Rischio dichiarato**: una vista non bussa. Se nessuno la apre, la scadenza passa.
  Serve quindi un **recapito attivo**: ogni vista può essere impostata come
  «mandamela via email ogni lunedì» o «avvisami quando ha almeno una riga». Questo
  recupero è essenziale alla proposta, non accessorio.
- **Anti-rumore**: il recapito è una scelta della persona, vista per vista. Chi non
  vuole email non ne riceve; chi le vuole sceglie quali e con che cadenza. Il
  sistema non decide al posto suo.

### 5.7 Comportamento su mobile

La struttura elenco + scheda è la più naturale da adattare: su telefono l'elenco
occupa lo schermo e la scheda si apre sopra.

| Compito | Telefono |
|---|---|
| Cercare un oggetto e leggerlo | **Sì, eccellente** — è il caso d'uso migliore delle quattro proposte |
| Cambiare uno stato, spuntare, approvare, confermare | **Sì** |
| Modifica breve di testo o immagine | **Sì** |
| Creare un oggetto semplice (movimento, iscrizione, nota) | **Sì** |
| Costruire o modificare una **vista** con più filtri | **No** — troppa manipolazione |
| Selezione multipla e azioni di massa | **No** |
| Import bancario, rendiconto, form builder | **No** |

**Degrado**: su telefono la colonna delle viste diventa un menu a tendina in cima;
le viste restano consultabili, ma non modificabili. La barra dei filtri si riduce a
due filtri («tipo» e «stato») con un collegamento «Filtri avanzati — meglio da
computer». Le azioni di massa sono nascoste, non disabilitate: non si vedono proprio.

### 5.8 Audit log

- L'audit è **un tipo di oggetto come gli altri**, e quindi si interroga con gli
  stessi strumenti: stessa ricerca, stessi filtri, stesse viste salvate.
- Ogni scheda ha la linguetta **«Attività»** con la propria storia.
- «Cosa ha fatto Donato a marzo» è una ricerca normale, non una funzione speciale:
  è la proposta in cui l'audit è più potente e più accessibile.
- Le viste salvate d'ufficio («Chi ha aperto l'ambito riservato negli ultimi 30
  giorni») trasformano una funzione di sorveglianza in un elenco ordinario che il
  direttore può tenere in vista.
- **Attenzione**: essendo l'audit un oggetto, va classificato anch'esso. Le righe che
  riguardano l'ambito riservato sono visibili solo a direttore e amministratore.

### 5.9 Punti deboli dichiarati

1. **Presuppone un vocabolario condiviso che i volontari non hanno.** Cercare
   funziona se si sa come si chiama la cosa. Dopo sei mesi non si sa. È la
   debolezza centrale della proposta: è la migliore per chi usa il sistema tutti i
   giorni (P2) e la peggiore per chi entra due volte l'anno (P1, P3).
2. **La riservatezza si gioca tutta sulla correttezza dell'indice di ricerca.** Un
   solo tipo di oggetto classificato male, o un solo campo indicizzato per errore,
   e la separazione cade in modo silenzioso. Rispetto alla Proposta B, dove la
   separazione è strutturale, qui è una proprietà da mantenere corretta per sempre —
   con un solo sviluppatore, è un rischio che va messo in conto.
3. **Le viste salvate degenerano.** Nel giro di due anni le viste diventano decine,
   alcune rotte, alcune duplicate, nessuna cancellata. Serve fin dall'inizio una
   disciplina di manutenzione (proprietario, data di ultimo uso, archiviazione
   automatica delle viste mai aperte) che è lavoro aggiuntivo.
4. **È la più lontana dalle abitudini dei volontari.** Somiglia a strumenti
   professionali che P1, P3 e P4 con ogni probabilità non usano.

---

## 6. Proposta D — «L'anno associativo»

### 6.1 Principio organizzatore in una frase

La navigazione è il **tempo**: si entra in «Oggi», si scorre avanti e indietro lungo
l'anno associativo, e i moduli si raggiungono attraverso il momento che li richiede.

### 6.2 Mappa della navigazione

**Versione 1 — solo CMS, Fase 1**

```
[Barra superiore]  ◀ Settembre 2026 ▶      [ Oggi ]   [ Cerca ]   [ Chi sono io ▾ ]

SCHERMATA PRINCIPALE = la linea del tempo
┌─────────────────────────────────────────────────────────────────┐
│  OGGI — lunedì 14 settembre                                     │
│  ・ La notizia «Iscrizioni aperte» va online oggi               │
│  ・ Bozza ferma da 9 giorni: «Orari estivi»                     │
│─────────────────────────────────────────────────────────────────│
│  QUESTA SETTIMANA                                               │
│  ・ giovedì: scade la pubblicazione dell'avviso                 │
│─────────────────────────────────────────────────────────────────│
│  PIÙ AVANTI                                                     │
│  ・ 1 ottobre: aggiornare la pagina «Attività» per l'anno nuovo │
│─────────────────────────────────────────────────────────────────│
│  ◀ GIÀ SUCCESSO (scorrendo all'indietro)                        │
│  ・ 2 settembre: Marilena ha pubblicato «Incontro del 12»       │
└─────────────────────────────────────────────────────────────────┘

[ + Aggiungi ]   ← pulsante permanente: cosa si può creare, filtrato sui permessi
     ├── Una notizia (con data di pubblicazione)
     ├── Una pagina (senza data: va nel «fuori tempo»)
     └── Un promemoria per me

[ Il sito ]   ← la scheda «fuori dal tempo», per le cose che non hanno una data
     ├── Le pagine stabili         (Chi siamo, Dove siamo, Contatti)
     ├── Menu e struttura
     ├── Immagini e file
     └── Impostazioni
```

**Versione 2 — a regime, nove moduli**

```
[Barra superiore]  ◀ Settembre 2026 ▶   [ Oggi ]  [ L'anno ]  [ Cerca ]  [ Chi sono io ▾ ]

VISTA «OGGI»                    ← predefinita
├── I miei appuntamenti di oggi              (Consultorio, Corsi)
├── Cosa scade oggi e questa settimana       (Tesoreria, Documenti, Sito)
├── Cosa aspetta una mia risposta            (proposte di data, approvazioni)
└── Cosa è cambiato dal mio ultimo accesso

VISTA «L'ANNO»                  ← la mappa lunga, dodici mesi in una schermata
┌──────────────────────────────────────────────────────────────────┐
│ GEN  FEB  [MAR]  APR  MAG  GIU  LUG  AGO  SET  OTT  NOV  DIC     │
│            ▲ CU        ▲ quote                  ▲ 770            │
│            │ dal 1°    │ entro il 30            │ dal 1°         │
│  ▬▬▬ corso primavera ▬▬▬        ▬▬▬ corso autunno ▬▬▬            │
│         ▬ assemblea ▬                      ▬ rendiconto ▬        │
└──────────────────────────────────────────────────────────────────┘
   (ogni elemento è cliccabile e porta dentro il modulo giusto,
    già filtrato sul periodo)

LE SCHEDE «FUORI DAL TEMPO»     ← ciò che non ha una data propria
├── Il sito             (pagine stabili, menu, file, impostazioni, SEO)
├── Le persone          (soci, volontari, consensi, libro soci)
├── I documenti         (archivio, gruppi, permessi)
├── I conti             (piano dei conti, centri di costo, saldi)
├── I moduli            (modelli e moduli attivi)
└── Impostazioni        (permessi, stanze, ricorrenze, registro attività)
```

Il primo livello resta di **tre voci** (Oggi · L'anno · le schede fuori dal tempo)
sia con un modulo sia con nove. È il primo livello più stabile delle quattro
proposte.

### 6.3 Modello dei ruoli

- Il ruolo **filtra la linea del tempo**: ognuno vede sulla stessa struttura gli
  eventi che lo riguardano. Il tesoriere vede il 30 aprile; il redattore no.
- Non esiste cambio di veste: esiste un **filtro «Mostra anche»** che permette al
  direttore di vedere la linea del tempo di un'area diversa dalla propria, in sola
  lettura e in modo dichiarato («Stai guardando l'anno della Tesoreria»).
- Quando un atto richiede una veste specifica, la riga di conferma la nomina:
  «Registrerai questo movimento come tesoriere».
- Per chi ha più vesti è la proposta **meno faticosa**, perché non chiede mai di
  scegliere: il tempo è uno solo per tutti.

### 6.4 Trattamento della riservatezza

Il calendario è insieme il punto di forza e il punto di massimo pericolo: un
calendario condiviso è la superficie da cui la riservatezza scappa più facilmente.

1. **Ogni elemento del tempo ha tre livelli di rappresentazione**, e il sistema
   sceglie quale mostrare in base a chi guarda:
   - **completo** — titolo, partecipanti, contenuto: solo consulenti coinvolti,
     utenti coinvolti, direttore, segreteria;
   - **di servizio** — quando, quale stanza, quale consulente, stato della conferma,
     nessun nome di utente: per chi gestisce le stanze;
   - **opaco** — «occupato», nient'altro: per tutti gli altri.
2. **L'opaco è il valore predefinito.** Un elemento nuovo nasce opaco e diventa più
   visibile solo per regola esplicita. Un errore di configurazione produce quindi
   meno visibilità, non di più. È il principio che rende il meccanismo non
   aggirabile per distrazione.
3. **Le persone seguite dal consultorio non compaiono in nessun elenco di persone.**
   Vivono in un registro separato, raggiungibile solo dall'elemento di calendario a
   cui sono legate, e solo da chi ne ha visibilità completa.
4. **Nessuna esportazione del calendario** verso agende esterne per gli elementi
   riservati, in nessuna forma: nemmeno come «occupato». Le agende esterne sono il
   modo classico in cui questi dati escono dal perimetro.
5. **La vista «L'anno» non mostra mai elementi riservati**, nemmeno opachi: a quel
   livello di zoom un blocco ricorrente il martedì alle 17 rivelerebbe comunque
   troppo.

### 6.5 Tre flussi passo per passo

**(a) Pubblicare una nuova pagina del sito e inserirla nel menu** — *9 clic*
(*è il flusso peggiore delle quattro proposte, e la ragione è strutturale*)

1. Una pagina stabile non ha una data, quindi non appartiene alla linea del tempo.
   Clic su **Il sito** (1) fra le schede fuori dal tempo.
2. Clic su **Le pagine stabili** (2).
3. Clic su **Nuova pagina** (3). Si scrive titolo e testo.
4. Clic su **Immagine** (4) → clic sull'immagine (5).
5. Clic su **Menu** (6) → clic sulla posizione (7).
6. Clic su **Pubblica** (8) → clic su **Conferma** (9).

*Per una **notizia**, che ha una data, il flusso è molto migliore*: da «Oggi», clic
su **+ Aggiungi** (1) → **Una notizia** (2) → si scrive → clic sull'immagine (3, 4)
→ clic su **Pubblica il** con la data già proposta (5). **5 clic**, e la notizia
compare da sola sulla linea del tempo alla data scelta.

**(b) Modificare testo e immagine di una pagina esistente e verificarne l'anteprima** — *8 clic*

1. Clic su **Il sito** (1) → **Le pagine stabili** (2) → clic sulla pagina (3).
   *Scorciatoia*: se la pagina è stata toccata di recente compare nel «già
   successo» della linea del tempo, e si arriva in 1 clic.
2. Clic sul paragrafo (4), si scrive.
3. Clic sull'immagine (5) → **Sostituisci** (6) → clic sulla nuova (7).
4. Clic su **Anteprima** (8).
5. Clic su **Pubblica**. *(Il conteggio dichiarato di 8 esclude la pubblicazione
   finale, per omogeneità con il conteggio degli altri flussi.)*

**(c) Trovare cosa devo fare oggi, entrando dopo sei mesi** — *0 clic, ed è il flusso migliore delle quattro*

1. Si entra. La schermata **è** «Oggi».
2. In cima: *«Bentornata. Sei entrata l'ultima volta il 3 marzo. Da allora sono
   passate 24 settimane. Ecco cosa è cambiato e cosa ti aspetta.»*
3. Tre blocchi, in quest'ordine: **oggi**, **questa settimana**, **cosa è cambiato
   mentre non c'eri**.
4. Un quarto blocco, decisivo per il rientro stagionale: **«In questo periodo
   dell'anno di solito si fa…»**, che nel mese di marzo dice «si richiedono le
   Certificazioni Uniche» e ad aprile «si chiudono le quote sociali». È conoscenza
   del calendario associativo, non una notifica.
5. Clic su **L'anno** per vedere dove ci si trova nel ciclo annuale: è il modo più
   rapido per ricostruire il contesto perduto.

### 6.6 Promemoria e scadenze

È il terreno naturale di questa proposta.

- Le scadenze **sono** la navigazione: non vivono in un posto, sono il posto.
- Le ricorrenze annuali del Centro sono definite una volta sola come **ricorrenze
  dell'anno associativo**, con anticipo e responsabile: «Quote sociali — termine 30
  aprile — compare dal 1° marzo — responsabile: tesoreria».
- **Anti-rumore in tre regole**:
  1. una scadenza compare **solo dentro la sua finestra di anticipo**, mai prima;
  2. compare **solo a chi ne è responsabile** — gli altri la vedono nella vista
     «L'anno», non in «Oggi»;
  3. una scadenza non ripete se stessa: **cambia formulazione** man mano che si
     avvicina («fra 6 settimane» → «fra 10 giorni» → «scade domani»), occupando
     sempre una sola riga.
- **Spegnimento**: si dichiara fatta, con data. Le ricorrenze si chiudono per l'anno
  in corso e ricompaiono l'anno successivo, da sole.
- Il **rimando** sposta la riga a una data scelta: è un'operazione sul tempo, quindi
  coerente con tutto il resto della proposta.

### 6.7 Comportamento su mobile

È la proposta più adatta al telefono, perché una linea del tempo è verticale per
natura.

| Compito | Telefono |
|---|---|
| Vedere gli impegni di oggi e della settimana | **Sì, eccellente** |
| Accettare, riproporre o annullare una data | **Sì, primario** — motivo principale dell'installazione della PWA |
| Spuntare una scadenza come fatta | **Sì** |
| Leggere cosa è cambiato | **Sì** |
| Pubblicare una notizia datata, con foto | **Sì** |
| Modificare una pagina stabile | **Parziale** — si arriva, ma fuori dal flusso naturale |
| Vista «L'anno» a dodici mesi | **Parziale** — diventa un elenco di mesi, non una mappa |
| Tesoreria, form builder, permessi, import | **No** |

**Degrado**: la vista «L'anno» si trasforma in un elenco verticale di mesi
espandibili — la mappa panoramica si perde, ma resta l'informazione. Le schede fuori
dal tempo diventano un menu in fondo allo schermo, dichiaratamente secondario: da
telefono sono l'eccezione, non la regola.

### 6.8 Audit log

- **L'audit è la linea del tempo percorsa all'indietro.** Scorrendo sopra «Oggi» si
  entra nel passato, e il passato è fatto di cose accadute: «Il 12 marzo Donato ha
  cambiato il testo della pagina Chi siamo».
- Non c'è nessuna sezione «Audit» da aprire: **ci si passa attraverso** ogni volta
  che si guarda indietro. È la soluzione che meglio risolve il problema «una sezione
  che nessuno apre mai».
- I filtri («solo le mie azioni», «solo la tesoreria», «solo le pubblicazioni»)
  agiscono sulla stessa linea del tempo.
- Gli accessi all'ambito riservato compaiono nella linea del tempo **del direttore**
  come righe di servizio, senza contenuto.
- **Limite**: un audit di livello tecnico (chi ha cambiato un permesso, chi ha
  eseguito un'esportazione) è meno leggibile su una linea del tempo narrativa e
  richiede comunque un elenco tabellare in Impostazioni.

### 6.9 Punti deboli dichiarati

1. **Tutto ciò che non ha una data è un cittadino di seconda classe.** Le pagine
   stabili del sito, l'anagrafica, il piano dei conti, i modelli di modulo, le
   impostazioni: non hanno un «quando». Vivono nelle schede «fuori dal tempo», che
   per costruzione sono secondarie. Poiché la **Fase 1 è il CMS**, e il CMS è in
   larga parte fatto di pagine stabili, questa proposta è la **meno adatta al primo
   modulo** e diventa ottima solo quando arrivano appuntamenti, corsi e scadenze
   fiscali. È una debolezza di calendario di progetto, non solo di architettura.
2. **Il calendario è la superficie di fuga della riservatezza.** Anche con l'opaco
   come valore predefinito, chi guarda una stanza occupata ogni martedì alle 17 per
   otto settimane deduce molto. La mitigazione (niente elementi riservati nella
   vista «L'anno», niente esportazione) riduce il problema ma non lo elimina.
3. **Il lavoro non urgente scompare.** Una cosa da fare «prima o poi» non ha un
   posto naturale: o le si assegna una data arbitraria, e allora il tempo si riempie
   di date false, oppure sparisce.

---

## 7. Tabella comparativa

Punteggi da 1 (inadeguato) a 5 (ottimo).

| Criterio | A — Scrivania dei compiti | B — Aree di responsabilità | C — Registro degli oggetti | D — Anno associativo |
|---|---|---|---|---|
| **C1 · Rientro dopo sei mesi** | **5** — la risposta è già a schermo, in frasi compiute, con il «perché lo vedo» | **4** — il conteggio per area orienta subito, ma serve entrare per il dettaglio | **2** — richiede di ricordare il vocabolario, che è esattamente ciò che si è perso | **5** — «Oggi» più «in questo periodo si fa…» è il riambientamento più forte |
| **C2 · Primo apprendimento** | **4** — verbi e frasi, nessun modello da capire | **5** — «scegli in che veste lavori» è un concetto che tutti possiedono già | **2** — richiede di capire oggetti, filtri e viste prima di essere produttivi | **4** — il calendario è familiare, ma va capito dove stanno le cose senza data |
| **C3 · Riservatezza** | **4** — registri separati e soglia esplicita | **5** — separazione di ambiente: il permesso da solo non basta, serve essere nell'area | **3** — dipende dalla correttezza permanente della classificazione e dell'indice | **4** — l'opaco come valore predefinito è forte, ma il calendario resta la superficie più esposta |
| **C4 · Da 1 a 9 moduli** | **5** — il primo livello non cresce mai | **3** — il primo livello cresce da 2 a 6 aree, e il lavoro trasversale peggiora | **5** — la forma non cambia: cambiano i tipi nei filtri | **4** — primo livello stabile a 3 voci, ma le schede «fuori dal tempo» si affollano |
| **C5 · Ruoli multipli** | **4** — code sommate, firma dichiarata a ogni atto | **5** — il ruolo è il luogo: impossibile confondersi | **3** — il ruolo è invisibile, dedotto dal tipo di oggetto | **4** — nessuna scelta da fare, ma anche nessuna separazione percepita |
| **C6 · Mobile / PWA** | **4** — la coda è perfetta da telefono; l'editing lungo no | **4** — un'area per volta è naturale su schermo stretto | **4** — elenco più scheda si adatta bene; le viste no | **5** — la linea del tempo è verticale per natura |
| **C7 · Costo per un solo sviluppatore** | **2** — ogni modulo deve generare compiti con la regola giusta: è la più costosa | **4** — aree indipendenti, si costruiscono una per volta senza toccare le altre | **3** — costo iniziale alto (modello uniforme, ricerca, viste), poi ogni modulo costa poco | **3** — motore delle ricorrenze e tripla rappresentazione del calendario non sono banali |
| **C8 · Scadenze e stagionalità** | **4** — coda con rimando e archiviazione motivata | **4** — adempimenti d'area con finestra, chiusi con prova | **3** — le viste non bussano: serve il recapito attivo per email | **5** — è la struttura stessa della proposta |
| **Totale** | **32** | **34** | **25** | **34** |

I totali servono a leggere la forma dei profili, non a decidere: i criteri non hanno
lo stesso peso, e il peso è una decisione del committente (vedi domanda 1 al
capitolo 10).

---

## 8. Matrice di compatibilità fra UX e direzioni di UI

Le quattro direzioni di UI sono quelle tipiche che il documento `ui-proposals.md`
tratterà sul piano visivo. Qui si valuta solo se **reggono strutturalmente** la UX.

| | **UI-1** Navigazione laterale persistente | **UI-2** Navigazione superiore | **UI-3** Navigazione contestuale (nessun menu fisso) | **UI-4** Area di lavoro a pannelli |
|---|---|---|---|---|
| **A — Scrivania dei compiti** | ⚠️ **Tollerabile** — la colonna laterale ricrea un albero di sezioni e compete con la coda, che deve restare l'unico ingresso | ✅ **Buono** — barra sottile per cercare e cambiare filtro, tutto lo spazio alla coda | ✅ **Ottimo** — è l'accoppiamento naturale: si parte dal compito, la navigazione appare quando serve | ⚠️ **Tollerabile** — utile nell'editor, superfluo nella coda |
| **B — Aree di responsabilità** | ✅ **Ottimo** — una colonna per area, che cambia interamente al cambio di veste: la struttura è resa visibile | ✅ **Buono** — le aree come schede in alto, ma con più di 5 aree la barra si affolla | ❌ **Da evitare** — senza menu fisso si perde il senso di «dove sono», che è l'intera proposta | ⚠️ **Tollerabile** — pannelli dentro l'area sì, pannelli che attraversano le aree no: violerebbero la separazione |
| **C — Registro degli oggetti** | ✅ **Ottimo** — la colonna ospita le viste salvate, che sono il cuore della proposta | ⚠️ **Tollerabile** — la barra superiore non ha spazio per un elenco di viste in crescita | ⚠️ **Tollerabile** — la ricerca può fare da navigazione, ma le viste restano senza casa | ✅ **Ottimo** — elenco a sinistra, scheda a destra, anteprima a fianco: è la forma della proposta |
| **D — Anno associativo** | ⚠️ **Tollerabile** — la colonna serve solo alle schede «fuori dal tempo», e le rende più visibili di quanto la proposta voglia | ✅ **Ottimo** — barra con mese, «Oggi» e «L'anno»; tutto lo spazio alla linea del tempo | ✅ **Buono** — coerente con l'idea che si entri dal tempo, purché «L'anno» resti a un clic | ❌ **Da evitare** — i pannelli frammentano la linea del tempo, che ha bisogno di continuità verticale |

**Letture principali della matrice**

- **B + UI-1** è l'accoppiamento più solido: la navigazione laterale *è* la
  dichiarazione dell'area in cui ci si trova, e il cambio veste diventa un evento
  visibile.
- **D + UI-2** è il secondo più solido: barra sottile, corpo dedicato al tempo.
- **C + UI-4** è l'unico modo di rendere la Proposta C davvero produttiva, ma è anche
  la combinazione peggiore su telefono, dove i pannelli devono collassare.
- **A + UI-3** è la combinazione più coraggiosa e più rischiosa: massima chiarezza
  per chi ha un compito, massimo smarrimento per chi ha una domanda.
- Due combinazioni sono **da evitare**: B + UI-3 (perde il senso del luogo) e
  D + UI-4 (spezza la continuità del tempo).

---

## 9. Raccomandazione

> **Questa è una raccomandazione, non una decisione.** Vale quanto le ragioni che la
> sostengono, elencate qui sotto perché possano essere contestate.

**Raccomando la Proposta B — «Le aree di responsabilità», con due innesti presi
dalla Proposta D.**

**Perché B**

1. **Risolve nel modo più solido il problema più grave**, che è la riservatezza
   asimmetrica. Nelle proposte A, C e D la separazione è una regola applicata a dati
   che convivono; in B è una separazione di ambiente, in cui il permesso da solo non
   basta. Per un consultorio familiare, questo è il criterio che pesa più di tutti.
2. **Rende visibile il ruolo senza chiedere di capirlo.** «In quale veste vuoi
   lavorare?» è una domanda che un volontario di qualsiasi età comprende alla prima
   lettura, e chi possiede una sola veste non incontra nemmeno la domanda: per P1,
   P3 e P4 — cioè per la maggioranza — il sistema è semplicemente più piccolo.
3. **È la più realistica per un solo sviluppatore.** Le aree sono indipendenti: si
   costruisce Redazione in Fase 1, si aggiunge Segreteria dopo il gate, poi
   Tesoreria. Nessuna delle due precedenti va toccata. A, per contrasto, richiede
   che ogni modulo sappia generare compiti corretti per una coda unica — un
   accoppiamento che con una sola persona diventa fragile.
4. **Funziona bene con il CMS da solo.** In Fase 1 esistono due aree, una delle quali
   è quasi vuota: la navigazione ha senso subito, senza promettere moduli inesistenti.
   D, al contrario, dà il peggio di sé proprio sul primo modulo.

**I due innesti dalla Proposta D**, da adottare insieme a B:

- **«In questo periodo dell'anno di solito si fa…»** nella home di ogni area. È il
  singolo elemento che meglio risolve il rientro dopo sei mesi, e non richiede
  l'architettura temporale completa: basta una tabella di ricorrenze per area.
- **L'audit come storia leggibile all'indietro** dentro il registro di ogni area,
  scritto in frasi e non in righe tecniche.

**Perché non le altre**

- **A** è la più elegante e la più gentile con l'utente, ma è la più costosa da
  costruire bene e la più fragile se costruita male: una coda che sbaglia è peggio
  di nessuna coda. Con un solo sviluppatore e nove moduli, il rischio è alto. È la
  seconda scelta, e diventa la prima se il committente può accettare un ritmo di
  sviluppo più lento in cambio di un'esperienza migliore.
- **C** è la migliore per P2, il segretario quotidiano, e la peggiore per tutti gli
  altri. In un'organizzazione di volontari che entrano di rado, ottimizzare per
  l'utente esperto è la scelta sbagliata.
- **D** ha il miglior rientro e il miglior comportamento su telefono, ma la Fase 1 è
  il CMS, cioè proprio il contenuto senza data: si costruirebbe per un anno
  un'architettura che dà il meglio solo dopo. Resta la scelta giusta se la priorità
  dichiarata fosse il consultorio invece del sito.

---

## 10. Cosa serve dall'utente per decidere

Domande numerate, ognuna con l'impatto della risposta. Nessuna ha un valore
predefinito: **non si procede per assunzione.**

1. **Quale dei criteri C1–C8 conta di più, e quale conta di meno?**
   Basta ordinare i primi tre e l'ultimo. *Impatto*: ripesa la tabella del capitolo 7
   e può cambiare la raccomandazione. Se al primo posto c'è la riservatezza vince B;
   se c'è il rientro dopo mesi, B e D pareggiano; se c'è il costo di sviluppo, B resta
   prima ma con distacco minore.

2. **Le sei aree della Proposta B corrispondono a come il Centro si organizza
   davvero?** Le aree ipotizzate sono Redazione, Segreteria, Tesoreria, Formazione,
   Consulenza, Direzione. *Impatto*: se il Centro «fa tutti tutto», la Proposta B
   perde gran parte del suo vantaggio e sale la Proposta A.

3. **Quante persone avranno realmente più di una veste, e quali combinazioni?**
   Basta una stima: «due persone hanno tre vesti, le altre una». *Impatto*: se le
   vesti multiple sono l'eccezione, B è chiaramente la scelta; se sono la norma, il
   costo del cambio d'area diventa quotidiano e A guadagna terreno.

4. **Un volontario della redazione deve poter vedere l'esistenza degli appuntamenti
   del consultorio, anche solo come «stanza occupata»?** *Impatto*: determina se
   l'opaco è un livello necessario o se i colloqui devono essere invisibili del tutto
   fuori dall'area Consulenza. Cambia il modello dati, non solo la schermata.

5. **Chi è responsabile di dichiarare fatta una scadenza, e cosa succede se nessuno
   la dichiara?** Per esempio: le quote al 30 aprile. *Impatto*: definisce se serve
   un meccanismo di escalation verso la segreteria o il direttore, e con quale
   tempistica. Senza questa risposta i promemoria diventano rumore entro un anno.

6. **Quali compiti il committente si aspetta di svolgere dal telefono nel primo anno
   dopo il gate?** *Impatto*: stabilisce quanta parte dell'interfaccia va progettata
   due volte. Se la risposta è «solo consultare e confermare», il lavoro su mobile si
   riduce di molto e il criterio C6 perde peso.

7. **Il registro delle attività deve essere consultabile dal direttore in autonomia,
   o è sufficiente che esista e sia estraibile su richiesta?** *Impatto*: nel primo
   caso serve un'interfaccia di consultazione curata; nel secondo basta la storia in
   fondo a ogni oggetto. È una differenza di settimane di lavoro.

8. **Per quanto tempo vanno conservate le righe del registro che riguardano l'ambito
   riservato?** *Impatto*: è una questione di conformità, non di interfaccia.
   **Richiede validazione legale prima di qualunque implementazione**, e non può
   essere decisa qui né da chi scrive.

9. **Il committente vuole vedere prototipi navigabili prima di scegliere, o sceglie
   sui documenti?** *Impatto*: determina se serve una wave aggiuntiva prima della
   decisione. Un prototipo non funzionante di due proposte su quattro è realizzabile;
   di tutte e quattro, no.

---

*Documento prodotto nella wave `1B-W7`. Nessun codice, nessuno scaffold, nessuna
dipendenza è stata creata. Da leggere insieme a `ui-proposals.md`, che tratta la
direzione visiva e non ripete i contenuti di architettura qui descritti.*
