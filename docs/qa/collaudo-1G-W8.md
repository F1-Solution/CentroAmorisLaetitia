# Collaudo della `1G-W8` — esiti e difetti

Registro della `1G-W8` (`.planning/phases/1G/PLAN.md`): per ogni handoff, l'esito dichiarato dall'utente, ciò che l'agente osserva sull'ambiente di collaudo (sito 3300, area 3301, API 3302, database `amoris_collaudo`, commit `e61d20b`), e i difetti con severità. Le correzioni spettano alla `1G-W9`. Da HO-038 (prove sulla mappa escluse) i compiti li esegue l'agente con Playwright, con account sintetici propri (DR-290, DR-291).

Severità: **alta** impedisce il compito; **media** lo rende difficile o richiede aiuto; **bassa** è estetica o non si vede dall'utente.

## 1. Esiti per handoff

### HO-036 — compito 1G-1 (2026-10-27)

Dichiarato dall'utente: esito «ok», 2 minuti; difficoltà: nel blocco Immagine le miniature non compaiono e la spunta «Immagine puramente decorativa» occupa troppo spazio in altezza. Campi del modulo non compilati: minuti delle prove accessorie, messaggi, console, immagine usata, aiuto, anteprima, voce di menu trovata senza aiuto.

Osservato dall'agente (sola lettura, alle 22:40 UTC circa):

| Verifica di HO-036 §4 | Osservato | Esito |
|---|---|---|
| 1. `/prova-collaudo-1g-1/` con titolo, paragrafi, separatore, immagine | 200; 3 paragrafi, 1 separatore, 1 immagine (`mamma-papa-bambino-600x411.jpg`) | riuscito |
| 1. due altri blocchi a scelta | assenti: la pagina ha solo 5 blocchi | non fatto |
| 1. `alt="Immagine di prova collaudo 1G-1"` (DR-283) | `alt=""`: l'immagine è stata dichiarata decorativa | non conforme |
| 2. 404 prima della pubblicazione | non verificabile a posteriori | — |
| 3. voce `Prova collaudo 1G-1` nel menu | nessuna voce di menu creata | non fatto |
| 4. seconda pagina `prova-collaudo-1g-1-bis` pubblicata e ritirata | la pagina non esiste (404, nessuna riga nel database) | non fatto |
| Tempo | registro: entrata 22:27, creazione 22:28, ultima pubblicazione 22:32 | circa 4 minuti |

Conclusione del primo passaggio: compito **incompleto**. Fatte creazione, scrittura e pubblicazione della pagina; mancano due blocchi, il testo alternativo, la voce di menu e il ciclo pubblica/ritira della seconda pagina.

**Completamento (2026-10-27, 23:20–23:28 UTC).** Dichiarato: «quasi ok», 2 minuti più 2 di prove accessorie; immagine messa senza aiuto; anteprima uguale alla pagina pubblicata; nessun errore in console; miniature ancora assenti (W8-01); la spunta «decorativa» ora va bene (W8-02 chiuso); messaggio «La richiesta non è valida. /contentId: Invalid UUID» aggiungendo al menu la pagina «bis».

| Verifica di HO-036 §4 | Osservato | Esito |
|---|---|---|
| 1. due altri blocchi | aggiunti Immagine, Media e testo, Elenco articoli, Documento | riuscito |
| 1. `alt="Immagine di prova collaudo 1G-1"` (DR-283) | presente nel sorgente | riuscito |
| 3. voce `Prova collaudo 1G-1` nel menu principale | creata alle 23:23, primo livello, punta alla pagina | riuscito |
| 4. pagina «bis» creata, pubblicata, ritirata | pubblicata 23:24, ritirata 23:24:20; poi ripubblicata due volte e ritirata una per provare il menu | riuscito |
| Prove accessorie (blocchi in una colonna, 1D-30) | la pagina non ha blocchi Colonne | non osservabile |

Esito registrato: **riuscito con difficoltà**, 2 minuti (sotto i 10 di DR-221). Restano sul collaudo la pagina «bis» pubblicata e una voce di menu di prova `sasasa` (primo livello, punta alla pagina principale).

### HO-037 — compito 1G-2 (2026-10-28)

Dichiarato dall'utente: «fatto e tutto ok»; minuti e campi del modulo non riportati.

Osservato dall'agente (registro delle attività dalle 00:57 alle 01:07 UTC, sola lettura), pagina `/reinventa-la-tua-vita/`:

