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
| 2026-11-09 | **Esito della verifica della Fase 1F** (wave `1F-W4`, §8). Security review in `docs/deploy/security-review-1F.md`: i 12 controlli del §3.1 spuntati uno per uno, limitazione dei tentativi e revoca provate attraverso Caddy sullo stack d'immagini, conteggio delle righe rifatto con regola invariata, nessun segreto nel repository, nella cronologia o nelle immagini. |
| 2026-11-09 | **Tentativi serializzati per account, revisione dichiarata da DR-400** (wave `1F-W4`, rilievo N1 del riesame). Il rischio residuo del controllo 8 — conteggio letto prima e fallimento scritto dopo, superabile con richieste parallele — è chiuso da una coda in memoria per account su accesso, password attuale e codice del secondo fattore, con un tetto per sessione su ciascuna rotta del codice e della conferma. Vincolo nuovo: **un solo processo API** finché vale questa coda. Righe rimisurate con regola invariata: **nucleo 789** su 800 (DR-395), **totale 1989**. |
| 2026-11-08 | **Secondo fattore, sessioni più corte e due deroghe alla soglia, revisione dichiarata da DR-384, DR-388, DR-391, DR-395…DR-399** (wave `1F-W4`). TOTP per tutti gli account dell'area; controlli 3 e 4 aggiornati (cookie di sessione, 14 giorni e 8 ore); conferma recente per `users.manage`. Soglia del §6 contromisura 3 portata a 650 (DR-388) e poi a 800 (DR-395) per il solo nucleo; regola di conteggio invariata. |
| 2026-10-27 | **Nome ed email di un account modificabili, revisione dichiarata da DR-282** (wave `1G-W7`). DR-282 approva che da «Persone e permessi» chi ha `users.manage` cambi nome ed email; l'indirizzo resta unico senza distinzione di maiuscole e cambiarlo **chiude tutte le sessioni** della persona (controllo 6). La propria email si può cambiare e si chiude anche la sessione in uso. **DR-288 (D184 = C), decisa dall'utente:** sul **proprio** account ogni modifica — nome, email, ruoli, stato — e la reimpostazione della propria password chiedono la **password attuale**; assente 400 `CURRENT_PASSWORD_REQUIRED`, errata 403 `INVALID_CREDENTIALS` con lo stesso conteggio dei tentativi e lo stesso registro del fallimento di `/auth/password` (controlli 8 e 10), nessuna scrittura in caso di rifiuto; per gli account altrui nulla cambia. Il registro porta i nomi dei campi cambiati, mai i valori né la password. I 12 controlli del §3.1 restano invariati nella sostanza; controllo 8 e §5 aggiornati. Righe rimisurate: **nucleo 469** su 500 invariato, **totale 1407** (1335 con la sola DR-282), deroga di DR-066 invariata per il totale. |
| 2026-10-20 | **Gestione minima degli account, revisione dichiarata da DR-224** (wave `1G-W1`). L'area Impostazioni ha «Persone e permessi» (DR-219): elenco, creazione, disattivazione, riattivazione, ruoli, reimpostazione della password. Nuovo ruolo `amministrazione` con i permessi `users.manage`, `audit.read` e `site.settings.write` (DR-220, DR-227). La password temporanea è generata dal sistema, mostrata una sola volta, e impone il cambio al primo accesso (DR-228). Il controllo 11 esclude ancora il recupero in autonomia: la reimpostazione da parte dell'amministrazione **è** la reimpostazione manuale che ammette. I 12 controlli del §3.1 restano invariati; §3.2 e §5 aggiornati. Righe rimisurate: **nucleo 469** su 500, **totale 1298**, deroga di DR-066 invariata per il totale. |
| 2026-09-21 | **La soglia del §6 contromisura 3 passa da 300 a 500 righe**, decisione **DR-070**, che supera DR-066 sul punto della soglia e non sulla deroga. Con la soglia nuova il **nucleo la rispetta** (437) e il **totale la supera ancora** (859): la deroga di DR-066 resta in vigore per la lettura del totale. La regola di conteggio non cambia. |
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

> **Revisione del 2026-11-08 (wave `1F-W4`).** Il secondo fattore è entrato in Fase 1: TOTP
> nell'area amministrativa per tutti gli account (DR-384), con `node:crypto` e senza dipendenze
> nuove; reimpostazione solo da riga di comando sul server (DR-397); conferma con password o
> codice entro 10 minuti per ogni rotta di gestione degli account (DR-391, DR-396).

### 3.1 Controlli obbligatori — nessuno è facoltativo

