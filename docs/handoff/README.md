# Handoff — istruzioni operative per il proprietario

Ogni volta che serve un'azione **tua**, qui trovi un documento con istruzioni passo
passo: prerequisiti, comandi esatti, esito atteso, cosa fare se fallisce, come
segnalare il completamento.

Convenzione: `HO-<numero>-<argomento>.md`.

| # | Documento | Fase | Stato |
|---|---|---|---|
| HO-001 | [Istanza WordPress di riferimento](HO-001-istanza-riferimento-wordpress.md) | 1A → 1E | ✅ **chiuso** — opzione A approvata, istanza costruita e validata |
| HO-002 | [Versione PHP del server di produzione](HO-002-versione-php-produzione.md) | 1B | ✅ **chiuso** — PHP 7.4.33, MySQL 5.6.51, registrato in DR-037 |
| HO-003 | [Rimozione della pagina `phpinfo()` dalla produzione](HO-003-rimozione-phpinfo-produzione.md) | 1B | ✅ **risposto** — l'utente sceglie la protezione con password (DR-042). Prosegue in HO-005 |
| HO-004 | [Scelta del design dell'area amministrativa](HO-004-scelta-ui-ux-area-amministrativa.md) | 1B | ✅ **chiuso** 2026-09-15 — DR-044…DR-048 |
| HO-005 | [Protezione con password della pagina di diagnostica](HO-005-protezione-con-password-della-pagina-di-diagnostica.md) | 1C | ✅ **chiuso** 2026-09-15 — DR-049 |
| HO-006 | [Prova a mano delle schermate della `1D-W9`](HO-006-prova-a-mano-delle-schermate-della-1D-W9.md) | 1D | ⏳ **aperto** — seme sintetico e sei schermate da guardare |
| HO-007 | [Eseguire a mano le suite della `1D-W10`](HO-007-eseguire-le-suite-della-1D-W10.md) | 1D | ✅ **chiuso** 2026-09-30 — tutti i test passati |
| HO-008 | [Conferma dell'import reale in locale](HO-008-conferma-import-reale-1D-W11.md) | 1D | ✅ **chiuso** 2026-10-04 — `apply` due volte, esito `success`; `import-completeness-report.md` |
| HO-009 | [Entrare nell'area amministrativa locale](HO-009-entrare-nell-area-amministrativa-locale.md) | 1D | ⏳ **aperto** — account locale creato, accesso da provare |
| HO-010 | [Prova a vista del trascinamento](HO-010-prova-a-vista-del-trascinamento.md) | 1D | ✅ **chiuso** 2026-10-07 — resa approvata dall'utente |
| HO-011 | [Riavviare Docker per l'audit 1D-W12](HO-011-riavviare-docker-per-l-audit-1D-W12.md) | 1D | ⏳ **aperto** — riavvio segnalato il 2026-10-08, ma da qui il motore risponde ancora 500 |

## Chiuse nel Round 3 del 2026-09-14

MI-01, MI-02, MI-03 e MI-10 sono state decise dall'utente e registrate come DR-032,
DR-033, DR-037 e DR-034. Non diventano handoff.

## Azioni previste più avanti

Non ancora aperte come handoff: lo diventeranno quando la fase le rende attuali.
L'elenco completo è in [`../migration/missing-inputs.md`](../migration/missing-inputs.md).

| Input | Fase | Natura |
|---|---|---|
| MI-04 — provider, dominio, costi | 1F | decisione con costi reali |
| MI-05 — restrizione e rotazione della chiave Google Maps | 1F | azione sull'account Google |
| MI-06 — verifica privacy e legale | 1F | validazione professionale |
| MI-07 — backup aggiornato per il delta finale | 1F | azione operativa |

## Come segnalare il completamento

Nel prompt successivo scrivi `HO-<numero>: fatto` più eventuali note o errori.
Se un passo fallisce, incolla il messaggio d'errore: non serve che lo interpreti tu.
