---
name: wordpress-postgres-import
description: Guida lo sviluppo di un importer idempotente da WordPress/MySQL verso PostgreSQL per il nuovo CMS Node.js/React, con dry-run obbligatorio, source map persistente, resume/retry e report. Usare quando si parla di import contenuti, migrazione dati, mapping WordPress-Postgres, rerun dell'importer o rollback dell'import.
---

# WordPress to PostgreSQL Import

Definisce come si costruisce, si esegue e si verifica l'importer dei contenuti dal
sorgente WordPress/MySQL al PostgreSQL del nuovo CMS. L'importer e' **codice del
progetto**, non uno script usa-e-getta: va testato, versionato e rieseguibile.

Prerequisito: `wordpress-source-audit` completato o esplicitamente dichiarato
parziale dall'utente. Senza inventario non si importa.

## Gate di progetto (non negoziabile)

Nessuna fase gestionale (back-office, moduli gestionali, aree riservate, workflow
interni) puo' essere pianificata, avviata o rilasciata finche' non sono entrambe vere:

1. migrazione WordPress dichiarata **pixel-perfect e approvata esplicitamente
   dall'utente** in `docs/qa/visual-parity-report.md`;
2. deploy in produzione **eseguito e verificato**, con release report e smoke test
   in `docs/deploy/`.

L'import e' un passo verso il gate, non il suo superamento.

## Stack di destinazione

- **Target**: PostgreSQL. Nessuna dipendenza WordPress o PHP a runtime.
- **Runtime importer**: Node.js (stesso engine del progetto), TypeScript quando
  il repo lo adotta.
- **Consumo**: React + Next.js (App Router) legge dal solo PostgreSQL.
- Il sorgente MySQL/dump e' un input **di sola lettura** e temporaneo.

## Trigger

- Sviluppo, modifica o esecuzione dell'importer.
- Domande su mapping tra entita' WordPress ed entita' del nuovo CMS.
- Rerun, resume, rollback o riconciliazione di un import gia' eseguito.
- Discrepanze di conteggi tra sorgente e target.

## Input richiesti

| Input | Obbligatorio | Note |
|---|---|---|
| Output di `wordpress-source-audit` in `docs/migration/` | si | conteggi attesi e inventario |
| Dump SQL WordPress o DB sorgente read-only | si | mai modificato |
| Schema PostgreSQL del CMS target (migrazioni) | si | senza schema non si mappa |
| Tabella di mapping approvata per shortcode / page builder | condizionale | obbligatoria se presenti |
| Elenco CPT e tassonomie **approvati** per l'import | si | decisione dell'utente, non deduzione |
| Percorso e politica di storage dei media nel target | si | filesystem, object storage o CDN |

Se manca uno degli obbligatori: **fermarsi**, elencarlo, chiedere.

## Requisiti funzionali

### Idempotenza e sicurezza di riesecuzione

- Ogni riesecuzione con lo stesso input produce lo stesso stato finale: **nessun
  duplicato**, nessuna cancellazione implicita.
- Upsert basati sulla source map, mai su corrispondenza di titolo o slug.
- Nessuna operazione distruttiva senza flag esplicito e conferma dell'utente.

### Source map persistente

Tabella dedicata nel target, popolata a ogni import:

| Colonna | Significato |
|---|---|
| `object_type` | tipo oggetto (`page`, `post`, `cpt:<nome>`, `term`, `media`, `menu`, `redirect`) |
| `wp_id` | identificativo nel sorgente WordPress |
| `target_id` | identificativo nel target PostgreSQL |
| `source_checksum` | checksum del record sorgente normalizzato |
| `import_version` | versione dell'importer che ha prodotto la riga |
| `imported_at` / `updated_at` | timestamp UTC |
| `status` | `imported`, `skipped`, `failed`, `deferred` |

La source map e' l'unica autorita' su "questo oggetto e' gia' stato importato".

### Dry-run obbligatorio

- `--dry-run` e' il comportamento **predefinito**; la scrittura richiede un flag
  esplicito di esecuzione.
