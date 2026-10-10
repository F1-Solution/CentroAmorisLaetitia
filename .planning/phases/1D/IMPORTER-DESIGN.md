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

> **Attuato il 2026-10-10, DR-114:** la fase `contents` la scrive alla fine, da
> `page_on_front` con `show_on_front = page`, dopo aver importato i contenuti. Fino ad
> allora non era stata scritta da nessuna fase: il rimando «più tardi» non aveva
> un luogo, e lo ha trovato il sito pubblico della `1E-W2`.

I valori attesi nel codice vanno allineati a **15** e **2**. Come per il §11.3, la
correzione dei documenti di Fase 1B e della specifica è lavoro della wave di
documentazione, non di quella di codice, e va dichiarata invece che fatta di nascosto.

### 11.5 `import_id_map` non distingue «creato» da «aggiornato»

**Rilievo chiuso da DR-059**, vedi §11.13.

La tabella approvata in Fase 1B non ha una colonna che dica se una riga è nata da una
creazione o da un aggiornamento. `importer-spec.md` §9 chiede però che `rollback`
«cancelli le entità create da quella esecuzione»: senza quella distinzione, un rollback
della **seconda** esecuzione non sa che cosa cancellare e che cosa riportare indietro.

È lo stesso divario già dichiarato al §10 punto 2, visto ora dal lato dello schema. Non
si aggiunge una colonna di iniziativa: la decisione è dell'utente e la si porta nella
wave `1D-W5`, che attua `rollback`.

### 11.6 I quattro documenti riservati non stanno in `uploads/` — `1D-W4b`

**Rilievo chiuso da DR-058**, vedi §11.13.

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

### 11.9 La soglia del blocco di riserva, misurata — `1D-W4c`

Il §10.4 di `BLOCK-MODEL.md` diceva che la misura valida andava fatta qui, con i
risolutori veri. È stata fatta. Il risultato sono **due numeri, non uno**, e vanno
tenuti distinti finché la fase 11 `forms` non esiste.

| Misura | Blocchi di riserva | Percentuale | Contenuti | Soglia ADR-005 §3.4 |
|---|---|---|---|---|
| Complessiva, con `media` risolto e `forms` no | 31 / 305 | **10,16 %** | **27** / 108 | **superata** |
| Al netto dei moduli form non risolvibili | 7 / 305 | **2,30 %** | **4** / 108 | **rispettata** |

Dei 31 blocchi di riserva, **24 sono moduli form** privi di identificatore risolvibile,
perché il risolutore verso `forms` nasce nella fase 11, che è del blocco successivo.
Non sono un difetto di conversione: sono l'effetto di misurare a catena incompleta.

Il numero al netto coincide **esattamente** con la stima a risolutore fittizio del
§10.4 di `BLOCK-MODEL.md`: 2,30 % e 4 contenuti. Due misure indipendenti che danno lo
stesso risultato sono una verifica, non una coincidenza.

**La soglia non si dichiara né rispettata né superata** finché la fase 11 non esiste.
La misura che vale è quella della `1D-W5`, e va rifatta lì.

### 11.10 Due contenuti con percorso in collisione — `1D-W4c`

La fase 6 `relations` aggiorna 106 contenuti su 108 e isola **2 errori**. Non è un
difetto del codice: sono due anomalie reali della sorgente.

| Caso | Contenuto | Anomalia |
|---|---|---|
| 1 | `wp_posts.ID` 332 | slug condiviso con un altro contenuto **di tipo diverso** |
| 2 | `wp_posts.ID` 1781 | bozza mai salvata, **slug vuoto** |

In WordPress non collidono perché il tipo fa parte dell'instradamento; in
`contents.path`, che è un percorso unico (`contents_path_unique`), collidono.

La fase 5 li importa comunque tutti e 108 senza errori, perché il percorso provvisorio
include `legacy_id` ed è unico per costruzione. La collisione emerge solo al percorso
vero, ed è lì che va decisa.

**Non si risolve di iniziativa**: assegnare d'ufficio un percorso diverso a una pagina
del sito è una modifica di URL, e gli URL sono materia di parità e di indicizzazione.
La decisione è dell'utente, alla wave `1D-W11`. Il caso 2 è probabilmente innocuo — una
bozza senza slug non ha mai avuto un URL — ma «probabilmente» non basta per deciderlo.

