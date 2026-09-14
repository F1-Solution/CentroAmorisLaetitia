# ADR-007 — Autenticazione e sessioni

| | |
|---|---|
| **Stato** | **proposta** — in attesa di approvazione dell'utente |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | come si accede all'area amministrativa e come si mantiene la sessione |
| **Origine** | DR-033, RU-01, RU-02, RU-05 |

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

## 7. Reversibilità

**Alta.** Password e sessioni sono due tabelle e un middleware. Passare a una
libreria significa reimportare le persone e invalidare le sessioni: gli utenti
rifanno l'accesso una volta. Con due account è un'operazione di minuti.

## 8. Verifica

**Fase 1C:** i 12 controlli sono attuati e ciascuno ha un test.

**Fase 1F:** security review esplicita su questo modulo; nessun segreto nel
repository; la limitazione dei tentativi funziona davvero, provata; le sessioni si
revocano davvero; il conteggio delle righe della contromisura 3 del §6 è stato verificato.
