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

---

# 1F-W4 T5 — Decisioni D275…D279 sugli esiti della T4

Round del 2026-11-08 sugli esiti del revisore separato (0 critici, 4 alti, 13 medi, 12 bassi).
Registrate come DR-388…DR-392; tutte e cinque seguono la raccomandazione.

| id | DR | Decisione | Scartate |
|---|---|---|---|
| D275 | DR-388 | **B** — terza deroga ad ADR-007 §6: soglia del solo nucleo a 650 righe, TOTP con `node:crypto`, regola di conteggio invariata, riesame con Better Auth prima del gestionale | A (Better Auth subito): riscrive codice appena provato a ridosso della produzione |
| D276 | DR-389 | **B** — Node 26.12.1 LTS (fino al 2029-04-30) su `bookworm-slim` per digest | A (Node 24.22.1): scade un anno prima |
| D277 | DR-390 | **B** — log senza IP in chiaro né query, con il digest con sale dell'IP; rotazione 10 MB × 5 | A (nessun digest): abusi non ricostruibili dai log; C (IP in chiaro sei mesi): dato personale nei log |
| D278 | DR-391 | **A** — sessione 14 giorni, 8 ore di inattività, cookie di sessione; conferma entro 10 minuti per gestire gli account | B (30 giorni, 12 ore): finestra lunga; C (7 giorni): rientro settimanale |
| D279 | DR-392 | **A** — alti, medi tranne R12 e R14 (W5), bassi a basso costo; resto annotato o rinviato a W5 | B (solo il minimo): R5 e R10 sul server; C (tutto): 5–6 giorni |

## Rischi

- **DR-388:** è la terza deroga alla stessa contromisura; se il TOTP supera 650 righe di nucleo,
  stop e nuova ripresentazione.
- **DR-389:** Node 26 è LTS da 11 giorni; incompatibilità di Next o dei moduli nativi emergono
  dalla verifica come la CI della T6a, prima delle altre correzioni.
- **DR-392:** R12 e R14 restano aperti fino alla configurazione della Storage Box nella W5;
  finché mancano, il backup non resiste a un server compromesso del tutto.

---

# 1F-W4 T6l — Decisioni D281…D285 sul TOTP

Round del 2026-11-08, aperto quando il TOTP ha portato il nucleo a 772 righe contro la soglia di
650 (DR-388 impone lo stop). Registrate come DR-395…DR-399; tutte e cinque seguono la
raccomandazione.

| id | DR | Decisione | Scartate |
|---|---|---|---|
| D281 | DR-395 | **A** — quarta deroga ad ADR-007 §6: soglia del solo nucleo a 800, TOTP com'è, regola di conteggio invariata, riesame con Better Auth prima del gestionale | B (Better Auth subito): giorni o settimane in più e i 12 controlli da riprovare |
| D282 | DR-396 | **A** — conferma entro 10 minuti per ogni rotta con `users.manage`, anche elenco e dettaglio | B (solo le modifiche): email e ruoli visibili da una sessione lasciata aperta |
| D283 | DR-397 | **A** — reimpostazione del secondo fattore solo dal manutentore, da riga di comando | B (anche dall'area): un account compromesso toglie il secondo fattore agli altri |
| D284 | DR-398 | **A** — rischio della prima attivazione accettato; password temporanea su canale sicuro, rimedio con DR-397 | B (codice monouso di attivazione): un giorno e un flusso in più |
| D285 | DR-399 | **A** — nessuna rotazione di `TOTP_ENCRYPTION_KEY` in Fase 1; se compromessa, reimpostazione di tutti i secondi fattori | B (comando di rotazione): mezza giornata e un comando da provare |

## Rischi

- **DR-395:** quarta deroga alla stessa contromisura: la soglia protegge meno; il riesame con
  Better Auth prima della fase gestionale resta il presidio.
- **DR-397:** chi perde il telefono resta fuori finché il manutentore non interviene.
- **DR-398:** la password temporanea intercettata permette a un estraneo di attivare il proprio
  dispositivo prima della persona; si consegna su un canale sicuro (handoff della `1F-W5`).

---

# 1F-W4 T7 — Decisioni D286…D290 sul riesame delle correzioni

Round del 2026-11-09 sul riesame del revisore separato del diff `6c6e4ed..57c4ae6` (0 critici,
1 alto, 2 medi, 6 bassi). Registrate come DR-400…DR-404; tutte e cinque seguono la
raccomandazione.

| id | DR | Decisione | Scartate |
|---|---|---|---|
| D286 | DR-400 | **A** — coda in memoria per account su conteggio, verifica e registrazione nei 7 punti (accesso, password attuale, codice); tetto di 10 richieste al minuto per sessione su codice e conferma; un solo processo API scritto in ADR-007 | B (blocco consultivo di PostgreSQL): connessioni occupate sotto raffica e nucleo oltre 795 righe; C (solo tetto HTTP): accesso e password esposti |
| D287 | DR-401 | **A** — il sito inoltra l'indirizzo del visitatore, esenzione tolta, 120 al minuto per visitatore su ricerca e redirect; prova inversa di N8 | B (tetto complessivo): chi attacca blocca la ricerca a tutti; C (rinvio alla W5): rischio aperto |
| D288 | DR-402 | **B** — `APP_SUBNET` obbligatoria e diversa per ambiente; fiducia nell'intera sottorete `app` accettata in Fase 1 | A (indirizzi fissi): tre variabili per ambiente; C (rinvio): conflitto delle sottoreti fino alla W5 |
| D289 | DR-403 | **A** — N4, N5, N8 subito; N6 e timer di R25 nell'handoff della W5; N9 e R27 nel rapporto | B (nessuna correzione): digest senza scadenza, copia in chiaro dopo un arresto forzato |
| D290 | DR-404 | **A** — volumi `amoris-w4t7_*`, due anonimi e immagini di prova elencate cancellati alla chiusura della T8 | B (solo volumi), C (niente): disco occupato |

## Rischi

- **DR-400:** la coda vale per un solo processo API; con più repliche la corsa si riapre e la
  decisione va ripresa (ADR-007).
- **DR-402:** un contenitore `web` o `admin` compromesso può dichiarare un indirizzo falso
  all'API e aggirare i tetti per indirizzo.
