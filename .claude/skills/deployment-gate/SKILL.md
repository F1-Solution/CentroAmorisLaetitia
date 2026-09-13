---
name: deployment-gate
description: Cancello obbligatorio che impedisce staging e produzione finche' la migrazione WordPress pixel-perfect non e' conclusa e verificata, e blocca il rilascio su test rossi, differenze non approvate, segreti nel repo, backup non verificati o migrazioni non reversibili. Usare a ogni richiesta di deploy, rilascio, go-live, messa online, DNS, dominio o passaggio alla fase gestionale.
---

# Deployment Gate

Nessun rilascio passa senza prove. Questa skill non esegue il deploy: **autorizza
o blocca**, sulla base di evidenze documentate, e pretende l'approvazione esplicita
dell'utente a ogni passaggio.

Il verdetto predefinito e' **BLOCCATO**. Si sblocca solo con prove, mai con
rassicurazioni.

## Gate di progetto (non negoziabile)

Nessuna fase gestionale (back-office, moduli gestionali, aree riservate, workflow
interni) puo' essere pianificata, avviata o rilasciata finche' non sono entrambe vere:

1. migrazione WordPress dichiarata **pixel-perfect e approvata esplicitamente
   dall'utente** in `docs/qa/visual-parity-report.md`;
2. deploy in produzione **eseguito e verificato**, con release report e smoke test
   in `docs/deploy/`.

Questa skill e' il custode del gate. Una richiesta di anticipare la fase gestionale
va rifiutata citando il gate, elencando cosa manca e chiedendo conferma.

## Stack

React + Next.js + Node.js + PostgreSQL. Le prove richieste sotto sono agnostiche
rispetto al provider: il provider si decide via `/grill-me`, non per default.

## Trigger

- Qualsiasi richiesta di deploy, rilascio, go-live, "mettiamolo online", staging,
  produzione, DNS, dominio, certificati, reverse proxy.
- Qualsiasi richiesta di iniziare la fase gestionale.
- Prima di ogni merge su un branch che rilascia automaticamente.

## Input richiesti

| Input | Obbligatorio | Note |
|---|---|---|
| Ambiente di destinazione dichiarato (`staging` o `produzione`) | si | mai dedotto |
| Commit o tag esatto da rilasciare | si | il verdetto vale per quella revisione |
| Cartelle `docs/migration/`, `docs/qa/`, `docs/deploy/` | si | contengono le prove |
| Output di esecuzione dei test, prodotto ora | si | non basta un'esecuzione precedente |
| Esito della scansione segreti di `privacy-safe-development` | si | su working tree e cronologia |
| Approvazione esplicita dell'utente per questo deploy | si | data in questo momento |
| Credenziali di provider, DNS, server | **no** | non vanno mai richieste ne' ricevute qui |

**Fermarsi e chiedere** se manca un obbligatorio: l'assenza di un input non si
compensa con una stima.

## Separazione degli ambienti

**Staging** e **produzione** sono ambienti distinti, con configurazione, database,
storage, segreti e dominio separati. Non condividono mai il database.

- Un'approvazione per staging **non** vale per produzione.
- Un deploy di produzione richiede che la stessa build sia gia' passata in staging.
- Ogni deploy, in qualunque ambiente, richiede **approvazione esplicita dell'utente**
  data in quel momento, per quel deploy. Nessuna delega implicita, nessuna approvazione
  "valida da qui in poi".

## Prove documentate richieste

Nessuna voce e' opzionale. Per ciascuna: path del documento e data. Una prova
mancante o piu' vecchia dell'ultima modifica rilevante = **BLOCCATO**.

