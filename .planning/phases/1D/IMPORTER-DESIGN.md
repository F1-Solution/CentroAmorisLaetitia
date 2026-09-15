# IMPORTER-DESIGN — Fase 1D · Come si realizza l'importer

`docs/migration/importer-spec.md` resta **la specifica**: dice che cosa l'importer
deve fare. Questo documento dice **come**, e prende le decisioni che la specifica
lascia aperte.

| | |
|---|---|
| **Stato** | proposta di attuazione. Non modifica la specifica: la completa dove tace |
| **Collocazione** | `apps/importer` (ADR-008 §3.1) |
| **Attuazione** | wave `1D-W2`, `1D-W4`, `1D-W5` |
| **Sorgente** | `source-private/BackupDB-2026-09-13/` e `source-private/wordpress-2026-09-13/`, **sola lettura** (DR-011) |

---

## 1. I tre vincoli che decidono tutto il resto

| # | Vincolo | Fonte |
|---|---|---|
| 1 | **Deterministico**: stessa sorgente, stesso risultato. Nessun identificatore casuale non tracciato | `importer-spec.md` §2 principio 7 |
| 2 | **Idempotente**: eseguirlo due volte non cambia nulla rispetto alla prima | §1, §2 principio 1 |
| 3 | **Nessun dato personale** esce dal database: log, rapporti e messaggi di errore contengono identificatori, mai contenuti | §2 principio 6, §8.3 |

Ogni scelta di questo documento si giustifica su uno di questi tre.

## 2. Struttura dei moduli

```
apps/importer/
  src/
    cli/            interpreta gli argomenti, sceglie il comando, stampa il rapporto
    runtime/        configurazione validata con Zod, connessioni, registro senza dati personali
    source/
      sql/          tokenizzatore del dump, lettura per tabella
      php/          lettore del formato serializzato di PHP
      files/        albero di uploads/, checksum, esclusioni di ADR-004 §3.2
      index.ts      SourceReader: la sola interfaccia con cui il resto vede la sorgente
    preflight/      gli 8 controlli di importer-spec.md §5
    persistence/    import_runs, import_id_map, import_issues, transazioni, savepoint
    stages/         una cartella per fase, 17 in tutto, piu il registro delle dipendenze
    convert/        gutenberg/, divi/, html/, shared/ — i convertitori
    rewrite/        la fase 15: una regola sola, un punto solo
    verify/         la fase 16: i controlli finali e i conteggi attesi
    rollback/       il rientro di importer-spec.md §9
    report/         forma testuale e forma JSON del rapporto
  tests/
    fixtures/       sorgenti SINTETICHE, versionate
    real/           test su dati reali: NON versionati, NON in CI
```

| Modulo | Responsabilità | Che cosa **non** fa |
|---|---|---|
| `cli` | tradurre argomenti in un piano di esecuzione; chiedere `--confirm`; stampare | non conosce le tabelle né i blocchi |
| `runtime` | validare la configurazione all'avvio (ADR-009 §4.3); aprire le due connessioni del §5.3; offrire un registro che accetta solo identificatori | non scrive nulla di applicativo |
| `source` | leggere. È l'**unico** modulo che tocca `source-private/`, e la tocca in sola lettura | non converte, non normalizza, non riscrive |
| `preflight` | far fallire presto | non corregge nulla |
| `persistence` | transazioni, savepoint, corrispondenze, anomalie | non conosce il dominio |
| `stages` | una fase ciascuno, con il contratto del §4 | non chiamano altre fasi |
| `convert` | da sorgente a documento a blocchi valido secondo `@amoris/blocks` | **non riscrive i riferimenti ai media**: è la fase 15 (ADR-004 §3.3) |
| `rewrite` | la riscrittura, in un punto solo | non converte |
| `verify` | confrontare i conteggi con quelli attesi e decidere l'esito | non ripara |
| `rollback` | disfare ciò che una esecuzione ha creato | non ricostruisce ciò che ha aggiornato: §7 |
| `report` | produrre due forme dello stesso oggetto | non legge il database: riceve i conteggi |

**Dove stanno i convertitori, e perché non in `packages/blocks`.** I convertitori
dipendono da `@amoris/blocks` per schemi, sanificatore e serializzatore, ma vivono
dentro `apps/importer`. Il motivo è concreto: `packages/blocks` è importato da
`apps/web` e `apps/admin` (ADR-008 §3.1), e nessuna delle due deve portarsi dietro un
analizzatore di shortcode Divi. La conversione è codice di migrazione, e la migrazione
finisce; il modello resta.

## 3. Come si legge il dump

### 3.1 Che cos'è davvero, misurato

| Dato | Valore |
|---|---|
| File | `source-private/BackupDB-2026-09-13/Sql1138799_1.sql` |
| Dimensione | 11.559.721 byte |
| Righe | 16.892 |
| `CREATE TABLE` | 53 |
| `INSERT INTO` | 169 — estesi, multi-riga |
| Riga piu lunga | 1.738.438 caratteri |
| Produttore dichiarato | BackWPup 5.7.6 |
| Prefisso | `wp_` · `SET NAMES utf8mb4` |
| Motori | 52 `MyISAM`, 1 `InnoDB` |
| Charset dichiarati | 32 `CHARSET=utf8`, 21 `CHARSET=utf8mb4` |

La **versione del server MySQL non è dichiarata** nell'intestazione. I marcatori
condizionali del file (`/*!40101`, `/*!40103`, `/*!40014`) indicano compatibilita con
MySQL 4.1 e successivi, e non dicono di piu. Non la si assume.

Due conseguenze immediate: 11,5 MB stanno comodamente in memoria, quindi la scelta non
si gioca sulle prestazioni; e un lettore riga per riga **non basta**, perche una sola
riga arriva a 1,7 MB e contiene centinaia di tuple.

### 3.2 Le tre strade