### 11.11 Nessuno degli 8 documenti si risolve — `1D-W4d`

**Rilievo chiuso da DR-058 e DR-060**, vedi §11.13.

Il §11.6 aveva rilevato che i 4 documenti **riservati** stanno fuori da `uploads/`.
Attuando la fase 9 si è misurato anche il resto, e il quadro è più ampio: **nessuno
degli 8 documenti** ha oggi un file risolvibile, per **due motivi diversi**.

| Gruppo | Dove sta il file | Perché non si risolve |
|---|---|---|
| 4 riservati (`cuar_private_file`) | `wp-content/customer-area/storage/` | fuori da `uploads/`: nessun lettore lo visita (§11.6). **Risolto da DR-058**: si aggiunge un secondo lettore |
| 4 pubblici (`wpdmpro`) | `wp-content/uploads/download-manager-files/` | la cartella è **esclusa** da ADR-004 §3.2 |

Poiché `documents.media_id` è `NOT NULL`, oggi **nessuna riga `documents` viene
scritta**: 8 attese, 0 create, 8 saltate, ognuna con una riga `import_issues` di
gravità `warning` che distingue i due motivi.

#### Il secondo caso è un difetto di ADR-004, non dell'importer

ADR-004 §3.2 elenca `uploads/download-manager-files` fra le **cartelle di servizio**
da escludere, insieme a cache e file temporanei. La verifica diretta dice altro: quella
cartella contiene **quattro moduli per le consulenze in formato PDF**, cioè documenti
che il sito offre davvero in scaricamento. Non sono scarti di un plugin: sono contenuto.

L'esclusione era una **classificazione sbagliata**, presa dal nome della cartella
invece che dal suo contenuto. Mantenerla significherebbe perdere quattro documenti
pubblici del sito senza che nessuno se ne accorga, perché la perdita non produrrebbe
un errore: produrrebbe otto righe mancanti in una tabella che nessuno conta.

**Non si corregge di iniziativa**: ADR-004 è approvata (DR-038) e l'elenco delle
esclusioni ne è parte. Va portata all'utente come decisione.

#### Nota sui nomi, che invita all'errore

I 4 file pubblici e i 4 riservati hanno **nomi quasi identici** — gli stessi moduli, con
o senza trattini. È la stessa trappola già segnalata al §11.6, vista dall'altro lato:
qui il rischio non è importare i file sbagliati, ma credere che i due gruppi siano lo
stesso gruppo e importarne quattro invece di otto.

### 11.12 Le tassonomie dei documenti non sono importate — `1D-W4d`

**Rilievo chiuso da DR-061**, vedi §11.13.

La fase 4 `terms` importa la sola tassonomia `category`. I documenti però usano
`wpdmcategory` e `cuar_private_file_category`, che non sono importate: quindi
`document_terms` resterebbe vuota anche se i file si risolvessero.

Lo stesso limite ha già prodotto un effetto visibile altrove: **una voce di menu su 64
viene saltata** perché punta a un termine di `wpdmcategory`. Il conto torna comunque a
64 — 63 create più 1 saltata — ma la voce manca.

È lo stesso genere di problema del §11.11: una classificazione della Fase 1B più stretta
di ciò che la sorgente contiene. Va deciso insieme a quello.

### 11.13 Le quattro correzioni attuate — `1D-W5a`

Le decisioni DR-058, DR-059, DR-060 e DR-061 chiudono i rilievi §11.5, §11.6, §11.11 e
§11.12. Tutti i numeri di questa sezione sono **misurati** eseguendo le fasi sulla
sorgente reale, non attesi.

| Rilievo | Decisione | Stato |
|---|---|---|
| §11.5 `import_id_map` non distingue creato da aggiornato | DR-059 | chiuso |
| §11.6 i 4 documenti riservati stanno fuori da `uploads/` | DR-058 | chiuso |
| §11.11 nessuno degli 8 documenti si risolve | DR-058 e DR-060 | chiuso |
| §11.12 le tassonomie dei documenti non sono importate | DR-061 | chiuso |

#### Che cosa è cambiato, decisione per decisione

