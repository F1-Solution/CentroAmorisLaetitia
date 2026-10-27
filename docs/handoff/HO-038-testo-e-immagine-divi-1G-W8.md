# HO-038 — Modificare testo e immagine di una pagina Divi convertita (compito 1G-3)

Fase 1G, wave `1G-W8`, compito 1G-3. Scritto il 2026-10-26, aggiornato il 2026-10-27 (DR-278, DR-279).

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Su una pagina nata con Divi e convertita in blocchi, cambiare una frase e sostituire un'immagine con testo alternativo,
e vedere i cambiamenti sul sito senza che nient'altro si muova.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

| Dato | Valore |
|---|---|
| Pagina | indirizzo compilato dall'agente prima del collaudo: ____________ (ultima risorsa, se resta vuoto: scegline una qualunque con più colonne e annota quale) |
| Frase da cambiare | aggiungi `[prova collaudo 1G-3]` all'inizio di un paragrafo |
| Immagine nuova | `prova-1g-3.png`, con il comando sotto; testo alternativo `Immagine di prova collaudo 1G-3` |

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap 1600, 900
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::Firebrick)
$f = New-Object System.Drawing.Font('Arial', 80)
$g.DrawString('Prova collaudo 1G-3', $f, [System.Drawing.Brushes]::White, 60, 380)
$b.Save("$HOME\collaudo\prova-1g-3.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $b.Dispose()
```

Prima di cominciare salva una fotografia a pagina intera della pagina pubblica.

## 4. Come riconoscere la riuscita sul sito

1. Dopo la pubblicazione la pagina pubblica mostra la frase con `[prova collaudo 1G-3]` e l'immagine nuova con il suo testo alternativo.
2. Il resto della pagina è identico alla fotografia di prima.
3. Per ogni pubblicazione di questo compito, la pagina pubblicata è uguale all'anteprima che ne avevi visto (1G-10): annota se no.

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-3: conta i loro minuti a parte e non sommarli a quelli del compito.

Sei prove accessorie: prima l'andata e ritorno, poi le altre nell'ordine che preferisci. Annota i minuti a parte.

**Andata e ritorno (1D-36).** Obiettivo: aprire la pagina e salvarla senza toccare nulla non cambia niente. Salva l'HTML pubblico prima e dopo il salvataggio a vuoto e confrontali:

```powershell
$indirizzo = 'sostituisci-con-l-indirizzo-della-pagina'  # senza barre iniziali e finali
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Invoke-WebRequest "http://127.0.0.1:3300/$indirizzo/" -UseBasicParsing -OutFile "$HOME\collaudo\1g-3-prima.html"
# dopo il salvataggio senza modifiche, ripeti con un altro nome:
Invoke-WebRequest "http://127.0.0.1:3300/$indirizzo/" -UseBasicParsing -OutFile "$HOME\collaudo\1g-3-dopo-vuoto.html"
(Get-FileHash "$HOME\collaudo\1g-3-prima.html").Hash -eq (Get-FileHash "$HOME\collaudo\1g-3-dopo-vuoto.html").Hash
```

Deve risultare `True`. Se risulta `False`, esegui `Compare-Object (Get-Content "$HOME\collaudo\1g-3-prima.html") (Get-Content "$HOME\collaudo\1g-3-dopo-vuoto.html")` e annota che cosa differisce (se solo valori generati a ogni richiesta, scrivilo come tale).

**Colonne.** Obiettivo: cambiare la ripartizione delle colonne di una riga, e vederla sul sito, a larghezza piena e da telefono, senza colonne sfasate né spazi nuovi.

**Blocchi (1D-30).** Obiettivo: ottenere che un paragrafo `Blocco di prova collaudo 1G-3` aggiunto dentro una colonna, poi spostato, poi eliminato, risulti sul sito esattamente come hai fatto.

**Spazio fra le colonne (DR-278).** Obiettivo: cambiare lo spazio fra le colonne della pagina del compito con un valore diverso da quello di partenza (annotalo), riconoscerlo sul sito e riportarlo com'era. Sul sito il valore è la classe `et_pb_gutters` seguita dal numero, sul contenitore della pagina, e cambia i margini fra le colonne del piè di pagina:

```powershell
$indirizzo = 'sostituisci-con-l-indirizzo-della-pagina'  # senza barre iniziali e finali
(Invoke-WebRequest "http://127.0.0.1:3300/$indirizzo/" -UseBasicParsing).Content | Select-String -Pattern 'et_pb_gutters\d' -AllMatches | ForEach-Object { $_.Matches.Value }
```

**Titolo di una pagina a sezioni (DR-278).** Obiettivo: accertare se per la pagina del compito puoi scegliere di mostrarne il titolo. Come nel sito di partenza, le pagine costruite a sezioni non mostrano mai il titolo: se la scelta non è disponibile, annota se l'area ti spiega il perché e con quali parole.

**Video e mappa (DR-279).** Pagine con un blocco video e con una mappa: indirizzi compilati dall'agente prima del collaudo, video ____________, mappa ____________ (ultima risorsa, se restano vuoti: cercale nel sito e annota quali). Obiettivi:

- il blocco video mostra sul sito un altro video, scelto fra quelli già caricati nel sito; un indirizzo che non è di YouTube (`https://www.youtube.com.esempio.invalid/watch?v=abcdefghijk`) e uno YouTube senza `https` (`http://www.youtube.com/watch?v=abcdefghijk`) sono rifiutati con un messaggio in italiano e il video sul sito non cambia;
- la mappa ha uno zoom diverso e un segnaposto con il titolo `Segnaposto di prova collaudo 1G-3`, che compare nel sorgente della pagina pubblica; il testo del fumetto dei segnaposto già presenti non si modifica;
- alla fine video e mappa tornano come erano: annota i valori di partenza prima di cambiarli.

```powershell
$mappa = 'sostituisci-con-l-indirizzo-della-pagina-con-la-mappa'  # senza barre iniziali e finali
(Invoke-WebRequest "http://127.0.0.1:3300/$mappa/" -UseBasicParsing).Content | Select-String -Pattern 'Segnaposto di prova collaudo 1G-3' -AllMatches | ForEach-Object { $_.Matches.Value }
```

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-29 | testo e immagini dentro i blocchi |
| 1D-30 | aggiungere, spostare ed eliminare un blocco dentro una colonna (prova accessoria) |
| 1D-36 | aprire e salvare senza modifiche non cambia nulla (prova accessoria) |
| DR-278 | spazio fra le colonne della pagina; titolo di una pagina a sezioni (prove accessorie) |
| DR-279 | configurare un blocco video e una mappa già presenti; indirizzi non ammessi rifiutati (prova accessoria) |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-3**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Indirizzo della pagina usata

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-038 (1G-3): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-3):
Minuti andata e ritorno (1D-36):
Minuti colonne e blocchi (1D-30):
Minuti spazio fra le colonne, titolo, video e mappa (DR-278, DR-279):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Pagina usata:
Andata e ritorno (True / False e che cosa differiva):
Colonne cambiate e viste sul sito (sì / no):
Spazio fra le colonne, valore di partenza / di prova / visto nel sorgente:
Titolo della pagina a sezioni, scelta disponibile (sì / no) e spiegazione (testo esatto):
Pagine con video e mappa usate:
Video cambiato e visto sul sito (sì / no):
Indirizzi non ammessi rifiutati, messaggi (testo esatto):
Mappa, zoom e segnaposto visti sul sito (sì / no):
Video e mappa riportati come erano (sì / no):
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
