# Verifiche non visive e manuali — wave `1E-W7`

Piano: [`.planning/phases/1E/W7-PLAN.md`](../../../.planning/phases/1E/W7-PLAN.md).
Metodo deciso da DR-166…169. Sito nuovo `127.0.0.1:3200` con l'import reale in
locale; riferimento: istanza congelata `localhost:8088` e
`docs/migration/seo-rendered-baseline.csv`.

| Criterio | Stato | Esiti |
|---|---|---|
| 1E-8 metadati | **misurato, non superato**: difformità decise (DR-170…178), da correggere nella T7 (§1.3) | `metadati-per-url.csv`, `metadati-dettaglio.csv`, `metadati-sistema.csv` |
| 1E-9 redirect | **superato**: 181/181 regole, 0 inversioni su 293 indirizzi (§2) | `redirect.csv`, `redirect-simmetrico.csv` |
| 1E-6 verifiche manuali | **misurato, non superato**: voci 1, 6, 8 e 4 con difetti del sito (§3, §4.2) | `interazioni.csv`, `accessibilita.csv` |
| 1E-17 console e rete | **superato**: 486/486 misure a zero (§5) | `console.csv` |
| A-1…A-8 | **misurato**: A-1, A-4, A-6 superati; A-2, A-3, A-5, A-7 con difetti ereditati; A-8 con 2 coppie di DR-115 e 2 nuove (§4, §6) | `accessibilita.csv`, `contrasto.csv` |

Decisioni su M1-M8 e sull'accesso al CMS: [`decisioni-metadati-M1-M8.md`](decisioni-metadati-M1-M8.md).

## 1. Metadati — criterio 1E-8 (T1, 2026-10-17)

Script: `tests/visual/verifica-metadati.ts`; classificatore
`tests/visual/classifica-metadati.ts` con 12 prove
(`pnpm exec tsx --test "tests/visual/prove/*.test.ts"`, 12/12).

### 1.1 Per URL

| Esito | URL |
|---|---|
| identici in tutti gli 11 campi | 3 |
| solo correzioni DR-040 | 0 |
| almeno un campo difforme | 114 |
| **totale** | **117** |

Quasi tutti i 114 sono difformi per un solo motivo, i dati strutturati assenti
(M1): senza M1 il quadro cambia, e va letto per famiglia (§1.3).

### 1.2 Correzioni attese da DR-040

| Campo | Righe | Motivo |
|---|---|---|
| `h1` | 34 (33 URL) | h1 assente nella sorgente, unico nel sito (S-1); comprende 4 archivi di categoria |
| `description`, `og_description` | 30 + 30 | description assente nella sorgente e generata dal contenuto (S-2) |
| `title` | 2 | suffisso di paginazione «Page» → «Pagina» |

La baseline ha una riga ripetuta (`/lequilibrio-che-regge-e-fa-crescere-la-coppia/`),
da cui 34 righe per 33 URL.

### 1.3 Difformità, per famiglia

| id | Famiglia | Ampiezza | Osservato |
|---|---|---|---|
| M1 | Dati strutturati Schema.org assenti | 113 URL | la sorgente serve JSON-LD (`WebPage`, `WebSite`, `Organization`, `BreadcrumbList`, `BlogPosting`…); il sito nuovo nessuno |
| M2 | Description troncata | 37 URL, `description` e `og_description` | il sito tronca a circa 157 caratteri con «…»; la sorgente ne serve di più (mediana 337) |
| M3 | Apici e lineette tipografici | 9 URL | apici curvi e lineetta lunga nel sito, dritti nella sorgente; effetto del porto di wptexturize (DR-152); comprende il titolo del feed di categoria |
| M4 | Description diversa | 9 URL | 2 con il testo di **un altro evento**: `/convegno-diventare-anziani-in-famiglia/` e `/ridere-in-coppia-e-una-cosa-seria/`, da indagare; gli altri per spazio fra blocchi, entità o emoji |
| M5 | Segnaposto del modello SEO non risolti | 1 URL, `title` e `og_title` | `/vuoi-diventare-consulente-familiare/`: il sito mostra `#separator_sa #post_title …`; la sorgente `- - Vuoi diventare…` (difetto che DR-040 chiede di correggere) |
| M6 | Paginazione dell'archivio | 2 URL, `canonical` e `robots` | la sorgente punta il canonical alla pagina 1 con `noindex, nofollow`; il sito usa il canonical della pagina stessa, indicizzabile |
| M7 | `robots.txt` | 1 | il sito non dichiara le righe `Sitemap:`; le regole su `/wp-admin/` e `/wp-content/uploads/wpforms/` della sorgente non hanno equivalente |
| M8 | Sitemap | 1 | la sorgente ha un indice con 5 figlie e 113 percorsi; il sito una sitemap unica con 108; mancano i 4 `/download/…` e `/download-category/moduli-consulenze/` |

