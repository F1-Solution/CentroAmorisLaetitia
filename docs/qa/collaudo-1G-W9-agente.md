# Collaudo 1G-W9 — compiti ripetuti dall'agente (T11)

Collaudo eseguito dall'agente con Playwright il 2026-10-30, dalle 06:06 alle 06:53 UTC (07:06–07:53 ora di Roma).

**Ambiente.** Collaudo sul commit `aaedbf5`:

- sito `127.0.0.1:3300`, area `127.0.0.1:3301/admin`, API `127.0.0.1:3302`;
- database `amoris_collaudo`, copia fresca dello sviluppo;
- il collaudo non ha mai risposto 500 o 503 e non è stato riavviato.

**Account.**

- `editor` («Redazione») e `amministrazione` («Impostazioni») dell'agente (DR-291).
- Due account sintetici di prova creati dall'area:
  - `Persona di prova collaudo 1G-16` (Redazione);
  - `Seconda amministrazione di prova collaudo 1G-16` (Amministrazione), il «terzo account» usato per la propria password e il proprio indirizzo.
- Le password generate stanno solo in `C:\work\amoris-collaudo.stato\account-prova-1g-16-w9.json`.

**Scritture.** Ogni scrittura è passata dall'interfaccia dell'area. Unica eccezione: le prove di rifiuto chieste dal brief, fatte dall'API con la sessione dell'area (DR-314 e W8-38), e tutte rifiutate. Il database è stato solo letto, con SELECT. Non ho toccato `amoris`, i server di sviluppo, Docker (salvo `docker exec … psql` in sola lettura per le SELECT, come `sql()` della W8), il codice né Git.

**Strumenti.** Stanno in `.superpowers/sdd/strumenti-1G/collaudo-w9/`, cartella ignorata da Git:

| File | Contenuto |
|---|---|
| `playwright.config.ts` | trace, video e fotografie automatiche spenti |
| `supporto-w9.ts` | giornali propri; `sorveglia()` registra anche le richieste interrotte e gli avvisi gialli; riusa `sql()`, `htmlPubblico()` e il confronto senza idratazione della W8 |
| `aiuti-w9.ts` | aiuti dell'editor |
| `01-…09-*.spec.ts` | uno o più spec per compito |
| `passo-w9.ts`, `esplora/e01…e16` | esplorazione a passi |
| `console.mjs` | riepilogo della console |
| `controlla-riservatezza.mjs` | controllo finale di riservatezza |
| `risultati/*.jsonl`, `risultati/*.png` | giornali e fotografie |
| `risultati/partenza.txt`, `risultati/fine.txt` | stato del database prima e dopo |

**Tempi.** Sono quelli dello script, quindi un limite inferiore per una persona. Dove lo script ha atteso a vuoto o si è fermato per un mio errore, lo dico e do il tempo utile.

**Errori dello script, non dell'area.** In tre punti lo script ha sbagliato:

- in 1G-1 ha scritto tre volte nel primo blocco «Testo»;
- in 1G-2 ha cercato un selettore ambiguo, poi alla ripresa ha ripetuto la frase;
- in 1G-5 la lettura dei colori è partita da una pagina vuota.

Ogni volta ho corretto dall'area e l'ho annotato. Uno di questi incidenti ha fatto emergere il difetto nuovo **N1**.

---

## 0. Partenza

Lo stato di partenza è stato letto con SELECT (`risultati/partenza.txt`):

- impostazioni;
- menu: 64 voci;
- contenuti: 108;
- media: 178;
- `content_seo`: 2 righe;
- account: 10, di cui 2 attivi;
- slide: 12;
- redirect: 181;
- registro: 249 righe.

Del blocco Immagine e del primo blocco «Testo» di `/reinventa-la-tua-vita/` ho salvato solo le proprietà e le impronte, non il testo, che contiene dati reali.

---

## 1. Compito 1G-1 — HO-036, pagina, menu, ritiro (account editor)

Spec `01-1g1.spec.ts` e `01b-1g1-testi.spec.ts`.

**Passi:**

1. `/prova-collaudo-1g-1/` e `-bis/` rispondono 404 prima di cominciare.
2. «Nuova pagina»: titolo «Pagina di prova collaudo 1G-1», indirizzo `prova-collaudo-1g-1`, «Crea in bozza».
3. Blocchi: tre «Testo», «Separatore» e «Immagine» con il media «Volantino».
   - Nel selettore il testo alternativo parte vuoto, perché il media non ne ha uno.
   - Ho scritto «Immagine di prova collaudo 1G-1» › «Usa questo media».
4. Due blocchi a scelta:
   - «Media e testo» con «Volantino 10 anni»: il pannello apre il selettore delle immagini (DR-320);
   - «Documento» (finestra «Quale documento?», con i soli 4 documenti pubblici).
5. Prima della pubblicazione, con la copia di lavoro salvata: 404 da anonimo. Poi anteprima e «Pubblica» › «Contenuto pubblicato.».
6. Corredo › Menu › «Aggiungi una voce», per prima cosa **senza scegliere il contenuto**:
   - «Non è stata aggiunta — Scegli il contenuto a cui punta la voce.»;
   - poi con «Pagina di prova collaudo 1G-1», etichetta «Prova collaudo 1G-1», primo livello: «Fatto — Voce aggiunta.».
7. Pagina «bis» creata, scritta, pubblicata (200), poi «Ritira» › «Contenuto ritirato: non è più raggiungibile dal pubblico.» › 404.

**Verifiche §4:**

- 200; titolo, tre paragrafi in ordine, separatore, `alt="Immagine di prova collaudo 1G-1"`, collegamento al documento;
- voce nel menu del sito verso `/prova-collaudo-1g-1/`, primo livello, `public`;
- anteprima e sito uguali in tutte e tre le pubblicazioni, salvo la scrittura (`srcset`/`srcSet`, `/>`).

**Incidente dello script.** Al primo passaggio lo script ha scritto i tre paragrafi sempre nel primo blocco «Testo»: due blocchi sono stati pubblicati vuoti. L'ho corretto riscrivendo i blocchi 2 e 3 e ripubblicando (`01b`, 8 s): paragrafi in ordine, verificato.

**Esito: riuscito.**

- Tempi: pagina fino alla pubblicazione 18 s; voce di menu 4 s; pagina «bis» pubblicata e ritirata 8 s; totale 32 s, più 8 s di ripresa.
- Messaggi: «Contenuto pubblicato.», «Voce aggiunta.», «Contenuto ritirato: non è più raggiungibile dal pubblico.», «Non è stata aggiunta — Scegli il contenuto a cui punta la voce.».
- Console: **0 errori**, 0 eccezioni, 0 risposte ≥ 400. Rumore classificato al §9: richieste interrotte, avvisi gialli di Next sui CSS.

