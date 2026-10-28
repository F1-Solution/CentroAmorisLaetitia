# Esiti di HO-046…HO-052 eseguiti dall'agente (DR-290)

Collaudo della `1G-W8`, 2026-10-28, 10:47–11:52 UTC (11:47–12:52 ora di Roma), con un'interruzione per limite di richieste fra HO-046 e HO-047. Alla ripresa ho controllato con SELECT `audit_log`, contenuti, impostazioni e account: era stato eseguito solo HO-046 e nulla era rimasto a metà.

Ambiente di collaudo: sito 3300, area 3301, API 3302, database `amoris_collaudo`. Account dell'agente: `Agente di collaudo (redazione)` per HO-046…HO-050 e HO-052; `Agente di collaudo (amministrazione)` per HO-051 e per i controlli del registro. Ogni scrittura è passata dall'interfaccia dell'area. Database e API sono stati solo letti; per HO-052 ho fatto le richieste dirette all'API previste dall'handoff.

Script e giornali sono in `.superpowers/sdd/strumenti-1G/collaudo/`. Ho riusato `playwright.config.ts` e `supporto.ts` del primo agente, e ho aggiunto `supporto2.ts` con creazione dei contenuti, eliminazione guidata, voci di menu, redirect seguiti a mano e caricamenti.

| Script | Compito |
|---|---|
| `12-ho046.spec.ts` | HO-046 |
| `13-ho047.spec.ts` | HO-047 |
| `14-ho047-accessorie.spec.ts` | HO-047, prove accessorie |
| `15-ho048.spec.ts` | HO-048 |
| `16-ho049.spec.ts` | HO-049 |
| `17-ho050.spec.ts` | HO-050 |
| `18-ho050-accessorie.spec.ts` | HO-050, prove accessorie |
| `19-ho051-b.spec.ts` e `20-ho051-b2.spec.ts` | HO-051, parte B |
| `21-ho051-ac.spec.ts` e `22-ho051-c3.spec.ts` | HO-051, parti A e C |
| `23-ho052.spec.ts` | HO-052 |
| `24-registro.spec.ts` | registro 1D-37 di tutti i compiti |

- **Giornali:** `risultati/<nome>.jsonl`; quelli marcati `.parte1` sono il primo passaggio di uno script ripreso.
- **File sintetici:** generati in `risultati/file/` con System.Drawing, ffmpeg (`drawtext`) e la stampa PDF di Chromium, tutti con testo «prova collaudo 1G-n».
- **Tempi:** sono quelli dello script, quindi un limite inferiore.

**Riservatezza.** Le password non compaiono in nessun file. Ho controllato `controlla-password.mjs` su `strumenti-1G/collaudo`, `W8-PLAN`, `docs/qa` e `test-results` (8 367 file) prima e dopo il lavoro: 0 corrispondenze con le 4 password note.

- Tracce e fotografie degli errori sono spente per HO-051.
- Gli script di HO-051 sostituiscono ogni password con «[password]» prima di scrivere nel giornale.
- Le password temporanee mostrate dall'area restano solo in memoria.
- Le password degli account di prova sono solo in `C:\work\amoris-collaudo.stato\account-prova-1g-16.json`.
- Le password dell'agente non sono cambiate, e `account-agente.json` è coerente: gli ultimi due script sono entrati con entrambi gli account.

Errori ricorrenti in console, già noti:

- **W8-09:** `GET /auth/me` 401 all'accesso; `GET /contents/:id/draft` 404 a ogni apertura dell'editor.
- **W8-01:** miniature `GET 3301/media/…` 404 nell'immagine in evidenza, nel selettore e in tutte le 12 slide dell'editor del carosello.

Sul sito pubblico nessun errore di console e nessuna richiesta fallita.

## 1. HO-046 — indirizzo e pagina genitore (1G-11)

Ho creato e pubblicato tre pagine:

- `madre`, all'indirizzo `/prova-collaudo-1g-11-madre/`;
- `altra`, all'indirizzo `/prova-collaudo-1g-11-altra/`;
- `figlia`, messa sotto la madre dalla scheda «Indirizzo» quando era ancora in bozza.

Comandi usati: scheda «Indirizzo» › «Slug», poi «Pagina genitore», poi «Salva l'indirizzo». Per una pagina pubblicata si apre la finestra «Cambia l'indirizzo pubblico», che elenca:

- gli indirizzi che cambiano;
- i redirect che nascono;
- i redirect che cambiano destinazione o si tolgono.

