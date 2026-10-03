# HO-008 — Conferma dell'import reale in locale (`1D-W11c`)

Fase 1D, wave `1D-W11b`. Scritto il 2026-10-03, dopo l'esecuzione di `plan` sul
database `amoris` ricreato vuoto (DR-086). Aggiornato lo stesso giorno dopo la
correzione `1D-W11a-bis` e un secondo `plan` (§3.2, §3.3).

Questo documento chiede **due conferme distinte, in quest'ordine**. La seconda è
la conferma di DR-072 e si dà sui conteggi veri, non su una descrizione.

---

## 1. Che cosa è stato eseguito

| Passo | Esito |
|---|---|
| Copia di salvataggio del database `amoris`, fuori dal repository (`~/amoris-backup/amoris-prima-1D-W11b-2026-09-30.dump`) | fatta e verificata leggibile: 232 voci, 34 tabelle con dati |
| `DROP DATABASE amoris WITH (FORCE)` e `CREATE DATABASE amoris OWNER amoris TEMPLATE template1` | fatti |
| `pnpm db:migrate`, `pnpm db:verify` | 3 migrazioni applicate; schema identico alla forma canonica |
| `contents`, `media`, `import_runs` | 0, 0, 0 |
| `importer plan --verbose` | preflight: 8 controlli su 8 superati. Esito: **`partial`** — vedi §3 |

`plan` non ha scritto nulla: né `import_runs`, né `import_issues`, né il bucket.

Il rapporto è stato **letto prima di essere mostrato** (RD-12): contiene solo
conteggi e nomi di fase. Le anomalie sono state elencate con uno script
temporaneo fuori dal repository, che stampa gravità, fase, codice e dettaglio
— un vocabolario chiuso — senza alcun contenuto e senza identificatori di
compilazioni.

## 2. Conteggi veri accanto agli attesi

| Tabella | Attesi (`database-schema.md` §6) | Ottenuti da `plan` | Esito |
|---|---|---|---|
| `contents` | 108 | 108 | coincide |
| `media` | 178 | 170 dalla fase `media` + 8 dalla fase `documents` | coincide; nessuna differenza di tabella segnalata dalla verifica |
| `media_variants` | circa 1.376 | **1.287** | stima, vedi §4 |
| `terms` | 4 | 4 | coincide |
| `menu_items` | 64 | 64 | coincide |
| `redirects` | 181 | 181 | coincide |
| `forms` | 25 | 25 | coincide |
| `form_notifications` | 39 | nessuna differenza segnalata | coincide |
| `form_submissions` | 425 | 425 | coincide |
| `documents` | 8 | 8 | coincide |
| `slider_slides` | 12 | 12 | coincide |
| `users` | 1 | 1 | coincide |
| `content_seo` | 2 | 2 | coincide |
| `settings` | 15 | 15 | coincide |

La verifica delle tabelle (`table-count-mismatch`) **non ha segnalato alcuna
differenza**: tutte le dodici tabelle con un atteso intero coincidono.

**Blocchi di riserva** (ADR-005 §3.4): 8 su 577 blocchi, **2,62 %** contro la
soglia del 10 %; **5 contenuti su 108** contro la soglia di 15. Entrambe
rispettate, come misurato nella `1D-W10`.

**Conversione:** 64 Gutenberg, 40 Divi, 4 HTML.

## 3. Perché l'esito era `partial`, e che cosa è cambiato

### 3.1 Primo `plan` (2026-10-03, mattina)

Una sola riga di gravità `error`: la verifica **«contenuti senza percorso»**
contava **2**, cioè i due contenuti di DR-063 (332) e DR-064 (1781), che dalla
`1D-W11a` restano al percorso provvisorio **per decisione**.

### 3.2 Correzione `1D-W11a-bis` — confermata e attuata il 2026-10-03

