---
name: grill-me
description: Blocca l'implementazione e mette all'utente le decisioni non ancora approvate, in round di massimo 5 domande numerate con opzioni, raccomandazione e impatto. Usare a ogni ambiguita', requisito mancante, alternativa tecnica, conflitto tra documenti, e obbligatoriamente prima di deploy, DNS, e-mail, pagamenti, import reali, migrazioni di produzione, cancellazioni o modifiche a dati reali.
---

# Grill Me

Questa skill esiste per impedire che io decida da solo. Nessuna scelta non gia'
esplicitamente approvata nel progetto puo' essere risolta con un'assunzione,
un default o "la scelta piu' sensata". Si chiede, si attende, si registra.

Sostituisce localmente la `grill-me` globale (`mattpocock/skills`): stessa
intenzione, ma invocabile anche da me e con formato di uscita vincolato.

## Regola fondamentale

> I **fatti** si cercano nell'ambiente. Le **decisioni** si chiedono all'utente.

Prima di formulare una domanda devo aver cercato la risposta in: `ROADMAP.md`,
`CLAUDE.md`, `PROGRESS.md`, `docs/`, il decision register, il codice, la
cronologia git. Una domanda la cui risposta e' gia' scritta da qualche parte e'
un errore, non prudenza.

## Trigger

Attivare **sempre** quando si presenta uno di questi casi:

- **Ambiguita'** — la richiesta ammette piu' letture che portano a lavori diversi.
- **Requisito mancante** — serve un input che nessun documento fornisce.
- **Alternative tecniche** — piu' approcci con conseguenze diverse su tempi, costi,
  rischi, privacy o manutenzione.
- **Conflitto documentale** — due documenti di progetto dicono cose incompatibili.
- **Azione a impatto elevato** — vedi la lista di conferma obbligatoria sotto.

E **mai** per: nomi di variabili, formattazione, struttura di cartelle gia'
convenzionata, scelte di stile coperte da `CLAUDE.md` o dalle regole del repo,
dettagli implementativi reversibili in un minuto. Per quelli decido e vado avanti,
segnalando la scelta in una riga.

## Conferma obbligatoria (nessuna eccezione)

Per queste azioni la skill si attiva **sempre**, anche se sembrano gia' implicite
nella richiesta, e l'esecuzione resta bloccata fino a conferma esplicita e puntuale:

- deploy verso qualunque ambiente;
- modifiche a DNS, dominio, certificati;
- configurazione o invio di e-mail;
- qualunque cosa tocchi pagamenti o dati di pagamento;
- import reali (non dry-run);
- migrazioni su database di produzione;
- cancellazioni di dati, file, branch, risorse;
- modifiche a dati reali di qualunque ambiente.

Una conferma vale per **quella** azione, in quel momento. Non si eredita, non si
estende, non si presume da un "vai pure" precedente.

## Blocco dell'implementazione

Aperto un round di domande:

1. **Fermo ogni modifica** a codice, dati, configurazione e infrastruttura.
2. Posso continuare solo attivita' di **sola lettura** che servono a rispondere
   alle domande stesse (leggere file, contare, verificare).
3. Non anticipo lavoro "tanto poi serve comunque".
4. Riprendo **solo** dopo la risposta dell'utente, e solo sulle decisioni chiuse.

Se l'utente risponde ad alcune domande e non ad altre: procedo su quelle chiuse,
lascio aperte le altre e lo dico esplicitamente.

## Formato delle domande

Massimo **5 domande per round**. Numerate progressivamente e in modo stabile
(`D1`, `D2`, ...): lo stesso numero identifica la stessa decisione anche nei round
successivi. Se le decisioni aperte sono piu' di cinque, si sceglie il sottoinsieme
di cui le altre dipendono e si rimanda il resto ai round seguenti.

Ogni domanda contiene, in quest'ordine, tutte le voci:

- **Decisione da prendere** — cosa va deciso, in una frase.
- **Perche' e' necessaria ora** — cosa si blocca se non si decide adesso.
- **Opzione A** — descrizione concreta.
- **Opzione B** — descrizione concreta.
- **Opzione C** — solo se esiste davvero una terza strada; altrimenti si omette.
- **Raccomandazione** — quale opzione e perche', in una frase. E' una proposta, non
  una decisione presa.
