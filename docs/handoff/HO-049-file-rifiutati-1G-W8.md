# HO-049 — File non ammessi o troppo grandi rifiutati in italiano (compito 1G-14)

Fase 1G, wave `1G-W8`, compito 1G-14. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Provare a caricare file che il sito non ammette e vedere che sono rifiutati con un messaggio in italiano che si
capisce senza essere tecnici, e che nulla di indesiderato resti caricato. Provare poi file ammessi, che devono entrare.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Crea i file di prova con questi comandi (poi cancellali dalla tua cartella a fine prova):

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Set-Content "$HOME\collaudo\prova-1g-14.svg" '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
Set-Content "$HOME\collaudo\prova-1g-14.html" '<p>prova collaudo 1G-14</p>'
Set-Content "$HOME\collaudo\prova-1g-14.exe" 'prova collaudo 1G-14'
Set-Content "$HOME\collaudo\prova-1g-14-finta.png" 'questo non e una immagine'
$f = [IO.File]::Create("$HOME\collaudo\prova-1g-14-grande.png"); $f.SetLength(22020096); $f.Close()
```

Il file ammesso è l'immagine di prova del compito 1G-5 (`prova-1g-5-a.png`); se non l'hai, generane una qualunque in PNG. Prova anche un PDF qualunque (per esempio la stampa in PDF di una pagina del sito) e un breve video MP4 che hai a disposizione, se ne hai uno.

I limiti dichiarati (DR-251) sono: immagini JPEG, PNG, WebP fino a 20 MB e 50 milioni di pixel; PDF fino a 20 MB; MP4 fino a 100 MB; SVG e HTML esclusi.

## 4. Come riconoscere la riuscita sul sito

1. Ognuno dei cinque file (`.svg`, `.html`, `.exe`, il finto PNG, il PNG da 21 MB) è rifiutato.
2. Ogni messaggio è in italiano e dice che cosa non va (tipo non ammesso, peso eccessivo, file non valido). Un messaggio in inglese è un difetto: trascrivilo.
3. Dopo ogni rifiuto i file che l'area elenca sono gli stessi di prima: conta e confronta.
4. L'immagine ammessa, il PDF e l'MP4 entrano e sono utilizzabili. Se l'MP4 viene rifiutato come «file non valido» annotalo senza concludere altro: dipende dai codec ammessi.
5. Un file ammesso che non può essere elaborato (PDF o video) deve dirlo con un messaggio comprensibile, senza lasciare il sistema in uno stato incerto.

## 5. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-31 | caricare un media; qui anche i casi di rifiuto |
| HO-006, prova dei media | caricare un file ammesso: entra |

## 6. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-14**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Testo esatto del messaggio per ciascun file, e se è comprensibile
- Conteggio dei file elencati prima e dopo

## 7. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 8. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-049 (1G-14): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-14):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Messaggio .svg:
Messaggio .html:
Messaggio .exe:
Messaggio finto .png:
Messaggio file da 21 MB:
File elencati prima / dopo:
File ammessi entrati (elenco):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
