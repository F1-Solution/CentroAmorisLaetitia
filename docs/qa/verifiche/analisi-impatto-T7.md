# Analisi d'impatto — M1-M8, F1, I1-I3, A3-1 (`1E-W7`, T7)

Scritta il 2026-10-18. **Nessuna modifica al codice**: elenco dei punti da toccare,
in attesa di approvazione e delle decisioni D80-D96.

Metodo: lettura del codice di `apps/**`, `packages/**` e `tests/visual/**`; richieste
GET al sito nuovo (`127.0.0.1:3200`), all'API (`127.0.0.1:3002`) e al riferimento
(`localhost:8088`); SELECT in sola lettura sul database locale; lettura del codice di
All in One SEO 5.0.1.1 e di Divi nella sorgente `source-private/wordpress-2026-09-13/`.
Gli invii dei form sono stati intercettati e annullati: nessuna scrittura.

Decisioni già prese: DR-169 (accessibilità), DR-170…178 (metadati), DR-162 (parità
accettata), DR-107/121/122/126 (incorporati), DR-143 (font ETmodules).

---

## 0. Sintesi

| id | Causa | Tocca | Import o migrazione | Ricattura | Decisioni |
|---|---|---|---|---|---|
| M1 | il sito non produce JSON-LD | web (nuovi `lib/site.ts`, `lib/structuredData.ts`, `page.tsx`), facoltativo API documenti | no | no | D83, D88-D91 |
| M2 | taglio a 160 voluto (DR-171) | solo classificatore | no | no | — |
| M3 | wptexturize su titolo ed estratto all'import; nessuna forma grezza in DB | importer, DB, API, `proxy.ts` | **migrazione 0007 + import** | no | **D80** |
| M4 | estratti copiati da `duplicate-post` (ipotesi confermata); algoritmo AIOSEO non riprodotto | come M3 | come M3 | no | **D81** |
| M5 | titolo SEO copiato letterale, variabili non tradotte | importer `seo`, API | **import** (fase `seo`) | no | D92 |
| M6 | il sito fa già ciò che chiede DR-175 | solo classificatore | no | no | — |
| M7 | `robots.ts` senza riga `Sitemap:`; `SITE_URL` duplicata e non documentata | web, `.env.example` | no | no | D93 |
| M8 | la sitemap ignora i documenti; `/download-category/moduli-consulenze/` risponde **404** | API, web, forse importer | dipende da D82 | dipende da D82 | **D82**, D94 |
| F1 | intl-tel-input riscrive il valore prima di React, `onChange` non scatta: il telefono non entra mai nell'invio | `packages/blocks` (un file) | no | no | — |
| I1 | mancano le regole `:hover` (opacità 0,7) e `transition` di Divi | CSS | no | no | D95 |
| I2 | non riprodotto il filtro `srcset`/`sizes` di Divi; a parità di larghezza vince la derivata | `packages/blocks/render/media.ts` | dipende da D84 | **sì, 26 URL × 6 viewport** | **D84**, D96 |
| I3 | provider del video calcolato prima della riscrittura in `/media/` | importer (una riga) o renderer | dipende da D85 | no | **D85**, D86 |
| A3-1 | `<details>` nativo: Esc non è gestito; `SiteHeader` è un componente server | web (nuovo componente client) | no | no | D87 |

---

## 1. Metadati

### M1 — Dati strutturati (DR-170)

**Sorgente** (AIOSEO, un `@graph`):

| Pagina | Tipi |
|---|---|
| tutte | `WebSite` (url, name, `inLanguage it-IT`, publisher), `Organization` con **solo** `name` e `url` |
| home | `BreadcrumbList` (solo «Home», senza `item`), `WebPage` |
| pagina | `BreadcrumbList` Home → pagina, `WebPage`; con immagine in evidenza (5 pagine, le stesse con `featuredMediaId`) anche `ImageObject` |
| articolo (29) | `BlogPosting`, `WebPage`, `BreadcrumbList` Home → categoria → articolo, **`Person` «administrator»** con Gravatar e `/author/administrator/` |
| archivio di categoria | `CollectionPage`, `BreadcrumbList` |
| ricerca · 404 | `SearchResultsPage` · `WebPage` senza nome |
| `/download/<slug>/` · `/download-category/…` | `WebPage` + `Person` · `CollectionPage` |