**DR-059 — la colonna `action` di `import_id_map`.** Prima modifica a uno schema
approvato in Fase 1B, fatta con una decisione registrata e non di iniziativa. La
colonna vale `created` o `updated` e registra l'esito di *quella* riesecuzione per
quella riga; `rollback`, che arriva in `1D-W5c`, la userà per non cancellare entità
che l'esecuzione da annullare si era limitata ad aggiornare. Migrazione `0001`, senza
dati personali: la colonna dice solo se una riga è nata o è stata toccata.

**DR-058 — il secondo lettore di sorgente.** `wp-content/customer-area/storage/<hash>/<nomefile>`
è ora letto da `source/files/privateStorage.ts`. La risoluzione avviene per **nome di
file esatto**: l'identificatore a 32 esadecimali contenuto nel meta
`cuar_private_file_file` **non** coincide con il nome della cartella su disco, ed è il
punto in cui era facile costruire un percorso plausibile e sbagliato.

**DR-060 — `download-manager-files` non è più esclusa.** I suoi 4 PDF diventano
visibili al lettore di `uploads/`, e la fase 9 può risolverli. I due archivi restano
separati per costruzione: il riservato si cerca solo in `customer-area/storage/`, il
pubblico solo in `download-manager-files/`. I nomi quasi identici dei due gruppi —
segnalati al §11.6 e al §11.11 — non possono quindi risolversi l'uno con l'altro.

**DR-061 — tre tassonomie invece di una.** La fase 4 importa `category`,
`wpdmcategory` e `cuar_private_file_category`. Ha richiesto un cambio di forma del
percorso dei termini: da `/category/<slug>/`, con la tassonomia scritta a mano, a
`/<tassonomia>/<slug>/`. Non è cosmesi — lo slug `moduli-consulenze` esiste in
**entrambe** le tassonomie nuove, e senza il prefisso i due percorsi violerebbero il
vincolo `terms_path_unique`. Per `category` la forma generalizzata produce esattamente
il percorso di prima.

#### Chiavi di storage adottate per gli 8 documenti

| Gruppo | Chiave nel bucket | Bucket |
|---|---|---|
| 4 pubblici | `download-manager-files/<nomefile>` | `media-public` |
| 4 riservati | `customer-area/<hash>/<nomefile>` | `media-private` |

Lo schema conserva la disposizione della sorgente, che è ciò che rende prevedibile la
fase 15 `rewrite` (`wp-content/uploads/X` → `/media/X`).

#### Esiti misurati sulla sorgente reale

| Misura | Prima | Dopo |
|---|---|---|
| file sotto `uploads/` dopo le esclusioni | 1.470 | **1.475** — i 5 di `download-manager-files/`, cioè 4 PDF e un `.htaccess` del plugin, che **non** viene importato come media |
| fase `terms` | 3 create | **4 create** |
| fase `menus` | 63 create, **1 saltata** su 64 | **64 create, 0 saltate** |
| fase `documents` | 0 create, 8 saltate | **8 create, 0 saltate, 0 errori** |
| `document_terms` | 0 righe | **8 righe** |
| tabella `media` | 170 | **178** — 170 dalla fase `media`, 4 pubblici e 4 riservati dalla fase `documents` |

La voce di menu recuperata è l'effetto che il §11.12 aveva predetto: puntava a un
termine di `wpdmcategory` e veniva saltata perché quel termine non esisteva. È merito
di DR-061, non di DR-060, che riguarda i file e non le tassonomie.

#### Conseguenza sui documenti che dichiarano conteggi

`database-schema.md` §6 conta le righe **per tabella** e passa a `terms` 4 e `media`
178. `importer-spec.md` §8.1 conta **per fase**: la riga `terms` passa a 4, la riga
`media` resta 170, perché le altre 8 righe le crea la fase `documents`. I due documenti
non si contraddicono, ma il punto va letto una volta prima di verificare i conteggi
nella `1D-W11`.

### 11.14 Le notifiche dei form non erano idempotenti — `1D-W5c`

Il confronto fra due `apply` di fila sulla sorgente reale — il criterio di accettazione
della fase, misurato qui per la prima volta con la fotografia strutturale del §6.5 — ha
trovato una sola tabella divergente: `form_notifications`, **39 righe in entrambe le
esecuzioni, contenuto diverso**.

