# Esiti di HO-039…HO-045 eseguiti dall'agente (DR-290)

Collaudo della `1G-W8`, 2026-10-28, 10:03–10:37 UTC (11:03–11:37 ora di Roma). Ambiente di collaudo: sito 3300, area 3301, API 3302, database `amoris_collaudo`. Account dell'agente: `Agente di collaudo (redazione)` e, solo per HO-044 parte 2, `Agente di collaudo (amministrazione)`. Ogni scrittura è passata dall'interfaccia dell'area; database e API sono stati solo letti.

Script e giornali sono in `.superpowers/sdd/strumenti-1G/collaudo/` (cartella ignorata da Git):

- configurazione: `playwright.config.ts`;
- un file `NN-hoXXX.spec.ts` per compito, con gli aiuti comuni in `supporto.ts`;
- giornali in `risultati/*.jsonl`, una riga per evento: messaggi, console, richieste ≥ 400, verifiche;
- fotografie `risultati/ho0xx-*.png`.

Si lancia con `pnpm exec playwright test --config .superpowers/sdd/strumenti-1G/collaudo/playwright.config.ts <file>`.

I tempi sono quelli dello script, non di una persona: sono un limite inferiore. Contano invece i comandi da trovare e i passi in più.

Riservatezza. La password non compare in nessun file: verificato cercandola in tutti i file della cartella. Le tracce di Playwright sono ora spente, perché registrerebbero il valore del campo password.

Errori ricorrenti in console, in ogni compito. Sono risposte attese mostrate come errori (W8-09):

- `GET /auth/me` 401 sulla schermata di accesso;
- `GET /contents/:id/draft` 404 a ogni apertura dell'editor senza copia di lavoro.

Sul **sito** e nell'**anteprima** nessun errore di console e nessuna richiesta fallita, in tutti i compiti.

## 0. Pulizia iniziale (residui di HO-038)

Confronto con SELECT fra `amoris` (partenza) e `amoris_collaudo`, poi ripristino dall'area (`01-pulizia.spec.ts`, 10:07 UTC).

| Residuo | Trovato | Riportato dall'area | Esito |
|---|---|---|---|
| Mappa di `/dove-siamo/` | 3 segnaposto: «Centro Amoris Laetitia» spostato sul centro della mappa, «Segnaposto di prova collaudo 1G-3» con le coordinate originali, uno senza titolo | blocco Mappa: «Togli il segnaposto» sul 3 e sull'1; titolo del rimasto riportato a «Centro Amoris Laetitia»; «Pubblica» | identico alla partenza |
| Video di `/dal-vizioso-al-virtuoso/` | `watch?v=NVT8JwUNDSA` | blocco Video › «Indirizzo YouTube» `https://www.youtube.com/watch?v=or8KUVciAWg`; «Pubblica» | identico alla partenza |
| Layout di `/sostegno-alla-genitorialita/` | `right_sidebar` (partenza `no_sidebar`); `gutter_width` già 2 come nella partenza | scheda «Pagina» › «Layout della pagina» = «Senza barra laterale» › «Salva il layout» | identico alla partenza |

- Il confronto SQL finale di layout, spazio fra le colonne e blocchi mappa e video risulta **identico** fra le due basi dati.
- Restano, come richiesto, il testo e l'immagine aggiunti da 1G-3.
- Messaggi visti: «Contenuto pubblicato.» due volte; «Layout salvato — La pagina pubblica usa il nuovo layout.».

Fuori dalla pulizia: `summary_source` di `dove-siamo` e `sostegno-alla-genitorialita` è diventato `null` col salvataggio dell'utente. Non si vede sul sito ed è stato lasciato com'è.

## 1. HO-039 — blocco di riserva (1G-4)

Contenuto: `/litighiamo-oggi/`, colonna 2/3, con due blocchi «HTML (riserva) — blocco non convertito»:

- `b_8ef156f1af06`: un commento HTML, invisibile sul sito;
- `b_8dc3844a9c3d`: «Termine delle iscrizioni: 31 marzo», centrato.

La frase è stata aggiunta in testa al paragrafo subito dopo, «Il corso ha un costo di 40€…». Script `04-ho039.spec.ts`.

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. frase `[prova collaudo 1G-4]` | `<p>[prova collaudo 1G-4] Il corso ha un costo di <strong>40€</strong>…` nel sorgente; visibile anche a 390 px | riuscito |
| 2. frammento di riserva identico | HTML dei due frammenti identico, byte per byte; fotografia del frammento visibile identica pixel per pixel (`ho039-prima.png`, `ho039-dopo.png`) | riuscito |
| 3. avviso, testo esatto | «**Blocco non convertito** — Questo blocco non è stato convertito, modificarlo può alterare la resa.» Sotto, il codice HTML in un'area di testo; nell'albero il blocco si chiama «HTML (riserva) — blocco non convertito» | vedi sotto |
| 4. voto | **3/5** | parziale (W8-21) |
| 5. anteprima = pubblica | contenuto principale identico; differisce solo `dateModified` nei dati strutturati (anteprima: data vecchia; pubblica: ora della pubblicazione) | uguale (vedi nota) |

Risposte dall'avviso, con parole mie:

