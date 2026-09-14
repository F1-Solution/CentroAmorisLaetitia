# PLAN — Fase 1B

Contesto in [`CONTEXT.md`](CONTEXT.md). Protocollo `PROGRESS.md` obbligatorio:
lettura prima di ogni wave, riga appesa dopo, commit per wave.

---

## Wave

| Wave | Attività | Output | Stato |
|---|---|---|---|
| `1B-W0` | Rilievi complementari sulla sorgente, rimandati dalla 1A alla 1B: template SEO di AIOSEO, visibilità reale del menu, pagine con titolo nascosto, OptinMonster, Slider Revolution, baseline SEO renderizzata | `docs/migration/source-supplementary-findings.md`, `docs/migration/public-menu.csv`, `docs/migration/seo-rendered-baseline.csv` | ✅ |
| `1B-W1` | ADR: framework API, ORM, reverse proxy, storage, modello a blocchi, editor, autenticazione, struttura admin, hosting | `docs/decisions/adr/ADR-0xx-*.md` | ✅ |
| `1B-W2` | Schema PostgreSQL per CMS e migrazione | `docs/architecture/database-schema.md`, `docs/architecture/schema.sql` | ✅ |
| `1B-W3` | Mapping WordPress → PostgreSQL campo per campo | `docs/migration/wp-to-postgres-mapping.md` | ✅ |
| `1B-W4` | Specifica dell'importer | `docs/migration/importer-spec.md` | ✅ |
| `1B-W5` | Strategia Divi, shortcode e conversione progressiva | `docs/migration/divi-shortcode-strategy.md` | ✅ |
| `1B-W6` | Piano di visual regression e criteri di accettazione | `docs/qa/visual-regression-plan.md`, `docs/qa/acceptance-criteria.md` | ✅ |
| `1B-W7` | 4 proposte di UI e 4 di UX per l'area amministrativa | `docs/design/ui-proposals.md`, `docs/design/ux-proposals.md`, handoff di scelta | ✅ |

## Dipendenze fra wave

```
1B-W0 ──► 1B-W2 ──► 1B-W3 ──► 1B-W4
   │         ▲
   │         │
   └──► 1B-W1
   │
   └──► 1B-W5 ──► 1B-W6
1B-W1 ──► 1B-W7
```

`1B-W0` precede tutto: senza i template SEO e la visibilità reale del menu, lo
schema e i criteri di accettazione sarebbero costruiti su ipotesi.

## Fuori perimetro

Scaffold del monorepo, installazione di dipendenze, migrazioni eseguite, codice
applicativo, qualunque funzione gestionale, qualunque deploy.

## Chiusura — eseguita il 2026-09-14

Audit e validazione dei criteri di uscita di `CONTEXT.md` §7: rapporto in
[`AUDIT.md`](AUDIT.md). Diciannove controlli, sei difetti trovati e corretti,
diciannove su diciannove superati.

Decisioni aperte portate all'utente in `docs/discovery/open-questions-round-4.md`
(D13, D14, D15, D16) e in `docs/handoff/HO-004-scelta-ui-ux-area-amministrativa.md`
(cinque domande di design).

**La fase è completata ma non approvata.** Le dieci ADR restano proposte: nessuno
scaffold, nessuna dipendenza, nessuna migrazione prima di D15.