- La verifica usa ora lo stesso calcolo dei percorsi della fase `relations`
  (estratto in un modulo condiviso, non copiato): esclude i contenuti che quel
  calcolo lascia al percorso provvisorio di proposito; ogni altro contenuto
  rimasto al percorso provvisorio continua a farla fallire.
- Due prove sintetiche nuove: i due casi non contano (0), una pagina riportata
  a mano al percorso provvisorio conta (1). Col codice precedente davano 2 e 3:
  falliscono come dovevano.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: verdi.
- `pnpm test`: **2 prove fallite su 272 dell'importer**, entrambe sulla
  protezione del lavoro redazionale (DR-068). **Falliscono identiche anche sul
  codice precedente alla correzione**: l'orologio del container PostgreSQL è
  circa **1 secondo indietro** rispetto a quello di Windows (misurato: −980 /
  −1.022 ms), e le prove si aspettano uno scarto di 20 ms.
- Dopo il riallineamento dell'orologio (DR-089, scarto misurato 0 ms):
  `pnpm test` **verde**, 8 pacchetti su 8, 272 prove su 272 nell'importer.
  Correzione committata insieme a questo documento.

### 3.3 Secondo `plan` (2026-10-03, pomeriggio)

Database ancora vuoto prima e dopo (`contents`, `media`, `import_runs`,
`import_issues`: 0, 0, 0, 0). Preflight 8 su 8. Conteggi identici al §2.

| Verifica | Primo `plan` | Secondo `plan` |
|---|---|---|
| contenuti senza percorso | 2 — `error` | **0** — superata |
| tutte le altre sei eseguibili | 0 | 0 |
| file nel bucket / file attesi | non eseguita | non eseguita |

**Esito: ancora `partial`.** La causa residua è una sola, e il §3 della prima
versione di questo documento l'aveva mancata: la regola dell'esito tratta una
verifica **non eseguita** come una verifica fallita, e «file nel bucket / file
attesi» non è mai eseguibile, perché lo strumento di archiviazione dell'importer
sa solo caricare, non elencare. Con il codice attuale **nessuna esecuzione può
dare `success`**, né `plan` né `apply`: il criterio di uscita 4 di
`W11-PLAN.md` è irraggiungibile. Serve una decisione (§6, D17).

### 3.4 Terzo `plan`, dopo la `1D-W11d` (2026-10-03, sera)

Attuate DR-088, DR-090, DR-091 e DR-092 (`W11d-PLAN.md`): l'importer elenca il
bucket, e tutte le ore che la protezione del lavoro redazionale confronta
vengono dall'orologio del database. Revisione del codice: nessun rilievo
critico o alto. `pnpm test`, `lint`, `typecheck`, `format:check` verdi: 8
pacchetti su 8, 280 prove nell'importer, 120 nell'API.

Database vuoto prima e dopo (0, 0, 0, 0). Conteggi identici al §2. Tutti gli
errori per fase a 0, soglie dei blocchi di riserva rispettate, le sette
verifiche eseguibili a 0. **Esito `partial` per una sola ragione, dichiarata e
attesa:** «file nel bucket / file attesi — non eseguita», perché `plan` non
carica file (DR-088). In `apply` quella verifica **si esegue** e l'esito può
essere `success`.

## 4. Le altre anomalie, tutte di gravità `warning`

| Anomalia | Quante | Significato |
|---|---|---|
| `content-path-provisional` | 2 | 332 per collisione, 1781 per slug vuoto: DR-063 e DR-064 attuate |
| `source-file-case-mismatch` | 1 originale + 9 misure derivate | tutte dell'allegato 341: DR-065 attuata, e il `srcset` è coerente |
| `redirect-unresolved-target` | 1 | la settima riga di `_wp_old_slug`, che riguarda un `wpforms` senza URL pubblico; si scarta come previsto da `wp-to-postgres-mapping.md` §3.3 |
| `verification-check-not-executed` | 1 | «file nel bucket / file attesi»: lo strumento di archiviazione non sa elencare il bucket. Era già dichiarato |

