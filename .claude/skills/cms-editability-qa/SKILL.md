---
name: cms-editability-qa
description: Verifica che tutto il contenuto migrato sia davvero modificabile da un redattore non tecnico nel nuovo CMS Node.js/React, senza toccare il codice. Usare per "si puo' modificare da backoffice?", "contenuto hardcoded", "collaudo redazionale", "prova editor", o prima di dichiarare conclusa la migrazione.
---

# CMS Editability QA

Un contenuto importato ma non modificabile dal redattore e' un contenuto **non
migrato**. Questa skill collauda l'editabilita' reale del nuovo CMS dal punto di
vista di chi pubblica, non di chi sviluppa.

Prerequisito: `wordpress-postgres-import` eseguito almeno una volta con seconda
passata completata.

## Gate di progetto (non negoziabile)

Nessuna fase gestionale (back-office, moduli gestionali, aree riservate, workflow
interni) puo' essere pianificata, avviata o rilasciata finche' non sono entrambe vere:

1. migrazione WordPress dichiarata **pixel-perfect e approvata esplicitamente
   dall'utente** in `docs/qa/visual-parity-report.md`;
2. deploy in produzione **eseguito e verificato**, con release report e smoke test
   in `docs/deploy/`.

L'editabilita' del contenuto migrato fa parte della migrazione, non della fase
gestionale: collaudarla e' dovuto **prima** del gate, non dopo.

## Stack

CMS su Node.js + PostgreSQL, interfaccia React/Next.js. Nessuna dipendenza
WordPress a runtime: "si faceva cosi' in WordPress" non e' un criterio di
accettazione, "il redattore ci riesce da solo" lo e'.

## Trigger

- Dopo un import, prima di dichiarare la migrazione conclusa.
- Domande su cosa il redattore puo' o non puo' cambiare.
- Sospetto di contenuto hardcoded nei componenti React.
- Dopo modifiche allo schema PostgreSQL o all'editor.
- Quando `deployment-gate` chiede la prova di editabilita'.

## Input richiesti

| Input | Obbligatorio | Note |
|---|---|---|
| CMS avviabile con dati importati | si | ambiente di test, mai produzione |
| Utenti di prova **sintetici** per ogni ruolo | si | mai account di persone reali |
| Elenco ruoli e permessi attesi | si | decisione dell'utente |
| `docs/migration/content-inventory.csv` | si | definisce cosa deve essere editabile |
| Elenco dei campi volutamente non editabili | si | altrimenti ogni assenza e' un difetto |

**Fermarsi e chiedere** se manca un obbligatorio. In particolare: senza l'elenco
dei campi volutamente non editabili non e' possibile distinguere una scelta da un bug.

## Metodo

Per ogni tipo di contenuto presente nell'inventario, eseguire il ciclo completo
**dall'interfaccia**, mai da SQL o da API dirette:

1. aprire il contenuto nell'editor;
2. modificare un campo;
3. salvare;
4. ricaricare e verificare la persistenza;
5. verificare il rendering sul frontend;
6. **round-trip**: riaprire, salvare senza modifiche, verificare che nulla si perda
   o si alteri (perdita silenziosa di markup, attributi, blocchi, media).

Il round-trip senza modifiche e' il test piu' importante: e' li' che si scopre la
perdita di dati da normalizzazione.

## Cosa verificare

### Contenuti

- Ogni tipo dell'inventario: pagine, post, CPT approvati.
- Titolo, slug, corpo, estratto, immagine in evidenza, campi custom migrati.
- Contenuto HTML importato: modificabile senza corromperlo.
- Blocchi strutturati, dove presenti: aggiungere, riordinare, eliminare.
- Contenuti `deferred` dall'import: devono essere visibili e gestibili, non invisibili.

### Struttura e navigazione

- Gerarchia pagine: cambiare il parent dall'interfaccia.
- Menu: aggiungere, riordinare, rinominare, annidare, rimuovere voci.
- Tassonomie: creare termini, assegnarli, rimuoverli.

### Media

- Caricare un file nuovo; sostituire un media esistente; modificare `alt` e didascalia.
- Verificare che la sostituzione si propaghi ovunque il media sia usato.
- Verificare limiti di dimensione e tipi ammessi, con messaggio d'errore comprensibile.

### SEO e metadati

- Title, meta description, canonical, OpenGraph, `noindex` modificabili per contenuto.
- Redirect gestibili senza intervento tecnico, se previsti.

### Flussi redazionali

- Bozza, anteprima, pubblicazione, spubblicazione, programmazione.
- Revisioni e ripristino, se previsti.
- Contenuti privati e password-protected, se migrati.

### Ruoli e permessi

- Ogni ruolo vede e modifica **solo** cio' che deve; verificare anche il caso
  negativo (un ruolo che non deve poter fare una cosa, non ci riesce).
- Nessuna scalata di privilegi tramite URL diretto o richiesta API.

### Robustezza dell'interfaccia

- Validazione con messaggi comprensibili a un non tecnico, in italiano.
- Nessun errore in console durante il ciclo di modifica.
- Nessuna perdita di lavoro su errore di rete o sessione scaduta.
- Accessibilita' di base dell'editor: navigazione da tastiera, label, focus visibile.

