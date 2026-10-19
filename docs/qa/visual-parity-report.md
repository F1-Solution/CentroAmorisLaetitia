# Rapporto di parità visiva — Fase 1E

| | |
|---|---|
| **Stato** | **UAT approvata dall'utente il 2026-10-18** (§12, DR-210), con le difformità accettate elencate nel §11.1. Audit in [`AUDIT.md`](../../.planning/phases/1E/AUDIT.md). Il gate resta chiuso fino al deploy in produzione verificato |
| **Piano** | [`visual-regression-plan.md`](visual-regression-plan.md), approvato con DR-110 |
| **Criteri** | [`acceptance-criteria.md`](acceptance-criteria.md) §4 e §6 |
| **Immagini** | `docs/qa/screenshots/`, **fuori da Git** (DR-106): ogni immagine si riconosce dalla sua impronta SHA-256 nelle tabelle di `docs/qa/riferimento/` |

Le sezioni 1–6 sono l'esito della `1E-W1`, la cattura del riferimento; il §10 quello
del confronto della `1E-W6`; il §11 quello delle verifiche della `1E-W7`; il §12 è la UAT.

---

## 1. Ambiente della misura

Fissato una volta e invariato per tutta la Fase 1E (`visual-regression-plan.md` §4).

| Voce | Valore |
|---|---|
| Strumento | Playwright **1.63.0**, fissato senza intervallo in `package.json` |
| Motore | Chromium **153.0.8010.12** fornito da quella versione (build `chromium-1243`) |
| Opzioni del motore | `--force-color-profile=srgb`, `--font-render-hinting=none`, `--disable-lcd-text` |
| Confronto per pixel | `pixelmatch` 7.2.0, `pngjs` 7.0.0, solo sviluppo, fissati senza intervallo |
| Sistema | Windows 11 Enterprise 10.0.26200; Node.js 25.0.0; Docker 29.8.1 |
| Istanza di riferimento | WordPress 7.1, tema Divi 4.18.0, PHP 8.2.34 su Apache 2.4.68, MariaDB 10.11.19, `tools/wp-reference/`, solo su loopback, porta **8088** |
| Contesto del browser | lingua `it-IT`, fuso `Europe/Rome`, schema colori chiaro, fattore di scala 1, sessione anonima, service worker bloccati |
| Data della cattura di riferimento | 2026-10-10 (UTC) |
| Codice della misura | `tests/visual/` |

## 2. Condizioni di cattura

Le dieci del piano §5, con le scelte di attuazione dichiarate.

| # | Condizione | Come è attuata |
|---|---|---|
| 1 | Fuso e lingua | `Europe/Rome`, `it-IT` nel contesto |
| 2 | Sessione anonima | contesto nuovo per ogni viewport, nessun cookie |
| 3 | Caratteri caricati | attesa di `document.fonts.ready` |
| 4 | Quiete della rete e ritardo fisso | `networkidle`, poi **1500 ms** |
| 5 | Animazioni concluse | la pagina si **scorre fino in fondo** a passi di una schermata, così partono le animazioni d'ingresso di Divi e si caricano le immagini differite; poi `animations: 'disabled'` alla cattura |
| 6 | Barre di scorrimento | nascoste |
| 7 | Cursore e fuoco | cursore nascosto, nessun elemento a fuoco |
| 8 | Profilo colore e caratteri | opzioni del motore del §1 |
| 9 | Pagina intera | sì |
| 10 | Tre scatti prima di accettare | tre scatti; il riferimento è il **primo**, gli altri due dicono se è stabile |

**Attese aggiunte, e perché.** Ogni immagine con un indirizzo si attende **caricata e
decodificata**, fino a 60 secondi; le non caricate si contano e si scrivono per ogni
cattura (`immagini_mancanti`). Senza questa regola, nelle prime prove, alcune
pagine avevano un riferimento senza la locandina e tre scatti comunque coincidenti.

**Richieste deviate, e perché.**

