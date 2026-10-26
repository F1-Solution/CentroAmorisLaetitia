# ADR-012 — Pulizia dei metadati di PDF e MP4 caricati

| | |
|---|---|
| **Stato** | **approvata** il 2026-10-26 (DR-258, DR-262) |
| **Data** | 2026-10-26 |
| **Wave** | `1G-W6` |
| **Decide** | con quali strumenti e con quali limiti si tolgono i metadati ai PDF e agli MP4 caricati o sostituiti dal CMS |
| **Origine** | DR-254; decisioni D154, D155 e D158 |

---

## 1. Contesto

Le immagini escono da `sharp` senza EXIF né GPS (D145-A). PDF e MP4, invece, si salvavano
byte per byte come arrivavano, con ciò che il programma di origine vi aveva scritto.

- In un **PDF** autore e programma stanno nel dizionario Info e nel flusso XMP del
  catalogo; un aggiornamento incrementale lascia nel file anche le versioni vecchie, finché
  il file non si riscrive da capo.
- In un **MP4** la posizione sta nei riquadri `udta` o `meta`, alcune camere la registrano
  come traccia dati, e i capitoli e un riquadro XMP `uuid` possono portare altri dati.

I valori possono essere dati personali, e il Centro tratta dati delicati. Nel pacchetto
`package.json` non c'è alcuna libreria per PDF o MP4; la CI gira su `ubuntu-latest`, che
distribuisce `qpdf` 11.9.0.

## 2. Opzioni