- *Che cos'è il blocco?* Un pezzo della pagina che il sistema non ha saputo trasformare in un blocco normale, e che si modifica come codice. L'avviso non dice che viene dal vecchio sito, né che il primo dei due è un commento che sul sito non si vede.
- *Che cosa succede se lo cambio?* «Può alterare la resa»: la pagina potrebbe vedersi diversa. Non dice in che modo, né come tornare indietro.

Il criterio è soddisfatto solo in parte: si capisce di non doverlo toccare, ma non che cosa sia.

Altri dati del compito:

- Messaggio in più, sul blocco Testo modificato: «Testo salvato in una forma diversa — L'editor non rappresenta questo testo esattamente come è salvato: finché non lo si modifica resta com'è, ma la prima modifica lo riscriverebbe nella forma qui sopra.» Alla prima modifica il blocco ha perso gli a capo intorno a `<p>`; sul sito non si vede.
- Tempo: **9 s**. Esito: **riuscito**.
- Console: solo W8-09.
- Resta nel collaudo: la frase `[prova collaudo 1G-4]` su `/litighiamo-oggi/`.

## 2. HO-040 — sostituire un'immagine (1G-5)

Script `05-ho040.spec.ts`. Immagini A, B e C generate con System.Drawing in `risultati/file/` (1600×900, blu, arancione, grigio).

Il primo tentativo (10:13 UTC) si è fermato dopo il caricamento di A: il pannello laterale del media copriva il menu. Un'immagine A in più non è stata caricata. Ripreso alle 10:19.

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| prima: 404 | `/prova-collaudo-1g-5/` 404 prima della creazione | riuscito |
| 1. il sito mostra B | colore letto nel browser: B (arancione) | riuscito |
| 2. ogni dimensione | larghezze 1440, 1280, 1024, 980, 768, 480, 390: sempre B (varianti 1600, 1280×720, 980×551, 480×270). Tutti gli indirizzi di `src` e `srcSet` aperti uno a uno: 200, tutti B | riuscito |
| 3. stesso indirizzo | `/media/2026/10/prova-1g-5-a.png` prima e dopo, e così le 4 varianti | riuscito |
| 4. `alt` B e didascalia visibile | **dopo la sola via «Media»: no.** Il sorgente ha ancora `alt="Prova collaudo 1G-5 A"`; didascalia e titolo assenti, anche se in Media risultano salvati. Riuscito solo cambiandoli **anche** nel blocco Immagine della pagina e ripubblicando: `alt="Prova collaudo 1G-5 B"` e `<figcaption>` nel sorgente. La didascalia però è **illeggibile**: altezza 0, il testo esce sotto l'immagine tagliato (`ho040-figure.png`, W8-11). Il titolo non arriva mai al sito (W8-12) | non riuscito per la via prevista (W8-10, W8-11) |
| 5. anteprima = pubblica | creazione e ripubblicazione: uguali; differisce solo `dateModified` | uguale |

Percorso seguito e messaggi:

- Corredo › Media › «Scegli i file da caricare»; poi il pannello del file › «Testo alternativo» › «Salva»: «Fatto — Modifiche salvate.».
- Pagine › «Nuova pagina» con titolo e «Indirizzo» › blocco Immagine. Il selettore **non propone** il testo alternativo già scritto in Media: campo vuoto (W8-10). Poi «Usa questo media» › «Pubblica»: «Contenuto pubblicato.».
- Sostituzione: Media › pannello › «Sostituisci il file». Finestra: «Il file attuale e le sue dimensioni derivate non si potranno recuperare: «prova-1g-5-b.png» prenderà il loro posto sullo stesso indirizzo.» › «Sostituisci» › «Fatto — File sostituito. L'indirizzo non è cambiato: le pagine che lo citano mostrano il file nuovo. 14 dimensioni derivate rigenerate.».
- Trovabilità di W8-06: il comando «Sostituisci il file» si trova. L'ispettore del blocco Immagine lo indica: «Il file dell'immagine si cambia da «Media» — Qui si modifica ciò che accompagna l'immagine; il file si sostituisce da Corredo › Media, con «Sostituisci il file».».

Prove accessorie (35 s; il caricamento di C ha atteso circa 20 s le dimensioni derivate):

- **B in uso:** l'eliminazione chiede di digitare il nome del file («Digita «prova-1g-5-a.png» per confermare»), poi è rifiutata con «Il media è citato da questi contenuti e non si elimina finché lo citano: Pagina di prova collaudo 1G-5.». La risposta è un 409, in console.
- **C libera:** eliminata. Nel database 0 righe; nel selettore del blocco Immagine «Nessun media trovato.». Dopo l'eliminazione **nessun messaggio** (W8-19).

Riepilogo del compito:

- Tempi: **12 s** con le difficoltà indicate, di cui 3 s per la sostituzione; più **5 s** per alt e didascalia nel blocco.
- Esito: **riuscito con difficoltà**. File sostituito ovunque e in ogni dimensione; `alt` e didascalia arrivano al sito solo cambiandoli due volte, e la didascalia non si legge.
- Console: W8-09; 404 delle miniature su 3301 (W8-01, ripetuto); 409 del rifiuto.
- Resta nel collaudo:
  - `Pagina di prova collaudo 1G-5`, pubblicata;
  - il media `prova-1g-5-a.png`, con il file B e titolo, alt e didascalia di 1G-5;
  - C eliminata.

