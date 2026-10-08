# Rapporto di completezza dell'import — `1D-W11`

Import reale **in locale** della sorgente `BackupDB-2026-09-13`, eseguito il
2026-10-04 su conferma di DR-072 (HO-008). Il documento contiene **soli
conteggi**: nessuna riga di dato, nessun titolo, nessun indirizzo, nessun nome
di file (RD-12, `W11-PLAN.md` §5).

| Voce | Valore |
|---|---|
| Database | `amoris` locale, ricreato vuoto e migrato (DR-086) |
| Copia di salvataggio prima dell'import | `~/amoris-backup/amoris-prima-1D-W11c-2026-10-04.dump`, fuori dal repository |
| Prima esecuzione | `85369f32-06b5-4b98-99ac-498666a0c6f4` — esito **`success`** |
| Seconda esecuzione | `c64041ec-fdad-4f75-933d-771029c75004` — esito **`success`** |
| Importer | 0.1.0, commit `4aa0799` |
| Controlli preliminari | 8 su 8 superati in entrambe |

## 1. Conteggi, atteso contro ottenuto

Atteso da `database-schema.md` §6 e `W11-PLAN.md` §4. Ottenuto contando le
tabelle dopo ciascuna esecuzione.

| Tabella | Atteso | Prima | Seconda | Esito |
|---|---|---|---|---|
| `contents` | 108 | 108 | 108 | coincide |
| `media` | 178 | 178 | 178 | coincide (174 pubblici, 4 riservati) |
| `media_variants` | circa 1.376 | 1.287 | 1.287 | scostamento motivato, §2.1 |
| `terms` | 4 | 4 | 4 | coincide |
| `menu_items` | 64 | 64 | 64 | coincide |
| `redirects` | 181 | 181 | 181 | coincide |
| `forms` | 25 | 25 | 25 | coincide |
| `form_notifications` | 39 | 39 | 39 | coincide |
| `form_submissions` | 425 | 425 | 425 | coincide |
| `documents` | 8 | 8 | 8 | coincide |
| `slider_slides` | 12 | 12 | 12 | coincide |
| `users` | 1 | 1 | 1 | coincide |
| `seo_templates` | circa 7 | 6 | 6 | scostamento motivato, §2.2 |
| `content_seo` | 2 | 2 | 2 | coincide |
| `settings` | 15 | 15 | 15 | coincide |

Altre tabelle popolate, senza un atteso dichiarato: `menus` 1, `sliders` 1,
`content_terms` 30, `legacy_email_log` 187, `import_id_map` 402.

## 2. Scostamenti e motivo

### 2.1 `media_variants`: 1.287 invece di circa 1.376

L'atteso è una **stima** dichiarata come tale (`wp-to-postgres-mapping.md`
§3.4) e non entra nella verifica. Nessuna misura derivata citata dai metadati
manca sul disco: l'import non ha registrato alcun file mancante, e la verifica
«file nel bucket / file attesi» dà 0. In più, 7 misure derivate sono condivise
da due allegati e producono una sola riga: per questo la fase riporta 1.287
create e 7 aggiornate.

### 2.2 `seo_templates`: 6 invece di circa 7

Si importano i sei ambiti di `wp-to-postgres-mapping.md` §6.3 (pagina
iniziale, pagina, articolo, categoria, allegato, ricerca). Il settimo elemento
della tabella, il **suffisso di paginazione**, non si importa perché è in
inglese su un sito italiano, e DR-040 (D13) ha deciso di correggere i metadati
non visibili invece di riprodurne i difetti. Non ha una colonna propria in
`seo_templates`: la sua resa in italiano spetta alla Fase 1E.

### 2.3 `redirects`: 181, e 1 regola scartata

L'atteso è passato da 180 a 181 il 2026-09-30, conseguenza di DR-065
(`W11-PLAN.md` §4). La riga scartata è la settima di `_wp_old_slug`, che
riguarda un modulo senza indirizzo pubblico: si scarta come previsto da
`wp-to-postgres-mapping.md` §3.3.

## 3. Conversione dei contenuti

| Voce | Valore |
|---|---|
| Contenuti per famiglia | Gutenberg 64, Divi 40, HTML 4 |
| Blocchi prodotti, contenitori compresi | 577 |
| Blocchi esclusi i contenitori | 305 |
| Blocchi di riserva `html` | 8 su 305 = **2,62 %**, soglia 10 % |
| Contenuti con almeno un blocco di riserva | **5 su 108**, soglia 15 |
| Blocchi di riserva per motivo | blocco HTML di WordPress 6, modulo Divi non mappato 1, markup Divi non mappato 1 |