| | Strada | Determinismo | Ripetibilita | Dipendenze |
|---|---|---|---|---|
| **a** | Analizzare il testo SQL direttamente in TypeScript | pieno: funzione pura dei byte del file | piena: gira ovunque, anche in CI sulle fixture sintetiche | **nessuna** in piu, oltre a codice nostro |
| **b** | Caricare il dump in un MySQL usa e getta in container e leggerlo con un client | pieno sul risultato, ma dipende dalla versione dell'immagine e dalla sua configurazione | in locale si; **in CI no**, perche in CI non esiste la sorgente | un'immagine MySQL, un client `mysql2`, Docker obbligatorio per l'import |
| **c** | Una conversione intermedia, per esempio in NDJSON, e poi si legge quella | pieno, ma sposta il problema: qualcuno deve produrre l'intermedio, e con quale strumento | l'intermedio puo restare indietro rispetto alla sorgente | dipende da come si produce l'intermedio |

### 3.3 La scelta: **(a)**, analizzare il testo in TypeScript

I motivi, in ordine di peso.

1. **È l'unica strada che gira in CI.** I test su dati reali non entrano mai in CI
   (DR-010, `importer-spec.md` §11). Con la strada (a), il codice che legge la
   sorgente è lo **stesso** che in CI legge dump sintetici, quindi viene esercitato a
   ogni modifica. Con la strada (b), il percorso che legge da MySQL verrebbe eseguito
   solo in locale, a mano: sarebbe il pezzo piu delicato e il meno provato.
2. **Determinismo senza intermediari.** La lettura diventa una funzione pura dai byte
   del file alle righe. Nessuna versione di server, nessuna configurazione di charset,
   nessun fuso orario di connessione fra la sorgente e noi.
3. **Nessuna dipendenza in piu.** Il vincolo di `CLAUDE.md` non è formale: ogni
   pacchetto va mantenuto da una persona sola.
4. La strada (c) somma i difetti delle altre due senza aggiungere pregi: per produrre
   l'intermedio serve comunque (a) o (b), e in piu si ottiene un file che puo restare
   indietro.

### 3.4 Perché DR-002 non basta a decidere, e perché va detto

DR-002 vieta «nessuna dipendenza WordPress/PHP/MySQL/MariaDB **a runtime**». Uno
strumento di sola migrazione, eseguito in locale e mai in produzione, **non è
runtime**: la strada (b) non sarebbe una violazione di DR-002.

Va detto esplicitamente perché la tentazione opposta è forte: dichiarare (b) vietata da
DR-002 sarebbe comodo e sbagliato. La strada (b) è scartata per i motivi del §3.3, non
per divieto. Resta però vero che introdurrebbe una dipendenza che **nessuna ADR
autorizza**, e quindi non si adotta senza chiederlo.

### 3.5 Che cosa si fa se la strada (a) non regge

Il rischio reale è RD-02: una sequenza di escape interpretata male fa perdere o
corrompere righe **in silenzio**. La verifica è nel §3.7. Se fallisce, il rientro è
dichiarato adesso e non improvvisato allora:

> Si porta all'utente la strada (b) come **decisione**, con la misura di che cosa non
> ha funzionato. Comporta: un'immagine MySQL con versione fissata, un client nel
> `package.json` di `apps/importer`, Docker obbligatorio per eseguire l'import, e un
> percorso di lettura che la CI non esercita. È la conferma numero 5 del §7 di
> [`PLAN.md`](PLAN.md).

### 3.6 Il tokenizzatore, in concreto

Legge il file per intero in memoria e lo scorre **per istruzione**, non per riga.

| Che cosa riconosce | Trattamento |
|---|---|
| Commenti `-- …` e `/* … */` | saltati |
| Direttive condizionali `/*!… */;` | saltate: nessuna ha effetto sui dati |
| `DROP TABLE`, `LOCK TABLES`, `UNLOCK TABLES`, `SET …` | saltate |
| `CREATE TABLE \`nome\` ( … ) ENGINE=…;` | da qui si ricavano **nome della tabella e ordine delle colonne**, che servono a dare un nome ai valori degli `INSERT` |
| `INSERT INTO \`nome\` VALUES (…),(…),…;` | ogni tupla diventa un oggetto con le colonne del `CREATE TABLE` |
| `INSERT INTO \`nome\` (\`a\`,\`b\`) VALUES …` | forma con elenco esplicito: si usa quello, non l'ordine del `CREATE TABLE` |

Dentro una tupla riconosce quattro forme di valore: `NULL`; un numero; una stringa fra
apici singoli; un letterale esadecimale `0x…`.

Le sequenze di escape dentro una stringa, che sono la parte che sbaglia chi la sbaglia:

```
\0 \' \" \b \n \r \t \Z \\ \% \_      e la coppia ''  (apice raddoppiato)
```

`\%` e `\_` si conservano **come due caratteri**, perche in MySQL mantengono la barra
fuori dai contesti `LIKE`: convertirli in `%` e `_` cambierebbe il dato. È il caso che
distingue un tokenizzatore scritto con attenzione da uno scritto a memoria.

Il testo è decodificato come UTF-8. Le 32 tabelle dichiarate `CHARSET=utf8` sono, in
MySQL, UTF-8 a tre byte: un sottoinsieme di `utf8mb4`, quindi la decodifica è la stessa
e non serve un trattamento diverso. Se comparisse una sequenza non valida, il byte
diventa il carattere di sostituzione e si produce una riga `import_issues` di gravita
`warning` con tabella, colonna e identificatore — **mai il valore**.

### 3.7 Come si prova che il tokenizzatore non perde nulla

