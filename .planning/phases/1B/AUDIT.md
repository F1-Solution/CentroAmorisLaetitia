# AUDIT — Fase 1B

Eseguito il 2026-09-14, **prima** di dichiarare la fase completa, come impone
`CLAUDE.md` («Prima di qualunque completamento di milestone o fase, eseguire prima
il passo di audit e validazione»).

Verifica i criteri di uscita di [`CONTEXT.md`](CONTEXT.md) §7. Controlli eseguiti in
modo automatico dove possibile, non per affermazione.

---

## 1. Esito

| | |
|---|---|
| Controlli eseguiti | **19** |
| Superati alla prima esecuzione | 13 |
| Difetti trovati e **corretti** | 6 |
| Superati dopo la correzione | **19 su 19** |

## 2. Criteri di uscita di `CONTEXT.md` §7

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1 | Ogni ADR ha contesto, opzioni, alternativa scartata, conseguenze, stato dichiarato | controllo automatico delle sezioni su tutti e 10 i file | ✅ 10 su 10 |
| 2 | Ogni tabella dello schema è riconducibile a un requisito | tabella di tracciabilità in `database-schema.md` §3 | ✅ 29 su 29 |
| 3 | Ogni colonna sorgente ha destinazione o motivo di esclusione | le **137 chiavi meta distinte** estratte dal database e confrontate con il mapping | ✅ 137 su 137 |
| 4 | L'importer dichiara cosa accade rieseguendolo due volte | `importer-spec.md` §1 e §6 | ✅ |
| 5 | Ogni shortcode Divi ha destinazione dichiarata | controllo automatico sui 10 shortcode misurati, più i 12 blocchi Gutenberg | ✅ 22 su 22 |
| 6 | Soglie numeriche e motivate; viewport e browser fissati | 6 viewport dichiarate, soglie 0,10% / 0,50% / 32 × 32 px, motore di resa unico con versione fissata | ✅ |
| 7 | 4 proposte di UI e 4 di UX, su dati sintetici | due documenti prodotti, **32 rapporti di contrasto ricalcolati**, nessun dato reale | ✅ |
| 8 | `PROGRESS.md` ha una riga per wave | 8 righe su 8 | ✅ |

## 3. Verifiche aggiuntive, non richieste dai criteri

| # | Verifica | Esito |
|---|---|---|
| 9 | Lo schema SQL si applica davvero su PostgreSQL 17 | ✅ applicato in un container temporaneo, poi distrutto |
| 10 | I vincoli dello schema respingono ciò che devono | ✅ 4 su 4 provati con dati sintetici |
| 11 | I 107 percorsi reali rispettano il vincolo di forma | ✅ 107 su 107 |
| 12 | Tutti i collegamenti relativi fra documenti si risolvono | ✅ dopo correzione |
| 13 | I riferimenti a sezioni di altre ADR esistono davvero | ✅ dopo correzione |
| 14 | Nessun indirizzo email reale nei documenti nuovi | ✅ |
| 15 | Nessun dato reale nelle proposte di design | ✅ |

## 4. I sei difetti trovati, e come sono stati corretti

Elencati perché un audit che non trova nulla non è un audit.

| # | Difetto | Correzione |
|---|---|---|
| 1 | **ADR-007 priva della sezione «Conseguenze»**, richiesta dalla struttura dichiarata nell'indice | sezione aggiunta, sezioni successive rinumerate |
| 2 | **ADR-009 senza sezione «Opzioni» né alternativa scartata**: presentava una forma senza mostrare le alternative valutate | aggiunte tre opzioni reali e il motivo dello scarto |
| 3 | **ADR-010 senza sezione «Scelta proposta»**: la scelta era implicita nel testo | aggiunta la sezione, con lo scarto esplicito della terza strada |
| 4 | **Sette chiavi meta non classificate** nel mapping: `_menu_item_xfn` e sei chiavi `_aioseo_*` vuote | classificate con il motivo dell'esclusione |
| 5 | **Un collegamento rotto** in `ui-proposals.md`: un mockup usava la sintassi di un'immagine reale | riscritto come testo del mockup |
| 6 | **Un rapporto di contrasto errato** nelle proposte di UI: `2.3:1` invece di `2.75:1` | corretto. La conclusione non cambia |

Il difetto 4 è il più significativo: sono esattamente le chiavi che l'importer
avrebbe lasciato cadere senza che nessuno se ne accorgesse. Il controllo automatico
sulle chiavi meta, previsto dal preflight dell'importer
(`importer-spec.md` §5, controllo 3), esiste proprio per questa classe di errore, e
qui ha funzionato già in fase di progetto.

## 5. Cosa questo audit **non** dimostra

- Non dimostra che le scelte architetturali siano giuste: dimostra che sono
  **argomentate, tracciate e reversibili nei limiti dichiarati**.
- Non dimostra che la conversione dei contenuti funzionerà: lo dimostrerà la Fase 1D
  con i conteggi.
- Non dimostra alcuna conformità GDPR o fiscale, che richiede validazione umana
  (MI-06).
- Non sostituisce l'approvazione dell'utente, che resta l'unico atto che rende
  vincolanti le dieci ADR.

## 6. Stato del gate di Fase 1 dopo questa fase

**NON SUPERATO.** Restano soddisfatte due condizioni su quindici — la 1 e la 2, più
la 8 completata dai sei slug storici trovati in `1B-W3` — e riguardano la conoscenza
della sorgente, non il prodotto.

La Fase 1B non fa avanzare il gate: **lo rende misurabile**, definendo i criteri con
cui le condizioni da 3 a 15 saranno verificate.
