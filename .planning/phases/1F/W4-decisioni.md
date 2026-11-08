# 1F-W4 — Decisioni D270…D274 della security review

Round del 2026-11-08 con `grill-with-ui`, due invii. Le cinque decisioni aperte del
[`W4-PLAN.md`](W4-PLAN.md) §4 sono prese e registrate come DR-383…DR-387 in
`docs/decisions/decision-register.md`. Quattro risposte seguono la raccomandazione; D272 se ne
discosta (C invece di B).

## Termini

| Termine | Definizione | Da evitare |
|---|---|---|
| revisore separato | chi esegue la security review senza aver scritto il codice né ricevuto le ipotesi del coordinatore | auditor, pentester |
| nucleo dell'autenticazione | righe eseguibili di autenticazione contate da `tools/countAuthLines.ts`; 475 su una soglia di 500 (DR-070) | modulo auth |
| stack d'immagini | stack di produzione locale avviato dalle immagini della CI, con seme sintetico, attraverso Caddy | ambiente di sviluppo |

## Perché

Chiudere le decisioni aperte del W4-PLAN, registrarle e avviare la T0 della security review
(criteri 1F-3 e 1F-4).

## Decisioni durature

| id | DR | Decisione | Scartate e perché |
|---|---|---|---|
| D270 | DR-383 | **A** — revisore separato = agente `security-reviewer` a contesto nuovo; il rapporto dichiara di non essere un audit umano indipendente | B (revisione umana esterna del rapporto): costo e attesa esterni; C (penetration test): costo non previsto in Fase 1 |
| D271 | DR-384 | **A** — TOTP nell'area amministrativa per tutti gli account, prima della produzione | B (rete fidata o secondo fattore al proxy): scomodo per i redattori e da far validare come equivalente; C (nessuna MFA): rischio spostato sul Centro contro il requisito del parere |
| D272 | DR-385 | **C** — nessuna cifratura a riposo in Fase 1; cifrati backup e trasporto; rischio residuo **approvato per iscritto dal Centro** prima dei dati sul server | A (disco cifrato): sblocco a ogni riavvio, nessuna protezione da un'applicazione compromessa; B (campi cifrati nella W6): non scelta dall'utente |

## Scelte ordinarie

- D273 → DR-386: **B** — audit delle dipendenze e delle cinque immagini una tantum nella W4;
  `pnpm audit --prod` bloccante su critici e alti nella CI, con eccezioni motivate e versionate.
- D274 → DR-387: **A** — segreti nell'ambiente dei contenitori, rischio accettato in Fase 1; si
  riapre se la revisione trova un percorso concreto di esposizione.

## Fatti verificati

- La CI non ha audit delle dipendenze né scansione delle immagini (`.github/workflows/ci.yml`).
- `pgcrypto` è installata nel database; nessun campo è oggi cifrato a livello applicativo.
- Nucleo dell'autenticazione 475 su 500 (`apps/api/tests/auth-line-count.json`, 2026-10-28).

## Rischi

- **DR-384:** il TOTP porterà quasi certamente il nucleo oltre 500 righe: stop e ripresentazione
  secondo ADR-007 §6, senza cambiare la regola di conteggio.
- **DR-385:** un dump del database o un volume copiato dal server espone le compilazioni in
  chiaro; il parere MI-06 (domanda 12) proponeva la cifratura come requisito di rilascio. Senza
  l'approvazione scritta del Centro non arrivano dati sul server; se il Centro non approva, la
  decisione si riapre con A o B.
- **DR-386:** la CI può diventare rossa per avvisi senza correzione disponibile.

## Rinviate

Nessuna.

## Discussioni aperte

Nessuna.
