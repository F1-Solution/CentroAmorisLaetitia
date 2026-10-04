# `1D-W11` — Import reale in locale

Piano della wave, **da approvare prima di eseguirlo**. Scritto il 2026-09-24,
dopo la chiusura della `1D-W10`.

Il piano di fase (`PLAN.md` §2) descrive la `1D-W11` come «esecuzione reale in
locale: `plan`, poi `apply --confirm`, poi `apply --confirm` di nuovo; rapporto
di completezza». Questo documento la scompone, perché fra il punto in cui siamo
e quell'esecuzione stanno **quattro attuazioni** che il registro delle decisioni
dichiara dovute «prima della wave `1D-W11`».

---

## 1. Che cosa rilascia la wave

1. I due contenuti anomali della sorgente entrano come bozze con un percorso
   provvisorio, e nessun indirizzo pubblico viene inventato (DR-063, DR-064).
2. L'allegato che il database cerca con maiuscole diverse da quelle del file
   viene ritrovato e archiviato con la chiave che database e contenuti già
   citano (DR-065).
3. Rieseguire l'import non distrugge il lavoro di un redattore **in nessuno dei
   due luoghi** in cui quel lavoro può trovarsi: il contenuto pubblicato e la
   copia di lavoro introdotta da DR-068.
4. L'import gira davvero sulla sorgente del 2026-09-13, due volte, e i conteggi
   coincidono con quelli dichiarati in `database-schema.md` §6.
5. `docs/migration/import-completeness-report.md` — **soli conteggi**.

## 2. Correzione dichiarata al piano di fase

`PLAN.md` §3 assegna alla `1D-W11` «nessun file sorgente; scrive solo
`docs/migration/import-completeness-report.md`». È vero per l'esecuzione, non
per le quattro attuazioni che la precedono, che sono codice in
`apps/importer/src/**` e prove. La riga va corretta così: il vincolo «nessun
file sorgente» vale per `1D-W11b` e `1D-W11c`; `1D-W11a` tocca l'importer.

È la quinta volta nella fase che una decisione registrata allarga il perimetro
dichiarato dal §2. Si dichiara qui invece di essere smentito in silenzio.

---

## 3. `1D-W11a` — le quattro attuazioni dovute

Nessuna di queste tocca dati reali: si provano su dati sintetici e sulla
sorgente in **sola lettura**.

| # | Decisione | Che cosa cambia | Dove |
|---|---|---|---|
| 1 | **DR-063** | Il contenuto `wp_posts` 332, che condivide lo slug con la pagina 328, resta **bozza** con il percorso provvisorio che include `legacy_id`. La pagina 328 conserva il suo indirizzo | fase `relations`, calcolo del percorso definitivo |
| 2 | **DR-064** | Il contenuto `wp_posts` 1781, bozza senza titolo e senza slug, resta **bozza** con percorso derivato da `legacy_id`, mai pubblicata | stesso punto |
| 3 | **DR-065** | Il file di un allegato si cerca **senza distinguere maiuscole e minuscole**, e si archivia con la chiave che database e contenuti già usano. La stessa regola vale per tutte e dieci le misure derivate, perché il `srcset` resti coerente | risoluzione del file in `uploads/`, originale e varianti |
| 4 | **DR-068** | La protezione del lavoro redazionale si estende alla copia di lavoro: un contenuto con una bozza più recente dell'ultima esecuzione riuscita **non si sovrascrive**, produce un avviso e compare in testa al rapporto | protezione già esistente per il contenuto pubblicato, e il piano di annullamento che la usa |

**Prove che la wave deve portare**, tutte su dati sintetici:

- i due percorsi provvisori sono unici, non pubblici, e non tolgono l'indirizzo
  alla pagina 328;
- la ricerca insensibile alle maiuscole trova il file e **non** rinomina la
  chiave — il divieto di ADR-004 §3.1 resta rispettato, ed è la ragione per cui
  DR-065 è formulata così;
- un contenuto con una copia di lavoro recente viene saltato, l'avviso c'è, e
  `--force-content` lo sovrascrive comunque;
- la stessa protezione vale per l'annullamento di un'esecuzione.

**Esito atteso:** `pnpm test` verde, più `pnpm lint` e `pnpm typecheck`.

## 4. `1D-W11b` — `plan`, e poi ci si ferma