## 3. HO-041 — ordine del menu (1G-6)

Script `06-ho041.spec.ts`. Ordine di partenza del primo livello, sul sito:

Chi siamo, Servizi, I seminari, **Prova collaudo 1G-1**, 111, Corso per consulenti familiari, I corsi, I convegni, Iscrizioni, Contatti.

«Area riservata» non è mostrata perché non è pubblica. Scambiate «Prova collaudo 1G-1» e la voce che la precede, «I seminari», con «Sposta su: Prova collaudo 1G-1».

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. ordine scambiato a schermo pieno | Chi siamo, Servizi, **Prova collaudo 1G-1, I seminari**, 111, … | riuscito |
| 1. idem da telefono (390 px, menu aperto) | stesso ordine (`ho041-scambiato-390.png`) | riuscito |
| 2. altre voci ferme | sì | riuscito |
| 3. anteprima | il menu non ha anteprima: ogni spostamento è subito sul sito | non applicabile |

Prove accessorie (23 s):

- **Annida:** la voce diventa sottovoce di «I seminari», dopo «Edizioni passate», a schermo e da telefono.
- **Riporta al livello superiore:** la voce torna al primo livello, nella posizione di partenza.
- **Visibilità:** pannello della voce › «Chi vede questa voce» › «Solo ad alcuni ruoli»; ruoli proposti «Amministrazione» e «Redazione», spuntata «Redazione»; «Salva la voce» › «Fatto — Modifiche salvate.».
  - Il visitatore anonimo non la vede: riuscito.
  - **Nemmeno chi è entrato come Redazione la vede sul sito** (W8-14).
- **Ritorno a «Visibile a tutti»:** riuscito. Ordine finale identico a quello di partenza, sul sito e nel database.

Tempi ed esito:

- Tempo: **6 s**. Esito: **riuscito**.
- Messaggi: nessuno dopo gli spostamenti; l'albero si aggiorna.
- Console: solo il 401 di W8-09.

Osservazioni:

- **W8-05 si ripresenta in un'altra forma:** la voce che punta ad «Autostima e assertività» compare nell'albero come «Contenuto: contenuto non trovato», perché quel contenuto è fuori dai 100 caricati.
- Le voci senza etichetta propria hanno pulsanti senza nome: «Prendi «» per spostarlo», «Sposta su:», «Annida:» (W8-15).
- Il primo spostamento ha rinumerato le posizioni di tutte le voci, da 1, 2, 3, 9, 11, … a 0…10, e il registro le annota tutte (W8-16).

Resta nel collaudo:

- l'ordine è quello di partenza, con le posizioni rinumerate (non si vede);
- la voce `111`, dichiarata tolta in HO-038, **è ancora presente** al primo livello, dopo «Prova collaudo 1G-1». Non l'ho tolta: è una cancellazione non prevista dal mio blocco.

## 4. HO-042 — titolo SEO (1G-7)

Script `07-ho042.spec.ts`. Pagina `/prova-collaudo-1g-1/`; pagina senza titolo proprio `/servizi/`, scelta perché nessuna pagina pubblicata ha una riga in `content_seo` salvo una.

| Verifica del §4 | Atteso | Visto nel sorgente | Esito |
|---|---|---|---|
| linguetta del browser | Titolo SEO prova collaudo 1G-7 | `Titolo SEO prova collaudo 1G-7` | riuscito |
| `<title>` | idem | idem | riuscito |
| `meta description` | Descrizione SEO prova collaudo 1G-7 | idem | riuscito |
| `og:title` / `og:description` | Condivisione… / Descrizione di condivisione… | idem | riuscito |
| `robots` con noindex | contiene `noindex` | `noindex, max-image-preview:large` | riuscito |
| `robots` senza noindex | senza `noindex` | `max-image-preview:large` | riuscito |
| modello globale su pagina senza titolo proprio | coda `\| prova collaudo 1G-7` | `Servizi - Centro Amoris Laetitia \| prova collaudo 1G-7`, anche in `og:title` e nella linguetta | riuscito |
| modello su pagina con titolo proprio | invariato | `Titolo SEO prova collaudo 1G-7` | riuscito |
| modello ripristinato | coda sparita | `Servizi - Centro Amoris Laetitia` | riuscito |
| entro un minuto | — | tutto immediato, al primo caricamento | riuscito |
| anteprima = pubblica | — | intestazioni SEO identiche fra anteprima e sito | uguale |

Percorso e messaggi:

- Editor › scheda «SEO»: all'apertura «Nessuna sovrascrittura — Questo contenuto usa i template globali. Quello che si scrive qui vale solo per lui.».
- Dopo «Salva i metadati SEO»: «Fatto — Metadati SEO salvati.».
- Modello: «SEO e indirizzi» › «Template globali» › «Pagine» › «Template del titolo» › «Salva il template». **Nessun messaggio**: il pannello si chiude e la tabella si aggiorna.

Prove accessorie (dati strutturati, 5 s):

