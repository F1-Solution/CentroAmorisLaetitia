# Specifica dell'importer — Fase 1B, wave `1B-W4`

Programma a riga di comando che porta la sorgente WordPress congelata dentro
PostgreSQL e nello storage a oggetti.

| | |
|---|---|
| **Stato** | **proposta** — si realizza in Fase 1D, dopo l'approvazione delle ADR |
| **Collocazione** | `apps/importer` (ADR-008 §3.1) |
| **Sorgente** | `source-private/BackupDB-2026-09-13/` e `source-private/wordpress-2026-09-13/`, **sola lettura** |
| **Destinazione** | PostgreSQL (`schema.sql`) e bucket S3-compatible (ADR-004) |
| **Mapping** | [`wp-to-postgres-mapping.md`](wp-to-postgres-mapping.md) |

---

## 1. La domanda a cui questa specifica deve rispondere

> **Che cosa succede se eseguo l'import due volte di fila?**

Risposta: **nulla di diverso dalla prima volta.** Il secondo passaggio non crea
duplicati, non azzera contenuti, non riscrive ciò che non è cambiato, e termina con
lo stesso rapporto di conteggi.

Non è un dettaglio di eleganza. Con un team di una persona, un import che non si può
ripetere è un import che si eseguirà male sotto pressione, la sera prima del
passaggio in produzione, e non si potrà correggere.

## 2. Principi

| # | Principio | Perché |
|---|---|---|
| 1 | **Idempotenza** | Rieseguibile a piacere. La chiave è `import_id_map` |
| 2 | **Dry-run predefinito** | L'esecuzione senza argomenti **non scrive nulla**. Serve `--apply` per scrivere |
| 3 | **La sorgente non si tocca mai** | Sola lettura. Nessun file, nessuna riga modificata (DR-011) |
| 4 | **Le anomalie si contano, non si ignorano** | Ogni caso non gestito diventa una riga in `import_issues` |
| 5 | **Si ferma presto su ciò che è strutturale** | Una chiave meta sconosciuta è un errore, non un avviso |
| 6 | **Nessun dato personale esce dal database** | Log, rapporti e messaggi di errore contengono identificatori, mai contenuti |
| 7 | **Deterministico** | Stessa sorgente, stesso risultato. Nessun identificatore casuale non tracciato |

## 3. Interfaccia a riga di comando

```
importer plan                    # esegue tutto senza scrivere, produce il rapporto
importer apply --confirm         # scrive. Richiede conferma esplicita
importer verify                  # solo controlli, senza leggere la sorgente
importer report --run <id>       # ristampa il rapporto di un'esecuzione
importer rollback --run <id>     # annulla un'esecuzione, vedi §9
```

Opzioni comuni: `--stage <nome>` per eseguire una sola fase, `--only <tipo>` per
limitare a un tipo di contenuto, `--verbose`.

**`apply` senza `--confirm` non scrive.** È la stessa logica delle conferme
obbligatorie di `CLAUDE.md`: una scrittura su dati reali non parte per inerzia.

## 4. Fasi, in ordine obbligato

L'ordine non è una preferenza: ogni fase dipende dagli identificatori prodotta dalla
precedente.

| # | Fase | Produce | Dipende da |
|---|---|---|---|
| 0 | `preflight` | verifiche preliminari, §5 | — |
| 1 | `settings` | `settings`, `seo_templates` | 0 |
| 2 | `users` | `users`, `roles`, `permissions` | 0 |
| 3 | `media` | `media`, `media_variants`, oggetti nel bucket | 2 |
| 4 | `terms` | `terms` | 0 |
| 5 | `contents` | `contents` con blocchi convertiti | 3, 4 |
| 6 | `relations` | `content_terms`, `contents.featured_media_id`, `contents.parent_id`, `contents.path` | 5 |
| 7 | `menus` | `menus`, `menu_items` | 5, 4 |
| 8 | `seo` | `content_seo`, `term_seo` | 5 |
| 9 | `documents` | `documents`, `document_terms` | 3, 4 |
| 10 | `sliders` | `sliders`, `slider_slides` | 3 |
| 11 | `forms` | `forms`, `form_notifications` | 0 |
| 12 | `submissions` | `form_submissions` | 11 |
| 13 | `legacy` | `legacy_email_log`, `legacy_download_stats` | 0 |
| 14 | `redirects` | `redirects` — 180 righe | 5, 3, 9 |
| 15 | `rewrite` | riscrittura dei riferimenti ai media nei blocchi | 5, 3 |
| 16 | `verify` | rapporto finale, §8 | tutte |