| # | Prova | Dove gira |
|---|---|---|
| 1 | Un dump **sintetico** che contiene tutte le sequenze di escape del §3.6, apici raddoppiati, letterali esadecimali, `NULL`, stringhe vuote, caratteri non ASCII, emoji a quattro byte | CI |
| 2 | Andata e ritorno: si genera un dump da valori noti, lo si legge, si confrontano i valori | CI |
| 3 | Numero di tabelle lette dal dump vero: deve essere **53** (`wp-to-postgres-mapping.md` §1) | locale |
| 4 | Conteggio delle righe per tabella confrontato con i volumi gia misurati in 1A e 1B: 78 `page`, 29+1+1 `post`, 170 `attachment`, 64 `nav_menu_item`, 25 `wpforms` pubblicati, 837 `revision`, 425 compilazioni, 187 righe di log email, 564 opzioni | locale |
| 5 | Somma dei byte delle stringhe lette confrontata con una seconda lettura indipendente, fatta con un'espressione regolare grossolana | locale |

La prova 4 è quella che conta: sono numeri misurati **in un'altra fase, con un altro
metodo**, e coincidere con loro è difficile per sbaglio.

### 3.8 Il lettore del formato serializzato di PHP

Serve per `_wp_attachment_metadata`, `wp_capabilities`, `aioseo_options`, `et_divi` e i
parametri del carosello (`wp-to-postgres-mapping.md` §3.4, §4.5, §5, §8).

Scritto in casa, circa 150 righe, per due motivi: le lunghezze del formato sono in
**byte** e non in caratteri, e chi lo sbaglia rompe ogni stringa con un accento — un
errore che si vede subito se il lettore è nostro e si prova, e che si diagnostica male
se è dentro un pacchetto; e i valori contengono dati personali, quindi un pacchetto in
piu è superficie in piu per nessun guadagno.

Riconosce `N;`, `b:`, `i:`, `d:`, `s:`, `a:`. Gli oggetti `O:` **non** si accettano:
nessuna delle chiavi classificate in `wp-to-postgres-mapping.md` ne contiene, e un `O:`
comparso sarebbe un fatto nuovo, quindi una riga `error`.

### 3.9 La lettura di `uploads/`

Enumera l'albero di `source-private/wordpress-2026-09-13/wp-content/uploads/`,
escludendo le sei cartelle di servizio di ADR-004 §3.2: `backwpup*`, `wpforms`,
`aioseo`, `wpdm-cache`, `et_temp`, `download-manager-files`.

**Il numero di file attesi al netto delle esclusioni non è scritto in alcun documento**
(RD-07 di [`CONTEXT.md`](CONTEXT.md)). Si conosce il totale, 1.546, e la stima «circa
1.376» delle sole varianti. Il controllo 7 del preflight ha bisogno di un numero: si
**misura** nella wave `1D-W2` e lo si scrive qui, in questa riga, prima di scrivere il
controllo.

> **Da misurare in `1D-W2` e da riportare qui:** file totali sotto `uploads/`, file
> esclusi per ciascuna delle sei cartelle, file attesi. Finche la riga è vuota, il
> controllo 7 non è scrivibile.

Il checksum è SHA-256 e si calcola una volta per file, in streaming.

## 4. Il contratto di una fase

### 4.1 I tipi

```ts
type StageName =
  | 'preflight' | 'settings' | 'users' | 'media' | 'terms' | 'contents'
  | 'relations' | 'menus' | 'seo' | 'documents' | 'sliders' | 'forms'
  | 'submissions' | 'legacy' | 'redirects' | 'rewrite' | 'verify';

type Mode = 'plan' | 'apply';

interface StageContext {
  readonly runId: string;
  readonly mode: Mode;
  readonly source: SourceReader;     // sola lettura, §2
  readonly tx: Transaction;          // la transazione DI QUESTA fase, §5
  readonly storage: ObjectStore;     // i due bucket, ADR-004 §3.6
  readonly ids: IdMap;               // §6
  readonly issues: IssueSink;        // §5.3: scrive FUORI dalla transazione
  readonly counters: CounterSink;    // alimenta il rapporto, §8
  readonly options: {
    readonly only?: 'page' | 'post';
    readonly forceContentIds: readonly string[];   // --force-content
    readonly verbose: boolean;
  };
}

interface StageResult {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly errors: number;
}

interface Stage {
  readonly name: StageName;
  readonly dependsOn: readonly StageName[];   // importer-spec.md §4
  expected(ctx: StageContext): Promise<number | null>;  // atteso da schema §6
  run(ctx: StageContext): Promise<StageResult>;
}
```

`dependsOn` non è documentazione: l'orchestratore rifiuta di eseguire una fase se una
delle sue dipendenti non è riuscita nella stessa esecuzione. L'ordine obbligato di
`importer-spec.md` §4 diventa cosi un dato verificabile invece di un elenco che
qualcuno deve ricordare.

### 4.2 L'isolamento dell'errore per elemento

`importer-spec.md` §7 chiede due cose che, prese alla lettera, litigano: la fase è una
transazione, ma l'errore su un elemento non la interrompe. In PostgreSQL un errore
dentro una transazione la rende inutilizzabile. La conciliazione è il **savepoint**:

```ts
async function forEachItem<T>(
  ctx: StageContext, items: AsyncIterable<T>,
  key: (item: T) => ItemKey,            // solo identificatori, mai contenuto
  body: (item: T) => Promise<'created' | 'updated' | 'skipped'>,
): Promise<StageResult> {
  const result = { created: 0, updated: 0, skipped: 0, errors: 0 };
  for await (const item of items) {
    const sp = await ctx.tx.savepoint();
    try {
      result[await body(item)] += 1;
      await sp.release();
    } catch (err) {
      await sp.rollback();                       // la transazione resta viva
      await ctx.issues.record({                  // su un'ALTRA connessione, §5.3
        severity: 'error', stage: ctx.name, ...key(item), code: classify(err),
      });
      result.errors += 1;
    }
  }
  return result;
}
```

