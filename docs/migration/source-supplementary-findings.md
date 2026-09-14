# Rilievi complementari sulla sorgente — Fase 1B, wave `1B-W0`

Rilevato il 2026-09-14 sull'istanza di riferimento congelata al 2026-09-13
(`tools/wp-reference/`) e sul dump autorevole. **Sola lettura.**

Questa wave chiude le verifiche che la Fase 1A aveva esplicitamente rimandato alla
1B, perché senza di esse lo schema, il mapping e i criteri di accettazione
sarebbero costruiti su ipotesi.

| Rimando dalla 1A | Esito |
|---|---|
| Template SEO di All in One SEO (R-10) | **estratti**, §2 |
| Voci di menu condizionate al ruolo (R-12) | **misurato**, §3 — 23 voci su 64 non sono pubbliche |
| Pagine con titolo nascosto (`shk-hide-title`, 1A §2.8) | **misurato**, §4 |
| OptinMonster produce qualcosa? (R-13, mappa plugin §6) | **chiuso: non produce nulla**, §5 |
| Slider Revolution | **censito**, §6 |
| Versione PHP di produzione (MI-03) | **acquisita** e verificata, §7 |

Nuovi documenti prodotti:

| File | Contenuto |
|---|---|
| `public-menu.csv` | le 41 voci di menu effettivamente rese a un visitatore anonimo, con livello, etichetta e destinazione |
| `seo-rendered-baseline.csv` | per ognuno dei 117 URL che rispondono 200: `<title>`, description, canonical, Open Graph, robots, `<h1>`, tipi Schema.org, peso |

---

## 1. Perché `seo-rendered-baseline.csv` è il documento più importante di questa wave

La Fase 1A aveva accertato che il sito **non ha metadati SEO scritti a mano**: 2
title personalizzati, 0 description, 0 immagini Open Graph su 282 record. Da lì
discendeva il rischio R-10: copiare i record produrrebbe un sito senza description,
mentre oggi le description esistono perché generate dai template.

`seo-rendered-baseline.csv` misura ciò che il sito **produce davvero**, URL per URL.
Diventa il riferimento di accettazione della Fase 1E: la verifica non sarà «i
record coincidono», ma «l'output renderizzato coincide».

### 1.1 Quadro misurato

| Tipo | URL | Con `description` | Senza | Senza `<h1>` | Con `og:image` |
|---|---|---|---|---|---|
| `page` | 80 | 35 | **45** | **29** | 0 |
| `post` | 29 | **29** | 0 | 2 | 0 |
| `archivio_categoria` | 4 | 0 | 4 | 4 | 0 |
| `feed` | 2 | — | — | — | — |
| `sistema` | 2 | — | — | — | — |
| **Totale** | **117** | **64** | **53** | **39** | **0** |

### 1.2 Il dato che spiega tutto: Divi elimina description e `<h1>`

Incrociando con `content-inventory.csv`:

| Insieme | Con `description` | Con `<h1>` |
|---|---|---|
| Pagine **senza** Divi (49) | 33 | 48 |
| Pagine **con** Divi (29) | **1** | **2** |
| Articoli senza Divi (10) | 10 | 10 |
| Articoli con Divi (18) | 18 | 16 |

Il motivo è meccanico: il template di description delle pagine è `#post_content`, e
il `post_content` di una pagina Divi è una sequenza di shortcode che, ripulita,
non lascia testo utile. Il titolo `<h1>` sparisce perché Divi lo sostituisce con
moduli di testo formattati.

**Sono due difformità di qualità già presenti nel sito attuale.** Riprodurle
fedelmente significa riprodurre un difetto di accessibilità su 29 pagine.
Correggerle significa allontanarsi dalla sorgente. È una decisione dell'utente, non
tecnica: portata come **D13** nel round di decisioni di fine Fase 1B.

## 2. Template SEO di All in One SEO