### 4.1 Perché `rewrite` è una fase a sé

ADR-004 §3.3 impone che la riscrittura dei riferimenti da
`/wp-content/uploads/` a `/media/` avvenga **in un punto solo**. Farla dentro il
convertitore dei blocchi la disperderebbe fra i tipi di blocco, e un riferimento
sfuggito diventerebbe un'immagine mancante difficile da rintracciare.

Come fase separata, applicata dopo, ha un unico punto di verifica: al termine,
**zero** occorrenze della stringa `wp-content/uploads` in `contents.blocks`,
`content_html`, `slider_slides` e `settings`. Se non è zero, la fase fallisce.

## 5. Preflight — controlli prima di toccare qualsiasi cosa

Se uno solo fallisce, l'importer **non parte**.

| # | Controllo | Se fallisce |
|---|---|---|
| 1 | Il dump esiste, è leggibile, l'impronta coincide con quella registrata | la sorgente non è quella congelata |
| 2 | Le 53 tabelle attese esistono nella sorgente | la sorgente è cambiata: il mapping va rivisto |
| 3 | **Le chiavi meta distinte sono tutte classificate** nel mapping §4.1 o §4.2 | chiave sconosciuta: il mapping è incompleto |
| 4 | I `post_type` distinti sono tutti classificati nel mapping §2 | idem |
| 5 | Lo schema di destinazione è alla versione di migrazione attesa | disallineamento fra codice e database |
| 6 | Lo storage a oggetti è raggiungibile e i due bucket esistono | configurazione incompleta |
| 7 | La cartella `uploads` è leggibile e contiene il numero atteso di file | sorgente incompleta |
| 8 | Nessuna delle esecuzioni precedenti è rimasta aperta | esecuzione interrotta da riprendere |

Il controllo 3 è quello che protegge davvero: **una chiave meta comparsa e non
classificata è un dato che si sta per perdere in silenzio.** È esattamente la classe
di errore che una migrazione non si accorge di commettere.

## 6. Come si ottiene l'idempotenza

### 6.1 La tabella delle corrispondenze

Ogni entità importata lascia una riga in `import_id_map`:

```
(source_table, source_id, entity) -> entity_id
```

Alla riesecuzione, l'importer cerca prima qui. Se trova la corrispondenza
**aggiorna** l'entità esistente; se non la trova, la crea. Gli identificatori UUID
non vengono mai riassegnati.

### 6.2 Comportamento per tipo di dato

| Dato | Alla riesecuzione |
|---|---|
| Contenuti, media, termini, menu, form, documenti, carosello | **aggiornati sul posto**. L'identificatore resta |
| Blocchi di un contenuto | rigenerati dalla sorgente. **Qui sta il rischio**, vedi §6.3 |
| File nel bucket | caricati solo se il checksum differisce |
| Compilazioni dei form | **mai aggiornate**: sono un fatto storico. Si inseriscono solo se assenti |
| Redirect di origine `migration` | ricalcolati |
| Redirect di origine `manual` | **mai toccati** |
| Righe `legacy_*` | solo inserimento, mai aggiornamento |
| Sessioni, audit log, cronologia dei contenuti | **mai toccati** dall'importer |

### 6.3 Il rischio vero della riesecuzione, e come si evita

Se un redattore modifica una pagina nel CMS e poi l'import viene rieseguito, la
modifica verrebbe **sovrascritta** dai blocchi ricostruiti dalla sorgente.