Tre cose non negoziabili in queste venti righe: il savepoint si apre **per ogni**
elemento; `key(item)` produce solo identificatori — tabella sorgente, identificatore
sorgente, tipo — e mai un frammento di contenuto; `classify(err)` traduce l'errore in un
codice di un vocabolario chiuso, e il messaggio originale finisce **solo** nel registro
locale a livello di diagnostica, non in `import_issues`.

### 4.3 La transazione della fase

| Situazione | Che cosa accade |
|---|---|
| La fase termina senza errori | `COMMIT`. Le fasi successive vedono ciò che ha scritto |
| La fase solleva un errore **strutturale** — non di elemento | `ROLLBACK` dell'intera fase. Le fasi precedenti restano (`importer-spec.md` §7) |
| La fase termina con `errors > 0` ma senza errore strutturale | `COMMIT`. L'esito dell'esecuzione diventa `partial`, mai `success` |
| Modo `plan` | §5.2 |

### 4.4 I file prima delle righe

`importer-spec.md` §7 lo impone per i media: il caricamento nel bucket avviene **prima**
della scrittura della riga in `media`. Un file caricato senza riga è recuperabile; una
riga senza file è un collegamento rotto. In pratica: dentro il savepoint dell'elemento,
prima `storage.put`, poi l'inserimento. Se l'inserimento fallisce, il savepoint torna
indietro e l'oggetto resta nel bucket: la riesecuzione lo trova con lo stesso checksum e
non lo ricarica (§6.3).

## 5. Transazioni, modo `plan`, e dove si scrivono le anomalie

### 5.1 Una transazione per fase, non una per esecuzione

Una transazione unica per tutte e 17 le fasi terrebbe aperta per minuti una transazione
che scrive migliaia di righe, e un errore alla fase 16 cancellerebbe il lavoro delle 15
precedenti — l'opposto di ciò che `importer-spec.md` §7 vuole.

### 5.2 Come `plan` non scrive

Il modo `plan` esegue **lo stesso codice** di `apply`, dentro una transazione che alla
fine viene annullata. Non simula: apre le transazioni, scrive davvero, esercita vincoli
e chiavi esterne, e poi torna indietro.

La differenza rispetto a una simulazione è tutta qui: una prova che non esercita i
vincoli non dice se l'import riuscirebbe. Una che li esercita, si.

Due conseguenze da dichiarare:

1. **I contatori delle sequenze avanzano** anche se la transazione è annullata: è il
   comportamento di PostgreSQL. Il confronto del criterio 1D-1 si fa quindi sul
   **contenuto delle tabelle**, non sui contatori. Va scritto, altrimenti qualcuno
   dichiarera fallito un controllo che è passato.
2. In `plan` **non si scrive nulla** in `import_runs` e `import_issues`: le anomalie
   restano in memoria e finiscono nel rapporto. È l'unica differenza di comportamento
   fra i due modi, e riguarda solo la registrazione.

In `plan` il caricamento nei bucket **non avviene**: si calcola il checksum, si
confronta con l'oggetto eventualmente presente, si conta, non si carica.

### 5.3 Due connessioni, e perché

| Connessione | Che cosa scrive | Perché separata |
|---|---|---|
| **di lavoro** | tutto ciò che le fasi importano | è quella che va avanti e indietro con i savepoint |
| **di registro** | `import_runs`, `import_issues` | se le anomalie stessero nella transazione della fase, l'annullamento della fase **cancellerebbe la spiegazione di perché è fallita**. Sarebbe il difetto piu beffardo del programma |

La connessione di registro scrive in autocommit e non partecipa mai ai savepoint.

## 6. Idempotenza

### 6.1 `import_id_map`

`importer-spec.md` §6.1 fissa la forma: `(source_table, source_id, entity) -> entity_id`.

L'accesso passa da una sola interfaccia:

```ts
interface IdMap {
  find(sourceTable: string, sourceId: number, entity: EntityKind): Promise<string | null>;
  remember(sourceTable: string, sourceId: number, entity: EntityKind,
           entityId: string, runId: string, action: 'created' | 'updated'): Promise<void>;
}
```

`runId` e `action` non sono decorativi: senza di essi `rollback` non sa che cosa quella
esecuzione ha creato e che cosa ha soltanto toccato (§7).

In `plan`, `IdMap` ha una sovrapposizione in memoria: `find` vede prima ciò che la
stessa esecuzione ha «creato», cosi le fasi dipendenti trovano gli identificatori
provvisori e i conteggi sono veri.

### 6.2 Il ciclo di ogni elemento

```
id = ids.find(tabella, idSorgente, tipo)
se id è nullo   -> crea, ids.remember(..., 'created')
altrimenti      -> aggiorna sul posto, ids.remember(..., 'updated')
```

Gli identificatori non si riassegnano mai (`importer-spec.md` §6.1). Gli identificatori
dei **blocchi** dentro un contenuto si rigenerano, ma sono deterministici e derivati
dalla posizione nella sorgente, quindi tornano uguali: `BLOCK-MODEL.md` §4.4.

### 6.3 Comportamento per tipo di dato

Attua `importer-spec.md` §6.2 senza aggiungere né togliere.

| Dato | Alla riesecuzione | Come si realizza |
|---|---|---|
| Contenuti, media, termini, menu, form, documenti, carosello | aggiornati sul posto | `UPDATE` sulle sole colonne derivate dalla sorgente |
| Blocchi di un contenuto | rigenerati — salvo §6.4 | si riscrivono `blocks`, `content_html`, `content_text` |
| File nel bucket | caricati **solo se il checksum differisce** | si legge il checksum dell'oggetto e lo si confronta prima di caricare |
| Compilazioni dei form | **mai aggiornate**: inserimento solo se assenti | `ON CONFLICT DO NOTHING` sulla corrispondenza di `import_id_map` |
| Redirect `origin = 'migration'` | ricalcolati | cancellati e riscritti dentro la transazione della fase 14 |
| Redirect `origin = 'manual'` | **mai toccati** | la fase 14 filtra per origine. Un test lo prova creando un redirect manuale e rieseguendo |
| `legacy_*` | solo inserimento | come le compilazioni |
| Sessioni, audit log, cronologia dei contenuti | **mai toccati** | nessuna fase li nomina. Un test lo prova confrontando le tre tabelle prima e dopo |

