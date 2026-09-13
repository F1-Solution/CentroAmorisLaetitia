---
name: wordpress-visual-parity
description: Verifica la parita' pixel-perfect del frontend Next.js/React rispetto al sito WordPress sorgente, tramite url-matrix, screenshot Playwright su viewport standard e diff visivo con soglia esplicita. Usare per "pixel perfect", "confronto col sito vecchio", "differenze visive", "screenshot diff", o prima di qualunque richiesta di deploy.
---

# WordPress Visual Parity

Stabilisce, misura e documenta la parita' visiva tra il nuovo frontend
Next.js/React e il sito WordPress sorgente. E' la skill che ha l'autorita' di
dichiarare (o negare) il **pixel-perfect** richiesto dal gate di progetto.

## Gate di progetto (non negoziabile)

Nessuna fase gestionale (back-office, moduli gestionali, aree riservate, workflow
interni) puo' essere pianificata, avviata o rilasciata finche' non sono entrambe vere:

1. migrazione WordPress dichiarata **pixel-perfect e approvata esplicitamente
   dall'utente** in `docs/qa/visual-parity-report.md`;
2. deploy in produzione **eseguito e verificato**, con release report e smoke test
   in `docs/deploy/`.

Questa skill produce la prova del punto 1. Non puo' dichiararlo da sola:
serve l'approvazione esplicita dell'utente, registrata nel report.

## Stack

Frontend target React + Next.js (App Router), dati da PostgreSQL via Node.js.
Gli strumenti di verifica girano in Node.js con **Playwright**.

## Trigger

- Richiesta di confronto col sito WordPress, "sembra uguale?", "e' pixel perfect?".
- Al termine di `wordpress-postgres-import`, prima di qualunque richiesta di deploy.
- Dopo ogni modifica a layout, CSS, font, componenti condivisi o template.
- Quando `deployment-gate` chiede la prova di parita' visiva.

## Input richiesti