**Difetti W8:**

| Difetto | Stato | Prova |
|---|---|---|
| W8-01 | **risolto** | nel selettore del blocco Immagine e di «Media e testo» le miniature arrivano da `http://127.0.0.1:3300/media/…`, tutte caricate (8 su 8) |
| W8-04 | **risolto** | la prima opzione è «Scegli un contenuto»; senza scelta, messaggio italiano e nessuna voce creata (`count(*)=0`) |
| W8-05 | **risolto** | 109 opzioni di contenuto più «Scegli un contenuto», pari ai 109 contenuti del database, compreso il meno recente «Autostima e assertività»; l'albero mostra quella voce senza «contenuto non trovato» |
| W8-15 | **risolto** | nessun pulsante dell'albero ha nome vuoto; le voci senza etichetta propria si chiamano col titolo («Prendi «Chi siamo» per spostarlo») |
| W8-03 | **risolto** | dopo ogni «Pubblica» il registro ha `content.draft.discard success` e nessun 404; «Ritira» lascia solo `content.unpublish success` |

**Difetto nuovo:** nell'elenco «Contenuto» due opzioni sono **vuote**: la pagina iniziale, senza titolo, e una notizia in bozza senza titolo (N2).

---

## 2. Compito 1G-2 — HO-037, frase e immagine su `/reinventa-la-tua-vita/` (account editor)

Spec `02-1g2.spec.ts`; correzioni `esplora/e07`, `e08`; ripristino `02d-1g2-ripristino.spec.ts`.

**Passi:**

1. Media › caricato `prova-1g-2.png` (1600×900, sintetico).
2. Pagine › ricerca «Reinventa la tua vita» › editor. Nel primo blocco «Testo», in testa, «[prova collaudo 1G-2] ». Avviso: «Testo salvato in una forma diversa…», già noto.
3. Blocco Immagine › **«Cambia immagine»** (DR-294) › `prova-1g-2` › testo alternativo «Immagine di prova collaudo 1G-2» › «Usa questo media» › «Didascalia» = «Didascalia di prova collaudo 1G-2».
4. Anteprima › «Pubblica» › «Contenuto pubblicato.».

**Verifiche §4:**

- la frase compare;
- nel main c'è **una** sola immagine, quella nuova, e non c'è più la vecchia;
- `alt` giusto; `<figcaption>Didascalia di prova collaudo 1G-2</figcaption>`;
- a 1440 px il file servito è `prova-1g-2.png`, a 390 px `prova-1g-2-480x270.png`;
- la didascalia sta sotto l'immagine, alta 22 px, senza sovrapposizioni (`02-figura-1440.png`, `02-figura-390.png`).

Per la riservatezza non ho fatto fotografie a pagina intera: la pagina contiene recapiti e coordinate bancarie. Il confronto «resto invariato» l'ho fatto sul testo, e l'anteprima coincide con il sito.

**Incidenti dello script:**

- **Primo passaggio.** Si è fermato su un selettore ambiguo («Testo alternativo» trovava anche la spunta), dopo aver salvato la copia di lavoro. Alla ripresa l'editor ha detto «Ripresa la copia di lavoro salvata alle 07:19. Il contenuto pubblicato non è cambiato.». Lo script non ha riconosciuto la frase già scritta e l'ha ripetuta: è stata pubblicata **due volte**.
- **Prima correzione (e07).** 22 «Canc» premuti senza pausa ne hanno applicati solo 16. È stato pubblicato « 1G-2] [prova collaudo 1G-2] Cambiare…», un **testo sbagliato senza alcun avviso** (N1).
- **Seconda correzione (e08).** Con 150 ms fra un tasto e l'altro la frase è tornata unica. Pubblicato.

**W8-13 secondo DR-293** (spec `02b`, sulla pagina di prova 1G-1):

- con la sola copia di lavoro il sito resta fermo;
- il pulsante si chiama «**Salva e aggiorna il sito**», con l'avviso «Le modifiche salvate compaiono subito sul sito.»;
- premuto, il sito cambia subito («Contenuto salvato.»), come DR-293 stabilisce.

