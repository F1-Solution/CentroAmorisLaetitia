# HO-050 — Modificare un documento scaricabile e un carosello (compito 1G-15)

Fase 1G, wave `1G-W8`, compito 1G-15. Scritto il 2026-10-26, aggiornato il 2026-10-27 (DR-281, DR-287).

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Cambiare titolo, descrizione e file di un documento scaricabile pubblico, e vedere sul sito il nuovo testo, la
nuova dimensione e il file nuovo. Poi cambiare un carosello di immagini: sostituire l'immagine di una slide, cambiare
titolo e testo, aggiungerne una, toglierla e riordinarle.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

- Documento: uno dei documenti **pubblici** (sono 4); **non** toccare quelli riservati. Annota quale. Titolo nuovo `Documento di prova collaudo 1G-15`, descrizione `Descrizione di prova collaudo 1G-15`. File nuovo: un PDF qualunque che crei tu (per esempio la stampa in PDF di una pagina del sito, chiamata `prova-1g-15.pdf`).
- Prima di cambiare il documento scarica quello attuale e annota la sua dimensione:

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
$indirizzo = 'sostituisci-con-l-indirizzo-del-file'  # senza barre iniziali e finali
Invoke-WebRequest "http://127.0.0.1:3300/$indirizzo/" -UseBasicParsing -OutFile "$HOME\collaudo\1g-15-prima.pdf"
(Get-Item "$HOME\collaudo\1g-15-prima.pdf").Length
```

- Carosello: uno qualunque già mostrato dal sito (annota dove). Slide nuova: titolo `Slide di prova collaudo 1G-15`, testo `Testo di prova collaudo 1G-15`, immagine generata da te:

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap 1600, 900
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::Purple)
$f = New-Object System.Drawing.Font('Arial', 80)
$g.DrawString('Prova collaudo 1G-15', $f, [System.Drawing.Brushes]::White, 60, 380)
$b.Save("$HOME\collaudo\prova-1g-15.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $b.Dispose()
```

## 4. Come riconoscere la riuscita sul sito

1. Nella pagina o nel blocco che mostra il documento compaiono titolo e descrizione nuovi, con la data di ultimo aggiornamento aggiornata.
2. Il file scaricato dopo la sostituzione ha dimensione e contenuto del tuo PDF, non del vecchio (`Get-FileHash` diverso dal precedente).
3. Il carosello mostra, sul sito, l'immagine sostituita, titolo e testo nuovi nella slide cambiata.
4. La slide aggiunta compare nel carosello; tolta, scompare; l'ordine sul sito segue quello che hai impostato.
5. Le pagine che mostrano quel carosello sono tutte aggiornate: annota quali hai controllato.
6. Annota ogni cosa che avresti voluto cambiare e non hai potuto cambiare: le assenze volute (DR-218) le distinguiamo dopo noi, non sono un difetto da te.
7. Anteprima e pagina pubblica coincidono dove c'è un'anteprima (1G-10).

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-15: conta i loro minuti a parte e non sommarli a quelli del compito.

**Documento nuovo, blocco «Documento» ed eliminazione (DR-281, DR-287).** Dati: documento `Documento nuovo di prova collaudo 1G-15`, con la descrizione `Descrizione del documento nuovo di prova collaudo 1G-15`, il file `prova-1g-15-nuovo.pdf` (un'altra stampa in PDF di una pagina del sito) e una categoria dei download fra quelle esistenti (annota quale); pagina `Pagina di prova collaudo 1G-15` (indirizzo `prova-collaudo-1g-15`), pubblicata, che mostra quel documento con l'etichetta `Scarica il documento di prova collaudo 1G-15`. Obiettivi, nell'ordine:

1. Il documento nuovo ha la sua pagina pubblica in `/download/…/`, con un indirizzo che il sistema ricava dal titolo (annotalo), e compare nell'elenco della sua categoria dei download, come i documenti già presenti. Fra i documenti che puoi creare o scegliere non compaiono mai quelli riservati.
2. Nella pagina di prova il documento compare come collegamento con l'etichetta, e il collegamento porta alla sua pagina `/download/…/`. Senza etichetta il collegamento mostra il titolo del documento; rimetti poi l'etichetta. Lo stesso documento messo anche dentro un blocco «Media e testo» della pagina compare lì come collegamento.
3. Eliminare il documento mentre la pagina lo mostra è rifiutato, con un messaggio in italiano che dice dove è usato.
4. Tolto il documento da entrambi i punti della pagina e ripubblicata la pagina, con nel menu principale una voce `Prova collaudo 1G-15 documento` che porta all'indirizzo della sua pagina pubblica l'eliminazione è ancora rifiutata, con un messaggio che dice che il documento è nel menu. Tolta la voce, il menu del sito torna com'era e il documento si elimina dopo una conferma: la sua pagina pubblica e il suo file rispondono 404. Alla fine elimina anche la pagina di prova.

```powershell
$documento = 'sostituisci-con-l-indirizzo-del-documento'  # per esempio download/nome-del-documento, senza barre iniziali e finali
$file = 'sostituisci-con-l-indirizzo-del-file'  # letto dal collegamento Download della pagina del documento, senza barre iniziali e finali
curl.exe -s -o NUL -w "%{http_code}\n" "http://127.0.0.1:3300/$documento/"
curl.exe -s -o NUL -w "%{http_code}\n" "http://127.0.0.1:3300/$file"
(Invoke-WebRequest http://127.0.0.1:3300/prova-collaudo-1g-15/ -UseBasicParsing).Content | Select-String -Pattern '<a[^>]+/download/[^>]*>[^<]*</a>' -AllMatches | ForEach-Object { $_.Matches.Value }
```

Annota i minuti a parte.

**Registro (1D-37).** Obiettivo, con l'account `amministrazione`: le modifiche al documento (testo e file), la creazione e l'eliminazione del documento nuovo e le modifiche al carosello (sostituzione, aggiunta, rimozione, riordino) risultano nel registro delle operazioni con account e orario. Annota quelle che non trovi. Conta i minuti a parte.

## 6. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-15**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Quale documento e quale carosello hai usato, e dove si vede il carosello
- Ogni cosa che avresti voluto cambiare e non hai potuto

## 7. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 8. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-050 (1G-15): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-15):
Minuti prova accessoria (registro, 1D-37):
Minuti prova accessoria (documento nuovo, blocco ed eliminazione):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Documento usato:
Carosello usato e dove:
Dimensione prima / dopo del file scaricato:
Operazioni sul carosello riuscite (sostituire, titolo e testo, aggiungere, togliere, riordinare):
Cose che avrei voluto cambiare e non ho potuto:
Documento nuovo: indirizzo della pagina pubblica e categoria dei download:
Documento nuovo nella sua pagina e nell'elenco della categoria (sì / no):
Collegamento nella pagina con l'etichetta, poi con il titolo, verso la pagina del documento (sì / no):
Collegamento anche dentro «Media e testo» (sì / no):
Eliminazione rifiutata mentre la pagina lo mostra, messaggio (testo esatto):
Eliminazione rifiutata per la voce di menu, messaggio (testo esatto):
Voce di menu di prova tolta, menu come prima (sì / no):
Dopo l'eliminazione, pagina del documento e file 404 (sì / no):
Operazioni senza riga di registro (elenco):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
