---
name: superpowers-phase-planning
description: Orchestratore di pianificazione per fasi del progetto: delega a superpowers (brainstorming, writing-plans, executing-plans) e vi aggiunge i vincoli locali, il protocollo PROGRESS.md, l'ordine delle fasi di migrazione e il gate pre-gestionale. Usare per "pianifichiamo", "che fase facciamo", "roadmap", "piano di lavoro", "da dove partiamo", o prima di avviare qualunque fase.
---

# Superpowers Phase Planning

Questa skill **non reimplementa** la pianificazione: quella e' gia' fornita dal
plugin `superpowers` (installato e attivo). Qui si definisce come usarla in questo
progetto, quali vincoli locali applicare e in quale ordine possono esistere le fasi.

## Delega obbligatoria a superpowers

| Momento | Skill da invocare |
|---|---|
| L'obiettivo non e' ancora chiaro | `superpowers:brainstorming` |
| Obiettivo chiaro, serve un piano scritto | `superpowers:writing-plans` |
| Piano scritto, si esegue | `superpowers:executing-plans` |
| Esecuzione con attivita' indipendenti | `superpowers:subagent-driven-development` |
| Comparsa di un bug | `superpowers:systematic-debugging` |
| Nuova funzionalita' o correzione | `superpowers:test-driven-development` |
| Prima di dichiarare finito | `superpowers:verification-before-completion` |

Non duplicare qui il contenuto di quelle skill: invocarle e seguirle.
Questa skill aggiunge **solo** cio' che segue.

## Gate di progetto (non negoziabile)

Nessuna fase gestionale (back-office, moduli gestionali, aree riservate, workflow
interni) puo' essere **pianificata**, avviata o rilasciata finche' non sono entrambe vere:

1. migrazione WordPress dichiarata **pixel-perfect e approvata esplicitamente
   dall'utente** in `docs/qa/visual-parity-report.md`;
2. deploy in produzione **eseguito e verificato**, con release report e smoke test
   in `docs/deploy/`.

Qui il divieto e' piu' stretto che altrove: non si scrive nemmeno il piano della
fase gestionale prima del gate. Se l'utente lo chiede: citare il gate, mostrare le
fasi mancanti, chiedere conferma esplicita prima di qualunque deroga.

## Ordine delle fasi

Vincolante. Una fase non si pianifica finche' la precedente non e' conclusa o
esplicitamente dichiarata parziale dall'utente.

1. **Audit sorgente** — skill `wordpress-source-audit`
2. **Schema e import** — skill `wordpress-postgres-import`
3. **Frontend e parita' visiva** — skill `wordpress-visual-parity`
4. **Collaudo redazionale** — skill `cms-editability-qa`
5. **UAT e approvazione pixel-perfect dell'utente**
6. **Deploy staging, poi produzione** — skill `deployment-gate`
7. **Solo dopo: fase gestionale**

`privacy-safe-development` non e' una fase: si applica a tutte.

## Stack

React + Next.js (App Router) + Node.js + PostgreSQL. Ogni piano deve restare
compatibile con questo stack: nessuna dipendenza PHP/WordPress a runtime, nessuna
soluzione che leghi il target al CMS sorgente.

## Trigger

- Richieste di pianificazione, roadmap, "da dove partiamo", "che fase facciamo".
- Prima di avviare una qualunque fase o wave.
- Alla ripresa del lavoro dopo un'interruzione.
- Quando una fase produce deviazioni rispetto al piano.

## Input richiesti

| Input | Obbligatorio | Note |
|---|---|---|
| Identificativo della fase da pianificare | si | deve esistere nella `ROADMAP.md` |
| `ROADMAP.md` e `CLAUDE.md` non vuoti | si | verificati prima di scrivere il piano |
| `PROGRESS.md` nella radice | si | creato se assente, prima della prima wave |
| `CONTEXT.md` e `PLAN.md` della fase | condizionale | obbligatori dove il flusso li prevede |
| Stato delle fasi precedenti | si | da `PROGRESS.md` e dai documenti in `docs/` |
| Criteri di "fatto" attesi dall'utente | si | se assenti, si ricavano via `/grill-me` |

**Fermarsi e chiedere** se manca un obbligatorio, elencandone il path esatto.

## Prerequisiti da verificare prima di pianificare

Controllare esistenza e non-vuotezza; se manca qualcosa: **fermarsi**, elencare i
path esatti, offrire di crearli, non ripiegare su un altro flusso.

- `ROADMAP.md`
- `CLAUDE.md`
- `CONTEXT.md` della fase, dove il flusso lo prevede
- `PLAN.md` della fase, dove il flusso lo prevede
- `PROGRESS.md` nella radice del progetto: se assente, crearlo prima della prima wave

## Protocollo PROGRESS.md

Obbligatorio per ogni esecuzione multi-wave.

1. **Prima di ogni wave** — leggere `PROGRESS.md`. Se esiste una riga
   `PHASE:<id> WAVE:<id> STATUS:complete`, saltare quella wave. Mai rieseguire
   una wave completata.