- **Sulla pagina:** «Tipo di dati strutturati» offre «Come il modello SEO», «Pagina web (WebPage)» e «Articolo di blog (BlogPosting)». Con BlogPosting compaiono `"@type":"BlogPosting"` e `"@type":"WebPage"`; riportato a «Come il modello SEO», resta solo `WebPage`.
- **Sul modello delle pagine:** BlogPosting compare su `/servizi/` e anche sulla pagina con SEO propria, che ha il tipo predefinito. Ripristinato, resta solo `WebPage`. Riuscito.

Tempi ed esito:

- Tempo: **8 s**. Esito: **riuscito**.
- Console: W8-09, compreso `GET /seo/contents/:id` 404 all'apertura della scheda SEO di un contenuto senza sovrascrittura.

Resta nel collaudo:

- su `prova-collaudo-1g-1`: titolo, descrizione, titolo e descrizione di condivisione di 1G-7;
- la pagina è indicizzabile e ha il tipo predefinito;
- i modelli globali sono come alla partenza: `{title} - {site_title}`, tipo vuoto.

## 5. HO-043 — redirect (1G-8)

Script `08-ho043.spec.ts`. Destinazione alternativa: `/prova-collaudo-1g-5/`, pubblicata e creata in HO-040.

| Stato | Risposta | Esito |
|---|---|---|
| non creato | `404` | riuscito |
| creato | `301` → `/prova-collaudo-1g-1/` | riuscito |
| modificato | `301` → `/prova-collaudo-1g-5/` | riuscito |
| riportato | `301` → `/prova-collaudo-1g-1/` | riuscito |
| spento («Attivo» tolto) | `404` | riuscito |
| riacceso | `301` → `/prova-collaudo-1g-1/` | riuscito |

Percorso e messaggi:

- «SEO e indirizzi» › «Redirect» › «Nuovo redirect». Il modulo ha «Indirizzo di partenza», «Indirizzo di arrivo», «Tipo di risposta» (301 predefinito), «Che cosa copre» e «Nota».
- Dopo «Crea il redirect» **nessun messaggio**, e la riga nuova non compare. L'elenco ha 182 righe in ordine alfabetico; la riga si ritrova solo con «Cerca fra i redirect».
- Per questo il primo tentativo dello script (10:28 UTC) si è fermato dopo la creazione, che era riuscita. È ripreso alle 10:30 cercando la riga (W8-17).
- Anche «Salva il redirect» non dà messaggi.
- La riga finale nell'elenco: «/prova-collaudo-1g-8/ | /prova-collaudo-1g-1/ | 301 | Scritto a mano | Attivo | 0».
- La colonna «Usi» resta **0** dopo almeno 6 risposte 301 (W8-18).

Tempi ed esito:

- Tempo: **13 s** dalla ripresa, più la creazione del primo tentativo.
- Esito: **riuscito con difficoltà**, perché il redirect appena creato non si vede.
- Console: solo W8-09.

Resta nel collaudo: il redirect `/prova-collaudo-1g-8/` → `/prova-collaudo-1g-1/`, 301, attivo, con la nota «redirect di prova collaudo 1G-8».

## 6. HO-044 — chi ha modificato (1G-9)

Script `09-ho044.spec.ts`.

Preparazione: su `Pagina di prova collaudo 1G-1` la prima parola del primo paragrafo è diventata «Cambiato», poi «Pubblica». Ora annotata: **11:32**, ora di Roma (10:32:05 UTC).

La parte 2 è stata ripresa una volta. Il primo passaggio si era fermato su due campi «Dal giorno» e «Al giorno» presi dall'etichetta in modo non esatto: un errore dello script, non dell'interfaccia.

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. chi e quando (Redazione, sessione nuova) | sotto il titolo dell'editor: «Ultima modifica di Agente di collaudo (redazione) il 28/10/2026 alle 11:32». Account giusto, scarto 0 minuti; trovato in 3 s | riuscito |
| 2. elenco per contenuto (Amministrazione) | Impostazioni › «Registro delle operazioni» › «Tutte le operazioni» › «Contenuto» = «Pagina di prova collaudo 1G-1 (Pagina)» › «Applica i filtri»: 42 righe in ordine di tempo, dalla creazione del 27/10 alle 23:28 (1G-1), alle 4 «Ha modificato la SEO» delle 11:27 (1G-7), fino a modifica e pubblicazione delle 11:32. Ogni riga ha persona, veste, orario ed esito | riuscito |
| 2. per persona e periodo | «Persona» = «Agente di collaudo (redazione)», dal 27/10 al 28/10: 147 righe, come nel database (147). Per «Redazione sintetica del collaudo»: 98, come nel database | riuscito |
| 3. ogni operazione ha la sua riga (1D-37) | vedi l'elenco qui sotto | riuscito |
| 4. password nelle righe | nessuna: né nell'interfaccia né nel dettaglio salvato nel database; nessuna chiave `"password"` | riuscito |

Operazioni ritrovate nel registro (1D-37), per compito:

