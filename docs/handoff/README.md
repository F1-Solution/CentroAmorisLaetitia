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
| HO-009 | [Entrare nell'area amministrativa locale](HO-009-entrare-nell-area-amministrativa-locale.md) | 1D | ✅ **chiuso** 2026-10-09 — l'utente è entrato nell'area amministrativa locale |
| HO-010 | [Prova a vista del trascinamento](HO-010-prova-a-vista-del-trascinamento.md) | 1D | ✅ **chiuso** 2026-10-07 — resa approvata dall'utente |
| HO-011 | [Riavviare Docker per l'audit 1D-W12](HO-011-riavviare-docker-per-l-audit-1D-W12.md) | 1D | ✅ **chiuso** 2026-10-09 — Docker risponde; il comando del passo 4 era sbagliato ed è corretto |
| HO-012 | [Passare il volume di sviluppo alle immagini Chainguard](HO-012-passare-il-volume-di-sviluppo-alle-immagini-chainguard.md) | 1D | ✅ **chiuso** 2026-10-09 — server Chainguard sano, 1477 + 4 oggetti, anonimo 403 |
| HO-013 | [Conferma della riesecuzione dell'import](HO-013-conferma-riesecuzione-import-1E-W5.md) | 1E | ✅ **chiuso** 2026-10-13 — confermato (round 35), import eseguito, esito `success` |
| HO-014 | [Liberare memoria per la ricattura](HO-014-liberare-memoria-per-la-ricattura-1E-W6.md) | 1E | ✅ **chiuso** 2026-10-13 — 9,3 GB liberi (round 35), ricattura integrale fatta |
| HO-015 | [Approvazione di maschere e difformità](HO-015-approvazione-maschere-e-difformita-1E-W6.md) | 1E | ✅ fatto il 2026-10-13: 5 voci approvate (DR-124…128) |
| HO-016 | [UAT di parità visiva](HO-016-uat-di-parita-1E-W8.md) | 1E | ✅ fatto il 2026-10-18: UAT approvata (DR-210); compilazione di prova cancellata il 2026-10-19 |
| HO-017 | [Distruzione dell'istanza di riferimento](HO-017-distruzione-istanza-di-riferimento.md) | 1E | 🕓 **rinviato** a dopo la Fase 1G (DR-212) |
| HO-018 | [Conferma della riesecuzione dell'import (famiglie A–D)](HO-018-conferma-riesecuzione-import-1E-W6.md) | 1E | ✅ fatto il 2026-10-13: import `success`, esito in §7 |
| HO-019 | [Migrazione e import in locale (famiglie G, D58, D59)](HO-019-migrazione-e-import-1E-W6.md) | 1E | ✅ fatto il 2026-10-14: migrazione 0003, import `success` |
| HO-020 | [Migrazione e import in locale (ricerca E3)](HO-020-migrazione-e-import-ricerca-1E-W6.md) | 1E | ✅ fatto il 2026-10-14: migrazione 0004, import `success`, esito in `docs/qa/confronto/ricerca-E3.md` |
| HO-021 | [Migrazione e import in locale (spaziatura D69, testo D66)](HO-021-migrazione-e-import-spaziatura-1E-W6.md) | 1E | ✅ fatto il 2026-10-16: migrazione 0005, import `success`, `/chi-siamo/` con spaziatura 3 |
| HO-022 | [Import in locale (tipografia D70)](HO-022-import-tipografia-1E-W6.md) | 1E | ✅ fatto il 2026-10-16: import `success`, tipografia da 1.258 a 67 scarti |
| HO-023 | [Migrazione 0006 e import in locale (famiglie dopo DR-154)](HO-023-migrazione-e-import-famiglie-1E-W6.md) | 1E | ✅ fatto il 2026-10-16: migrazione 0006, import `success` 57/47/4, `summary_source` 108/108 |
| HO-024 | [Cancellazione delle compilazioni sintetiche](HO-024-cancellazione-compilazioni-sintetiche-1E-W7.md) | 1E | ✅ fatto il 2026-10-18: 2 compilazioni sintetiche cancellate, 425 importate invariate |
| HO-025 | [Migrazione 0007 e import in locale](HO-025-migrazione-0007-e-import-1E-W7.md) | 1E | ✅ fatto il 2026-10-18: migrazione 0007, import `success` |
| HO-026 | [Scritture locali dell'audit](HO-026-scritture-dell-audit-1E-W7.md) | 1E | ✅ fatto il 2026-10-18: 1E-19 e voce 4 dei form (24/24), compilazioni sintetiche cancellate |
| HO-027 | [Ripristino della description e 1E-19](HO-027-ripristino-description-e-1E-19-1E-W7.md) | 1E | ✅ fatto il 2026-10-18 (DR-199, DR-200) |
| HO-028 | [Home senza titolo e confronto di 1E-19](HO-028-home-senza-titolo-e-confronto-1E-19-1E-W7.md) | 1E | ✅ fatto il 2026-10-18 (DR-201, DR-202), 1E-19 4/4 |
| HO-029 | [Ultime difformità dell'audit](HO-029-ultime-difformita-dell-audit-1E-W7.md) | 1E | ✅ fatto il 2026-10-18 (DR-204, DR-205) |

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
