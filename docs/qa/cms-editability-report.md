# Rapporto del collaudo redazionale — Fase 1G

Rapporto della skill `cms-editability-qa` per la Fase 1G (condizione 7 del gate), scritto
nella `1G-W10` (T4) il 2026-11-02. Riassume il collaudo delle wave `1G-W8`, `1G-W9` e
`1G-W10`. I rapporti di dettaglio restano la fonte:
[`collaudo-1G-W8.md`](collaudo-1G-W8.md), [`collaudo-1G-W9.md`](collaudo-1G-W9.md), i rapporti
dell'agente e la matrice [`editability-matrix.csv`](editability-matrix.csv).

## 1. Verdetto

**VERIFICATA E APPROVATA** dall'utente il 2026-11-02 (DR-347, §12).

- Tutti i 18 tipi di contenuto della matrice sono collaudati. Le 109 righe «modificabile» hanno
  tutte un esito.
- Nessun difetto bloccante o maggiore è aperto. Due minori sono approvati e rinviati alla Fase
  1F (W9-N7, W9-N8); tutti gli altri sono risolti.
- I residui del collaudo sono rimossi (T6, §10). La CI remota sul commit `7cbf965` è verde
  (run 41395242290, T7).

Il verdetto si legge con il limite di §2.2: per i compiti eseguiti dall'agente il collaudo
attesta che la funzione riesce, non che la redazione ci riesce da sola.

## 2. Ambiente e metodo

### 2.1 Ambiente

- Collaudo separato dallo sviluppo (DR-266): database `amoris_collaudo` copiato da quello di
  sviluppo, bucket propri, copia di lavoro in `C:\work\amoris-collaudo`.
- Sito 3300, area 3301, API 3302.
- Commit collaudati:
  - `e61d20b` nella `1G-W8`;
  - `aaedbf5` e poi `ec640c2` nella `1G-W9`;
  - `ec640c2` nella T2 della `1G-W10`.
- Account: solo sintetici `@example.invalid`, mai account di persone reali. Gli account
  copiati dallo sviluppo sono disattivati e senza password utilizzabile.
- Ogni scrittura è passata dall'interfaccia dell'area. Il database è stato solo letto, con
  `SELECT`, per le verifiche. Fanno eccezione:
  - le prove di rifiuto chiamate all'API con la sessione dell'area (`collaudo-1G-W9.md` §1);
  - la 1E-19, che salva senza modifiche tramite l'API amministrativa.

### 2.2 Chi ha eseguito i compiti (DR-290)

- **L'utente** ha eseguito 1G-1, 1G-2 e 1G-3 (HO-036…HO-038).
- **L'agente**, con Playwright e con i suoi account (DR-291), ha eseguito:
  - gli altri compiti della `1G-W8`;
  - le ripetizioni della `1G-W9`;
  - le prove della T2 della `1G-W10`.

**Indebolimento accettato con DR-290.** Per i compiti dell'agente la condizione 7 attesta
che la funzione riesce dall'interfaccia, non che una persona della redazione ci riesce da
sola. I tempi dell'agente sono quelli di uno script, quindi un limite inferiore.

## 3. Copertura

### 3.1 Per tipo di contenuto

L'inventario della sorgente (`docs/migration/content-inventory.csv`) ha 11 `post_type`.