- **Impatto** — riga per riga: tempi, costi, rischi, privacy, manutenzione.
  Se una voce non e' rilevante si scrive `nessuno`, non si salta.
- **Default vietato** — riga fissa che dichiara cosa **non** faro' in assenza di
  risposta. Non esiste comportamento predefinito: senza risposta, non si procede.

Le opzioni devono essere realmente alternative e realmente praticabili. Vietato
inserire un'opzione fantoccio per far vincere la raccomandazione.

## Bloccanti e differibili

Ogni domanda va classificata:

- **Bloccante** — senza risposta il lavoro in corso non puo' proseguire in modo
  corretto, oppure produrrebbe qualcosa da rifare.
- **Differibile** — il lavoro puo' proseguire, ma la decisione va presa entro un
  momento identificabile, che va indicato (per esempio: prima dell'import reale,
  prima del deploy, prima della fase gestionale).

Una domanda differibile che non ha un momento-limite indicato e' in realta'
bloccante: trattarla come tale.

## Decision register

Ogni risposta approvata viene registrata in `docs/decisions/decision-register.md`,
creato se assente. Una riga per decisione, mai sovrascritta: le decisioni cambiate
si registrano come nuova voce che **supera** la precedente, citandola.

Colonne obbligatorie:

`id, data, decisione, opzione scelta, opzioni scartate, motivo, chi ha approvato
(ruolo), ambito impattato, reversibile (si/no), riferimenti`

Regole:

- Si registra **solo** cio' che l'utente ha effettivamente approvato, con le sue parole
  se possibile. Mai la mia raccomandazione al posto della sua risposta.
- Nessun dato personale, credenziale o recapito nel register: si applica
  `privacy-safe-development`.
- Prima di aprire un round, il register va **letto**: una decisione gia' registrata
  non si richiede.

## Input richiesti

| Input | Obbligatorio | Note |
|---|---|---|
| Il lavoro in corso e cosa lo sta bloccando | si | senza contesto la domanda e' generica |
| `docs/decisions/decision-register.md` | si | letto prima di formulare domande |
| `ROADMAP.md`, `CLAUDE.md`, `docs/` | si | per non richiedere cio' che e' gia' deciso |
| Esito della ricerca dei fatti nell'ambiente | si | va dichiarato cosa ho verificato da solo |
| Vincoli noti di tempi, costi o scadenze | opzionale | affinano la raccomandazione |

**Fermarsi e chiedere** se manca un obbligatorio — ma senza aprire un round solo
per procurarsi un file che posso leggere da me.

## Vincoli e divieti

- **Nessun default.** In assenza di risposta non si sceglie: si resta fermi.
- **Nessuna domanda gia' risolta** da documenti di progetto o dal register.
- **Nessuna domanda su banalita' implementative** coperte da convenzioni.
- **Mai piu' di 5 domande** in un round.
- **Mai una domanda senza opzioni, raccomandazione e impatto** completi.
- **Mai procedere** su un'azione della lista di conferma obbligatoria senza
  conferma puntuale.
- **Mai chiedere all'utente un fatto** verificabile nell'ambiente.
- **Mai riformulare** una domanda gia' risposta per ottenere una risposta diversa.
- Nessuna credenziale, recapito o dato personale dentro domande, opzioni o register.

## Rapporto con il gate di progetto

Nessuna fase gestionale puo' essere pianificata, avviata o rilasciata finche' non
sono entrambe vere: migrazione WordPress **pixel-perfect approvata esplicitamente
dall'utente** in `docs/qa/visual-parity-report.md`, e deploy in produzione
**eseguito e verificato** in `docs/deploy/`.

Questa skill **non puo' sbloccare il gate**. Una risposta dell'utente a un round
di domande non sostituisce le prove richieste da `deployment-gate`. Se una domanda
punta a scavalcare il gate, va posta come bloccante, con l'impatto dichiarato e il
rimando esplicito a `deployment-gate`.

