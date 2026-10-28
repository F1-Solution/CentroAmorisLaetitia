# Collaudo 1G-W8 — passata di copertura dei 16 campi (agente)

Collaudo della `1G-W8` (DR-290, DR-292), 2026-10-28, 14:37–14:42 UTC (15:37–15:42 ora di Roma).
Ambiente: sito `127.0.0.1:3300`, area `127.0.0.1:3301/admin`, database `amoris_collaudo`. Nessun 500 o 503.

**Ripresa dopo l'interruzione.** Prima di ripartire ho controllato con SELECT `audit_log`, impostazioni, modelli SEO, menu e pagina iniziale, e i giornali in `strumenti-1G/collaudo/risultati/`. Dopo le 11:52 UTC (fine di HO-052) il registro non aveva nessuna riga, e non c'era nessun giornale della copertura: non avevo ancora scritto nulla. Impostazioni e modelli SEO coincidevano con `amoris`, salvo `contact.address` = `""`, residuo noto di HO-051. Il coordinatore ha confermato. Sono partito dal campo 1.

Script: `.superpowers/sdd/strumenti-1G/collaudo/25-copertura.spec.ts`, che riusa `supporto.ts` e `supporto2.ts`. Giornale: `risultati/25-copertura.jsonl`. Traccia spenta, password mai registrate.
Account: `editor` («Redazione») per i campi 1–9 e 14–16, `amministrazione` («Impostazioni») per i campi 10–13. Ogni scrittura è stata fatta dall'interfaccia. Le SELECT servono solo a leggere.

Il blocco 1–5 è partito quattro volte. Le prime tre volte si è fermato sul selettore dell'immagine (W8-35) prima di salvare la SEO. Ogni volta la pagina di prova è stata eliminata nel `finally`. Nel registro: 4 «content.create» e 4 «content.delete».

## 1. I 16 campi

### 1. pagina e notizia — percorso pubblico (1G-11) — atteso: non modificabile (calcolato)
- **Partenza:** pagina `Pagina di prova collaudo copertura` creata per la prova (`select count(*) … slug='prova-collaudo-copertura'` → 0 prima).
- **Fatto:** scheda «Indirizzo». Gli unici campi scrivibili sono «Slug» e «Pagina genitore». Ho scritto uno slug diverso senza salvare, poi ho ricaricato la pagina.
- **Osservato:** «Indirizzo risultante: /prova-collaudo-copertura-anteprima/» si aggiorna da solo e non si scrive. Dopo la ricarica il `path` resta `/prova-collaudo-copertura/` e la pagina risponde 200.
- **Esito:** riuscito. Il percorso è calcolato e mostrato, non si scrive.
- **Ripristino:** pagina eliminata. `count(*)` → 0, indirizzo 404, nessun redirect.

### 2. blocco «Presentazione a scorrimento»: carosello scelto (1G-15) — atteso: modificabile
- **Partenza:** un solo carosello, «Slider home» (`select title from sliders`).
- **Fatto:** sulla pagina di prova ho fatto «Aggiungi blocco» › «Presentazione a scorrimento» › «Quale carosello?» (opzioni «Scegli un carosello», «Slider home») › «Inserisci». Poi ho selezionato il blocco: «Blocco selezionato» › «Carosello» propone solo «Slider home» e mostra «Modifica le immagini del carosello». Infine ho pubblicato.
- **Osservato:** sul sito il blocco `blk-slider` ha 12 slide. Tra anteprima e pagina pubblicata cambia solo la scrittura (`srcset`/`srcSet`, entità); i titoli HTML delle slide sono già noti (W8-26).
- **Esito:** riuscito, con un limite. La scelta funziona, ma con un solo carosello non si può passare da un carosello a un altro, e l'area non ha un comando per crearne uno.
- **Ripristino:** pagina eliminata (vedi campo 1). `sliders` è invariata.