Si conferma con «Cambia l'indirizzo».

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| prima | `/prova-collaudo-1g-11-madre/` e `/…-altra/` 404; i 3 redirect preesistenti `301 → /download/<stesso nome>/` | — |
| 1. passo 1 (`-madre-nuova`) | vecchio indirizzo della madre e della figlia: 1 spostamento 301, poi 200. La figlia ora è `/prova-collaudo-1g-11-madre-nuova/prova-collaudo-1g-11-figlia/` | riuscito |
| 2. passo 2 (`-madre-terza`) | l'originale e l'intermedio, sia della madre sia della figlia, arrivano al nuovo con **1** spostamento. Le regole del passo 1 sono state ridirette, senza catene | riuscito |
| 3. passo 3 (ritorno a `-madre`) | nessun ciclo: `-madre/` e la sua figlia 200 con 0 spostamenti; `-nuova` e `-terza` 1 spostamento verso `-madre`. L'area dice anche quali regole «si tolgono» | riuscito |
| 4. passo 4 (figlia sotto `altra`) | `/prova-collaudo-1g-11-altra/prova-collaudo-1g-11-figlia/` 200. I tre vecchi indirizzi della figlia (sotto `-madre`, `-nuova`, `-terza`) arrivano con 1 spostamento | riuscito |
| 5. madre figlia della figlia | **nessun messaggio:** la figlia non è proposta in «Pagina genitore» della madre, e il motivo non è scritto da nessuna parte (W8-22). Ho fatto il passo 5 prima del 4: dopo il 4 la figlia non è più figlia della madre e il ciclo non si può più provare (ordine dell'handoff da rivedere) | riuscito per impedimento, senza spiegazione |
| 6. redirect preesistenti | identici prima e dopo | riuscito |
| 7. anteprima = pubblica | 3 pubblicazioni su 3 uguali (main senza idratazione) | uguale |

Messaggi visti:

- in bozza: «Indirizzo salvato — L'indirizzo ora è /prova-collaudo-1g-11-madre/prova-collaudo-1g-11-figlia/; sarà pubblico quando il contenuto verrà pubblicato.»;
- dopo i passi: «Indirizzo salvato — L'indirizzo pubblico ora è /prova-collaudo-1g-11-madre-terza/.», con gli elenchi «Redirect che cambiano destinazione» e «Redirect che si tolgono»;
- finestra: «Un contenuto pubblicato cambia indirizzo: chi apre il vecchio indirizzo viene portato al nuovo.».

Prova accessoria del registro, 1D-37:

- ogni cambio di indirizzo e di genitore ha la sua riga «Ha cambiato l'indirizzo», con titolo, persona e ora: 5 righe, compresa quella della figlia in bozza;
- **i redirect nati non hanno una riga propria**: sono solo conteggi (`redirectsCreated`, `redirectsRetargeted`, `redirectsRemoved`) nel dettaglio salvato, che l'elenco non mostra (W8-31).

Tempi ed esito:

- tempi: preparazione 17 s; compito **20 s**; registro circa 10 s, insieme agli altri compiti;
- esito: **riuscito**, con la sola difficoltà del passo 5.

Resta nel collaudo:

- le tre pagine 1G-11, pubblicate;
- 5 redirect automatici `/prova-collaudo-1g-11-…`.

## 2. HO-047 — notizia, estratto, immagine in evidenza, categorie (1G-12)

`Notizia di prova collaudo 1G-12`, con l'estratto «…quarzomelograno.», 3 paragrafi e `prova-1g-12.png` (verde acqua, 1600×900) caricata da Media. Ho scelto l'immagine in scheda «Elenchi e archivi» › «Scegli un’immagine».

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. senza categoria non si pubblica | «Operazione non riuscita — Per pubblicare una notizia serve almeno una categoria: sceglila nella scheda «Elenchi e archivi».»; stato `draft`, sito 404 | riuscito |
| 2. elenco della home | 1ª in «Elenco articoli», con immagine ed estratto (anche a 390 px, `ho047-home-390.png`) | riuscito |
| 3. archivio della categoria nuova | `/category/categoria-di-prova-collaudo-1g-12/`: 1ª, con immagine ed estratto | riuscito |
| 4. ricerca `quarzomelograno` | trovata, 1ª, con immagine ed estratto | riuscito |
| 5. rinomina | `<title>Categoria di prova collaudo 1G-12 rinominata - Centro Amoris Laetitia</title>`; indirizzo dell'archivio invariato; il pannello lo annuncia: «L'indirizzo dell'archivio resta /category/categoria-di-prova-collaudo-1g-12/.» | riuscito |
| 6. tolta la categoria | togliere l'unica è rifiutato: «Categorie non salvate — Una notizia pubblicata deve avere almeno una categoria: assegnane un’altra prima di togliere questa.». Con «Senza categoria» aggiunta, «Categorie salvate.» e la notizia esce dall'archivio | riuscito |
| 7. ritirata | «Contenuto ritirato: non è più raggiungibile dal pubblico.»; 404; assente da home, ricerca e «Senza categoria» | riuscito |
| 8. anteprima = pubblica | uguale | uguale |

Altri dati del compito:

- **Messaggi mancanti:** dopo «Crea categoria» e dopo «Salva» del pannello «Modifica categoria» nessun messaggio (W8-23).
- **Tempo:** **39 s**. Esito: **riuscito**.
- **Console:** W8-09; W8-01 per l'anteprima dell'immagine in evidenza nell'editor; un 400 atteso sul rifiuto della categoria.

### Prove accessorie

**Titolo e primo piano (12 s).** Scheda «Pagina» › «Mostra il titolo della notizia» e «Notizia in primo piano», poi «Salva titolo e colonne».

- **Titolo nascosto:** resta `<h1 class="screen-reader-text">Notizia di prova collaudo 1G-12 bis</h1>`, un solo h1, e la data. Rimesso, torna `entry-title`.
- **Primo piano:** l'area lo dice prima di provarlo: «Come nel sito di partenza, oggi non cambia l’ordine di nessun elenco: l’«Elenco articoli» della pagina iniziale, gli archivi e la ricerca non mettono in testa le notizie in primo piano.». L'ordine della home è identico prima e dopo; poi l'ho tolto.
- **Messaggio a ogni salvataggio:** «Impostazioni salvate — Il sito usa le nuove impostazioni.». Si applica subito, senza «Pubblica» (come W8-13).

**Categorie complete (43 s; lo script è stato ripreso dopo un errore suo: due campi «Descrizione»).**

- **Descrizione della figlia:** diventa `<meta name="description" content="Descrizione di prova collaudo 1G-12"/>` e non compare nel testo visibile. Riuscito.
- **SEO dell'archivio:** con i campi pieni si vedono `<title>Archivio SEO prova collaudo 1G-12</title>`, la descrizione SEO e `robots` = `noindex, nofollow, max-image-preview:large`. Tolta la SEO, tornano il titolo predefinito, la descrizione del punto 1 e `max-image-preview:large`. Riuscito.
- **Spostamento sotto la madre:**
  - il pannello annuncia: «L'indirizzo dell'archivio diventerà /category/madre-prova-1g-12/figlia-prova-1g-12/; da /category/figlia-prova-1g-12/ un redirect 301 porterà al nuovo, e così per le sottocategorie.»;
  - nuovo indirizzo 200, vecchio `301 →` nuovo. Riuscito.
- **Ciclo:** la figlia non è proposta come genitrice della madre. Nessun messaggio (W8-22).
- **Eliminazioni rifiutate:**
  - «Non si può eliminare — Ha delle sottocategorie: vanno spostate o eliminate prima. Categoria figlia di prova collaudo 1G-12 (/category/madre-prova-1g-12/figlia-prova-1g-12/)»;
  - «Non si può eliminare — La categoria ha 1 notizia, bozze comprese: assegnale prima a un’altra categoria.»;
  - «Non si può eliminare — È usata in un menu: le voci vanno tolte prima dal menu. Prova collaudo 1G-12 categoria, nel menu Menu principale».
- **Conferma della figlia, dopo aver spostato `bis` in «…rinominata»:**
  - testo della finestra: «La categoria sparisce con la sua SEO; il registro conserva nome e indirizzo. Il suo archivio risponderà «pagina non trovata». Le regole di redirect verso questo indirizzo restano (/category/figlia-prova-1g-12/): porteranno a «pagina non trovata» e si sistemano dalla pagina dei redirect.»;
  - si conferma digitando il nome; «Annulla» non cambia nulla;
  - dopo l'eliminazione l'archivio risponde 404 e **il vecchio indirizzo `/category/figlia-prova-1g-12/` risponde `301` verso un 404**, come avvertito.
- **Voce di menu:** aggiunta come «Una categoria» e poi tolta. Il menu del sito e le righe di `menu_items` sono identici a prima. La madre si elimina dopo la conferma: 404.
- **Notizia `bis`:** ritirata, 404.
- **Messaggi mancanti:** dopo la modifica, la creazione o l'eliminazione di una categoria e dopo l'aggiunta di una voce di menu, nessun messaggio (W8-23).

**Registro (1D-37).** Righe trovate:

- creazione, modifica, pubblicazione, «Ha cambiato le categorie» (compresa quella «Non riuscita») e ritiro, con il titolo della notizia;
- «Ha creato una categoria», «Ha modificato una categoria», «Ha modificato la SEO di una categoria», «Ha eliminato una categoria».

Difficoltà nel registro:

- le righe delle categorie dicono solo «Categoria» o «SEO di una categoria», senza nome (W8-20, ripetuto);
- lo spostamento compare come semplice «Ha modificato una categoria»;
- il redirect nato non ha riga (W8-31).

Resta nel collaudo:

- `Notizia di prova collaudo 1G-12` e `… bis`, ritirate (bozze);
- la categoria `Categoria di prova collaudo 1G-12 rinominata`, con `bis`;
- il media `prova-1g-12.png`;
- il redirect automatico `/category/figlia-prova-1g-12/` verso un archivio eliminato.

## 3. HO-048 — eliminare un contenuto (1G-13)

Ho creato e pubblicato:

- `…1G-13`;
- `…1G-13 madre`, con la sua `…figlia`;
- `…1G-13 in menu`, con la voce «Prova collaudo 1G-13 in menu» del menu principale («Una pagina o una notizia»). Il contenuto nuovo compare fra le 100 opzioni, quindi W8-05 non ha impedito il compito.

Pagina iniziale: `site.home_content_id` = la pagina `/home/`, che ha il **titolo vuoto**, già vuoto anche nella base di sviluppo.

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. conferma; annulla non cambia | «Elimina il contenuto — Il contenuto sparisce con la sua copia di lavoro, i dati SEO e i legami alle categorie; il registro conserva titolo e indirizzo. Il suo indirizzo risponderà «pagina non trovata».» + «Digita «Pagina di prova collaudo 1G-13» per confermare»; «Annulla»: nulla cambia | riuscito |
| 2. madre con figlia | «Non si può eliminare — Ha delle pagine figlie: vanno spostate o eliminate prima. Pagina di prova collaudo 1G-13 figlia (/prova-collaudo-1g-13-madre/prova-collaudo-1g-13-figlia/)» | riuscito |
| 3. nel menu | «Non si può eliminare — È usato in un menu: le voci vanno tolte prima dal menu. Prova collaudo 1G-13 in menu, nel menu Menu principale» | riuscito |
| 4. pagina iniziale | «Non si può eliminare — È la pagina iniziale del sito: indica prima un’altra pagina iniziale.». **Per riconoscerla è servito aiuto:** nell'elenco è una riga senza titolo («/home/ PUBBLICATA»), e né l'elenco né l'intestazione dell'editor dicono che è la pagina iniziale; lo dice solo la scheda «Indirizzo». Io l'ho trovata con una SELECT (W8-24) | riuscito con difficoltà |
| 5. pagina isolata | «Contenuto eliminato — Il contenuto è stato eliminato definitivamente.»; 404; assente da «Pagine» (cerca «collaudo 1G-13») | riuscito |
| 6. ordine accettato | figlia, madre, voce di menu, pagina «in menu»: nessuna resta, tutte 404; menu del sito e `menu_items` identici a prima | riuscito |
| 7. pagina iniziale | `/` 200, `published` | riuscito |

Tempi ed esito:

- tempi: rifiuti più eliminazione isolata **16 s**, con la pulizia **32 s**;
- esito: **riuscito con difficoltà**, per la pagina iniziale non riconoscibile.

Prova accessoria del registro, 1D-37:

- le 5 eliminazioni hanno ciascuna la riga «Ha eliminato | <titolo>»;
- le righe precedenti degli stessi contenuti (creato, pubblicato, modificato) mostrano «contenuto non più presente» (W8-29);
- le voci di menu sono generiche: «Voce di menu» (W8-20).

Resta nel collaudo: nulla.

## 4. HO-049 — file rifiutati (1G-14)

Il pulsante di scelta dichiara `accept="image/jpeg,…,video/mp4,.mp4"`. Il controllo lo aggira con `setInputFiles`, come trascinando il file.

| File | Messaggio (testo esatto) | Comprensibile | File elencati prima/dopo |
|---|---|---|---|
| `prova-1g-14.svg` | Il file «prova-1g-14.svg» non è di un tipo ammesso. Si possono caricare JPEG, PNG, WebP, PDF e MP4. | sì | 178 / 178 (DB 182 / 182) |
| `prova-1g-14.html` | Il file «prova-1g-14.html» non è di un tipo ammesso. Si possono caricare JPEG, PNG, WebP, PDF e MP4. | sì | 178 / 178 |
| `prova-1g-14.exe` | Il file «prova-1g-14.exe» non è di un tipo ammesso. Si possono caricare JPEG, PNG, WebP, PDF e MP4. | sì | 178 / 178 |
| `prova-1g-14-finta.png` | Il file «prova-1g-14-finta.png» non è di un tipo ammesso. Si possono caricare JPEG, PNG, WebP, PDF e MP4. (risposta 415 del servizio) | sì; non dice «file non valido» né che il contenuto non è un'immagine | 178 / 178 |
| `prova-1g-14-grande.png` (21 MB) | Il file «prova-1g-14-grande.png» pesa troppo: per i file PNG il limite è 20 MB. | sì | 178 / 178 |

File ammessi:

- **PNG:** entrato con «14 dimensioni derivate generate.».
- **PDF e MP4:** entrati, H.264 e AAC da ffmpeg. Tutti e tre rispondono 200 sul sito, col tipo giusto.
- **PDF e MP4 senza conferma:** sotto il loro nome non compare alcuna conferma (W8-25). Il conteggio sale a 179, 180 e 181.

| Verifica del §4 | Esito |
|---|---|
| 1. cinque rifiuti | riuscito |
| 2. italiano, che cosa non va | riuscito (finto PNG detto «tipo non ammesso») |
| 3. elenco invariato dopo ogni rifiuto | riuscito |
| 4. ammessi entrano e si usano | riuscito |
| 5. file ammesso non elaborabile | non provato: PDF e MP4 sintetici sono stati elaborati |

Tempi, esito e console:

- tempi: rifiuti **39 s**; con gli ammessi **77 s**, che aspettano le dimensioni derivate;
- esito: **riuscito**;
- console: un 415, quello del finto PNG; gli altri rifiuti avvengono nel browser.

Resta nel collaudo: i media `prova-1g-14-ammessa.png`, `prova-1g-14.pdf` e `prova-1g-14.mp4`, non usati.

## 5. HO-050 — documento e carosello (1G-15)

Documento usato: **«Modulo per consulenze a distanza»** (`/download/modulo-per-consulenze-a-distanza/`, pubblico). Carosello: l'unico, **«Slider home»**, 12 slide.

**Nessuna pagina mostra quel carosello** («Pagine che lo mostrano: Nessuna pagina lo mostra…»). Per vederlo sul sito ho creato `Pagina di prova collaudo 1G-15 carosello` con il blocco «Presentazione a scorrimento», poi l'ho eliminata.

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. titolo, descrizione, data | «Fatto — Modifiche salvate.». Pagina del documento con il titolo nuovo; indirizzo **invariato** (lo slug non segue il titolo); «Ultimo aggiornamento» da 5 Aprile 2022 a 28 Ottobre 2026 | riuscito |
| 2. file nuovo | finestra «Il file attuale non si potrà recuperare: «prova-1g-15.pdf» prenderà il suo posto sullo stesso indirizzo.» › «Sostituisci» › «File sostituito. Il collegamento «Download» del sito scarica il file nuovo.». Download: prima 153 909 byte (sha256 `2f563345…`), dopo 41 479 byte (`a0ba1162…`); stesso indirizzo `/media/download-manager-files/Modulo per consulenze a distanza.pdf`. L'impronta non è quella del mio PDF (41 427 byte) perché autore e programma si tolgono al caricamento (atteso) | riuscito |
| 3. slide sostituita, titolo e testo | la slide 12 mostra `prova-1g-15-b.png` e il titolo nuovo | riuscito |
| 4. aggiungi, riordina, togli | 13 slide con la nuova in coda; «Sposta su» la porta in 12ª («Slide spostata in posizione 12 di 13.»); «Togli» («Slide tolta.»): 12 slide | riuscito |
| 5. pagine controllate | la sola pagina di prova; la schermata la elenca in «Pagine che lo mostrano» | riuscito |
| 6. cose non modificabili | collegamento ed etichetta della slide; nome del carosello (DR-281, assenze dichiarate) | — |
| 7. anteprima = pubblica | pagina del carosello: differenze solo di scrittura (`srcset`/`srcSet`, entità `&quot;`), nessuna di contenuto | uguale |

Osservazioni:

- **I titoli importati di tre slide contengono HTML**, per esempio `<div align="center">Seminario per coppie<br>"Parlarsi col cuore" <i class="fa-heart"></i></div>`. Sul sito compaiono come testo, con i tag visibili, e anche nell'`alt` delle immagini; nell'editor si vedono come codice nel campo «Titolo» (W8-26).
- **Messaggi:** ogni «Salva» del carosello dà «Fatto — Modifiche salvate.».

Tempi ed esito:

- tempi: documento **9 s**, carosello **15 s**;
- esito: **riuscito**.

Ripristino della copia:

- slide 12 riportata a `hcp-drgcsl-003-h.jpg`, senza titolo né testo: sito identico a prima;
- titolo e descrizione del documento riportati: «Modulo per consulenze a distanza», descrizione vuota;
- **il file del documento non è stato riportato**: resta il PDF sintetico di prova 1G-15, con data 28/10/2026, e l'originale non si recupera dall'area. Si sistema con HO-035.

### Prove accessorie (25 s; ripreso una volta per un errore dello script, «media e testo» in minuscolo)

| Obiettivo | Osservato | Esito |
|---|---|---|
| 1. documento nuovo | «Nuovo documento» (categoria «Moduli consulenze», l'unica proposta) › pagina `/download/documento-nuovo-di-prova-collaudo-1g-15/` 200, con descrizione, «Dimensioni file 39.53 KB», date 28 Ottobre 2026; file `/media/2026/10/prova-1g-15-nuovo.pdf` 200; presente in `/download-category/moduli-consulenze/`. I 4 documenti riservati non compaiono né nell'elenco «Documenti» né nella scelta del blocco. Nessun messaggio dopo «Crea il documento», che porta all'editor del documento (W8-23) | riuscito |
| 2. blocco «Documento» | con l'etichetta: `<a href="/download/documento-nuovo-di-prova-collaudo-1g-15/">Scarica il documento di prova collaudo 1G-15</a>`; senza: il titolo del documento; rimessa. Dentro «Media e testo» («Aggiungi blocco in «media e testo»») compare come secondo collegamento. Nell'albero i blocchi si chiamano solo «DOCUMENTO — documento» e «MEDIA E TESTO — media e testo», senza dire quale documento (W8-33) | riuscito |
| 3. eliminazione con la pagina | «Non si può eliminare — È citato da un blocco «Documento»: il blocco va tolto prima. Pagina di prova collaudo 1G-15 (/prova-collaudo-1g-15/)» | riuscito |
| 4. voce di menu, poi eliminazione | tolti i blocchi e ripubblicata la pagina; voce «Un indirizzo scritto a mano» verso `/download/…/`: «Non si può eliminare — È usato in un menu: le voci vanno tolte prima dal menu. Prova collaudo 1G-15 documento, nel menu Menu principale». Tolta la voce, il menu è identico. Conferma: «La pagina del documento e la sua voce nell’elenco della categoria risponderanno «pagina non trovata»; … Il file PDF sparisce dall’archivio…». Pagina e file 404; nessun messaggio dopo (W8-23). Pagina di prova eliminata | riuscito |
| anteprima = pubblica | 4 pubblicazioni su 4 uguali | uguale |

**Registro (1D-37).** Righe trovate:

- «Ha modificato il documento» due volte (modifica e ripristino);
- «Ha sostituito un media | Modulo per consulenze a distanza.pdf»;
- 5 «Ha modificato il carosello», che non distinguono sostituzione, aggiunta, riordino e rimozione;
- «Ha creato un documento» e «Ha eliminato un documento», con l'oggetto generico «Documento» (W8-20);
- voci di menu come «Voce di menu».

Operazioni senza riga: nessuna.

Resta nel collaudo:

- il file del «Modulo per consulenze a distanza», sostituito;
- i media `prova-1g-15.png` e `prova-1g-15-b.png`.

## 6. HO-051 — account e impostazioni (1G-16)

Scostamento dall'handoff: la seconda amministrazione è stata creata **dall'area** («Nuova persona», ruolo «Amministrazione»), non con `tools\collaudo\crea-account.ps1`. Lo chiede il brief: nel collaudo si scrive solo dall'interfaccia, e lo strumento scrive direttamente nel database.

### Parte A (compito)

| Verifica del §4 | Osservato | Esito |
|---|---|---|
| 1. creato, attivo, Redazione | «Nuova persona» › «Crea account» › riquadro «Password temporanea per Persona di prova collaudo 1G-16», con l'avviso «Questa password non verrà mostrata di nuovo…» › «Ho consegnato la password». Riga: Redazione, Attivo, «Mai». Dopo la chiusura del riquadro la password non è più nella pagina | riuscito |
| 2. entra e lavora; niente persone, impostazioni o registro | primo accesso › «Cambia password — Prima di proseguire scegli una nuova password.» › «Pagine». Aree: solo «Redazione»; sezioni Pagine…SEO e indirizzi. Apre «Pagine» e «Menu»; `/admin/impostazioni`, `/impostazioni/persone` e `/impostazioni/registro` riportano a «Pagine» senza messaggio. Il lavoro di 1G-1…1G-8 non è stato ripetuto con questo account | riuscito |
| 3. reimpostazione | finestra «Per Persona di prova collaudo 1G-16 nasce una password temporanea, mostrata una sola volta; le sue sessioni si chiudono e al prossimo accesso dovrà sceglierne una nuova.» › «Reimposta». Sessione aperta chiusa (→ `/admin/accesso`); vecchia password: «Accesso non riuscito — Indirizzo o password non corretti.»; la temporanea entra e chiede una password nuova | riuscito |
| 4. disattivato | «…non potrà più entrare e le sue sessioni aperte si chiudono subito. L’account non viene cancellato e si può riattivare.». Sessione chiusa; accesso: «**Accesso non riuscito — Indirizzo o password non corretti.**», identico a quello per password errata, quindi non rivela l'account | riuscito |
| 5. riattivato e di nuovo disattivato | «Riattiva»: rientra; disattivato alla fine | riuscito |
| 6. nessuna password visibile dopo | sì, salvo il riquadro temporaneo | riuscito |
| 7. registro a nome di amministrazione | «Ha creato un account», «Ha reimpostato una password», «Ha disattivato un account», «Ha riattivato un account», tutti di Agente di collaudo (amministrazione); l'oggetto dice solo «Account» (W8-20). L'account di prova ha solo le sue righe «Cambio della password» e «Cambio di area» | riuscito |

Altri dati:

- Nessun messaggio di riuscita dopo creazione, modifica, disattivazione e riattivazione: cambia solo la riga dell'elenco (W8-23).
- Tempi: **33 s** fino alla reimpostazione, più **14 s** per disattivazione e riattivazione.
- Esito: **riuscito**.

### Parte B (impostazioni, 35 s più 9 s)

Valori di partenza registrati con SELECT prima di cambiarli, in `risultati/impostazioni-prima-HO-051.txt` e nel giornale. Il ripristino è avvenuto da un blocco `finally`.

| Impostazione | Effetto sul sito |
|---|---|
| Titolo del sito | sì: `404 Non trovato \| Centro Amoris Laetitia - prova collaudo 1G-16` sulla 404; `Servizi - Centro Amoris Laetitia - prova collaudo 1G-16` in `<title>` e `og:title` di una pagina col modello. La home no: ha un titolo SEO proprio, «Home - Centro Amoris Laetitia» |
| Descrizione del sito | nessun effetto visibile: la home ha una descrizione propria |
| Piè di pagina | sì: «Piè di pagina di prova collaudo 1G-16» |
| Indirizzo e telefono | sì, solo nei dati strutturati della home |
| Articoli per pagina = 7 | nessun effetto (atteso); `0`: «Non è stata salvata — «Articoli per pagina» deve essere un numero intero da 1 a 50.», valore rimasto 7 |
| Formato data `d/m/Y` | sì nella pagina del documento (`05/04/2022`); la data sotto il titolo delle notizie resta «23 Feb 2026» (atteso) |
| Lingua `en_US` | `<html lang="en">`, `og:locale` `en_US`, mesi del documento «5 April 2022»; ripristinata: «5 Aprile 2022», `it_IT` |
| Fuso `UTC` | nessuna data cambiata (nessuna vicina alla mezzanotte) |
| Formato ora `H:i`, primo giorno `0` | salvati, nessun effetto (atteso) |
| robots.txt e sitemap | 200 e 200 prima e dopo; la schermata non li mostra e non ha un comando per aggiungere impostazioni |
| valori riservati | nessuno visibile; nessuna impostazione `is_secret` |

Il messaggio di ogni salvataggio è «Salvata.».

Ripristino:

- **identico, salvo una differenza:** `contact.address` era `null` e ora è `""`. Svuotare il campo dall'area salva una stringa vuota, e lo stato di partenza non si ottiene dall'interfaccia. Sul sito non si vede.
- La schermata mostra «Pagina iniziale» e «Logo del sito» come identificativi tecnici (UUID): non è un difetto del compito, ma è poco leggibile.

### Parte C (account)

| Obiettivo | Osservato | Esito |
|---|---|---|
| 1. nome ed email dell'account di prova | «Modifica»: per un altro account non chiede la password attuale. Un indirizzo già usato: «Modifiche non salvate — Esiste già un account con questo indirizzo.». Poi riga «Persona di prova collaudo 1G-16 rinominata / prova-1g-16-nuova@example.invalid» | riuscito |
| 2. sessione chiusa; nuovo sì, vecchio no | sessione → `/admin/accesso`; vecchio indirizzo «Indirizzo o password non corretti.»; nuovo entra | riuscito |
| 3. seconda amministrazione creata | dall'area (vedi sopra); primo accesso con cambio obbligato | riuscito |
| 3. proprio nome | senza password: «Scrivi la tua password attuale.»; il browser ferma anche l'invio con il suo avviso nativo, in inglese nel Chromium di prova. Password errata: «La password attuale non è corretta.»; nome invariato nell'elenco e nel database. Password giusta: riuscito, ma solo dopo **circa 24 s** di attesa (ritardo progressivo dopo un errore) | riuscito |
| 3. propri ruoli | senza password: «Scrivi la tua password attuale.»; errata: «La password attuale non è corretta.»; ruoli invariati («Amministrazione»). Giusta: «Amministrazione, Redazione». **Tolta la Redazione**: la modifica è salvata, ma l'area mostra «Non è stato possibile — Serve un accesso valido.» e la sessione si chiude senza spiegazione (W8-28) | riuscito con difficoltà |
| 3. propria password | **nessun comando nell'area:** il menu della persona contiene solo nome, indirizzo e «Disconnetti» (W8-27). Ho usato l'indirizzo `/admin/password`, «Cambia password — Scegli una nuova password.». Attuale errata: «Password non cambiata — La password attuale non è corretta.», e la vecchia entra ancora. Giusta: la nuova entra, la vecchia no. La sessione in corso resta aperta | riuscito con difficoltà |
| 3. propria riga | solo «Modifica» e «Ruoli»: né «Reimposta password» né «Disattiva» | riuscito |
| 3. proprio indirizzo | con la password giusta: nessun messaggio, si torna all'accesso; vecchio indirizzo «Indirizzo o password non corretti.», nuovo entra | riuscito |
| blocco dei tentativi | mai comparso: 3 password attuali errate e 5 accessi falliti in tutto | — |
| disattivata alla fine | sì, con il mio account di amministrazione | riuscito |
| 4. registro | modifiche dei punti 1 e 3 presenti; quelle del punto 3 a nome della seconda amministrazione. Nessun indirizzo email e nessuna chiave `password` nei dettagli. Ogni password attuale errata su nome o ruoli lascia **anche** «Cambio della password — Non riuscita» (W8-30) | riuscito |

Tempi:

- punti 1-2: **14 s**;
- punto 3: circa **50 s** fino ai ruoli, più **37 s** dopo la ripresa.

La ripresa è servita perché la sessione si chiude togliendosi un ruolo (W8-28). Ho rientrato con la password salvata nel file di stato.

**Esito di HO-051:** parte A **riuscita**; parte B riuscita, con il ripristino di `contact.address` a `""`; parte C **riuscita con difficoltà** (W8-27, W8-28).

Resta nel collaudo:

- due account disattivati: «Persona di prova collaudo 1G-16 rinominata» (`prova-1g-16-nuova@example.invalid`, Redazione) e «Seconda amministrazione di prova collaudo 1G-16 rinominata» (`amministrazione-prova-1g-16-nuova@example.invalid`, Amministrazione). Le loro password sono in `account-prova-1g-16.json`;
- `contact.address` = `""`.

## 7. HO-052 — accessi negati alla redazione (1G-17)

| Riga | Con `redazione` | Senza accesso | Esito |
|---|---|---|---|
| proposte nell'area | nessuna: aree «Redazione»; sezioni senza persone né registro; menu della persona con solo «Disconnetti» | — | riuscito |
| 1. `/admin/impostazioni/persone` | riportato a «Pagine», nessun messaggio | riportato a `/admin/accesso` | riuscito |
| 2. `/admin/impostazioni/registro` | riportato a «Pagine», nessun messaggio | riportato a `/admin/accesso` | riuscito |
| 3. GET `/accounts` | **403** `{"error":{"code":"NOT_AUTHORIZED","message":"Operazione non consentita."…}}` | **401** «Serve un accesso valido.» | riuscito |
| 4. GET `/audit` | **403**, stesso corpo | **401** | riuscito |
| 5. GET `/audit/contents?search=prova` | **403**, stesso corpo | **401** | riuscito |
| 6-8. POST/PATCH/POST reset | non provato dal browser (come da handoff) | **403** `CSRF_TOKEN_INVALID` «La richiesta non porta un token valido.» | riuscito |
| dati nelle risposte di rifiuto | nessun dato di account o di registro | nessuno | riuscito |

Altri dati:

- Durante il passaggio per le righe 1 e 2, l'area chiama `GET /accounts` e `GET /audit?view=changes&limit=50`, che rispondono 403 (o 401) in console prima del rinvio. Non mostra dati (W8-32).
- Tempo: **11 s**. Esito: **riuscito**. Resta nel collaudo: nulla.

## 8. Registro delle operazioni (1D-37), riepilogo

Script `24-registro.spec.ts`, con l'account amministrazione: «Tutte le operazioni», un filtro per persona, 28/10/2026. Righe dalle 11:47:

| Persona | Righe |
|---|---|
| Agente redazione | 140 |
| Agente amministrazione | 41 |
| Persona di prova | 8 |
| Seconda amministrazione | 18 |

Il confronto per azione con `audit_log` torna: ogni operazione riuscita o rifiutata dei compiti ha la sua riga, salvo quanto segue.

| Che cosa | Dove manca o è debole |
|---|---|
| redirect nati da cambi d'indirizzo (1G-11) e di categoria (1G-12) | nessuna riga propria (W8-31) |
| oggetto delle righe | «Account», «Impostazione», «Documento», «Carosello», «Categoria», «Voce di menu», «Media» senza nome (W8-20, ripetuto); contenuti eliminati: «contenuto non più presente» sulle righe precedenti (W8-29) |
| modifiche al carosello | tutte «Ha modificato il carosello», senza dire quale slide né quale operazione |
| password attuale errata su nome o ruoli | doppia riga, una delle quali «Cambio della password» (W8-30) |

## 9. Difetti nuovi

| Id | Gravità | Dove | Difetto | Causa | Evidenza |
|---|---|---|---|---|---|
| W8-22 | bassa | editor › «Indirizzo» › «Pagina genitore»; Categorie › «Modifica categoria» › «Categoria genitrice» | Le discendenti non sono proposte come genitore, e nulla lo spiega. Chi cerca di fare della madre una figlia della figlia non trova l'opzione e non riceve il messaggio, che esiste solo nell'API: «La pagina scelta come genitore sta sotto questo contenuto.». HO-046 §4.5 e HO-047 chiedono un rifiuto spiegato | `apps/api/src/modules/content/address.ts:319-330` filtra le discendenti; il messaggio sta in `address.ts:130`. Nessun aiuto in `apps/admin/src/components/editor/ContentAddressPanel.tsx:420-434`; per le categorie `apps/api/src/modules/terms/category.ts:78` | `12-ho046.jsonl` (`opzione-genitore-passo5: trovata false`); `14-ho047-accessorie.jsonl` (`ciclo-opzioni`) |
| W8-23 | bassa | Categorie (crea, modifica, elimina); Menu (aggiungi, elimina voce); Documenti (crea, elimina); Persone e permessi (crea, modifica, disattiva, riattiva; proprio indirizzo) | Nessun messaggio di riuscita: la finestra si chiude e l'elenco si aggiorna. Le pagine invece dicono «Contenuto eliminato», i documenti «Modifiche salvate». Stesso schema di W8-17 e W8-19, su altre schermate | per esempio `apps/admin/src/components/terms/CategoryManager.tsx:126-140` e `:257-261`; `CategoryDeleteAction.tsx:100-103`; `documents/DocumentCreateDialog.tsx:106` e `DocumentDeleteAction.tsx:99` portano altrove senza avviso | `13-ho047.jsonl` (`categoria-creata []`, `rinomina []`); `14-ho047-accessorie.jsonl`; `18-ho050-accessorie.jsonl` (`crea-documento`); `21-ho051-ac.jsonl` (`testi []`) |
| W8-24 | media | Pagine › elenco ed editor | La pagina iniziale non si riconosce: il titolo è vuoto (dalla sorgente), l'elenco mostra una riga con il solo «/home/», e né l'elenco né l'intestazione dell'editor dicono «pagina iniziale». Lo dice solo la scheda «Indirizzo». HO-048 §4.4 richiede aiuto | nessun segno di `isHome` in `apps/admin/src/components/ContentList.tsx`; titolo vuoto in `contents` (anche in `amoris`) | `15-ho048.jsonl` (`home-nell-elenco`, `home-editor: h1 ""`) |
| W8-25 | bassa | Media › caricamento di PDF e MP4 | Dopo il caricamento di un PDF o di un MP4 non compare alcuna conferma sotto il nome del file; le immagini dicono «N dimensioni derivate generate.» | `apps/admin/src/components/media/MediaLibrary.tsx:219-223`: avviso solo se `derivatives > 0` | `16-ho049.jsonl` (`esito-prova-1g-14.pdf`, `.mp4`) |
| W8-26 | media | sito, blocco «Presentazione a scorrimento»; Caroselli › «Titolo» | Tre titoli di slide importati contengono HTML (`<div align="center">…<br>…<i class="fa-heart"></i></div>`). Sul sito si leggono come testo con i tag visibili, anche nell'`alt`; nell'editor appaiono come codice. Oggi nessuna pagina mostra il carosello, quindi il problema emerge appena lo si inserisce | `packages/blocks/src/render/Slider.tsx:58` e `:64` rendono `heading` come testo; il dato importato in `slider_slides.heading` contiene markup | `17-ho050.jsonl` (`slide-prima`, `confronto-pagina-carosello`) |
| W8-27 | media | area, menu della persona | Nessun comando per cambiare la propria password: il menu ha solo «Disconnetti», e la pagina `/admin/password` si raggiunge solo scrivendone l'indirizzo, o quando il cambio è obbligato. HO-051 C3 chiede «la procedura che l'area offre a chi è entrato» | `packages/ui/src/shell/UserMenu.tsx:34-49`; `apps/admin/src/components/AreaShell.tsx:123-130` non passa altre voci | `22-ho051-c3.jsonl` (`C3-menu-utente`) |
| W8-28 | media | Persone e permessi › «Ruoli» sul proprio account | Togliendosi un ruolo, la modifica è salvata e la sessione si chiude (scelta voluta), ma l'area mostra l'errore «Non è stato possibile — Serve un accesso valido.» senza spiegare che bisogna rientrare | `apps/api/src/modules/accounts/service.ts:236-244` revoca le sessioni; l'elenco ricaricato dopo il salvataggio riceve 401 (`AccountsScreen.tsx`, ricarica dopo `PATCH`) | `21-ho051-ac.jsonl` (`C3-ruoli-giusta-togli`) |
| W8-29 | bassa | Registro › colonna «Oggetto» | Per un contenuto eliminato, le righe precedenti (creato, modificato, pubblicato, indirizzo) mostrano «contenuto non più presente»: il titolo resta solo sulla riga «Ha eliminato» | `apps/admin/src/components/audit/auditFormat.ts:54-61`: il titolo si legge solo dal contenuto ancora esistente | `24-registro.jsonl` (`ui Agente di collaudo (redazione)`) |
| W8-30 | bassa | Registro | Una password attuale errata nel cambio del proprio nome o dei propri ruoli lascia anche la riga «Cambio della password — Non riuscita», che fa pensare a un tentativo di cambio password | `apps/api/src/modules/auth/service.ts:93-104`: `verifyCurrentPassword` scrive sempre `auth.password_changed` | `24-registro.jsonl` (`ui Seconda amministrazione…`) |
| W8-31 | bassa | Registro | I redirect nati da un cambio di indirizzo o di categoria non hanno una riga propria: ne restano solo i conteggi nel dettaglio di «Ha cambiato l'indirizzo», che l'elenco non mostra. HO-046 §5 chiede ciascuno | dettaglio `redirectsCreated`/`Retargeted`/`Removed` della riga `content.address.update`; nessuna scrittura `redirect.create` | `24-registro.jsonl` (`db-dettagli-chiave`) |
| W8-32 | bassa | area › indirizzi di Impostazioni aperti da Redazione o senza accesso | Prima del rinvio la schermata chiama `GET /accounts` e `GET /audit…`, che rispondono 403 o 401 in console. Nessun dato mostrato | le schermate caricano i dati mentre `AreaShell.tsx:68-86` decide il rinvio | `23-ho052.jsonl` |
| W8-33 | bassa | editor › albero dei blocchi | I blocchi «Documento» e «Media e testo» si chiamano «documento» e «media e testo», senza il titolo del documento: con due documenti nella pagina non si distinguono | `apps/admin/src/lib/editor/tree.ts:327-347`: `labelOf` non tratta `document` né `media_text` | `18-ho050-accessorie.jsonl` (`link-media-e-testo.struttura`) |

Difetti noti che si sono ripresentati:

- **W8-01:** miniature 404 su 3301, nell'immagine in evidenza, nel selettore e nell'editor del carosello: 12 a ogni apertura.
- **W8-09:** a ogni accesso e a ogni apertura dell'editor.
- **W8-13:** «Salva titolo e colonne» di una notizia pubblicata cambia subito il sito.
- **W8-20:** oggetti generici nel registro, anche per account, impostazioni, documenti, caroselli e categorie.

Non si sono presentati W8-03, W8-04, W8-05 (la pagina nuova era fra le 100 opzioni) e W8-06.

Altre osservazioni, non difetti:

- in HO-046 l'ordine dei passi 4 e 5 va invertito;
- in HO-050 nessun carosello è mostrato dal sito;
- in HO-051 lo strumento `crea-account.ps1` contrasta con la regola «si scrive solo dall'area»;
- l'avviso nativo del campo obbligatorio è nella lingua del browser.

## 10. Che cosa resta nel collaudo

- **Pagine 1G-11:**
  - `Pagina di prova collaudo 1G-11 madre` (`/prova-collaudo-1g-11-madre/`), `… altra` (`/prova-collaudo-1g-11-altra/`) e `… figlia` (`/prova-collaudo-1g-11-altra/prova-collaudo-1g-11-figlia/`), tutte pubblicate;
  - 5 redirect automatici `/prova-collaudo-1g-11-…`.
- **Notizie 1G-12:**
  - `Notizia di prova collaudo 1G-12` (in «Senza categoria») e `… bis` (in «Categoria di prova collaudo 1G-12 rinominata»), entrambe ritirate, quindi bozze;
  - la categoria `Categoria di prova collaudo 1G-12 rinominata` (`/category/categoria-di-prova-collaudo-1g-12/`);
  - il redirect automatico `/category/figlia-prova-1g-12/` → `/category/madre-prova-1g-12/figlia-prova-1g-12/`, che oggi porta a un 404.
- **Media:** `prova-1g-12.png`, `prova-1g-14-ammessa.png`, `prova-1g-14.pdf`, `prova-1g-14.mp4`, `prova-1g-15.png`, `prova-1g-15-b.png`.
- **Documento «Modulo per consulenze a distanza»:** titolo e descrizione ripristinati; **file sostituito** con il PDF sintetico 1G-15 e data di aggiornamento 28/10/2026. Si ripristina solo con HO-035.
- **Carosello «Slider home»:** identico alla partenza.
- **Menu principale:** identico alla partenza (66 voci).
- **Impostazioni:** come alla partenza, salvo `contact.address` = `""` invece di `null`, invisibile sul sito.
- **Account:** «Persona di prova collaudo 1G-16 rinominata» e «Seconda amministrazione di prova collaudo 1G-16 rinominata», **disattivati**. Le password sono solo in `C:\work\amoris-collaudo.stato\account-prova-1g-16.json`.
- **Registro:** le righe dei compiti, a nome dell'agente e dei due account di prova.
- **Contenuti eliminati, con le loro voci di menu tolte:** pagine 1G-13 e 1G-15, categorie madre e figlia 1G-12, documento nuovo 1G-15.

## 11. Righe della matrice `docs/qa/editability-matrix.csv`

Testo proposto per `esito_collaudo`. La matrice non è stata modificata.

| tipo | campo | esito_collaudo |
|---|---|---|
| pagina e notizia | slug | 1G-11 (agente): riuscito; un solo 301 da ogni vecchio indirizzo, nessuna catena né ciclo, redirect preesistenti invariati |
| pagina e notizia | pagina genitore | 1G-11 (agente): riuscito, figlie aggiornate; discendenti non proposte e nessun messaggio sul ciclo (W8-22) |
| redirect | redirect creati dal cambio di slug o genitore | 1G-11 (agente): creati, ridiretti e tolti senza catene, elencati nella conferma; nessuna riga propria nel registro (W8-31) |
| pagina e notizia | elimina il contenuto | 1G-13 (agente): conferma con nome digitato; rifiuti per figlie, menu e pagina iniziale spiegati; pagina iniziale non riconoscibile nell'elenco (W8-24) |
| pagina e notizia | mostrare il titolo | 1G-12 (agente): riuscito, h1 `screen-reader-text` e data restano; si applica subito (W8-13) |
| pagina e notizia | notizia in primo piano (sticky) | 1G-12 (agente): riuscito; l'area avverte che gli elenchi non cambiano, ordine del sito invariato |
| notizia | estratto | 1G-12 (agente): riuscito in home, archivio e ricerca |
| notizia | immagine in evidenza | 1G-12 (agente): riuscito in home, archivio e ricerca; miniatura dell'editor 404 (W8-01) |
| notizia | categorie | 1G-12 (agente): pubblicazione senza categoria rifiutata con messaggio chiaro; ultima categoria non si toglie; cambio riuscito |
| notizia | data mostrata sotto il titolo | 1G-16 (agente): invariata col formato data di prova, come atteso (DR-270) |
| categoria | nome | 1G-12 (agente): rinomina riuscita, archivio con nome nuovo; nessun messaggio (W8-23) |
| categoria | slug | 1G-12 (agente): proposto dal nome, scelto alla creazione |
| categoria | percorso dell'archivio | 1G-12 (agente): invariato dopo la rinomina; spostata sotto la madre, nuovo percorso e un solo 301 |
| categoria | descrizione | 1G-12 (agente): riuscito, solo in `meta description` |
| categoria | categoria genitore | 1G-12 (agente): riuscito con un solo 301; ciclo impedito senza messaggio (W8-22) |
| categoria | eliminazione | 1G-12 (agente): rifiuti per sottocategorie, notizie e menu spiegati; conferma; il vecchio indirizzo resta 301 verso un 404 (avvertito) |
| categoria | titolo SEO e indicizzazione dell'archivio | 1G-12 (agente): titolo, descrizione SEO, noindex e nofollow messi e tolti |
| voce di menu | destinazione (contenuto / categoria / indirizzo) | 1G-12/13/15 (agente): voci verso categoria, contenuto e indirizzo aggiunte e tolte, menu identico dopo; nessun messaggio (W8-23) |
| media | caricare un file | 1G-14 (agente): SVG, HTML, EXE, finto PNG e PNG da 21 MB rifiutati in italiano, elenco invariato; PNG, PDF e MP4 entrati; PDF e MP4 senza conferma (W8-25) |
| documento | titolo | 1G-15 (agente): riuscito sulla pagina del documento; l'indirizzo non segue il titolo |
| documento | descrizione | 1G-15 (agente): riuscito |
| documento | file | 1G-15 (agente): sostituito sullo stesso indirizzo, file nuovo scaricato (metadati tolti) |
| documento | ultimo aggiornamento | 1G-15 (agente): aggiornato a oggi |
| documento | dimensione del file | 1G-15 (agente): mostrata sul documento nuovo (39.53 KB) |
| documento | creare un documento | 1G-15 (agente): riuscito, pagina `/download/…` e voce nella categoria; nessun messaggio (W8-23) |
| documento | eliminare un documento | 1G-15 (agente): rifiuti per blocco e menu spiegati; dopo la conferma pagina e file 404 |
| pagina e notizia | blocco «Documento»: inserimento | 1G-15 (agente): riuscito, propone solo i documenti pubblici; nell'albero non dice quale documento (W8-33) |
| pagina e notizia | blocco «Documento»: configurazione | 1G-15 (agente): etichetta e titolo come testo del collegamento, riuscito |
| pagina e notizia | blocco «Media e testo» e «Elenco articoli»: inserimento e spostamento | 1G-15 (agente): «Media e testo» inserito con un Documento dentro, riuscito |
| carosello | sostituire l'immagine di una slide | 1G-15 (agente): riuscito sul sito, solo in una pagina di prova (nessuna pagina mostra il carosello) |
| carosello | aggiungere una slide | 1G-15 (agente): riuscito |
| carosello | togliere una slide | 1G-15 (agente): riuscito |
| carosello | ordine delle slide | 1G-15 (agente): riuscito |
| carosello | pagine che lo mostrano | 1G-15 (agente): elenco corretto (nessuna, poi la pagina di prova) |
| slide | titolo | 1G-15 (agente): riuscito; tre titoli importati mostrano HTML come testo (W8-26) |
| slide | testo | 1G-15 (agente): riuscito |
| impostazioni del sito | titolo del sito | 1G-16 (agente): visibile nella 404 e nelle pagine col modello SEO; la home ha un titolo proprio |
| impostazioni del sito | descrizione del sito | 1G-16 (agente): nessun effetto visibile |
| impostazioni del sito | testo del piè di pagina | 1G-16 (agente): riuscito |
| impostazioni del sito | indirizzo del Centro | 1G-16 (agente): nei dati strutturati; svuotato salva `""`, non `null` |
| impostazioni del sito | telefono del Centro | 1G-16 (agente): nei dati strutturati |
| impostazioni del sito | lingua, fuso orario, formato data, articoli per pagina | 1G-16 (agente): en_US cambia `lang`, `og:locale` e i mesi; formato data solo nei documenti; fuso e articoli senza effetto visibile; 0 rifiutato in italiano |
| impostazioni del sito | formato ora e primo giorno della settimana | 1G-16 (agente): salvati, nessun effetto (atteso) |
| impostazioni del sito | contenuto di robots.txt e sitemap attiva | 1G-16 (agente): non in schermata; robots.txt e sitemap 200 prima e dopo |
| impostazioni del sito | impostazioni riservate | 1G-16 (agente): nessun valore riservato visibile |
| impostazioni del sito | creare nuove chiavi | 1G-16 (agente): nessun comando, come previsto |
| account | creare un account | 1G-16 (agente): riuscito, password temporanea una sola volta, cambio obbligato; nessun messaggio (W8-23) |
| account | disattivare e riattivare | 1G-16 (agente): sessione chiusa, messaggio identico a password errata; riattivato entra |
| account | reimpostare la password | 1G-16 (agente): sessioni chiuse, vecchia password rifiutata, temporanea entra |
| account | ruoli dell'account | 1G-16 (agente): riuscito; togliersi un ruolo chiude la sessione con un errore (W8-28) |
| account | nome ed email dopo la creazione | 1G-16 (agente): riuscito, indirizzo già usato rifiutato, sessione chiusa, entra solo col nuovo |
| account | modifiche al proprio account (nome, email, ruoli, password) | 1G-16 (agente): password attuale richiesta, rifiuti senza o errata senza modifiche; propria password solo scrivendo /admin/password (W8-27) |
| account | accesso alla schermata Persone e permessi | 1G-17 (agente): Redazione riportata a «Pagine», API 403 senza dati, anonimo 401/403; 403 in console prima del rinvio (W8-32) |
| registro | consultazione e filtri | 1G-11…1G-16 (agente): ogni operazione ha la sua riga; redirect nati senza riga (W8-31), «contenuto non più presente» (W8-29), doppia riga sulla password errata (W8-30), oggetti generici (W8-20) |
