# ADR-007 — Autenticazione e sessioni

| | |
|---|---|
| **Stato** | **approvata** il 2026-09-14 con DR-038 (approvazione in blocco) |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | come si accede all'area amministrativa e come si mantiene la sessione |
| **Origine** | DR-033, RU-01, RU-02, RU-05 |

## Revisioni

| Data | Che cosa è cambiato |
|---|---|
| 2026-09-14 | Prima stesura, approvata in blocco con DR-038. |
| 2026-09-20 | **Due correzioni dichiarate, entrambe da decisioni registrate.** §6 contromisura 3: la soglia delle 300 righe è stata misurata e superata, e **DR-066** la risolve con una **deroga motivata** invece che con l'adozione di Better Auth. §3.2: la scelta fra «un ruolo attivo per volta» e «unione dei permessi», che questa ADR dichiarava di non decidere, è stata decisa da DR-050 e attuata per intero da **DR-067**. Nessuna delle due tocca i 12 controlli del §3.1, che restano invariati. |

---

## 1. Contesto

DR-033 impone che il **primo rilascio** abbia un backend minimale con cui creare e
modificare pagine. Serve quindi un accesso protetto già in produzione, alla fine
della Fase 1F.

Che cosa serve **adesso** e che cosa servirà **dopo il gate**:

| | Fase 1 | Dopo il gate |
|---|---|---|
| Utenti | 1–3 redattori | dieci ruoli distinti, RU-01 |
| Ruoli per persona | uno | **più ruoli sulla stessa persona**, RU-02 |
| Registrazione pubblica | **no** (`users_can_register = 0` nella sorgente) | valutabile |
| Accesso con provider esterni | no | no, salvo decisione |
| Secondo fattore | no | probabile |
| Audit di chi fa cosa | **sì, obbligatorio** dal primo giorno, RU-05 | sì |
| Client | browser | browser più PWA installata, DR-030 |

Vincolo che restringe: l'API è un servizio separato (ADR-001) e i client saranno
due applicazioni Next distinte (ADR-008). La soluzione di autenticazione deve
servire **entrambe** senza essere incastrata dentro il framework di frontend.

Vincolo che pesa in senso opposto: la regola generale del progetto è preferire
librerie collaudate a soluzioni scritte in casa, soprattutto su temi di sicurezza.

## 2. Opzioni

### Opzione A — Auth.js (già NextAuth) v5

- **A favore:** maturo, molto diffuso, decine di provider pronti.
- **Contro:** è pensato per vivere **dentro** Next.js. Con un'API separata e due
  applicazioni Next, la sessione va condivisa con lavoro di cablaggio che non è
  banale e che è proprio il punto in cui si introducono errori. La maggior parte
  delle sue funzionalità — provider esterni, OAuth — a questo progetto non serve.

### Opzione B — Better Auth

- **A favore:** indipendente dal framework, quindi adatto a un'API separata; copre
  di serie ciò che servirà dopo il gate: più ruoli, secondo fattore, inviti,
  passkey; schema su PostgreSQL.
- **Contro:** progetto giovane; la superficie è ampia rispetto a quanto serve in
  Fase 1; l'evoluzione di un progetto giovane si segue, e un manutentore solo ha
  poco tempo per seguirla.

### Opzione C — Sessioni opache proprie

Password con Argon2id da libreria; token di sessione casuale in cookie
`HttpOnly`; sessioni in tabella PostgreSQL.

- **A favore:** superficie minima, tutto esplicito e verificabile, nessuna
  dipendenza da seguire, funziona identico per le due applicazioni Next e per
  l'API. La revoca è immediata perché la sessione è un record, non un token
  firmato. Si integra naturalmente con l'audit log di RU-05.
- **Contro:** i dettagli vanno fatti bene e sono noti ma numerosi — CSRF,
  fissazione di sessione, limitazione dei tentativi, scadenze, rotazione,
  confronti a tempo costante. È scrivere codice di sicurezza, e lo si fa solo se il
  perimetro resta piccolo.

## 3. Scelta proposta

**Opzione C per la Fase 1**, con perimetro dichiarato e con un **punto di riesame
obbligatorio** prima della fase gestionale.

La scelta regge perché il perimetro della Fase 1 è davvero piccolo: nessuna
registrazione pubblica, nessun provider esterno, nessun secondo fattore, uno o due
account creati a mano. Non c'è quasi nulla di ciò che rende difficile
l'autenticazione.