### 3. non seguire i collegamenti (1G-7) — atteso: modificabile
- **Partenza:** pagina nuova, senza riga in `content_seo`. Sul sito: `robots` = `max-image-preview:large`.
- **Fatto:** scheda SEO › «Non seguire i collegamenti di questa pagina» spuntata › «Salva i metadati SEO» («Metadati SEO salvati.»). Poi tolta la spunta e salvato di nuovo.
- **Osservato:** `robots_nofollow=true`. Anteprima e sito mostrano `nofollow, max-image-preview:large`. Tolta la spunta, il sito torna a `max-image-preview:large`.
- **Esito:** riuscito.
- **Ripristino:** `robots_nofollow=false`, poi pagina eliminata. `select count(*) from content_seo where content_id=…` → 0.

### 4. indirizzo canonico (1G-7) — atteso: modificabile
- **Partenza:** canonico `http://127.0.0.1:3300/prova-collaudo-copertura/`.
- **Fatto:** «Indirizzo canonico» = `/prova-collaudo-1g-1/` › salva. Poi campo svuotato › salva.
- **Osservato:** anteprima e sito mostrano `<link rel="canonical" href="http://127.0.0.1:3300/prova-collaudo-1g-1/">`. Svuotato il campo, il canonico torna quello della pagina e `canonical_url` torna `null`.
- **Esito:** riuscito.
- **Ripristino:** come al campo 3.

### 5. immagine di condivisione (1G-7) — atteso: modificabile
- **Partenza:** nessun `og:image`.
- **Fatto:** «Scegli immagine di condivisione» › «Scegli un media» › ricerca «prova collaudo 1G-5» › «Titolo prova collaudo 1G-5». «Usa questo media» resta spento finché non si scrive un «Testo alternativo» o si spunta «decorativa» (W8-35). Ho scritto un testo inventato › «Usa questo media» › salva.
- **Osservato:** prima della ricarica il pulsante dice «Cambia immagine di condivisione». `og_image_id` è quello del media. Anteprima e sito: `og:image` = `/media/2026/10/prova-1g-5-a.png`.
  - **Dopo una ricarica** la scheda dice di nuovo «Scegli immagine di condivisione» e non nomina l'immagine scelta.
  - **Non c'è nessun comando per togliere l'immagine:** dopo il salvataggio con canonico e nofollow tolti, `og:image` resta (W8-34).
- **Esito:** riuscito con difficoltà (W8-34, W8-35).
- **Ripristino:** dall'area l'immagine non si toglie. L'ho ripristinata eliminando la pagina di prova: `content_seo` → 0 righe. Nessuna pagina esistente è stata toccata.

### 6. voce di menu — rimuovere (1G-13) — atteso: modificabile
- **Partenza:** 66 voci. Voce `111` (`c680fd31…`) verso `prova-collaudo-1g-1`, visibile nel menu del sito.
- **Fatto:** Menu › «Aggiungi una voce» › «Un indirizzo scritto a mano», etichetta `Voce di prova collaudo 1G-13`, indirizzo `/prova-collaudo-1g-1/`. Compare sul sito. Poi «Elimina: Voce di prova collaudo 1G-13» › finestra «Elimina la voce di menu — La voce esce dal menu insieme a tutte le voci annidate sotto di lei. I contenuti collegati restano al loro posto.» › nome digitato › «Elimina definitivamente». Stessa procedura per `111`.
- **Osservato:** tolta la voce di prova, menu del sito e righe del database sono identici a prima. Tolta la `111`, sparisce dal sito e restano 65 voci. Nessun messaggio dopo l'aggiunta né dopo l'eliminazione (W8-23, si ripresenta).
- **Esito:** riuscito.
- **Ripristino:** `select count(*) from menu_items where label in ('111','Voce di prova collaudo 1G-13')` → 0. Totale 65 (64 in `amoris`, più il residuo «Prova collaudo 1G-1», vedi §3).