### 6.4 La protezione del lavoro redazionale

`importer-spec.md` §6.3 è il punto in cui una migrazione distrugge lavoro vero.

Regola: un contenuto la cui **ultima modifica redazionale** è successiva alla fine
dell'ultima esecuzione **riuscita** non viene sovrascritto. Si registra una riga
`import_issues` di gravita `warning` con l'identificatore del contenuto, e si prosegue.

Tre dettagli che decidono se la protezione funziona davvero:

1. **Quale marca temporale.** Non `contents.updated_at`, che l'importer stesso muove:
   serve una traccia che si aggiorni **solo** quando la modifica arriva dall'area
   amministrativa. Se `contents` non ha una colonna adatta, la si aggiunge con una
   migrazione dichiarata in `1D-W4`: è una modifica allo schema approvato in 1B e va
   scritta nell'audit, non fatta di nascosto.
2. **Quale confronto.** Contro `import_runs.finished_at` dell'ultima esecuzione con
   esito `success` o `partial`, non contro l'ora corrente.
3. **`--force-content <id>`** sovrascrive comunque, **un contenuto per volta**. Non
   esiste un `--force-all`: un'opzione che sovrascrive tutto esiste solo per essere
   usata di fretta.

Il rapporto elenca in testa i contenuti saltati per questo motivo
(`importer-spec.md` §6.3 punto 3).

### 6.5 Come si prova l'idempotenza

Il criterio di accettazione della fase, secondo `importer-spec.md` §11:

1. `apply --confirm`;
2. fotografia dello stato: per ogni tabella, le righe ordinate per chiave, **escluse**
   le colonne di marca temporale generate dal database e i contatori delle sequenze;
3. `apply --confirm` di nuovo;
4. seconda fotografia;
5. le due devono coincidere, byte per byte.

La fotografia si fa con una query che produce un digest per tabella, non con un dump di
righe: un dump di righe conterrebbe dati personali e finirebbe in un file
(`database-schema.md` §7 regola 1).

## 7. Rientro

`importer-spec.md` §9 dà quattro situazioni. Tre si realizzano come scritte. La quarta
ha un limite che la specifica non dichiara, e va dichiarato qui.

| Situazione | Realizzazione |
|---|---|
| Fase fallita | annullata dalla propria transazione (§4.3). Si corregge e si rilancia con `--stage <nome>` |
| Esecuzione gia seguita da lavoro redazionale | `rollback` **rifiuta di procedere** e stampa gli identificatori dei contenuti modificati dopo. È la stessa verifica del §6.4, applicata all'inverso |
| Database da riportare a zero | ripristino del backup: resta la strada piu rapida e piu sicura, e `rollback` non prova a sostituirla |
| Esecuzione da annullare interamente | vedi qui sotto |

### 7.1 Che cosa `rollback` disfa davvero

Risale `import_id_map` filtrando su `run_id`, in **ordine inverso** alle fasi, e
cancella le entita con `action = 'created'` in quella esecuzione. Le chiavi esterne
dello schema fanno il resto: cancellare un contenuto porta via le sue relazioni.

**Ciò che quella esecuzione ha `updated` non si ripristina.** L'importer non conserva
l'immagine precedente di una riga, e la specifica non gliela chiede. Quindi:

- per la **prima** esecuzione su un database vuoto — il caso del criterio di uscita 8 —
  `rollback` è esatto: tutto è `created`, e disfarlo riporta davvero allo stato
  precedente;
- per un'esecuzione successiva, `rollback` cancella ciò che ha creato, **elenca** ciò
  che ha aggiornato e dichiara di non averlo ripristinato.

Tre strade per chiudere il divario, se l'utente lo vuole chiuso: conservare
un'immagine precedente per ogni riga aggiornata, che richiede una tabella in piu nello
schema e conterrebbe dati personali; far rifiutare `rollback` su ogni esecuzione che
contenga aggiornamenti, cioè restringerlo al primo import; lasciarlo cosi, dichiarato.
La terza è quella che questo documento realizza, perche `importer-spec.md` §9 indica
gia il ripristino del backup come la strada giusta per tornare indietro sul serio. Se
l'utente preferisce una delle altre due, è una decisione: §10 punto 2.

`rollback` non tocca mai: righe modificate dopo l'import, redirect manuali, audit log
(`importer-spec.md` §9).

## 8. Il rapporto, e come si garantisce che non contenga dati personali

### 8.1 Un solo oggetto, due forme

Il rapporto è un oggetto tipizzato; la forma testuale di `importer-spec.md` §8.1 e la
forma JSON in `import_runs.summary` sono due **rappresentazioni dello stesso oggetto**.
Due generatori separati divergerebbero, e uno dei due finirebbe per dire qualcosa che
l'altro non dice.

### 8.2 Il tipo che rende difficile sbagliare

```ts
interface ImportReport {
  runId: string;                 // uuid
  mode: Mode;
  importerVersion: string;
  sourceLabel: 'BackupDB-2026-09-13';
  stages: ReadonlyArray<{
    stage: StageName;
    expected: number | null; created: number; updated: number;
    skipped: number; errors: number;
  }>;
  conversion: {
    gutenberg: number; divi: number; html: number;
    blocksTotal: number; blocksNonContainer: number;
    fallbackBlocks: number; fallbackPercent: number;
    fallbackByReason: Readonly<Record<FallbackReason, number>>;
    contentsWithFallback: number;
    thresholdPercentOk: boolean; thresholdContentsOk: boolean;
  };
  checks: ReadonlyArray<{ check: CheckName; value: number; expected: number; ok: boolean }>;
  skippedForEditorialWork: ReadonlyArray<{ contentId: string }>;   // solo uuid
  issues: ReadonlyArray<{
    severity: 'info' | 'warning' | 'error';
    stage: StageName; code: IssueCode;         // vocabolario chiuso
    sourceTable: string; sourceId: number;     // identificatori
    detail: string | null;                     // max 200, da vocabolario, mai contenuto
  }>;
  outcome: 'success' | 'partial' | 'failed';
}
```