| Richiesta | Trattamento | Motivo |
|---|---|---|
| Analisi del traffico (Google Tag Manager, Google Analytics) | bloccata | non cambia la resa; evita di registrare visite finte. Produce in console «net::ERR_FAILED», che non si conta fra gli errori |
| File di `/wp-content/` chiesti con l'indirizzo del sito online | serviti dalla copia dell'istanza | il logo e le immagini sono salvati con l'indirizzo assoluto del sito vero; il riferimento deve restare congelato |
| File di `/wp-content/` chiesti a `localhost:8080` | serviti dall'istanza, con l'intestazione `Access-Control-Allow-Origin` | la cache CSS di Divi cita il carattere delle icone con la porta dell'istanza al momento della sua nascita, nella 1A–1B. Oggi quella porta appartiene a un'altra applicazione di questa macchina: senza la deviazione, 16 pagine perdevano le icone |

**Istanza.** Dal 2026-10-10 la copia di lavoro dei file di WordPress sta in un volume
Docker, copiato una volta da `.reference/html`: sulla cartella di Windows montata ogni
controllo di file costava circa 7 ms e una pagina più di un minuto. Il contenuto è lo
stesso, cache di Divi compresa. La cache di Divi non è stata rigenerata: durante le
catture Divi ha **aggiunto** i fogli di stile di una pagina che non li aveva (959, la
pagina di destinazione di un documento) e aggiornato due file di consultazione; nessun
foglio di stile esistente è stato riscritto.

## 3. Riferimento catturato

Tabella completa, con l'impronta e la fonte di ogni immagine:
[`riferimento/catture.csv`](riferimento/catture.csv).

| Voce | Valore |
|---|---|
| Catture | **585 su 585**, il numero del criterio 1E-2 (DR-112) |
| Dalla matrice, livello A | 79 URL × 6 viewport = **474** |
| Dalla matrice, livello B | 31 URL × 3 viewport = **93** |
| Aggiunte | **18**: le 4 pagine di destinazione dei documenti e le pagine 2 e 3 dell'archivio delle notizie, a 3 viewport |
| Fonte | **567 dall'istanza**, **18 dal sito online**: le 4 pagine di DR-111 (§6) |
| Stato HTTP | 579 risposte 200; 6 risposte 404, la pagina d'errore attesa |
| Stabili ai tre scatti | **577** |
| Instabili | **8**, su 2 URL, tutte nelle aree del §5 |
| Con immagini mancanti | **0** |

Le righe della matrice che non hanno aspetto proprio non si fotografano come sono:
`robots.txt` e `sitemap.xml` (livello A, confronto strutturale del §9 del piano),
`wp-sitemap.xml` (302) e i 4 documenti che rispondono 301 (livello B, verifica del
§10). È la ragione per cui la matrice dà 567 catture invece delle 594 scritte nel
piano della 1B; DR-112 fissa il conteggio a 585.

## 4. Rumore di fondo — criterio 1E-1

Ogni cattura è stata ripetuta in una seconda passata, a distanza di tempo
(`visual-regression-plan.md` §6.3): [`riferimento/rumore.csv`](riferimento/rumore.csv).

| Voce | Valore |
|---|---|
| Confronti | 585, tutti con le stesse dimensioni |
| Con differenza **zero** | **577** |
| Diversi da zero | **8**, tutti nelle aree da mascherare del §5: `/contatti/` 5, il riproduttore video di `/corso-per-consulenti-familiari-vecchia-pagina/` 3 |
| Rumore fuori dalle aree da mascherare | **0 %** in 585 confronti su 585 |

Una passata precedente aveva dato un evento isolato del 14,81 % su
`/i-prossimi-corsi-del-centro/` a 768, mai riprodotto in quattro ripetizioni; la pagina
è poi passata alla fonte online per DR-111 e non ha più rumore.

**Esito di 1E-1: superato**, rumore **zero**. Per **DR-113** la soglia di superamento
automatico è quindi lo **0 %**: supera da solo solo il confronto identico al pixel.

**Rientro:** nella `1E-W6` ogni confronto che fallisce si ricattura una volta, nelle
stesse condizioni, prima di essere classificato.

## 5. Aree non deterministiche — maschere

Proposte nella `1E-W1` con l'area misurata, **approvate** voce per voce in HO-015
(DR-124…128, criterio 1E-5): banner dei cookie, mappa `.blk-map`, video `.blk-video`,
tabella dei cookie a 390 e 360 px. Le coordinate si calcolano a ogni cattura
(`tests/visual/maschere.ts`); 29 viste dell'ultimo confronto ne hanno almeno una. La
domanda di controllo di `/contatti/` non è più una maschera: il sito non la mostra (DR-163).