### 7. media — descrizione (1G-5) — atteso: modificabile
- **Partenza:** `prova-1g-5-a.png`: titolo «Titolo prova collaudo 1G-5», alt «Prova collaudo 1G-5 B», didascalia «Didascalia prova collaudo 1G-5», descrizione `null`.
- **Fatto:** Media › ricerca › «Titolo prova collaudo 1G-5» › «Descrizione» = `Descrizione di prova collaudo 1G-5` › «Salva» («Fatto — Modifiche salvate.»). Poi ho riaperto il pannello e svuotato il campo › «Salva».
- **Osservato:** il valore è salvato e ricompare alla riapertura. Sul sito non si vede: il `main` di `/prova-collaudo-1g-5/` è identico e la pagina allegato risponde 404. L'API pubblica non espone la descrizione dei media (`apps/api/src/modules/public/service.ts:117-127`).
- **Esito:** riuscito. Si modifica, e sul sito non ha effetti visibili per costruzione.
- **Ripristino:** stessa riga di partenza, descrizione `null`.

### 8. documento — data di creazione (1G-15) — atteso: non modificabile (calcolato)
- **Partenza:** 8 documenti.
- **Fatto:** «Nuovo documento» › `Documento di prova collaudo copertura` con `prova-1g-15-nuovo.pdf` › «Crea il documento».
- **Osservato:** la finestra non ha campi data. L'editor del documento ha solo «Titolo», «Descrizione» e il file; mostra «Ultimo aggiornamento 28/10/2026», ma non la data di creazione. Nel database `created_at` è 14:41:50 UTC. Il sito mostra «Data di creazione: 28 Ottobre 2026» e «Ultimo aggiornamento: 28 Ottobre 2026».
- **Esito:** riuscito. La data è calcolata e non si scrive. L'area non la mostra, il sito sì.
- **Ripristino:** documento eliminato (finestra con nome digitato). Documenti → 8, media `prova-1g-15-nuovo%` → 0.

### 9. documento — categoria del documento (1G-15) — atteso: modificabile alla creazione
- **Partenza:** una sola categoria dei download, «Moduli consulenze» (`wpdmcategory`).
- **Fatto:** nella stessa creazione del campo 8: «Categoria dei download» propone e preseleziona «Moduli consulenze». L'aiuto dice «Il documento compare nell'elenco di questa categoria sul sito.».
- **Osservato:** `document_terms` → «Moduli consulenze». Il documento compare in `/download-category/moduli-consulenze/`. L'editor del documento non mostra la categoria e non la cambia, come dice la matrice.
- **Esito:** riuscito. Con una sola categoria la scelta è obbligata.
- **Ripristino:** come al campo 8. Il documento è uscito dall'elenco della categoria.

### 10. impostazioni del sito — logo del sito (1G-16) — atteso: modificabile; verificare se è comprensibile
- **Partenza:** `site.logo_media_id = "60cce722-…"` (`logo_header_2.png`).
- **Fatto:** Impostazioni del sito › «Logo del sito» = identificativo di `prova-1g-5-a.png` › «Salva «Logo del sito»» («Salvata.»). Poi ho rimesso il valore di partenza.
- **Osservato:** l'intestazione del sito mostra `<img src="/media/2026/10/prova-1g-5-a.png" … id="logo">` e il logo cambia anche nei dati strutturati. Ripristinato, torna `logo_header_2.png`.
  - **Non è comprensibile:** il campo è un identificativo interno senza aiuto, e il pannello di Media non lo mostra (solo indirizzo, tipo, dimensione). L'ho preso con una SELECT (W8-38).
- **Esito:** riuscito con difficoltà (W8-38).
- **Ripristino:** `"60cce722-4857-4901-9a34-ac18405cb079"`, uguale ad `amoris`.

### 11. impostazioni del sito — profili social (1G-16) — atteso: modificabile
- **Partenza:** `social.profiles = []`.
- **Fatto:**
  - `["non-un-indirizzo"]`: «Non è stata salvata — Il valore non ha la forma prevista per questa impostazione.», e il valore resta `[]`. Il messaggio non dice che serve un indirizzo `https://`; nota minore.
  - `["https://example.invalid/prova-collaudo-1g-16"]`: «Salvata.».
  - `[]`: ripristino.
- **Osservato:** i dati strutturati della home mostrano `"sameAs":["https://example.invalid/prova-collaudo-1g-16"]`, e nulla appare nella pagina visibile. Ripristinato, `sameAs` sparisce.
- **Esito:** riuscito. Il formato JSON è spiegato solo in parte dall'aiuto («uno per voce»).
- **Ripristino:** `[]`, uguale ad `amoris`.