| # | Controllo | Attuazione |
|---|---|---|
| 1 | Password | Argon2id da libreria collaudata, parametri dichiarati in configurazione |
| 2 | Token di sessione | 256 bit da generatore crittografico; a database si conserva il suo **digest**, mai il token in chiaro |
| 3 | Cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, senza dominio esteso; cookie di sessione, senza `Max-Age` né `Expires` (DR-391) |
| 4 | Scadenza | inattività **8 ore**, assoluta **14 giorni**, entrambe applicate lato server; in produzione valori più alti non partono (DR-391; fino al 2026-11-08 erano 12 ore e 30 giorni) |
| 5 | Rotazione | nuovo token a ogni accesso e a ogni cambio di password |
| 6 | Revoca | invalidazione immediata di una sessione o di tutte le sessioni di una persona |
| 7 | CSRF | token a doppio invio su ogni richiesta che modifica dati; il solo `SameSite` non basta |
| 8 | Limitazione dei tentativi | per indirizzo IP **e** per account, con ritardo progressivo; un solo conteggio per ogni verifica della password attuale — cambio password e modifiche al proprio account (DR-288). «Valuta → verifica → registra» gira in una **coda in memoria per account** in ogni punto che conta i tentativi — accesso, password attuale, codice del secondo fattore — così una raffica parallela non supera il tetto (DR-400); attivazione, verifica del codice e conferma hanno in più un tetto di 10 richieste al minuto per sessione su ciascuna delle tre rotte. **Vincolo:** la coda vale per **un solo processo API**, come in Fase 1; con più repliche la corsa si riapre e DR-400 va ripresa (per esempio con `pg_advisory_xact_lock` sul digest) |
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

> **Aggiornata il 2026-10-20 — DR-224.** I ruoli non sono più il solo `editor`. Ci
> sono `editor`, rietichettato «Redazione» (DR-229), e `amministrazione` (DR-220).
> I permessi diventano otto: ai cinque sopra si aggiungono `users.manage`,
> `audit.read` e `site.settings.write` (DR-227). `settings.write` resta per SEO e
> redirect, nell'area Redazione; i tre nuovi portano solo all'area Impostazioni.
> L'amministrazione assegna soltanto questi due ruoli, e gli altri ruoli di una
> persona non li tocca. Il meccanismo non cambia: permessi come dati, un ruolo
> attivo per volta.

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

> **Aggiornata il 2026-10-20 — DR-224.** Gli account si gestiscono dall'area
> Impostazioni, non più solo da riga di comando su database locale. Ne seguono
> tre obblighi, attuati e provati: non si resta mai senza un'amministrazione
> attiva; finché il cambio della password è in sospeso, ogni rotta autenticata è
> rifiutata tranne `/auth/me`, `/auth/password` e `/auth/logout`; disattivazione,
> ruolo tolto e reimpostazione chiudono subito le sessioni della persona. Il
> primo account con `amministrazione` di un database nuovo si crea dopo la
> migrazione `0008`, con la procedura di `docs/handoff/HO-030-migrazione-0008-1G-W1.md`.

> **Aggiornata il 2026-10-27 — DR-282.** Anche nome ed email si cambiano da
> «Persone e permessi», e **cambiare l'email chiude subito tutte le sessioni**
> della persona, come la reimpostazione. Condizione vincolante: quando arriveranno
> il recupero della password via email o gli inviti, cambiare l'email richiederà
> di **autenticarsi di nuovo** e di **avvisare il vecchio indirizzo**, perché
> l'indirizzo diventerà un canale di accesso e non più solo un identificativo.
>
> **Aggiornata il 2026-10-27 — DR-288.** Sul **proprio** account ogni modifica
> da «Persone e permessi» — nome, email, ruoli, stato — e la reimpostazione
> della propria password chiedono la **password attuale**, verificata con lo
> stesso conteggio dei tentativi e lo stesso registro del fallimento di
> `/auth/password`. Una sessione rubata non basta quindi a cambiare indirizzo,
> ruoli o password della persona. Gli account altrui restano governati dal solo
> permesso `users.manage`. `/auth/context`, `/auth/logout` e
> `/auth/sessions/revoke-all` agiscono sulla sessione, non sull'account, e non
> la chiedono. **Rischio residuo:** DR-288 protegge solo l'account della
> sessione; con una sessione rubata di un'amministrazione si possono ancora
> creare account, anche di amministrazione, e cambiare l'email o reimpostare la
> password di altri.

## 6. Rischio dichiarato

Questa è la sola ADR che sceglie di **scrivere codice di sicurezza** invece di
adottarne. Il rischio esiste e non lo si minimizza: un errore qui non si vede finché
non lo sfrutta qualcuno.

Tre contromisure, tutte vincolanti:

1. I 12 controlli del §3.1 sono una **lista di verifica**, non una descrizione: la
   Fase 1F non si chiude senza averli spuntati uno per uno.
