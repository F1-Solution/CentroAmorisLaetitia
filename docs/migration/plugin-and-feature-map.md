# Mappa plugin → funzionalità → destinazione — Fase 1A, wave 1A-W4

Per ciascun plugin presente nella sorgente: cosa produce **sul sito pubblico**, cosa
va ricostruito per la parità di Fase 1, e cosa decade o si rimanda.

Base: `wp_options.active_plugins` e `wp-content/plugins/`, non i documenti storici.

**Legenda destinazione**

| Sigla | Significato |
|---|---|
| **P1** | Necessario alla parità di Fase 1: va ricostruito ora |
| **P1-CMS** | Va ricostruito ora come funzione del CMS |
| **POST** | Rimandato a dopo il gate, nella fase gestionale |
| **DECADE** | Non si riproduce: sostituito dalla piattaforma o non più necessario |
| **RESIDUO** | Plugin disattivato: nessun effetto pubblico oggi |

---

## 1. Quadro sintetico

| Plugin | Attivo | Effetto pubblico | Destinazione |
|---|---|---|---|
| All in One SEO | sì | meta, sitemap, robots, canonical, Open Graph | **P1 / P1-CMS** |
| BackWPup | sì | nessuno | **DECADE** |
| Category Posts Widget | sì | elenchi di articoli per categoria | **P1** |
| Cookie Notice & Compliance | sì | banner cookie | **P1** |
| Download Manager | sì | 4 documenti, endpoint `/download/` | **P1** + **POST** |
| Duplicate Post | sì | nessuno | **P1-CMS** (comodità redazionale) |
| MonsterInsights (Google Analytics) | sì | GA4 + Universal Analytics legacy | **P1** (solo GA4) |
| Members | sì | ruoli e capability | **POST** |
| Nav Menu Roles | sì | voci di menu per ruolo | **POST** |
| OptinMonster | sì | popup e lead capture | **da decidere** |
| Slider Revolution | sì | 1 slider, 12 slide | **P1** |
| SHK Hide Title | sì | nasconde il titolo su singole pagine | **P1-CMS** |
| WP Mail SMTP | sì | invio email | **POST** |
| WPForms | sì | 25 form, 425 compilazioni | **P1** (resa) + **POST** (form builder) |
| WPForms Mailchimp | sì | iscrizione a liste | **POST** |
| WPForms PayPal Standard | sì | pagamenti nei form | **POST** |
| WP Customer Area | **no** | **nessuno** | **RESIDUO** |
| WP Event Manager | **no** | **nessuno** | **RESIDUO** |

---

## 2. Dettaglio dei plugin che incidono sulla Fase 1

### 2.1 All in One SEO — **P1 / P1-CMS**

Genera `<title>`, meta description, canonical, Open Graph, `robots.txt`, e l'indice
sitemap con le sue figlie.

Dato decisivo: su 282 righe in `wp_aioseo_posts`, solo **2** hanno un title
personalizzato, **0** una description, **0** un'immagine Open Graph. **Il sito non
ha metadati SEO scritti a mano**: tutto nasce dai template del plugin.

La migrazione quindi non copia record: **riproduce le regole di generazione**, e
consente al CMS di sovrascriverle per singolo contenuto (requisito RC-04).

Da ricostruire: template di title e description per tipo di contenuto; canonical;
Open Graph; `robots.txt` configurabile; indice sitemap con le stesse sezioni
(pagine, articoli, categorie) e **senza** allegati, com'è oggi; redirect `302` da
`/wp-sitemap.xml` a `/sitemap.xml` non necessario nel nuovo sito.

I template vanno estratti da `wp_options.aioseo_options` in **Fase 1B**.

### 2.2 Slider Revolution — **P1**

1 slider con 12 slide, più tabelle `_bkp` di backup. Carica `rs6.css` e
`rs6.min.js` su tutte le pagine.

Il contenuto va estratto dalle tabelle `wp_revslider_sliders` e
`wp_revslider_slides` (configurazione JSON) e ricostruito come componente React.
Non esiste alcuna ragione di portare la libreria: 12 slide sono un carosello.

Le tabelle `_bkp` **non** si importano.

### 2.3 Download Manager — **P1** e **POST**

4 documenti pubblicati (`wpdmpro`), categoria `moduli-consulenze`, endpoint
`/download/<slug>/` con **301** dalla pagina del documento.

I quattro moduli sono quelli citati dai documenti storici: consulenze, consulenze
per minori, consulenze a distanza, consulenze a distanza per minori.

**P1:** i 4 documenti devono restare scaricabili agli stessi URL, con gli stessi
301. **POST:** statistiche di download, permessi per ruolo e area riservata
appartengono alla fase gestionale. `wp_ahm_download_stats` contiene 1 sola riga:
nessuno storico significativo da preservare.