| # | Prova | Fonte |
|---|---|---|
| 1 | Audit del sorgente concluso | `docs/migration/source-audit.md` |
| 2 | Import eseguito con conteggi riconciliati, nessun oggetto `deferred` aperto | `docs/migration/` + report di import |
| 3 | Editabilita' CMS verificata, nessun difetto bloccante aperto | `docs/qa/cms-editability-report.md` |
| 4 | URL matrix completa e senza esclusioni immotivate | `docs/migration/url-matrix.csv` |
| 5 | Screenshot diff chiusi: nessuna differenza `aperta` | `docs/qa/visual-parity-report.md` + `docs/qa/screenshots/` |
| 6 | Test automatizzati verdi: unit, integrazione, end-to-end | output di esecuzione, allegato |
| 7 | UAT eseguita e approvata dall'utente | `docs/qa/uat-report.md` |
| 8 | Piano e prova di rollback | `docs/deploy/rollback-plan.md` |
| 9 | Backup eseguito **e restore verificato** | `docs/deploy/backup-verification.md` |
| 10 | Scansione segreti pulita sul repository | esito di `privacy-safe-development` |

## Condizioni di blocco assoluto

Verdetto **BLOCCATO**, senza eccezioni e senza possibilita' di override in autonomia:

- un solo test rosso, o test non eseguiti;
- una sola differenza visiva in stato `aperta` o non approvata dall'utente;
- un solo difetto di editabilita' `bloccante` aperto;
- un segreto presente nel repository o nella cronologia git;
- backup assente, oppure presente ma con **restore non verificato**;
- migrazioni di database non reversibili, o rollback mai provato;
- oggetti `deferred` dell'import ancora aperti;
- pixel-perfect non approvato esplicitamente dall'utente per iscritto;
- assenza del piano DNS/SSL/storage/monitoraggio per un deploy di produzione.

Solo l'utente puo' decidere di rilasciare nonostante un blocco. In quel caso:
esporre il rischio, chiedere conferma esplicita, e **registrare la deroga** nel
release report con motivo e data. Non e' una scorciatoia, e' una decisione tracciata.

## Piano di infrastruttura richiesto (produzione)

Prima di un deploy di produzione devono essere documentati in `docs/deploy/`:

- **DNS** — record da modificare, TTL attuale e ridotto in anticipo, finestra di
  propagazione, piano di rientro;
- **SSL/TLS** — emissione, rinnovo automatico, redirect HTTP verso HTTPS, HSTS;
- **Reverse proxy / edge** — routing, timeout, compressione, header di sicurezza,
  cache e invalidazione;
- **Storage** — dove risiedono i media, backup, politica di accesso pubblico;
- **Database** — versione PostgreSQL, connessioni, pooling, migrazioni applicate;
- **Backup** — cosa, dove, ogni quanto, con quale retention, **e la prova del restore**;
- **Monitoraggio** — uptime, errori applicativi, metriche, soglie e destinatari degli alert;
- **Log** — raccolta, retention, e conformita' alle regole di `privacy-safe-development`;
- **Restore e rollback** — procedura passo-passo, tempo stimato, chi la esegue.

## Smoke test post-deploy

Obbligatori subito dopo ogni deploy, prima di dichiararlo riuscito:

- home, una pagina, un articolo, un archivio, la ricerca e la 404 rispondono `200`
  (la 404 risponde `404`);
- login al CMS e salvataggio di una modifica di prova, poi ripristino;
- media serviti correttamente, inclusi quelli storici;
- redirect dai vecchi URL WordPress funzionanti su un campione rappresentativo;
- certificato valido, HTTPS forzato;
- zero errori in console e zero richieste di rete fallite sulle pagine chiave;
- `robots.txt` e sitemap corretti per l'ambiente (staging **non** indicizzabile);
- monitoraggio attivo e primo dato ricevuto;
- confronto rapido con le baseline di parita' su almeno le pagine prioritarie.

Se uno smoke test fallisce: **rollback**, non correzione in produzione a caldo.

## Vincoli e divieti

- **Mai modificare DNS, dominio, configurazione e-mail o server senza conferma
  vincolante dell'utente**, data per quella specifica modifica.
- Mai eseguire un deploy in autonomia perche' "tutto sembra a posto".
- Mai disabilitare un controllo, un test o una soglia per ottenere un verdetto verde.
- Mai rilasciare con dati di produzione in ambienti non destinati a contenerli.
- Mai scrivere segreti nei file di configurazione versionati.
- Mai dichiarare "deploy riuscito" prima degli smoke test.

## Decisioni non definite: grill-me