| `post_type` della sorgente | Tipo nella matrice | Stato |
|---|---|---|
| `page` | pagina, pagina e notizia | collaudato |
| `post` (pubblicati e bozze; l'`auto-draft` si scarta) | notizia, pagina e notizia | collaudato, bozze importate comprese |
| `attachment` | media | collaudato |
| `wpdmpro` | documento | collaudato |
| `wpforms` (pubblicati; i 3 nel cestino si scartano) | modulo | volutamente non modificabile in Fase 1 (DR-218) |
| `cuar_private_file` | documento riservato | fuori perimetro: area riservata futura (DR-033, DR-218) |
| `et_pb_layout`, `cuar_log_event`, `event_listing`, `wp_navigation`, `wp_template` | uno ciascuno | fuori perimetro: non importati (`wp-to-postgres-mapping.md` §2, Fase 1B) |

Oltre all'inventario, la matrice collauda ciò che il CMS aggiunge: categorie, menu, redirect,
caroselli, impostazioni del sito, modelli SEO, account e registro.

| Tipo | Righe | Modificabili, con esito | Volutamente non modificabili | Calcolate |
|---|---|---|---|---|
| pagina e notizia | 49 | 41 | 5 | 3 |
| pagina | 3 | 3 | 0 | 0 |
| notizia | 5 | 4 | 0 | 1 |
| categoria | 7 | 6 | 0 | 1 |
| menu | 2 | 0 | 2 | 0 |
| voce di menu | 8 | 8 | 0 | 0 |
| redirect | 9 | 6 | 1 | 2 |
| media | 9 | 7 | 1 | 1 |
| documento | 11 | 6 | 2 | 3 |
| carosello | 7 | 4 | 2 | 1 |
| slide | 3 | 2 | 1 | 0 |
| modulo | 2 | 0 | 2 | 0 |
| barra laterale | 1 | 0 | 1 | 0 |
| impostazioni del sito | 14 | 11 | 3 | 0 |
| modelli SEO | 5 | 5 | 0 | 0 |
| account | 7 | 6 | 1 | 0 |
| ruolo | 2 | 0 | 2 | 0 |
| registro | 1 | 0 | 0 | 1 |
| tipi fuori perimetro | 6 | 0 | 0 | 0 |
| **Totale** | **151** | **109** | **23** | **13** |

Controllo della matrice del 2026-11-01, con uno script fuori da Git:
- colonne della skill presenti;
- nessuna cella obbligatoria vuota;
- nessuna riga «modificabile» senza esito;
- 11 tipi della sorgente su 11 associati.

### 3.2 Per ruolo

Due ruoli (DR-220), un solo ruolo attivo per volta (DR-050, DR-067).

| Ruolo | Righe | Caso positivo | Caso negativo |
|---|---|---|---|
| Redazione | 92 | contenuti, blocchi, media, menu, SEO, redirect, documenti, caroselli: compiti 1G-1…1G-15 e T2 | «Persone e permessi» e registro non raggiungibili da menu, indirizzo né API (1G-17: rinvio a «Pagine», API 403 senza dati) |
| Amministrazione | 17 | impostazioni del sito, account, registro: 1G-9, 1G-16 | senza accesso, l'API risponde 401 (1G-17) |

Senza ruolo («nessuno»): 42 righe, cioè i campi volutamente non modificabili, quelli calcolati
e i tipi fuori perimetro.

## 4. Compiti 1G-1…1G-17

| Compito | Handoff | Chi | Esito nella `1G-W8` | Ripetizione | Tempo |
|---|---|---|---|---|---|
| 1G-1 creare, pubblicare e mettere a menu una pagina | HO-036 | utente; agente nella W9 | riuscito con difficoltà (W8-01, W8-04) | `1G-W9`: riuscito | utente 2 min; agente 32 s |
| 1G-2 testo e immagine di una pagina Gutenberg | HO-037 | utente; agente nella W9 | riuscito | `1G-W9`: con difficoltà (W9-N2); su `ec640c2` riuscito senza difficoltà | utente circa 2 min; agente 16 s |
| 1G-3 testo e immagine di una pagina Divi convertita | HO-038 | utente | riuscito (dichiarato) | — | 2 min, più 10 di prove accessorie |
| 1G-4 contenuto con un blocco di riserva | HO-039 | agente | riuscito; avviso capito a metà (W8-21) | avviso riscritto nella `1G-W9` | 9 s |
| 1G-5 sostituire un'immagine e il testo alternativo | HO-040 | agente | riuscito con difficoltà (W8-10, W8-11) | `1G-W9`: riuscito | 12 s, più 5; W9 16 s |
| 1G-6 ordine di due voci di menu | HO-041 | agente | riuscito | — | 6 s |
| 1G-7 titolo SEO e il suo effetto | HO-042 | agente | riuscito | — | 8 s |
| 1G-8 redirect da un vecchio indirizzo | HO-043 | agente | riuscito con difficoltà (W8-17) | — | 13 s |
| 1G-9 chi ha modificato e quando | HO-044 | agente | riuscito | — | 3 s; 8 s con due persone |
| 1G-10 la pagina pubblica corrisponde all'anteprima | HO-045 | agente | riuscito con difficoltà (W8-13): uguale in 9 pubblicazioni su 9 | `1G-W10` T2: 106 contenuti su 106 | 66 s |
| 1G-11 slug e genitore con redirect | HO-046 | agente | riuscito | — | 20 s |
| 1G-12 estratto, immagine in evidenza e categorie | HO-047 | agente | riuscito | — | 39 s |
| 1G-13 eliminare un contenuto | HO-048 | agente | riuscito con difficoltà (W8-24) | `1G-W9`: riuscito | 32 s; W9 circa 24 s |
| 1G-14 file non ammesso o troppo grande | HO-049 | agente | riuscito | — | 77 s |
| 1G-15 documento e carosello | HO-050 | agente | riuscito | a vista nella `1G-W9` (W8-26) | 24 s |
| 1G-16 account dell'amministrazione | HO-051 | agente | A e B riuscite, C con difficoltà (W8-27, W8-28) | `1G-W9`: riuscito | W9: 39 s, 20 s, 119 s (circa 65 di ritardo voluto) |
| 1G-17 la redazione non raggiunge persone e registro | HO-052 | agente | riuscito | — | 11 s |

Nessun compito supera i 10 minuti di DR-221. Ogni «difficoltà» è diventata un difetto (§7),
oggi risolto.

## 5. Criteri della 1D (1D-28…1D-37)

Ognuno è stato eseguito dall'interfaccia almeno una volta, con l'esito nella matrice.

| Criterio | Righe della matrice | Esito |
|---|---|---|
| 1D-28 creare, modificare, pubblicare e ritirare pagina e articolo | pagina e notizia › titolo, stato; notizia › estratto, categorie | riuscito (1G-1, 1G-12) |
| 1D-29 testo e immagini dentro i blocchi | blocco «Testo», blocco «Immagine» | riuscito (1G-2, 1G-3, 1G-5) |
| 1D-30 aggiungere, spostare, eliminare blocchi | ordine e annidamento, eliminare un blocco | riuscito (1G-1, 1G-10) |
| 1D-31 media | media › caricare, sostituire, testo alternativo, didascalia, eliminare | riuscito (1G-5, 1G-14) |
| 1D-32 menu | voce di menu › tutte le righe | riuscito (1G-1, 1G-6, 1G-13, T2 della `1G-W10`) |
| 1D-33 SEO e modelli globali | righe SEO per contenuto e «SEO (template)» | riuscito (1G-7) |
| 1D-34 redirect | redirect › tutte le righe | riuscito (1G-8, T2 della `1G-W10`) |
| 1D-35 impostazioni globali | impostazioni del sito | riuscito (1G-16) |
| 1D-36 andata e ritorno | blocco di riserva; 1E-19 | riuscito: frammenti identici (1G-4); 1E-19 5 su 5 su `ec640c2` (T2) |
| 1D-37 una riga di registro per operazione | registro › consultazione | riuscito (1G-9, 1G-11…1G-16), dopo W8-16, W8-20, W8-29…W8-31 |

## 6. Prove della T2 della `1G-W10` (2026-11-01, collaudo su `ec640c2`)

| Prova | Esito |
|---|---|
| «Apri in una scheda nuova» e «Classi CSS» di una voce di menu | riuscita: valori sul sito e nel pannello dopo una ricarica; ripristinati dall'area |
| «Che cosa copre» di un redirect | riuscita: un indirizzo sotto passa da 404 a 301 portando il resto del percorso; ripristinato |
| Pannelli di «Media e testo» ed «Elenco di contenuti» (DR-342), su una pagina sintetica in bozza eliminata dall'area | riuscita: numeri fuori intervallo rifiutati con il messaggio approvato; valori conservati dopo una ricarica; anteprima giusta |
| Bozze importate (DR-063, DR-064) | visibili col filtro «Bozze»; si aprono senza creare copie di lavoro né cambiare date; da anonimo 404 |
| Anteprima e sito (1G-10) | identici in 106 contenuti pubblicati su 106 |
| 1E-19 | 5 su 5 identici: home, pagine senza titolo, modulo e uno per tipo. È il campione dello script dalla `1G-W7`; il criterio dice 4 su 4 |

La T2 ha trovato tre difetti bassi nuovi, W10-N1…W10-N3, corretti nella T2b (§7).

## 7. Difetti

Formato della skill. Gravità: alta = bloccante, media = maggiore, bassa = minore. Nella
colonna «Dove si riproduce» c'è la schermata in cui il difetto si vede; i passi completi sono
negli handoff e nei rapporti citati. La data è quella dello stato attuale.

| Id | Descrizione | Dove si riproduce | Ruolo | Gravità | Evidenza | Stato | Data |
|---|---|---|---|---|---|---|---|
| W8-01 | Le miniature delle immagini non compaiono: si sceglie solo dal nome del file | editor › blocco Immagine › «Scegli un media» | redazione | maggiore | image-media-w9.test.tsx; sliders.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-02 | La spunta occupa troppo spazio in altezza | «Scegli un media» › spunta «Immagine puramente decorativa (nessun testo alternativo)» | redazione | minore | collaudo-1G-W8.md §2 | chiuso | 2026-10-28 |
| W8-03 | Pubblicando o ritirando senza bozza in sospeso, l'editor chiede di scartare una bozza che non esiste: il registro annota un fallimento (404) | editor › «Pubblica» e «Ritira» | redazione | minore | content-working-copy.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-04 | Se si lascia il contenuto che l'elenco mostra per primo, il salvataggio è rifiutato con un messaggio tecnico in inglese: «La richiesta non è valida. /contentId: Invalid UUID» | Corredo › Menu › «Aggiungi una voce» › «Contenuto» (e «Categoria») | redazione | maggiore | menu-manager.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-05 | L'elenco mostra solo i 100 contenuti modificati più di recente: nel collaudo ce ne sono 110, e i 10 meno recenti non si possono mettere a menu | Corredo › Menu › «Aggiungi una voce» › «Contenuto» | redazione | minore | menu-manager.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-06 | Per «sostituire un'immagine» la redazione ha aggiunto un blocco nuovo e lasciato il vecchio: il blocco non permette di scegliere un altro file | editor › blocco Immagine | redazione | maggiore | image-media-w9.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-07 | Il confronto per impronta dell'HTML pubblico risulta `False` anche senza alcun salvataggio | HO-038 §5 «Andata e ritorno» | — (strumento del collaudo) | minore | confrontoHtml.ts; collaudo-1G-W8.md §2 | risolto | 2026-10-29 |
| W8-08 | Il segnaposto nuovo non risultava salvato (dichiarato dall'utente) | Mappa › «Aggiungi un segnaposto» | redazione | — | collaudo-1G-W8.md §2 | chiuso | 2026-10-28 |
| W8-09 | Risposte attese segnate come errori rossi in console: `GET /auth/me` 401 sulla schermata di accesso; `GET /contents/:id/draft` 404 a ogni apertura dell'editor senza copia di lavoro; `GET /seo/contents/:id` 404 nella scheda SEO senza sovrascrittura. | area, console | tutti | minore | absenceNotError.test.ts; console-quiet-w9.test.tsx; console-pulita.spec.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-10 | Testo alternativo, titolo e didascalia cambiati in Media non arrivano alle pagine che già usano l'immagine: `alt` resta quello del blocco, la didascalia non compare. | Media › «Testo alternativo», «Titolo», «Didascalia»; blocco Immagine | redazione | maggiore | image-media-texts.test.tsx; image-media-w9.test.tsx; imported-image-caption.integration.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-11 | La didascalia (`figcaption`) ha altezza 0: il testo esce sotto l'immagine, tagliato e sovrapposto, a ogni larghezza | sito, blocco Immagine con didascalia fuori da una riga Divi | redazione | maggiore | blocksCss.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-12 | Il titolo dell'immagine, sia del blocco sia del media, non compare nel sorgente della pagina | blocco Immagine › «Titolo» | redazione | minore | image-media-texts.test.tsx; media-library.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-13 | Su un contenuto pubblicato «Salva» scrive subito il contenuto letto dal sito, senza anteprima né «Pubblica»; lo dice solo «Contenuto salvato.». | editor › «Salva»; scheda «Pagina» › «Salva il layout» | redazione | maggiore | content-editor.test.tsx; content-working-copy.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-14 | «Solo a chi ha fatto accesso» e «Solo ad alcuni ruoli» nascondono la voce a tutti, anche a chi è entrato in Redazione. | Menu › voce › «Chi vede questa voce» | redazione | minore | menu-visibility-help.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-15 | Le voci che usano il titolo del contenuto (etichetta vuota) hanno pulsanti senza nome per chi usa un lettore di schermo: «Prendi «» per spostarlo», «Sposta su:», «Annida:», «Elimina:» | Menu › albero delle voci | redazione | minore | menu-manager.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-16 | Il primo spostamento rinumera tutte le voci, perché le posizioni importate sono sparse (1, 2, 3, 9, 11, …). | Menu › «Sposta su», «Annida»; Registro | amministrazione | minore | menu-tree.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-17 | Nessun messaggio di riuscita. | SEO e indirizzi › «Redirect» › «Crea il redirect» e «Salva il redirect»; «Template globali» › «Salva il template» | redazione | minore | success-notices.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-18 | Il contatore degli usi resta 0 dopo ogni risposta 301, e così l'ultimo utilizzo | Redirect › colonna «Usi» | redazione | minore | publicW9.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-19 | Eliminazione riuscita senza nessun messaggio: il pannello si chiude e basta | Media › «Elimina» › «Elimina definitivamente» | redazione | minore | success-notices.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-20 | Alcune righe nominano solo il tipo: «Media» (caricamento, eliminazione riuscita), «Reindirizzamento» senza indirizzo, «Modello SEO» senza ambito, «Voce di menu» per le voci senza etichetta. | Impostazioni › Registro › colonna «Oggetto» | amministrazione | minore | auditW9.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-21 | L'avviso «Questo blocco non è stato convertito, modificarlo può alterare la resa.» usa parole tecniche. | editor › blocco «HTML (riserva)» | redazione | minore | html-fallback-editor.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-22 | Le discendenti non sono proposte come genitore, e nulla lo spiega. | editor › «Indirizzo» › «Pagina genitore»; Categorie › «Modifica categoria» › «Categoria genitrice» | redazione | minore | content-address.test.tsx; categoriesComplete.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-23 | Nessun messaggio di riuscita: la finestra si chiude e l'elenco si aggiorna. | Categorie (crea, modifica, elimina); Menu (aggiungi, elimina voce); Documenti (crea, elimina); Persone e permessi (crea, modifica, disattiva, riattiva; proprio indirizzo) | amministrazione | minore | success-notices.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-24 | La pagina iniziale non si riconosce: il titolo è vuoto (dalla sorgente), l'elenco mostra una riga con il solo «/home/», e né l'elenco né l'intestazione dell'editor dicono «pagina iniziale». | Pagine › elenco ed editor | redazione | maggiore | contentListHome.test.ts; content-list-home.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-25 | Dopo il caricamento di un PDF o di un MP4 non compare alcuna conferma sotto il nome del file; le immagini dicono «N dimensioni derivate generate.» | Media › caricamento di PDF e MP4 | redazione | minore | success-notices.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-26 | Tre titoli di slide importati contengono HTML (`<div align="center">…<br>…<i class="fa-heart"></i></div>`). | sito, blocco «Presentazione a scorrimento»; Caroselli › «Titolo» | redazione | maggiore | slide-title.test.ts; dynamic-blocks.test.tsx; publicW9.test.ts; sliders.test.tsx; blocksCss.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-27 | Nessun comando per cambiare la propria password: il menu ha solo «Disconnetti», e la pagina `/admin/password` si raggiunge solo scrivendone l'indirizzo, o quando il cambio è obbligato. | area, menu della persona | amministrazione | maggiore | user-menu-actions.test.tsx; password.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-28 | Togliendosi un ruolo, la modifica è salvata e la sessione si chiude (scelta voluta), ma l'area mostra l'errore «Non è stato possibile — Serve un accesso valido.» senza spiegare che bisogna rientrare | Persone e permessi › «Ruoli» sul proprio account | amministrazione | maggiore | accounts-settings-w9.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-29 | Per un contenuto eliminato, le righe precedenti (creato, modificato, pubblicato, indirizzo) mostrano «contenuto non più presente»: il titolo resta solo sulla riga «Ha eliminato» | Registro › colonna «Oggetto» | amministrazione | minore | auditW9.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-30 | Una password attuale errata nel cambio del proprio nome o dei propri ruoli lascia anche la riga «Cambio della password — Non riuscita», che fa pensare a un tentativo di cambio password | Registro | amministrazione | minore | auditW9.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-31 | I redirect nati da un cambio di indirizzo o di categoria non hanno una riga propria: ne restano solo i conteggi nel dettaglio di «Ha cambiato l'indirizzo», che l'elenco non mostra. | Registro | amministrazione | minore | auditW9.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-32 | Prima del rinvio la schermata chiama `GET /accounts` e `GET /audit…`, che rispondono 403 o 401 in console. | area › indirizzi di Impostazioni aperti da Redazione o senza accesso | amministrazione | minore | console-quiet-w9.test.tsx; console-quiet-pages-w9.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-33 | I blocchi «Documento» e «Media e testo» si chiamano «documento» e «media e testo», senza il titolo del documento: con due documenti nella pagina non si distinguono | editor › albero dei blocchi | redazione | minore | tree.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-34 | Un'immagine di condivisione scelta non si toglie più: nessun comando la rimuove. | editor › SEO › «Scegli immagine di condivisione» | redazione | maggiore | image-media-w9.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-35 | Per l'immagine di condivisione «Usa questo media» resta spento finché non si scrive un «Testo alternativo» («Obbligatorio…») o si spunta «decorativa». | editor › SEO › «Scegli un media» | redazione | minore | image-media-w9.test.tsx; media-picker.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-36 | Con `noindex` nel modello «Pagine», tutte le pagine dicono `noindex` ma restano in `/sitemap.xml`. | SEO e indirizzi › modelli › «Direttive robots» | redazione | minore | publicW9.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-37 | Un'impostazione partita `null` e poi svuotata dall'area salva `""`, e lo stato di partenza non si ottiene più dall'interfaccia. | Impostazioni del sito › campi nati vuoti (`null`) | amministrazione | minore | accounts-settings-w9.test.tsx; settingsReferences.test.ts; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W8-38 | I due campi chiedono l'identificativo interno di un media o di un contenuto, senza aiuto né scelta da elenco. | Impostazioni del sito › «Logo del sito», «Pagina iniziale» | amministrazione | maggiore | settingsReferences.test.ts; accounts-settings-w9.test.tsx; contentHomeWithdrawal.test.ts; content-editor.test.tsx; collaudo-1G-W8.md §2; collaudo-1G-W9.md §3 | risolto | 2026-10-30 |
| W9-N1 | L'ispettore mostrava il nome interno del tipo e nessun pannello: non si sceglievano l'immagine, le categorie né il numero di articoli | editor › «Media e testo» ed «Elenco di contenuti» | redazione | maggiore | collaudo-1G-W9.md §5, §9 | risolto | 2026-10-30 |
| W9-N2 | Mentre si scrive, una parte dei tasti premuti va persa: fino a 6 «Canc» su 22 senza pausa, 1 su 22 con 50 ms fra un tasto e l'altro, in una prova 10 «Backspace» su 10. | editor › blocco «Testo» | redazione | maggiore | collaudo-1G-W9.md §5, §9 | risolto | 2026-10-31 |
| W9-N3 | La pagina iniziale, che non ha titolo, compare come opzione vuota o come «(/home/)». | Menu › «Aggiungi una voce» › «Contenuto»; Impostazioni › «Pagina iniziale» | redazione | minore | collaudo-1G-W9.md §5, §9 | risolto | 2026-10-31 |
| W9-N4 | Refuso: «Si puo' correggere.» invece di «Si può correggere.» | Pagine › «Nuova pagina» › aiuto di «Indirizzo» | redazione | minore | collaudo-1G-W9.md §5, §9 | risolto | 2026-10-31 |
| W9-N5 | Scelta e rimozione non danno messaggi e cambiano subito il sito, senza che il pannello lo dica | editor › «Immagine in evidenza» | redazione | minore | collaudo-1G-W9.md §5, §9 | risolto | 2026-10-31 |
| W9-N6 | Un blocco Immagine che usa il testo alternativo di Media si chiama solo «Immagine — immagine»: due immagini così non si distinguono | editor › albero dei blocchi | redazione | minore | collaudo-1G-W9.md §5, §9 | risolto | 2026-10-31 |
| W9-N7 | Su una rete lenta due salvataggi della copia di lavoro possono arrivare in ordine inverso: resta la copia più vecchia mentre lo schermo dice «salvata». | editor › copia di lavoro | redazione | minore | collaudo-1G-W9.md §5, §9 | approvato (rinviato alla 1F, DR-330) | 2026-10-30 |
| W9-N8 | «Ctrl+Home» premuto pochi millisecondi dopo il clic nel testo a volte non sposta il cursore: i «Canc» seguenti cadono in fondo al paragrafo e non tolgono nulla. | editor › blocco «Testo» | redazione | minore | collaudo-1G-W9.md §5, §9 | approvato (rinviato alla 1F, DR-336) | 2026-10-31 |
| W10-N1 | Nell'albero dei blocchi «Elenco di contenuti» si chiamava solo «elenco di contenuti», senza categorie né numero: due elenchi nella stessa pagina non si distinguevano. | editor › albero dei blocchi | redazione | minore | tree.test.ts; content-editor.test.tsx; giornale 12-pannelli della T2 | risolto nella T2b (DR-345, DR-346: «Senza categoria · 3 notizie») | 2026-11-02 |
| W10-N2 | Per le due bozze importate a percorso provvisorio, la scheda «Indirizzo» mostrava un «Indirizzo risultante» calcolato da slug e genitore, non il percorso attuale. | editor di una bozza importata › scheda «Indirizzo» | redazione | minore | content-address.test.tsx; giornale 13-bozze della T2 | risolto nella T2b (DR-345) | 2026-11-02 |
| W10-N3 | L'intestazione dell'editor di un contenuto senza titolo diceva «Contenuto» invece di «Senza titolo»; nell'elenco un titolo di soli spazi restava invisibile. | editor della bozza senza titolo; elenco dei contenuti | redazione | minore | content-editor.test.tsx; content-list-home.test.tsx | risolto nella T2b (DR-345, DR-331) | 2026-11-02 |

Riepilogo: 49 difetti.
- 45 risolti.
- 2 chiusi senza correzione: W8-02, che l'utente non riscontra più, e W8-08, che non era un
  difetto.
- 2 approvati e rinviati alla 1F: W9-N7 (DR-330) e W9-N8 (DR-336).
- 0 aperti.

I difetti W10-N1…W10-N3 sono provati da prove automatiche che fallivano prima della
correzione. Non sono stati ripetuti sul collaudo, che resta su `ec640c2`.

## 8. Campi volutamente non modificabili

Elenco di DR-218, con DR-281 e DR-282, ciascuno con la sua riga nella matrice
(`editabile_atteso` = «non modificabile in Fase 1»):
- revisioni e ripristino;
- programmazione della pubblicazione;
- contenuti privati o protetti da password, file privati;
- configurazione dei moduli e compilazioni ricevute (la lettura arriva nella 1F, DR-310);
- widget della barra laterale;
- ruoli oltre i due e permessi di un ruolo;
- etichetta del menu e nuovi menu;
- collegamento delle slide;
- nome, impostazioni, creazione ed eliminazione dei caroselli;
- slug dei documenti;
- conteggio dei download;
- inserimento di blocchi «Video», «Mappa» e «Modulo»; configurazione del «Modulo»;
- `robots.txt`, sitemap, impostazioni riservate e nuove chiavi delle impostazioni;
- eliminazione dei redirect, che si disattivano.

## 9. Contenuto scritto nel codice del sito

Elenco completo in [`contenuto-nel-codice.md`](contenuto-nel-codice.md): 79 voci in 17 file.
- 11 voci sono modificabili, perché vengono da un dato o da un'impostazione.
- 68 non lo sono, ciascuna con il motivo e la decisione che la copre (DR-270…DR-277,
  DR-284, DR-307, DR-311).

Il 2026-11-01 (T3) sono stati esaminati i file del sito cambiati dopo `0dd1efb`. C'è una sola
voce nuova, il cuore delle slide, e nessun difetto.

## 10. Residui e loro rimozione

Prima della T6 il collaudo ha come base 108 contenuti, 0 copie di lavoro, 64 voci, 181
redirect e 0 compilazioni, come lo sviluppo. Gli account attivi sono 2, quelli dell'agente.
Restano queste differenze:
- il media `prova-1g-2.png` (`1G-W9`);
- i residui elencati in `collaudo-1G-W9.md` §7;
- i due account di prova disattivati della 1G-16;
- gli account dell'agente;
- dalla T2: 5 contenuti con la data tecnica di aggiornamento nuova (1E-19), il contatore
  degli usi di `/472-2/` e le righe di registro del collaudo.

Rimozione secondo DR-340, eseguita il 2026-11-02 nella T6 su conferma dell'utente:
- prima, i log dei server del collaudo copiati fuori da Git, senza i file degli account
  (0 password, 0 IBAN);
- `crea.ps1 -Rimuovi -Simula`, poi `crea.ps1 -Rimuovi` con la conferma scritta: tolti
  1 database, 2 bucket e 1 copia di lavoro, insieme alla cartella di stato con le credenziali
  dell'agente.

Verifica dopo la rimozione:
- `crea.ps1 -Rimuovi -Simula` dice «Niente da rimuovere» (database no, bucket 0/2, copia di
  lavoro no);
- il database del collaudo non compare più fra i database del contenitore;
- restano solo i bucket di sviluppo;
- le cartelle della copia di lavoro e dello stato non esistono più;
- `git worktree list` mostra solo la radice;
- lo sviluppo è intatto: 108 contenuti, 178 media.

Con l'ambiente se ne sono andati anche tutti i residui elencati sopra, compresi gli account
dell'agente e le loro credenziali. Il collaudo si ricrea con `crea.ps1` se servisse.

## 11. Console e riservatezza

- **Console (1G-24):** nessun errore dell'applicazione nei compiti della `1G-W9` e nelle prove
  della T2.
  - Restano in rosso solo i rifiuti che il compito stesso provoca.
  - Restano gli avvisi gialli di Next sul precaricamento dei CSS (osservazione O4).
  - Restano i prefetch interrotti.
- **Riservatezza:**
  - controllo di password e IBAN sui file prodotti: 0 password in 212 file (`1G-W9`) e in 13
    file (T2);
  - IBAN e indirizzi reali presenti in 8 file della `1G-W9` oscurati prima della chiusura;
  - giornali e fotografie fuori da Git;
  - nessun dato personale reale in questo rapporto.
- Verifica legale e privacy: questo rapporto **non** dichiara conformità GDPR. La
  conservazione dei nomi nel registro attende la regola di DR-315 e il parere MI-06.

## 12. Approvazione

Approvato dall'utente il 2026-11-02 (DR-347).

Formula proposta:

> Approvo il collaudo redazionale della Fase 1G (condizione 7 del gate): editabilità
> verificata secondo questo rapporto, con l'indebolimento di DR-290 e i difetti W9-N7 e W9-N8
> rinviati alla 1F.

| Data | Approvato da | Formula o riserve |
|---|---|---|
| 2026-11-02 | Proprietario | Approvo il collaudo redazionale della Fase 1G (condizione 7 del gate): editabilità verificata secondo questo rapporto, con l'indebolimento di DR-290 e i difetti W9-N7 e W9-N8 rinviati alla 1F. Nessuna riserva oltre a quelle della formula. |