Estratti da `wp_options.aioseo_options` e `aioseo_options_dynamic`. Il separatore è
il trattino `-`; `#separator_sa` vale quindi ` - `. Il nome del sito è
`Centro Amoris Laetitia`; **la descrizione del sito (`blogdescription`) è vuota**, e
questo spiega alcune stringhe con separatore penzolante.

### 2.1 Title e description per tipo

| Ambito | Template di `<title>` | Template di `description` |
|---|---|---|
| Globale | `#site_title #separator_sa #tagline` | `#tagline` (→ vuoto) |
| `page` | `#post_title #separator_sa #site_title` | `#post_content` |
| `post` | `#post_title #separator_sa #site_title` | `#post_excerpt` |
| `attachment` | `#post_title #separator_sa #site_title` | `#attachment_caption` |
| `wpdmpro` | `#post_title #separator_sa #site_title` | `#post_excerpt` |
| `category` e altre tassonomie | `#taxonomy_title #separator_sa #site_title` | `#taxonomy_description` |
| Archivio autore | `#author_name #separator_sa #site_title` | `#author_bio` |
| Archivio data | `#archive_date #separator_sa #site_title` | — |
| Ricerca | `#search_term #separator_sa #site_title` | — |
| Paginazione | suffisso `- Page #page_number` | — |

Il suffisso di paginazione è **in inglese** su un sito italiano:
`/category/news/page/2/` rende `News - Centro Amoris Laetitia - Page 2`. È un
difetto della sorgente e rientra fra le difformità da dichiarare (MI-08).

### 2.2 Regole robots

| Regola | Valore |
|---|---|
| Predefinito | indicizzabile, `max-image-preview:large`, `max-snippet:-1`, `max-video-preview:-1` |
| Pagine paginate | `noindex, nofollow` |
| Feed | `noindex` |
| Risultati di ricerca | `noindex` |
| Categorie vuote | `noindex` |
| Canonical delle pagine paginate | punta alla **prima** pagina dell'archivio |

Misurato: 111 URL su 117 rispondono `max-image-preview:large`; 2 rispondono
`noindex, nofollow` e sono le pagine 2 e 3 dell'archivio `news`.

### 2.3 Open Graph e Twitter

Entrambi attivi. `og:site_name` vale `Centro Amoris Laetitia -`, con il separatore
penzolante dovuto alla descrizione del sito vuota. `og:type` è `article` su 108 URL
e `website` sulla sola home. Tipo di card Twitter: `summary_large_image` in
generale, `summary` sulla home. **Nessun `og:image` su nessun URL.**

### 2.4 Schema.org effettivamente emesso

| Insieme di tipi | URL |
|---|---|
| `WebSite`, `Organization`, `WebPage`, `BreadcrumbList`, `ListItem` | 75 |
| come sopra più `BlogPosting`, `Person`, `ImageObject` | 29 |
| come la prima più `ImageObject` | 5 |
| `CollectionPage`, `BreadcrumbList`, `ListItem`, `Organization`, `WebSite` | 4 |

Il sito **non** emette oggi `LocalBusiness`, `Event` o `Course`, che RC-06 chiede.
Sono quindi **aggiunte**, non parità: vanno introdotte come miglioria dichiarata e
approvata, non silenziosamente.

### 2.5 Sitemap e robots.txt

Sitemap abilitata, nome `sitemap`, con indice, 1000 URL per indice. Tipi inclusi:
`post`, `page`, `attachment`. L'indice degli allegati risulta **vuoto** perché gli
URL allegato vengono rediretti al file (§2.6). Sitemap RSS attiva, 50 URL. Nelle
impostazioni risulta abilitata anche una sitemap HTML.

### 2.6 L'origine dei 169 redirect