- **1G-4:** salvataggio della copia, modifica, pubblicazione, scarto della copia.
- **1G-5:** 2 «Ha caricato un media», «Ha creato» la pagina 1G-5, «Ha sostituito un media», 3 «Ha modificato un media», 2 pubblicazioni, «Ha eliminato un media» riuscita (C) e «Non riuscita» (B).
- **1G-6:** «Ha modificato una voce di menu», molte righe (W8-16).
- **1G-7:** 4 «Ha modificato la SEO» e 4 «Ha modificato un modello SEO».
- **1G-8:** «Ha creato un reindirizzamento» e 4 «Ha modificato un reindirizzamento».
- **Accessi:** 15 «Accesso».
- **Pulizia:** cambio di layout come «Ha modificato» su «Sostegno alla genitorialità».

Operazioni senza riga: **nessuna**.

Difficoltà:

- **Nessun filtro per ora:** solo «Dal giorno» e «Al giorno». Una fascia dentro la giornata si scorre a mano.
- **Oggetti generici in alcune righe (W8-20):** «Media», «Reindirizzamento», «Modello SEO» e 32 volte «Voce di menu», per le voci senza etichetta propria.
- **Righe moltiplicate:** i 4 spostamenti di menu di HO-041 hanno prodotto circa 80 righe «Ha modificato una voce di menu» (W8-16).

Tempi ed esito:

- Tempi: parte 1 **3 s**; parte 2 **4 s** per il contenuto, **8 s** con le due persone.
- Esito: **riuscito**. Console: solo W8-09.

Resta nel collaudo: la parola «Cambiato» in testa al primo paragrafo di `prova-collaudo-1g-1`.

## 7. HO-045 — anteprima e sito (1G-10)

Script `10-ho045.spec.ts`. Creata `Pagina di prova collaudo 1G-10` (`/prova-collaudo-1g-10/`) con Testo, Immagine `prova-1g-2.png`, Testo, Testo, Immagine `prova-1g-5-a.png` e Testo. Prima della pubblicazione: 404, anche con la copia di lavoro salvata.

Per ogni pubblicazione lo script ha confrontato:

- il contenuto principale dell'HTML, tolti i dati di idratazione (W8-07);
- le fotografie a pagina intera dell'anteprima e del sito, a 1440 e a 390 px, pixel per pixel.

| Pubblicazione | Lavoro in corso: sito fermo prima di «Pubblica» | Anteprima vs sito, 1440 / 390 px | Esito |
|---|---|---|---|
| creazione | 404 fino alla pubblicazione | DOM uguale; 0 px / 0 px | uguale |
| 1. paragrafo 2 riscritto | sì | 0 px / 0 px | uguale |
| 2. immagine 1 sostituita con `mamma-papa-bambino-600x411.jpg` | sì | 0 px / 0 px | uguale |
| 3. layout da «Con barra laterale a destra» a «A tutta larghezza» | **no**: «Salva il layout» cambia subito la pagina pubblica, senza anteprima né «Pubblica» (W8-13) | 0 px / 0 px | uguale |
| 4. paragrafo 3 e immagine 2 scambiati («Sposta giù») | sì | 0 px / 0 px | uguale |
| 5. blocco aggiunto, paragrafo 4 eliminato | sì | 0 px / 0 px | uguale |

In tutte le pubblicazioni l'unica differenza fra anteprima e sito è `dateModified` nei dati strutturati, che l'anteprima non può ancora conoscere.

Come è stata fatta la modifica 2: l'ispettore del blocco Immagine non permette di scegliere un altro file (W8-06, ripetuto). Ho tolto il blocco con «Elimina: immagine», ne ho inserito uno nuovo, finito in coda, e l'ho riportato al suo posto con 4 «Sposta su». In tutto 6 gesti invece di 1.

Il layout cambia l'aspetto solo a schermo pieno: a 1440 px la pagina passa da 1546 a 1679 px di altezza; a 390 px resta identica.

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. cinque modifiche uguali fra anteprima e sito | 5 su 5, più la creazione | riuscito |
| 2. il lavoro in corso non tocca il sito | la **copia di lavoro** (salvataggio automatico) lascia il sito fermo. «**Salva**» su una pagina pubblicata la cambia **subito**: messaggio «Contenuto salvato.», stato `published`. Anche «Salva il layout» la cambia subito | **non riuscito** (W8-13) |
| 3. anteprima da anonimo | `/anteprima/<id>/` senza cookie: **404**, e la frase della copia di lavoro non compare | riuscito |
| 4. andata e ritorno | aperta e salvata senza modifiche: «Nessuna modifica: il contenuto non è stato riscritto.»; HTML pubblico senza idratazione identico prima e dopo | riuscito |
| 5. pubblicazioni precedenti difformi | **0**. In 1G-4, 1G-5 (due), 1G-10 (sei) e nell'intestazione SEO di 1G-7 anteprima e sito coincidono, salvo `dateModified`. Menu (1G-6) e redirect (1G-8) non hanno anteprima | — |

Tempi, esito e console:

- Tempo: **66 s** per creazione e cinque modifiche.
- Esito: **riuscito con difficoltà**. Anteprima e sito coincidono sempre; il criterio §4.2 cade su «Salva» e sul layout, e sostituire un'immagine costa 6 gesti.
- Console: W8-09, 10 volte; `DELETE /contents/:id/draft` 404, 2 volte (W8-03, ripetuto dopo il layout e dopo il riallineo); miniature 3301 404 (W8-01, ripetuto).

