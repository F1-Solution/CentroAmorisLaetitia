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
PHASE:1C WAVE:1C-W1 STATUS:complete TS:2026-09-14T16:15:50Z
PHASE:1C WAVE:1C-W2 STATUS:complete TS:2026-09-14T16:21:41Z
PHASE:1C WAVE:1C-W3 STATUS:complete TS:2026-09-14T16:49:19Z
PHASE:1C WAVE:1C-W4 STATUS:complete TS:2026-09-14T16:59:19Z
PHASE:1C WAVE:1C-W5 STATUS:complete TS:2026-09-14T17:05:23Z
PHASE:1C WAVE:1C-W6 STATUS:complete TS:2026-09-14T17:13:46Z
PHASE:1C WAVE:1C-W7 STATUS:complete TS:2026-09-14T17:14:48Z
PHASE:1C WAVE:1C-W8 STATUS:complete TS:2026-09-14T17:19:44Z
PHASE:1D WAVE:1D-W0 STATUS:complete TS:2026-09-14T23:13:11Z
PHASE:1D WAVE:1D-W1 STATUS:complete TS:2026-09-15T04:42:02Z
PHASE:1D WAVE:1D-W2 STATUS:complete TS:2026-09-15T04:42:15Z
PHASE:1D WAVE:1D-W3 STATUS:complete TS:2026-09-15T07:26:23Z
PHASE:1D WAVE:1D-W4a STATUS:complete TS:2026-09-15T08:44:15Z

<!-- Interruzione per limite di sessione, 2026-09-15.
     Ultima wave completata: 1D-W4a.
     Interrotte a metà, NON complete e NON committate su main: 1D-W4b (media) e
     1D-W7 (packages/ui). Il lavoro parziale è nell'albero di lavoro e, per
     sicurezza, anche nel ramo `wip/1D-W4b-W7-interrotte`.
     Alla ripresa: riprendere da 1D-W4b e 1D-W7, non rieseguire W0…W4a. -->
PHASE:1D WAVE:1D-W7a STATUS:complete TS:2026-09-15T14:14:05Z
PHASE:1D WAVE:1D-W4b STATUS:complete TS:2026-09-15T14:29:18Z
PHASE:1D WAVE:1D-W7b STATUS:complete TS:2026-09-15T14:37:46Z
PHASE:1D WAVE:1D-W7c STATUS:complete TS:2026-09-15T15:10:50Z
PHASE:1D WAVE:1D-W4c STATUS:complete TS:2026-09-15T15:24:00Z
PHASE:1D WAVE:1D-W4d STATUS:complete TS:2026-09-15T18:21:11Z

<!-- Seconda interruzione per limite di sessione, 2026-09-15 (ripristino alle 02:00).
     Ultima wave completata: 1D-W4d. Tutte le dieci fasi di import sono fatte.
     Interrotta a meta', NON completa e NON committata su main: 1D-W5a, che attua
     le quattro correzioni approvate (DR-058, DR-059, DR-060, DR-061).
       fatto:      DR-059 colonna `action` in import_id_map, migrazione 0001
                   generata; DR-060 esclusione di download-manager-files tolta.
       da fare:    i test del controllo 7 del preflight; DR-058 secondo lettore
                   per i documenti riservati; DR-061 le due tassonomie nuove.
     Il lavoro parziale e' nell'albero di lavoro e nel ramo `wip/1D-W5a-interrotta`.
     Alla ripresa: completare 1D-W5a, non ricominciarla; poi W5b, W5c, W6, W8...W12. -->
PHASE:1D WAVE:1D-W5a STATUS:complete TS:2026-09-16T00:20:00Z
PHASE:1D WAVE:1D-W5b STATUS:complete TS:2026-09-16T00:55:00Z
PHASE:1D WAVE:1D-W5c STATUS:complete TS:2026-09-16T01:36:23Z
