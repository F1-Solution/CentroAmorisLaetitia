# PROGRESS

Registro di avanzamento per wave. **Append-only**: una riga per wave, mai riscritta.

Formato: `PHASE:<phase-id> WAVE:<wave-id> STATUS:<complete|failed> TS:<ISO-8601-UTC>`

Protocollo:

1. Prima di ogni wave leggere questo file. Se esiste una riga
   `PHASE:<id> WAVE:<id> STATUS:complete`, la wave si salta.
2. Dopo ogni wave, appendere immediatamente la riga corrispondente.
3. Alla ripresa dopo un'interruzione, riportare all'utente l'ultima wave completata
   e quelle rimanenti **prima** di proseguire.

---

PHASE:0 WAVE:0-W1 STATUS:complete TS:2026-09-13T00:00:00Z
PHASE:1A WAVE:1A-W1 STATUS:complete TS:2026-09-13T21:57:19Z
PHASE:1A WAVE:1A-W2 STATUS:complete TS:2026-09-13T21:57:19Z
PHASE:1A WAVE:1A-W3 STATUS:complete TS:2026-09-13T21:57:19Z
PHASE:1A WAVE:1A-W4 STATUS:complete TS:2026-09-13T22:00:45Z
PHASE:1A WAVE:1A-W5 STATUS:complete TS:2026-09-13T22:00:45Z
PHASE:1B WAVE:1B-W0 STATUS:complete TS:2026-09-14T08:05:54Z
PHASE:1B WAVE:1B-W1 STATUS:complete TS:2026-09-14T08:16:29Z
PHASE:1B WAVE:1B-W2 STATUS:complete TS:2026-09-14T08:22:13Z
PHASE:1B WAVE:1B-W3 STATUS:complete TS:2026-09-14T08:27:41Z
PHASE:1B WAVE:1B-W4 STATUS:complete TS:2026-09-14T08:29:40Z
PHASE:1B WAVE:1B-W5 STATUS:complete TS:2026-09-14T08:31:46Z
PHASE:1B WAVE:1B-W6 STATUS:complete TS:2026-09-14T08:38:54Z
PHASE:1B WAVE:1B-W7 STATUS:complete TS:2026-09-14T08:41:59Z
PHASE:1B WAVE:1B-AUDIT STATUS:complete TS:2026-09-14T08:49:24Z
PHASE:1B WAVE:1B-ROUND4 STATUS:complete TS:2026-09-14T16:07:37Z
PHASE:1C WAVE:1C-W0 STATUS:complete TS:2026-09-14T16:09:58Z