- In dry-run: nessuna scrittura sul target, report completo di cosa **sarebbe**
  creato, aggiornato, saltato o fallito.
- Un import reale non parte se il dry-run corrispondente non e' stato eseguito e
  archiviato in `--report-dir`.

### Ordine di import e seconda passata

1. **Passata 1** — media e metadati necessari, poi termini e tassonomie, poi
   contenuti. I riferimenti non ancora risolvibili si registrano come `deferred`,
   in modo documentato, mai silenziosamente scartati.
2. **Passata 2** — risoluzione di parent/child (gerarchia pagine), relazioni
   contenuto-termine, voci di menu, link interni, riferimenti incrociati e
   riscrittura degli URL verso gli ID target.

La passata 2 e' obbligatoria: un import senza di essa e' **incompleto**, va
dichiarato tale e non puo' alimentare la verifica di parita' visiva.

### Contenuto HTML e blocchi

- Convertire l'HTML in forma **sanitizzata** mantenendo la massima fedelta'
  possibile al rendering originale. Allowlist di tag e attributi, mai denylist.
- Conservare **sempre** l'HTML originale importato in un campo dedicato: la
  sanitizzazione non deve essere distruttiva ne' irreversibile.
- Quando possibile, salvare in parallelo una **rappresentazione strutturata a
  blocchi** per l'editor del CMS, senza perdere l'HTML di origine.
- **Non convertire** shortcode o blocchi di page builder senza una tabella di
  mapping approvata dall'utente: se manca, registrare l'occorrenza come
  `deferred` con il payload originale intatto e portarla a `/grill-me`.

### Robustezza operativa

- Batch configurabili; default prudente e documentato.
- `--resume` riprende dall'ultimo batch completato usando la source map.
- Retry con backoff sui soli errori transitori; gli errori di dati non si ritentano.
- Isolamento degli errori: il fallimento di un oggetto non interrompe il batch;
  viene registrato e conteggiato.
- Transazione per batch, non per intero import.

### Logging e report

- Logging strutturato (JSON), un evento per oggetto, con `object_type`, `wp_id`,
  esito e durata.
- **Sanitizzazione obbligatoria** dei log: mai credenziali, token, stringhe di
  connessione, e-mail o nomi di persone reali, indirizzi, IBAN, dati di pagamento,
  password o loro hash. Il contenuto testuale si logga per lunghezza e checksum,
  non per valore.
- Report finale in **JSON** e **Markdown** con: conteggi per tipo e per esito,
  confronto con i conteggi attesi dall'audit, warning, errori, mapping prodotto,
  URL sorgente -> URL target, oggetti `deferred`.

## Vincoli e divieti

- **Mai alterare** il dump o il DB WordPress sorgente. Sola lettura.
- **Nessun accesso a sistemi remoti** non esplicitamente autorizzati dall'utente.
- Nessun dato reale nelle fixture, nei test o negli esempi di documentazione:
  solo dati sintetici.
- Nessuna credenziale nel codice, nei test o nei report: solo variabili d'ambiente,
  con validazione della presenza all'avvio.
- Nessuna scrittura sul target in dry-run, in nessuna circostanza.
- Nessuna dichiarazione di "import completato" senza riconciliazione dei conteggi.

## Decisioni non definite: grill-me

