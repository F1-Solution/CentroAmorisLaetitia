# Piano della wave 1G-W9 — Correzione dei difetti e nuovo collaudo

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice in ogni
> attività che cambia codice. Protocollo `PROGRESS.md`: un commento datato dopo ogni attività,
> una sola riga `STATUS:complete` a fine wave. Nessun commit senza conferma: il controller
> fotografa il lavoro fra un'attività e l'altra (`.superpowers/sdd/strumenti-1G/snap.sh`).

Scritto il 2026-10-28, dopo la chiusura della `1G-W8` (DR-299, commit `8308bb2`).

**Obiettivo:** portare ogni difetto della `1G-W8` (W8-01…W8-38) a `risolto` con prova, oppure
ad `approvato` dall'utente voce per voce (1G-28); soddisfare 1G-24 (nessun errore in console);
dimostrare che la parità approvata non peggiora; ripetere il collaudo dei soli compiti
interessati.

**Architettura.**

- **Codice.** Correzioni piccole e localizzate, raggruppate per schermata (T1…T8), ciascuna
  con la sua prova automatica che fallisce prima della correzione.
- **Non regressione.** Gli strumenti di `tests/visual/` si eseguono, non si cambiano. Le
  correzioni che toccano il sito (W8-11, W8-26, W8-36, W8-14) richiedono il confronto delle
  viste interessate; a fine wave, confronto integrale come nella `1G-W7` T4.
- **Collaudo.** Ambiente ricreato con `crea.ps1` sul commit della wave, su conferma; i compiti
  interessati li ripete l'agente con Playwright (DR-290, DR-291).

**Stack:** Next.js, Fastify, PostgreSQL, MinIO, Playwright.

- **Dipendenze:** nessuna nuova.
- **Migrazioni:** nessuna prevista; se D200 = A serve solo scrivere colonne già esistenti.

**Riferimenti:** `docs/qa/collaudo-1G-W8.md` §2-§3; DR-261, DR-290…DR-294, DR-299;
`acceptance-criteria.md` §5; `W7-PLAN.md` T4, T9 (minori parcheggiati).

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W9-1 | 1G-28: ogni difetto W8-01…W8-38 è `risolto` con prova o `approvato` dall'utente | colonna «Stato» di `collaudo-1G-W8.md` §2 aggiornata, con riferimento alla prova |
| W9-2 | 1G-24: nessun errore in console nei percorsi dei compiti 1G-1…1G-17 | prova Playwright che ascolta `console` e `pageerror` sui percorsi; esito nel rapporto |
| W9-3 | Verifica come la CI verde in locale e in CI | lint, Prettier, tipi, build, prove, `db:verify`, copertura, e2e; corsa della CI |
| W9-4 | Nessuna vista peggiorata rispetto alle catture accettate (DR-289) | confronto integrale; `visual-parity-report.md` §15 |
| W9-5 | Menu 41/41, metadati 0 difformi, redirect 181/181, stati 292/292 | gli strumenti della `1G-W7` T5 |
| W9-6 | I compiti interessati dai difetti medi riescono senza difficoltà | nuovo collaudo dell'agente, rapporto `collaudo-1G-W9.md` |

## 2. Difetti e attività

Tutti i difetti aperti della `1G-W8`. W8-02 e W8-08 sono già chiusi.

| Attività | Difetti | Severità | Note |
|---|---|---|---|
| **T1** Immagini nell'area | W8-01, W8-06 (DR-294), W8-10 (D197), W8-12, W8-34, W8-35 | 4 medie, 2 basse | W8-01: i punti elencati in `collaudo-1G-W8.md` dopo §2, con `siteUrl.ts` |
| **T2** Sito pubblico | W8-11, W8-26 (D199), W8-36, W8-14 (D198), W8-18 (D200) | 2 medie, 3 basse | confronto delle viste toccate |
| **T3** Editor | W8-13 (DR-293, più HO-045 §4.2), W8-03, W8-22, W8-24, W8-33, W8-21 | 2 medie, 4 basse | |
| **T4** Menu | W8-04, W8-05, W8-15, W8-16 | 1 media, 3 basse | W8-16: rinumerare solo le voci spostate, oppure un'unica richiesta |
| **T5** Messaggi di riuscita | W8-17, W8-19, W8-23, W8-25 | 4 basse | stesso avviso già usato da pagine e documenti |
| **T6** Registro | W8-20, W8-29, W8-30, W8-31; minore della `1G-W7` T9 (PATCH con solo `contentHtml`/`contentText` senza etichetta) | 5 basse | |
| **T7** Account e impostazioni | W8-27, W8-28, W8-37, W8-38 | 3 medie, 1 bassa | W8-38: scelta da elenco e validazione nell'API |
| **T8** Console (1G-24) | W8-09, W8-32 | 2 basse | assenza comunicata senza codice d'errore, o rinvio prima del caricamento |
| **T9** Residui | W8-07 (handoff e strumenti); minori della `1G-W7` T9: `layout.tsx` senza ripiego per la lingua, gara eliminazione documento / salvataggio (nota in ADR-007); residui di DR-261: N2, timeout dell'archivio, N4, N5, sessione di `prova-1e-19.ts` | — | N2 e il timeout chiedono un archivio remoto: proposta di rinvio alla 1F nel rapporto |
| **T10** Verifica come la CI e non regressione | — | — | W9-3, W9-4, W9-5 |
| **T11** Nuovo collaudo | compiti con difetti medi: 1G-1, 1G-2, 1G-5, 1G-13, 1G-16 e quelli di W8-34, W8-38 | — | su conferma: ricreazione del collaudo |
| **T12** Chiusura | — | — | W9-1, W9-6; audit prima della chiusura |