L'impostazione `searchAppearance.postTypes.attachment.redirectAttachmentUrls =
attachment` è la causa dei 301 dalle pagine allegato al file. **Non è comportamento
nativo di WordPress: è una configurazione di All in One SEO.** Questo conferma il
rischio R-09 e la decisione DR-034 di mantenerlo, e indica che nel nuovo sistema
deve essere una **regola configurabile**, non un comportamento cablato.

## 3. Visibilità reale del menu — chiude R-12

Il menu ha 64 voci a database. **A un visitatore anonimo ne vengono rese 41.**
Misurato sull'istanza di riferimento, senza sessione, sulla home.

| Causa | Voci | Effetto sull'anonimo |
|---|---|---|
| `_nav_menu_role_display_mode = hide` senza ruoli selezionati | 20 | nascoste a tutti |
| Voce «Area riservata», `_nav_menu_role = in` | 1 | visibile solo agli autenticati |
| Voce «Vecchia pagina», ruolo `administrator` | 1 | visibile solo agli amministratori |
| Voce di tassonomia con ruoli `administrator`, `consulenti`, `direttivo` | 1 | nascosta agli anonimi |
| **Totale nascoste** | **23** | |

Le 41 voci pubbliche, con gerarchia a tre livelli, sono in
[`public-menu.csv`](public-menu.csv).

**Conseguenze operative**

1. La parità del menu si misura **da utente anonimo**, su 41 voci. Un confronto su
   64 sarebbe falso.
2. L'importer deve importare tutte e 64 le voci **con la loro condizione di
   visibilità**, non solo le 41: scartarne 23 perderebbe dati di navigazione che
   serviranno quando esisterà l'area riservata (DR-033).
3. Le 20 voci nascoste a tutti sono, di fatto, un archivio di edizioni passate dei
   seminari tenuto dentro il menu. Vanno conservate come tali.
4. Lo schema deve prevedere una **visibilità per voce di menu**, non un booleano
   «pubblicato».

## 4. Titoli nascosti — chiude il rilievo 1A §2.8

Due meccanismi distinti, entrambi da riprodurre:

| Meccanismo | Contenuti coinvolti | Effetto |
|---|---|---|
| `shk-hide-title` (`st_hide_title_check_option = on`) | **1**: la home, pagina 62 | nasconde il titolo della pagina |
| Divi (`_et_pb_show_title = off`) | **2** articoli pubblicati | nasconde il titolo dell'articolo |

Le restanti 268 righe di `st_hide_title_check_option` hanno valore nullo: il plugin
scrive la chiave su tutti i contenuti, ma la attiva su uno solo.

Nel nuovo sistema diventa **una impostazione per contenuto** nel CMS (`show_title`),
non due meccanismi separati.

## 5. OptinMonster — chiude R-13

`optin_monster_api` ha il nodo `api` vuoto e `connected` vuoto: **il plugin non è
collegato ad alcun account**. Nessuna campagna configurata;
`om_disable_all_campaigns` è presente su 42 contenuti ma sempre con valore vuoto.

Verificato anche a valle: l'HTML della home **non contiene alcun riferimento** a
OptinMonster.

**Conclusione: OptinMonster non produce nulla sul sito pubblico. Decade.** Non
esiste popup da riprodurre e non esiste difformità da dichiarare. La decisione
aperta della mappa plugin §6 si chiude qui, senza bisogno di una scelta dell'utente.

## 6. Slider Revolution

Un solo slider, `id = 1`, titolo «Slider home», alias `home`, tipo `standard`,
layout `fullwidth`, sorgente `gallery`, versione 6.5.19. **12 slide**, in
`wp_revslider_slides`. Le tabelle `_bkp` non si importano.

Si ricostruisce come **componente carosello proprio**, con i contenuti delle 12
slide importati come dati. Non si porta la libreria: `rs6.css` e `rs6.min.js` sono
caricati oggi su **tutte** le pagine per un solo carosello presente in una.

L'estrazione dei parametri di ogni slide — immagine, testo, tempi, transizioni —
avviene in Fase 1D; qui basta sapere che la struttura esiste ed è leggibile.

## 7. Ambiente di produzione — chiude MI-03

Acquisito dall'utente e verificato in sola lettura sulla pagina di ambiente
autorizzata (DR-037).

| Voce | Produzione | Istanza di riferimento |
|---|---|---|
| PHP | **7.4.33**, FPM/FastCGI | 8.2 |
| Database | **MySQL 5.6.51-91.0-log** | MariaDB 10.11 |
| Estensione DB | `mysqli` (`mysqlnd 7.4.33`) | `mysqli` |
| Sistema | Linux x86_64, hosting condiviso | container Debian |
| `memory_limit` | 256M | 256M |
| `max_execution_time` | 120 | 120 |
| `post_max_size` / `upload_max_filesize` | 100M / 100M | 100M / 100M |
| `max_input_vars` | 1000 | 1000 |
| `output_buffering` | 4096 | 4096 |
| `display_errors` | Off | Off |
| `zlib.output_compression` | Off | Off |
| `default_charset` | UTF-8 | UTF-8 |
| Fuso orario PHP | Europe/Rome | Europe/Rome |
| OPcache | attivo | attivo |

I limiti di runtime **coincidono**, perché derivano dallo stesso `.user.ini`
presente nel backup. La difformità resta su PHP e sul motore del database: è
registrata come rischio **R-16**.

### 7.1 Segnalazione di sicurezza — nuova

La pagina di ambiente è un **`phpinfo()` completo raggiungibile pubblicamente** su
un URL del sito in produzione, senza autenticazione. Espone percorsi assoluti del
server, opzioni di compilazione, elenco e versione di tutte le estensioni,
configurazione di sessione e variabili di ambiente del processo web. È una
superficie di ricognizione che non deve restare esposta.

Nessuno di quei valori è riportato in questo documento oltre a quanto serve alla
tabella di §7.

**Azione richiesta all'utente:** rimuovere il file dal sito in produzione.
Registrata come rischio **R-17** e trattata nell'handoff `HO-003`.

## 8. Altri rilievi minori, con effetto sulla parità

| # | Rilievo | Effetto |
|---|---|---|
| 8.1 | Un **articolo in evidenza** (`sticky_posts` contiene un ID) | Negli elenchi di articoli compare per primo, fuori dall'ordine cronologico. Lo schema deve prevedere `is_sticky` |
| 8.2 | `page_for_posts = 0`: **non esiste** una pagina archivio degli articoli | Gli articoli sono raggiungibili solo da `/category/news/` e dai collegamenti interni. Non va inventata una pagina «blog» |
| 8.3 | La pagina `/bacheca/` ha restrizioni di ruolo del plugin Members su 4 ruoli, ma **risponde 200 con contenuto completo** a un anonimo | La restrizione non è attiva sul contenuto. Va riprodotto ciò che si misura: pagina pubblica |
| 8.4 | `start_of_week = 1`, formato data `j F Y`, formato ora `G:i`, fuso `Europe/Rome` | Le date rese devono coincidere, compreso il nome del mese in italiano |
| 8.5 | `users_can_register = 0`, ruolo predefinito `subscriber` | Nessuna registrazione pubblica da riprodurre |
| 8.6 | Dimensioni immagine generate: 150, 300, 768, 1024 px di larghezza | Le dimensioni derivate vanno conservate: il contenuto le referenzia |
| 8.7 | `blogdescription` **vuota** | Produce separatori penzolanti in `og:site_name`. Riprodurre o correggere è una difformità da dichiarare |
| 8.8 | Commenti: 0 in tutto il sito, chiusi di default | Nessun modello commenti nello schema |

## 9. Cosa questa wave cambia nelle fasi successive

| Wave | Cambiamento |
|---|---|
| `1B-W2` | Servono: visibilità per voce di menu, `show_title` per contenuto, `is_sticky`, template SEO come impostazioni globali, redirect come dati |
| `1B-W3` | Il mapping SEO non è record→record: è **template→regola** |
| `1B-W5` | La perdita di `<h1>` e description sulle pagine Divi è un dato da decidere, non da subire |
| `1B-W6` | Il confronto visivo si fa **da anonimo**, su 41 voci di menu; la verifica SEO si fa sul **reso**, non sul database |
| `1D` | 12 slide, 4 documenti scaricabili, 64 voci di menu con visibilità, 169 + 4 redirect da importare come dati |