| Area | Dove | Perché cambia | Previsto dal piano |
|---|---|---|---|
| Domanda di controllo del modulo di contatto di Divi («9 + 2 =») | `/contatti/`, tutte le viewport | numeri casuali a ogni caricamento | no: **nuova** |
| Riproduttore video | `/corso-per-consulenti-familiari-vecchia-pagina/`; i video di YouTube delle pagine di DR-111 | il primo fotogramma o l'anteprima compare o no | sì, §5.1 «video incorporati» |
| Mappa Google | `/contatti/`, `/dove-siamo/` | servizio esterno; nell'istanza mostra lo stato d'errore del servizio («BillingNotEnabledMapError»), stabile ma non quello reale | sì, §5.1 |
| Banner dei cookie | — | nell'istanza e nella controprova online il banner **non compare** a una sessione automatica: nessuna area da mascherare finora | sì, §5.1; DR-107 |

## 6. Controprova sul sito online — criterio 1E-10

10 URL ad alta priorità, letti in sola lettura (DR-016), a 1440 e 390, confrontati con
il riferimento: [`riferimento/controprova.csv`](riferimento/controprova.csv). Scelta
deterministica: home, `/contatti/`, e 8 pagine ad alta priorità a passo costante
nell'ordine alfabetico della matrice.

| Esito | URL |
|---|---|
| **Identici al pixel** (0,0000 %) a entrambe le viewport | 8: la home, `/10-anni-di-vita-del-centro-per-la-famiglia-amoris-laetitia/`, `/contest-fotografico-selfiemotions/`, `/il-corpo-racconta/`, `/la-rabbia-in-consulenza-ostacolo-e-possibile-risorsa/`, `/registrazione-corso-circolo-della-sicurezza/`, `/registrazione-corso-riparare-le-relazioni/`, `/registrazione-sguardi-damore-2/` |
| Differenza nella sola domanda di controllo | `/contatti/` (0,004 %) |
| **Divergenza** | `/dal-vizioso-al-virtuoso/`: 9,93 % a 1440, altezza diversa a 390 |

La home ha la **stessa impronta** sul sito online e nell'istanza: è la stessa immagine,
byte per byte.

### 6.1 Prima divergenza: i video di YouTube

Sul sito online `/dal-vizioso-al-virtuoso/` mostra un video di YouTube sopra la
locandina; nell'istanza il video non c'è e la pagina cambia altezza. WordPress
trasforma un indirizzo di YouTube nel riproduttore chiedendolo a YouTube dal server, e
l'istanza è configurata per non fare chiamate verso l'esterno (`WP_HTTP_BLOCK_EXTERNAL`,
condizione 3 di HO-001). Contenuti pubblicati con indirizzi di YouTube: **3**,
`/dal-vizioso-al-virtuoso/`, `/corso-per-consulenti-familiari-vecchia-pagina/`,
`/riparte-il-corso-per-consulenti-familiari/`. Il piano §1 stabilisce che **fa fede il
sito online**.

### 6.2 Seconda divergenza: un file con le maiuscole diverse

