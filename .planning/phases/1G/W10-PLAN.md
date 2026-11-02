# Piano della wave 1G-W10 — Rapporto, audit e richiesta di approvazione

> **Per chi esegue:** passi con caselle `- [ ]`. Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Nessuna scrittura sul
> collaudo, nessuna cancellazione, nessun commit senza la sua conferma.

Scritto il 2026-11-01, dopo la chiusura della `1G-W9` (`5c761ca`, CI 41204702969 verde).

**Obiettivo:** scrivere il rapporto del collaudo redazionale e l'audit della fase, con ogni
criterio 1G-1…1G-28 di [`CONTEXT.md`](CONTEXT.md) §7 eseguito; togliere i residui del
collaudo (1G-27); fermarsi e chiedere all'utente l'approvazione del collaudo redazionale
(condizione 7 del gate).

**Architettura.** Nessun codice applicativo. Documenti in `docs/qa/` e
`.planning/phases/1G/`; prove sul collaudo solo dove la `1G-W9` ha reso vecchia l'evidenza.
Metodo dell'audit come la 1E (DR-207): le verifiche brevi si rieseguono sul commit della
wave, le lunghe si citano con data e commit, insieme alla prova che il codice misurato non
è cambiato.

**Riferimenti:** skill `cms-editability-qa`; `acceptance-criteria.md` §5 e DR-290;
`collaudo-1G-W8.md`, `collaudo-1G-W9.md`, `W9-PLAN.md` §7; `.planning/phases/1E/AUDIT.md`
come modello.

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W10-1 | Matrice completa (1G-25) | ogni tipo dell'inventario è collaudato o dichiarato fuori perimetro con la fonte; nessuna riga «modificabile» senza esito; colonne minime della skill presenti |
| W10-2 | Caccia al contenuto nel codice aggiornata (1G-26) | i file del sito cambiati dopo `0dd1efb` esaminati; esito per file e riga in `contenuto-nel-codice.md` |
| W10-3 | Rapporto `docs/qa/cms-editability-report.md` | verdetto, copertura per tipo e ruolo, compiti con esito, tempo e chi li ha eseguiti, difetti nel formato della skill, campi volutamente non modificabili, contenuto nel codice, residui |
| W10-4 | `AUDIT.md` della fase | 1G-1…1G-28 ciascuno con «come è stato verificato» ed esito; nessun criterio in attesa |
| W10-5 | Residui rimossi e dichiarati (1G-27) | secondo D234; verifica dopo la rimozione |
| W10-6 | Richiesta di approvazione | commit e push con CI verde, poi **stop** |

## 2. Attività

### T1 — Matrice (W10-1)

