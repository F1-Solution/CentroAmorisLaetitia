# HO-040 — Sostituire un'immagine e aggiornare il testo alternativo (compito 1G-5)

Fase 1G, wave `1G-W8`, compito 1G-5. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Sostituire il file di un'immagine già in uso mantenendo lo stesso indirizzo, aggiornarne titolo, testo alternativo e
didascalia, e verificare che il sito mostri la nuova immagine **in ogni dimensione** in cui la serve.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Crea tre immagini distinte (blu A, arancione B, grigio C) con questi comandi:

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap 1600, 900
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::RoyalBlue)
$f = New-Object System.Drawing.Font('Arial', 80)
$g.DrawString('A prova collaudo 1G-5', $f, [System.Drawing.Brushes]::White, 60, 380)
$b.Save("$HOME\collaudo\prova-1g-5-a.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $b.Dispose()
```

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap 1600, 900
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::DarkOrange)
$f = New-Object System.Drawing.Font('Arial', 80)
$g.DrawString('B prova collaudo 1G-5', $f, [System.Drawing.Brushes]::White, 60, 380)
$b.Save("$HOME\collaudo\prova-1g-5-b.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $b.Dispose()
```

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap 1600, 900
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::DimGray)
$f = New-Object System.Drawing.Font('Arial', 80)
$g.DrawString('C prova collaudo 1G-5', $f, [System.Drawing.Brushes]::White, 60, 380)
$b.Save("$HOME\collaudo\prova-1g-5-c.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $b.Dispose()
```

- Carica `prova-1g-5-a.png`, con testo alternativo `Prova collaudo 1G-5 A`.
- Crea la pagina `Pagina di prova collaudo 1G-5` (indirizzo `prova-collaudo-1g-5`), pubblicata, che usa l'immagine A.
- La sostituzione: l'immagine A diventa B, con testo alternativo `Prova collaudo 1G-5 B`, titolo `Titolo prova collaudo 1G-5`, didascalia `Didascalia prova collaudo 1G-5`.

## 4. Come riconoscere la riuscita sul sito

1. Dopo la sostituzione, `http://127.0.0.1:3300/prova-collaudo-1g-5/` mostra B e non A, anche dopo aver ricaricato forzando la cache (Ctrl+F5).
2. **Ogni dimensione:** restringi la finestra del browser dalla larghezza piena a quella di un telefono, ricaricando a ogni passo: l'immagine è sempre B. Poi leggi tutti gli indirizzi dell'immagine nel sorgente (`src` e `srcset`) e aprili uno a uno: nessuno mostra A.

```powershell
(Invoke-WebRequest http://127.0.0.1:3300/prova-collaudo-1g-5/ -UseBasicParsing).Content | Select-String -Pattern '(src|srcset)="[^"]*"' -AllMatches | ForEach-Object { $_.Matches.Value }
```

3. L'indirizzo pubblico del file è lo stesso di prima della sostituzione: annotalo prima e dopo.
4. Il testo alternativo nel sorgente è `Prova collaudo 1G-5 B` e la didascalia si vede.
5. Per ogni pubblicazione di questo compito, la pagina pubblicata è uguale all'anteprima che ne avevi visto (1G-10): annota se no.

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-5: conta i loro minuti a parte e non sommarli a quelli del compito.

Obiettivo (1D-31, prova dei media di HO-006): verificare le eliminazioni. Carica anche l'immagine C, senza usarla in nessuna pagina. Ottieni che l'immagine B, usata dalla pagina, **non si possa eliminare** (il rifiuto spiega il perché in italiano) e che C, non usata, si possa eliminare e non compaia più fra le immagini che l'area ti propone. Annota i minuti a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-31 | caricare, sostituire ed eliminare un media, con testo alternativo e didascalia |
| HO-006, prova dei media | caricare un file; scrivere testo alternativo e didascalia; sostituire il file senza cambiare l'indirizzo; il file in uso non si elimina (rifiuto), quello libero sì |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-5**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Indirizzo pubblico dell'immagine prima e dopo la sostituzione
- Le larghezze del browser provate e per ciascuna se l'immagine era B

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-040 (1G-5): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-5):
Minuti prove accessorie (eliminazioni):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Indirizzo dell'immagine prima / dopo:
Larghezze provate, tutte B (sì / no, dove no):
Rifiuto di eliminare l'immagine in uso (testo esatto):
Eliminazione di C riuscita (sì / no):
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