Fermarsi ed eseguire `/grill-me` (skill utente da `mattpocock/skills`;
`/batch-grill-me` per piu' decisioni) per **qualsiasi mapping ambiguo**, in particolare:

- shortcode o blocchi page builder senza equivalente approvato;
- campi custom e meta senza destinazione chiara nello schema target;
- CPT o tassonomie da includere, escludere o fondere;
- gestione di revisioni, bozze, contenuti privati e password-protected;
- politica di storage e rinomina dei media; deduplica;
- strategia URL: conservare i permalink o riprogettarli, e quali redirect generare;
- comportamento su conflitto di slug.

I **fatti** si cercano nell'ambiente; le **decisioni** si chiedono.

## Output obbligatori

| Artefatto | Path |
|---|---|
| Tabella di mapping entita' e campi | `docs/migration/import-mapping.md` |
| Runbook operativo dell'import | `docs/migration/import-runbook.md` |
| Template del report di import | `docs/migration/import-report-template.md` |
| Script importer con CLI | percorso di progetto, documentato nel runbook |
| Test automatizzati | accanto al codice, secondo le convenzioni del repo |

CLI minima obbligatoria: `--dry-run`, `--resume`, `--batch-size`, `--report-dir`.

`import-runbook.md` deve coprire esplicitamente: preflight, backup, esecuzione,
post-import verification, rollback.

### Test richiesti

- **Unitari** — normalizzazione HTML, sanitizzazione, mapping campi, generazione
  slug, calcolo checksum, risoluzione riferimenti.
- **Integrazione PostgreSQL** — su database reale usa-e-getta: idempotenza
  (doppia esecuzione a parita' di stato), resume dopo interruzione, seconda passata,
  isolamento errori.
- **Fixture sintetiche** — dataset finto che copre gerarchie, tassonomie, media
  mancanti, shortcode non mappati, slug duplicati, contenuti non in menu.
  Nessun contenuto reale del sito.

## Checklist di verifica

- [ ] Dry-run eseguito e report archiviato prima di ogni import reale
- [ ] Conteggi target riconciliati con i conteggi attesi da `wordpress-source-audit`
- [ ] Doppia esecuzione consecutiva: zero duplicati, zero modifiche inattese
- [ ] Source map popolata per ogni oggetto importato, con checksum e versione
- [ ] Seconda passata eseguita: gerarchie, relazioni, menu, link interni risolti
- [ ] Oggetti `deferred` elencati con motivo; nessuno scartato silenziosamente
- [ ] HTML originale conservato accanto alla versione sanitizzata
- [ ] Nessuno shortcode o blocco page builder convertito senza mapping approvato
- [ ] Media importati e referenziati correttamente; mancanti elencati
- [ ] URL sorgente -> target mappati; redirect generati dove deciso
- [ ] `--resume` verificato interrompendo e riprendendo un import di prova
- [ ] Errore su un oggetto non interrompe il batch; conteggiato nel report
- [ ] Log privi di segreti e PII (verifica esplicita su un campione)
- [ ] Report JSON e Markdown prodotti in `--report-dir`
- [ ] Test unitari e di integrazione verdi
- [ ] Backup del target verificato **prima** dell'import reale
- [ ] Rollback provato almeno una volta, non solo documentato
- [ ] Sorgente WordPress invariato (checksum del dump confrontato prima e dopo)

## Condizioni di stop

Fermarsi **subito** e chiedere quando:

- manca lo schema target, la lista CPT approvata o la tabella di mapping richiesta;
- i conteggi non riconciliano e lo scarto non e' spiegabile;
- si incontrano shortcode o blocchi non mappati: registrare `deferred`, poi `/grill-me`;
- il backup del target non e' verificato;
- il rollback non e' provato;
- servirebbe una scrittura sul sorgente;
- l'utente chiede di procedere a parita' visiva, deploy o fase gestionale con
  oggetti `deferred` o test rossi: citare il gate e attendere conferma.

Non dichiarare mai "import completato" con voci `deferred` o `failed` aperte:
dichiararlo **parziale**, con i numeri.

## Formato della risposta

1. **Modalita'** — `DRY-RUN` o `ESECUZIONE`, e su quale target.
2. **Riconciliazione** — tabella: tipo, attesi (audit), importati, saltati, falliti, differiti.
3. **Esito** — `COMPLETO` / `PARZIALE` / `FALLITO`, con il motivo in una riga.
4. **Artefatti** — path di report, log e documenti aggiornati.
5. **Deferred e mapping mancanti** — numerati, con opzioni e raccomandazione;
   se maggiori di zero, proporre `/grill-me`.
6. **Prossimo passo proposto** — uno solo, poi attendere conferma.
