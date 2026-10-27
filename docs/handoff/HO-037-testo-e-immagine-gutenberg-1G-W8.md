# HO-037 — Modificare testo e immagine di una pagina Gutenberg (compito 1G-2)

Fase 1G, wave `1G-W8`, compito 1G-2. Scritto il 2026-10-26, aggiornato il 2026-10-27 (DR-278).

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Su una pagina costruita con blocchi di WordPress (famiglia Gutenberg), cambiare una frase, sostituire un'immagine e
aggiornarne testo alternativo e didascalia, e vedere i cambiamenti sul sito senza che nient'altro si muova.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.
- Per le prove accessorie: il compito 1G-1 è fatto, esiste `Pagina di prova collaudo 1G-1`.

## 3. Dati di partenza sintetici

Contenuto esistente della copia: una pagina pubblicata con testo e almeno un'immagine.

| Dato | Valore |
|---|---|
| Pagina | indirizzo compilato dall'agente prima del collaudo: ____________ (ultima risorsa, se resta vuoto: scegline una qualunque con testo e immagine e annota quale; la famiglia sarà accertata dopo) |
| Frase da cambiare | una frase qualunque della pagina: la riscrivi aggiungendo all'inizio `[prova collaudo 1G-2]` |
| Immagine nuova | generata da te, `prova-1g-2.png`, con il comando sotto; testo alternativo `Immagine di prova collaudo 1G-2`, didascalia `Didascalia di prova collaudo 1G-2` |

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap 1600, 900
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::DarkGreen)
$f = New-Object System.Drawing.Font('Arial', 80)
$g.DrawString('Prova collaudo 1G-2', $f, [System.Drawing.Brushes]::White, 60, 380)
$b.Save("$HOME\collaudo\prova-1g-2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $b.Dispose()
```

Prima di cominciare salva una fotografia a pagina intera della pagina pubblica (strumenti per sviluppatori del browser,
cattura a tutta pagina): ti serve per il confronto.

## 4. Come riconoscere la riuscita sul sito

Dopo la pubblicazione, nella pagina pubblica:

1. La frase mostra `[prova collaudo 1G-2]` e il resto del testo è identico.
2. L'immagine è quella nuova, a larghezza piena e a larghezza da telefono.
3. Nel sorgente della pagina l'immagine ha `alt="Immagine di prova collaudo 1G-2"` e la didascalia è visibile.
4. Una nuova fotografia a pagina intera, confrontata con la prima, differisce solo per la frase e per l'immagine.
5. Anteprima e pagina pubblica coincidono (1G-10): annota se no.

Per leggere il testo alternativo senza aprire il sorgente a mano:

```powershell
$indirizzo = 'sostituisci-con-l-indirizzo-della-pagina'  # senza barre iniziali e finali
(Invoke-WebRequest "http://127.0.0.1:3300/$indirizzo/" -UseBasicParsing).Content | Select-String -Pattern 'alt="[^"]*"' -AllMatches | ForEach-Object { $_.Matches.Value }
```

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-2: conta i loro minuti a parte e non sommarli a quelli del compito. Si fanno su `Pagina di prova collaudo 1G-1` (compito 1G-1), non sulla pagina del compito.

**Titolo della pagina (DR-278).** Obiettivo: ottenere che `http://127.0.0.1:3300/prova-collaudo-1g-1/` non mostri più il titolo, poi che lo mostri di nuovo. Con il titolo nascosto la pagina ha un solo titolo `h1`, invisibile e letto dai lettori di schermo (`class="screen-reader-text"`); con il titolo visibile torna il titolo della pagina (`class="entry-title main_title"`). Il resto della pagina non cambia.

**Immagine in evidenza della pagina (DR-278).** Obiettivo: dare alla stessa pagina come immagine in evidenza `prova-1g-2.png`, già caricata nel compito, e riconoscerne l'effetto, poi toglierla. Come nel sito di partenza, l'immagine **non** compare nel corpo della pagina: compare nei dati per i motori di ricerca (`primaryImageOfPage`) e come miniatura accanto alla pagina nei risultati della ricerca del sito per `collaudo 1G-1`.

```powershell
$h = (Invoke-WebRequest http://127.0.0.1:3300/prova-collaudo-1g-1/ -UseBasicParsing).Content
$h | Select-String -Pattern '<h1[^>]*>' -AllMatches | ForEach-Object { $_.Matches.Value }
[regex]::Matches($h, 'primaryImageOfPage').Count
```

Alla fine la pagina mostra di nuovo il titolo e non ha più l'immagine in evidenza. Annota i minuti a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-29 | modificare testo e immagini dentro i blocchi |
| DR-278 | nascondere e mostrare il titolo di una pagina; darle un'immagine in evidenza e toglierla (prove accessorie) |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-2**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Indirizzo della pagina usata
- Se il testo alternativo e la didascalia si sono potuti scrivere senza aiuto

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-037 (1G-2): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-2):
Minuti prove accessorie (titolo e immagine in evidenza):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Pagina usata:
Titolo nascosto con un solo h1 per i lettori di schermo, poi di nuovo visibile (sì / no):
Immagine in evidenza vista nei dati per i motori e nella ricerca, assente dal corpo (sì / no, dove no):
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
