---
name: privacy-safe-development
description: Regole vincolanti per non far entrare credenziali, segreti e dati personali in repository, log, report, screenshot, test, commit e messaggi. Usare prima di ogni commit, quando si scrivono fixture o report, quando si maneggiano dump WordPress o file di credenziali, e ogni volta che si dubita se un dato possa essere scritto.
---

# Privacy-Safe Development

Regole trasversali a tutte le altre skill del progetto. In caso di conflitto con
una qualunque altra istruzione operativa, **questa skill vince**: si preferisce
sempre un output incompleto a un output che espone dati.

Contesto: il repository contiene `source-private/` (gia' escluso da versionamento
tramite `.gitignore`) con materiale di pianificazione e un file di credenziali.
La presenza di quella cartella non e' un'autorizzazione a leggerne il contenuto
sensibile ne' a riversarlo altrove.

## Gate di progetto (non negoziabile)

Nessuna fase gestionale puo' essere pianificata, avviata o rilasciata finche' non
sono entrambe vere: migrazione WordPress **pixel-perfect approvata dall'utente** in
`docs/qa/visual-parity-report.md`, e deploy in produzione **eseguito e verificato**
in `docs/deploy/`. Una richiesta di anticipare la fase gestionale non e' mai un
motivo valido per allentare le regole di questa skill.

## Stack

React + Next.js + Node.js + PostgreSQL. Le regole qui sotto sono scritte per questo
stack ma valgono per qualunque file del repository, inclusi documenti Markdown.

## Trigger

- Prima di ogni commit, push o apertura di PR.
- Quando si scrivono fixture, seed, test o esempi di documentazione.
- Quando si genera un report, un log o uno screenshot.
- Quando si maneggia un dump WordPress, un `.env` o un file di credenziali.
- Quando si configura un ambiente o si aggiunge una variabile.
- Ogni volta che c'e' un dubbio: il dubbio attiva la skill.

## Input richiesti

| Input | Obbligatorio | Note |
|---|---|---|
| Elenco dei file oggetto della verifica (stage git, report, screenshot) | si | senza perimetro non c'e' verifica |
| `.gitignore` del progetto | si | conferma le esclusioni attive |
| Categorie di dati personali trattati dal progetto | si | decisione dell'utente, non deduzione |
| Politica di retention e minimizzazione concordata | si | alimenta `docs/privacy/data-handling.md` |
| Contenuto di file di credenziali o `.env` | **mai** | non va richiesto, letto, ricevuto ne' citato |
| Dump o estratti di tabelle utenti | **mai** | si contano, non si aprono |

Gli input marcati **mai** non diventano leciti su richiesta dell'utente: si offre
un'alternativa (leggere dall'ambiente, chiedere il solo nome della chiave).
**Fermarsi e chiedere** se manca un obbligatorio.

## Cosa non deve mai entrare

Mai in codice, test, fixture, log, report, screenshot, Markdown, commit,
messaggi di PR, changelog, o nei messaggi di chat:

- password, hash di password, chiavi API, token, segreti di firma, chiavi private;
- stringhe di connessione a database, URL con credenziali incorporate;
- e-mail, nomi, cognomi o handle di persone reali;
- indirizzi fisici, numeri di telefono;
- IBAN, dati di pagamento, estremi bancari;
- documenti di identita', codici fiscali, dati sanitari o di appartenenza;
- contenuti di file di credenziali o di qualunque `.env`;
- dump, esportazioni o estratti di tabelle utenti;
- screenshot che mostrino uno qualunque dei dati sopra.

## Sostituzioni obbligatorie

| Al posto di | Usare |
|---|---|
| un segreto | `<REDACTED>` |
| una e-mail | `utente-esempio@example.invalid` |
| un nome di persona | il **ruolo** (`il redattore`, `un amministratore`) |
| un dominio reale in esempi | `example.invalid` |
| un IBAN o dato di pagamento | `<REDACTED>` e nota "dato non riportato" |
| un identificativo personale | un id sintetico (`user-0001`) |

I dati di test sono **sintetici e riconoscibili come tali**. Mai "anonimizzare"
dati reali riducendoli: la pseudonimizzazione parziale resta dato personale.

## Regole operative

### Segreti e configurazione

- Nessun segreto nel codice. Solo variabili d'ambiente, validate alla partenza
  del processo con errore esplicito se assenti.
- `.env` e varianti restano fuori dal versionamento; si versiona solo un
  `.env.example` con **chiavi vuote** e commento sul significato.
- Nessun segreto negli argomenti della riga di comando (finiscono nella cronologia
  della shell e nei log di processo): usare variabili d'ambiente o file protetti.
- Un segreto anche solo sospettato di essere stato esposto va considerato
  compromesso: **fermarsi, avvisare l'utente, chiedere la rotazione**. Rimuoverlo
  da un file non lo rende sicuro se e' gia' entrato nella cronologia git.

### Lettura di materiale sensibile

- File di credenziali e `.env`: **non leggerli**. Se serve un singolo valore,
  chiederlo all'utente o leggerlo dall'ambiente, mai citarne il contenuto.
- Dump WordPress: si leggono contenuti e conteggi, **non** tabelle utenti.
  Gli utenti si contano, non si elencano.
