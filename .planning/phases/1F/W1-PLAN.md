# Piano della wave 1F-W1 — Residui della 1G (W9-N7, W9-N8)

> **Per chi esegue:** passi con caselle `- [ ]`. Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Prima la prova che fallisce,
> poi il codice. Nessun commit senza la sua conferma.

Scritto il 2026-11-03, dopo la chiusura della `1F-W0` (`ee10579`). Esecuzione di codice:
**Sonnet** (PLAN §2). Decisioni: D243 = A (DR-350), D244 = B (DR-351), registrate il 2026-11-03.

**Obiettivo:** correggere i due difetti bassi rinviati dalla 1G.

- **W9-N7** (DR-330): su rete lenta due salvataggi della copia di lavoro arrivano in ordine
  inverso, e resta la copia più vecchia mentre lo schermo dice «salvata». Un salvataggio ancora
  in viaggio dopo «Scarta la copia di lavoro», «Salva» o «Pubblica» fa ricomparire la copia
  alla riapertura (`docs/qa/collaudo-1G-W9.md` §5).
- **W9-N8** (DR-336): «Ctrl+Home» premuto pochi millisecondi dopo il clic nel blocco «Testo» a
  volte non sposta il cursore (2 prove su 45; `collaudo-1G-W9.md` §9).

**Riferimenti:** `superpowers:systematic-debugging` (causa prima della correzione),
`superpowers:test-driven-development`; prove esistenti `apps/admin/tests/working-copy-inflight-w9.test.tsx`,
`apps/admin/tests/richtext-typing-w9.test.tsx`, `tests/e2e/cms/digitazione.spec.ts`.

---

## 1. Dove sta il codice (letto il 2026-11-03 su `ee10579`)

| Punto | File e righe | Perché conta |
|---|---|---|
| Salvataggio della copia | `apps/admin/src/components/editor/ContentEditor.tsx:266-291` (`saveDraft`) | ogni `PUT /contents/:id/draft` parte senza attendere il precedente: due richieste possono viaggiare insieme |
| Salvataggio automatico | `ContentEditor.tsx:316-321` | il timer di 1500 ms aspetta solo `busy`, non un `PUT` già in viaggio |
| «Salva» e «Pubblica» | `ContentEditor.tsx:323-406` (`writeToContent`) | il `DELETE` della copia parte anche se un `PUT` è ancora in viaggio: se il `PUT` arriva dopo, la copia rinasce |
| «Scarta la copia di lavoro» | `ContentEditor.tsx:408-414` (`discardDraft`) | stesso caso del `DELETE` |
| Servizio | `apps/api/src/modules/content/routes.ts:373-480`, `service.ts:379-455` | il `PUT` è un inserimento o aggiornamento senza ordine: l'ultimo che arriva vince |
| Cursore prima del tasto | `apps/admin/src/lib/editor/richtext.ts:113` (`syncSelectionFromDom`), `RichTextEditor.tsx:88-91` | la correzione di W9-N2; W9-N8 è nel momento fra il clic e il primo tasto |

## 2. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W1-1 | W9-N7, ordine | con due salvataggi le cui risposte tornano in ordine inverso, alla riapertura c'è la copia più recente e l'ora mostrata è la sua; prova rossa prima della correzione |
| W1-2 | W9-N7, eliminazione | con un salvataggio in viaggio, dopo «Scarta», «Salva» e «Pubblica» la riapertura non riprende nessuna copia; una prova rossa per ciascuno dei tre casi; e2e con il `PUT` rallentato |
| W1-3 | W9-N8 | causa riprodotta e scritta; prova rossa prima della correzione; nessuna perdita in 50 ripetizioni con clic e «Ctrl+Home» a 0-10 ms, CPU rallentata 4 volte. Oppure, se non riprodotto, la correzione preventiva di DR-351 con la sua prova rossa |
| W1-4 | Nessuna regressione | prove W9 esistenti verdi; e2e tutti verdi; verifica come la CI (frozen, lint, Prettier sui file di Git, typecheck, build, test, db:verify, copertura ≥ 80 %) |
| W1-5 | Documenti | `collaudo-1G-W9.md` §5 e `editability-matrix.csv` con lo stato nuovo di W9-N7 e W9-N8; `CONTEXT.md` §6 aggiornato |
| W1-6 | Chiusura | revisione approvata, commit e push su conferma, CI verde, poi riga `STATUS:complete` |

## 3. Attività

### T0 — Linea di base

- [ ] `PROGRESS.md` letto; nessuna riga `1F-W1 STATUS:complete`.
- [ ] Database e oggetti di sviluppo in salute; prove W9 esistenti verdi su `ee10579`.
- [ ] Nessun dato reale nelle prove nuove: solo contenuti sintetici creati dalle prove.

### T1 — W9-N7: prove rosse

- [ ] `apps/admin/tests/working-copy-order-1f.test.tsx` (nuovo), con `api` simulata e risposte
  trattenute a mano:
  - due `PUT` con risposte in ordine inverso → l'ultimo corpo ricevuto dal servizio simulato è
    quello più recente e l'ora mostrata è la sua (W1-1);
  - `PUT` in viaggio, poi «Scarta» → nessun `PUT` raggiunge il servizio dopo il `DELETE` (W1-2);
  - stesso caso con «Salva» e con «Pubblica» (W1-2).
- [ ] e2e in `tests/e2e/cms/digitazione.spec.ts`: `page.route` trattiene il `PUT …/draft` per
  3 s; si scrive, si preme «Scarta», si ricarica → nessun «Ripresa la copia di lavoro».