- [x] Colonne della skill: `tipo` diventa `tipo_contenuto`, `atteso` diventa `editabile_atteso`, `esito_collaudo` diventa `esito`; si aggiungono `editabile_reale`, `ruolo`, `evidenza` e `severita`; restano `dove_si_modifica`, `compito` e `criterio`. Nessun programma legge il file.
- [x] Esiti della `1G-W9` sulle righe toccate da T1-T11b; righe nuove per i pannelli di «Media e testo» ed «Elenco di contenuti» (DR-320…DR-323).
- [x] Ogni `post_type` di `docs/migration/content-inventory.csv` (11 tipi) associato a righe della matrice, oppure dichiarato fuori perimetro con la fonte (DR-218, DR-033, rapporto di completezza dell'import).
- [x] Controllo con uno script fuori da Git: colonne presenti, nessuna riga «modificabile» senza esito, 11 tipi su 11 associati.

### T2 — Passata finale sul collaudo (W10-1, 1G-10, 1G-22)

Su conferma: accensione con `avvia.ps1`, account dell'agente (DR-291).

- [x] I tre campi «modificabile» mai collaudati: «apri in una scheda nuova» e «classi CSS» di una voce di menu; «che cosa copre» di un redirect. Ogni modifica si ripristina dall'area.
- [x] 1E-19 4/4 e prova dell'anteprima su `ec640c2`, secondo D235: la `1G-W9` ha cambiato il salvataggio dell'editor, e l'esito della `1G-W7` non lo copre.
- [x] Se D236 = A: su una pagina sintetica in bozza, creata ed eliminata dall'area, «Testo alternativo» di «Media e testo», «Categorie» e «Numero di notizie» di «Elenco di contenuti», verificati nell'anteprima; apertura nell'editor delle due bozze importate (DR-063, DR-064), senza salvare.
- [x] Console e risposte ≥ 400 ascoltate; riservatezza controllata; collaudo spento.

### T3 — Contenuto nel codice (W10-2)

- [x] Esame dei file del sito cambiati dopo `0dd1efb`: `apps/web/src/lib/settingsOnce.ts`, `apps/web/src/styles/blocks.css` e, in `packages/blocks/src/`, `render/Image.tsx`, `render/Slider.tsx`, `render/media.ts`, `sanitize/slide-title.ts`, `sanitize/index.ts`, `schema/image.ts`. Ogni testo visibile nuovo si elenca con la decisione che lo copre, oppure diventa un difetto.

### T4 — Rapporto (W10-3)

- [x] Verdetto nella forma della skill; copertura per tipo e ruolo.
- [x] 1G-1…1G-17 con esito, tempo e chi li ha eseguiti: l'utente HO-036…HO-038, l'agente gli altri. Si dichiara l'indebolimento accettato con DR-290: per i compiti dell'agente la condizione 7 attesta che la funzione riesce, non che la redazione ci riesce da sola.
- [x] 1D-28…1D-37, ciascuno con il riferimento alla matrice.
- [x] Difetti W8-01…W8-38 e W9-N1…W9-N8 nel formato della skill. Gravità: alta = bloccante, media = maggiore, bassa = minore. W9-N7 e W9-N8 sono rinviati alla 1F (DR-330, DR-336).
- [x] Campi volutamente non modificabili (DR-218), contenuto nel codice (T3), residui e loro rimozione (T6).
- [x] Sezione «Approvazione» vuota, con la formula proposta all'utente.

### T5 — Audit (W10-4)

- [x] 1G-1…1G-28 uno per uno. Si rieseguono le verifiche brevi sul commit della wave: e2e locali (1G-17, 1G-19, 1G-20), strumenti di menu, metadati, redirect e stati (1G-22). Le verifiche lunghe si citano: confronto integrale della T10 (1G-21), CI 41204702969 (1G-23).
- [x] 1G-18: esito delle revisioni di sicurezza della fase. Riserve della T11b: M1 corretto in parte (la richiesta fallita si ritenta, ma non si può interrompere e non ha un tetto di concorrenza); M2 (avviso «cambia subito sul sito» con proxy e cache in produzione) passa alla `1F-W4`.

### T6 — Residui (W10-5)

- [x] Secondo D234, con una conferma di cancellazione a parte (comando, file, impatto, copia, rientro, verifica). Prima si copiano fuori da Git i log dei server.
- [x] Verifica dopo la rimozione e dichiarazione nel rapporto.

### T7 — Chiusura (W10-6)

- [x] Commit e push su conferma; CI verde.
- [ ] **Stop**: richiesta all'utente dell'approvazione del collaudo redazionale, con la formula del rapporto. Dopo l'approvazione: HO-017 (DR-212), poi la Fase 1F (DR-337).

Ordine: T1 e T3 subito, senza ambiente; T2 dopo D235 e la conferma di accensione; T4 e T5
con gli esiti di T2; T6 dopo T5, così le prove sono raccolte prima di smontare; T7.

## 3. Decisioni

| Id | Domanda | Opzioni | Raccomandazione | Termine |
|---|---|---|---|---|
| **D234** | Come si tolgono i residui del collaudo (1G-27) | **A** — smontare l'ambiente con `crea.ps1 -Rimuovi` (database, bucket, copia di lavoro) e la cartella di stato con le credenziali dell'agente · **B** — togliere dall'area il media di prova e disattivare gli account dell'agente; l'ambiente resta · **C** — B adesso, A dopo l'approvazione della 1G | **A**: l'area non cancella gli account, quindi B lascia residui; il collaudo si ricrea con `crea.ps1` se servisse | prima di T6 |
| **D235** | Chi riesegue 1E-19 e la prova dell'anteprima su `ec640c2` | **A** — l'agente, con l'account di Redazione dell'agente sul collaudo · **B** — l'utente, con HO-035 aggiornato (come DR-265) · **C** — non rieseguirle e citare la `1G-W7` | **A**: la W9 ha cambiato il salvataggio dell'editor, quindi C non basta; l'agente usa già account sintetici (DR-290) | prima di T2 |
| **D236** | Si collaudano dall'interfaccia, nella T2, anche i campi nuovi della matrice senza un esito sul collaudo: «Testo alternativo» di «Media e testo», «Categorie» e «Numero di notizie» di «Elenco di contenuti» (DR-320…DR-323), e le due bozze importate (DR-063, DR-064) | **A** — sì: pagina sintetica in bozza creata ed eliminata dall'area, campi provati nell'anteprima senza pubblicare; le due bozze solo aperte · **B** — no: valgono le prove automatiche della T10b e la vista nell'elenco; il rapporto lo dichiara · **C** — solo i pannelli, non le bozze | **A**: la skill chiede il ciclo dall'interfaccia per ogni campo «modificabile»; la pagina sintetica non tocca contenuti reali e l'eliminazione è la stessa già fatta nella `1G-W9` (DR-326) | prima di T2 |
| **D238** | Tre difetti bassi nuovi della T2: **W10-N1** nell'albero «Elenco di contenuti» si chiama solo «elenco di contenuti», senza categorie né numero (`apps/admin/src/lib/editor/tree.ts:319`); **W10-N2** per le due bozze importate a percorso provvisorio la scheda «Indirizzo» mostra un «Indirizzo risultante» calcolato da slug e genitore, non il percorso attuale (`ContentAddressPanel.tsx:311-314`); **W10-N3** l'intestazione dell'editor di un contenuto senza titolo dice «Contenuto» invece di «Senza titolo» (`ContentEditor.tsx:445`) | **A** — rinviati alla `1F-W1` con W9-N7 e W9-N8 · **B** — corretti ora in una T2b (prove rosse, revisione, verifica come la CI, commit su conferma) · **C** — accettati senza correzione | **A**: nessuno impedisce o rallenta un compito; W10-N2 riguarda solo due bozze mai pubblicate; la wave non tocca il codice (§4) | prima di T4 |

## 4. Cosa la wave non fa

- Nessuna correzione di codice: un difetto nuovo trovato in T2 o T3 si classifica e si
  propone all'utente, come nella `1G-W9`.
- Nessun lavoro della 1F; nessuna scrittura sul database di sviluppo.
- Non dichiara approvato il collaudo: lo fa l'utente.

## 5. Rischi

| Rischio | Mitigazione |
|---|---|
| L'inoltro delle porte di Docker si rompe di nuovo (31 ottobre) | se l'avvio dà 503 o 500, controllo del database dall'host e riavvio dei soli contenitori |
| T2 trova una regressione di 1E-19 dopo la W9 | si ferma la wave, si classifica il difetto e si propone la correzione |
| Smontare il collaudo prima dell'approvazione toglie la possibilità di riguardarlo | si ricrea con `crea.ps1` sul commit della wave |