Feed: `/feed/` e `/category/news/feed/` hanno 10 elementi come la sorgente.

Nessuna difformità è corretta in questa attività. Scelte dell'utente del 2026-10-17
(DR-170…178): M1 A, M2 A, M3 A, M4 C, M5 A, M6 B, M7 A, M8 A; si correggono nella T7
con il metodo della `1E-W6` (analisi d'impatto, approvazione, prove).

## 2. Redirect nei due sensi — criterio 1E-9 (T2, 2026-10-17)

Script: `tests/visual/verifica-redirect.ts`; funzioni pure in
`tests/visual/redirect.ts` con 17 prove (`pnpm exec tsx --test "tests/visual/prove/*.test.ts"`, 29/29
insieme a quelle della T1). Nessun redirect si segue: si leggono stato e `location`
sul sito, sulla lettura pubblica dell'API (`/public/redirect`) e sull'istanza di
riferimento.

### 2.1 Le 181 regole

| Gruppo | Regole | Superate | Atteso |
|---|---|---|---|
| Pagine allegato | 169 | 169 | 301 verso il file in `/media/…`, stessa destinazione del riferimento |
| Allegato con lo stesso percorso di un articolo (`/pronti-a-ripartire/`) | 1 | 1 | 200: vince l'articolo pubblicato, come nella sorgente; l'API non restituisce la regola |
| Documenti scaricabili | 4 | 4 | 301 verso `/download/<slug>/` |
| Slug storici (mapping §3.3) | 6 | 6 | 301 verso il contenuto attuale |
| Percorsi storici dei media, a prefisso | 1 | 1 | 20 file su 169, seme `20261017`: 301 verso `/media/…`, file di destinazione 200, file presente nel riferimento |
| **Totale** | **181** | **181** | |

Le regole si ricavano dalle fonti documentate (`url-matrix.csv`, mapping §3.3,
ADR-004 §3.4), non dal database. La lettura pubblica risolve un percorso alla
volta e non elenca le regole: per escludere regole in più si è contato una volta
il database locale in sola lettura — 180 `exact` e 1 `prefix`, tutte attive,
nessuna fuori dall'elenco atteso.

### 2.2 Controllo simmetrico sui 293 indirizzi della matrice

| Controllo | Indirizzi | Esito |
|---|---|---|
| 200 della matrice che risponde 3xx | 117 | 0 |
| 301 della matrice che risponde 200 | 173 | 0 |
| `/wp-sitemap.xml` (302) | 1 | 302 verso `/sitemap.xml`, come la sorgente |
| `/404-url-inesistente/` (404) | 1 | 404, come la sorgente |
| `/wp-admin/` (302 verso il login di WordPress) | 1 | 404; la matrice lo dichiara fuori ambito, «sostituito dal nuovo CMS» |

Nessuna difformità nuova. `/wp-admin/` risponde 404: per DR-178 resta così (anche
`/wp-login.php`), e il CMS si raggiunge da `/admin`.

## 3. Interazioni del §8 — voci 1, 2, 3, 5, 6, 7, 8 (T3, 2026-10-17)

Script: `tests/visual/verifica-interazioni.ts`; funzioni pure in
`tests/visual/interazioni.ts`. Misure su sito **e** riferimento (DR-166, DR-168), un
browser, ripresa da file. Misure grezze e catture degli stati (hover, sottomenu, menu
mobile; bottoni al passaggio del puntatore) in `docs/qa/screenshots/verifiche/`, fuori
da Git (DR-106). `RICALCOLA=1` riscrive gli esiti dalle misure salvate.

| Voce | Superati | Non superati | Difetto anche nella sorgente | Non applicabile |
|---|---|---|---|---|
| 1 hover | 0 | 79 | 0 | 0 |
| 2 menu (passaggio, tastiera, terzo livello, chiusura) | 79 | 0 | 0 | 0 |
| 3 menu mobile a 390 e 360 | 79 | 0 | 0 | 0 |
| 5 caratteri e spostamenti | 0 | 0 | 79 | 0 |
| 6 immagini servite | 66 | 13 | 0 | 0 |
| 7 punti di rottura 1440→360, passo 10 px | 76 | 0 | 3 | 0 |
| 8 video e mappa | 3 | 1 | 0 | 75 |

I 2 indirizzi di sistema (`robots.txt`, `sitemap.xml`) non hanno interazioni.

### 3.1 Difetti, per famiglia

| id | Famiglia | Ampiezza | Osservato |
|---|---|---|---|
| I1 | Opacità delle voci del menu al passaggio | 79 URL, 632 misure | la sorgente porta le voci a `opacity: 0.7`; il sito le lascia a `1`. Altri scarti minori: sfondo bianco di 4 link del contenuto, bordo di 1 bottone |
| I2 | Dimensione derivata più piccola | 13 URL | stesso file, derivata diversa: a 390 px il sito sceglie `480x679` dove la sorgente sceglie `724x1024`; a 1440 px, in 3 URL, una derivata al posto dell'originale. Causa da cercare in `srcset`/`sizes` |
| I3 | Video `.mp4` resi come collegamento | 1 URL, 2 video (`/corso-per-consulenti-familiari-vecchia-pagina/`) | importati con provider `other`: dopo il clic compare «Apri il video» invece del lettore; la sorgente li riproduce nella pagina. Il terzo video, YouTube, carica `youtube-nocookie.com` solo dopo il clic, come deciso |
| I4 | Spostamenti al caricamento (CLS) | 79 URL | CLS > 0 nel sito **e** nella sorgente (mediana 0,012 contro 0,010; sito più alto in 32 URL su 79); nessun errore di caratteri |
| I5 | Scorrimento orizzontale sotto i 400 px | 3 URL (`/parlarsi-con-il-cuore/`, `/sguardi-damore/`, `/sguardi-damore-2/`) | presente anche nella sorgente, alle stesse larghezze |

Superati senza riserve: sottomenu al passaggio 5/5 con terzo livello 2/2 e chiusura
all'uscita; da tastiera 5/5, mentre la sorgente non apre nulla col fuoco (0/5); menu
mobile con 41 voci, nessuna fuori schermo, ultima raggiungibile, apertura e chiusura;
mappe di `/contatti/` e `/dove-siamo/` con copertina e iframe di Google Maps solo
dopo il clic (DR-121); nessun iframe di terzi al caricamento.

Correzioni della misura fatte durante la T3, prima di registrare gli esiti: il menu
mobile del sito è un `<details>` (si legge con `checkVisibility`); la barra laterale
della sorgente può essere un modulo Divi e quella del sito un `#sidebar` vuoto; le
mappe della sorgente si contano una volta; per le immagini conta il file servito,
non `naturalWidth`, che il browser divide per la densità ricavata da `sizes`.

## 4. Accessibilità di base e form — A-1…A-7, §8 voce 4 (T4, 2026-10-17)

Script: `tests/visual/verifica-accessibilita.ts`; funzioni pure in
`tests/visual/accessibilita.ts`. Sul riferimento ogni richiesta che non sia GET è
bloccata: l'istanza resta congelata.

| Criterio | Superati | Non superati | Difetto anche nella sorgente |
|---|---|---|---|
| A-1 tastiera, nessuna trappola | 79 | 0 | 0 |
| A-2 fuoco visibile, ordine | 77 | 0 | 2 |
| A-3 menu mobile da tastiera | 0 | 0 | 79 |
| A-4 testi alternativi | 79 | 0 | 0 |
| A-5 etichette dei campi | 0 | 0 | 79 |
| A-6 lingua | 79 | 0 | 0 |
| A-7 un `h1`, nessun salto | 73 | 0 | 6 |
| §8 voce 4, 24 form | 2 | 22 | 0 |

Nella A-1 un gruppo di pulsanti di opzione conta come un solo elemento: Tab ne
raggiunge uno, gli altri si scelgono con le frecce.

### 4.1 Difetti ereditati (D79 = A, DR-169)

| id | Criterio | Osservato | Cambia la resa |
|---|---|---|---|
| A3-1 | A-3 | il sito apre il menu mobile con Invio e Spazio ma **Esc non lo chiude**; nella sorgente il pulsante non si raggiunge da tastiera | no |
| A5-1 | A-5 | il campo di ricerca della testata non ha etichetta, nel sito come nella sorgente; nessun altro campo senza etichetta | no |
| A7-1 | A-7 | 6 pagine passano da `h1` a `h3`/`h4`: il salto c'è già nella sorgente, che però non ha `h1` (DR-040) | sì, se si cambiano i livelli |
| A2-1 | A-2 | 2 pagine: dopo un indirizzo e-mail nel testo il fuoco torna a un elemento più in alto. La sorgente ha la stessa inversione e in più 13-16 elementi senza indicatore di fuoco; il sito nessuno | no |

### 4.2 Form (§8 voce 4)

| id | Osservato | Ampiezza |
|---|---|---|
| F1 | **invio impossibile**: il telefono con prefisso internazionale (intl-tel-input, ADR-011) non entra nei valori inviati, anche scritto un tasto alla volta; l'API risponde `VALIDATION_FAILED` sul campo telefono obbligatorio | 22 form su 24, tutti quelli con questo campo tranne la registrazione Caritas, da capire |

L'invio vuoto mostra i messaggi in tutti i 24 form del sito e della sorgente.
`/contatti/` e la registrazione Caritas hanno mostrato la conferma: 2 compilazioni
sintetiche nel database locale, da cancellare su conferma
([HO-024](../../handoff/HO-024-cancellazione-compilazioni-sintetiche-1E-W7.md)).
Nessuna email (DR-108), nessuna chiamata a terzi.

## 5. Console e rete — criterio 1E-17 (T5, 2026-10-17)

Script: `tests/visual/verifica-console.ts`. 81 URL × 6 viewport = 486 misure, nessuna
richiesta bloccata.

| Colonna | Misure diverse da zero |
|---|---|
| errori in console | 0 |
| eccezioni della pagina | 0 |
| richieste fallite | 0 |
| risposte ≥ 400 (escluso il 404 atteso della pagina d'errore) | 0 |
| richieste a host diversi dal sito | 0 |

## 6. Contrasto — A-8 (T6, 2026-10-17)

Script: `tests/visual/verifica-contrasto.ts`; funzioni in `tests/visual/contrasto.ts`
(rapporto WCAG 2.x, fusione dei colori semitrasparenti). Coppie testo/sfondo dagli stili
calcolati dei 79 URL di pagina a 1440 e 390 px, compresi testo e segnaposto dei campi.
Nessun testo su immagine.

| Coppia | Rapporto | Classe | URL |
|---|---|---|---|
| `#2ea3f2` su `#fff` (link, menu, bottoni) | 2,75 | non conforme, già decisa da DR-115 | 57 |
| `#999` su `#eee` (testo dei campi) | 2,46 | non conforme, già decisa da DR-115 | 1 |
| `#757575` su `#eee` (segnaposto del form di contatto) | 3,97 | **non conforme nuova** | 1 |
| `#ff0000` su `#fff` (asterisco dei campi obbligatori) | 4,00 | **non conforme nuova** | 23 |
| le altre 9 coppie | 4,61-21 | conformi | — |

Le due coppie nuove sembrano ereditate: l'asterisco è lo stesso `wpforms-required-label`
della sorgente, e il segnaposto del form di contatto c'è in entrambi i siti. Va
confermato misurando il riferimento nella T7. Correggerle cambia la resa: secondo
DR-169 vanno dopo la UAT, come DR-115.
