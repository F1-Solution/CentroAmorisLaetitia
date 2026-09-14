# ADR-002 — Accesso al database e migrazioni

| | |
|---|---|
| **Stato** | **approvata** il 2026-09-14 con DR-038 (approvazione in blocco) |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | con quale strumento si definisce lo schema, si migra e si interroga PostgreSQL |
| **Origine** | D5, confermata da DR-035; vincolato da DR-036 |

---

## 1. Contesto

PostgreSQL è imposto da DR-001. Lo strumento di accesso è lasciato a una ADR.

Vincoli che restringono davvero il campo:

| Vincolo | Fonte | Effetto |
|---|---|---|
| Schema in **inglese snake_case**, allineato ai nomi dei modelli | DR-036 | Una convenzione unica, senza doppio nome mantenuto a mano |
| L'importer deve essere **idempotente**, con dry-run e mapping degli ID sorgente | Fase 1B-W4 | Servono `INSERT … ON CONFLICT`, transazioni esplicite, operazioni in blocco |
| Il contenuto è un documento a blocchi | ADR-005 | Serve `jsonb` con indici GIN, non una colonna di testo |
| Il CMS deve permettere di cercare fra i contenuti | RC-03 | Serve la ricerca full-text di PostgreSQL (`tsvector`), in italiano |
| 170 media, 78 pagine, 29 articoli | 1A | I volumi non sono un criterio: la comodità di sviluppo sì |
| Team di una persona | RB-03 | Il tempo speso a combattere lo strumento è tempo tolto alla parità |

Il punto delicato è **DR-036**. La decisione dell'utente elimina il doppio nome
italiano/inglese, ma resta il divario fra la convenzione di PostgreSQL
(`snake_case`) e quella di TypeScript (`camelCase` per le proprietà). Uno strumento
che risolve questo divario per convenzione costa meno di uno che lo risolve
annotazione per annotazione.

## 2. Opzioni

### Opzione A — Prisma

- **A favore:** le migrazioni sono la parte più matura dell'ecosistema Node; lo
  schema è leggibile anche da chi non conosce lo strumento; Prisma Studio consente
  di ispezionare i dati durante la migrazione, cosa non trascurabile mentre si
  verifica un import di 107 contenuti; documentazione ottima.
- **Contro:** per ottenere colonne `snake_case` con proprietà `camelCase` serve
  `@map` su **ogni campo** e `@@map` su ogni modello — precisamente l'attrito che
  D7 segnalava, riproposto in altra forma. Le funzionalità specifiche di PostgreSQL
  che a questo progetto servono davvero — `tsvector` generato, indici GIN su
  `jsonb`, indici parziali — vivono fuori dal modello e vanno scritte in
  migrazioni SQL a mano, che poi Prisma non conosce. Aggiunge un motore di query
  proprio all'immagine Docker.
- **Costo:** basso all'inizio, crescente dove servono funzionalità di PostgreSQL.

### Opzione B — Drizzle ORM

- **A favore:** lo schema si dichiara in TypeScript e produce SQL prevedibile;
  l'opzione `casing: 'snake_case'` rende la convenzione di DR-036 **automatica**,
  senza annotazioni per campo; `tsvector`, `jsonb`, indici GIN e indici parziali si
  esprimono nello schema, non fuori; `INSERT … ON CONFLICT` e le operazioni in
  blocco che servono all'importer sono di prima classe; nessun motore aggiuntivo
  nell'immagine.
- **Contro:** le migrazioni (`drizzle-kit`) sono meno mature di quelle di Prisma e
  in alcune modifiche di schema richiedono la revisione manuale del file generato —
  il che, va detto, è comunque una buona pratica. Ecosistema più giovane e
  documentazione meno completa. Nessun equivalente diretto di Prisma Studio.
- **Costo:** basso, con una curva iniziale un po' più ripida.

### Opzione C — Kysely più uno strumento di migrazione separato

- **A favore:** query builder tipizzato, molto vicino a SQL, nessuna magia.
- **Contro:** non definisce lo schema: i tipi si generano dal database o si scrivono
  a mano, e le migrazioni sono interamente a carico di chi scrive. Per una persona
  sola è lavoro aggiuntivo che nessuno dei due precedenti richiede.
- **Costo:** medio, costante nel tempo.

## 3. Scelta proposta

**Opzione B — Drizzle ORM**, con `drizzle-kit` per le migrazioni.

Motivi, in ordine di peso:

1. **Attua DR-036 per convenzione**, non per annotazione. È l'unica delle tre che
   rende la decisione dell'utente gratuita invece che costosa.
2. Le funzionalità di PostgreSQL su cui questo CMS si regge — `jsonb` per i blocchi,
   `tsvector` per la ricerca in italiano, indici GIN e parziali — stanno **dentro**
   lo schema, quindi restano visibili, versionate e verificabili.
3. L'importer è la componente più delicata della Fase 1D: ha bisogno di transazioni
   esplicite, upsert e inserimenti in blocco, che qui non sono una via di fuga ma
   l'uso normale dello strumento.
4. Un contenitore in meno da mantenere e aggiornare, su un progetto sorvegliato da
   una persona sola.

## 4. Alternativa scartata e motivo

**Prisma** è scartato per due ragioni concrete, non per gusto: il costo per campo
imposto da DR-036, e il fatto che le funzionalità di PostgreSQL che servono a questo
progetto finirebbero in migrazioni SQL scritte a mano e non rappresentate nel
modello — cioè una seconda fonte di verità, che è esattamente ciò che una
migrazione non può permettersi.

Si riconosce il costo dello scarto: si rinuncia a migrazioni più mature e a Prisma
Studio. Il primo si compensa rivedendo a mano le migrazioni generate, che è pratica
corretta in ogni caso; il secondo con un client SQL qualunque, dato che l'ispezione
dei dati importati va comunque fatta con query, non a occhio.

**Kysely** è scartato perché scaricherebbe sulla persona sola la definizione dello
schema e l'intera infrastruttura di migrazione.

## 5. Conseguenze

**Più facile:** ricerca full-text in italiano; validazione e indicizzazione dei
blocchi `jsonb`; importer idempotente; allineamento automatico alla convenzione di
DR-036.

**Più difficile:** ogni modifica di schema richiede di **leggere** la migrazione
generata prima di applicarla. Va reso obbligatorio, non lasciato alla diligenza.

**Nuove dipendenze:** `drizzle-orm`, `drizzle-kit`, `postgres` o `pg`. Nessun costo
di licenza.

## 6. Reversibilità

**Bassa-media.** Lo schema SQL è indipendente dallo strumento e non si perde: a
cambiare sarebbe il livello di accesso, cioè i servizi di dominio dell'ADR-001. È
il tipo di riscrittura che si fa una volta e non si vuole rifare: la decisione va
presa ora e non rimessa in discussione senza un motivo forte.

## 7. Verifica

Alla chiusura della Fase 1C si controlla che: le colonne del database siano davvero
in `snake_case` senza annotazioni per campo; esista una migrazione iniziale
applicabile da zero e rieseguibile; la ricerca full-text risponda su un contenuto di
prova con dati **sintetici**. Se la convenzione richiedesse annotazioni manuali, il
vantaggio principale è venuto meno e la scelta va riaperta.