La percentuale si calcola sui blocchi esclusi i contenitori, come prescrive
`BLOCK-MODEL.md` §8: è la ragione per cui 8 su 577 non dà 2,62 %. Coincide con
la misura della `1D-W10`.

## 4. Verifiche finali

Tutte e otto **eseguite** e a 0 in entrambe le esecuzioni:

| Verifica | Valore |
|---|---|
| riferimenti `wp-content/uploads` rimasti | 0 |
| file nel bucket / file attesi | 0 |
| checksum non corrispondenti | 0 |
| media referenziati e mancanti | 0 |
| voci di menu che puntano nel vuoto | 0 |
| redirect che puntano a un 404 | 0 |
| contenuti senza percorso | 0 |
| chiavi meta non classificate | 0 |

## 5. Anomalie registrate

Solo avvisi, nessun errore. 13 per esecuzione, le stesse nelle due:

| Codice | Quante | Motivo |
|---|---|---|
| `content-path-provisional` | 2 | i due contenuti di DR-063 e DR-064, tenuti in bozza al percorso provvisorio per decisione |
| `source-file-case-mismatch` | 10 | un allegato e le sue nove misure derivate, ritrovati senza distinguere maiuscole e minuscole (DR-065) |
| `redirect-unresolved-target` | 1 | la regola scartata del §2.3 |

## 6. Idempotenza

La seconda esecuzione non ha creato nulla in nessuna fase, e tutte le tabelle
di dominio sono identiche alla prima. Le 425 compilazioni sono state saltate,
non riscritte. Nessun contenuto è stato preso per lavoro redazionale: la
protezione confronta ore dello stesso orologio (DR-090, DR-091).

## 7. Archiviazione dei file

| Bucket | Oggetti | Composizione |
|---|---|---|
| pubblico | 1.471 | 174 originali, 1.287 misure derivate, 10 oggetti del seme sintetico che precedono l'import (DR-092) |
| riservato | 4 | i 4 documenti riservati |

## 8. Via di ritorno

- Il piano di annullamento della seconda esecuzione non cancella nulla, perché
  quell'esecuzione non ha creato nulla; quello della prima è **rifiutato**,
  perché la seconda ne ha sovrascritto la traccia (`importer-spec.md` §9).
- La via di ritorno reale è il **ripristino della copia** con `pg_restore`. I
  file caricati nel bucket non tornerebbero indietro con il database: vanno
  rimossi a parte.

## 9. Che cosa questo rapporto non dichiara

- **Dati personali in locale.** Il database contiene 425 compilazioni reali e
  187 destinatari del registro storico delle email (DR-073). Ricreare il volume
  o riseminare il database non sono più operazioni indolori.
- **Nessuna conformità.** Cifratura a riposo, tempi di conservazione e
  procedura di cancellazione non sono validati (`database-schema.md` §7 regola
  5). **MI-06**, la verifica privacy e legale, resta aperta e richiede un
  professionista.
- **Nessuna parità visiva.** Il rapporto dice che i dati sono arrivati, non che
  il sito li mostri come l'originale: quello è la Fase 1E.

## 10. Riesecuzioni del 2026-10-07 — `1D-W11e`

Riesecuzioni sullo stesso database, dopo il form del modulo di contatto di Divi
(DR-094) e la sua notifica (DR-098). Soli conteggi, come sopra.

| Voce | Valore |
|---|---|
| Copie prima delle riesecuzioni | `~/amoris-backup/amoris-prima-1D-W11e-2026-10-07.dump` e `amoris-prima-1D-W11e-bis-2026-10-07.dump`, fuori dal repository |
| Terza esecuzione | `4bd72eb6-293d-4858-aabe-aa83594fdede` — esito **`partial`**: un solo errore, `users` 2 contro 1 atteso, perché contava anche l'account locale di HO-009 |
| Quarta esecuzione | `84755272-f5d3-43ef-945d-ce14ac561982` — esito **`success`**, dopo DR-099: i volumi contano solo le righe nate dall'import |
| Controlli preliminari | 8 su 8 superati in entrambe |

- **Conteggi di tabella dopo la quarta esecuzione:** identici alla terza;
  `forms` 26 e `form_notifications` 40 come atteso dopo DR-094 e DR-098;
  `users` 2 nella tabella, 1 dell'import.
- **Quarta esecuzione:** nessuna creazione, tutte le righe aggiornate sul
  posto, 425 compilazioni saltate perché già presenti; verifiche finali tutte a 0.
- **Anomalie:** le stesse avvertenze della terza (2 percorsi provvisori, 1
  redirect senza destinazione, 10 file con maiuscole diverse); scompare il solo
  errore `table-count-mismatch`.