Eseguire `/grill-me` (skill utente da `mattpocock/skills`; `/batch-grill-me` per
piu' decisioni insieme) per tutte le scelte d'infrastruttura:

- scelta del provider di hosting, database e storage;
- costi, piani e limiti;
- strategia di scaling e disponibilita' attesa;
- finestra di go-live e gestione del downtime;
- politica di backup, retention e conservazione dei log;
- gestione del dominio e delle e-mail durante lo switch;
- chi riceve gli alert e con quale reperibilita'.

Nessuna di queste si decide per default.

## Output obbligatori

| Artefatto | Path |
|---|---|
| Esito del gate, per ogni valutazione | `docs/deploy/gate-checklist.md` |
| Release report, per ogni deploy | `docs/deploy/release-report-<YYYY-MM-DD>.md` |
| Piano di rollback | `docs/deploy/rollback-plan.md` |
| Verifica del backup e del restore | `docs/deploy/backup-verification.md` |
| Piano di infrastruttura | `docs/deploy/infrastructure-plan.md` |

Il release report contiene: ambiente, versione e commit rilasciati, elenco delle
prove con path e data, esito degli smoke test, eventuali deroghe approvate con
motivo, chi ha approvato (per ruolo), orario di inizio e fine, esito finale.

## Checklist di verifica

- [ ] Tutte e dieci le prove presenti, aggiornate e referenziate per path
- [ ] Nessuna prova piu' vecchia dell'ultima modifica al codice rilasciato
- [ ] Test unitari, di integrazione ed end-to-end eseguiti ora, tutti verdi
- [ ] Zero differenze visive aperte; approvazione pixel-perfect dell'utente presente
- [ ] Zero difetti di editabilita' bloccanti aperti
- [ ] Zero oggetti `deferred` aperti nell'import
- [ ] Scansione segreti pulita su working tree e cronologia
- [ ] Backup eseguito e **restore verificato** nella finestra corrente
- [ ] Migrazioni database reversibili; rollback provato, non solo scritto
- [ ] Ambiente di destinazione dichiarato e distinto dagli altri
- [ ] Per la produzione: build gia' validata in staging
- [ ] Piano DNS, SSL, reverse proxy, storage, backup, monitoraggio, log, restore presente
- [ ] Staging non indicizzabile
- [ ] Approvazione esplicita dell'utente per **questo** deploy, ottenuta ora
- [ ] Smoke test post-deploy eseguiti e verdi
- [ ] Release report scritto e archiviato
- [ ] Eventuali deroghe registrate con motivo e approvazione

## Condizioni di stop

Fermarsi e rifiutare, esponendo il motivo, quando:

- una qualunque condizione di blocco assoluto e' presente;
- manca l'approvazione esplicita dell'utente per questo specifico deploy;
- si viene spinti a rilasciare "solo per vedere se funziona";
- si chiede di modificare DNS, dominio o e-mail senza conferma vincolante;
- si chiede di avviare la fase gestionale prima del completamento del gate:
  citare il gate, elencare le prove mancanti, chiedere conferma;
- una decisione d'infrastruttura non e' stata presa: usare `/grill-me`;
- uno smoke test fallisce dopo il deploy: avviare il rollback e fermarsi.

## Formato della risposta

1. **Verdetto** — `BLOCCATO` / `AUTORIZZATO PER STAGING` / `AUTORIZZATO PER
   PRODUZIONE`, in prima riga, con l'ambiente.
2. **Tabella delle prove** — le dieci voci: prova, stato (`OK` / `MANCANTE` /
   `SCADUTA`), path, data.
3. **Blocchi** — elenco puntuale di cosa impedisce il rilascio; vuoto se autorizzato.
4. **Rischi residui** — anche quando il verdetto e' positivo.
5. **Richiesta di approvazione** — cosa esattamente si chiede di approvare, per
   quale ambiente, e cosa comporta.
6. **Decisioni da prendere** — numerate, con opzioni e raccomandazione; se maggiori
   di zero, proporre `/grill-me`.
7. **Prossimo passo proposto** — uno solo, poi attendere conferma.

Il verdetto non e' mai implicito e non compare mai dopo altro testo: prima riga, sempre.