| | Opzione | Costi | Rischi |
|---|---|---|---|
| A | **Due programmi esterni** chiamati dall'API in un processo separato: `qpdf` per il PDF, `ffmpeg` per l'MP4 | installarli in sviluppo, in CI e nell'immagine della 1F | un programma assente blocca il caricamento di PDF e video; licenze da verificare |
| B | Solo pacchetti npm (`@cantoo/pdf-lib` e codice del progetto per l'MP4) | nessun programma di sistema | un PDF si ricostruisce con una libreria che non riscrive da capo il file; l'MP4 richiederebbe codice proprio sui riquadri |
| C | `exiftool` per l'MP4 e `qpdf` per il PDF | due programmi, uno dei quali in Perl | ExifTool scrive i tag noti e lascia le tracce |

## 3. Scelta

**Opzione A** (DR-258), con la **CI che scarica il binario ufficiale** di `qpdf` (DR-262).

**Processo.** `execFile` con argomenti in un array, senza shell; file temporanei con nomi
generati (mai quello del caricamento) in una cartella propria che si cancella sempre, e le
cartelle `amoris-scrub-*` rimaste da una pulizia interrotta si cancellano all'avvio dell'API se
non cambiano da più di 10 minuti (una più recente può essere una pulizia in corso);
tempo limite di **30 s** per un PDF e **120 s** per un MP4, con il processo ucciso allo
scadere; uscita letta per al massimo 64 KB e mai copiata nel log; ambiente ridotto al solo
`PATH` (più `SystemRoot` su Windows), senza segreti né configurazione del servizio.

**Comandi esatti.**

- PDF: `qpdf --no-warn --remove-info --remove-metadata <ingresso> <uscita>`. L'uscita 0 e l'uscita 3
  (avvisi, file scritto) valgono come riuscita; ogni altra uscita è un file illeggibile.
- MP4: `ffmpeg -nostdin -hide_banner -loglevel error -protocol_whitelist file -f mov -i <ingresso>
  -map 0:V? -map 0:a? -map_metadata -1 -map_chapters -1 -c copy -fflags +bitexact
  -movflags +faststart -fs <limite del tipo> -f mp4 -y <uscita>`. `-f mov` fa leggere il file solo come MP4,
  senza playlist, e i riferimenti esterni (`dref`) sono disattivati per default in `ffmpeg`:
  è questo che impedisce a un file che si finge MP4 di aprirne altri (`-protocol_whitelist file`
  limita i protocolli ma non esclude i file locali); si copiano le sole tracce audio e video
  (`0:V` con la maiuscola esclude copertine e miniature), senza ricodifica; l'indice sta
  sempre in testa. `-fs` ferma la scrittura appena oltre il limite di peso del tipo: un
  indice che ripete gli stessi byte non riempie il disco, e il file oltre il limite si
  rifiuta con `413 MEDIA_TOO_LARGE`.

**Versioni minime.** `qpdf` **11.10** (le opzioni `--remove-info` e `--remove-metadata`
esistono dalla 11.10.0; la CI usa la **12.4.2**); `ffmpeg` con i demuxer e i muxer MOV/MP4
(in sviluppo la 9.0.2).

**Sicurezza.** `-c copy` non evita l'apertura dei decoder: `avformat_find_stream_info` apre
quello dichiarato nel file, quindi la superficie esposta a un file ostile è il demuxer `mov`
più i decoder raggiungibili. I programmi ricevono un ambiente ridotto e `ffmpeg` un limite di
scrittura (`-fs`). Il limite di memoria è un requisito dell'immagine della 1F (DR-263);
l'elenco dei codec ammessi è `h264`, `hevc` e `aac`, da attuare prima della 1F (DR-264).

**Posizione nel flusso.** `media/scrub.ts` si chiama nel caricamento e nella sostituzione,
dopo il riconoscimento del tipo e prima dell'impronta: peso, impronta e byte salvati sono
quelli del file ripulito, che rispetta comunque il limite di peso del suo tipo. Le immagini
restano a `sharp` e non dipendono da questi programmi. I file già importati restano byte per
byte come sono (D155).

**Errori.** Un file che il programma non legge dà `400 MEDIA_FILE_INVALID`, come ogni altro
esito non riuscito, compreso un processo terminato da un segnale senza che sia scaduto il
tempo (arresto anomalo, OOM killer): lo stesso file dà lo stesso esito su Linux e Windows. Un
programma assente, non eseguibile o oltre il tempo dà `503 MEDIA_SCRUB_UNAVAILABLE`: «Il caricamento
di PDF e video è sospeso: il servizio non riesce a ripulire i file. Avvisa chi gestisce il
sito.» Nessun file non ripulito si salva mai. Il log riporta solo programma, codice di
uscita e durata, mai il nome del file né l'uscita del programma.

**Configurazione.** `QPDF_PATH` e `FFMPEG_PATH` (default: il nome del programma, cercato
nel `PATH`), `SCRUB_PDF_TIMEOUT_MS` e `SCRUB_VIDEO_TIMEOUT_MS`.

**Che cosa sparisce** (provato con file sintetici):

- PDF: dal dizionario Info autore, programma, titolo e data di creazione (resta la sola
  `ModDate`, vedi sotto) e l'XMP del catalogo, comprese le versioni vecchie lasciate da un
  aggiornamento incrementale;
- MP4: il contenuto di `udta` e `meta` (dopo la pulizia restano riquadri vuoti, anche `ilst`),
  i riquadri XMP `uuid`, i capitoli e le tracce che non siano audio o video; la copertina
  (traccia `attached_pic`, un JPEG che può avere EXIF e GPS) sparisce con la mappa `0:V?`.

**Che cosa non sparisce, e va saputo:**

- le immagini dentro un PDF con i propri EXIF;
- il testo visibile del documento;
- la `ModDate`, che `qpdf` conserva;
- i dati che un programma scrive dentro il flusso audio o video stesso;
- l'autore (`/T`) e il testo (`/Contents`) delle annotazioni del PDF;
- gli XMP a livello di pagina e di immagine del PDF;
- gli allegati incorporati nel PDF;
- `/PieceInfo`, i dati privati che il programma d'origine scrive nel PDF;
- i valori compilati dei campi `/AcroForm`;
- i titoli dei segnalibri;
- JavaScript e `/OpenAction`;
- il primo elemento di `/ID`.

**CI.** Un passo prima delle prove installa `ffmpeg` da apt, scarica
`qpdf-12.4.2-bin-linux-x86_64.zip` dalla release ufficiale, ne controlla l'impronta SHA-256
(`db367d897829f22c4198ce1094143c9d467bd6ee7dfabc44ba6f02056b24f8b1`) e si ferma se non
coincide, poi stampa le versioni. Versione e impronta si aggiornano insieme. In sviluppo
`qpdf` si installa con HO-032.

Scartate: **B**, perché non riscrive da capo il PDF e lascerebbe il codice dei riquadri MP4
a carico del progetto; **C**, perché non copre le tracce dati e aggiunge un linguaggio in
più. Per la CI, scartati `ubuntu-26.04` con `qpdf` 12.3.2 da apt (anteprima pubblica) e
`qpdf` 11.9 con la modalità JSON (D158).

## 4. Conseguenze

- Nessun PDF né MP4 caricato dal CMS porta più autore, programma, posizione o capitoli.
- Se i programmi mancano, i soli PDF e MP4 non si caricano; le immagini sì.
- Un PDF con password di apertura non si carica; uno con la sola password del proprietario
  si ripulisce e resta apribile, con la sua protezione.
- Un MP4 esce ricomposto con l'indice in testa: parte subito anche da un server che serve
  intervalli di byte.
- L'immagine di produzione, che sceglie la 1F (ADR-009), **deve contenere `qpdf` 11.10 o più
  recente e `ffmpeg`**, e i percorsi si impostano con `QPDF_PATH` e `FFMPEG_PATH`.

**Requisiti per la 1F** (DR-263, DR-264):

- la cartella temporanea della pulizia sta su un volume o un `tmpfs` con quota, separato dai
  dati, perché un arresto durante una pulizia vi lascia una copia non ripulita del file
  caricato finché l'API, al riavvio, non la cancella;
- i programmi girano in un contenitore separato, sotto un utente dedicato, senza rete, con
  il file system in sola lettura salvo la cartella temporanea e con un limite di memoria
  dell'ordine di 1 GB, oltre il quale il file si rifiuta (DR-263);
- `ffmpeg` accetta solo i codec `h264`, `hevc` e `aac` (`-codec_whitelist`); gli altri MP4 si
  rifiutano con «file non valido» (DR-264).

**Licenze, da far verificare a una persona prima della 1F.** `qpdf` è distribuito con
licenza Apache-2.0. `ffmpeg` è LGPL o GPL secondo come è compilato. I due programmi si
usano come processi separati, senza collegarli al codice del progetto; ciò non sostituisce
la verifica, e qui non si dichiara alcuna conformità.

## 5. Reversibilità

Alta: la pulizia sta in un solo modulo; cambiare programma significa riscrivere quel modulo
e i comandi di questa ADR. I file già salvati non cambiano.

## 6. Verifica

- Prove con file sintetici generati nella prova, con i programmi veri: assenza di ogni
  stringa sintetica nei byte, stesse pagine, stesse tracce audio e video, stessa durata;
  caricamento e sostituzione salvano il file ripulito; rifiuti 400 e 503 senza scritture e
  senza il nome del file nel log; nessuna chiamata per le immagini.
- La CI esegue le prove con i programmi installati dal proprio passo.
- Misura di D155-C (DR-259), eseguita il 2026-10-26 sul database e sull'archivio di
  sviluppo, in sola lettura, con uno script fuori da Git che stampa solo conteggi. Sono
  «importati» i media con un identificativo di WordPress. Nessun nome, titolo o valore è
  stato letto da una persona né scritto altrove.

  | File pubblici importati | Totale | Con il dato |
  |---|---|---|
  | PDF, autore nel dizionario Info | 48 | 29 |
  | PDF, programma (`Producer` o `Creator`) | 48 | 48 |
  | PDF, date (`CreationDate` o `ModDate`) | 48 | 48 |
  | PDF, almeno un flusso XMP (del documento, di una pagina o di un'immagine) | 48 | 36 |
  | MP4, posizione | 2 | 0 |
  | MP4, artista, autore, titolo, commento, marca o modello | 2 | 0 |
  | MP4, data di creazione | 2 | 2 |
  | MP4, tracce che non sono audio né video | 2 | 0 |

  Il conteggio dei PDF guarda la revisione corrente: le revisioni vecchie di un
  aggiornamento incrementale non sono contate. Nessun file è illeggibile. Che cosa fare
  degli importati si decide con questi numeri, prima della 1F (DR-259).