Tre protezioni:

1. `contents` ha una traccia dell'ultima modifica redazionale. Se un contenuto è
   stato modificato **dopo** l'ultima esecuzione riuscita, l'importer **non lo
   sovrascrive**: registra un `import_issues` di gravità `warning` e prosegue.
2. `--force-content <id>` sovrascrive comunque, un contenuto per volta, esplicitamente.
3. Il rapporto elenca in testa i contenuti saltati per questo motivo.

Va detto chiaramente, perché è il momento in cui una migrazione distrugge lavoro
vero: **l'import non è un'operazione innocua dopo che qualcuno ha iniziato a
usare il CMS.** Le protezioni servono a renderlo prevedibile, non a renderlo gratuito.

## 7. Transazioni e isolamento degli errori

| Livello | Comportamento |
|---|---|
| **Fase** | ogni fase è una transazione. Se fallisce, si annulla per intero e le fasi precedenti restano |
| **Elemento** | dentro una fase, l'errore su un singolo elemento **non** interrompe la fase: produce una riga `import_issues` di gravità `error` e la fase prosegue |
| **Esecuzione** | al termine, se esiste anche solo una riga `error`, l'esito è `partial` e **non** `success` |
| **File** | il caricamento nel bucket avviene **prima** della scrittura della riga in `media`. Un file caricato senza riga è recuperabile; una riga senza file è un collegamento rotto |

L'isolamento per elemento è deliberato: con 108 contenuti da convertire, fermarsi al
primo problema significherebbe scoprire gli altri uno alla volta, in giorni diversi.
Meglio un elenco completo di ciò che non ha funzionato.

## 8. Rapporto di import

Prodotto sempre, anche in `plan`. Due forme: leggibile a terminale e JSON in
`import_runs.summary`.

### 8.1 Contenuto

```
IMPORT — esecuzione <uuid>            plan | apply
sorgente: BackupDB-2026-09-13        importer 0.1.0
─────────────────────────────────────────────────────────
FASE               ATTESI  CREATI  AGGIORNATI  SALTATI  ERRORI
settings               18      18           0        0       0
users                   1       1           0        0       0
media                 170     170           0        0       0
media_variants      ~1376    1376           0        0       0
terms                   3       3           0        0       0
contents              108     108           0        0       0
menu_items             64      64           0        0       0
forms                  25      25           0        0       0
form_submissions      425     425           0        0       0
documents               8       8           0        0       0
slider_slides          12      12           0        0       0
redirects             180     180           0        0       0
─────────────────────────────────────────────────────────
CONVERSIONE DEI CONTENUTI
  gutenberg  57    divi  47    html  4
  blocchi prodotti           <n>
  blocchi di riserva 'html'  <n>  ( <p>% )   soglia: 10%
  contenuti con riserva      <n>  / 108      soglia: 15
VERIFICHE
  riferimenti 'wp-content/uploads' rimasti      0   atteso 0
  file nel bucket / file attesi                 ...
  checksum non corrispondenti                   0   atteso 0
  media referenziati e mancanti                 0   atteso 0
  voci di menu che puntano nel vuoto            0   atteso 0
  redirect che puntano a un 404                 0   atteso 0
  contenuti senza percorso                      0   atteso 0
  chiavi meta non classificate                  0   atteso 0
ESITO: success | partial | failed
```

### 8.2 I numeri attesi non sono decorativi

Sono presi da `database-schema.md` §6 e scritti nel codice. **Se un conteggio non
coincide, l'esito non è `success`**, anche se nessuna riga ha prodotto un errore.
Un import che crea 106 contenuti invece di 108 e si dichiara riuscito è peggio di
uno che fallisce.

### 8.3 Il rapporto non contiene dati personali

Conteggi, identificatori, percorsi. Mai nomi, mai indirizzi email, mai contenuti di
compilazioni. Il rapporto verrà letto e forse incollato: deve essere sicuro da
incollare.

## 9. Rientro