### 12. impostazioni del sito — pagina iniziale (1G-13; 1G-16) — atteso: modificabile; verificare se è comprensibile
- **Partenza:** `site.home_content_id = "be44edcc-…"` (pagina `home`). Home vista senza cookie: «Home - Centro Amoris Laetitia».
- **Fatto:** «Pagina iniziale» = identificativo di `prova-collaudo-1g-1` › salva. Ho controllato la home in un contesto nuovo senza cookie, poi ho subito rimesso il valore di partenza.
- **Osservato:**
  - Con la pagina di prova, `/` risponde 200 con titolo «Titolo SEO prova collaudo 1G-7» e `h1` «Pagina di prova collaudo 1G-1». `/prova-collaudo-1g-1/` risponde 301 verso `/` e `/home/` risponde 200.
  - Ripristinata, `/` torna «Home - Centro Amoris Laetitia», `/home/` torna 301 verso `/` e `/prova-collaudo-1g-1/` torna 200.
  - Il campo vuole l'identificativo del contenuto, che si legge solo nell'indirizzo dell'editor. L'API accetta qualunque testo (W8-38).
- **Esito:** riuscito con difficoltà (W8-38).
- **Ripristino:** `"be44edcc-05db-4335-8922-8ee2925da154"`, uguale ad `amoris`. La pagina iniziale è rimasta cambiata per circa 3 s.

### 13. impostazioni del sito — GA4, banner cookie, mappe incorporate, redirect delle pagine allegato (1G-16) — atteso: modificabile; il sito non le legge in Fase 1
- **Partenza:** `analytics.ga4_measurement_id = null`, `cookie.banner_enabled = true`, `maps.embed_enabled = true`, `seo.redirect_attachment_urls = true`.
- **Fatto:** GA4 = `G-PROVA00000` (sintetico) e le tre spunte tolte, ognuna con il suo «Salva «…»» («Salvata.»). Poi ho rimesso tutto.
- **Osservato:** sul sito non c'è `G-PROVA00000` né `gtag`/`googletagmanager`. Il `main` di home e di `/dove-siamo/` è identico. Come dice la matrice, il sito non le legge.
- **Esito:** riuscito.
- **Ripristino:** le tre spunte sono tornate `true`. **GA4 è tornato `""`, non `null`:** svuotare il campo salva una stringa vuota, come per `contact.address` (W8-37). Dall'interfaccia `null` non si ottiene. Sul sito non si vede.

### 14. SEO (template) — template della descrizione (1G-7) — atteso: modificabile
- **Partenza:** modello «Pagine»: `{title} - {site_title} | ∅ | (nessuna direttiva) | ∅ | ∅`. Su `/prova-collaudo-1g-10/` la descrizione è l'inizio del testo.
- **Fatto:** SEO e indirizzi › «Pagine» › «Template della descrizione» = `Descrizione dal modello prova collaudo 1G-7 per {title}` › «Salva il template». Insieme ho cambiato anche i campi 15 e 16. Nessun messaggio di riuscita (W8-17, si ripresenta).
- **Osservato:** `description` e `og:description` di `/prova-collaudo-1g-10/` diventano «Descrizione dal modello prova collaudo 1G-7 per Pagina di prova collaudo 1G-10». `/prova-collaudo-1g-1/` tiene la sua sovrascrittura. Le notizie non cambiano. L'elenco dei modelli mostra il nuovo testo.
- **Esito:** riuscito.
- **Ripristino:** campo svuotato › `description_template = null`. Il sito torna identico (confronto dei meta: uguale).

### 15. SEO (template) — direttive robots (1G-7) — atteso: modificabile
- **Fatto:** «Direttive robots» = `noindex, nofollow`.
- **Osservato:** `robots` di tutte le pagine diventa `noindex, nofollow, max-image-preview:large`, comprese quelle con sovrascrittura; le notizie non cambiano. **Le pagine restano in `/sitemap.xml`** (W8-36).
- **Esito:** riuscito, con W8-36.
- **Ripristino:** campo svuotato › `robots_directives = {}`, e `robots` torna `max-image-preview:large`.