### 3.1 Controlli obbligatori — nessuno è facoltativo

| # | Controllo | Attuazione |
|---|---|---|
| 1 | Password | Argon2id da libreria collaudata, parametri dichiarati in configurazione |
| 2 | Token di sessione | 256 bit da generatore crittografico; a database si conserva il suo **digest**, mai il token in chiaro |
| 3 | Cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, senza dominio esteso |
| 4 | Scadenza | inattività 12 ore, assoluta 30 giorni, entrambe applicate lato server |
| 5 | Rotazione | nuovo token a ogni accesso e a ogni cambio di password |
| 6 | Revoca | invalidazione immediata di una sessione o di tutte le sessioni di una persona |
| 7 | CSRF | token a doppio invio su ogni richiesta che modifica dati; il solo `SameSite` non basta |
| 8 | Limitazione dei tentativi | per indirizzo IP **e** per account, con ritardo progressivo |
| 9 | Enumerazione degli account | messaggio di errore identico per utente inesistente e password errata; tempo di risposta uniforme |
| 10 | Audit | accesso riuscito, accesso fallito, disconnessione, cambio password, revoca: tutti registrati |
| 11 | Recupero password | **fuori perimetro in Fase 1.** Con due account, la reimpostazione è manuale. Un canale di recupero è superficie d'attacco che non serve ancora |
| 12 | Segreti | solo da variabili d'ambiente, verificate all'avvio; nessun valore predefinito nel codice |

### 3.2 Modello dei ruoli, predisposto ma non costruito

RU-02 richiede più ruoli sulla stessa persona. In Fase 1 esiste un solo ruolo,
`editor`, ma **lo schema prevede già la relazione molti-a-molti** fra persona e
ruolo: aggiungerla dopo costerebbe una migrazione su dati reali, prevederla ora non
costa nulla.

Le autorizzazioni si esprimono come **permessi**, non come confronti sul nome del
ruolo. In Fase 1 i permessi sono pochi — `content.read`, `content.write`,
`content.publish`, `media.write`, `settings.write` — ma il meccanismo è quello
definitivo.

La scelta fra «un ruolo attivo per volta» e «unione dei permessi di tutti i ruoli»
**non si decide qui**: è una domanda posta all'utente dalle proposte di UX ed è la
più costosa da cambiare dopo. Fino alla risposta lo schema resta compatibile con
entrambe.

> **Decisa il 2026-09-20 — correzione dichiarata.** La risposta è **un solo ruolo
> attivo per volta** (DR-050, che supera DR-047), attuata per intero da **DR-067**:
> la sessione porta il ruolo attivo, i permessi in vigore sono quelli di quel ruolo,
> il servizio rifiuta dati di un'altra area anche quando il permesso ci sarebbe, e
> il registro delle operazioni attribuisce l'azione al ruolo.
> **Lo schema non cambia**: la relazione molti-a-molti fra persona e ruolo era già
> prevista proprio per questo, e resta compatibile con entrambe le letture. Cambia
> che cosa la sessione porta con sé.

### 3.3 Riesame obbligatorio

Prima della prima fase gestionale, questa ADR va riaperta. Quando arriveranno
secondo fattore, inviti, dieci ruoli e utenti che non sono redattori ma persone
assistite dal Centro, il calcolo cambia e Better Auth diventa probabilmente la
risposta giusta. **Scegliere C oggi non è scegliere C per sempre**, ed è registrato
così perché nessuno debba ricostruirlo a memoria fra un anno.

## 4. Alternativa scartata e motivo

**Auth.js** è scartato perché il suo punto di forza — l'integrazione stretta con
Next.js — qui è un ostacolo: l'architettura ha un'API separata e due applicazioni
Next, e la sessione dovrebbe essere condivisa con cablaggio scritto a mano.

**Better Auth** è scartato **solo per la Fase 1** e per una ragione di
proporzione: introdurrebbe ora una dipendenza ampia e giovane per coprire due
account e un ruolo. Resta l'opzione di riferimento del riesame del §3.3, ed è
registrata come tale, non accantonata.

## 5. Conseguenze