Ordine: T0, poi T3-T8 (non dipendono da decisioni nuove), T1 e T2 dopo D197-D200, poi T9-T12.

## 3. Decisioni

### 3.1 Richieste prima di T1 e T2 (prossimo round)

| Id | Domanda | Opzioni | Raccomandazione |
|---|---|---|---|
| **D197** | W8-10: testo alternativo e didascalia scritti in Media | **A** — come WordPress: i valori di Media sono proposti all'inserimento, poi vale il blocco; si corregge l'aiuto di Media · **B** — se il blocco li lascia vuoti, il sito usa quelli di Media anche dopo; il blocco li sovrascrive solo se compilati · **C** — Media prevale sempre | **B**: una modifica in Media arriva ovunque senza perdere i testi scritti apposta |
| **D198** | W8-14: «Solo a chi ha fatto accesso» e «Solo ad alcuni ruoli» nel menu, oggi senza accesso per i visitatori. Fatto della T0: 3 voci importate le usano (1 e 2), 20 sono nascoste, 41 pubbliche | **A** — restano, l'aiuto dice che oggi nessun visitatore le vede · **B** — tolte dall'elenco; le 3 voci importate diventano «Nascosta» · **C** — la voce compare a chi è entrato in Redazione | **A**: nessun dato importato cambia e l'aiuto dice il vero |
| **D199** | W8-26: titoli di slide con HTML importato | **A** — il sito rende un sottoinsieme sicuro (a capo, centratura, icona) come la sorgente; l'editor lo mostra come testo formattato · **B** — titoli ridotti a testo semplice, con difformità dichiarata (si perde l'icona del cuore) | **A**: è ciò che la sorgente mostra |
| **D200** | W8-18: contatore degli usi dei redirect | **A** — si scrive a ogni 301, senza rallentare la risposta · **B** — colonne «Usi» e «Ultimo uso» tolte dall'area | **A**: serve a capire quali redirect si possono togliere |

### 3.2 Scelte già prese

- W8-13 secondo DR-293; W8-06 secondo DR-294.
- 1G-24 alla `1G-W9` secondo DR-299.
- Collaudo eseguito dall'agente secondo DR-290, con gli account di DR-291.

## 4. Attività

### T0 — Preparazione

- [ ] Collaudo spento; server di sviluppo accesi (memoria `riavvio-server-sviluppo`).
- [ ] Conteggio delle voci di menu con visibilità diversa da «pubblica» nel database di sviluppo, per D198.
- [ ] Per ciascun difetto, una prova che fallisce (unitaria, d'integrazione o e2e), elencata nel rapporto della sua attività.

### T1…T8 — Correzioni

Per ogni attività: prove rosse, correzione, prove verdi, revisione di codice (e di sicurezza per T6 e T7), fotografia del lavoro, riga in `PROGRESS.md`, stato del difetto aggiornato in `collaudo-1G-W8.md` §2 con il riferimento alla prova.

### T9 — Residui

Correggere W8-07 e i minori della `1G-W7`; per i residui di DR-261 correggere ciò che non chiede un archivio remoto e proporre il rinvio motivato del resto alla 1F.

### T10 — Verifica come la CI e non regressione

Come la `1G-W7` T3-T5: verifica completa, Prettier con `--end-of-line auto`, confronto integrale, strumenti di menu, metadati, redirect e stati. Viste cambiate: corrette, o accettate dall'utente voce per voce.

### T11 — Nuovo collaudo

Su conferma: `crea.ps1` sul commit della wave, account dell'agente, Playwright sui compiti di §2 con ascolto della console; rapporto `docs/qa/collaudo-1G-W9.md`.

### T12 — Chiusura

Audit dei criteri W9-1…W9-6; i difetti non risolti vanno all'utente per l'approvazione voce per voce; commit e push su conferma.

## 5. Cosa la wave non fa

- Nessuna funzione nuova oltre a quelle decise (DR-293, DR-294, D197-D200).
- Nessun lavoro della Fase 1F, che resta in pianificazione (DR-272).
- Nessun cambio agli strumenti di `tests/visual/` salvo il confronto senza i dati di idratazione (W8-07), se lo usano.

## 6. Rischi

| Rischio | Mitigazione |
|---|---|
| Una correzione al sito cambia viste approvate | confronto delle viste toccate in T2, integrale in T10 |
| 1G-24 dipende anche da errori di terzi o del browser | la prova distingue gli errori dell'applicazione; ogni eccezione è elencata e motivata |
| Il nuovo collaudo trova difetti nuovi | si classificano come nella `1G-W8`; i medi si correggono nella wave, i bassi si propongono all'utente |