> Nota: il brief descrive W8-13 come «Salva» che scrive solo la copia di lavoro. DR-293 («Lasciare com'è, ma dirlo») e la T3 hanno scelto il contrario. Ho verificato il comportamento di DR-293.

**Prove accessorie** (spec `02c` e `e11`, sulla pagina 1G-1, 11 s):

- **Titolo:** spento, un solo `<h1 class="screen-reader-text">`; riacceso, `<h1 class="entry-title main_title">`. Messaggio «Impostazioni salvate — Il sito usa le nuove impostazioni.».
- **Immagine in evidenza:** `prova-1g-2.png` compare in `primaryImageOfPage` e come miniatura nella ricerca `/?s=collaudo+1G-1`. Nel corpo (`<article>`) non c'è. Poi «Togli l'immagine»: sparisce.
  - Né la scelta né la rimozione danno un messaggio, ed entrambe cambiano subito il sito (N4).
- Stato finale: titolo visibile, nessuna immagine in evidenza.

**Ripristino della pagina** (`02d`, 13 s):

- tolta la frase, con le pause;
- «Cambia immagine» › `IMG-20231223-WA0003` con «decorativa», didascalia vuota;
- pubblicato: frase assente, `alt=""`, nessuna didascalia.

Restano piccole differenze, al §13.

**Esito: riuscito con difficoltà.**

- Il percorso previsto ora funziona: un solo blocco, una sola immagine, `alt` e didascalia leggibili.
- La difficoltà è N1: tasti persi, testo sbagliato pubblicato senza avviso.
- Tempo utile dello script: circa 10 s per frase, immagine, didascalia e pubblicazione; prove accessorie 11 s; ripristino 13 s.
- Console: **0 errori** in tutti gli spec di 1G-2.

**Difetti W8:**

| Difetto | Stato | Prova |
|---|---|---|
| W8-06 | **risolto** | «Cambia immagine» nell'ispettore, con l'avviso «Due modi per cambiare il file…»; dopo la pubblicazione `immagini: 1`, `vecchiaAncora: false` |
| W8-13 | **risolto secondo DR-293** | vedi sopra |
| W8-01 | **risolto** | miniature anche nel selettore dell'immagine in evidenza (6 su 6 da 3300) |

---

## 3. Compito 1G-5 — HO-040, sostituire un'immagine (account editor)

Spec `03-1g5.spec.ts`.

**Passi:**

1. Media › caricata A (`prova-1g-5-a.png`, blu) › «Testo alternativo» = «Prova collaudo 1G-5 A» › «Salva» › «Fatto — Modifiche salvate.».
2. «Pagina di prova collaudo 1G-5» › blocco Immagine › A.
   - Il **selettore propone** «Prova collaudo 1G-5 A» con l'aiuto «Proposto dal media: se non lo cambi, il sito userà sempre quello del media.».
   - «Usa questo media»: nel blocco `alt` resta `""`. L'aiuto dell'ispettore dice: «Se lo lasci vuoto, il sito usa quello scritto in Media.».
3. «Pubblica»: sito `alt="Prova collaudo 1G-5 A"`.
4. Media › «Sostituisci il file» con B (arancione).
   - Finestra: «Il file attuale e le sue dimensioni derivate non si potranno recuperare: «prova-1g-5-b.png» prenderà il loro posto sullo stesso indirizzo.»
   - Esito: «Fatto — File sostituito. L'indirizzo non è cambiato: le pagine che lo citano mostrano il file nuovo. 14 dimensioni derivate rigenerate.»
5. Nello stesso pannello: Titolo «Titolo prova collaudo 1G-5», Testo alternativo «Prova collaudo 1G-5 B», Didascalia «Didascalia prova collaudo 1G-5» › «Salva». Nessuna ripubblicazione della pagina.

**Verifiche §4:**

| Verifica | Osservato | Esito |
|---|---|---|
| 1. B e non A | colore letto nel browser: B | riuscito |
| 2. ogni dimensione | 1440, 1280, 1024, 980, 768, 480, 390 px: sempre B (`prova-1g-5-a.png`, `-1280x720`, `-980x551`, `-480x270`); i 4 indirizzi di `src`/`srcset` aperti uno a uno: tutti B | riuscito |
| 3. stesso indirizzo | `/media/2026/10/prova-1g-5-a.png` e varianti identici prima e dopo | riuscito |
| 4. `alt` B e didascalia | **solo dalla via «Media»**: `alt="Prova collaudo 1G-5 B"` e `<figcaption>Didascalia prova collaudo 1G-5</figcaption>` | riuscito |
| 5. anteprima = sito | uguali, 2 pubblicazioni su 2 | riuscito |

**W8-11 a vista** (`03-figura-1440.png`, `03-figura-390.png`, fotografie guardate):

- la didascalia sta sotto l'immagine, leggibile, non tagliata né sovrapposta;
- a ogni larghezza è alta 22 px, con `line-height: normal`;
- la figura passa da 451 a 473 px a 1440.

**W8-12:** il titolo scritto in Media non arriva al sito (DR-313, come dice l'aiuto di Media). Scritto nel blocco («Titolo del blocco prova collaudo 1G-5») e ripubblicato, compare come `title="…"`.

**Prove accessorie** (`03b`, 15 s):

- **B in uso:** la finestra chiede il nome; il rifiuto dice «Il media è citato da questi contenuti e non si elimina finché lo citano: Pagina di prova collaudo 1G-5.» (risposta 409).
- **C libera:** eliminata, «Fatto — File eliminato.»; nel selettore «Nessun media trovato.».

**Incidente dello script.** Il primo passaggio si è fermato dopo la sostituzione, perché la lettura dei colori partiva da una pagina vuota. Le verifiche sono state rifatte alla ripresa, senza ripetere la sostituzione.

**Esito: riuscito.**

- Tempi: sostituzione più testi 3 s; compito fino ai testi salvati 16 s; verifiche e titolo del blocco 13 s.
- Console: 1 errore, il **409** del rifiuto atteso (§9); nessun altro.

**Difetti W8:**

| Difetto | Stato | Prova |
|---|---|---|
| W8-10 | **risolto** (DR-305, DR-312) | selettore con l'alt di Media proposto; blocco vuoto, sito con l'alt e la didascalia di Media anche dopo il cambio in Media |
| W8-11 | **risolto** | fotografie e misure sopra |
| W8-12 | **risolto** secondo DR-313 | `title` del blocco nel sorgente |
| W8-19 | **risolto** | «File eliminato.» (DR-316) |

**Osservazione:** con l'`alt` lasciato al media, l'albero dei blocchi chiama l'immagine solo «Immagine — immagine» (N5).

---

## 4. Compito 1G-13 — HO-048, eliminare contenuti (account editor)

Spec `04-1g13.spec.ts`, `04b-1g13-registro.spec.ts`, `esplora/e12`.

**Preparazione (25 s):** create e pubblicate quattro pagine.

- «… 1G-13» e «… 1G-13 madre».
- «… figlia», con genitore impostato da «Indirizzo» › «Pagina genitore» › «Salva l'indirizzo». Messaggio: «Indirizzo salvato — L'indirizzo ora è /prova-collaudo-1g-13-madre/prova-collaudo-1g-13-figlia/; sarà pubblico quando il contenuto verrà pubblicato.».
- «… in menu», con la voce «Prova collaudo 1G-13 in menu» («Voce aggiunta.»).

Tutte rispondono 200.

| Verifica §4 | Osservato | Esito |
|---|---|---|
| 1. conferma, «Annulla» non cambia | «Elimina il contenuto — Il contenuto sparisce con la sua copia di lavoro, i dati SEO e i legami alle categorie; il registro conserva titolo e indirizzo. Il suo indirizzo risponderà «pagina non trovata». Digita «…» per confermare»; «Annulla»: pagina ancora presente | riuscito |
| 2. madre | «Non si può eliminare — Ha delle pagine figlie: vanno spostate o eliminate prima. Pagina di prova collaudo 1G-13 figlia (/prova-collaudo-1g-13-madre/prova-collaudo-1g-13-figlia/)» | riuscito |
| 3. in menu | «Non si può eliminare — È usato in un menu: le voci vanno tolte prima dal menu. Prova collaudo 1G-13 in menu, nel menu Menu principale» | riuscito |
| 4. pagina iniziale | riconosciuta **senza aiuto** (dettaglio sotto); «Non si può eliminare — È la pagina iniziale del sito: indica prima un'altra pagina iniziale.» | riuscito |
| 5. isolata | «Contenuto eliminato — Il contenuto è stato eliminato definitivamente.»; 404; assente da «Pagine» | riuscito |
| 6. ordine accettato | figlia, madre, voce («Voce eliminata.»), pagina in menu: 0 pagine e 0 voci 1G-13; menu del sito senza la voce | riuscito |
| 7. pagina iniziale | `/` 200, `published` | riuscito |

La pagina iniziale si riconosce in due punti:

- **elenco:** riga «Senza titolo — Pagina iniziale | /home/ | Pubblicata». Il collegamento si chiama «Senza titolo»; «— Pagina iniziale» sta accanto;
- **editor:** titolo «Pagina iniziale» e riga «/home/ — pubblicato — pagina iniziale».

**DR-314:**

- nell'editor della pagina iniziale «Ritira» è **disattivato**, con l'aiuto «La pagina iniziale non si può ritirare: prima scegline un'altra nelle Impostazioni.»;
- dall'API, con la sessione dell'area, `POST /contents/<home>/unpublish` risponde **409** `CONTENT_IS_HOME` con «Il contenuto è la pagina iniziale del sito: scegli prima un'altra pagina iniziale.»;
- la home resta pubblicata.

**Registro (1D-37, account amministrazione, 2 s):**

- le 5 eliminazioni (4 pagine e la voce) hanno «Ha eliminato <titolo> — Riuscita», con persona e ora;
- le righe precedenti degli stessi contenuti conservano il titolo: nessun «contenuto non più presente» (W8-29);
- il tentativo di ritiro della home compare come «Ha ritirato /home/ — Non riuscita».

**Esito: riuscito.**

- Tempi: 64 s per il compito, di cui circa 40 s di attese a vuoto dello script (due ricerche di elementi inesistenti con il limite di 20 s). Tempo utile circa 24 s; con la pulizia 82 s.
- Console: 1 errore, il 409 della mia chiamata API voluta (§9).

**Difetti W8:**

| Difetto | Stato | Prova |
|---|---|---|
| W8-24 | **risolto** | dettaglio sopra; `e12`: la riga si apre al primo clic |
| DR-314 | **attuato** | pulsante disattivato con aiuto; API 409 in italiano |
| W8-29 | **risolto** | come osservato nel registro |

---

## 5. Compito 1G-16 — HO-051, parti A, B, C (account amministrazione)

Spec `05a-1g16-ac.spec.ts`, `05b-1g16-b.spec.ts`, `05c-1g16-c3.spec.ts`, `05d-1g16-registro.spec.ts`.

> Scostamento dall'handoff, come nella W8: la seconda amministrazione è creata dall'area, non con `tools\collaudo\crea-account.ps1`.

### Parte A (compito, 39 s)

| Verifica §4 | Osservato | Esito |
|---|---|---|
| 1. creato, attivo, Redazione | «Nuova persona» › «Crea account» › riquadro «Password temporanea per … Questa password non verrà mostrata di nuovo…» › «Ho consegnato la password» › «Fatto — **Account creato.**». Riga: Redazione, Attivo, «Mai». Dopo la chiusura la password non è più nella pagina | riuscito |
| 2. entra, lavora, niente Impostazioni | primo accesso › «Cambia password — Prima di proseguire scegli una nuova password.» › scelta dell'area. Aree: solo «Redazione»; «Pagine» si apre; `/admin/impostazioni`, `/persone` e `/registro` riportano a «Pagine» **senza 401/403 in console** | riuscito |
| 3. reimpostazione | finestra «Per … nasce una password temporanea, mostrata una sola volta; le sue sessioni si chiudono…» › «Reimposta». Sessione aperta chiusa; vecchia password: «Accesso non riuscito — Indirizzo o password non corretti.»; la temporanea entra e chiede la nuova | riuscito |
| 4. disattivato | «Fatto — **Account disattivato.**»; sessione chiusa; accesso: «Accesso non riuscito — Indirizzo o password non corretti.», **identico** a quello di un indirizzo inesistente | riuscito |
| 5. riattivato | «Fatto — **Account riattivato.**»; entra; disattivato di nuovo alla fine | riuscito |
| 6. nessuna password visibile | sì, salvo il riquadro temporaneo | riuscito |
| 7. registro | «Ha creato un account», «Ha reimpostato una password», «Ha disattivato un account», «Ha riattivato un account», tutti di Agente di collaudo (amministrazione) | riuscito |

### Parte C, punti 1-2 (13 s)

- «Modifica nome ed email di …»: per un altro account la password attuale **non è chiesta**.
- L'indirizzo di un altro account è rifiutato con «Modifiche non salvate — Esiste già un account con questo indirizzo.» (409); nome invariato.
- Con l'indirizzo nuovo: «Fatto — Modifiche salvate.», e la riga mostra nome e indirizzo nuovi.
- La finestra avvisa: «Cambiando l'indirizzo si chiudono tutte le sessioni aperte di …».
- La sessione dell'account di prova si chiude: entra con l'indirizzo nuovo, non con il vecchio.

### Parte B (20 s di modifiche, 17 s di ripristino)

Ogni salvataggio dice «Salvata.».

| Impostazione | Effetto sul sito |
|---|---|
| Titolo | 404: «404 Non trovato \| Centro Amoris Laetitia - prova collaudo 1G-16»; `/servizi/` col modello; la home no, perché ha un titolo SEO proprio |
| Descrizione | nessun effetto visibile, come nella W8 |
| Piè di pagina | «Piè di pagina di prova collaudo 1G-16» visibile |
| Indirizzo e telefono | nei dati strutturati della home |
| Articoli per pagina | 7: nessun effetto (atteso); `0`: «Non è stata salvata — «Articoli per pagina» deve essere un numero intero da 1 a 50.», valore rimasto 7 |
| Formato data `d/m/Y` | pagina del documento «05/04/2022»; la data delle notizie resta «23 Feb 2026» (atteso) |
| Lingua `en_US` | `<html lang="en">`, `og:locale` `en_US`; ripristinata `it`/`it_IT`. Mesi in inglese non verificabili: il formato era ancora `d/m/Y` |
| Fuso `UTC`, formato ora `H:i`, primo giorno `0` | salvati, nessun effetto (atteso) |
| robots.txt e sitemap | 200 prima, durante e dopo; nessun valore riservato visibile |

**Ripristino.** Tutti i valori sono tornati come alla partenza, salvo uno: `site.description` passa da `""` a `null`. È l'effetto voluto della correzione W8-37: un testo vuoto vale `null` dove il formato lo ammette (`apps/api/src/modules/settings/routes.ts:57`, `emptyAsNull`). Il sito non mostra differenze.

### Parte C, punto 3 (106 s, di cui circa 65 s di ritardo progressivo dopo le password errate)

Le prove sono state fatte con la seconda amministrazione, entrata in una sessione propria.

| Obiettivo | Osservato | Esito |
|---|---|---|
| propria riga | solo «Modifica» e «Ruoli», né «Reimposta password» né «Disattiva» | riuscito |
| proprio nome | senza password: «Scrivi la tua password attuale.», più il fumetto nativo del browser; errata: «La password attuale non è corretta.», nome invariato nel database; giusta: «Fatto — Modifiche salvate.», ma dopo **21 s** di attesa | riuscito |
| propri ruoli | senza password ed errata: rifiutati, ruoli invariati (`amministrazione`); giusta: `amministrazione,editor` (22 s di attesa) | riuscito |
| togliersi la Redazione (W8-28) | ruoli salvati; si torna all'accesso con «**Fatto — Ruoli cambiati: la sessione è stata chiusa. Entra di nuovo.**» | riuscito |
| propria password (W8-27) | menu della persona: nome, indirizzo, «**Cambia la password**», «Disconnetti» › pagina «Cambia password — Scegli una nuova password.» con «Annulla». Attuale errata: «Password non cambiata — La password attuale non è corretta.», e la vecchia entra ancora; giusta: la nuova entra, la vecchia no | riuscito |
| proprio indirizzo | con la password giusta la sessione si chiude; all'accesso «**Fatto — Indirizzo cambiato: entra di nuovo con il nuovo indirizzo.**», che resta anche dopo un accesso fallito (DR-317); vecchio indirizzo respinto, nuovo accettato | riuscito |
| blocco dei tentativi | mai comparso: 3 password attuali errate e 7 accessi falliti in tutto, dallo stesso indirizzo di rete | — |
| disattivata alla fine | «Account disattivato.» | riuscito |

**Registro (`05d`):**

- le operazioni sono a nome di chi le ha fatte;
- **nessuna** riga mostra un indirizzo email (0) e nessun dettaglio ha chiavi di password (0);
- le password attuali errate su nome e ruoli restano nel database come `auth.password_changed failure` con `source: "account"`, ma **l'elenco non le mostra**: compare solo «Ha modificato un account — Non riuscita» o «Ha cambiato i ruoli … — Non riuscita» (W8-30);
- le righe sugli account hanno come oggetto solo «Account» (osservazione, §12).

**Esito: A riuscita; B riuscita; C riuscita.**

- Nessuna difficoltà funzionale.
- Unica fatica: dopo una password attuale errata, ogni salvataggio successivo del proprio account attende 21-22 s, anche con la password giusta. È il ritardo progressivo voluto (`apps/api/src/auth/loginAttempts.ts:71`), già visto nella W8: osservazione O1.

**Console:** 401 per ogni accesso volutamente sbagliato; 409 per l'indirizzo già usato; 400 per «Articoli per pagina» = 0; 403 per ogni password attuale errata. Tutte risposte attese a rifiuti provocati dal compito (§9). **0 errori dell'applicazione.**

**Difetti W8:**

| Difetto | Stato | Prova |
|---|---|---|
| W8-27 | **risolto** | «Cambia la password» nel menu della persona |
| W8-28 | **risolto** | messaggio «Ruoli cambiati: la sessione è stata chiusa. Entra di nuovo.» |
| W8-37 | **risolto** | `analytics.ga4_measurement_id` e `contact.address`: `null` › valore › svuotati › di nuovo `null`; `contact.phone` (`""`) resta `""`. Effetto collaterale su `site.description`, sopra |
| W8-23 (Persone e permessi) | **risolto** | «Account creato.», «Account disattivato.», «Account riattivato.», «Modifiche salvate.», «Indirizzo cambiato…» |
| W8-32 | **risolto** | nessun 401/403 in console nei rinvii da Impostazioni |
| W8-30 | **risolto nell'elenco** | vedi il registro sopra |

---

## 6. W8-34 e W8-35 — immagine di condivisione (account editor)

Spec `06-seo-immagine.spec.ts`, sulla pagina di prova 1G-1. Tempi: scelta 9 s, rimozione 4 s.

**Passi:**

1. Scheda SEO › «Scegli immagine di condivisione» › «Scegli un media» › «Titolo prova collaudo 1G-5».
   - «**Usa questo media**» è subito attivo e la finestra non ha alcun campo «Testo alternativo» (W8-35).
2. La scheda mostra «Immagine di condivisione: Titolo prova collaudo 1G-5» e «Togli l'immagine» › «Salva i metadati SEO» › «Fatto — Metadati SEO salvati.».
3. Sorgente pubblico e anteprima: `og:image` = `http://127.0.0.1:3300/media/2026/10/prova-1g-5-a.png`; `og_image_id` è quello del media.
4. **Ricarica:** la scheda dice ancora «Immagine di condivisione: Titolo prova collaudo 1G-5», con «Cambia immagine di condivisione» e «**Togli l'immagine**» (W8-34).
5. «Togli l'immagine» › «Salva i metadati SEO» › «Metadati SEO salvati.». Dopo una ricarica: «Scegli immagine di condivisione».
   - Sito: nessun `og:image`.
   - Database: `og_image_id` = `null`.

**Esito: riuscito.** Console: **0 errori**. Il 404 di `GET /seo/contents/:id` della W8 ora è un 204 (W8-09).

| Difetto | Stato |
|---|---|
| W8-34 | **risolto** |
| W8-35 | **risolto** |

---

## 7. W8-38 — logo e pagina iniziale (account amministrazione)

Spec `07-w838.spec.ts`. Il logo di prova `prova-logo-1g-w9.png` è stato caricato da Media con l'account di redazione.

Impostazioni del sito:

- «Pagina iniziale» è un **elenco** di pagine pubblicate, «Titolo (/indirizzo/)», con l'aiuto «Il contenuto servito all'indirizzo «/».»;
- «Logo del sito» mostra il nome del media (`logo_header_2`) con «Scegli il logo», «Togli il logo» e «Salva «Logo del sito»».

**Pagina iniziale** (2 s):

- scelta «Pagina di prova collaudo 1G-1 (/prova-collaudo-1g-1/)» › «Salvata.»;
- `/` risponde 200 con `<title>Pagina di prova collaudo 1G-1 - Centro Amoris Laetitia</title>` e `h1` della pagina di prova; `/prova-collaudo-1g-1/` › 301 verso `/`; `/home/` › 200;
- ripristinata «(/home/)»: `/` torna «Home - Centro Amoris Laetitia», `/home/` › 301 verso `/`, la pagina di prova › 200;
- valore uguale alla partenza (`be44edcc-…`).

**Logo** (6 s):

- «Scegli il logo» › selettore «Scegli un media» › `prova-logo-1g-w9` › «Usa questo media» › «Salva «Logo del sito»» › «Salvata.»;
- intestazione e dati strutturati: `/media/2026/10/prova-logo-1g-w9.png`;
- ripristinato `logo_header_2` (`60cce722-…`): intestazione di nuovo `/media/2017/09/logo_header_2.png`.

**Valori non validi**, solo dall'API con la sessione dell'area: tutti **400** `VALIDATION_FAILED` con messaggio in italiano.

| Chiave | Valore provato | Messaggio |
|---|---|---|
| `site.home_content_id` | testo qualunque | «Pagina iniziale» deve essere una pagina pubblicata. |
| `site.home_content_id` | identificativo inesistente | idem |
| `site.home_content_id` | identificativo di una pagina in bozza («bis») | idem |
| `site.logo_media_id` | testo qualunque | «Logo del sito» deve essere un'immagine pubblica scelta fra i media. |
| `site.logo_media_id` | identificativo di un PDF | idem |

Dopo i rifiuti: valori invariati, `/` 200 con la home giusta.

**Esito: riuscito.** Console: i 5 errori 400 delle mie chiamate di prova; nessun altro.

| Difetto | Stato |
|---|---|
| W8-38 | **risolto** |

**Osservazione:** nell'elenco la pagina iniziale si chiama «(/home/)», senza nome (N2).

---

## 8. W8-26 a vista — carosello (account editor)

Spec `08-w826.spec.ts`, `esplora/e15`. Tempo: 13 s, più l'eliminazione.

**Passi:**

1. Creata «Pagina di prova collaudo 1G-W9 carosello».
2. «Aggiungi blocco» › «Presentazione a scorrimento» › «Quale carosello?» = «Slider home» › «Inserisci».
3. Pubblicata: anteprima e sito uguali.

**Sul sito**, a 1440 e 390 px (`08-carosello-1440-titolo.png`, `08-carosello-390-titolo.png`, ritagliate sulla sola fascia del titolo):

- la slide 1 mostra «Seminario per coppie» a capo «"Parlarsi col cuore"», **centrato**, con il **cuore** disegnato;
- nessun tag visibile: il titolo è reso come `<span class="blk-slide-block blk-slide-align-center">…<br>…<i class="blk-slide-icon-heart" aria-hidden="true"></i></span>`;
- i titoli delle slide 9, 10 e 11 vanno a capo con `<br>`;
- nessun `alt` contiene tag; nessun `&lt;` nel sorgente.

**Nell'editor del carosello** il titolo della slide 1 è un'area di testo con «Seminario per coppie↵"Parlarsi col cuore"», senza codice. Sotto: «Sul sito il titolo è centrato e va a capo…».

**Pulizia:** pagina eliminata («Contenuto eliminato…»), 404, 0 righe.

**Esito: riuscito.** Console: **0 errori**.

| Difetto | Stato |
|---|---|
| W8-26 | **risolto** (DR-307, DR-311) |

---

## 9. Console (W9-2, 1G-24)

`sorveglia()` ha registrato, in ogni pagina dell'area, del sito e dell'anteprima:

- `console.error` e `console.warning`;
- `pageerror`;
- richieste fallite, incluse le interrotte;
- risposte ≥ 400.

Riepilogo con `node collaudo-w9/console.mjs`.

**Errori dell'applicazione: 0.**

- Nessuna eccezione (`pageerror`) in nessun compito.
- Nessun `console.error` scritto dal codice.
- Sul **sito** e nell'**anteprima**: nessuna voce di console né richiesta fallita in nessun compito.

**Risposte attese che restano in console come errore rosso.** Chromium scrive «Failed to load resource: the server responded with a status of N» per ogni risposta ≥ 400. Ognuna è il rifiuto voluto di un'azione chiesta dal compito, o una mia chiamata di prova all'API:

| Compito | Risposta | Motivo |
|---|---|---|
| 1G-5 | `DELETE /media/:id` 409 | B in uso, rifiuto richiesto da HO-040 §5 |
| 1G-13 | `POST /contents/:id/unpublish` 409 | chiamata API voluta (DR-314) |
| 1G-16 A/C | `POST /auth/login` 401 ×6 | accessi volutamente errati: vecchia password, disattivato, inesistente, vecchio indirizzo |
| 1G-16 C1 | `PATCH /accounts/:id` 409 | indirizzo già usato |
| 1G-16 B | `PUT /settings/content.posts_per_page` 400 | «Articoli per pagina» = 0 |
| 1G-16 C3 | `PATCH /accounts/:id` 403 ×2, `POST /auth/password` 403 | password attuale errata, voluta |
| W8-38 | `PUT /settings/…` 400 ×5 | valori non validi, chiamate API volute |

In tutti i compiti senza rifiuti voluti — 1G-1, 1G-2, W8-34/35, W8-26, pulizia — non c'è **nessun** errore rosso.

Per avere zero righe rosse anche su questi percorsi, i rifiuti dovrebbero arrivare con un codice 2xx o essere previsti prima della richiesta, come W8-09 ha fatto per le assenze. È una scelta, non un difetto: la propongo come nota bassa (§12, O3).

**Rumore del browser e del framework (motivato):**

- **Avvisi gialli** «The resource …/admin/_next/static/chunks/….css was preloaded using link preload but not used within a few seconds…»: da 1 a 18 per spec, solo nell'area. È un avviso di Chromium sul precaricamento dei CSS fatto da Next, non un errore: osservazione O4.
- **Richieste «interrotte» (`net::ERR_ABORTED`), non visibili in console:**
  - le risposte **204** senza corpo: `GET /auth/me` sulla schermata di accesso (DR-319), `GET /contents/:id/draft`, `GET /seo/contents/:id`, `DELETE /contents/:id/draft`, `DELETE` di contenuti, media e voci. Lo strumento le segnala come interrotte anche se hanno avuto risposta. Verificato in `esplora/e16`: prima `response` 204, poi `requestfailed ERR_ABORTED`;
  - i precaricamenti di Next (`?_rsc=`) delle righe di «Pagine» e «Caroselli», abbandonati quando si cambia pagina.
- **Fumetto nativo** «Please fill out this field.» sul campo «Password attuale» vuoto: messaggio del browser, nella lingua del Chromium di prova, accanto a quello italiano dell'area.

| Difetto | Stato | Prova |
|---|---|---|
| W8-09 | **risolto** | le assenze ora rispondono 204 |
| W8-32 | **risolto** | nessun 401/403 nei rinvii |

---

## 10. Tabella riassuntiva dei compiti

| # | Compito | Account | Esito | Secondi (script) | Errori dell'applicazione in console |
|---|---|---|---|---|---|
| 1 | 1G-1 (HO-036) | editor | **riuscito** | 32, più 8 di ripresa per un errore dello script | 0 |
| 2 | 1G-2 (HO-037) | editor | **riuscito con difficoltà** (N1) | ~10 compito; 11 accessorie; 13 ripristino | 0 |
| 3 | 1G-5 (HO-040) | editor | **riuscito** | 16 compito (sostituzione 3); 13 verifiche; 15 accessorie | 0 (1 rifiuto 409 atteso) |
| 4 | 1G-13 (HO-048) | editor; amministrazione per il registro | **riuscito** | ~24 utili (64 con attese dello script); 82 con pulizia | 0 (1 409 dalla prova API voluta) |
| 5 | 1G-16 (HO-051) A, B, C | amministrazione; account di prova | **riuscito** (A, B, C) | A 39; C1-2 13; B 20 + 17; C3 106 (65 di ritardo progressivo) | 0 (rifiuti attesi 401/403/409/400) |
| 6 | W8-34 e W8-35 | editor | **riuscito** | 9 + 4 | 0 |
| 7 | W8-38 | amministrazione | **riuscito** | 2 + 6 (17 con le prove API) | 0 (5 rifiuti 400 voluti) |
| 8 | W8-26 a vista | editor | **riuscito** | 13 | 0 |

---

## 11. Difetti W8 verificati

| Id | Severità W8 | Esito nel nuovo collaudo | Prova |
|---|---|---|---|
| W8-01 | media | **risolto** | miniature da 3300, caricate, nei selettori Immagine, «Media e testo» e immagine in evidenza (§1, §2) |
| W8-03 | bassa | **risolto** | `content.draft.discard success` dopo ogni «Pubblica»; nessun 404 (§1) |
| W8-04 | media | **risolto** | «Scegli un contenuto»; «Non è stata aggiunta — Scegli il contenuto a cui punta la voce.» (§1) |
| W8-05 | bassa | **risolto** | 109 contenuti su 109 proposti; «Autostima e assertività» nell'albero (§1) |
| W8-06 | media | **risolto** | «Cambia immagine» nel blocco; una sola immagine dopo la sostituzione (§2) |
| W8-09 | bassa | **risolto** | 204 per `/auth/me`, `/draft` e `/seo/contents/:id` (§9) |
| W8-10 | media | **risolto** | alt di Media proposto e usato quando il blocco è vuoto; didascalia di Media sul sito (§3) |
| W8-11 | media | **risolto** | didascalia leggibile a 1440 e 390 px, fotografie guardate (§3, §2) |
| W8-12 | bassa | **risolto** (DR-313) | `title` del blocco nel sorgente (§3) |
| W8-13 | media | **risolto secondo DR-293** | «Salva e aggiorna il sito» con avviso; la copia di lavoro non tocca il sito (§2). Il brief lo descriveva diversamente |
| W8-15 | bassa | **risolto** | nessun pulsante senza nome nell'albero del menu (§1) |
| W8-16 | bassa | **risolto** | dopo l'aggiunta e l'eliminazione di due voci l'impronta di `menu_items` (id, genitore, posizione, etichetta, visibilità) è identica alla partenza: nessuna rinumerazione |
| W8-19 | bassa | **risolto** | «File eliminato.» (§3, §13) |
| W8-23 | bassa | **risolto** per Persone e permessi e Menu | «Account creato/disattivato/riattivato.», «Modifiche salvate.», «Voce aggiunta/eliminata.» (§1, §5) |
| W8-24 | media | **risolto** | «Senza titolo — Pagina iniziale» nell'elenco, «Pagina iniziale» nell'editor (§4) |
| W8-26 | media | **risolto** | titoli resi senza tag, a capo, centrati, con il cuore (§8) |
| W8-27 | media | **risolto** | «Cambia la password» nel menu della persona (§5) |
| W8-28 | media | **risolto** | «Ruoli cambiati: la sessione è stata chiusa. Entra di nuovo.» (§5) |
| W8-29 | bassa | **risolto** | titoli conservati nelle righe dei contenuti eliminati (§4) |
| W8-30 | bassa | **risolto nell'elenco** | righe `source: account` nascoste (§5) |
| W8-32 | bassa | **risolto** | nessun 401/403 nei rinvii (§5) |
| W8-34 | media | **risolto** | nome dell'immagine dopo la ricarica; «Togli l'immagine» funziona (§6) |
| W8-35 | bassa | **risolto** | «Usa questo media» attivo senza testo alternativo (§6) |
| W8-37 | bassa | **risolto** | `null` › valore › `null`; effetto collaterale su `site.description` (`""` › `null`), non visibile (§5) |
| W8-38 | media | **risolto** | scelta da elenco, cambio e ripristino, 400 in italiano per i valori non validi (§7) |
| DR-314 | — | **attuato** | «Ritira» disattivato con aiuto; API 409 (§4) |

**Nessun difetto W8 si ripresenta.**

---

## 12. Difetti nuovi

### Elenco

| Id | Severità | Dove | Difetto |
|---|---|---|---|
| **N1** | **media** | editor › blocco «Testo» | tasti persi durante il salvataggio automatico della copia di lavoro |
| N2 | bassa | Menu › «Aggiungi una voce» › «Contenuto»; Impostazioni del sito › «Pagina iniziale» | la pagina iniziale, senza titolo, compare come opzione vuota o come «(/home/)» |
| N3 | bassa | Pagine › «Nuova pagina» › aiuto di «Indirizzo» | refuso «Si puo' correggere.» |
| N4 | bassa | editor › scheda «Immagine in evidenza» | scelta e rimozione senza messaggio, con effetto immediato sul sito |
| N5 | bassa | editor › albero dei blocchi | un blocco Immagine con `alt` lasciato a Media si chiama «Immagine — immagine» |

### N1 — tasti persi durante il salvataggio automatico (media)

Mentre arriva il salvataggio automatico della copia di lavoro, una parte dei tasti premuti va perduta. Il testo pubblicato può differire da quello voluto **senza alcun avviso**.

Prove:

- **`esplora/e07`:** 22 «Canc» senza pausa, 16 applicati; è stato pubblicato « 1G-2] [prova collaudo 1G-2] Cambiare…» sulla pagina reale.
- **`esplora/e09`,** sulla pagina di prova, senza copia di lavoro:
  - 22 «Canc» senza pausa: 20 e 16 applicati;
  - con **50 ms** fra un tasto e l'altro (20 al secondo, come un tasto tenuto premuto): 21 su 22.
- **`esplora/e10`:**
  - 41 lettere scritte in coda: 41 su 41 per tre volte;
  - 10 «Backspace» premuti 3 s dopo: **0 su 10** in una prova, 10 su 10 nelle altre due.

I tasti si perdono vicino al salvataggio automatico, non in ogni scrittura.

Punto sospettato, da verificare: `apps/admin/src/components/editor/RichTextEditor.tsx:105-115`. L'effetto richiama `editor.commands.setContent(value)` ogni volta che `value` è diverso dall'ultimo valore emesso. Se il contenitore ripassa il valore salvato, più vecchio della digitazione in corso, il contenuto e il cursore tornano indietro.

Serve una verifica con una persona a velocità normale.

### N2 — pagina iniziale senza nome negli elenchi (bassa)

In «Contenuto» due opzioni sono **vuote**: la pagina iniziale e una notizia in bozza senza titolo. In «Pagina iniziale» la home si legge «(/home/)». È W8-24 fuori dall'elenco «Pagine» e dall'editor. Dal codice non l'ho cercato.

### N3 — refuso nell'aiuto di «Indirizzo» (bassa)

L'aiuto dice «L'ultima parte dell'indirizzo pubblico. Si puo' correggere.», con l'apostrofo al posto dell'accento. Punto: `apps/admin/src/components/ContentList.tsx:291`.

### N4 — immagine in evidenza senza messaggio (bassa)

Dopo «Usa questo media» e dopo «Togli l'immagine» non compare alcun messaggio, e la modifica è subito sul sito senza «Pubblica».

Il pannello non dice che l'effetto è immediato, a differenza di layout e titolo («Il nuovo layout compare subito sul sito», «Il sito usa le nuove impostazioni»). È della stessa famiglia di W8-23. Lo stato si vede comunque dai pulsanti «Cambia l'immagine» e «Togli l'immagine».

### N5 — nome dell'immagine nell'albero (bassa)

Con DR-305 l'`alt` del blocco resta vuoto di proposito. Così due immagini con l'`alt` di Media non si distinguono nell'albero; è della stessa famiglia di W8-33. Punto sospettato: `apps/admin/src/lib/editor/tree.ts`, `labelOf` del blocco `image`.

### Osservazioni (non difetti)

- **O1.** Dopo una password attuale errata, ogni salvataggio del proprio account attende 21-22 s, anche con la password giusta, per circa 15 minuti. È il ritardo progressivo voluto (`loginAttempts.ts:71`), già visto nella W8. Non ho verificato che cosa mostri il pulsante durante l'attesa: una frase che lo spieghi aiuterebbe.
- **O2.** Le righe del registro sugli account hanno come oggetto solo «Account», senza il nome della persona. Forse è voluto, in attesa della regola di DR-315.
- **O3.** I rifiuti attesi (401, 403, 409, 400) restano errori rossi di Chromium in console (§9). Toglierli chiederebbe risposte 2xx o controlli preventivi: è una scelta di progetto.
- **O4.** Avvisi gialli di precaricamento dei CSS di Next in ogni pagina dell'area.
- **O5.** «Cambia immagine» non permette di scegliere la variante. Un blocco importato con una variante (es. `724x1024`) non si riporta identico dall'area (§13).

---

## 13. Residui nel collaudo

Confronto con SELECT fra `risultati/partenza.txt` e `risultati/fine.txt`, dopo la pulizia fatta dall'area (`09-pulizia.spec.ts`).

**Tornati come alla partenza:**

- **menu:** 64 voci, impronta identica. «Prova collaudo 1G-1» e «Prova collaudo 1G-13 in menu» eliminate («Voce eliminata.»);
- **media:** 178, impronta identica. Eliminati `prova-1g-5-a.png`, `prova-1g-2.png`, `prova-logo-1g-w9.png`; C era già eliminata;
- **contenuti:** 108. Eliminate tutte le pagine di prova (1G-1, 1G-1 bis, 1G-5, le quattro 1G-13, il carosello); `content_seo` identica, 2 righe; nessuna copia di lavoro;
- **impostazioni:** tutte identiche, logo e pagina iniziale compresi, salvo `site.description`;
- **slide, redirect, modelli:** slide identiche (12); redirect 181.

**Residui:**

1. `/reinventa-la-tua-vita/`, ripubblicata più volte dall'area. Frase e immagine di prova tolte. Differenze dalla partenza:
   - **blocco Immagine** `b_2a7801f8f336`:
     - stesso media `IMG-20231223-WA0003`, `alt=""`, nessuna didascalia;
     - ma `variant` `null` invece di `724x1024`: ora il sito serve il file 1131×1600 con `srcset` invece della variante 724×1024, con le stesse proporzioni;
     - in più `decorative: true` e senza `useMediaCaption: false` (O5);
   - **primo blocco «Testo»:** stesso testo visibile, ma riscritto dall'editor senza gli a capo fra i paragrafi e con uno spazio doppio ridotto. È l'avviso «Testo salvato in una forma diversa»; sul sito non si vede;
   - data di ultima modifica: 30/10/2026.
2. `site.description`: `null` invece di `""` (effetto voluto di W8-37); il sito non cambia, l'area non riporta `""`.
3. Due account di prova **disattivati**, perché l'area non cancella:
   - «Persona di prova collaudo 1G-16 rinominata», `prova-1g-16-nuova@example.invalid`, Redazione;
   - «Seconda amministrazione di prova collaudo 1G-16 rinominata», `amministrazione-prova-1g-16-nuova@example.invalid`, Amministrazione.

   Le loro password sono solo in `C:\work\amoris-collaudo.stato\account-prova-1g-16-w9.json`.
4. Registro: 224 righe nuove (da 249 a 473), tutte del collaudo.
5. Gli account dell'agente hanno le stesse password di prima.

---

## 14. Controllo «nessuna password nei file»

`node .superpowers/sdd/strumenti-1G/collaudo-w9/controlla-riservatezza.mjs .superpowers/sdd/strumenti-1G/collaudo-w9 .superpowers/sdd/W9-PLAN test-results`. Lo script confronta le 4 password note dei file di stato (2 dell'agente, 2 degli account di prova), senza stamparle.

- **Prima esecuzione** (214 file): **0 corrispondenze di password**.
- In 8 file c'erano IBAN o indirizzi da non lasciare:
  - snapshot ARIA che riprendevano la pagina reale (IBAN) e l'elenco delle persone;
  - indirizzi degli account dell'agente.
- Li ho oscurati con `--oscura`. Ho tolto da giornali e snapshot nomi e recapiti reali comparsi nei confronti di `reinventa`, e ho cancellato gli snapshot completi della pagina reale.
- Ho cancellato anche i profili persistenti del browser usati dall'esplorazione (`risultati/profilo-*`, con i cookie di sessione) e gli artefatti di errore di Playwright.
- **Ultima esecuzione**, dopo aver scritto questo rapporto: vedi la riga sotto.

Ultima esecuzione, su `collaudo-w9/`, `W9-PLAN/` (questo rapporto compreso) e `test-results/`: `password note: 4; file esaminati: 212; corrispondenze di password: 0; file con IBAN o indirizzi da non lasciare: 0`. Git: nessun file toccato dal collaudo (`git status` mostra solo `PROGRESS.md`, già modificato prima).