`/i-prossimi-corsi-del-centro/` cita `Relazioni_Efficaci_2019.png`; il backup contiene
`RELAZIONI_EFFICACI_2019.png`. Il server del sito vero non distingue maiuscole e
minuscole e la serve; l'istanza, su Linux, risponde 404. L'importer lo aveva già
rilevato (10 avvisi `source-file-case-mismatch`, l'originale e 9 dimensioni derivate) e
risolto: il sito nuovo avrà l'immagine, l'istanza no.

### 6.3 Esito: riferimento dal sito online per 4 pagine (DR-111)

Prima di catturare, il testo del contenuto delle 4 pagine è stato confrontato fra
istanza e sito online: **identico** su tutte e 4. Il sito online non le ha cambiate
dopo il backup; cambia solo la resa. Le 18 catture (2 pagine del livello A a 6 viewport, 2 del livello B a
3; colonna `fonte` di `catture.csv`) sono state fatte il 2026-10-10 con le stesse condizioni del §2, senza
deviare alcuna richiesta: il sito online serve da sé i suoi file. Esito: 16 stabili, 2
instabili nel riproduttore video, nessuna immagine mancante.

## 7. Decisioni prese sugli esiti della `1E-W1`

| id | Decisione | Esito |
|---|---|---|
| ~~**D40**~~ | Riferimento delle 4 pagine che divergono dal sito online | **DR-111**: dal sito online (§6.3) |
| ~~**D41**~~ | Conteggio del criterio 1E-2 | **DR-112**: 585 |
| ~~**D42**~~ | Soglia con rumore zero | **DR-113**: 0 %, lettura letterale del §6.3 |

## 8. Metadati e menu dell'istanza

Rimisurati contro `seo-rendered-baseline.csv` e `public-menu.csv`, che la `1B-W0` aveva
misurato sulla stessa istanza il 2026-09-14: se coincidono, l'istanza è ancora quella
congelata. Tabelle: [`riferimento/metadati.csv`](riferimento/metadati.csv),
[`riferimento/menu.csv`](riferimento/menu.csv).

| Voce | Esito |
|---|---|
| Metadati, 117 URL | **115 identici**; i 2 diversi sono i feed RSS, dove il titolo di una pagina del browser non ha senso: il loro confronto è strutturale (piano §9) |
| Menu reso a un anonimo | **41 voci su 41** identiche per ordine, livello, etichetta e indirizzo |

**Due difetti del file della 1B**, trovati qui e dichiarati: alcune lettere accentate
sono state salvate come «�», e le entità HTML (`&quot;`, `&#8220;`) non sono state
decodificate. Il confronto le tratta di conseguenza; il file non è stato corretto.

## 9. Errori in console nel riferimento

28 errori in 28 catture, uno per cattura.

| Causa | Dove | Errori |
|---|---|---|
| La mappa Google senza fatturazione abilitata | `/contatti/`, `/dove-siamo/` | 12 |
| Risorsa 404 della pagina d'errore | `/404-url-inesistente/` | 6 |
| Non classificato, nella cattura dal sito online | `/dal-vizioso-al-virtuoso/` a 1280 | 1 |
| Richiesta `admin-ajax.php` del plugin dei documenti che risponde 400, non a ogni caricamento | le 4 pagine `/download/…` | 9 |

Il criterio 1E-17 vale per il sito nuovo; questi sono errori della sorgente, registrati
per non attribuirli al sito nuovo.

## 10. Esito della `1E-W6` e difformità accettate (2026-10-16)

Ultimo confronto, dopo DR-157…161 e HO-023: **588 coppie, 38 superate, 3 da esaminare,
547 fallite**; coppie alla stessa altezza della sorgente 303, differenza d'altezza
mediana 0 px, 9 coppie oltre 500 px (`docs/qa/confronto/esiti.csv`,
`analisi-famiglie-DR-154.md` §7). Criterio 1E-19 dopo l'ultimo giro: 4 contenuti su 4
identici.

Le differenze residue sono state esaminate dall'utente nel report «Bozze di parità
visiva» (sorgente e sito affiancati a 1440, 768 e 390 px, le altre viewport in cifre) e
**accettate tutte** (DR-162): 112 indirizzi, 544 viste non superate.

| Famiglia | Indirizzi accettati |
|---|---|
| Pagine Divi | 47 |
| Form di iscrizione | 23 |
| Colonne Gutenberg | 16 |
| Testo con titolo | 16 |
| Archivi e ricerca | 5 |
| Download | 4 |
| Pagina non trovata | 1 |

Difformità con una causa nota, accettate nominativamente: refuso «<b>IBAN<b>» chiuso dal
sito (DR-159); articolo 332 non elencato nell'archivio (DR-160, DR-164); scheda dei
download senza contatore e con un solo `h1` (DR-161); captcha di `/contatti/` sostituito dal
campo esca (DR-163); mappa e video a copertina (HO-015); tabella dei cookie che scorre a
390 e 360 (DR-120); scorrimento orizzontale di tre pagine Gutenberg a 360, come la
sorgente. Elenco completo, indirizzo per indirizzo: `docs/qa/confronto/decisioni-report-DR-162.csv`.

**Questa sezione non è l'approvazione della parità pixel-perfect richiesta dal gate**:
quella si dà esplicitamente nel §12, dopo le verifiche manuali della `1E-W7` e l'audit.

## 11. Esito della `1E-W7` e stato finale del confronto (2026-10-18)

Verifiche non visive e manuali sugli indirizzi della matrice, piano in
[`W7-PLAN.md`](../../.planning/phases/1E/W7-PLAN.md), esiti in `docs/qa/verifiche/`
([`riepilogo.md`](verifiche/riepilogo.md), [`audit-1E-W7.md`](verifiche/audit-1E-W7.md)).

| Criterio | Esito |
|---|---|
| 1E-8 metadati | 117 URL, 0 difformi (5 identici, 112 con sole correzioni DR-040) |
| 1E-9 redirect | 181/181 regole, 0 inversioni su 293 indirizzi |
| 1E-6 verifiche manuali | 81 URL: menu e mobile 79/79, form 24/24; scarti residui accettati (DR-197, DR-204) |
| 1E-17 console e rete | 486/486 misure a zero |
| A-1…A-8 | A-1, A-3, A-4, A-5, A-6 79/79; difetti ereditati in A-2, A-7, A-8, da correggere dopo la UAT (DR-115, DR-169) |
| 1E-19 | 4/4 contenuti salvati senza modifiche con pagina pubblica identica |

Le correzioni della `1E-W7` (dati strutturati, description, sitemap, immagini con le
stesse dimensioni della sorgente, video, hover del menu, menu mobile da tastiera,
etichetta della ricerca) hanno richiesto una ricattura integrale. **Ultimo confronto: 591
righe (585 viste distinte), 40 superate, 3 da esaminare, 548 fallite**; nessuna vista
peggiorata rispetto allo stato accettato con DR-162. Le 50 viste cambiate e la pagina
nuova `/download-category/moduli-consulenze/` sono state esaminate nel report «Bozze di
parità 1E-W7» e **accettate tutte** (DR-203, `verifiche/decisioni-report-1E-W7.csv`).

### 11.1 Indice delle difformità accettate

| Decisione | Che cosa | Elenco |
|---|---|---|
| DR-162 | 112 indirizzi, 544 viste non superate dopo la `1E-W6` | `confronto/decisioni-report-DR-162.csv` |
| DR-203 | 25 indirizzi, 50 viste cambiate dopo la `1E-W7` | `verifiche/decisioni-report-1E-W7.csv` |
| DR-124…128 | banner dei cookie, mappa e video a copertina, tabella dei cookie, suffisso «- Pagina N» | HO-015 |
| DR-120 | tabella dei cookie che scorre a 390 e 360 | — |
| DR-159…161, DR-164 | refuso «IBAN» chiuso; articolo non elencato nell'archivio; scheda dei download | — |
| DR-163 | captcha di `/contatti/` sostituito dal campo esca | — |
| DR-197 | 2 immagini più piccole a 390 e 360 su `/servizi/` e `/sostegno-alla-genitorialita/` | — |
| DR-204 | sfondo del link «Iscrizioni» al passaggio in 4 pagine | — |
| DR-115, DR-169 | colori sotto il contrasto A-8 e difetti di accessibilità ereditati che cambiano la resa | da correggere dopo la UAT |

### 11.2 Strumenti dell'ultima misura

Invariati rispetto al §1: Playwright 1.63.0, Chromium 153.0.8010.12, `pixelmatch` 7.2.0,
`pngjs` 7.0.0. Sito nuovo con `next start` su `127.0.0.1:3200` e
`SITE_URL=http://127.0.0.1:3200`, codice del commit `3d0d651` (CI verde, run
39162695632).

## 12. UAT di parità

Prova dell'utente secondo [HO-016](../handoff/HO-016-uat-di-parita-1E-W8.md): lettura di
questo rapporto, confronto a vista delle pagine principali alle larghezze del computer e
del telefono, prova di un form con dati inventati (la compilazione si cancella dopo, su
conferma: DR-208).

La risposta si registra qui con le parole dell'utente. Per valere come condizione del
gate, l'approvazione usa la formula di DR-209: «approvo la parità pixel-perfect del sito
pubblico, con le difformità accettate elencate nel rapporto».

**Risposta dell'utente, 2026-10-18 (DR-210):**

> HO-016: approvo la parità pixel-perfect del sito pubblico, con le difformità accettate elencate nel rapporto. Form inviato alle 23:46 ora locale

Esito: **UAT approvata** dal Proprietario con la formula di DR-209. La condizione 13 del
gate è soddisfatta; resta la condizione del deploy in produzione eseguito e verificato
(Fase 1F, `deployment-gate`). Prova del form: 1 compilazione ricevuta alle 21:46:24 UTC
sul modulo di contatto, nessuna email inviata.