**`media_variants`: 1.287 invece di circa 1.376.** L'atteso è una stima
dichiarata come tale (`wp-to-postgres-mapping.md` §3.4) e non entra nella
verifica. Nessuna misura derivata citata dai metadati manca sul disco: non c'è
alcun avviso di file mancante. In più, 7 misure derivate sono condivise da due
allegati e producono una sola riga. Lo scostamento va nel rapporto di
completezza con questo motivo, non corretto.

## 5. Che cosa farà `apply --confirm`, quando sarà confermato

```
pg_dump del database amoris in ~/amoris-backup/   # copia di salvataggio, prima
pnpm --filter @amoris/importer start apply --confirm
pnpm --filter @amoris/importer start apply --confirm   # seconda esecuzione: idempotenza
pnpm --filter @amoris/importer start rollback --run <id>   # SENZA --confirm: solo il piano
```

| Voce | Contenuto |
|---|---|
| File coinvolti | nessun file del repository. Scrive nel database `amoris` e nel bucket MinIO locale |
| Impatto | il database locale conterrà **425 compilazioni con dati personali reali** e **187 destinatari** nel registro delle email storiche (DR-073). Da quel momento ricreare il volume o riseminare non sono più operazioni indolori |
| Bucket | `plan` non lo tocca. `apply` vi carica 170 originali, 1.287 misure derivate e i file dei documenti. Oggi contiene **10 oggetti nel bucket pubblico**, tutti sotto `2026/` come quelli del seme sintetico, e **0 nel riservato** (contati il 2026-10-03, solo il numero). Restano, e non fanno fallire la verifica (DR-092) |
| Copia di salvataggio | `pg_dump` del database subito prima |
| Come si torna indietro | `importer rollback --run <id> --confirm`, oppure il ripristino della copia con `pg_restore` |
| Verifica successiva | esito `success`, con «file nel bucket» **eseguita** e a 0; conteggi del §2 uno per uno; la seconda esecuzione non crea nulla; il piano di `rollback` esiste |

Restano aperte, e non si dichiarano risolte: **MI-06** (verifica privacy e
legale, serve un professionista) e la conformità di cifratura, conservazione e
cancellazione (`database-schema.md` §7 regola 5).

## 6. Decisioni del 2026-10-03 e che cosa ti chiedo adesso

Registrate nei Round 19 e 20 del registro: DR-088, DR-089, DR-090, DR-091,
DR-092. Tutte attuate (§3.2, §3.4).

**Ti chiedo ora la conferma di DR-072:** `apply --confirm` due volte, sui
conteggi del §2 e con l'esito del §3.4, eseguendo i comandi del §5. Prima di
`apply` farò la copia di salvataggio con `pg_dump`; dopo, ti riporterò l'esito
e i conteggi uno per uno, e mi fermerò.

### 6.1 Come si riallinea l'orologio (fatto il 2026-10-03)

Prerequisito: nessun comando dell'importer in corso.

1. Chiudi Docker Desktop dall'icona nell'area di notifica (*Quit Docker Desktop*).
2. In PowerShell: `wsl --shutdown`
3. Riapri Docker Desktop e attendi che sia «Engine running».
4. Dalla radice del repository: `pnpm compose:up`. **Non** usare
   `pnpm compose:reset`, che cancella i volumi. Il 2026-10-03 questo comando ha
   fallito sul servizio che crea i bucket (immagine non più scaricabile, 401),
   ma database e archiviazione erano già ripartiti da soli: va bene così.

Esito atteso: i container `amoris-dev-db-1` e `amoris-dev-objects-1` sono di
nuovo attivi; i dati restano, perché vivono nei volumi.

Se fallisce: riavvia Windows, che riallinea comunque l'orologio della macchina
virtuale. Se i container non ripartono, non ricreare i volumi: segnalalo.

## 7. Come segnalare il completamento

Nel prompt successivo:

```
HO-008 punto 2: confermo apply --confirm due volte sui conteggi mostrati.
```