| Verifica di HO-037 §4 | Osservato | Esito |
|---|---|---|
| 1. frase con `[prova collaudo 1G-2]` | presente, resto invariato | riuscito |
| 2. immagine nuova a larghezza piena e da telefono | `prova-1g-2.png` caricata con le dimensioni derivate (1600, 1280, 980, 480) | riuscito |
| 3. `alt` e didascalia | `alt="Immagine di prova collaudo 1G-2"`, didascalia visibile | riuscito |
| 4. differisce solo per frase e immagine | l'immagine nuova è **aggiunta** in un blocco nuovo; la vecchia resta (2 immagini invece di 1) | difforme dall'obiettivo (W8-06) |
| Tempo | modifica e pubblicazione fra le 01:01 e le 01:03 | circa 2 minuti |

Prove accessorie (dovevano svolgersi su `prova-collaudo-1g-1`):

- **Titolo:** nascosto e rimostrato prima su `reinventa-la-tua-vita`; poi nascosto su `prova-collaudo-1g-1`, dove resta nascosto (un solo `h1` nascosto per i lettori di schermo, come atteso).
- **Immagine in evidenza:** messa su `reinventa-la-tua-vita`, che nella copia di partenza non l'aveva, e su `prova-collaudo-1g-1`. Non è stata tolta da nessuna delle due.

Menu: alle 00:57 W8-04 si è ripetuto due volte. Sono state create una voce `111` verso `prova-collaudo-1g-1` e cancellata la voce `sasasa`.

Esito registrato: **riuscito** per il compito; prove accessorie **a metà**, con lo stato da riportare all'inizio.

### HO-038 — compito 1G-3 (2026-10-28)

Dichiarato dall'utente: esito «buono», 2 minuti più 10 di prove accessorie; stato di HO-037 riportato all'inizio (titolo, immagini in evidenza, voce `111`). Difficoltà:

- l'andata e ritorno dà `False` al confronto delle impronte;
- sulla mappa i nuovi segnaposto non risultano salvati.

Il resto va bene.

**Andata e ritorno (1D-36): riuscita.** L'agente ha confrontato i due file dell'utente (`1g-3-prima.html` e `1g-3-dopo-vuoto.html`, 89 127 caratteri ciascuno):

- l'HTML della pagina, tolti i dati di idratazione di Next.js, è identico;
- differiscono solo i dati di idratazione, perché le stesse righe arrivano in ordine diverso e con numerazione diversa.

Sei richieste consecutive della stessa pagina, senza nessun salvataggio, danno due versioni diverse (3 + 3): sono valori generati a ogni richiesta, come HO-038 prevede. Il confronto per impronta dell'handoff è quindi troppo severo (W8-07).

**Mappa: riuscita.** Dopo il riavvio di Docker Desktop (fermo alle 10:20 circa):

- il blocco mappa di `/dove-siamo/` ha il segnaposto `Segnaposto di prova collaudo 1G-3`, più uno senza titolo;
- il titolo compare nel sorgente della pagina pubblica.

Il controllo era stato fatto su `sostegno-alla-genitorialita`, la pagina sbagliata. Lo zoom non è stato cambiato, e mappa, video e spazio fra le colonne non sono stati riportati com'erano: li riporta l'agente prima di HO-039 (DR-290).