Resta nel collaudo:

- `Pagina di prova collaudo 1G-10`, pubblicata, `full_width`, 6 blocchi;
- il paragrafo 1 dice «Paragrafo 1 in bozza non pubblicata prova collaudo 1G-10.», pubblicato da «Salva», poi ripubblicato per riallineare editor e sito.

## 8. Difetti nuovi

| Id | Gravità | Dove | Difetto | Causa | Evidenza |
|---|---|---|---|---|---|
| W8-09 | bassa | area, console | Risposte attese segnate come errori rossi in console: `GET /auth/me` 401 sulla schermata di accesso; `GET /contents/:id/draft` 404 a ogni apertura dell'editor senza copia di lavoro; `GET /seo/contents/:id` 404 nella scheda SEO senza sovrascrittura. Chi segue gli handoff deve annotarli come errori | `apps/admin/src/lib/session.tsx:76`, `apps/admin/src/components/editor/ContentEditor.tsx:185`, `apps/admin/src/components/editor/ContentSeoPanel.tsx:121`: l'assenza è comunicata con un codice d'errore | in ogni giornale `risultati/*.jsonl` (`http>=400`, `console-error`) |
| W8-10 | media | Media › «Testo alternativo», «Titolo», «Didascalia»; blocco Immagine | Testo alternativo, titolo e didascalia cambiati in Media non arrivano alle pagine che già usano l'immagine: `alt` resta quello del blocco, la didascalia non compare. Il selettore del blocco non propone il testo alternativo già scritto in Media. L'aiuto di Media dice della didascalia «Compare sotto l'immagine, visibile a tutti». HO-040 §4.4 riesce solo ripetendo i valori nel blocco | `packages/blocks/src/render/Image.tsx:16`: `alt` del blocco prima di quello del media. `:43`: didascalia solo dal blocco. `apps/admin/src/components/editor/ImageInsertPicker.tsx:78-84`: l'`altText` del media non passa al selettore. Aiuto in `apps/admin/src/components/media/MediaLibrary.tsx:459` | `05-ho040.jsonl` (`dopo`: `alt="Prova collaudo 1G-5 A"`, `didascaliaNelSorgente:false`); `05-ho040-blocco.jsonl` |
| W8-11 | media | sito, blocco Immagine con didascalia fuori da una riga Divi | La didascalia (`figcaption`) ha altezza 0: il testo esce sotto l'immagine, tagliato e sovrapposto, a ogni larghezza | `apps/web/src/styles/blocks.css:310-313`: `.blk-image { line-height: 0 }`, ripristinato solo nelle righe flex (`:326-329`) | `risultati/ho040-figure.png`; altezza calcolata 0 px |
| W8-12 | bassa | blocco Immagine › «Titolo» | Il titolo dell'immagine, sia del blocco sia del media, non compare nel sorgente della pagina | `packages/blocks/src/render/Image.tsx:13`: `title` non viene letto | `05-ho040-blocco.jsonl` (`titolo:false`) |
| W8-13 | media (decisione) | editor › «Salva»; scheda «Pagina» › «Salva il layout» | Su un contenuto pubblicato «Salva» scrive subito il contenuto letto dal sito, senza anteprima né «Pubblica»; lo dice solo «Contenuto salvato.». «Salva il layout» fa lo stesso: «La pagina pubblica usa il nuovo layout.». Contraddice HO-045 §4.2: il lavoro in corso non deve toccare il sito finché non lo si pubblica. Solo la copia di lavoro automatica lo rispetta | `ContentEditor.tsx:285-320`: «Salva» fa `PATCH /contents/:id`, cioè il contenuto pubblicato (DR-068). `ContentLayoutPanel.tsx:46-50`: `PATCH` immediato. Da decidere se «Salva» debba scrivere solo la copia di lavoro su un contenuto pubblicato | `10-ho045.jsonl` (`sito-fermo-salva-senza-pubblicare:false`, `sito-fermo-m3-layout-prima-di-pubblicare:false`) |
| W8-14 | bassa | Menu › voce › «Chi vede questa voce» | «Solo a chi ha fatto accesso» e «Solo ad alcuni ruoli» nascondono la voce a tutti, anche a chi è entrato in Redazione. L'aiuto promette «La voce compare a chi è entrato…». Oggi il sito non ha un accesso per i visitatori | `apps/api/src/modules/public/service.ts:862`: `if (row.visibility !== 'public') return null`; testi in `apps/admin/src/components/menu/MenuItemPanel.tsx:26-38` | `06-ho041.jsonl` (`visibilita: anonimoVede false, redazioneVede false`) |
| W8-15 | bassa | Menu › albero delle voci | Le voci che usano il titolo del contenuto (etichetta vuota) hanno pulsanti senza nome per chi usa un lettore di schermo: «Prendi «» per spostarlo», «Sposta su:», «Annida:», «Elimina:» | `apps/admin/src/components/menu/MenuManager.tsx:88` passa `item.label`, vuota, invece del nome mostrato; `packages/ui/src/editor/MenuTreeEditor.tsx:130` | `risultati/aria-menu.yml` |
| W8-16 | bassa | Menu › «Sposta su», «Annida»; Registro | Il primo spostamento rinumera tutte le voci, perché le posizioni importate sono sparse (1, 2, 3, 9, 11, …). Il registro riceve una riga «Ha modificato una voce di menu» per ogni voce toccata: circa 80 righe per 4 gesti, 32 col solo «Voce di menu» | `apps/admin/src/lib/menu/tree.ts:106-114` rinumera 0…n e scrive ogni voce cambiata; `MenuManager.tsx:181-191` fa un PATCH per voce | `06-ho041.jsonl` (`db` prima e dopo); `09-ho044.jsonl` (conteggi per operazione) |
| W8-17 | bassa | SEO e indirizzi › «Redirect» › «Crea il redirect» e «Salva il redirect»; «Template globali» › «Salva il template» | Nessun messaggio di riuscita. Il redirect appena creato non compare: l'elenco è alfabetico e paginato (182 righe) e la riga si trova solo cercando | Nessun avviso in `apps/admin/src/components/seo/RedirectTable.tsx` (`createItem`/salvataggio) né in `SeoTemplates.tsx:100-125` | `08-ho043.tentativo1.jsonl` (fermo su «riga non visibile»); `07-ho042.jsonl` (`modello …` senza messaggi) |
| W8-18 | bassa | Redirect › colonna «Usi» | Il contatore degli usi resta 0 dopo ogni risposta 301, e così l'ultimo utilizzo | Nessun codice scrive `hit_count` o `last_hit_at`: solo letture in `apps/api/src/modules/redirects/service.ts:26-27` | `08-ho043.jsonl` (`db`: `hit_count` 0 dopo 6 redirect serviti) |
| W8-19 | bassa | Media › «Elimina» › «Elimina definitivamente» | Eliminazione riuscita senza nessun messaggio: il pannello si chiude e basta | `apps/admin/src/components/media/MediaLibrary.tsx:305-308`, nessun avviso dopo `DELETE` | `05-ho040-accessorie.jsonl` (`elimina-C`) |
| W8-20 | bassa | Impostazioni › Registro › colonna «Oggetto» | Alcune righe nominano solo il tipo: «Media» (caricamento, eliminazione riuscita), «Reindirizzamento» senza indirizzo, «Modello SEO» senza ambito, «Voce di menu» per le voci senza etichetta. Per rispondere «che cosa ha fatto» bisogna andare altrove | non cercata nel codice del registro | `09-ho044.jsonl` (`parte2-persona`) |
| W8-21 | bassa | editor › blocco «HTML (riserva)» | L'avviso «Questo blocco non è stato convertito, modificarlo può alterare la resa.» usa parole tecniche. Non dice che è codice del vecchio sito, che cosa rischia chi lo cambia, né che un frammento può essere invisibile, come il commento HTML di `/litighiamo-oggi/`. Voto 3/5 | `packages/ui/src/editor/HtmlFallbackEditor.tsx:62-64` | `04-ho039.jsonl` (`avvisi`); `risultati/ho039-avviso.png` |