**Dati disponibili:** nome dal `site.title` delle impostazioni; percorsi piatti, 1 categoria
per articolo; immagine da `featuredMediaId`; `updatedAt` è la **data dell'import**
(`apps/importer/src/stages/contents/index.ts:287`), `post_modified` non è conservato.
Nessuna CSP oggi (`infra/compose/Caddyfile:44-47`): un blocco `ld+json` non è eseguito e
non tocca la T5.

| File:riga | Modifica |
|---|---|
| `apps/web/src/lib/site.ts` (nuovo) | `SITE_URL` unico, oggi letto in due punti con default `http://localhost:3000` |
| `apps/web/src/app/sitemap.ts:12`, `apps/web/src/proxy.ts:22` | usare `lib/site.ts` |
| `apps/web/src/lib/structuredData.ts` (nuovo) | funzioni pure per tipo; serializzazione con `<` → `<` (i titoli vengono dal CMS) |
| `apps/web/src/app/[[...percorso]]/page.tsx:160-181` | `<script type="application/ld+json">` per ogni `resolved.kind`; dati da `generateMetadata` (113-158) |
| `apps/web/src/app/not-found.tsx:11` | grafo della 404 (facoltativo) |
| `apps/web/src/app/layout.tsx:36-38` | `metadataBase` secondo D91 |
| `apps/api/src/modules/public/service.ts:626-649`, `routes.ts:284-301`, `schemas.ts:221`, `apps/api/tests/openapi.snapshot.json` | categoria del documento per le briciole di `/download/<slug>/` |
| `.env.example` (dopo la riga 39) | `SITE_URL=` |

Prove: `apps/web/tests/structuredData.test.ts` (home senza `item`, pagina con e senza
immagine, articolo con categoria, archivio paginato, escape di `</script>`);
`tests/e2e/regole-strutturali.spec.ts` (JSON-LD valido); poi `verifica-metadati.ts` e
`verifica-console.ts`.

### M2 — Taglio a 160 (DR-171) e M6 — paginazione (DR-175)

Nessuna modifica al sito: per M6 il sito serve già canonical autoreferenziale e
`max-image-preview:large` su `/category/news/page/2/` (`page.tsx:129-137`).