`plan` **non scrive nulla**: né in `import_runs`, né in `import_issues`, né nel
bucket. È la ragione per cui DR-072 lo colloca prima della conferma.

**Prima di eseguirlo** va preparato l'ambiente, e qui c'è un'azione distruttiva
che richiede conferma: il database locale di sviluppo contiene oggi il **seme
sintetico**, e i conteggi del §6 di `database-schema.md` si possono verificare
solo su uno schema vuoto. Il database va quindi ricreato e migrato prima
dell'import. Si perdono dati sintetici, ricreabili con `pnpm db:seed`, ma resta
una cancellazione e come tale si chiede.

Lo strumento che la `1D-W10` ha introdotto per ricreare un database **non serve
qui, ed è giusto così**: si rifiuta di toccare un nome che non finisca per
`_e2e` o `_test`, e il database di sviluppo si chiama `amoris`. Il database
vuoto si ottiene per una delle due strade sotto, che sono entrambe distruttive
e vanno confermate; la seconda lascia in piedi i volumi.

```
pnpm compose:up

#  a) si ricrea il volume:  pnpm compose:reset && pnpm compose:up
#  b) si ricrea il solo database `amoris` da psql

pnpm db:migrate
pnpm db:verify
pnpm --filter @amoris/importer start plan --verbose
```

Poi, nell'ordine:

1. Il rapporto **si legge prima di mostrarlo**. RD-12 vieta che righe di dati
   personali escano dal database, e un rapporto che elenca anomalie potrebbe
   citarne: le 425 compilazioni sono la categoria che RN-02 equipara alla
   privacy medica. Se il rapporto contiene dati personali, si riportano i soli
   conteggi e si dichiara che cosa è stato omesso.
2. I conteggi veri si mettono accanto a quelli attesi, riga per riga.
3. **La wave si ferma.** Si produce `docs/handoff/HO-008`, con comando esatto,
   file coinvolti, impatto, backup, rollback e verifica successiva, e si chiede
   la conferma di DR-072 — che è una conferma **sui conteggi**, non sulla
   descrizione.

### Conteggi attesi, da `database-schema.md` §6

| Tabella | Attesi |
|---|---|
| `contents` | 108 |
| `media` | 178 |
| `media_variants` | circa 1.376 |
| `terms` | 4 |
| `menu_items` | 64 |
| `redirects` | 181 — era 180; vedi la nota sotto |
| `forms` | 25 |
| `form_notifications` | 39 |
| `form_submissions` | 425 |
| `documents` | 8 |
| `slider_slides` | 12 |
| `users` | 1 |
| `seo_templates` | circa 7 |
| `content_seo` | 2 |

**Nota del 2026-09-30, `1D-W11a`.** L'atteso di `redirects` passa da 180 a 181
come conseguenza aritmetica di DR-065: l'allegato 341 ora si importa, e la sua
pagina allegato — che `url-matrix.csv` elenca e che oggi risponde 301 — produce
il suo redirect. `media` a 178 contava già quell'allegato; `redirects` no.

Più le due soglie di ADR-005 §3.4 sui blocchi di riserva, che la `1D-W10` ha
misurato a 8 su 305 — 2,62 % su 5 contenuti — e che l'esecuzione vera deve
confermare.

## 5. `1D-W11c` — `apply --confirm`, due volte

**Non parte senza la conferma puntuale.** Se arriva:

```
pg_dump ...                                            # copia di salvataggio, prima
pnpm --filter @amoris/importer start apply --confirm
pnpm --filter @amoris/importer start apply --confirm   # seconda esecuzione
```

| Passo | Che cosa si verifica |
|---|---|
| prima esecuzione | esito `success` — non `partial`, che basta una sola riga di gravità `error` a produrre. Conteggi uno per uno. Soglie dei blocchi di riserva |
| seconda esecuzione | **idempotenza**: nessun contenuto creato, nessun duplicato, i conteggi non si muovono |
| annullamento | il piano di `rollback --run <id>` si ispeziona **senza** `--confirm`, per avere la prova che la via di ritorno esiste |

Poi si scrive `docs/migration/import-completeness-report.md`: **soli conteggi,
atteso contro ottenuto, e l'elenco degli scostamenti con il motivo**. Nessuna
riga di dato, nessun titolo di compilazione, nessun indirizzo di posta.