La causa: la fase 11 cancellava tutte le notifiche di un form e le reinseriva, come fa
`documents` con `document_terms`. Ma `document_terms` ha una chiave composta e nessun
identificatore proprio, mentre `form_notifications` ha un `uuid`: cancellare e
reinserire ne rigenerava 39 a ogni esecuzione. È esattamente ciò che `importer-spec.md`
§6.1 vieta — «gli identificatori non si riassegnano mai» — e nessun test lo avrebbe
visto senza il confronto fra due esecuzioni intere, perché i conteggi tornavano.

Corretto usando `position` come chiave naturale dentro il form: è progressiva e
deterministica, assegnata dal lettore della sorgente. Le notifiche si aggiornano sul
posto per posizione, e si cancellano solo le posizioni che la sorgente non ha più.

Dopo la correzione, le due fotografie coincidono su **tutte** le tabelle di dominio.

### 11.15 `rollback` non può annullare un'esecuzione superata — `1D-W5c`

`import_id_map` ha una chiave unica su `(source_table, source_id, entity)` e ogni
esecuzione la sovrascrive con il proprio `run_id` e la propria `action` (§6.1, DR-059).
La conseguenza non era stata scritta: **dopo un secondo `apply`, della prima esecuzione
non resta traccia nella mappa**. Misurato provando ad annullare la prima esecuzione
dopo la seconda: `rollback` non cancellava nulla e usciva con esito positivo.

È il modo peggiore di fallire, e non si corregge con una tabella in più senza una
decisione (§10 punto 2). `rollback` ora **rifiuta** di annullare un'esecuzione superata
da una successiva, dice quale l'ha superata, e indica il ripristino del backup come
`importer-spec.md` §9 già fa. Il §7.1 va letto con questa riga in più: `rollback`
annulla **l'ultima** esecuzione, non una qualsiasi.

### 11.16 Quattro scostamenti dichiarati dell'orchestratore — `1D-W5c`

Collegare `plan` e `apply` alle fasi vere (§11.8) ha richiesto quattro scelte che
scostano da come i documenti si leggono a prima vista. Si dichiarano qui perché nessuna
è deducibile dal codice senza il motivo.

| # | Scostamento | Da | Perché |
|---|---|---|---|
| 1 | **Una sola `IdMap` per esecuzione**, non una per fase | `runStage` la creava a ogni chiamata | §6.1 lo dice già; con una per fase, in `plan` la fase `relations` non troverebbe i contenuti appena creati e conterebbe zero |
| 2 | **In `plan`, una transazione per l'intera esecuzione**, con un savepoint per fase | §5.1, «una transazione per fase» | Il motivo di §5.1 — un errore alla fase 16 non deve cancellare il lavoro delle 15 precedenti — riguarda `apply`, dove il lavoro resta. In `plan` viene annullato tutto per definizione, e transazioni separate impedirebbero a ogni fase di vedere le righe della precedente. Il savepoint per fase conserva l'isolamento |
| 3 | **`rollback` richiede `--confirm`** | `importer-spec.md` §3, che lo chiede solo per `apply` | `CLAUDE.md` mette le cancellazioni fra le azioni a conferma obbligatoria. Senza `--confirm` il comando mostra che cosa cancellerebbe e non tocca nulla |
| 4 | **`verify` legge la sorgente** | `importer-spec.md` §3, «senza leggere la sorgente» | Due degli otto controlli di §8.1 la leggono per forza: il confronto dei checksum e le chiavi meta non classificate. Escluderli renderebbe `verify` più debole del rapporto che affianca |

Corretto nella stessa wave anche il vocabolario dei motivi del blocco di riserva nel
rapporto: `report/types.ts` ne elencava tre inventati nella `1D-W2`, quando i
convertitori non esistevano. I motivi veri sono i cinque di `HTML_BLOCK_REASONS`
(`BLOCK-MODEL.md` §8.2), e il rapporto ora riporta quelli.

### 11.17 Che cosa `rollback` lascia, misurato — `1D-W5c`

Annullando l'unica esecuzione di un import completo sulla sorgente reale, il database
torna vuoto **tranne** cinque tabelle, che restano per costruzione:

