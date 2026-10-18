# HO-029 — Ultime difformità dell'audit della `1E-W7`

Fase 1E, wave `1E-W7`. Scritto il 2026-10-18. Stato dei criteri in
`docs/qa/verifiche/audit-1E-W7.md`.

## 1. Che cosa è fatto

Report visivo (DR-203), voce 4 dei form (24/24), e2e (31/31), sito riavviato su `:3200`
(stati 292/292). Ogni criterio è eseguito. Restano due scarti senza decisione.

## 2. Decisioni

| # | Domanda | Opzioni | Raccomandazione | Impatto |
|---|---|---|---|---|
| D105 | Al passaggio del mouse, il link «Iscrizioni» di 4 pagine ha nella sorgente uno sfondo bianco in linea; il sito lo toglie (filtro dell'HTML importato) e lo sfondo resta trasparente, su una pagina bianca | **A** difformità accettata, invisibile sul bianco · **B** il filtro conserva `background-color` in linea sui link, con prova e reimport dei contenuti | **A** | A: nessuna modifica; B: tocca il filtro di tutti i contenuti, import e nuova ricattura |
| D106 | Il campo di ricerca della testata non ha etichetta accessibile (anche nella sorgente); per DR-169 ciò che non cambia la resa si corregge subito, ma non era nell'elenco della T7 | **A** etichetta nascosta «Cerca» ora, con prova; A-5 rimisurata · **B** rinviata dopo la UAT, come difetto ereditato | **A** | A: una modifica della testata, ricompilazione, nessun cambio visivo; B: nessuna modifica ora |

Default vietato: scrivere `STATUS:complete` della `1E-W7` con D105 o D106 aperte.

## 3. Come confermare

```
HO-029: D105=A, D106=A.
```

Dopo la risposta: registrazione nel registro, eventuale correzione con prova, poi proposta
di chiusura della wave e del commit (ciascuno su tua conferma).