## 6. Che cosa la wave lascia dietro di sé, e va detto

- **Il database locale conterrà 425 compilazioni con dati personali reali**, più
  187 destinatari nel registro delle email storiche. È la conseguenza accettata
  di DR-073: restano lì fino al responso del professionista di MI-06. Da quel
  momento ricreare il volume o riseminare il database non sono più operazioni
  indolori, e la wave deve dirlo nel rapporto.
- **Nessuna dichiarazione di conformità.** Cifratura a riposo, tempi di
  conservazione e procedura di cancellazione restano non validati
  (`database-schema.md` §7 regola 5). MI-06 resta aperta.
- **La differenza prodotta da DR-065 va dichiarata**, non nascosta: se la
  verifica di parità conferma che quell'immagine è rotta anche sul sito attuale,
  il sito nuovo ne mostrerà una dove il vecchio non la mostra, e la riga va in
  `docs/qa/visual-parity-report.md` con il motivo.

## 7. Criteri di uscita della wave

1. `pnpm test`, `pnpm lint`, `pnpm typecheck` verdi dopo `1D-W11a`.
2. Il rapporto di `plan` è stato letto prima di essere mostrato.
3. La conferma di DR-072 è stata data sui conteggi veri, ed è tracciata.
4. L'esito della prima esecuzione è `success`.
5. La seconda esecuzione non muove alcun conteggio.
6. Ogni conteggio del §6 coincide, o lo scostamento è dichiarato con il motivo.
7. `import-completeness-report.md` non contiene alcun dato personale.
8. `PROGRESS.md` porta una riga per ciascuna sotto-wave.

## 8. Che cosa la wave **non** fa

Non tocca la produzione, non tocca DNS né email, non installa nulla sul server,
non dichiara superato il gate di `CLAUDE.md`, non avvia alcuna fase gestionale.
L'import è **locale**.

## 9. Audit dei criteri di uscita — 2026-10-04

Eseguito prima di dichiarare chiusa la wave. **La wave non è ancora dichiarata
chiusa**: lo fa l'utente.

| # | Criterio (§7) | Esito | Prova |
|---|---|---|---|
| 1 | `pnpm test`, `lint`, `typecheck` verdi dopo `1D-W11a` | ✅ | verdi dopo `1D-W11a-bis` e di nuovo dopo `1D-W11d` (commit `9df3e57`, `4aa0799`): 8 pacchetti, 280 prove nell'importer, 120 nell'API |
| 2 | Rapporto di `plan` letto prima di mostrarlo | ✅ | tre `plan` del 2026-10-03, HO-008 §1, §3.3, §3.4 |
| 3 | Conferma di DR-072 data sui conteggi veri e tracciata | ✅ | registro §28, con le parole dell'utente |
| 4 | Esito della prima esecuzione `success` | ✅ | `import-completeness-report.md`, intestazione e §4; reso raggiungibile da DR-088 |
| 5 | La seconda esecuzione non muove alcun conteggio | ✅ | rapporto §1 e §6 |
| 6 | Ogni conteggio coincide o lo scostamento è motivato | ✅ | rapporto §2: `media_variants` (stima), `seo_templates` (DR-040), `redirects` (DR-065) |
| 7 | Il rapporto di completezza non contiene dati personali | ✅ | soli conteggi, codici di anomalia e identificativi di esecuzione |
| 8 | `PROGRESS.md` porta una riga per sotto-wave | ⚠️ sanato | la riga di `1D-W11b` mancava ed è stata aggiunta nell'audit, con la nota del ritardo |

**Rilievi dell'audit:**

- `ROADMAP.md` indica per la `1D-W11` l'uscita `docs/migration/import-report.md`;
  questo piano (§1 punto 5) e la richiesta dell'utente dicono
  `import-completeness-report.md`, che è il file scritto. La riga della
  roadmap va allineata.
- Il §5 del piano descriveva `rollback --run <id>` come via di ritorno. Dopo la
  seconda esecuzione non lo è più: l'annullamento della prima è rifiutato per
  costruzione (`importer-spec.md` §9). La via reale è il ripristino della copia
  (rapporto §8).
- Il perimetro della wave si è allargato due volte oltre `apps/importer`
  (`1D-W11a-bis`, `1D-W11d` con `apps/api` e `packages/db` per DR-091), sempre
  su decisione registrata.