Non esiste un campo che possa contenere testo libero proveniente dalla sorgente. `code`
viene da un'enumerazione; `detail` puo contenere soltanto un nome di chiave meta, di
modulo Divi, di shortcode o di attributo — cioè nomi di **costrutti**, non valori.
`skippedForEditorialWork` porta identificatori, non titoli: `importer-spec.md` §6.3
chiede di elencare i contenuti saltati, e un uuid li elenca.

`fallbackPercent` e le due bandiere di soglia realizzano `BLOCK-MODEL.md` §8.

### 8.3 La prova del canarino

Il tipo rende difficile sbagliare; una prova rende visibile l'errore se qualcuno
sbaglia lo stesso.

Si genera una sorgente **sintetica** in cui ogni campo di testo — titoli, corpi, nomi,
indirizzi email, valori delle compilazioni — contiene un marcatore riconoscibile e
improbabile. Si esegue `plan` e `apply` su di essa. Poi si cerca il marcatore nel
rapporto testuale, nel JSON di `import_runs.summary`, in `import_issues` e nell'intero
flusso di registro dell'esecuzione. **Zero occorrenze**, o il test fallisce.

È la stessa prova che, in `1D-W12`, dimostra il criterio di uscita 7.

### 8.4 Il registro dell'esecuzione

Stesso vincolo del rapporto: il registro accetta identificatori, conteggi, nomi di fase
e codici. La funzione di registro di `runtime/` prende un oggetto tipizzato, non una
stringa formattata: non c'è modo di interpolare un valore della sorgente senza
scriverlo apposta. Un messaggio di errore originale finisce solo nel livello di
diagnostica, che in `apply` è spento e non viene mai scritto su file.

## 9. Fixture, e la separazione dai dati reali

### 9.1 Che cosa serve provare, e con quale materiale

| Livello | Materiale | Dove gira |
|---|---|---|
| Tokenizzatore SQL, lettore PHP | dump **sintetici** generati dal costruttore del §9.2 | CI |
| Convertitori Gutenberg, Divi, HTML nudo | frammenti **sintetici** scritti a mano, uno per ogni tipo di blocco e per ogni shortcode di `divi-shortcode-strategy.md` §2 e §4 | CI |
| Fasi e idempotenza | un sottoinsieme **sintetico** completo: poche pagine, pochi articoli, pochi media, un menu, un form, una compilazione | CI, su PostgreSQL vero |
| Soglia del blocco di riserva | sottoinsiemi costruiti per stare sopra e sotto soglia | CI |
| Andata e ritorno | contenuti sintetici in CI; **tutti** i 108 contenuti veri in locale | CI e locale |
| Import completo | la sorgente vera | **solo locale**, wave `1D-W11` |

### 9.2 Come si generano le fixture sintetiche

Un costruttore in `tests/fixtures/builder/` produce un dump SQL con il prefisso `wp_`,
le stesse tabelle e le stesse colonne della sorgente, e righe inventate. Tre proprieta:

1. **Deterministico**: stesso seme, stesso file. Nessuna data corrente, nessun valore
   casuale non tracciato.
2. **Nessun dato reale**, nemmeno somigliante: nomi di fantasia, indirizzi email su un
   dominio di esempio, importi inventati, contenuti che parlano d'altro.
3. **Copre i casi limite dichiarati** in `acceptance-criteria.md` §3.3: la bozza,
   l'`auto-draft` da scartare, la gerarchia di pagine, un contenuto non presente a
   menu, i quattro casi di visibilita delle voci di menu, uno slug storico.

Il dump sintetico è **versionato**: è piccolo, è la specifica eseguibile del lettore, e
un lettore che cambia comportamento lo fa vedere nel diff.

### 9.3 Come restano separati i test su dati reali

| Misura | Realizzazione |
|---|---|
| Non entrano in Git | `apps/importer/tests/real/` è escluso nel `.gitignore`, verificato con `git check-ignore` come in 1C |
| Non entrano in CI | sono una suite a sé, non inclusa nel comando che la CI esegue. La CI esegue le suite sintetiche e basta |
| Non partono per sbaglio | richiedono una variabile d'ambiente esplicita; senza, la suite si salta e lo dice |
| Non producono file | scrivono conteggi a terminale; nessun artefatto, nessuno screenshot, nessun dump di righe |
| Non entrano nella documentazione | dei loro esiti si riporta **il numero**, mai il contenuto. È la regola di ADR-005 §5 e di `importer-spec.md` §11 |

La cartella `tests/real/` non contiene neanche i dati: contiene i test, che leggono da
`source-private/`. I dati reali restano dove sono, in sola lettura.

## 10. Assunzioni vietate e decisioni richieste

1. **La strada (b) se la (a) non regge** — §3.5. Se la verifica del §3.7 fallisce,
   introdurre un MySQL locale è una dipendenza che nessuna ADR autorizza. **Default
   vietato**: ci si ferma e si chiede. Va detto anche che DR-002 **non** la vieta, per
   non far passare per divieto ciò che è una scelta (§3.4).

2. **Che cosa `rollback` promette** — §7.1. La specifica dice «riporta il database allo
   stato precedente»; la realizzazione proposta lo fa per la prima esecuzione ed
   **elenca senza ripristinare** ciò che un'esecuzione successiva ha aggiornato.
   Chiudere il divario richiede una tabella in piu che conterrebbe dati personali, o
   restringere `rollback` al primo import. **Default vietato** sulla tabella in piu:
   non si aggiunge niente allo schema per questo senza chiederlo.