| File:riga | Modifica |
|---|---|
| `tests/visual/classifica-metadati.ts:33-48` (`correzione`) | M2: `description`/`og_description` del sito ≤ 160 con «…» e prefisso **esatto** della sorgente → `correzione DR-040` (DR-171). M6: canonical = rif + `page/N/` e robots = `noindex, nofollow, ` + sito → `correzione DR-040` (DR-175) |
| `tests/visual/classifica-metadati.ts:58` | il ramo `troncata` resta per i prefissi non esatti |
| `tests/visual/prove/classifica-metadati.test.ts:65-73`, `:137-145` | esito atteso da `difforme` a `correzione DR-040`; prove negative (prefisso diverso, canonical verso un'altra pagina) |

M2 va valutato dopo M3 e M4, altrimenti i prefissi non coincidono.

### M3 e M4 — Apici nei metadati (DR-172) e description dal testo (DR-173)

**Algoritmo della sorgente** (AIOSEO, `app/Common/Meta/Description.php:142-206`,
`Utils/Tags.php:1181-1196`): articoli `#post_excerpt` (estratto grezzo, altrimenti
testo), pagine `#post_content` (testo grezzo **senza** wptexturize, senza figure ed
embed, `strip_shortcodes`, tag tolti senza spazi, 55 parole; vuoto → estratto). Verificato
su 61 contenuti della baseline: 61/61 coerenti.

**M4, i due URL:** confermato. `/convegno-diventare-anziani-in-famiglia/` e
`/ridere-in-coppia-e-una-cosa-seria/` hanno nel dump un estratto copiato da un'altra
pagina (`duplicate-post` installato); la sorgente non lo mostra perché sono pagine.
Gli altri 7 casi nascono da tag tolti senza spazio, spazi nelle virgolette e `-->`
grezzo: si correggono solo applicando l'algoritmo al testo grezzo.

**Due fatti che contraddicono le decisioni registrate:**

1. **DR-172 cita il `title`, ma i title della sorgente sono tipografici** in circa 50 URL
   («Laboratorio esperienziale – 12 Maggio 2018 - …»): `#post_title` passa da
   `get_the_title`. Oggi sono identici; renderli dritti creerebbe ~50 difformità → **D80**.
2. **DR-173 «ignorare l'estratto» vale solo per le pagine**: la sorgente usa l'estratto
   negli articoli. Applicata alla lettera crea 12 difformità nuove sugli articoli → **D81**.

Una mappa inversa (’ → ') non basta: 20 description della sorgente hanno caratteri
tipografici scritti dall'autore. Serve il testo grezzo, preso all'import.

**Gli 8+1 URL di M3:** `/contest-fotografico-selfiemotions/`, `/convegno-17-febbraio-2018/`,
`/convegno-26-novembre/`, `/corsi-2022-2023/`, `/i-prossimi-corsi-del-centro/`,
`/i-prossimi-eventi-del-centro/`, `/prossimi-corsi/`, `/riparte-il-circolo-della-sicurezza/`,
e il titolo di `/category/news/feed/`.

| File:riga | Modifica |
|---|---|
| `packages/db/src/schema/content.ts:52` | colonna `descriptionSource: text()` |
| `packages/db/drizzle/0007_*.sql`, `meta/_journal.json`, `0007_snapshot.json` | `ALTER TABLE contents ADD COLUMN description_source text` |
| `apps/importer/src/convert/shared/meta-description.ts` (nuovo) | porto dell'algoritmo AIOSEO secondo D81 |
| `apps/importer/src/stages/contents/index.ts:64-76`, `:108-110` | conservare l'estratto grezzo accanto a quello texturizzato |
| `apps/importer/src/stages/contents/index.ts:223-225`, `:258`, `:281` | calcolare e scrivere `descriptionSource`, **dopo** `applyMembersRestriction` (privacy) |
| `apps/api/src/modules/public/service.ts:304-318` | `descriptionSource` in `contentColumns` |
| `apps/api/src/modules/public/service.ts:262-276` | nuova `metaDescription(...)`: `descriptionSource`, altrimenti regola per tipo, poi taglio a 160; `fallbackDescription` invariata per il feed |
| `apps/api/src/modules/public/service.ts:357-367`, `:385-388`, `:400` | `seoForContent` usa `metaDescription`; `og_description` la segue |
| `apps/api/src/modules/content/service.ts:120`, `:127-131` | modifica di estratto o testo dal CMS → `descriptionSource` a null, come `summarySource` |
| `apps/web/src/proxy.ts:52` | `' – '` → `' - '` nel titolo del feed di categoria |

Invariati: h1, titoli negli elenchi, `textStart` (`Views.tsx:167`), `postSummary`
(`service.ts:586-596`), titoli degli elementi del feed — tutti accettati da DR-162 o già
uguali alla sorgente. Chiamanti di `fallbackDescription` verificati: `service.ts:388`
(metadati, cambia), `routes.ts:208` e `:241` (campo `summary` del feed, invariato).

Prove: `apps/importer/tests/unit/convert/metaDescription.test.ts` (apici dritti, emoji da
entità, tag uniti senza spazio, Divi vuoto → estratto, pagina riservata, 55 parole, il
`-->` di `/registrazione-seminario-autostima-e-assertivita/`); `contentsStage.test.ts:164`;
`apps/api/tests/publicRead.test.ts:323-324`, `:356` (oggi attende l'estratto della home) e
casi nuovi; azzeramento di `descriptionSource` da CMS; prova del titolo del feed.

### M5 — Variabili SEO (DR-174)

Una sola riga del dump con variabili: `/vuoi-diventare-consulente-familiare/`,
`#separator_sa #separator_sa #post_title #separator_sa #site_title`. Separatore `&#45;` →
`-`; tolti i separatori vuoti in testa e in coda resta `{title} - {site_title}`.

| File:riga | Modifica |
|---|---|
| `apps/importer/src/stages/seo/index.ts:68` | `translateAioseoTitle`: sostituisce le variabili, toglie i separatori vuoti, registra le variabili sconosciute |
| `apps/api/src/modules/public/service.ts:381-384` | passare il title di sovrascrittura da `fillTemplate` |

Prove: `apps/importer/tests/unit/stages/seoStage.test.ts:29`, `:99-128`;
`menusSeoDocumentsSliders.real.test.ts:127` resta valido se la riga si tiene (D92).

### M7 — `robots.txt` (DR-176)

| File:riga | Modifica |
|---|---|
| `apps/web/src/app/robots.ts:1-16` | `sitemap: \`${SITE_URL}/sitemap.xml\``; commento aggiornato |
| `tests/e2e/regole-strutturali.spec.ts:49-53` | verificare la riga `Sitemap:` |
| `tests/visual/verifica-metadati.ts:64-80` | regole WordPress e `sitemap.rss` della sorgente → correzione voluta (DR-176) |

Fatto collaterale: le impostazioni `seo.robots_txt` e `seo.sitemap_enabled` sono
modificabili nel CMS ma `robots.ts` e `sitemap.ts` le ignorano → **D93**. La sitemap del
sito oggi scrive `http://localhost:3000/…` perché `SITE_URL` non è impostata.

### M8 — Sitemap 113/113 (DR-177)

`sitemapEntries` (`apps/api/src/modules/public/service.ts:877-914`) legge solo contenuti
e categorie. I 4 `/download/<slug>/` rispondono 200. **`/download-category/moduli-consulenze/`
risponde 404**: il termine esiste come `/wpdmcategory/moduli-consulenze/`
(`apps/importer/src/stages/terms/index.ts:125`), `resolve()` gestisce solo `/category/`
(`page.tsx:83`); non è nella matrice, nessun confronto visivo l'ha coperta → **D82**.

| File:riga | Modifica |
|---|---|
| `apps/api/src/modules/public/service.ts:877-914` | documenti pubblici (filtro come `documentsBy`, 646-648) e, se D82 = A, termini `wpdmcategory` con documenti pubblici |
| `apps/api/src/modules/public/routes.ts:313-327` | `kind: 'document'` (e `'download_category'` se D82 = A) |
| `tests/visual/verifica-metadati.ts:85-91` | «figlie 5 contro 0» → voluta (DR-177) |
| *solo D82 = A:* `service.ts:736-750` **o** `apps/importer/src/stages/terms/index.ts:125` (D94) | percorso `/download-category/…` |
| *solo D82 = A:* nuova lettura dei documenti di un termine in `routes.ts`/`service.ts`, `openapi.snapshot.json`; `page.tsx:73-111`, `:113-158`, `:160-181`; `Views.tsx` (dopo 252); `apps/web/src/lib/api.ts:138-146` | pagina dell'elenco dei moduli |
| *solo D82 = B:* regola di redirect | 301 verso la pagina scelta |

Prove: `apps/api/tests/publicRead.test.ts:551-569` (documento pubblico presente, riservati
assenti); fixture 122-135, 178-180; `apps/web/tests/views.test.tsx` se D82 = A.

Fuori perimetro, da segnalare: `termByPath` (`service.ts:736`) risolve termini di ogni
tassonomia, compresa la categoria dei file riservati (oggi ne espone solo il nome).

---

## 2. F1 — Telefono perso all'invio

**Causa, provata:** intl-tel-input 29.5.3 registra un proprio ascoltatore `input`
(`formatAsYouType` e `strictMode` predefiniti) che riscrive `element.value` prima
dell'ascoltatore delegato di React; React vede il valore già aggiornato e non chiama
`onChange`. Su `/diventa-socio/` il corpo inviato è `{"values":{}}`; disattivato
l'ascoltatore della libreria diventa `{"values":{"5":"3330000000"}}`. L'API non c'entra.

**Ampiezza:** tutti i 23 form WPForms. 22 non si inviano (6 hanno due telefoni). La
registrazione Caritas si invia perché il telefono non è obbligatorio, **ma lo perde**:
la compilazione sintetica salvata non lo conteneva (cancellata con HO-024). `/contatti/`
è un modulo Divi senza telefono.

| File:riga | Modifica |
|---|---|
| `packages/blocks/src/render/FormField.tsx:249-255` | dopo `intlTelInput(...)`, ascoltatore nativo `input` registrato dopo quello della libreria: aggiorna lo stato e chiama `onChange(phoneWithDialCode(...))` |
| `packages/blocks/src/render/FormField.tsx:256-259` | `removeEventListener` in `destroy` |
| `packages/blocks/src/render/FormField.tsx:215-218` | commento di una riga |

Resa invariata. Le prove esistenti non l'hanno preso: nessun form con `phone` in
`packages/blocks/tests/render/dynamic-blocks.test.tsx`, nessuno in
`apps/api/tests/formSubmissions.test.ts`. Prove nuove: telefono obbligatorio `smart`
(fallisce senza la correzione), non obbligatorio, cambio di paese; prova Playwright con
POST intercettata e risposta finta. La voce 4 di `verifica-accessibilita.ts` scrive nel
database locale: rieseguirla richiede un handoff di cancellazione come HO-024.

---

## 3. Interazioni

### I1 — Hover del menu

Regole di Divi non riprodotte (`themes/Divi/css/dynamic-assets/header.css`,
`includes/builder/feature/dynamic-assets/assets/css/header_shared.css`):
`#top-menu-nav>ul>li>a:hover { opacity: .7 }` con `transition: all .4s`;
`.nav ul li a:hover, .et_mobile_menu li a:hover { background-color: rgba(0,0,0,.03); opacity: .7 }`
con `transition: all .2s`. Il markup del sito coincide: i selettori si riprendono tali e quali.

Scarti minori: sfondo bianco del link «Iscrizioni» in 4 pagine (stile in linea della
sorgente tolto dal sanitizer, `packages/blocks/src/sanitize/sanitize.ts:144-152`;
invisibile su sfondo bianco); bottone «Invia» di `/contatti/` (bordo, padding e freccia
`:after`, glifo `5` di ETmodules assente dal sottoinsieme di DR-143).

| File:riga | Modifica |
|---|---|
| `apps/web/src/styles/layout.css:103-111` | `transition: all .4s ease-in-out` su `#top-menu a` |
| `apps/web/src/styles/layout.css` dopo 116 | `#top-menu-nav > ul > li > a:hover { opacity: .7 }` |
| `apps/web/src/styles/layout.css:163-168` | sottomenu: `transition .2s` e `:hover` |
| `apps/web/src/styles/layout.css:406-412` | menu mobile: come sopra |
| *se D95 = A:* `apps/web/src/styles/blocks.css:1015-1032`; `apps/web/public/fonts/etmodules/etmodules-subset.woff`, `LEGGIMI.txt`, `etmodules.css:1-6` | bottone «Invia» con freccia; sottoinsieme rigenerato con il glifo `5` |
| `tests/visual/verifica-interazioni.ts:610` e `misuraHover` | togliere il taglio a 6 scarti; attesa da 150 a ≥ 500 ms per la transizione |

Nessun effetto su DR-162 (catture statiche). Prove: `apps/web/tests/layoutCss.test.ts`;
opacità dopo l'hover in `tests/e2e/regole-strutturali.spec.ts`.

Fuori dall'hover: su `/registrazione-seminario-autostima-e-assertivita/` la sorgente ha
il form dentro un commento HTML (non visibile), il sito lo rende. Difformità di
contenuto da decidere a parte (round successivo).

### I2 — Derivate delle immagini

`packages/blocks/src/render/media.ts:30-65` riproduce solo `wp_calculate_image_srcset`;
nella sorgente agiscono anche i filtri di Divi
(`themes/Divi/includes/builder/functions.php:12850-12922`).

| Caso | URL | Sorgente | Sito |
|---|---|---|---|
| A — derivate Divi 480/980/1280, una sola sorgente utile → nessun `srcset` | 9 URL a 390 px | `724x1024`, senza srcset | srcset completo, sceglie 480 |
| C — Divi con più sorgenti | servizi, sportello d'ascolto, 1440 px | `480w…3543w`, `sizes` a fasce Divi | `sizes 100vw`, sceglie 1536 |
| B — derivata `large` larga quanto l'originale | le-dipendenze, corso-…-vecchia-pagina, 1440 px | vince l'originale | vince la derivata (`Set` di `media.ts:46-53`) |
| D — Divi non risolve l'allegato per `guid` → nessun `srcset` | 2 immagini a 390 px | nessun srcset | srcset |

`media_variants` non conserva il nome della taglia: l'importer lo legge
(`apps/importer/src/stages/media/attachmentMetadata.ts:15,71-77`) ma non lo salva.

| File:riga | Modifica |
|---|---|
| `packages/blocks/src/render/media.ts:45-56` | a parità di larghezza vince l'immagine mostrata, poi l'originale (B) |
| `packages/blocks/src/render/media.ts:30-65` | ramo Divi per srcset e sizes (A, C), riconoscimento secondo D84 |
| *solo D84 = B:* `media.ts:7-13`; `apps/api/src/modules/public/service.ts:106,130-150`, `schemas.ts:25`; `packages/db/src/schema/media.ts:59-72`, migrazione; `apps/importer/src/stages/media/index.ts:246-305` | `size_name` per variante |
| chiamanti da allineare secondo D96: `Image.tsx:16`, `MediaText.tsx:27`, `PostList.tsx:38`, `Slider.tsx:58`, `Video.tsx:58` | |
| *caso D, se corretto:* `packages/blocks/src/schema/image.ts:12-36` e convertitori | indicatore «sorgente senza srcset» all'import |

Prove in `packages/blocks/tests/render/media.test.tsx` (una sola sorgente → niente
srcset; originale oltre 1280 → 4 sorgenti e sizes Divi; parità di larghezza → originale).

**Effetto su DR-162:** i pixel delle immagini cambiano. Da ricatturare e rivedere i 26
URL elencati in fondo, alle 6 viewport (anche 768-1280, che la T3 non misurava).

### I3 — Video `.mp4`

`apps/importer/src/convert/divi/convert.ts:500` calcola il provider sull'indirizzo
originale `…/wp-content/uploads/…mp4` → `other`; solo dopo la fase `rewrite` lo porta in
`/media/`. `Video.tsx:85-92` rende `other` come «Apri il video». 4 blocchi su 2 pagine:
anche `/riparte-il-corso-per-consulenti-familiari/`, fuori dai 79 URL. I file rispondono
200 `video/mp4` (58 MB), ma l'API **non gestisce `Range`** (200 invece di 206, nessun
`Accept-Ranges`, `apps/api/src/modules/public/routes.ts:342-397`): Safari di solito non
riproduce e lo spostamento nella timeline può non funzionare.

| File:riga | Modifica |
|---|---|
| *D85 = A:* `apps/importer/src/convert/divi/convert.ts:500` | `deriveVideoProvider(rewriteUploadsReferences(src))` |
| *D85 = B:* `packages/blocks/src/render/Video.tsx:85` | `other` con `src` in `/media/` trattato come `file` (eccezione a BLOCK-MODEL §3.7.1) |
| *D86 = A:* `apps/api/src/modules/public/routes.ts:342-397`, `apps/api/src/lib/objectStore.ts:29,54` | `Range`/206 e `Accept-Ranges` |

La copertina con caricamento al clic (DR-107, DR-121) resta: cambia solo cosa compare
dopo il clic. Nessun effetto su DR-162. Prove: `apps/importer/tests/unit/convert/divi.test.ts`
(mp4 dello stesso sito → `file`); `dynamic-blocks.test.tsx` (dopo il clic un `<video>`);
prova della rotta con `Range` se D86 = A.

---

## 4. A3-1 — Esc e menu mobile

`<details id="et_mobile_nav_menu">` in `apps/web/src/components/SiteHeader.tsx:96-104`,
componente server. Schema già usato da `HeaderSearch.tsx:81-83`.

| File:riga | Modifica |
|---|---|
| `apps/web/src/components/MobileNav.tsx` (nuovo, `'use client'`) | `<details>` non controllato con lo stesso `id`; Esc a menu aperto: chiude e riporta il fuoco al `summary` |
| `apps/web/src/components/SiteHeader.tsx:96`, `:104` | `<details>` → `<MobileNavDetails>`; figli resi dal server |
| `apps/web/src/components/SiteHeader.tsx:11-12` | commento aggiornato |

HTML generato identico: rientra in DR-169 («non cambia la resa»). Prove:
`apps/web/tests/mobileNav.test.tsx`; A-3 di `verifica-accessibilita.ts:276-278` atteso
«superato»; parità della testata a 360 e 390.

---

## 5. Fuori dalla richiesta, da non perdere

| Voce | Perché |
|---|---|
| A5-1 campo di ricerca senza etichetta | non cambia la resa: per DR-169 va corretto ora; non era nell'elenco della T7 |
| A-8, 2 coppie nuove (`#757575` su `#eee`, asterisco `#f00`) | va misurato il riferimento per confermare che sono ereditate (`riepilogo.md` §6) |
| Form commentato nella sorgente su `/registrazione-seminario-autostima-e-assertivita/` | difformità di contenuto emersa in I1 |

---

## 6. Ordine di attuazione proposto

1. Senza decisioni, senza import: **F1**, **A3-1**, **I1** (senza freccia), **M2**, **M6**, **M7** (parte certa).
2. Dopo D80-D81: **M3/M4** e **M5** insieme (una migrazione 0007, un import `contents`+`seo`, un handoff con backup).
3. Dopo D82-D84 e il round 2: **M1**, **M8**, **I2** (con ricattura), **I3**.
4. Audit: `lint`/`typecheck`/`test`, 1E-19, T1-T6 rieseguite, ricattura delle viste toccate.

## 7. Decisioni

| id | Decisione | Round | Bloccante per |
|---|---|---|---|
| **D80** | DR-172 e i title | 1 | M3 |
| **D81** | DR-173 per tipo di contenuto | 1 | M4 |
| **D82** | `/download-category/moduli-consulenze/` | 1 | M8 |
| **D83** | `Person` nei dati strutturati | 1 | M1 |
| **D84** | riconoscimento delle derivate Divi | 1 | I2 |
| D85 | dove si corregge I3 | 2 | I3 |
| D86 | `Range` nell'API ora o nella 1F | 2 | I3 |
| D87 | Esc solo con il fuoco nel menu o in tutta la pagina | 2 | A3-1 |
| D88 | campi dell'organizzazione oltre la sorgente | 2 | M1 |
| D89 | `dateModified`: data dell'import o della sorgente | 2 | M1 |
| D90 | `CollectionPage` e `SearchResultsPage` dentro DR-170 | 2 | M1 |
| D91 | canonical e `og:url` assoluti (`metadataBase`) | 2 | M1 |
| D92 | tenere la sovrascrittura del title di M5 | 2 | M5 |
| D93 | impostazioni `seo.robots_txt`/`seo.sitemap_enabled` modificabili nel CMS ma ignorate | 3 | M7 |
| D97 | `SITE_URL` obbligatoria in produzione (separata da D93 il 2026-10-18) | 4 | M7, M1 |
| D94 | percorso del termine: API o importer | 2 | M8 se D82 = A |
| D95 | freccia del bottone «Invia», sfondo dei 4 link | 2 | I1 |
| D96 | caso D di I2 e blocchi a cui applicare la regola Divi | 2 | I2 |

## URL da ricatturare per I2

attraversare-le-emozioni, autostima-e-assertivita, circolo-della-sicurezza,
convegno-comunicare…, convegno-diventare-anziani…, convegno-genitori-sempre…,
convegno-imperfetto…, corso-caritas-fare-bene-il-bene, dal-vizioso-al-virtuoso,
dalla-ferita-alla-feritoia, genitori-si-resta, il-corpo-racconta, invidia-vergogna…,
io-e-laltro…, la-rabbia-in-consulenza…, litighiamo-oggi, noi-uomini, parlarsi-con-il-cuore,
reinventa-la-tua-vita, relazionarti, ridere-in-coppia…, servizi, sguardi-damore,
sguardi-damore-2, le-dipendenze, corso-per-consulenti-familiari-vecchia-pagina.

---

## 8. Attuazione del gruppo 1 (2026-10-18)

Elenco approvato e D80-D84 chiuse (**DR-179…183**). Attuati con prove scritte prima del
codice (rosse, poi verdi):

| Voce | File toccati | Prove | Verifica sul sito (`:3200` ricompilato) |
|---|---|---|---|
| F1 | `packages/blocks/src/render/FormField.tsx` | 2 nuove in `dynamic-blocks.test.tsx` (obbligatorio e no) | `/diventa-socio/`, invio intercettato e annullato: `{"values":{"5":"3330000000"}}` |
| A3-1 | `apps/web/src/components/MobileNav.tsx` (nuovo), `SiteHeader.tsx` | `apps/web/tests/mobileNav.test.tsx`, 4 (markup invariato compreso) | a 390: Invio apre, Esc da una voce chiude, fuoco sul `summary` |
| I1 (senza freccia, D95 aperta) | `apps/web/src/styles/layout.css`; misura in `tests/visual/verifica-interazioni.ts` (attesa 500 ms, conto per categoria) | `apps/web/tests/layoutCss.test.ts`, 4 | primo livello 1 → 0,7; sottomenu 0,7 e `rgba(0, 0, 0, 0.03)` |
| M2, M6 | `tests/visual/classifica-metadati.ts` | 7 nuove o aggiornate, 75/75 | `verifica-metadati.ts`: 42 righe DR-171, 4 righe DR-175; restano 34 «troncata» con prefisso non esatto, da M3/M4 |
| M7 | `apps/web/src/lib/site.ts` (nuovo), `robots.ts` (dinamico), `sitemap.ts`, `proxy.ts`, `.env.example`; `tests/visual/verifica-metadati.ts`; `tests/e2e/regole-strutturali.spec.ts` | `apps/web/tests/robots.test.ts`, 3 | `Disallow: /admin` e `Sitemap: http://127.0.0.1:3200/sitemap.xml`; esito `correzione DR-176` |

`robots.txt` era generato alla compilazione con l'indirizzo predefinito: ora si legge a
ogni richiesta, come la sitemap. Il sito su `:3200` si avvia con `SITE_URL=http://127.0.0.1:3200`.

Esiti: `pnpm test` 8/8 pacchetti; lint e typecheck verdi in tutti i pacchetti. Una prima
esecuzione con turbo senza `--concurrency=1` ha fatto fallire `@amoris/db#test` per
concorrenza sul database; da solo e con lo script del progetto passa.

Non rieseguite in questa fase: T3 completa (interazioni) e voce 4 dei form, che scrive nel
database; si rifanno nell'audit della wave.

Revisione del codice: nessun problema critico o alto; due medi nel classificatore, corretti
con prove negative scritte prima (77/77): la regola DR-171 vale solo se la sorgente supera i
160 caratteri, la regola robots di DR-175 solo sui percorsi `/page/N/` (`classificaCampo`
riceve il percorso). Nota minore corretta: `SITE_URL` vuota ricade sul valore predefinito.
Rimisura dei metadati dopo le correzioni: conteggi invariati (42 DR-171, 2+2 DR-175). La
correzione di `SITE_URL` vuota entra nel sito alla prossima compilazione; con `SITE_URL`
impostata il comportamento non cambia.

Stato delle decisioni al 2026-10-18: D80-D84 = DR-179…183; D85, D88-D91 = DR-184…188; round 3: D86, D87, D92, D93, D94; round 4: D95, D96, D97.
Aggiornamento 2026-10-18: D86, D87, D92-D94 = DR-189…193. D96 divisa: D96 (blocchi a cui applicare la regola Divi) e D99 (caso D). Il form commentato del §3 I1 è già accettato in DR-162. Round 4: D95, D96, D97, D99.

## 9. Attuazione dei gruppi 2 e 3 (2026-10-18)

DR-184…197 attuate in tre aree a proprietà separata dei file, con prove scritte prima del
codice. Nessuna scrittura sul database, nessuna migrazione applicata, nessun import.

| Area | Contenuto | Prove |
|---|---|---|
| Dati, importer, API | migrazione `0007_descrizione_e_data_di_modifica` (`description_source`, `modified_at`); porto dell'algoritmo di All in One SEO (105 description su 106 uguali alla sorgente sul dump); variabili del title (M5); provider dei video `.mp4` (I3); percorso `/download-category/`; impostazioni `contact.phone`, `social.profiles`; letture pubbliche dei documenti per categoria, categorie nei documenti, sitemap con documenti; `Range`/206/416; `termByPath` limitato a `category` e `wpdmcategory` | importer 409, API 237, db 19 |
| Immagini, font, CMS | regola Divi di `srcset`/`sizes` per tutti i blocchi (33 immagini su 33 come la sorgente); freccia del bottone «Invia» e font con 5 glifi; impostazioni nascoste nel CMS (DR-192) | blocks 256, admin 187 |
| Sito e prove | JSON-LD per ogni tipo di pagina senza `Person`; `metadataBase`; `siteUrl()` obbligatoria in produzione alla prima richiesta; pagina della categoria dei moduli; classificatore (DR-182, DR-177); `SITE_URL` in e2e e CI | web 114, funzioni pure 87 |

Revisioni: codice e sicurezza senza problemi critici o alti. Corretti dopo le revisioni,
con prove rosse prima: data della sitemap da `modified_at`; `description_source` azzerata
anche per blocchi inviati senza testo; categoria dei download con soli documenti riservati
→ 404 anche per nome (coerente con la sitemap, nessun nome esposto); categorie annidate
risolte dal sito; profili social solo `http`/`https`; chiave `constructor` → 404. Falso
positivo verificato sul PHP di Divi: immagine mostrata sotto i 480 px senza `srcset`.
Verificato sul riferimento: 0 contenuti protetti da password su 1 234.

Esiti finali: lint e typecheck 18/18; prove 8/8 pacchetti, 1 503; funzioni pure 87/87.
Verifica sul sito dopo HO-025 (§3 dell'handoff).