| Tabella | Righe | Perché resta |
|---|---|---|
| `settings` | 15 | Chiave naturale, non passa da `import_id_map`: è configurazione, non contenuto importato |
| `seo_templates` | 6 | Come sopra |
| `roles` | 1 | Come sopra |
| `permissions` | 5 | Come sopra |
| `role_permissions` | 5 | Legame fra le due precedenti |

Cancellate invece, in ordine inverso alle fasi: 25 form con le loro 425 compilazioni,
12 slide e 1 carosello, 8 documenti, 64 voci di menu e 1 menu, 108 contenuti, 4
termini, 177 media con le loro varianti, 1 utente, 180 redirect di migrazione e le due
tabelle `legacy_*`.

Le tabelle non tracciate — redirect `migration`, `legacy_*` — si svuotano **solo se
l'annullamento ha davvero cancellato delle entità**. Anche questo è un difetto
misurato: annullare il secondo `apply`, che non aveva creato nulla, le svuotava lo
stesso, cioè distruggeva le righe della prima esecuzione, che resta valida.

### 11.18 Il rapporto sommava entità diverse nella stessa riga — `1D-W5c`

Collegare il rapporto alle fasi vere ha reso visibile che tre righe della tabella di
`importer-spec.md` §8.1 non contavano ciò che dichiarano. Le fasi restituiscono quattro
conteggi ciascuna, ma tre di esse creano **due** generi di entità:

| Fase | Creava, sommate | La riga del rapporto conta |
|---|---|---|
| `media` | 170 media **+ 1.278 varianti** | `media` 170, e `media_variants` come riga a sé |
| `settings` | 15 impostazioni **+ 6 template SEO** | `settings` 15; i template SEO non hanno una riga |
| `sliders` | 12 slide **+ 1 carosello** | `slider_slides` 12; il carosello non ha una riga |

Un conteggio che somma due cose diverse è peggio di un conteggio assente, perché sembra
giusto: la riga `slider_slides` diceva 13 dove le slide sono 12. Corretto con due campi
facoltativi del risultato di fase — `extraRows` per la riga in più di `media`,
`rowResult` per la parte che appartiene alla riga nelle altre due. I conteggi della
fase intera non si perdono: gli errori entrano nell'esito comunque.

#### Il numero atteso della riga `settings` non aveva una fonte

Valeva 18, preso dalla tabella di esempio di `importer-spec.md` §8.1. Quella tabella è
un'illustrazione, e `settings` è **l'unica riga del rapporto che non compare nei volumi
attesi di `database-schema.md` §6**, cioè l'unica senza una fonte autorevole. Il numero
vero è la dimensione del catalogo delle impostazioni, misurata a **15**. Portato a 15 e
dichiarato qui, come si è fatto per `terms` con DR-061.

#### Il confronto dei conteggi non si fa nel rapporto

`importer-spec.md` §8.1 lo dice in chiaro — «il confronto con i volumi di tabella spetta
alla fase 16 `verify`, non a questa tabella» — e la prima stesura dell'orchestratore lo
faceva comunque, sulla colonna `ATTESI`. Erano due verdetti sullo stesso fatto con due
formule diverse, e la seconda era sbagliata: `SALTATI` significa cose opposte a seconda
della fase, perché un contenuto protetto dalla §6.3 **esiste** come riga mentre un
redirect scartato no. Ora l'esito si decide su errori, verifiche e soglie; i volumi li
misura `verify`, che registra un `table-count-mismatch` per ogni scostamento.

#### Conteggi misurati sulla sorgente reale, prima esecuzione

| Riga | Attesi | Creati | Nota |
|---|---|---|---|
| `settings` | 15 | 15 | dopo la correzione qui sopra |
| `users` | 1 | 1 | |
| `media` | 170 | 169 | 1 errore: l'allegato non recuperabile del §11.7 |
| `media_variants` | ~1.376 | 1.278 | stima, non un intero fisso (§3.9) |
| `terms` | 4 | 4 | |
| `contents` | 108 | 108 | |
| `menu_items` | 64 | 64 | |
| `forms` | 25 | 25 | |
| `form_submissions` | 425 | 425 | |
| `documents` | 8 | 8 | |
| `slider_slides` | 12 | 12 | dopo la correzione qui sopra |
| `redirects` | 180 | 180 | più 2 scartati: un anello e una destinazione non risolta (§11.10) |