3. **La colonna della modifica redazionale** — §6.4 punto 1. La protezione del lavoro
   del redattore ha bisogno di una marca temporale che l'importer non muova. Se
   `contents` non ne ha una, serve una migrazione: è una modifica allo schema approvato
   in Fase 1B. Non è una decisione di prodotto, ma **va dichiarata nell'audit** e non
   fatta di nascosto.

4. **Il numero di file attesi in `uploads/`** — §3.9. Non è scritto in alcun documento:
   va **misurato** in `1D-W2` e riportato in questo documento prima di scrivere il
   controllo 7 del preflight. È un fatto da rilevare, non una decisione, ed è segnato
   qui perche non venga sostituito da una stima.

---

## 11. Rilievi misurati dall'orchestratore, 2026-09-15

Due punti che il §10 segnava «da rilevare» sono stati misurati prima di iniziare la
`1D-W1`. Si scrivono qui perché non vengano sostituiti da una stima.

### 11.1 File attesi in `uploads/` — controllo 7 del preflight

Conteggio eseguito su `source-private/wordpress-2026-09-13/wp-content/uploads`,
in sola lettura:

| Insieme | File |
|---|---|
| Totale, tutte le cartelle | **1.546** |
| Cartelle di servizio escluse da ADR-004 §3.2 | 76 |
| **Cartelle anno `2017`…`2026`** | **1.470** |

Dettaglio delle cartelle non-anno: `backwpup` 16, `backwpup-dea540-logs` 30,
`backwpup-dea540-backups` 3, `backwpup-dea540-temp` 3, `backwpup-restore` 6,
`download-manager-files` 5, `wpforms` 10, `aioseo` 2, `wpdm-custom-tags` 1,
`et_temp` 0, `wpdm-cache` 0, `wpdm-file-type-icons` 0.

Il controllo 7 del preflight usa **1.470**, ed è anche il numero atteso di oggetti nel
bucket pubblico alla verifica di ADR-004 §7. Il totale di 1.546 coincide con quello
dichiarato in 1A §4.3: la sorgente non è cambiata.

Due rilievi che ADR-004 §3.2 non prevedeva e che vanno trattati:

1. `wpdm-custom-tags` e `wpdm-file-type-icons` **non compaiono** nell'elenco delle
   cartelle escluse dell'ADR, ma non sono media del sito: sono risorse di un plugin.
   Si escludono, e l'esclusione si dichiara nell'audit come scostamento dall'elenco.
2. `download-manager-files` è escluso dall'ADR, ma i documenti scaricabili sono una
   fase di import a sé (fase 9, `documents`). Va verificato in `1D-W4` che i 4
   documenti di `cuar_private_file` **non** provengano da quella cartella: se ne
   provenissero, l'esclusione li perderebbe.

### 11.2 La marca temporale della modifica redazionale — §10 punto 3

`contents` **non** ha una colonna di modifica redazionale distinta da `updated_at`, e
`updated_at` viene mosso anche dall'importer: da sola non distingue.

Non serve però una migrazione. `content_revisions` esiste già
(`packages/db/src/schema/content.ts`) e ADR-005 §3.7 stabilisce che **ogni salvataggio
redazionale crea una riga di cronologia**. L'importer non scrive mai in quella tabella
(`importer-spec.md` §6.2, ultima riga). Quindi:

> Un contenuto è stato modificato da un redattore dopo l'ultima esecuzione riuscita
> se e solo se esiste una riga in `content_revisions` con `created_at` successivo a
> `import_runs.finished_at` dell'ultima esecuzione con esito `success` o `partial`.

È il criterio che attua la protezione di `importer-spec.md` §6.3 e il rifiuto di
`rollback` del §9, **senza toccare lo schema approvato in Fase 1B**. La decisione 3
del §10 si chiude così: nessuna migrazione, nessuna decisione da chiedere all'utente.

Resta vero il limite: finché il CMS non esiste, nessuno ha ancora scritto una riga di
cronologia, quindi in `1D-W5` la protezione si prova su righe di cronologia
**sintetiche**, inserite dal test.

### 11.3 Due conteggi della sorgente che non coincidono con la Fase 1A

Rilevati dalla `1D-W2` misurando il dump congelato con due metodi indipendenti — il
tokenizzatore dell'importer e un'espressione regolare separata — e riportati qui
perché nessuno li dia per allineati.

| Tabella | Atteso da `wp-to-postgres-mapping.md` §1 | Misurato nel dump | Scarto |
|---|---|---|---|
| `wp_options` | 564 | **562** | −2 |
| `wp_postmeta` | 6.420 | **6.070** | −350 |

Tutti gli altri conteggi coincidono esattamente: 1.234 `wp_posts`, 78 `page`, 170
`attachment`, 64 `nav_menu_item`, 837 `revision`, 31 `post`, 28 `wpforms`, 425
`wp_wpforms_entries`, 187 `wp_wpmailsmtp_debug_events`, 1.546 e 1.470 file di
`uploads/`.

Che cosa **non** si conclude da questo: non si conclude che manchino dati. Il
controllo 3 del preflight passa, cioè **tutte** le chiavi meta presenti nel dump sono
classificate nel mapping, e il controllo 4 passa sui `post_type`. Lo scarto riguarda
il **numero di righe**, non la loro natura, e le due tabelle in questione sono quelle
che cambiano a ogni visita al sito: `wp_options` contiene transienti con scadenza e
`wp_postmeta` contiene metadati che i plugin riscrivono.

L'ipotesi più probabile è quindi che i numeri della Fase 1A siano stati misurati su
un'istantanea diversa — il backup di marzo, superato da DR-015 — o prima di una
pulizia dei transienti. **È un'ipotesi, non una verifica.**