2. La security review della Fase 1F **deve** coprire questo modulo in modo esplicito.
3. Se durante la Fase 1C la soluzione propria superasse le **500** righe di logica
   di autenticazione, la premessa della proporzione è caduta e si adotta Better Auth
   senza discutere. *La soglia era 300; è stata portata a 500 il 2026-09-21 da
   DR-070, e il perché è scritto nel riquadro qui sotto.*

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

> **La soglia è stata alzata a 500. Revisione dichiarata del 2026-09-21,
> decisione DR-070.**
>
> **Che cosa è successo prima.** La deroga qui sopra dichiarava che «se il nucleo
> cresce ancora, la cosa si ripresenta all'utente». È cresciuto: la wave `1D-W8a`,
> attuando DR-067, ha portato il nucleo da **342** a **437** righe e il totale da
> **684** a **859**. La questione è stata ripresentata, e l'utente ha risposto
> portando la soglia a **500**.
>
> **Che cosa cambia.** Con 500, il **nucleo rispetta la soglia** (437) e il
> **totale la supera** (859). La contromisura 3 non scatta più sulla lettura del
> nucleo; sulla lettura del totale continua a scattare, ed è per questo che la
> deroga di DR-066 **non è revocata**: resta la ragione per cui il progetto non
> adotta Better Auth in Fase 1.
>
> **Che cosa non cambia, e va detto.** Alzare una soglia dopo aver visto il numero
> è l'operazione che la regola di conteggio serviva a rendere visibile, e resta
> visibile: la regola di conteggio **non è stata toccata**, la misura **non è
> stata rifatta**, e la dichiarazione in `apps/api/tests/auth-line-count.json`
> porta ora la soglia precedente, la data del cambio e l'esito **separato per
> ciascuna delle due letture**, così che la differenza non sparisca dentro un
> esito solo. Il riesame obbligatorio del §3.3 prima della fase gestionale e la
> copertura esplicita nella security review della Fase 1F restano vincolanti e
> invariati.

> **Terza e quarta deroga: soglia del nucleo a 650 e poi a 800. Revisioni dichiarate del
> 2026-11-08, decisioni DR-388 e DR-395.**
>
> La security review della `1F-W4` ha chiesto il secondo fattore (DR-384) e altre correzioni
> al nucleo. Con il nucleo a 544 righe la soglia è salita a 650 (DR-388); con il TOTP il nucleo
> è arrivato a 772 e la soglia è salita a 800 (DR-395). Dopo la coda per account di DR-400 il
> nucleo è **789** su 800 e il totale **1989**. La regola di conteggio non è cambiata e la
> misura non è stata rifatta per far tornare il numero. È la quarta deroga alla stessa
> contromisura: la soglia protegge meno, e il **riesame del §3.3 con Better Auth prima della
> fase gestionale** resta il presidio, vincolante e invariato.

## 7. Reversibilità

**Alta.** Password e sessioni sono due tabelle e un middleware. Passare a una
libreria significa reimportare le persone e invalidare le sessioni: gli utenti
rifanno l'accesso una volta. Con due account è un'operazione di minuti.

## 8. Verifica

**Fase 1C:** i 12 controlli sono attuati e ciascuno ha un test.

**Fase 1F:** security review esplicita su questo modulo; nessun segreto nel
repository; la limitazione dei tentativi funziona davvero, provata; le sessioni si
revocano davvero; il conteggio delle righe della contromisura 3 del §6 è stato verificato.

**Esito della Fase 1F (2026-11-09, wave `1F-W4`).** Rapporto in
`docs/deploy/security-review-1F.md`, scritto da un revisore agente a contesto nuovo: non è un
audit umano indipendente né un penetration test (DR-383).

- I 12 controlli del §3.1 spuntati uno per uno: 11 con un test che passa, il 12º (recupero
  password) fuori perimetro come dichiarato.
- Limitazione dei tentativi provata attraverso Caddy sullo stack d'immagini: tetto per account,
  tetto per indirizzo, `X-Forwarded-For` falsificato che non sposta il conteggio, raffiche
  parallele che non superano il tetto (DR-400).
- Revoca provata: una sessione, tutte le sessioni di una persona, rotazione dopo accesso e cambio
  password, sessioni chiuse dopo un ripristino.
- Conteggio delle righe verificato con la regola invariata: nucleo 789 su 800, totale 1989.
- Nessun segreto nel repository, nella sua cronologia o nelle immagini: gitleaks con triage
  motivato dei soli file generati dalla build di Next.
- Nessun rilievo critico o alto aperto; rischi accettati e rinvii alla `1F-W5` nel rapporto.
