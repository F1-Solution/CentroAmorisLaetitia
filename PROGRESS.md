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
PHASE:1D WAVE:1D-W6 STATUS:complete TS:2026-09-16T16:16:34Z
PHASE:1D WAVE:1D-W8a STATUS:complete TS:2026-09-20T07:26:52Z
PHASE:1D WAVE:1D-W8b STATUS:complete TS:2026-09-21T22:26:45Z
PHASE:1D WAVE:1D-W9 STATUS:complete TS:2026-09-22T06:17:38Z
PHASE:1D WAVE:1D-W10 STATUS:complete TS:2026-09-24T19:48:47Z
PHASE:1D WAVE:1D-W11a STATUS:complete TS:2026-09-30T09:10:47Z
<!-- 1D-W11a-bis: correzione attuata e verificata con prove mirate, NON committata; il secondo plan da ancora partial per la verifica del bucket non eseguibile (D17) e pnpm test ha 2 prove fallite per scarto d orologio del container (D18). -->
PHASE:1D WAVE:1D-W11a-bis STATUS:failed TS:2026-10-03T15:16:53Z
<!-- 1D-W11a-bis completata dopo DR-089: orologio riallineato, pnpm test verde. L esito partial residuo e affidato alla 1D-W11d (DR-088, DR-090). -->
PHASE:1D WAVE:1D-W11a-bis STATUS:complete TS:2026-10-03T16:24:21Z
PHASE:1D WAVE:1D-W11d1 STATUS:complete TS:2026-10-03T17:06:19Z
PHASE:1D WAVE:1D-W11d2 STATUS:complete TS:2026-10-03T17:10:46Z
PHASE:1D WAVE:1D-W11d3 STATUS:complete TS:2026-10-03T17:18:06Z
<!-- 1D-W11c: apply eseguito due volte su conferma di DR-072, esito success e idempotenza provata; resta import-completeness-report.md (criterio 7 di W11-PLAN). -->
PHASE:1D WAVE:1D-W11c STATUS:complete TS:2026-10-03T22:05:55Z
<!-- 1D-W11b registrata in ritardo, nell'audit del 2026-10-04: il plan e HO-008 erano stati fatti il 2026-10-03 senza la riga prevista dal protocollo. -->
PHASE:1D WAVE:1D-W11b STATUS:complete TS:2026-10-03T17:20:00Z
PHASE:1D WAVE:1D-W11 STATUS:complete TS:2026-10-04T07:56:06Z
PHASE:1D WAVE:1D-W9b1 STATUS:complete TS:2026-10-04T15:17:54Z
PHASE:1D WAVE:1D-W9b2 STATUS:complete TS:2026-10-04T15:24:47Z
PHASE:1D WAVE:1D-W9b3 STATUS:complete TS:2026-10-06T04:36:32Z
PHASE:1D WAVE:1D-W9b4 STATUS:complete TS:2026-10-07T04:51:54Z
PHASE:1D WAVE:1D-W9b STATUS:complete TS:2026-10-07T04:51:55Z
PHASE:1D WAVE:1D-W10b STATUS:complete TS:2026-10-07T06:15:20Z
<!-- 1D-W11e: apply del 2026-10-07 su conferma; form e notifica importati, criterio 10 a zero. Esito partial per il solo conteggio di users (2 contro 1): conta anche l'account locale di HO-009. Decisione D29 aperta. -->
PHASE:1D WAVE:1D-W11e STATUS:complete TS:2026-10-07T15:02:56Z
<!-- 1D-W11e-bis: D29 = A (DR-099) attuata con prove; apply --confirm dopo pg_dump con esito success. -->
PHASE:1D WAVE:1D-W11e-bis STATUS:complete TS:2026-10-07T15:24:14Z
<!-- 1D-W12 in corso dal 2026-10-07: 20 criteri su 29 eseguiti e superati, 9 in attesa (Docker non risponde, HO-011; push per la CI; D30). Nessuna riga complete finche' l'audit non e' finito. -->
<!-- 1D-W12 2026-10-09: 27 criteri su 28 superati, il 16 spostato in 1E (DR-094). Resta il 26 in CI, che dipende da D22; difetto del par. 3.1 di AUDIT.md in attesa di D31. Nessuna riga complete. -->
<!-- 1D-W12 2026-10-09: D22 = A (DR-101) e D31 = B (DR-102) attuate e provate in locale; HO-012 aperto per il volume di sviluppo. Resta il criterio 26 in CI dopo il push. Nessuna riga complete. -->
<!-- 1D-W12 2026-10-09: CI 37890020769 rossa ai test per IMPORTER_IP_HASH_SALT assente in CI; corretto, in attesa di conferma del secondo push. Nessuna riga complete. -->
PHASE:1D WAVE:1D-W12 STATUS:complete TS:2026-10-09T10:52:45Z
<!-- Fase 1D chiusa dall'utente il 2026-10-09 (DR-103). -->
<!-- 1E-W0 avviata il 2026-10-09: CONTEXT.md e PLAN.md scritti, ADR-005 revisionata per DR-071; decisioni D33-D37 in attesa. Nessuna riga complete finche' le bloccanti non sono chiuse. -->
PHASE:1E WAVE:1E-W0 STATUS:complete TS:2026-10-09T21:19:29Z
<!-- 1E-W1 2026-10-10: 585 catture di riferimento, rumore 0 fuori dalle aree da mascherare, controprova 8 su 10 identiche; due divergenze dell'istanza dal sito online (D40), conteggio 1E-2 (D41), soglia con rumore zero (D42). Nessuna riga complete finche' D40 e D41 non sono chiuse. -->
PHASE:1E WAVE:1E-W1 STATUS:complete TS:2026-10-10T06:40:51Z
PHASE:1E WAVE:1E-W2 STATUS:complete TS:2026-10-10T07:22:26Z
PHASE:1E WAVE:1E-W3 STATUS:complete TS:2026-10-10T14:36:19Z
<!-- 1E-W4 2026-10-10: modulo del sito pubblico in apps/web (rotte, template, proxy dei redirect e dei feed, mappa del sito); 292/292 indirizzi della matrice con lo stato atteso, menu 41/41, nessun service worker, lingua it. Non completa: 1E-14 dipende da D48 e dal titolo del form (1E-W5); logo e piè di pagina da D46; elenco della home da D45; 1E-15 e blocchi di riserva da D47. -->
<!-- 1E-W4 2026-10-12: correzioni DR-116…119 in 08bad93; import rieseguito due volte su conferma, success. 292/292, menu 41/41, h1 0 difformi, 1E-15 a zero, sw 0, lingua it. Resta lo scorrimento orizzontale di /informazioni-sui-cookie/ (D49). Nessuna riga complete. -->
<!-- 1E-W4 2026-10-12: D49 = A (DR-120) attuata; 292/292, menu 41/41, h1 e 1E-15 a zero, sw 0, lingua it, nessuno scorrimento orizzontale. -->
PHASE:1E WAVE:1E-W4 STATUS:complete TS:2026-10-12T13:55:52Z
<!-- 1E-W5 2026-10-12: blocchi dinamici e form resi, invio salvato senza email, nessuna chiamata a terzi al caricamento; 292/292 e verifiche 1E-W4 a zero. In attesa: riesecuzione dell'import (offset, pagamento), D50 e D51 differibili. Nessun commit. -->
PHASE:1E WAVE:1E-W5 STATUS:complete TS:2026-10-12T15:58:56Z
<!-- 1E-W6 2026-10-12: cattura del sito nuovo interrotta dal governatore di memoria della macchina (585 attesi, 475 catturati, due processi concorrenti per un errore di sessione). Corrette due cause pervasive: immagini alignleft/alignright senza stile (blocks.css, effetto immediato, verificato) e "a capo" singoli non trasformati in <br> (porto di wpautop in apps/importer, 8 prove, in attesa della riesecuzione dell'import). 17 maschere misurate (docs/qa/confronto/maschere.json), una pagina video non raggiunta. 1E-19 provato con 4 contenuti reali (home, show_title falso, form, post): pagina pubblica identica prima/dopo un salvataggio senza modifiche. Verificato il carosello della home: non e' un difetto dell'importer, la sorgente non lo rende piu' (shortcode tolto prima del backup); da correggere visual-regression-plan.md paragrafo 8 punto 10, decisione dell'utente. Regressioni rieseguite dopo la correzione CSS: stati-matrice 292/292, verifica-sito a zero, lint/typecheck/test di apps/importer e packages/blocks verdi. NON rieseguire la cattura completa senza che l'utente lo chieda. Nessuna riga complete: i 585 confronti di DR-112 restano da fare. -->
<!-- 1E-W6 2026-10-12: cattura del sito interrotta a 475/585 per memoria; correzioni: wpautop all'import (non Gutenberg, in attesa dell'import) e immagini allineate (effettiva); 1E-19 superato su 4 contenuti. Non completa: servono HO-013 (import), HO-014 (memoria) e la ricattura integrale. W7 e W8 non avviate: dipendono dalla W6. -->
<!-- 1E-W6 2026-10-13: ricattura integrale 585/585 e confronto finale: 0 superati, 585 falliti; import rieseguito su conferma per le classi del menu (success). Classificazione in 9 famiglie di difetti (A-I), fra cui 9 contenuti vuoti per wp:divi/placeholder; HO-015 attivo per 5 voci. Nessuna riga complete. -->
<!-- 1E-W6 2026-10-13: HO-015 approvato (DR-124…128). Analisi d impatto A-D in docs/qa/confronto/analisi-impatto-A-D.md, in attesa di approvazione e delle decisioni D53-D57; nessuna modifica al codice. -->
<!-- 1E-W6 2026-10-13: HO-015 approvato (DR-124…128); D53-D57 chiuse (DR-129…134). Codice delle famiglie A-D scritto con prove, 9 pacchetti verdi; ADR-011. In attesa: approvazione della famiglia J (link interni rotti, 97 in 47 contenuti) e HO-018 (import). Nessuna riga complete. -->
<!-- 1E-W6 2026-10-13: J approvata (DR-135) e corretta; HO-018 eseguito (success, 56/47/5 per /bacheca/, D58). Ricattura 585/585 e confronto: 0 superati; differenza d'altezza mediana 227 -> 110 px, coppie oltre 500 px 197 -> 45. Nuovi difetti K, L, M, C+, G riletto in classificazione.md par. 4. Nessuna riga complete. -->
<!-- 1E-W6 2026-10-13: D58=A (DR-136). Analisi d'impatto di K, L, G, C+, M e attuazione di D58 in docs/qa/confronto/analisi-impatto-K-M.md, in attesa di approvazione e di D59-D61; nessuna modifica al codice. -->
<!-- 1E-W6 2026-10-13: DR-137…140. K, C+, M, L, G e D58 attuati con prove; lint, typecheck e test verdi in 9 pacchetti; K, C+, M, L verificati a vista sul sito. G, D58 e D59 richiedono migrazione 0003 e import: HO-019 in attesa. Nessuna riga complete. -->
<!-- 1E-W6 2026-10-14: HO-019 eseguito (migrazione 0003, import success 57/47/4, page_layout come atteso); D62=A (DR-141) attuata; corretto lo spazio sopra il titolo degli articoli Divi a tutta larghezza; schema canonico allineato a page_layout (CI 38470531317 rossa per questo). Ricattura 585/585 e confronto: 0 superati; mediana d'altezza 92 -> 72 px, oltre 500 px 45 -> 36. Restano E, F, H, I. Nessuna riga complete. -->
<!-- 1E-W6 2026-10-14: commit 1585fb8 pubblicato su conferma. Analisi d impatto E-F in docs/qa/confronto/analisi-impatto-E-F.md, in attesa di approvazione e di D63-D65; nessuna modifica al codice. -->
<!-- 1E-W6 2026-10-14: DR-142...145. E1, E2 (icone), E4, E5, F1-F2 attuati e misurati: testata e piè di pagina come la sorgente alle 4 viewport. Interruzione per isolamento della macchina (allarme CrowdStrike su un comando bash di modifica e riavvio del sito), sbloccata dall IT senza vincoli. In corso E3: ricerca; migrazione 0004 (data dei documenti) scritta, non applicata. Nessun commit. -->
<!-- 1E-W6 2026-10-14: E3 scritto: lettura /public/search (algoritmo di WordPress, 17 prove fra termini e integrazione), pagina dei risultati e icona con campo nella testata; /?s=corso aggiunto alla matrice (riferimento catturato, stabile). Migrazione 0004 e import in attesa di HO-020; API non riavviata. Nessun commit. -->
<!-- 1E-W6 2026-10-14: HO-020 eseguito (migrazione 0004, import success 57/47/4, date dei 4 download pubblici al 2022-04-05); 292/292. Ricerca: 9 frasi, ordine identico in 8, differenze d'insieme solo da attributi grezzi; Corso Per diverge (D66). Campo di ricerca: altezza, carattere, spaziatura da correggere; contorno D67. Ricattura 588/588 e confronto: 0 superati; mediana 72 -> 68 px, oltre 500 px 36 -> 39; testata ora come la sorgente; nuove cause (a) sottomenu con testata sticky (D68), (b) piè di pagina gutters3 invece di gutters2 (D69), (c) spaziature dell'articolo di pagina, e differenze della pagina dei risultati. Tutto in docs/qa/confronto/ricerca-E3.md. Nessuna modifica al codice, nessuna riga complete. -->
<!-- 1E-W6 2026-10-14: DR-146...150. Analisi in docs/qa/confronto/analisi-impatto-ricerca-E3.md. Attuati con prove (b) spaziatura per pagina (migrazione 0005, importer, API, sito), (a) sottomenu, campo di ricerca, (c) articolo di pagina, risultati e archivio, D66 testo per blocchi; lint, typecheck 9/9, test 8/8, db:verify ok, revisione senza critici. Sito ricompilato: 404 e bacheca alla stessa altezza della sorgente, piè di pagina uguale tranne /chi-siamo/ (attende import). API non riavviata: HO-021 in attesa. Ricattura interrotta dal sistema per memoria a 299/588 (ripartibile). Nuova decisione D70 (wptexturize, estratti). Nessuna riga complete. -->
<!-- 1E-W6 2026-10-16: DR-151 (D70=A). HO-021 eseguito (migrazione 0005, import success 57/47/4, gutter 3 su /chi-siamo/); ricerca: ordine identico in 9 frasi su 9. Ricattura 588/588 (ripresa dopo l'arresto per memoria) e confronto: 4 superati, 13 da esaminare, 571 falliti; mediana 68 -> 27 px; stessa altezza 24 -> 76. Analisi D70 scritta, in attesa di approvazione dell'elenco; contorno della ricerca non deciso. Nessuna riga complete. -->
<!-- 1E-W6 2026-10-16: DR-152, DR-153. D70 attuata con prove (porto di wptexturize nell'importer, estratti contati come Divi, ricerca che equipara apici tipografici e dritti); lint, tipi 9/9, prove 8/8. Linea di partenza della tipografia: 98 indirizzi, 1258 scarti. HO-022 (import) in attesa. Esame delle 13 coppie da esaminare: frecce del menu (position), logo (translate3d), interlinea 1.7em, maschera della mappa da rimisurare; provati a campione, da approvare. Nessuna riga complete. -->
<!-- 1E-W6 2026-10-16: DR-154. HO-022 eseguito (import success). Correzioni del par. 7 attuate; maschere rimisurate. Tipografia 1258 -> 67 scarti, titoli 0. Ricattura 588/588 e confronto: 17 superati, 1 da esaminare, 570 falliti; stessa altezza 76 -> 94, mediana 27 -> 25 px. Estratti: peso 7 confermato (prova a 1 peggiore). Nuove D71 (estratti) e D72 (descrizione dei campi di pagamento). Nessuna riga complete. -->
<!-- 1E-W6 2026-10-16: DR-155 (D71=A), DR-156 (D72=A, già soddisfatta: il testo del bonifico compare scegliendo Bonifico come nella sorgente). Analisi per famiglie in docs/qa/confronto/analisi-famiglie-DR-154.md: cambi di 1-3 px tutti verso l'alto (interlinea); cause nuove Q (padding per dispositivo ereditato), P (spaziature dell'articolo), N (colonne Gutenberg), S (liste), R, T, U, V, W; prova iniettata su 579 coppie: stessa altezza 90 -> 279, mediana 25 -> 1 px. In attesa: approvazione dei punti e D73-D75. Nessuna modifica al codice, nessuna riga complete. -->
<!-- 1E-W6 2026-10-16: DR-157…161. Attuati Q, P, N, S, V, D71, R, U1, T, U2-U3, D75 con prove (10 pacchetti verdi, revisione del codice senza critici); HO-023 eseguito su conferma (migrazione 0006, import success, summary_source 108/108). Ricattura 588/588 e confronto: 38 superati, 3 da esaminare, 547 falliti; stessa altezza 94 -> 303, mediana 25 -> 0 px, oltre 500 px 34 -> 9. Report visivo pubblicato come artifact per decidere le difformità. Nessuna riga complete, nessun commit. -->
<!-- 1E-W6 2026-10-17: DR-162…164: nel report l'utente ha accettato tutte le difformità (112 indirizzi, 544 viste), captcha di /contatti/ compreso; nessuna correzione richiesta. 1E-19 dopo l'ultimo giro: 4/4 identici. Criteri d'uscita della wave soddisfatti; chiusura proposta, in attesa di conferma. Nessuna riga complete, nessun commit. -->
PHASE:1E WAVE:1E-W6 STATUS:complete TS:2026-10-17T04:52:48Z
<!-- 1E-W7 2026-10-17: piano di dettaglio in .planning/phases/1E/W7-PLAN.md; decisioni D76-D79 in attesa. Nessuna attività avviata. -->
<!-- 1E-W7 2026-10-17: DR-166…169 registrate; push di 1a107c0 eseguito. T1 eseguita: 117 URL, 3 identici, 114 difformi per 8 famiglie (M1-M8, docs/qa/verifiche/riepilogo.md), correzioni DR-040 classificate; classificatore 12/12. Nessuna correzione al codice del sito, nessun commit. -->
<!-- 1E-W7 2026-10-17: T2 eseguita: 181/181 regole di redirect (sito, lettura pubblica e riferimento concordi), 0 inversioni sui 293 indirizzi; /wp-admin/ 404, fuori ambito per la matrice. Funzioni pure 17/17 (29/29 con la T1). M1-M8 restano per la T7. Nessuna modifica al codice del sito, nessun commit. -->
<!-- 1E-W7 2026-10-17: DR-170…178 registrate (M1-M8 e accesso al CMS, tutte le raccomandazioni accettate), docs/qa/verifiche/decisioni-metadati-M1-M8.md; correzioni rinviate alla T7. T3 avviata. -->
<!-- 1E-W7 2026-10-17: T3 in corso, interrotta dal sistema per memoria (HO-014) dopo 30+ URL su 81; ripartibile da docs/qa/screenshots/verifiche/stato.json. Script T3-T6 scritti, funzioni pure 69/69. Riconoscimento della barra laterale corretto dopo l'avvio: rimisurare gli URL con barra. T4-T6 non avviate. Nessuna modifica al codice del sito, nessun commit. -->
<!-- 1E-W7 2026-10-17: T3 eseguita, 81/81 (interazioni.csv): menu 79/79, mobile 79/79, punti di rottura 76 + 3 con scorrimento anche nella sorgente; hover 79 non superati per una causa (opacità 0,7 delle voci del menu assente); caratteri 79 con CLS > 0 anche nella sorgente; immagini 13 con derivata più piccola; incorporati: 2 video .mp4 resi come collegamento. Correzioni di misura: barra laterale, mappe, file servito al posto di naturalWidth. Nessuna modifica al sito, nessun commit. -->
<!-- 1E-W7 2026-10-17: T4 eseguita (accessibilita.csv): A-1, A-4, A-6 79/79; A-2, A-3, A-5, A-7 con difetti ereditati; form 2/24, 22 bloccati dal telefono internazionale (F1); 2 compilazioni sintetiche in locale, HO-024. T5 eseguita: 486/486 misure a zero. T6 eseguita: 13 coppie, 2 di DR-115, 2 nuove probabilmente ereditate. Riepilogo in docs/qa/verifiche/riepilogo.md. Resta la T7. Nessuna modifica al sito, nessun commit. -->
<!-- 1E-W7 2026-10-18: HO-024 eseguito su conferma (copia di salvataggio, 2 compilazioni sintetiche cancellate, 425 importate invariate). T7 avviata: analisi d impatto di M1-M8, F1, I1-I3, A3-1 in corso; nessuna modifica al codice. -->
<!-- 1E-W7 2026-10-18: T7, analisi d impatto in docs/qa/verifiche/analisi-impatto-T7.md (13 voci, punti da toccare file:riga). DR-172 e DR-173 contraddette dalle prove (title tipografici nella sorgente; estratto usato negli articoli): D80, D81. /download-category/moduli-consulenze/ risponde 404 (D82). Round 1 D80-D84 aperto, D85-D96 al round 2. Nessuna modifica al codice, nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: DR-179…183 (D80-D84 = A), elenco approvato. Gruppo 1 attuato con prove: F1, A3-1, I1 senza freccia, M2, M6, M7; pnpm test 8/8, lint e typecheck verdi; sito :3200 ricompilato e riavviato con SITE_URL, verifiche mirate superate (analisi-impatto-T7.md par. 8). Round 2 aperto (D85, D88-D91). Nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: DR-184…188 (D85=A, D88=B, D89=B, D90=A, D91=A). Fatti per il round 3: nessun riferimento a /wpdmcategory/ in contenuti, menu e redirect; nessun profilo social nella sorgente. Round 3 aperto (D86, D87, D92, D93, D94); D97 (SITE_URL obbligatoria) separata da D93, al round 4 con D95 e D96. Nessuna modifica al codice. -->
<!-- 1E-W7 2026-10-18: DR-189…193 (D86=A, D87=A, D92=A, D93=A, D94=A). Round 4 aperto (D95, D96, D97, D99); il form commentato della pagina del seminario è già accettato da DR-162. Nessuna modifica al codice. -->
<!-- 1E-W7 2026-10-18: DR-194…197 (D95=A, D96=A, D97=A, D99=B). Gruppi 2 e 3 avviati in tre aree a proprietà separata dei file (dati/importer/API; immagini/font/CMS; sito/JSON-LD/prove), nessuna scrittura sul database, nessun import, nessun commit. -->
<!-- 1E-W7 2026-10-18: gruppi 2 e 3 attuati (DR-184…197) con prove; revisioni di codice e sicurezza senza critici o alti, medi corretti; lint e typecheck 18/18, prove 1503, funzioni pure 87/87. HO-025 (migrazione 0007 e import) in attesa di conferma; verifiche sul sito, ricattura e audit dopo HO-025. Nuova decisione D100 (testi delle briciole di ricerca e 404). Nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: DR-198 (D100=A). HO-025 eseguito su conferma (copia di salvataggio, migrazione 0007, import success; conteggi attesi, impostazioni 20). API e sito riavviati con SITE_URL. Audit: 1E-8 superato (0 difformi), 1E-9 181/181, stati 292/292; ricattura integrale e confronto: nessun esito peggiorato, 47 viste cambiate dalla regola delle immagini, pagina dei moduli 2/3 superate. Corretti la data di modifica a salvataggio identico e lo spazio delle voci dei moduli. T5 interrotta a 221/486 dal sistema per memoria, T3/T4/T6 non avviate. HO-026 (scritture dell audit) in attesa. Nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: audit ripreso. T5 486/486 a zero; T6 13 coppie identiche a prima; T4 senza form: A-3 ora 79/79, resto invariato; T3 81/81: hover 75/79 (4 «Iscrizioni»), immagini 77/79, resto invariato. HO-026: copia di salvataggio; 1E-19 2/3, /corsi-2022-2023/ diversa per description_source azzerata dalla prova (blocchi senza testo), analisi in docs/qa/verifiche/analisi-1E-19-HO-026.md, D101-D102 aperte; voce 4 fermata dal sistema per memoria a 45/81 (2 form superati), 3 compilazioni sintetiche cancellate, 425 importate invariate. e2e e report non eseguiti. Nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: DR-199, DR-200. HO-027: description di /corsi-2022-2023/ ripristinata; prova 1E-19 e regex di service.ts:189 corrette con prova (API 239/239); API riavviata. 1E-19 rieseguita: 1/4, per HTML non deterministico (ordine del payload RSC, anche senza salvataggi) e home non salvabile (titolo vuoto, 400): D103, D104 aperte, analisi-1E-19-HO-026.md par. 6. Database: solo updated_at di 3 contenuti. Voce 4, e2e e report non avviati: memoria libera 1,9 GB. Nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: DR-201, DR-202 attuate con prove (API 246/246, revisione senza critici o alti); 1E-19 4/4. Voce 4 fermata di nuovo dal sistema per memoria a 58/81 (15 form superati); 14 compilazioni sintetiche cancellate, 425 importate invariate. Report visivo pubblicato (25 indirizzi, 50 viste), scelte in attesa. e2e e riavvio del sito non eseguiti per memoria (2,1 GB). Nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: DR-203 (report 1E-W7: 25 indirizzi accettabili). Voce 4 ripresa e chiusa: 81/81, 24 form su 24; 9 compilazioni sintetiche cancellate, 425 importate invariate. e2e 31/31; sito ricompilato e riavviato su :3200 con SITE_URL, stati 292/292. Contrasto: le 2 coppie nuove sono ereditate (DR-169). Audit fermo su D105 (sfondo di «Iscrizioni») e D106 (etichetta del campo di ricerca). Nessuna riga complete, nessun commit. -->
<!-- 1E-W7 2026-10-18: DR-204 (D105=A), DR-205 (D106=A). Etichetta «Cerca» del campo di ricerca con prova; lint, typecheck, test verdi; sito ricompilato e riavviato su :3200 con SITE_URL, resa identica al byte su 7 catture. A-5 rimisurata 79/79 (accessibilita-DR-205.csv), resto invariato. Audit chiuso: ogni criterio eseguito, difformità approvate o corrette. Chiusura della wave e commit proposti, in attesa di conferma. -->
PHASE:1E WAVE:1E-W7 STATUS:complete TS:2026-10-18T19:50:53Z
<!-- 1E-W8 2026-10-18: piano di dettaglio in .planning/phases/1E/W8-PLAN.md; decisioni D107-D109 in attesa. Trovato: CI rossa su 1a107c0 per Prettier, 10 file da formattare su 8be9e7b (T1). Commit 8be9e7b non pubblicato. Nessuna attività avviata. -->
<!-- 1E-W8 2026-10-18: DR-207…209 (D107-D109 = A). T1: 10 file formattati con Prettier (solo formattazione, testo invariato); un file instabile con i CRLF portato a LF. Verifica come la CI verde: lint, Prettier, tipi, build, test, db:verify, copertura, e2e 31/31. Commit e push confermati dall'utente. -->