**Più facile:** revocare una sessione all'istante, perché è un record e non un token
firmato; collegare ogni operazione a chi l'ha compiuta, che è ciò che RU-05 chiede;
usare la stessa sessione dalle due applicazioni Next e dall'API, perché l'origine è
una sola (ADR-008 §3.2); leggere e verificare tutto il percorso di autenticazione,
che sta in poche decine di righe.

**Più difficile:** ogni funzione nuova — recupero password, inviti, secondo fattore,
accesso con provider esterni — va scritta invece che configurata. È accettabile
finché il perimetro resta quello del §3.2; smette di esserlo quando arriva la fase
gestionale, ed è la ragione del riesame del §3.3.

**Nuove dipendenze:** una libreria per Argon2id. Nient'altro.

## 6. Rischio dichiarato

Questa è la sola ADR che sceglie di **scrivere codice di sicurezza** invece di
adottarne. Il rischio esiste e non lo si minimizza: un errore qui non si vede finché
non lo sfrutta qualcuno.

Tre contromisure, tutte vincolanti:

1. I 12 controlli del §3.1 sono una **lista di verifica**, non una descrizione: la
   Fase 1F non si chiude senza averli spuntati uno per uno.
2. La security review della Fase 1F **deve** coprire questo modulo in modo esplicito.
3. Se durante la Fase 1C la soluzione propria superasse le 300 righe di logica di
   autenticazione, la premessa della proporzione è caduta e si adotta Better Auth
   senza discutere.

> **La contromisura 3 è scattata, ed è stata derogata. Correzione dichiarata del
> 2026-09-20, decisione DR-066.**
>
> **La misura.** Il conteggio è stato fatto nella wave `1D-W6` con una regola scritta
> **prima** di vedere il numero e non modificata dopo — `apps/api/tools/countAuthLines.ts`,
> esito in `apps/api/tests/auth-line-count.json`, un test che fallisce se il numero
> cambia senza dichiararlo. Righe eseguibili, senza vuote, commenti e import. Due
> insiemi, perché «logica di autenticazione» ammette due letture oneste e tenerne una
> sola sarebbe stato il modo più facile di far tornare il conto:
> **nucleo 342**, **totale 684**, soglia **300**. Superata in entrambe le letture.
>
> **La deroga.** L'utente ha scelto di **restare sulle sessioni proprie per la Fase 1**.
> Il motivo per cui la premessa della proporzione regge lo stesso: le 342 righe del
> nucleo non sono 342 righe di *autenticazione*. Limitazione dei tentativi, audit,
> anti-CSRF e uniformità dei tempi di risposta — i controlli 7, 8, 9 e 10 del §3.1 —
> pesano per la maggior parte del conto, e **nessuno dei quattro sparirebbe** adottando
> Better Auth: andrebbero comunque scritti, cablati e provati. Ciò che la libreria
> sostituirebbe davvero — password, token, cookie, scadenze, rotazione, revoca — è la
> parte piccola. La soglia delle 300 righe era una regola posta prima di sapere come si
> sarebbe distribuito il codice, e il codice si è distribuito diversamente da come la
> regola supponeva.
>
> **Che cosa la deroga non tocca.**
> - Il **riesame obbligatorio del §3.3 resta vincolante** prima della prima fase
>   gestionale, e Better Auth resta la sua opzione di riferimento.
> - La **verifica del §8 per la Fase 1F resta invariata**: la security review deve
>   coprire questo modulo in modo esplicito.
> - La **misura non si rifà** per far tornare il numero, e la regola di conteggio non
>   si cambia. Se il nucleo cresce ancora, la cosa si ripresenta all'utente.
> - I **12 controlli del §3.1 restano una lista di verifica**: 11 hanno un test che
>   passa, il 12º — recupero password — è dichiarato fuori perimetro dal §3.1 stesso.

## 7. Reversibilità

**Alta.** Password e sessioni sono due tabelle e un middleware. Passare a una
libreria significa reimportare le persone e invalidare le sessioni: gli utenti
rifanno l'accesso una volta. Con due account è un'operazione di minuti.

## 8. Verifica

**Fase 1C:** i 12 controlli sono attuati e ciascuno ha un test.

**Fase 1F:** security review esplicita su questo modulo; nessun segreto nel
repository; la limitazione dei tentativi funziona davvero, provata; le sessioni si
revocano davvero; il conteggio delle righe della contromisura 3 del §6 è stato verificato.