- [ ] Eseguire: le prove nuove **falliscono** per la ragione attesa. Annotare l'uscita.

### T2 — W9-N7: correzione (DR-350)

- [ ] DR-350: un solo salvataggio della copia alla volta. Un salvataggio richiesto
  durante un altro aspetta e parte con lo stato più recente. «Scarta», «Salva» e «Pubblica»
  attendono il salvataggio in viaggio e annullano quello in coda prima del `DELETE`. La logica
  va in un file piccolo e provabile, `apps/admin/src/lib/editor/draftSaveQueue.ts`, usato da
  `ContentEditor.tsx` (che ha già 893 righe).
- [ ] Nessuna modifica di API e database (DR-350).
- [ ] Prove della T1 verdi; prove W9 esistenti verdi.

### T3 — W9-N8: riproduzione e causa

- [ ] e2e strumentato, fuori da Git in `.superpowers/sdd/strumenti-1F/`: pagina sintetica
  creata e poi eliminata dalla prova; 50 ripetizioni di clic in fondo al paragrafo, attesa di
  0-10 ms, «Ctrl+Home», 22 «Canc»; CPU rallentata 4 e 16 volte con CDP; registro di
  `keydown`, `selectionchange`, `mouseup` e della selezione dell'editor a ogni passo.
- [ ] Se riprodotto: scrivere la causa osservata (non un'ipotesi) in
  `collaudo-1G-W9.md` §9, poi una prova rossa minima in `apps/admin/tests/` o in
  `digitazione.spec.ts`.
- [ ] Ipotesi da verificare, non da dare per buona: dopo il clic la selezione del clic arriva
  all'editor dopo lo spostamento del browser e lo annulla. Una correzione possibile, solo se la
  causa lo conferma: «Ctrl+Home» e «Ctrl+Fine» gestiti dall'editor, senza dipendere dal
  browser.
- [ ] Se **non** riprodotto dopo 50 ripetizioni per entrambe le velocità: applicare DR-351: correzione
  preventiva con una prova che simula il ritardo, senza ricreare il collaudo.

### T4 — W9-N8: correzione

- [ ] Correzione minima in `richtext.ts` o `RichTextEditor.tsx`; prova rossa ora verde;
  ripetizione della T3: 0 prove senza effetto su 50.

### T5 — Revisione e verifica

- [ ] Revisione del codice (`code-reviewer`); esiti critici e alti corretti.
- [ ] Verifica come la CI (memorie del progetto: Prettier solo sui file di Git, `QPDF_PATH`
  per le prove, rieseguire da soli i file con timeout sotto carico).
- [ ] e2e tutti verdi; server di sviluppo ricompilati dopo gli e2e, poi spenti.

### T6 — Documenti e chiusura

- [ ] `collaudo-1G-W9.md` §5 e §9, `editability-matrix.csv`, `CONTEXT.md` §6 aggiornati.
- [ ] Commit e push **su conferma**; CI verde; riga `PHASE:1F WAVE:1F-W1 STATUS:complete`.

## 4. Decisioni

| Id | Domanda | Opzioni | Raccomandazione | Termine |
|---|---|---|---|---|
| ~~D243~~ → **DR-350** (A) | Dove si corregge W9-N7 | **A** — solo nell'area: un salvataggio alla volta, e «Scarta», «Salva», «Pubblica» attendono quello in viaggio · **B** — A più un controllo del servizio: un `PUT` con `baseUpdatedAt` diverso dalla data del contenuto riceve 409 (protegge anche da una seconda scheda dopo «Salva» o «Pubblica»; non copre «Scarta»; nessuna migrazione) · **C** — A più un numero d'ordine salvato dal servizio, con la migrazione `0010` | **A**: chiude i due casi di W9-N7 senza toccare API e database (PLAN §2: l'API «solo se serve»); la seconda scheda è un caso diverso, non osservato | prima della T2 |
| ~~D244~~ → **DR-351** (B) | Che cosa si fa se W9-N8 non si riproduce nell'ambiente e2e | **A** — ricreare il collaudo con `crea.ps1` e ripetere la prova lì, come per W9-N2 (DR-326), su conferma · **B** — correzione preventiva («Ctrl+Home» e «Ctrl+Fine» gestiti dall'editor) con una prova che simula il ritardo · **C** — chiudere W9-N8 come non riprodotto, con l'esito scritto nel collaudo | **B**: il difetto è basso, la correzione è piccola e la prova la tiene; A costa un'accensione intera per 2 casi su 45 | prima della T3 |

## 5. Cosa la wave non fa

- Nessun lavoro di produzione, immagini o server (`1F-W2` e seguenti).
- Nessuna scrittura sul database di sviluppo fuori dalle prove; nessuna migrazione senza handoff.
- Nessun altro difetto: se ne compare uno nuovo, si classifica e si propone all'utente.

## 6. Rischi

| Rischio | Mitigazione |
|---|---|
| La coda dei salvataggi rallenta l'«ora di salvataggio» mostrata | la prova di W1-1 controlla anche l'ora; un salvataggio in coda parte appena finisce il precedente |
| «Salva» attende un `PUT` lento e sembra bloccato | il pulsante è già disattivato durante `busy`; prova che il messaggio finale arriva |
| W9-N8 dipende dai tempi e la prova è instabile | prova rossa solo se fallisce in modo ripetibile; altrimenti DR-351 |
| Timeout di `apps/web` sotto carico (memoria del progetto) | rieseguire da soli i file in timeout, poi la copertura |