Difetti noti che si sono ripresentati:

- **W8-01:** miniature `GET 3301/media/…` 404, in HO-040 e HO-045.
- **W8-03:** `DELETE` della bozza 404, 2 volte in HO-045.
- **W8-05:** l'albero del menu mostra «contenuto non trovato» per la voce che punta ad «Autostima e assertività», fuori dai 100 contenuti caricati.
- **W8-06:** in HO-045, sostituire l'immagine di un blocco richiede di togliere e reinserire il blocco.

W8-04 non si è presentato: nessuna voce di menu è stata aggiunta. W8-07 è stato aggirato confrontando l'HTML senza idratazione.

## 9. Che cosa resta nel collaudo

- `/dove-siamo/`, `/dal-vizioso-al-virtuoso/` e `/sostegno-alla-genitorialita/`: mappa, video e layout come alla partenza. Il testo e l'immagine di 1G-3 restano.
- `/litighiamo-oggi/`: la frase `[prova collaudo 1G-4]`.
- Media `prova-1g-5-a.png`: contiene il file B, con titolo, alt e didascalia 1G-5.
- `/prova-collaudo-1g-5/`: pubblicata, con `alt` B e didascalia.
- Menu principale:
  - ordine di partenza, con le posizioni rinumerate;
  - `Prova collaudo 1G-1` pubblica;
  - la voce `111`, residuo di HO-037 dichiarato tolto ma presente.
- `/prova-collaudo-1g-1/`:
  - SEO 1G-7: titolo, descrizione e condivisione; indicizzabile; tipo predefinito;
  - prima parola del paragrafo 1 cambiata in «Cambiato» (1G-9).
- Modelli SEO: come alla partenza.
- Redirect `/prova-collaudo-1g-8/` → `/prova-collaudo-1g-1/`, attivo.
- `/prova-collaudo-1g-10/`: pubblicata, a tutta larghezza.
- Registro: le righe dell'agente (147 come redazione, 2 come amministrazione alle 10:32 UTC).

## 10. Righe della matrice `docs/qa/editability-matrix.csv`