### 16. SEO (template) — tipo Open Graph (1G-7) — atteso: modificabile
- **Fatto:** «Tipo Open Graph» = `website`.
- **Osservato:** `og:type` delle pagine passa da `article` a `website`; le notizie restano `article`.
- **Esito:** riuscito.
- **Ripristino:** campo svuotato › `og_type = null`, `og:type` torna `article`. I sei modelli SEO sono identici ad `amoris`.

## 2. Difetti nuovi

| Id | Gravità | Dove | Difetto | Causa | Evidenza |
|---|---|---|---|---|---|
| W8-34 | media | editor › SEO › «Scegli immagine di condivisione» | Un'immagine di condivisione scelta non si toglie più: nessun comando la rimuove. Dopo una ricarica la scheda dice di nuovo «Scegli immagine di condivisione» e non nomina l'immagine, anche se il sito la usa. Per tornare a «nessuna immagine» si è dovuta eliminare la pagina | `apps/admin/src/components/editor/ContentSeoPanel.tsx:212` (`chosenImage` cercata solo nei media caricati quando il selettore è aperto) e `:242`; nessun comando porta `ogImageId` a `null` (`:195`, `:322-324`) | `25-copertura.jsonl`: `5 dopo-ricarica` (pulsanti «Scegli immagine di condivisione»), `3-4 db-tolti` (`og_image_id` ancora presente), `3-4 sito-tolti` (`og:image` presente) |
| W8-35 | bassa | editor › SEO › «Scegli un media» | Per l'immagine di condivisione «Usa questo media» resta spento finché non si scrive un «Testo alternativo» («Obbligatorio…») o si spunta «decorativa». Quel testo poi non si salva da nessuna parte | `ContentSeoPanel.tsx:312-325`: `MediaPicker` senza `requireAlt={false}`; `onSelect` ignora l'alt (`:322`) | `5 dettaglio-scelta` (`usaAttivo: false`); primi tre tentativi fermi su «Usa questo media» |
| W8-36 | bassa | SEO e indirizzi › modelli › «Direttive robots» | Con `noindex` nel modello «Pagine», tutte le pagine dicono `noindex` ma restano in `/sitemap.xml`. Una pagina con «Non indicizzare» nella sua SEO, invece, ne esce. Il sito dà ai motori due indicazioni contrarie | `apps/api/src/modules/public/service.ts:1058-1062`: la mappa legge solo `content_seo.robots_noindex`, non `seo_templates.robots_directives` | `14-16 sito` (`robots` `noindex, nofollow…`, `sitemap: true`) |
| W8-37 | bassa | Impostazioni del sito › campi nati vuoti (`null`) | Un'impostazione partita `null` e poi svuotata dall'area salva `""`, e lo stato di partenza non si ottiene più dall'interfaccia. Si è visto su «Identificativo di misurazione GA4» e, in HO-051, su «Indirizzo del Centro». Il sito non mostra differenze | `apps/admin/src/components/settings/SiteSettings.tsx:56-58`: `valueFrom` restituisce il testo, anche vuoto, quando il valore di partenza è `null` | `10-13 ripristino` (`diversi: analytics.ga4_measurement_id=""`) |
| W8-38 | media | Impostazioni del sito › «Logo del sito», «Pagina iniziale» | I due campi chiedono l'identificativo interno di un media o di un contenuto, senza aiuto né scelta da elenco. Media non mostra l'identificativo; quello di una pagina si legge solo nell'indirizzo dell'editor. Il valore non è controllato: l'API accetta qualunque testo. Dal codice, un valore che non è un identificativo farebbe fallire la lettura della pagina iniziale nel database. **Non l'ho provato**, per non rompere la home del collaudo | `apps/admin/src/components/settings/SiteSettings.tsx:126-133` (campo di testo generico); `apps/api/src/modules/settings/schemas.ts:37-60` senza le due chiavi; `apps/api/src/modules/public/service.ts:375` (`eq(contents.id, homeId)`) e `:242-246`; pannello Media in `MediaLibrary.tsx:420-428` senza identificativo | `10-13 righe` (nessun aiuto sul logo); `7 pannello` (Indirizzo, Tipo, Dimensione) |

