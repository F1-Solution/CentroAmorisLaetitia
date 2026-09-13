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