Esito registrato: **riuscito** (dichiarato dall'utente); 2 minuti più 10 di prove accessorie.

### HO-039…HO-045 — compiti 1G-4…1G-10, eseguiti dall'agente (2026-10-28, DR-290)

Rapporto completo: [`collaudo-1G-W8-agente-HO-039-045.md`](collaudo-1G-W8-agente-HO-039-045.md). Scritture solo dall'interfaccia dell'area con `agente-redazione@example.invalid`; il registro lo conferma.

**Pulizia iniziale:** l'agente ha riportato come nella copia di partenza la mappa di `/dove-siamo/`, il video di `/dal-vizioso-al-virtuoso/` e il layout di `/sostegno-alla-genitorialita/`.

| Handoff | Compito | Esito | Note |
|---|---|---|---|
| HO-039 | 1G-4 | riuscito, 9 s | blocchi di riserva identici byte per byte; avviso capito a metà (W8-21) |
| HO-040 | 1G-5 | riuscito con difficoltà | file sostituito da Media in tutte le varianti; testo alternativo e didascalia di Media non arrivano alla pagina (W8-10); didascalia illeggibile (W8-11) |
| HO-041 | 1G-6 | riuscito, 6 s | ordine e annidamento riusciti a schermo e da telefono; visibilità per ruolo nasconde a tutti (W8-14) |
| HO-042 | 1G-7 | riuscito, 8 s | titolo, descrizione, condivisione, `noindex`, modelli e dati strutturati; modelli riportati all'inizio |
| HO-043 | 1G-8 | riuscito con difficoltà, 13 s | 404 → 301 → 301 → 404 da spento → 301; redirect nuovo non visibile senza cercarlo (W8-17) |
| HO-044 | 1G-9 | riuscito, 3 s | chi e quando esatti al minuto; nessuna password nel registro |
| HO-045 | 1G-10 | riuscito con difficoltà | anteprima uguale al sito in 9 pubblicazioni su 9; «Salva» e «Salva il layout» cambiano subito il sito pubblicato (W8-13) |

Si sono ripresentati W8-01, W8-03, W8-05 (anche come «contenuto non trovato» nell'albero del menu) e W8-06.

**Residui nel collaudo:**

- `/prova-collaudo-1g-5/` e `/prova-collaudo-1g-10/` pubblicate;
- media `prova-1g-5-a.png` con il file B;
- frase `[prova collaudo 1G-4]` su `/litighiamo-oggi/`;
- su `/prova-collaudo-1g-1/`: SEO di 1G-7 e la parola «Cambiato»;
- redirect `/prova-collaudo-1g-8/` attivo;
- voce di menu `111`, ancora presente.

### HO-046…HO-052 — compiti 1G-11…1G-17, eseguiti dall'agente (2026-10-28, DR-290)

Rapporto completo: [`collaudo-1G-W8-agente-HO-046-052.md`](collaudo-1G-W8-agente-HO-046-052.md). Il collaudo non ha mai risposto 500 o 503; dopo l'interruzione per il limite di richieste l'agente ha ripreso senza ripetere passi.

| Handoff | Compito | Esito | Note |
|---|---|---|---|
| HO-046 | 1G-11 | riuscito, 20 s | sempre un solo 301, nessuna catena; ciclo impedito senza messaggio |
| HO-047 | 1G-12 | riuscito, 39 s | rifiuti spiegati; archivio invariato dopo la rinomina |
| HO-048 | 1G-13 | riuscito con difficoltà, 32 s | rifiuti chiari; la pagina iniziale non si riconosce (W8-24) |
| HO-049 | 1G-14 | riuscito, 77 s | 5 file non ammessi rifiutati in italiano; PNG, PDF e MP4 accettati |
| HO-050 | 1G-15 | riuscito, 24 s | carosello provato su una pagina di prova, poi eliminata |
| HO-051 | 1G-16 | A e B riuscite; C riuscita con difficoltà | nessun comando per la propria password (W8-27); togliersi un ruolo chiude la sessione senza spiegazione (W8-28) |
| HO-052 | 1G-17 | riuscito, 11 s | Redazione rinviata a «Pagine», 403 senza dati; senza accesso 401 |

Si sono ripresentati W8-01, W8-09, W8-13 e W8-20.

**Residui nel collaudo:**

- le pagine 1G-11 con 5 redirect automatici;
- le notizie 1G-12 ritirate, con la categoria rinominata;
- sei media di prova;
- il documento «Modulo per consulenze a distanza» con il file di prova: il file originale si recupera solo con HO-035;
- i due account di prova 1G-16, disattivati;
- l'impostazione `contact.address`, passata da `null` a `""`.

Le altre impostazioni, il carosello e il menu sono come alla partenza.

### Passata di copertura (2026-10-28, DR-292)

Rapporto completo: [`collaudo-1G-W8-agente-copertura.md`](collaudo-1G-W8-agente-copertura.md). L'agente ha verificato i 16 campi che avevano un compito ma nessun esito:

- **8 riusciti:** non seguire i collegamenti, indirizzo canonico, rimuovere una voce di menu, descrizione del media, profili social, modello della descrizione, direttive robots, tipo Open Graph;
- **3 calcolati e non modificabili, come atteso:** percorso pubblico, data di creazione e categoria del documento;
- **2 riusciti con un limite:** il carosello (ne esiste uno solo e l'area non ne crea altri) e GA4, cookie, mappe e redirect degli allegati (si salvano, ma il sito non li legge);
- **3 riusciti con difficoltà:** immagine di condivisione (W8-34, W8-35), logo del sito e pagina iniziale (W8-38).

Sono state tolte la voce di menu residua `111` e la pagina e il documento di prova.

**Residui:** `analytics.ga4_measurement_id` vale `""` invece di `null`, come `contact.address` (W8-37), e non si riporta indietro dall'interfaccia. Resta nel menu principale la voce `Prova collaudo 1G-1`, del compito 1G-1. Il resto coincide con il database di sviluppo, verificato con SELECT.

**Copertura della matrice:** 140 righe su 140 hanno un esito; 16 righe non hanno un compito per scelta della matrice.

## 2. Difetti

| Id | Severità | Dove | Difetto | Causa | Stato |
|---|---|---|---|---|---|
| W8-01 | media | editor › blocco Immagine › «Scegli un media» | Le miniature delle immagini non compaiono: si sceglie solo dal nome del file | Le miniature usano l'indirizzo relativo `/media/…`, che il browser chiede all'area (3301 → 404) invece che al sito (3300 → 200). Con area e sito sullo stesso dominio dietro il reverse proxy l'indirizzo funzionerebbe: da verificare in produzione | risolto nella `1G-W9` T1 (prova `image-media-w9.test.tsx`); caroselli nel giro 1 della T2, `sliders.test.tsx`; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-02 | bassa | «Scegli un media» › spunta «Immagine puramente decorativa (nessun testo alternativo)» | La spunta occupa troppo spazio in altezza | Non individuata dal codice: la casella ha altezza minima di 44 px per il tocco (`choice.css`) | chiuso: l'utente non lo riscontra più (2026-10-28) |
| W8-03 | bassa | editor › «Pubblica» e «Ritira» | Pubblicando o ritirando senza bozza in sospeso, l'editor chiede di scartare una bozza che non esiste: il registro annota un fallimento (404) | Ripetuto 6 volte fra le 22:31 e le 23:28 (voci 263, 283, 285, 287, 292, 294); l'utente non vede messaggi | risolto nella `1G-W9` T3 (prova `content-working-copy.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-04 | media | Corredo › Menu › «Aggiungi una voce» › «Contenuto» (e «Categoria») | Se si lascia il contenuto che l'elenco mostra per primo, il salvataggio è rifiutato con un messaggio tecnico in inglese: «La richiesta non è valida. /contentId: Invalid UUID» | L'elenco non ha una voce «Scegli…»: il browser mostra il primo contenuto, ma il valore resta vuoto (`MenuManager.tsx:210`, `:348-354`, `:357-363`). L'elenco è ordinato per ultima modifica, quindi il primo è proprio la pagina appena creata. Altri elenchi dell'area hanno la voce «Scegli…» (`DocumentInsertDialog.tsx:29`, `SliderInsertDialog.tsx:38`). Tre tentativi rifiutati (voci 288, 289, 295) | risolto nella `1G-W9` T4 (prova `menu-manager.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-05 | bassa | Corredo › Menu › «Aggiungi una voce» › «Contenuto» | L'elenco mostra solo i 100 contenuti modificati più di recente: nel collaudo ce ne sono 110, e i 10 meno recenti non si possono mettere a menu | `MenuManager.tsx:126` chiede `perPage=100`, il massimo dell'API (`content/schemas.ts:43`) | risolto nella `1G-W9` T4 (prova `menu-manager.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-06 | media (usabilità) | editor › blocco Immagine | Per «sostituire un'immagine» la redazione ha aggiunto un blocco nuovo e lasciato il vecchio: il blocco non permette di scegliere un altro file | Per progetto il file si cambia da Corredo › Media › «Sostituisci il file», che lo cambia ovunque è usato; l'ispettore lo dice in un avviso (`BlockInspector.tsx:171-174`). Il percorso previsto non è stato trovato o non è stato preferito | risolto nella `1G-W9` T1 (prova `image-media-w9.test.tsx`), «Cambia immagine» secondo DR-294; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-07 | bassa | HO-038 §5 «Andata e ritorno» | Il confronto per impronta dell'HTML pubblico risulta `False` anche senza alcun salvataggio | Next.js scrive i dati di idratazione in ordine variabile fra una richiesta e l'altra; l'HTML visibile è identico. Il controllo va fatto sull'HTML senza `self.__next_f` | risolto nella `1G-W9` T9: HO-038 §5 confronta senza i dati rigenerati a ogni richiesta (2026-10-29); gli strumenti di `tests/visual/` lo facevano già (`confrontoHtml.ts`, DR-202) |
| W8-08 | — | Mappa › «Aggiungi un segnaposto» | Il segnaposto nuovo non risultava salvato (dichiarato dall'utente) | Non è un difetto: il segnaposto è salvato e pubblicato; il controllo era stato fatto su un'altra pagina | chiuso (2026-10-28) |
| W8-09 | bassa | area, console | Risposte attese segnate come errori rossi in console: `GET /auth/me` 401 sulla schermata di accesso; `GET /contents/:id/draft` 404 a ogni apertura dell'editor senza copia di lavoro; `GET /seo/contents/:id` 404 nella scheda SEO senza sovrascrittura. Chi segue gli handoff deve annotarli come errori | `apps/admin/src/lib/session.tsx:76`, `apps/admin/src/components/editor/ContentEditor.tsx:185`, `apps/admin/src/components/editor/ContentSeoPanel.tsx:121`: l'assenza è comunicata con un codice d'errore | risolto nella `1G-W9` T8 (prova `absenceNotError.test.ts`, `console-quiet-w9.test.tsx`, e2e `console-pulita.spec.ts` 2/2 nella T10); `/auth/me` senza sessione risponde 204 secondo DR-319; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-10 | media | Media › «Testo alternativo», «Titolo», «Didascalia»; blocco Immagine | Testo alternativo, titolo e didascalia cambiati in Media non arrivano alle pagine che già usano l'immagine: `alt` resta quello del blocco, la didascalia non compare. Il selettore del blocco non propone il testo alternativo già scritto in Media. L'aiuto di Media dice della didascalia «Compare sotto l'immagine, visibile a tutti». HO-040 §4.4 riesce solo ripetendo i valori nel blocco | `packages/blocks/src/render/Image.tsx:16`: `alt` del blocco prima di quello del media. `:43`: didascalia solo dal blocco. `apps/admin/src/components/editor/ImageInsertPicker.tsx:78-84`: l'`altText` del media non passa al selettore. Aiuto in `apps/admin/src/components/media/MediaLibrary.tsx:459` | risolto nella `1G-W9` T1 (prova `image-media-texts.test.tsx`, `image-media-w9.test.tsx`) secondo DR-305; i blocchi importati non usano la didascalia del media secondo DR-312 nella T1b (prova `imported-image-caption.integration.test.ts`; migrazione 0011 applicata allo sviluppo il 2026-10-29); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-11 | media | sito, blocco Immagine con didascalia fuori da una riga Divi | La didascalia (`figcaption`) ha altezza 0: il testo esce sotto l'immagine, tagliato e sovrapposto, a ogni larghezza | `apps/web/src/styles/blocks.css:310-313`: `.blk-image { line-height: 0 }`, ripristinato solo nelle righe flex (`:326-329`) | risolto nella `1G-W9` T2 (prova `blocksCss.test.ts`); confronto visivo in T10; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-12 | bassa | blocco Immagine › «Titolo» | Il titolo dell'immagine, sia del blocco sia del media, non compare nel sorgente della pagina | `packages/blocks/src/render/Image.tsx:13`: `title` non viene letto | risolto nella `1G-W9` T1 (prova `image-media-texts.test.tsx`); `title` del blocco come Divi (11 blocchi in 8 pagine, più vicini alla sorgente); il titolo del media non fa da riserva secondo DR-313 nella T1b (prova `image-media-texts.test.tsx`, aiuto di Media in `media-library.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-13 | media (decisione) | editor › «Salva»; scheda «Pagina» › «Salva il layout» | Su un contenuto pubblicato «Salva» scrive subito il contenuto letto dal sito, senza anteprima né «Pubblica»; lo dice solo «Contenuto salvato.». «Salva il layout» fa lo stesso: «La pagina pubblica usa il nuovo layout.». Contraddice HO-045 §4.2: il lavoro in corso non deve toccare il sito finché non lo si pubblica. Solo la copia di lavoro automatica lo rispetta | `ContentEditor.tsx:285-320`: «Salva» fa `PATCH /contents/:id`, cioè il contenuto pubblicato (DR-068). `ContentLayoutPanel.tsx:46-50`: `PATCH` immediato. Da decidere se «Salva» debba scrivere solo la copia di lavoro su un contenuto pubblicato | risolto nella `1G-W9` T3 (prova `content-editor.test.tsx`, `content-working-copy.test.tsx`) secondo DR-293; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-14 | bassa | Menu › voce › «Chi vede questa voce» | «Solo a chi ha fatto accesso» e «Solo ad alcuni ruoli» nascondono la voce a tutti, anche a chi è entrato in Redazione. L'aiuto promette «La voce compare a chi è entrato…». Oggi il sito non ha un accesso per i visitatori | `apps/api/src/modules/public/service.ts:862`: `if (row.visibility !== 'public') return null`; testi in `apps/admin/src/components/menu/MenuItemPanel.tsx:26-38` | risolto nella `1G-W9` T2 (prova `menu-visibility-help.test.tsx`) secondo DR-306; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-15 | bassa | Menu › albero delle voci | Le voci che usano il titolo del contenuto (etichetta vuota) hanno pulsanti senza nome per chi usa un lettore di schermo: «Prendi «» per spostarlo», «Sposta su:», «Annida:», «Elimina:» | `apps/admin/src/components/menu/MenuManager.tsx:88` passa `item.label`, vuota, invece del nome mostrato; `packages/ui/src/editor/MenuTreeEditor.tsx:130` | risolto nella `1G-W9` T4 (prova `menu-manager.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-16 | bassa | Menu › «Sposta su», «Annida»; Registro | Il primo spostamento rinumera tutte le voci, perché le posizioni importate sono sparse (1, 2, 3, 9, 11, …). Il registro riceve una riga «Ha modificato una voce di menu» per ogni voce toccata: circa 80 righe per 4 gesti, 32 col solo «Voce di menu» | `apps/admin/src/lib/menu/tree.ts:106-114` rinumera 0…n e scrive ogni voce cambiata; `MenuManager.tsx:181-191` fa un PATCH per voce | risolto nella `1G-W9` T4 (prova `menu-tree.test.ts`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-17 | bassa | SEO e indirizzi › «Redirect» › «Crea il redirect» e «Salva il redirect»; «Template globali» › «Salva il template» | Nessun messaggio di riuscita. Il redirect appena creato non compare: l'elenco è alfabetico e paginato (182 righe) e la riga si trova solo cercando | Nessun avviso in `apps/admin/src/components/seo/RedirectTable.tsx` (`createItem`/salvataggio) né in `SeoTemplates.tsx:100-125` | risolto nella `1G-W9` T5 (prova `success-notices.test.tsx`), elenco filtrato sul redirect creato; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-18 | bassa | Redirect › colonna «Usi» | Il contatore degli usi resta 0 dopo ogni risposta 301, e così l'ultimo utilizzo | Nessun codice scrive `hit_count` o `last_hit_at`: solo letture in `apps/api/src/modules/redirects/service.ts:26-27` | risolto nella `1G-W9` T2 (prova `publicW9.test.ts`) secondo DR-308; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-19 | bassa | Media › «Elimina» › «Elimina definitivamente» | Eliminazione riuscita senza nessun messaggio: il pannello si chiude e basta | `apps/admin/src/components/media/MediaLibrary.tsx:305-308`, nessun avviso dopo `DELETE` | risolto nella `1G-W9` T5 (prova `success-notices.test.tsx`); l'avviso è «File eliminato.» secondo DR-316 nella T10b (prova `success-notices.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-20 | bassa | Impostazioni › Registro › colonna «Oggetto» | Alcune righe nominano solo il tipo: «Media» (caricamento, eliminazione riuscita), «Reindirizzamento» senza indirizzo, «Modello SEO» senza ambito, «Voce di menu» per le voci senza etichetta. Per rispondere «che cosa ha fatto» bisogna andare altrove | non cercata nel codice del registro | risolto nella `1G-W9` T6 (prova `auditW9.test.ts`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-21 | bassa | editor › blocco «HTML (riserva)» | L'avviso «Questo blocco non è stato convertito, modificarlo può alterare la resa.» usa parole tecniche. Non dice che è codice del vecchio sito, che cosa rischia chi lo cambia, né che un frammento può essere invisibile, come il commento HTML di `/litighiamo-oggi/`. Voto 3/5 | `packages/ui/src/editor/HtmlFallbackEditor.tsx:62-64` | risolto nella `1G-W9` T3 (prova `html-fallback-editor.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-22 | bassa | editor › «Indirizzo» › «Pagina genitore»; Categorie › «Modifica categoria» › «Categoria genitrice» | Le discendenti non sono proposte come genitore, e nulla lo spiega. Chi cerca di fare della madre una figlia della figlia non trova l'opzione e non riceve il messaggio, che esiste solo nell'API: «La pagina scelta come genitore sta sotto questo contenuto.». HO-046 §4.5 e HO-047 chiedono un rifiuto spiegato | `apps/api/src/modules/content/address.ts:319-330` filtra le discendenti; il messaggio sta in `address.ts:130`. Nessun aiuto in `apps/admin/src/components/editor/ContentAddressPanel.tsx:420-434`; per le categorie `apps/api/src/modules/terms/category.ts:78` | risolto nella `1G-W9` T3 (prova `content-address.test.tsx`, `categoriesComplete.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-23 | bassa | Categorie (crea, modifica, elimina); Menu (aggiungi, elimina voce); Documenti (crea, elimina); Persone e permessi (crea, modifica, disattiva, riattiva; proprio indirizzo) | Nessun messaggio di riuscita: la finestra si chiude e l'elenco si aggiorna. Le pagine invece dicono «Contenuto eliminato», i documenti «Modifiche salvate». Stesso schema di W8-17 e W8-19, su altre schermate | per esempio `apps/admin/src/components/terms/CategoryManager.tsx:126-140` e `:257-261`; `CategoryDeleteAction.tsx:100-103`; `documents/DocumentCreateDialog.tsx:106` e `DocumentDeleteAction.tsx:99` portano altrove senza avviso | risolto nella `1G-W9` T5 (prova `success-notices.test.tsx`); l'avviso dopo il cambio del proprio indirizzo resta anche dopo un accesso non riuscito, finché non si entra, secondo DR-317; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-24 | media | Pagine › elenco ed editor | La pagina iniziale non si riconosce: il titolo è vuoto (dalla sorgente), l'elenco mostra una riga con il solo «/home/», e né l'elenco né l'intestazione dell'editor dicono «pagina iniziale». Lo dice solo la scheda «Indirizzo». HO-048 §4.4 richiede aiuto | nessun segno di `isHome` in `apps/admin/src/components/ContentList.tsx`; titolo vuoto in `contents` (anche in `amoris`) | risolto nella `1G-W9` T3 (prova `contentListHome.test.ts`, `content-list-home.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-25 | bassa | Media › caricamento di PDF e MP4 | Dopo il caricamento di un PDF o di un MP4 non compare alcuna conferma sotto il nome del file; le immagini dicono «N dimensioni derivate generate.» | `apps/admin/src/components/media/MediaLibrary.tsx:219-223`: avviso solo se `derivatives > 0` | risolto nella `1G-W9` T5 (prova `success-notices.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-26 | media | sito, blocco «Presentazione a scorrimento»; Caroselli › «Titolo» | Tre titoli di slide importati contengono HTML (`<div align="center">…<br>…<i class="fa-heart"></i></div>`). Sul sito si leggono come testo con i tag visibili, anche nell'`alt`; nell'editor appaiono come codice. Oggi nessuna pagina mostra il carosello, quindi il problema emerge appena lo si inserisce | `packages/blocks/src/render/Slider.tsx:58` e `:64` rendono `heading` come testo; il dato importato in `slider_slides.heading` contiene markup | risolto nella `1G-W9` T2 (prova `slide-title.test.ts`, `dynamic-blocks.test.tsx`, `publicW9.test.ts`, `sliders.test.tsx`) secondo DR-307; cuore reso con il sottoinsieme locale di Font Awesome secondo DR-311 nella T2b (prova `slide-title.test.ts`, `blocksCss.test.ts`), licenza del carattere da verificare da una persona; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-27 | media | area, menu della persona | Nessun comando per cambiare la propria password: il menu ha solo «Disconnetti», e la pagina `/admin/password` si raggiunge solo scrivendone l'indirizzo, o quando il cambio è obbligato. HO-051 C3 chiede «la procedura che l'area offre a chi è entrato» | `packages/ui/src/shell/UserMenu.tsx:34-49`; `apps/admin/src/components/AreaShell.tsx:123-130` non passa altre voci | risolto nella `1G-W9` T7 (prova `user-menu-actions.test.tsx`, `password.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-28 | media | Persone e permessi › «Ruoli» sul proprio account | Togliendosi un ruolo, la modifica è salvata e la sessione si chiude (scelta voluta), ma l'area mostra l'errore «Non è stato possibile — Serve un accesso valido.» senza spiegare che bisogna rientrare | `apps/api/src/modules/accounts/service.ts:236-244` revoca le sessioni; l'elenco ricaricato dopo il salvataggio riceve 401 (`AccountsScreen.tsx`, ricarica dopo `PATCH`) | risolto nella `1G-W9` T7 (prova `accounts-settings-w9.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-29 | bassa | Registro › colonna «Oggetto» | Per un contenuto eliminato, le righe precedenti (creato, modificato, pubblicato, indirizzo) mostrano «contenuto non più presente»: il titolo resta solo sulla riga «Ha eliminato» | `apps/admin/src/components/audit/auditFormat.ts:54-61`: il titolo si legge solo dal contenuto ancora esistente | risolto nella `1G-W9` T6 (prova `auditW9.test.ts`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-30 | bassa | Registro | Una password attuale errata nel cambio del proprio nome o dei propri ruoli lascia anche la riga «Cambio della password — Non riuscita», che fa pensare a un tentativo di cambio password | `apps/api/src/modules/auth/service.ts:93-104`: `verifyCurrentPassword` scrive sempre `auth.password_changed` | risolto nella `1G-W9` T6 (prova `auditW9.test.ts`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-31 | bassa | Registro | I redirect nati da un cambio di indirizzo o di categoria non hanno una riga propria: ne restano solo i conteggi nel dettaglio di «Ha cambiato l'indirizzo», che l'elenco non mostra. HO-046 §5 chiede ciascuno | dettaglio `redirectsCreated`/`Retargeted`/`Removed` della riga `content.address.update`; nessuna scrittura `redirect.create` | risolto nella `1G-W9` T6 (prova `auditW9.test.ts`); la conservazione dei nomi nel registro avrà una regola da definire con validazione privacy umana secondo DR-315; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-32 | bassa | area › indirizzi di Impostazioni aperti da Redazione o senza accesso | Prima del rinvio la schermata chiama `GET /accounts` e `GET /audit…`, che rispondono 403 o 401 in console. Nessun dato mostrato | le schermate caricano i dati mentre `AreaShell.tsx:68-86` decide il rinvio | risolto nella `1G-W9` T8 (prova `console-quiet-w9.test.tsx`, `console-quiet-pages-w9.test.tsx`); controllo esteso alle pagine di Redazione secondo DR-318; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-33 | bassa | editor › albero dei blocchi | I blocchi «Documento» e «Media e testo» si chiamano «documento» e «media e testo», senza il titolo del documento: con due documenti nella pagina non si distinguono | `apps/admin/src/lib/editor/tree.ts:327-347`: `labelOf` non tratta `document` né `media_text` | risolto nella `1G-W9` T3 (prova `tree.test.ts`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-34 | media | editor › SEO › «Scegli immagine di condivisione» | Un'immagine di condivisione scelta non si toglie più: nessun comando la rimuove. Dopo una ricarica la scheda dice di nuovo «Scegli immagine di condivisione» e non nomina l'immagine, anche se il sito la usa. Per tornare a «nessuna immagine» si è dovuta eliminare la pagina | `apps/admin/src/components/editor/ContentSeoPanel.tsx:212` (`chosenImage` cercata solo nei media caricati quando il selettore è aperto) e `:242`; nessun comando porta `ogImageId` a `null` (`:195`, `:322-324`) | risolto nella `1G-W9` T1 (prova `image-media-w9.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-35 | bassa | editor › SEO › «Scegli un media» | Per l'immagine di condivisione «Usa questo media» resta spento finché non si scrive un «Testo alternativo» («Obbligatorio…») o si spunta «decorativa». Quel testo poi non si salva da nessuna parte | `ContentSeoPanel.tsx:312-325`: `MediaPicker` senza `requireAlt={false}`; `onSelect` ignora l'alt (`:322`) | risolto nella `1G-W9` T1 (prova `image-media-w9.test.tsx`, `media-picker.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-36 | bassa | SEO e indirizzi › modelli › «Direttive robots» | Con `noindex` nel modello «Pagine», tutte le pagine dicono `noindex` ma restano in `/sitemap.xml`. Una pagina con «Non indicizzare» nella sua SEO, invece, ne esce. Il sito dà ai motori due indicazioni contrarie | `apps/api/src/modules/public/service.ts:1058-1062`: la mappa legge solo `content_seo.robots_noindex`, non `seo_templates.robots_directives` | risolto nella `1G-W9` T2 (prova `publicW9.test.ts`), anche per le categorie; confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-37 | bassa | Impostazioni del sito › campi nati vuoti (`null`) | Un'impostazione partita `null` e poi svuotata dall'area salva `""`, e lo stato di partenza non si ottiene più dall'interfaccia. Si è visto su «Identificativo di misurazione GA4» e, in HO-051, su «Indirizzo del Centro». Il sito non mostra differenze | `apps/admin/src/components/settings/SiteSettings.tsx:56-58`: `valueFrom` restituisce il testo, anche vuoto, quando il valore di partenza è `null` | risolto nella `1G-W9` T7 (prova `accounts-settings-w9.test.tsx`, `settingsReferences.test.ts`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |
| W8-38 | media | Impostazioni del sito › «Logo del sito», «Pagina iniziale» | I due campi chiedono l'identificativo interno di un media o di un contenuto, senza aiuto né scelta da elenco. Media non mostra l'identificativo; quello di una pagina si legge solo nell'indirizzo dell'editor. Il valore non è controllato: l'API accetta qualunque testo. Dal codice, un valore che non è un identificativo farebbe fallire la lettura della pagina iniziale nel database. **Non l'ho provato**, per non rompere la home del collaudo | `apps/admin/src/components/settings/SiteSettings.tsx:126-133` (campo di testo generico); `apps/api/src/modules/settings/schemas.ts:37-60` senza le due chiavi; `apps/api/src/modules/public/service.ts:375` (`eq(contents.id, homeId)`) e `:242-246`; pannello Media in `MediaLibrary.tsx:420-428` senza identificativo | risolto nella `1G-W9` T7 (prova `settingsReferences.test.ts`, `accounts-settings-w9.test.tsx`); ritiro della pagina iniziale bloccato secondo DR-314 nella T7b (prova `contentHomeWithdrawal.test.ts`, `content-editor.test.tsx`); confermato in T10-T11 (`collaudo-1G-W9.md` §3) |

### Punti del codice coinvolti da W8-01

Tutti i punti dell'area che mostrano un'immagine da `publicPath` come indirizzo relativo; l'area ha già `apps/admin/src/lib/siteUrl.ts` per gli indirizzi del sito.

- `apps/admin/src/components/editor/ImageInsertPicker.tsx:78` (blocco Immagine)
- `apps/admin/src/components/editor/ContentListingPanel.tsx:211` e `:285` (immagine in evidenza)
- `apps/admin/src/components/editor/ContentSeoPanel.tsx:317` (immagine per la condivisione)
- `apps/admin/src/components/editor/VideoInspector.tsx:152` e `:159` (copertina del video)
- `apps/admin/src/components/sliders/SliderEditor.tsx:125`, `:234`, `:373` e `SliderSlideRow.tsx:62` (caroselli)

## 3. Chiusura (2026-10-28, DR-299)

Wave chiusa su approvazione dell'utente. Compiti 1G-1…1G-17 con esito e tempo; matrice 140/140 con esito; difetti W8-01…W8-38 con severità. Il criterio **1G-24** (nessun errore in console) **non è soddisfatto** (W8-09, W8-32) e passa alla `1G-W9` con gli altri difetti aperti.