Conseguenza operativa: i conteggi attesi scritti nel codice dell'importer
(`importer-spec.md` §8.2) per queste due tabelle sono **562** e **6.070**, cioè i
valori misurati sulla sorgente autorevole, non quelli del documento di Fase 1A. Lo
scostamento va riportato nell'`AUDIT.md` della fase, e `wp-to-postgres-mapping.md`
va corretto nella wave di documentazione, non qui: quel documento è un prodotto
approvato della Fase 1B e si corregge dichiarando la correzione.

### 11.4 Altri due conteggi attesi che non reggono alla misura — `1D-W4a`

Stesso genere di rilievo del §11.3, trovato attuando le prime tre fasi.

| Voce | Atteso dal codice e da `importer-spec.md` §8.1 | Misurato | Fonte del valore misurato |
|---|---|---|---|
| `settings` | 18 | **15** | `docs/architecture/schema.sql` §10 elenca esattamente 15 chiavi «previste all'import» |
| `terms` | 3 | **2** | la sorgente ha 2 categorie e 0 tag, coerente con il commento di `packages/db/src/schema/taxonomy.ts` |

Le tre chiavi di impostazione che mancherebbero per arrivare a 18 **non sono indicate in
alcun documento**. Non si inventano: si importano le 15 documentate e si dichiara lo
scarto. Se le tre esistono, il documento che le elenca va trovato o scritto; se non
esistono, il numero 18 era sbagliato.

Va notato che `settings.site.home_content_id` **non** è scritto dalla fase 1: richiede
l'identificatore di un contenuto, che nasce nella fase 5. Non è una delle tre mancanti —
è una chiave che si popola più tardi.

I valori attesi nel codice vanno allineati a **15** e **2**. Come per il §11.3, la
correzione dei documenti di Fase 1B e della specifica è lavoro della wave di
documentazione, non di quella di codice, e va dichiarata invece che fatta di nascosto.

### 11.5 `import_id_map` non distingue «creato» da «aggiornato»

La tabella approvata in Fase 1B non ha una colonna che dica se una riga è nata da una
creazione o da un aggiornamento. `importer-spec.md` §9 chiede però che `rollback`
«cancelli le entità create da quella esecuzione»: senza quella distinzione, un rollback
della **seconda** esecuzione non sa che cosa cancellare e che cosa riportare indietro.

È lo stesso divario già dichiarato al §10 punto 2, visto ora dal lato dello schema. Non
si aggiunge una colonna di iniziativa: la decisione è dell'utente e la si porta nella
wave `1D-W5`, che attua `rollback`.

### 11.6 I quattro documenti riservati non stanno in `uploads/` — `1D-W4b`

Rilievo che cambia il lavoro della fase 9 e va portato all'utente.

ADR-004 §3.6 dice che i 4 documenti di `cuar_private_file` vanno nel bucket
`media-private`, e il §11.1 di questo documento chiedeva di verificare che non
provenissero da `download-manager-files`, che l'ADR esclude. La verifica è stata fatta
guardando la sorgente, e la risposta è più netta della domanda:

> I 4 documenti **non stanno affatto dentro `uploads/`**. Vivono in
> `wp-content/customer-area/storage/<identificatore>/`, un albero separato che nessun
> lettore dell'importer visita oggi.

Due conseguenze:

1. **L'esclusione di `download-manager-files` non li mette a rischio**, perché non
   vengono da lì. La domanda del §11.1 è chiusa, con esito tranquillizzante. Quella
   cartella contiene 4 PDF **diversi**, con nomi simili: è una coincidenza che invitava
   all'errore, ed è la ragione per cui la verifica andava fatta guardando e non
   ragionando.
2. **Non sono allegati di WordPress**: nessuna riga di `wp_posts` con
   `post_type = 'attachment'` li referenzia. Quindi non compaiono fra le 170 righe della
   fase 3, e **nessuna riga `media` prodotta dalla fase 3 è privata**.

Per importarli serve un **secondo lettore di sorgente**, che legga
`wp-content/customer-area/storage/`. Non è previsto da alcun documento di Fase 1B.
È lavoro della fase 9 `documents`, e va dichiarato come **decisione**, non risolto di
iniziativa: tocca dati riservati, che DR-033 vuole conservati e non esposti.

### 11.7 Un allegato della sorgente non è recuperabile — `1D-W4b`

Su 170 allegati, **169 si importano e 1 no**. Il caso è `sourceId 341`: la chiave
`_wp_attached_file` registra un nome di file scritto con maiuscole e minuscole diverse
da quelle del file realmente presente in `uploads/`. Il file **esiste**; il nome con cui
il database lo cerca non corrisponde.

Non è un difetto dell'importer ed è il comportamento voluto: l'errore è isolato sul
singolo elemento, produce una riga `import_issues`, e gli altri 169 proseguono
(`importer-spec.md` §7).

Va però detto che **non si risolve normalizzando il nome**: ADR-004 §3.1 vieta di
normalizzare nomi e suffissi, perché farebbe divergere il `srcset`. Su un archivio
sensibile alle maiuscole — e il bucket lo è — quell'allegato non è raggiungibile
nemmeno oggi, sul sito vivo. È un difetto **della sorgente**, e la decisione su che
farne è dell'utente, alla wave `1D-W11`.

### 11.8 La riga di comando non è ancora collegata alle fasi vere

`importer plan` esegue tuttora l'abbozzo della `1D-W2`: stampa i conteggi attesi con
`implemented: false` per ogni riga, comprese le fasi che nel frattempo **esistono e
funzionano**. Le fasi si eseguono oggi solo attraverso `runStage`, dai test.

Non è un difetto di nessuna delle sotto-wave: è infrastruttura condivisa, che nessuna
di esse aveva in perimetro. Va collegata **una volta sola, quando le fasi ci sono
tutte**, cioè al termine della `1D-W5`. Finché non è fatto, `plan` e `apply` non
dimostrano nulla di ciò che le fasi fanno, e i criteri di uscita che li citano non sono
verificabili.