| Input | Obbligatorio | Note |
|---|---|---|
| Sito WordPress sorgente raggiungibile (o baseline gia' catturate) | si | senza baseline non c'e' confronto |
| Frontend Next.js avviabile in locale o su ambiente di test | si | URL base parametrico |
| `docs/migration/content-inventory.csv` | si | alimenta la url-matrix |
| Autorizzazione esplicita a catturare pagine protette | condizionale | obbligatoria se incluse |
| Elenco delle dinamiche escludibili | si | decisione dell'utente, non deduzione |

**Fermarsi e chiedere** se manca un obbligatorio.

## URL matrix

File `docs/migration/url-matrix.csv`, creato e mantenuto da questa skill.

Colonne minime:
`id,url_wp,url_next,tipo,priorita,viewport,stato_auth,incluso,motivo_esclusione,note`

Deve coprire **tutte** queste classi, non solo la home:

- home;
- pagine statiche (tutte quelle dell'inventario, non un campione);
- articoli e post, inclusi i piu' vecchi e i piu' lunghi;
- archivi, categorie, tag, paginazione (prima pagina, una centrale, ultima);
- contenuti di CPT approvati;
- pagina di ricerca: risultati presenti e risultati vuoti;
- pagina 404;
- pagine **non presenti nel menu**;
- pagine protette da password, **solo se autorizzate** dall'utente.

Ogni URL escluso deve avere un `motivo_esclusione` scritto. Una url-matrix con
esclusioni non motivate e' invalida.

## Viewport e ambiente

Documentati in testa a `docs/qa/visual-parity-report.md` e fissati nella
configurazione, non improvvisati a ogni esecuzione:

| Profilo | Larghezza x Altezza | DPR |
|---|---|---|
| desktop | 1440 x 900 | 1 |
| tablet | 768 x 1024 | 2 |
| mobile | 390 x 844 | 3 |

Vanno inoltre registrati: browser e versione Playwright, sistema operativo,
`prefers-color-scheme`, lingua, timezone, e se le animazioni sono disabilitate.
Un confronto tra ambienti diversi non e' una prova: e' rumore.

## Metodo

1. **Baseline** — catturare gli screenshot del sito WordPress sorgente, su tutti i
   viewport, **solo** da fonti legalmente e tecnicamente disponibili all'utente.
   Nessuno scraping di sistemi non autorizzati.
2. **Target** — catturare gli stessi URL sul frontend Next.js, stesso ambiente,
   stessi viewport, con Playwright.
3. **Diff** — confronto per pixel con **soglia esplicita e dichiarata** nel report
   (per esempio: differenza per pixel e percentuale massima di pixel differenti).
   La soglia si decide una volta e si scrive; non si alza per far passare un test.
4. **Triage** — ogni differenza viene classificata, non solo misurata.
5. **Chiusura** — ogni differenza va risolta oppure approvata per iscritto dall'utente.

### Esclusioni

Si possono escludere dal diff soltanto dinamiche **documentate** in
`docs/qa/visual-parity-report.md`: caroselli, date relative, contatori, contenuti
casuali, embed di terze parti. Ogni esclusione richiede selettore, motivo e data.
Nessuna esclusione implicita, nessuna maschera "per far passare il test".

## Cosa verificare oltre al diff

Per ogni URL della matrice, su ogni viewport:

- **Tipografia** — famiglia, peso, dimensione, interlinea, spaziatura, fallback
  e assenza di FOUT/FOIT evidenti.
- **Colori** — testo, sfondi, bordi, stati; nessuna deriva di profilo colore.
- **Spacing** — margini, padding, griglia, allineamenti.
- **Immagini** — presenza, ritaglio, rapporto d'aspetto, `alt`, lazy loading,
  nessun layout shift.
- **Header, footer, menu** — struttura, ordine voci, stato attivo.
- **Hover, focus e stati interattivi** — inclusi focus visibili da tastiera.
- **Breakpoint** — nessuna rottura tra i viewport standard; niente scroll
  orizzontale indesiderato.
- **Form** — campi, label, placeholder, validazione, messaggi di errore.
- **Accessibilita' di base** — gerarchia dei titoli, contrasto, landmark,
  navigazione da tastiera, `lang` corretto.
- **Console e network** — zero errori in console, zero 404 su asset, zero richieste
  fallite. Vanno registrati nel report anche quando il diff visivo e' verde.

## Vincoli e divieti

- Nessuna modifica al sito WordPress sorgente.
- Nessun accesso a sistemi remoti non autorizzati dall'utente.
- Nessuna cattura di pagine protette senza autorizzazione esplicita e registrata.
- Negli screenshot e nel report non devono comparire credenziali, e-mail o nomi di
  persone reali, indirizzi, IBAN, documenti, dati di pagamento o altri dati
  personali: se una pagina li mostra, mascherare l'area prima di archiviare
  l'immagine e annotarlo.
- Nessuna dichiarazione di pixel-perfect senza approvazione scritta dell'utente.
- La soglia di diff non si modifica per chiudere una differenza: si risolve la
  differenza o la si fa approvare.

## Decisioni non definite: grill-me

Eseguire `/grill-me` (skill utente da `mattpocock/skills`) per ogni **trade-off tra
fedelta' al sorgente e cambiamento desiderato**, in particolare:

- differenze che sono in realta' miglioramenti voluti (accessibilita', performance,
  responsive) e che quindi vanno approvate, non "corrette";
- sostituzione di font non licenziabili nel nuovo stack;
- componenti WordPress che nel target hanno comportamento diverso per scelta;
- soglia di diff da adottare per una classe di pagine;
- pagine da escludere dalla matrice.

## Output obbligatori

| Artefatto | Path |
|---|---|
| Matrice URL | `docs/migration/url-matrix.csv` |
| Report di parita' visiva | `docs/qa/visual-parity-report.md` |
| Screenshot baseline, target e diff | `docs/qa/screenshots/` (organizzati per URL e viewport) |
| Configurazione Playwright e soglie | nel repo, referenziata dal report |

Ogni differenza registrata nel report deve avere **tutti** questi campi:

`id, url, viewport, descrizione, causa, severita' (bloccante|maggiore|minore),
evidenza (path screenshot/diff), soluzione proposta, stato (aperta|risolta|approvata),
approvata_da, data`

Una differenza senza causa o senza evidenza e' incompleta e conta come **aperta**.

## Checklist di verifica

- [ ] `url-matrix.csv` esiste e copre tutte le classi elencate sopra
- [ ] Ogni esclusione dalla matrice ha un motivo scritto
- [ ] Viewport, browser, DPR e ambiente documentati nel report
- [ ] Baseline catturate da fonti autorizzate
- [ ] Screenshot target catturati nello stesso ambiente delle baseline
- [ ] Soglia di diff dichiarata esplicitamente e invariata durante la sessione
- [ ] Esclusioni dinamiche documentate con selettore e motivo
- [ ] Tipografia, colori, spacing, immagini verificati
- [ ] Header, footer, menu, hover e focus verificati
- [ ] Breakpoint verificati; nessuno scroll orizzontale indesiderato
- [ ] Form verificati, inclusi stati di errore
- [ ] Accessibilita' di base verificata
- [ ] Zero errori in console e zero richieste di rete fallite, per ogni URL
- [ ] Ogni differenza registrata con URL, viewport, causa, severita', evidenza
- [ ] Nessuna differenza `bloccante` o `maggiore` in stato `aperta`
- [ ] Differenze accettate marcate `approvata` con nome del ruolo e data
- [ ] Nessun dato personale visibile negli screenshot archiviati
- [ ] Report rigenerato dopo l'ultima modifica al frontend

## Condizioni di stop

Fermarsi **subito** e chiedere quando:

- il sito sorgente non e' raggiungibile e non esistono baseline;
- si dovrebbero catturare pagine protette senza autorizzazione;
- uno screenshot espone dati personali e non e' chiaro come mascherarli;
- una differenza e' in realta' una decisione di prodotto: usare `/grill-me`;
- l'utente chiede di dichiarare pixel-perfect con differenze ancora aperte:
  rifiutare, elencare le differenze aperte, chiedere approvazione esplicita voce per voce;
- l'utente chiede staging, produzione o fase gestionale con il report non chiuso:
  citare il gate e passare la palla a `deployment-gate`.

**Mai** scrivere "pixel-perfect", "parita' raggiunta" o equivalenti finche' esiste
una differenza in stato `aperta`.

## Formato della risposta

1. **Verdetto** — `PARITA' NON RAGGIUNTA` / `PARITA' RAGGIUNTA, IN ATTESA DI
   APPROVAZIONE` / `PARITA' APPROVATA DALL'UTENTE`.
2. **Copertura** — URL in matrice, URL confrontati, viewport, soglia usata.
3. **Differenze** — tabella: id, url, viewport, severita', stato.
4. **Bloccanti** — elenco delle sole differenze che impediscono il verdetto positivo.
5. **Artefatti** — path di report, matrice e cartella screenshot.
6. **Decisioni da prendere** — numerate, con opzioni e raccomandazione; se maggiori
   di zero, proporre `/grill-me`.
7. **Prossimo passo proposto** — uno solo, poi attendere conferma.
