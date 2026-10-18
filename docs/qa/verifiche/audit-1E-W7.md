# Audit di chiusura della wave `1E-W7`

Avviato il 2026-10-18, dopo HO-025 (migrazione `0007` e import, esito `success`) e
l'ultima correzione del codice. Ogni criterio del §1 di `W7-PLAN.md` si riesegue sul sito
ricompilato (`127.0.0.1:3200`, `SITE_URL=http://127.0.0.1:3200`) e sull'API riavviata
(`127.0.0.1:3002`). La riga `STATUS:complete` si scrive solo con ogni cella eseguita e le
difformità approvate o corrette.

## 1. Stato per criterio

| Criterio | Esito | Prova |
|---|---|---|
| 1E-8 metadati | **superato**: 117 URL, 0 difformi (5 identici, 112 con sole correzioni registrate); `robots.txt` DR-176, figlie della sitemap DR-177, percorsi 113/113, feed 10/10 | `metadati-*.csv` |
| 1E-9 redirect | **superato**: 181/181 regole, 0 inversioni su 293 indirizzi | `redirect*.csv` |
| Stati della matrice | **superato**: 292 conformi, 0 difformi (`stati-matrice.py`) | — |
| Parità visiva (DR-162) | **approvata** (DR-203): 25 indirizzi su 25 accettabili, nessuna nota | `decisioni-report-1E-W7.csv`, `docs/qa/screenshots/report-1E-W7/` |
| 1E-6 interazioni (T3) | 81/81 eseguiti: menu, mobile 79/79; hover 75/79 (4 pagine, sfondo bianco del link «Iscrizioni» al passaggio, accettato con DR-204); immagini 77/79 (2 derivate più piccole a 390, DR-197); incorporati 1 (il riferimento carica un iframe YouTube all'apertura, il sito no: DR-107, DR-122); caratteri e punti di rottura come la sorgente | `interazioni.csv` |
| A-1…A-7 (T4, senza invii) | eseguita: A-1, A-3, A-4, A-6 79/79; A-2, A-7 difetti anche nella sorgente, invariati; **A-5 79/79** dopo l'etichetta del campo di ricerca (DR-205), rimisurata il 2026-10-18 con resa della testata identica al byte (3 pagine a 1440 e 390 px, ricerca aperta) | `accessibilita.csv`, `accessibilita-DR-205.csv` |
| §8 voce 4, form | **superato**: 81/81 URL, 24 form su 24 (invio vuoto con messaggi e invio sintetico confermato), nessuna email; ripresa del 2026-10-18 da 58/81 dopo la copia `amoris-prima-voce4-ripresa-2026-10-18.dump`; 9 compilazioni sintetiche cancellate (`COMMIT`), 0 residue, 425 importate invariate | `accessibilita-form-HO-026.csv` |
| 1E-17 console e rete (T5) | **superato**: 486/486 misure a zero | `console.csv` |
| A-8 contrasto (T6) | eseguita: 13 coppie, identiche alla T6 precedente; 2 non conformi di DR-115; le 2 nuove (asterisco `#f00` su bianco, segnaposto `#757575` su `#eee`) misurate uguali sul riferimento il 2026-10-18: ereditate, da correggere dopo la UAT (DR-169) | `contrasto.csv` |
| 1E-19 salvataggio senza modifiche | **superato** 4/4, home compresa, dopo DR-199…202; nel database cambia solo `updated_at` | `analisi-1E-19-HO-026.md` §7, `docs/qa/confronto/prova-1e-19.json` |
| Prove automatiche | **superato** dopo DR-205: lint e typecheck 18/18, test 8/8 pacchetti (web 118), funzioni pure 87/87 | — |
| e2e (database sintetico `amoris_e2e`) | **superato**: 31/31 | `pnpm test:e2e` |
| Sito dopo gli e2e | ricompilato (nessun file del sito cambiato dopo l'ultimo confronto) e riavviato su `:3200` con `SITE_URL`; stati della matrice 292/292 | `stati-matrice.py` |

## 2. Parità visiva dopo la T7

Ricattura integrale (591 viste: le 588 accettate con DR-162 più le 3 della pagina nuova di
DR-181) e confronto completo: 40 superati, 3 da esaminare, 548 falliti. Rispetto allo stato
accettato: **nessun esito peggiorato**. Le 591 righe sono 585 viste distinte (alcune destinazioni di redirect compaiono per più indirizzi).

| Gruppo | Viste | Dettaglio |
|---|---|---|
| Pixel invariati | 535 | identici allo stato accettato (impronta sha256 uguale) |
| Pixel cambiati per la regola delle immagini (DR-183, DR-195) | 47 in 24 URL | stesso esito di prima; 5 migliorate di oltre mezzo punto, 2 peggiorate di meno di un punto a 768 px (`/invidia-vergogna-e-senso-di-colpa-nella-consulenza-familiare/` +0,95, `/io-e-laltro-imparare-a-stare-insieme/` +0,70) |
| Pagina nuova `/download-category/moduli-consulenze/` (DR-181) | 3 | 1440 e 768 **superate (0,0000 %)**; 390 1,94 %, solo antialiasing del testo |

Correzioni fatte durante la ricattura, con prove: le voci dell'archivio dei download non
hanno lo spazio, il margine della data e i titoli ridotti dell'elenco del blog, regole che
la sorgente lì non carica (`.et_pb_post.wpdmpro:not(.single)`); le 4 pagine dei documenti
restano identiche allo stato accettato.

Da sottoporre all'utente nel report: le 47 viste cambiate e le 3 della pagina nuova.

## 3. Note dell'esecuzione

- Il salvataggio dal CMS cambiava la data di modifica anche senza modifiche: corretto prima
  dell'audit (prova in `apps/api/tests/descriptionSource.test.ts`), altrimenti 1E-19 sarebbe
  fallito per `dateModified` nel JSON-LD.
- Impostazioni in tabella: 20, non 21 come scritto in HO-025 (prima dell'import erano 18).
- La cattura in Git Bash richiede `MSYS_NO_PATHCONV=1` quando `FILTRO` contiene percorsi.
- 2026-10-18: la sequenza T5, T6, T4, T3 in background è stata fermata da Claude Code per
  memoria del sistema quasi esaurita (come HO-014). Le misure delle verifiche precedenti
  sono in `docs/qa/screenshots/verifiche-2026-10-17-prima-T7/` e `docs/qa/verifiche/prima-T7/`.
  Si riparte solo su richiesta dell'utente.