L'esito è `partial`, per l'unico errore della riga `media`. Chiudere quello scostamento
e portare l'esito a `success` è il lavoro della `1D-W11`, non di questa wave.

### 11.19 La soglia del blocco di riserva resta superata, e il motivo è l'ordine delle fasi — `1D-W5c`

Il §11.9 aveva rimandato a questa wave la misura che vale: «la soglia non si dichiara
né rispettata né superata finché la fase 11 non esiste. La misura che vale è quella
della `1D-W5`, e va rifatta lì». La fase 11 ora esiste. La misura è stata rifatta, con
l'intera catena eseguita dalla riga di comando, e **non è cambiata di un blocco**:

| Misura | Blocchi di riserva | Percentuale | Contenuti | Soglia ADR-005 §3.4 |
|---|---|---|---|---|
| `1D-W4c`, senza la fase `forms` | 31 / 305 | 10,16 % | 27 / 108 | superata |
| `1D-W5c`, **con** la fase `forms` | 31 / 305 | **10,16 %** | **27** / 108 | **superata** |

Il motivo è l'**ordine obbligato** di `importer-spec.md` §4: `contents` è la fase 5,
`forms` la 11. Quando il convertitore incontra un modulo form, la fase che crea i form
non è ancora stata eseguita, quindi `resolveForm` non esiste e il modulo diventa un
blocco `html` di riserva. Far esistere la fase 11 non cambia nulla, perché arriva sei
fasi troppo tardi.

Vale per tutti e tre i risolutori mancanti: `resolveForm`, `resolveDocument` e
`resolveSlider`. Le fasi che li potrebbero alimentare sono la 11, la 9 e la 10, tutte
dopo la 5.

#### Il fatto che rende la cosa risolvibile

Nessuna delle tre dipende da `contents`. L'ordine obbligato lo dichiara esso stesso:

| Fase | Dipende da, secondo §4 |
|---|---|
| 9 `documents` | 3 `media`, 4 `terms` |
| 10 `sliders` | 3 `media` |
| 11 `forms` | 0 `preflight` |

Spostarle prima di `contents` non violerebbe alcuna dipendenza dichiarata. Con
`resolveForm` disponibile, la misura del §11.9 al netto dei moduli form è **7 / 305,
cioè 2,30 %, su 4 contenuti**: dentro entrambe le soglie, e coincidente con la stima
indipendente del §10.4 di `BLOCK-MODEL.md`.

#### Perché non è stato fatto in questa wave

Cambiare l'ordine obbligato è una modifica a `importer-spec.md` §4, un documento
approvato in Fase 1B, e l'ordine è la cosa che quel paragrafo dichiara non essere «una
preferenza». **Non si decide di iniziativa.** La decisione è dell'utente.

### 11.20 La soglia, rimisurata con l'ordine di DR-062 — `1D-W10`

Il §11.19 aveva lasciato la soglia «né rispettata né superata» in attesa del
riordino delle fasi. DR-062 lo ha approvato, la `1D-W10` lo ha attuato, e la
misura è stata rifatta sulla sorgente reale con l'ordine nuovo.

| Misura | Blocchi di riserva | Percentuale | Contenuti | Soglia ADR-005 §3.4 |
|---|---|---|---|---|
| `1D-W5c`, ordine vecchio | 31 / 305 | 10,16 % | 27 / 108 | superata |
| `1D-W10`, **ordine di DR-062** | **8 / 305** | **2,62 %** | **5** / 108 | **rispettata** |

I blocchi di riserva rimasti, per motivo: `wp_html_block` 6,
`divi_unmapped_module` 1, `divi_unmapped_markup` 1.

**Il numero non coincide con la stima, e la differenza si spiega.** Il §11.19
prevedeva 7 blocchi su 4 contenuti, cioè 2,30 %. Ne restano 8 su 5. La
differenza è **una sola cosa**, ed è strutturale: dei 24 moduli form che
l'ordine vecchio non risolveva, 23 sono blocchi `wp:wpforms/form-selector` e si
risolvono adesso, mentre il ventiquattresimo è l'unico `et_pb_contact_form`
della sorgente (`divi-shortcode-strategy.md` §2). Un modulo di contatto di Divi
**non ha una riga sorgente propria**: non è un `wp_posts`, quindi la fase
`forms` non crea alcuna entità a cui puntare. Resta un blocco di riserva, e
resterà tale finché ADR-010 non decida di costruirgli un `forms` proprio. La
stima del §11.19 lo aveva contato fra i risolvibili: era la stima a essere
ottimista di uno, non la misura a essere peggiorata.