### Caccia al contenuto hardcoded

Cercare nel frontend React/Next.js testi, etichette, URL, numeri, orari, immagini e
liste che compaiono a schermo ma **non** provengono da PostgreSQL. Ogni occorrenza
e' un difetto di editabilita': va elencata con file, riga e contenuto.

## Vincoli e divieti

- **Mai collaudare in produzione.** Solo ambienti di test con dati importati.
- **Mai usare account, e-mail o dati di persone reali**: solo utenti sintetici
  (`redattore-test@example.invalid`) e contenuti di prova riconoscibili.
- Nessun contenuto di prova deve restare nell'ambiente al termine: rimuoverlo e
  dichiararlo.
- Nessuna correzione "di nascosto" via SQL per far passare un test: se serve SQL,
  il test e' fallito.
- Nel report non devono comparire credenziali, token, e-mail o nomi di persone
  reali, indirizzi, IBAN, documenti o altri dati personali.

## Decisioni non definite: grill-me

Eseguire `/grill-me` (skill utente da `mattpocock/skills`) quando:

- non e' chiaro se un campo debba essere editabile o volutamente bloccato;
- il modello di ruoli e permessi non e' definito;
- un contenuto migrato non ha una collocazione ovvia nell'editor;
- serve decidere se un blocco page builder diventa contenuto libero o componente fisso;
- si deve scegliere tra fedelta' al comportamento WordPress e una UX migliore.

I **fatti** si verificano nell'applicazione; le **decisioni** si chiedono.

## Output obbligatori

| Artefatto | Path |
|---|---|
| Report di collaudo redazionale | `docs/qa/cms-editability-report.md` |
| Matrice editabilita' | `docs/qa/editability-matrix.csv` |
| Elenco contenuti hardcoded | dentro il report, sezione dedicata |

`editability-matrix.csv`, colonne minime:
`tipo_contenuto,campo,editabile_atteso,editabile_reale,ruolo,esito,evidenza,severita,note`

Ogni difetto: `id, descrizione, passi per riprodurre, ruolo, severita'
(bloccante|maggiore|minore), evidenza, stato (aperto|risolto|approvato), data`.

## Checklist di verifica

- [ ] Ogni tipo di contenuto dell'inventario collaudato, non un campione
- [ ] Ciclo completo apri-modifica-salva-ricarica-verifica eseguito per ogni tipo
- [ ] Round-trip senza modifiche: nessuna perdita di markup, blocchi o media
- [ ] Gerarchia pagine modificabile dall'interfaccia
- [ ] Menu completamente gestibili: aggiunta, riordino, annidamento, rimozione
- [ ] Tassonomie e termini gestibili
- [ ] Upload, sostituzione media e propagazione verificati
- [ ] `alt` e didascalie modificabili
- [ ] Campi SEO modificabili per singolo contenuto
- [ ] Bozza, anteprima, pubblicazione e spubblicazione funzionanti
- [ ] Contenuti `deferred` dall'import visibili e gestibili
- [ ] Permessi verificati per ogni ruolo, casi positivi **e** negativi
- [ ] Nessuna scalata di privilegi via URL o API diretta
- [ ] Messaggi di validazione comprensibili e in italiano
- [ ] Zero errori in console durante i cicli di modifica
- [ ] Accessibilita' di base dell'editor verificata
- [ ] Ricerca contenuti hardcoded eseguita sul frontend, con esito elencato
- [ ] Dati di prova rimossi dall'ambiente al termine
- [ ] Nessun dato personale reale usato o riportato

## Condizioni di stop

Fermarsi **subito** e chiedere quando:

- manca l'elenco dei campi volutamente non editabili o il modello dei ruoli;
- l'unico ambiente disponibile e' la produzione;
- per completare un test servirebbero credenziali o dati di persone reali;
- un contenuto migrato non e' raggiungibile da nessuna interfaccia;
- emerge perdita di dati nel round-trip: fermare il collaudo, segnalarlo come
  bloccante e rimandare a `wordpress-postgres-import`;
- l'utente chiede di dichiarare conclusa la migrazione con difetti bloccanti aperti:
  rifiutare, elencarli, chiedere approvazione esplicita voce per voce.

## Formato della risposta

1. **Verdetto** — `EDITABILITA' NON VERIFICATA` / `DIFETTI APERTI` / `VERIFICATA,
   IN ATTESA DI APPROVAZIONE` / `APPROVATA DALL'UTENTE`.
2. **Copertura** — tipi di contenuto collaudati su totale, ruoli collaudati.
3. **Difetti** — tabella: id, tipo, campo, ruolo, severita', stato.
4. **Contenuto hardcoded** — elenco con file e riga, o "nessuno trovato".
5. **Bloccanti** — solo quelli che impediscono il verdetto positivo.
6. **Decisioni da prendere** — numerate, con opzioni e raccomandazione; se maggiori
   di zero, proporre `/grill-me`.
7. **Prossimo passo proposto** — uno solo, poi attendere conferma.