Difetti noti che si ripresentano: W8-03 (ogni «Pubblica» lascia «content.draft.discard»), W8-09 (401 `/auth/me`, 404 `/draft` e `/seo/contents/:id` in console), W8-01 (miniatura `3301/media/prova-1g-5-a.png` 404 nel selettore), W8-17 («Salva il template» senza messaggio), W8-23 (menu e documenti senza messaggio), W8-26 (titoli HTML delle slide). Nel registro, la sola riga «non riuscita» è il rifiuto atteso dei profili social non validi (PUT 400).

## 3. Residui

- **`analytics.ga4_measurement_id` = `""`** invece di `null` (W8-37). Non si riporta a `null` dall'interfaccia e non si vede sul sito. Si somma al residuo noto `contact.address` = `""`.
- **Voce di menu «Prova collaudo 1G-1»** (`488cc2fc-…`, verso `prova-collaudo-1g-1`), ancora nel menu principale. Non è mia e il brief chiedeva di togliere solo la `111`, quindi l'ho lasciata. `amoris` ha 64 voci, il collaudo 65.
- Lasciato dalla copertura: nient'altro. Pagina di prova e documento sono eliminati. Descrizione del media, logo, pagina iniziale, profili social, spunte e modelli SEO sono uguali alla partenza e ad `amoris`, verificato con SELECT.
- La voce `111` è stata tolta come richiesto: fa parte della pulizia, non è un residuo.

## 4. Testo per la matrice (non modificata)

| tipo | campo | esito_collaudo |
|---|---|---|
| pagina e notizia | percorso pubblico | 1G-11 (agente): calcolato; la scheda «Indirizzo» lo mostra come «Indirizzo risultante», non si scrive |
| pagina e notizia | blocco «Presentazione a scorrimento»: carosello scelto | 1G-15 (agente): riuscito con l'unico carosello «Slider home»; un altro non si sceglie perché non esiste e non si crea |
| pagina e notizia | non seguire i collegamenti | 1G-7 (agente): riuscito, `nofollow` messo e tolto |
| pagina e notizia | indirizzo canonico | 1G-7 (agente): riuscito, messo e tolto |
| pagina e notizia | immagine di condivisione | 1G-7 (agente): `og:image` riuscito; non si toglie e dopo una ricarica non si vede quale è (W8-34); alt chiesto e non salvato (W8-35) |
| voce di menu | rimuovere | 1G-13 (agente): riuscito con conferma, menu identico; tolta anche la voce residua `111` |
| media | descrizione | 1G-5 (agente): salvata e tolta; nessun effetto sul sito, che non la legge |
| documento | data di creazione | 1G-15 (agente): calcolata; non si scrive, l'area non la mostra, il sito sì |
| documento | categoria del documento | 1G-15 (agente): scelta alla creazione (una sola categoria), elenco della categoria giusto; l'editor non la mostra |
| impostazioni del sito | logo del sito | 1G-16 (agente): logo cambiato e ripristinato; identificativo interno non comprensibile (W8-38) |
| impostazioni del sito | profili social | 1G-16 (agente): riuscito, solo in `sameAs`; valore non valido rifiutato |
| impostazioni del sito | pagina iniziale | 1G-13; 1G-16 (agente): cambiata e ripristinata, `/` corretta senza cookie; identificativo interno non comprensibile (W8-38) |
| impostazioni del sito | GA4, banner cookie, mappe incorporate, redirect delle pagine allegato | 1G-16 (agente): si salvano, il sito non le legge; GA4 svuotato resta `""` (W8-37) |
| SEO (template) | template della descrizione | 1G-7 (agente): riuscito e ripristinato |
| SEO (template) | direttive robots | 1G-7 (agente): riuscito e ripristinato; con `noindex` le pagine restano nella sitemap (W8-36) |
| SEO (template) | tipo Open Graph | 1G-7 (agente): riuscito e ripristinato |

## 5. Controllo delle password

`controlla-password.mjs` su `strumenti-1G/collaudo/` (script, giornali, artefatti), `W8-PLAN/` e la cartella di lavoro dell'agente: 4 password note confrontate con 306 file, **0 corrispondenze**.