**Che cosa questa misura chiude.** La soglia di ADR-005 §3.4 è rispettata su
entrambi i criteri — percentuale e contenuti toccati — e il punto 6 del §7 di
`PLAN.md`, che prevedeva di fermarsi e chiedere se la soglia fosse stata
superata, non scatta.

La misura si rifà con:

```
pnpm --filter @amoris/importer exec vitest run --config vitest.real.config.ts tests/real/roundTripReal.real.test.ts
```

Non gira in CI: legge `source-private/` (DR-010). In CI gira l'equivalente
sintetico, `tests/unit/syntheticSubset.test.ts`, che prova l'ordine nuovo su un
riferimento a modulo inventato.

### 11.21 Le quattro attuazioni dovute prima dell'import reale — `1D-W11a`

| Decisione | Come è attuata |
|---|---|
| **DR-063** | `relations/paths.ts` assegna i percorsi in ordine di profondità, pagine prima degli articoli, più vecchi prima. Un percorso già assegnato fa ricevere al secondo contenuto il percorso provvisorio `/<slug>-<legacyId>/`; il contenuto resta bozza. Nessun identificatore è scritto nel codice: la regola vale per ogni collisione |
| **DR-064** | Uno slug vuoto riceve `/senza-slug-<legacyId>/` e resta bozza |
| **DR-065** | `createUploadIndex` cerca il nome esatto e, se manca, l'unico file che differisce per maiuscole e minuscole; fra due candidati non sceglie. La chiave d'archivio, `publicPath` e `fileName` restano quelli del database; si legge il file che c'è sul disco. Vale per originale e misure derivate, e per la verifica dei checksum |
| **Copie di lavoro** | `hasEditorialWorkSince` e il piano di `rollback` guardano anche `content_drafts.updated_at` |

Le due anomalie dei contenuti nascono bozza già nella fase `contents`, che fa lo
stesso calcolo sulla sorgente: se `relations` fallisse su di loro, non
resterebbero pubblicate a un indirizzo inventato. Ciascuna produce un avviso
`content-path-provisional`; il file ritrovato ignorando le maiuscole produce un
avviso `source-file-case-mismatch`.

**Misurato sulla sorgente reale**, in sola lettura e su database usa e getta:
`relations` passa da 106 aggiornati e 2 errori a **108 e 0**; `media` da 1
errore a **0**; i due `apply` di fila restano identici.

**Due conseguenze che non erano scritte.**

1. **I redirect attesi diventano 181.** L'allegato 341 ora si importa, e la sua
   pagina allegato — presente in `url-matrix.csv`, oggi 301 verso il file —
   produce il suo redirect. `database-schema.md` §6 contava già l'allegato in
   `media` (178) ma non in `redirects` (180). Atteso corretto in codice e nei
   documenti, con la data.
2. **`relations` ora rispetta la protezione.** Prima riscriveva percorso,
   genitore, immagine in evidenza e termini anche dei contenuti che `contents`
   aveva saltato, e ne aggiornava `updated_at`: una copia di lavoro aperta su
   quel contenuto non si sarebbe più potuta pubblicare, perché il servizio
   confronta `base_updated_at` con `updated_at`. Il percorso attuale di un
   contenuto protetto è riservato **prima** del calcolo delle collisioni:
   altrimenti un contenuto più vecchio con lo stesso slug, comparso dopo, lo
   riceverebbe mentre il protetto lo occupa ancora.

**Rilievo aperto, non attuato.** Il servizio non scrive mai in
`content_revisions`: né la modifica né la pubblicazione di un contenuto lasciano
una riga di cronologia. Il criterio del §6.3 di `importer-spec.md` per il
contenuto pubblicato quindi **non scatta mai** per una modifica fatta
dall'area di gestione e poi pubblicata, una volta che la copia di lavoro è
stata consumata dalla pubblicazione. Correggerlo tocca `apps/api` o cambia il
criterio: è una decisione, non un'attuazione.