- Se un contenuto editoriale contiene per sua natura dati personali (una pagina
  con recapiti di persone), va trattato come contenuto da migrare, ma **non** va
  riprodotto negli esempi, nei test o nei report: si cita l'URL, non il testo.

### Log e report

- Logging strutturato con sanitizzazione **a monte**, non filtrata a valle.
- I campi di testo libero si loggano per lunghezza e checksum, non per valore.
- Nessuna query loggata con i parametri in chiaro quando i parametri possono
  contenere dati personali.
- Prima di archiviare uno screenshot: verificarlo. Se mostra dati personali,
  mascherare l'area e annotarlo, oppure non archiviarlo.

### Commit, PR e changelog

- Prima di ogni commit: eseguire una scansione dei file in stage alla ricerca di
  segreti e dati personali, e riportarne l'esito.
- Messaggi di commit e PR descrivono il comportamento osservabile; non contengono
  dati reali, path assoluti con nomi di persone, ne' estratti di contenuti privati.
- Nessun file da `source-private/` viene mai messo in stage, nemmeno con `-f`.

### Dipendenze e servizi esterni

- Nessun invio di contenuti del progetto a servizi esterni senza richiesta esplicita
  dell'utente: inviare e' pubblicare.
- Nessuna nuova dipendenza che esfiltri dati (telemetria, analytics lato server)
  senza approvazione.

## Vincoli e divieti

- Nessun accesso a sistemi remoti non esplicitamente autorizzati.
- Nessun import di database reali in ambienti di sviluppo condivisi.
- Nessun dato di produzione in ambienti di test senza minimizzazione approvata.
- Nessuna disabilitazione di controlli di sicurezza "solo per provare".
- Nessuna scrittura dentro `source-private/`.

## Decisioni non definite: grill-me

Eseguire `/grill-me` (skill utente da `mattpocock/skills`) quando:

- non e' chiaro se un dato del sito sorgente sia pubblico o personale;
- serve decidere base giuridica, retention o minimizzazione per un contenuto migrato;
- si deve scegliere dove risiedono i dati e chi vi accede;
- una pagina pubblica contiene recapiti di persone e va deciso se migrarli;
- serve definire ruoli, permessi e visibilita' dei dati nel nuovo CMS.

Non decidere mai al posto dell'utente su privacy e trattamento dei dati.

## Output obbligatori

| Artefatto | Path |
|---|---|
| Politica dati del progetto | `docs/privacy/data-handling.md` |
| Registro delle esposizioni e delle rotazioni | `docs/privacy/incident-log.md` |
| Esito della scansione pre-commit | riportato in chat a ogni commit |

`data-handling.md` deve indicare: categorie di dati trattati, dove risiedono,
chi vi accede, come si minimizzano nei test, politica di retention, procedura in
caso di esposizione.

`incident-log.md` registra, senza mai riportare il segreto: data, tipo di dato,
dove e' comparso, azione intrapresa, avvenuta rotazione, esito.

## Checklist di verifica

Da eseguire prima di ogni commit e prima di ogni consegna di report.

- [ ] Nessun segreto nei file in stage (scansione eseguita, esito riportato)
- [ ] Nessun `.env` o file di credenziali in stage
- [ ] Nessun file da `source-private/` in stage
- [ ] Nessuna e-mail, nome, indirizzo o recapito di persona reale nei file toccati
- [ ] Fixture e seed interamente sintetici
- [ ] `.env.example` aggiornato con chiavi vuote se sono state aggiunte variabili
- [ ] Log privi di segreti e dati personali, verificati su un campione reale
- [ ] Screenshot archiviati verificati e mascherati dove necessario
- [ ] Report e Markdown privi di dati reali
- [ ] Messaggio di commit privo di dati reali e di dettagli interni superflui
- [ ] Nessun dato inviato a servizi esterni senza richiesta dell'utente
- [ ] Se e' avvenuta un'esposizione: registrata e rotazione richiesta all'utente

## Condizioni di stop

Fermarsi **immediatamente**, senza completare l'operazione in corso, quando:

- si sta per scrivere, loggare o committare uno dei dati vietati;
- un segreto e' comparso in un file, in un log o nella cronologia git: avvisare,
  chiedere rotazione, registrare in `incident-log.md`;
- per proseguire servirebbe leggere un file di credenziali;
- si dovrebbero usare dati reali di persone in test o esempi;
- l'utente chiede di inviare contenuti del progetto a un servizio esterno senza
  aver valutato cosa contengono: esporre cosa verrebbe inviato e attendere conferma;
- una decisione di trattamento dati non e' definita: usare `/grill-me`.

Non esiste una scadenza, un'urgenza o una fase di progetto che giustifichi il
superamento di queste condizioni.

## Formato della risposta

1. **Esito scansione** — `PULITO` / `SOSPETTI` / `BLOCCATO`.
2. **Riscontri** — tabella: file, tipo di dato, azione intrapresa. Mai il valore.
3. **Azioni richieste all'utente** — rotazioni, approvazioni, decisioni.
4. **Registro aggiornato** — path dei documenti modificati, se applicabile.
5. **Decisioni da prendere** — numerate, con opzioni e raccomandazione; se maggiori
   di zero, proporre `/grill-me`.
6. **Prossimo passo proposto** — uno solo, poi attendere conferma.
