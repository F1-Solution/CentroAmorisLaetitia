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
| HO-006 | [Prova a mano delle schermate della `1D-W9`](HO-006-prova-a-mano-delle-schermate-della-1D-W9.md) | 1D | ⏳ **aperto** — assorbito nel collaudo della `1G-W8` (DR-226): le sue sei prove sono distribuite in HO-040 e HO-049 (media), HO-041 (menu), HO-042 (SEO), HO-043 (redirect), HO-051 (impostazioni) |
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
| HO-017 | [Distruzione dell'istanza di riferimento](HO-017-distruzione-istanza-di-riferimento.md) | 1E → 1F | ✅ **fatto** il 2026-11-02 — contenitori, volumi e immagine tolti (DR-349) |
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
| HO-030 | [Migrazione `0008` e primo account di amministrazione](HO-030-migrazione-0008-1G-W1.md) | 1G | ✅ migrazione eseguita il 2026-10-20 (copia `amoris-prima-HO-030-2026-10-20.dump`); account di amministrazione creato dall'utente (§3) |
| HO-031 | [Prove dell'anteprima e di 1E-19 sui contenuti veri](HO-031-prove-anteprima-e-1E-19-1G-W5.md) | 1G | ✅ fatto il 2026-10-26 con §3-bis (account sintetico `qa-1g-w5@locale.invalid`): anteprima 106/106 identici, 1E-19 4/4 |
| HO-032 | [Installare `qpdf` sulla macchina di sviluppo](HO-032-installare-qpdf-1G-W6.md) | 1G | ✅ fatto il 2026-10-26: `qpdf` 12.4.2 in `C:\Program Files\qpdf 12.4.2\bin`, fuori dal `PATH` di sistema; le prove lo trovano con `QPDF_PATH` |
| HO-033 | [Migrazione `0009` sul database di sviluppo](HO-033-migrazione-0009-1G-W6.md) | 1G | ✅ fatto il 2026-10-26: migrazione `0009` (copia `amoris-prima-HO-033-2026-10-26.dump`), esito nel §6 |
| HO-034 | [Ambiente di collaudo](HO-034-ambiente-di-collaudo-1G-W7.md) | 1G | ✅ fatto il 2026-10-27 (account verificati in sola lettura); ripristinato il 2026-10-27 sul commit `e61d20b` per la `1G-W8`: account sintetici da ricreare (§4.3) |
| HO-035 | [1E-19 e anteprima sul collaudo](HO-035-prove-sul-collaudo-1G-W7.md) | 1G | ✅ fatto il 2026-10-27: anteprima 106/106 identici, 1E-19 4/4 |
| HO-036 | [Compito 1G-1 — creare una pagina, pubblicarla, metterla nel menu](HO-036-creare-pagina-e-menu-1G-W8.md) | 1G | ✅ fatto il 2026-10-27: riuscito con difficoltà, 2 minuti; difetti W8-01, W8-03, W8-04, W8-05 (`docs/qa/collaudo-1G-W8.md`) |
| HO-037 | [Compito 1G-2 — testo e immagine di una pagina Gutenberg](HO-037-testo-e-immagine-gutenberg-1G-W8.md) | 1G | ✅ fatto il 2026-10-28: riuscito; immagine aggiunta invece che sostituita (W8-06); prove accessorie da riportare allo stato iniziale |
| HO-038 | [Compito 1G-3 — testo e immagine di una pagina Divi convertita](HO-038-testo-e-immagine-divi-1G-W8.md) | 1G | ✅ fatto il 2026-10-28 dall'utente: riuscito; andata e ritorno riuscita (W8-07: confronto dell'handoff troppo severo) |
| HO-039 | [Compito 1G-4 — contenuto con un blocco di riserva](HO-039-blocco-di-riserva-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-040 | [Compito 1G-5 — sostituire un'immagine e il testo alternativo](HO-040-sostituire-immagine-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito con difficoltà (`docs/qa/collaudo-1G-W8.md`) |
| HO-041 | [Compito 1G-6 — cambiare l'ordine di due voci del menu](HO-041-ordine-del-menu-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-042 | [Compito 1G-7 — titolo SEO e suo effetto](HO-042-titolo-seo-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-043 | [Compito 1G-8 — creare un redirect](HO-043-redirect-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito con difficoltà (`docs/qa/collaudo-1G-W8.md`) |
| HO-044 | [Compito 1G-9 — chi ha modificato un contenuto e quando](HO-044-chi-ha-modificato-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-045 | [Compito 1G-10 — la pagina pubblica corrisponde all'anteprima](HO-045-anteprima-e-sito-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito con difficoltà (`docs/qa/collaudo-1G-W8.md`) |
| HO-046 | [Compito 1G-11 — indirizzo e pagina genitore](HO-046-indirizzo-e-genitore-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-047 | [Compito 1G-12 — estratto, immagine in evidenza e categorie](HO-047-notizie-e-categorie-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-048 | [Compito 1G-13 — eliminare un contenuto](HO-048-eliminare-contenuti-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito con difficoltà (`docs/qa/collaudo-1G-W8.md`) |
| HO-049 | [Compito 1G-14 — file non ammessi rifiutati in italiano](HO-049-file-rifiutati-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-050 | [Compito 1G-15 — documento scaricabile e carosello](HO-050-documenti-e-caroselli-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-051 | [Compito 1G-16 — account, password e impostazioni del sito](HO-051-account-e-impostazioni-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito con difficoltà (parte C) (`docs/qa/collaudo-1G-W8.md`) |
| HO-052 | [Compito 1G-17 — accessi negati alla redazione](HO-052-accessi-negati-alla-redazione-1G-W8.md) | 1G | ✅ eseguito dall'agente il 2026-10-28 (DR-290): riuscito (`docs/qa/collaudo-1G-W8.md`) |
| HO-053 | [Liberare memoria per la cattura integrale](HO-053-liberare-memoria-per-la-cattura-1G-W7.md) | 1G | ⏳ **aperto** — serve alla T4 della `1G-W7` |
| HO-054 | [Incarico della verifica privacy e legale (MI-06)](HO-054-incarico-verifica-privacy-MI-06.md) | 1F | ⏳ **aperto** — DR-303: documento di ambito in `docs/legal/MI-06-ambito-verifica-privacy.md`; prima della produzione |
| HO-055 | [Liberare memoria per la cattura integrale della `1G-W9`](HO-055-liberare-memoria-per-la-cattura-1G-W9.md) | 1G | ⏳ **aperto** — serve alla T10 della `1G-W9` (2,3 GB liberi su 6) |
| HO-056 | [Acquisto del server Aruba Cloud VPS O4A8](HO-056-acquisto-server-aruba-1F.md) | 1F | ⏳ **preparato** — decisioni DR-352…DR-354; si esegue nella `1F-W5` (DR-352) |

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