| Situazione | Rientro |
|---|---|
| Fase fallita | annullata dalla propria transazione. Si corregge e si rilancia quella fase |
| Esecuzione da annullare interamente | `rollback --run <id>`: cancella le entità create da quella esecuzione, risalendo `import_id_map`, in ordine inverso alle fasi |
| Esecuzione già seguita da lavoro redazionale | `rollback` **rifiuta di procedere** e dice quali contenuti sono stati modificati dopo |
| Database da riportare a zero | ripristino del backup. È la strada più rapida e la più sicura |

`rollback` **non** tocca: righe modificate dopo l'import, redirect manuali, audit
log. Il registro di ciò che è accaduto resta.

## 10. Prestazioni attese

1.546 file, 108 contenuti, 425 compilazioni. Obiettivo: **meno di dieci minuti** su
una macchina di sviluppo, con il caricamento dei file che domina il tempo.

Non serve parallelismo spinto: serve poterlo rieseguire senza pensarci. A questi
volumi sono la stessa cosa.

## 11. Test

| Livello | Che cosa prova |
|---|---|
| Unitari | il convertitore da Divi a blocchi; il convertitore da Gutenberg a blocchi; la riscrittura dei riferimenti; il calcolo dei percorsi; la traduzione della visibilità delle voci di menu |
| Di integrazione | l'import completo su un **sottoinsieme sintetico** della sorgente, su PostgreSQL reale |
| Di idempotenza | due esecuzioni di fila producono lo stesso stato. È il test che questa specifica esiste per rendere possibile |
| Di andata e ritorno | ADR-006 §7: aprire e salvare senza modifiche non cambia nulla |
| Su dati reali | eseguiti **solo in locale**, mai in CI, mai con esiti riportati in documentazione o in Git (DR-010) |

Il test di idempotenza è il criterio di accettazione di questa wave. Si scrive
così: eseguire `apply`, fotografare lo stato del database escludendo le marche
temporali, eseguire di nuovo `apply`, confrontare. Devono coincidere.

## 12. Ciò che l'importer **non** fa

| Non fa | Perché |
|---|---|
| Non bonifica i dati personali | DR-026: si importa tutto senza bonifica. La bonifica richiede validazione legale (MI-06) |
| Non rigenera le immagini | ADR-004 §3.2: cambierebbero peso e compressione, e la parità con esse |
| Non converte in WebP | RC-08 vale **dopo** l'approvazione della parità |
| Non importa le 837 revisioni | ADR-005 §3.7 |
| Non importa le password | non riutilizzabili, e non si importano per principio |
| Non crea contenuti che la sorgente non ha | nessuna pagina «blog», nessuna pagina inventata |
| Non invia email | l'invio richiede conferma esplicita (ADR-010 §4.5) |
| Non tocca `source-private/` | DR-011 |

## 13. Il delta prima della produzione

La sorgente è congelata al 2026-09-13; il sito resta vivo (R-15). Prima del
passaggio serve un backup aggiornato (MI-07) e un import del differenziale.

Non serve un programma diverso: **è lo stesso importer, rieseguito su una sorgente
più recente.** È la ragione per cui l'idempotenza è il primo principio di questa
specifica e non l'ultimo.

Il delta seguirà le regole del §6.3: i contenuti modificati nel CMS non vengono
sovrascritti, e il rapporto elenca ogni caso in cui sorgente e CMS sono stati
modificati entrambi. Quei casi li decide l'utente, uno per uno.

## 14. Criteri di accettazione della wave 1D

1. `plan` non scrive nulla, dimostrato confrontando il database prima e dopo.
2. `apply` due volte di fila produce lo stesso stato.
3. Tutti i conteggi attesi coincidono.
4. Zero riferimenti `wp-content/uploads` rimasti.
5. Zero righe `error` in `import_issues`.
6. Le soglie sui blocchi di riserva (ADR-005 §3.4) sono rispettate.
7. Il rapporto non contiene alcun dato personale.
8. `rollback` riporta il database allo stato precedente, dimostrato.