2. **Dopo ogni wave** — appendere subito una riga:
   `PHASE:<phase-id> WAVE:<wave-id> STATUS:<complete|failed> TS:<ISO-8601-UTC>`
3. **Alla ripresa dopo interruzione** — riportare all'utente l'ultima wave
   completata e quelle rimanenti **prima** di proseguire.
4. Verificare sempre la presenza di interruzioni da rate limit e riprendere
   dall'ultima wave completata, mai dall'inizio della fase.

## Regola di precedenza sulla validazione

Prima di qualunque attivita' di completamento di milestone o fase, eseguire
**prima** il passo di audit/validazione. Non saltare al completamento senza
approvazione esplicita dell'utente.

## Vincoli e divieti

- Nessuna installazione di plugin esterni.
- Nessuna modifica al codice applicativo durante la pianificazione: qui si scrive,
  non si implementa.
- Nessun import di database, nessun accesso a sistemi remoti.
- Nessun dato reale, credenziale, recapito o riferimento a persone identificabili
  nei piani: si applica `privacy-safe-development`.
- Nessun piano che presupponga il superamento del gate senza le sue prove.
- Nessuna fase pianificata in parallelo a una che ne e' prerequisito.

## Decisioni non definite: grill-me

Eseguire `/grill-me` (skill utente da `mattpocock/skills`; `/batch-grill-me` per
piu' decisioni insieme) **prima** di scrivere un piano, quando:

- l'ambito della fase non e' definito;
- esistono piu' approcci con conseguenze diverse per costo, tempo o rischio;
- non e' chiaro cosa significhi "fatto" per la fase;
- le dipendenze tra fasi sono ambigue;
- serve decidere cosa entra nella migrazione e cosa e' rimandato.

Regola: i **fatti** si cercano nell'ambiente (filesystem, git, documenti); le
**decisioni** si chiedono all'utente. Non pianificare su assunzioni non dichiarate.

## Output obbligatori

| Artefatto | Path |
|---|---|
| Piano della fase | come previsto da `superpowers:writing-plans`, nel percorso di fase |
| Registro di avanzamento | `PROGRESS.md` nella radice del progetto |
| Assunzioni e decisioni aperte | sezione dedicata dentro il piano di fase |

Ogni piano deve contenere, esplicitamente:

- obiettivo della fase in una frase;
- criteri di "fatto" verificabili, non opinabili;
- prerequisiti e fase precedente da cui dipende;
- suddivisione in wave con identificativo stabile;
- rischi e piano di rientro;
- assunzioni dichiarate;
- decisioni aperte, numerate, con opzioni e raccomandazione.

## Checklist di verifica

- [ ] Skill superpowers appropriata invocata e dichiarata in apertura
- [ ] `ROADMAP.md`, `CLAUDE.md` e i file di fase verificati esistenti e non vuoti
- [ ] `PROGRESS.md` presente; creato se assente
- [ ] `PROGRESS.md` letto prima della wave; wave completate saltate
- [ ] Riga di avanzamento appesa dopo ogni wave
- [ ] Alla ripresa: ultima wave completata e wave rimanenti riportate all'utente
- [ ] Ordine delle fasi rispettato; nessuna fase pianificata fuori sequenza
- [ ] Nessuna fase gestionale pianificata prima del gate
- [ ] Passo di audit/validazione previsto prima di ogni completamento di milestone
- [ ] Piano compatibile con React + Next.js + Node.js + PostgreSQL
- [ ] Criteri di "fatto" verificabili presenti
- [ ] Assunzioni dichiarate, non implicite
- [ ] Decisioni aperte numerate con raccomandazione
- [ ] Nessun dato sensibile nel piano

## Condizioni di stop

Fermarsi **subito** e chiedere quando:

- manca uno dei file prerequisito: elencarne i path esatti e offrire di crearli;
- l'ambito o i criteri di completamento non sono definiti: usare `/grill-me`;
- viene chiesta la fase gestionale prima del gate: citare il gate, elencare cosa
  manca, attendere conferma esplicita;
- viene chiesto di saltare l'audit o la validazione: rifiutare e chiedere approvazione;
- una fase dipende da una precedente incompleta;
- si e' verificata un'interruzione: riportare lo stato prima di riprendere;
- il piano richiederebbe di installare plugin, importare database o accedere a
  sistemi remoti: fuori ambito, chiedere.

## Formato della risposta

1. **Skill superpowers usata** — quale e perche', una riga.
2. **Stato dei prerequisiti** — tabella: file, presente, non vuoto.
3. **Posizione nell'ordine delle fasi** — fase corrente, precedente, successiva.
4. **Stato del gate** — `NON SUPERATO` / `SUPERATO`, con le prove mancanti.
5. **Avanzamento** — ultima wave completata, wave rimanenti, da `PROGRESS.md`.
6. **Piano proposto** — wave numerate, con criteri di "fatto".
7. **Decisioni aperte** — numerate, con opzioni e raccomandazione; se maggiori di
   zero, proporre `/grill-me` e **non** iniziare l'esecuzione.
8. **Prossimo passo proposto** — uno solo, poi attendere conferma.