### 2.4 WPForms — **P1** (resa) e **POST** (costruzione)

25 form pubblicati, 3 nel cestino, **425 compilazioni** con 3.710 valori di campo.

Sul sito pubblico i form compaiono nelle pagine di registrazione ai corsi e nei
contatti. Per la Fase 1 conta che **la pagina si presenti identica**, form
compreso, non che il form sia costruibile dall'interfaccia: il form builder è un
requisito esplicito della fase gestionale (RF-03…RF-06).

Va deciso in **Fase 1B** come si comportano i form in Fase 1: se restano statici e
non inviano, se inviano a un endpoint minimale, o se la pagina li rende inattivi.
Un form che appare funzionante ma non recapita è peggio di un form assente.

Le 425 compilazioni vanno importate per decisione dell'utente (DR-025): sono dati
personali e la relativa valutazione privacy resta da fare.

### 2.5 MonsterInsights / Google Analytics — **P1 parziale**

Carica **GA4** (`G-XWJE7L8WWX`) e, accanto, **Universal Analytics**, dismesso da
tempo. Si riporta solo GA4, dietro consenso cookie. UA è codice morto.

### 2.6 Cookie Notice — **P1**

Banner servito da `cdn.hu-manity.co`. Va sostituito con un componente proprio, senza
dipendenza da CDN esterni, e deve **precedere** l'attivazione di GA4.

La conformità dell'informativa richiede **validazione legale**: non è una
dichiarazione che possa essere fatta qui.

### 2.7 Category Posts Widget — **P1**

Produce elenchi di articoli per categoria (shortcode `catposts`). Sono 2 categorie e
29 articoli: si ricostruisce come componente, non come plugin.

### 2.8 SHK Hide Title — **P1-CMS**

Nasconde il titolo su singole pagine. Diventa un'impostazione per contenuto nel CMS.
Va rilevato in Fase 1B su quali pagine è attivo, altrimenti compariranno titoli che
oggi non si vedono — una difformità visiva silenziosa e facile da non notare.

### 2.9 Duplicate Post — **P1-CMS**

Duplicazione di un contenuto. Funzione redazionale banale da offrire nel CMS.

---

## 3. Plugin rimandati alla fase gestionale

| Plugin | Requisito corrispondente | Nota |
|---|---|---|
| Members | RU-01, RU-02 | ruoli multipli per persona |
| Nav Menu Roles | RU-01 | voci di menu condizionate al ruolo. **Da verificare in 1B** se oggi qualche voce è nascosta agli anonimi: se sì, incide sulla parità del menu |
| WP Mail SMTP | RM-01…RM-06 | 187 log di invio a database |
| WPForms Mailchimp | RM-01, RM-02 | la newsletter diventa interna |
| WPForms PayPal Standard | RG-01…RG-04 | pagamenti |

---

## 4. Plugin che decadono

| Plugin | Perché |
|---|---|
| BackWPup | il backup del nuovo sistema è responsabilità dell'infrastruttura |
| Divi (tema) | sostituito dai componenti React |
| WP Customer Area | disattivato, vedi §5 |
| WP Event Manager | disattivato, vedi §5 |

---

## 5. Residui di plugin disattivati

Entrambi risultano **installati ma non attivi**. I documenti storici li davano per
attivi: non lo sono, e questo cambia l'ambito.

| Plugin | Residui a database | Trattamento |
|---|---|---|
| WP Customer Area | 4 `cuar_private_file`, 9 `cuar_log_event`, 1 menu vuoto, `wp-content/customer-area/` | **Non riprodurre.** L'area riservata non funziona sul sito attuale: ricostruirla non è parità, è una funzione nuova, e come tale appartiene alla fase gestionale |
| WP Event Manager | 1 `event_listing`, 20 + 12 termini **tutti a 0 contenuti** | **Non riprodurre.** I termini sono le tassonomie di default del plugin, mai usate |

I 4 `cuar_private_file` vanno comunque censiti: se contengono documenti che qualcuno
si aspetta di trovare, la decisione su dove collocarli è dell'utente — vedi
`missing-inputs.md`.

---

## 6. Decisione aperta

### OptinMonster — popup e lead capture

Plugin attivo, ma non è stato rilevato alcun popup nelle pagine campione esaminate.
Prima di decidere serve accertare in **Fase 1B** se produca qualcosa di visibile.

- Se **non** produce nulla: decade, senza altre conseguenze.
- Se produce un popup: è un elemento visibile e rientra nella parità, quindi va
  ricostruito o **esplicitamente escluso dall'utente**.

Un popup escluso senza decisione esplicita è una difformità non dichiarata, ed è
esattamente ciò che il gate di Fase 1 vieta.