Testo proposto per `esito_collaudo`. La matrice non è stata modificata.

| tipo | campo | esito_collaudo |
|---|---|---|
| pagina e notizia | blocco di riserva «Blocco non convertito» | 1G-4 (agente): riuscito; frammenti identici; avviso capito a metà, voto 3/5 (W8-21) |
| pagina e notizia | blocco «Testo» | 1G-4 (agente): riuscito accanto al blocco di riserva; avviso «Testo salvato in una forma diversa» alla prima modifica |
| pagina e notizia | blocco «Mappa»: configurazione | pulizia (agente): segnaposto tolti e titolo ripristinato, riuscito |
| pagina e notizia | blocco «Video»: configurazione | pulizia (agente): indirizzo YouTube ripristinato, riuscito |
| pagina e notizia | layout della pagina (senza barra / barra a destra / tutta larghezza) | 1G-10 (agente): riuscito, anteprima uguale; cambia subito il sito senza «Pubblica» (W8-13) |
| pagina e notizia | blocco «Immagine»: testo alternativo | 1G-5 (agente): riuscito solo dal blocco; l'alt cambiato in Media non arriva (W8-10) |
| pagina e notizia | blocco «Immagine»: titolo e didascalia | 1G-5 (agente): didascalia nel sorgente ma illeggibile (W8-11); titolo mai sul sito (W8-12) |
| pagina e notizia | blocco «Immagine»: file e collegamento | 1G-5/1G-10 (agente): file sostituito da Media riuscito; nel blocco si toglie e si reinserisce (W8-06) |
| pagina e notizia | ordine e annidamento dei blocchi | 1G-10 (agente): riuscito, anteprima uguale |
| pagina e notizia | eliminare un blocco | 1G-10 (agente): riuscito, anteprima uguale |
| pagina e notizia | copia di lavoro | 1G-10 (agente): non tocca il sito; «Salva» invece pubblica subito (W8-13) |
| pagina e notizia | anteprima sul sito | 1G-10 (agente): uguale al sito in 9 pubblicazioni su 9, a 1440 e 390 px; 404 da anonimo |
| pagina e notizia | stato (bozza / pubblicato) | 1G-10 (agente): 404 fino alla pubblicazione, poi riuscito; W8-03 ripetuto |
| pagina e notizia | ultima modifica (chi e quando) | 1G-9 (agente): riuscito, account e minuto esatti, 3 s |
| pagina e notizia | titolo SEO | 1G-7 (agente): riuscito, in `<title>`, `og:title` e linguetta |
| pagina e notizia | descrizione SEO | 1G-7 (agente): riuscito |
| pagina e notizia | non indicizzare | 1G-7 (agente): riuscito, `noindex` messo e tolto |
| pagina e notizia | titolo di condivisione | 1G-7 (agente): riuscito |
| pagina e notizia | descrizione di condivisione | 1G-7 (agente): riuscito |
| pagina e notizia | tipo di dati strutturati | 1G-7 (agente): riuscito, BlogPosting messo e tolto |
| SEO (template) | template del titolo | 1G-7 (agente): riuscito e ripristinato; nessun messaggio al salvataggio (W8-17) |
| SEO (template) | tipo di dati strutturati | 1G-7 (agente): riuscito su tutte le pagine e ripristinato |
| voce di menu | ordine e annidamento | 1G-6 (agente): riuscito a schermo e da telefono; W8-15, W8-16 |
| voce di menu | visibilità per ruolo | 1G-6 (agente): l'anonimo non la vede, ma neppure chi è entrato (W8-14) |
| redirect | indirizzo di partenza | 1G-8 (agente): riuscito, 404 poi 301; riga nuova non visibile senza cercarla (W8-17) |
| redirect | indirizzo di arrivo | 1G-8 (agente): riuscito, cambiato e riportato |
| redirect | tipo di risposta | 1G-8 (agente): 301 predefinito, verificato |
| redirect | nota | 1G-8 (agente): riuscito |
| redirect | attivo | 1G-8 (agente): riuscito, spento dà 404, riacceso 301 |
| redirect | contatore di utilizzi e ultimo utilizzo | 1G-8 (agente): resta 0 (W8-18) |
| media | caricare un file | 1G-5 (agente): riuscito, dimensioni derivate generate |
| media | sostituire il file | 1G-5 (agente): riuscito, stesso indirizzo, B in tutte le varianti e larghezze |
| media | titolo | 1G-5 (agente): salvato ma non arriva alla pagina (W8-10, W8-12) |
| media | testo alternativo | 1G-5 (agente): salvato ma non arriva alla pagina né al selettore (W8-10) |
| media | didascalia | 1G-5 (agente): salvata ma non arriva alla pagina (W8-10) |
| media | eliminare | 1G-5 (agente): in uso rifiutato con messaggio chiaro; libero eliminato senza conferma a schermo (W8-19) |
| media | indirizzo pubblico, tipo, dimensioni e versioni derivate | 1G-5 (agente): indirizzo e 4 varianti invariati dopo la sostituzione |
| registro | consultazione e filtri | 1G-9 (agente): riuscito per contenuto e per persona, nessuna password; oggetti generici (W8-20), righe moltiplicate dal menu (W8-16) |