Le decisioni tecniche prese qui devono restare compatibili con lo stack di
destinazione: React + Next.js (App Router), Node.js, PostgreSQL. Un'opzione che
introduce una dipendenza WordPress o PHP a runtime va segnalata come tale
nell'impatto, non proposta come equivalente.

## Output obbligatori

Il round di domande si presenta in chat **esattamente** con questa struttura:

```
# Decisioni richieste

## Bloccanti

### D1. <titolo breve della decisione>
- **Decisione da prendere:** ...
- **Perche' e' necessaria ora:** ...
- **Opzione A:** ...
- **Opzione B:** ...
- **Opzione C:** ...            (solo se esiste)
- **Raccomandazione:** ...
- **Impatto:**
  - tempi: ...
  - costi: ...
  - rischi: ...
  - privacy: ...
  - manutenzione: ...
- **Default vietato:** in assenza di risposta non procedo a <azione>.

### D2. ...

## Differibili

### D3. <titolo breve>
(stessa struttura, piu' la riga)
- **Termine:** entro <momento identificabile>.

## Impatto se si rimanda
- D1: ...
- D3: ...
```

Se una sezione e' vuota, va comunque scritta con `nessuna`. Non si omettono
intestazioni.

Dopo la risposta dell'utente, aggiornare `docs/decisions/decision-register.md`
e confermare in una riga cosa e' stato registrato.

## Checklist di verifica

Prima di inviare un round:

- [ ] Ho cercato i fatti nell'ambiente e lo dichiaro
- [ ] Ho letto il decision register e i documenti di progetto
- [ ] Nessuna domanda duplica una decisione gia' presa
- [ ] Nessuna domanda riguarda una banalita' coperta da convenzioni
- [ ] Massimo 5 domande, numerate in modo stabile
- [ ] Ogni domanda ha decisione, motivo, opzioni, raccomandazione, impatto completo
- [ ] Ogni domanda ha la riga "Default vietato"
- [ ] Opzioni realmente alternative e praticabili, nessun fantoccio
- [ ] Domande classificate in bloccanti e differibili
- [ ] Ogni differibile ha un termine identificabile
- [ ] Sezione "Impatto se si rimanda" compilata
- [ ] Implementazione ferma; nessuna modifica anticipata
- [ ] Nessun dato personale o credenziale nelle domande
- [ ] Se c'e' un'azione a impatto elevato: richiesta di conferma puntuale presente

Dopo la risposta:

- [ ] Registrata **solo** la decisione dell'utente, non la mia raccomandazione
- [ ] Register aggiornato con id, data, motivo, ruolo approvante, reversibilita'
- [ ] Decisioni rimaste aperte dichiarate esplicitamente
- [ ] Ripresa del lavoro limitata alle sole decisioni chiuse

## Condizioni di stop

Restare fermi, senza modificare nulla, quando:

- una domanda bloccante e' senza risposta;
- l'utente risponde in modo ambiguo: chiedere chiarimento, non interpretare;
- l'utente chiede di "decidere tu": accettabile **solo** per decisioni reversibili e
  non incluse nella lista di conferma obbligatoria; in quel caso scegliere,
  registrarlo nel register come delega esplicita e dirlo. Per tutto il resto,
  riproporre la domanda spiegando perche' non posso deciderla io;
- un'azione della lista di conferma obbligatoria e' imminente e la conferma manca
  o e' generica;
- una risposta contraddice una decisione gia' registrata: fermarsi, esporre il
  conflitto, chiedere quale prevale e registrare il superamento;
- servirebbe un dato personale o una credenziale per formulare la domanda.

Non esiste urgenza che giustifichi un default. Se l'utente non e' disponibile, il
lavoro si ferma e lo si dichiara.

## Formato della risposta

Il round usa la struttura in "Output obbligatori", preceduta da due sole righe:

1. **Cosa e' bloccato** — quale attivita' e' sospesa in attesa di risposta.
2. **Cosa ho gia' verificato da solo** — i fatti raccolti nell'ambiente, cosi' che
   sia evidente che non sto chiedendo cio' che potevo trovare.

Nessun'altra premessa, nessun riepilogo del contesto che l'utente gia' conosce.
