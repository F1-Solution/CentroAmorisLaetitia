# HO-047 — Estratto, immagine in evidenza e categorie di una notizia (compito 1G-12)

Fase 1G, wave `1G-W8`, compito 1G-12. Scritto il 2026-10-26, aggiornato il 2026-10-27 (DR-278, DR-280, DR-286).

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Creare, pubblicare e ritirare una notizia con estratto, immagine in evidenza e categoria nuova; vedere sul sito che
la notizia compare negli elenchi e negli archivi con estratto e immagine; rinominare la categoria; togliere la
categoria dalla notizia. Verificare che una notizia senza categoria non si possa pubblicare.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

- Notizia: titolo `Notizia di prova collaudo 1G-12`, indirizzo `notizia-di-prova-collaudo-1g-12`, tre paragrafi di testo inventato.
- Estratto: `Estratto di prova collaudo 1G-12 con una parola rara: quarzomelograno.`
- Immagine in evidenza: generata da te, con il comando sotto.
- Categoria nuova: `Categoria di prova collaudo 1G-12`; rinominata poi `Categoria di prova collaudo 1G-12 rinominata`.

```powershell
New-Item -ItemType Directory -Force "$HOME\collaudo" | Out-Null
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap 1600, 900
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::Teal)
$f = New-Object System.Drawing.Font('Arial', 80)
$g.DrawString('Prova collaudo 1G-12', $f, [System.Drawing.Brushes]::White, 60, 380)
$b.Save("$HOME\collaudo\prova-1g-12.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $b.Dispose()
```

## 4. Come riconoscere la riuscita sul sito

1. Una notizia senza categoria **non si pubblica**: il rifiuto spiega il perché in italiano.
2. Pubblicata con la categoria nuova, la notizia è raggiungibile al suo indirizzo ed è la prima, o fra le prime, nell'elenco delle notizie del sito, con l'immagine in evidenza e l'estratto.
3. L'archivio della categoria nuova mostra la notizia con estratto e immagine.
4. La ricerca del sito per `quarzomelograno` trova la notizia e ne mostra l'estratto.
5. Dopo aver rinominato la categoria, il suo nome nell'archivio è quello nuovo e **l'indirizzo dell'archivio non è cambiato**.
6. Tolta la categoria dalla notizia (assegnandone un'altra, perché una ne serve), la notizia sparisce dall'archivio della categoria nuova.
7. Ritirata, la notizia risponde 404 e non compare più negli elenchi.
8. Anteprima e pagina pubblica coincidono (1G-10).

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-12: conta i loro minuti a parte e non sommarli a quelli del compito.

**Dati di partenza delle prove accessorie.** Due categorie nuove, `Categoria madre di prova collaudo 1G-12` (indirizzo `madre-prova-1g-12`) e `Categoria figlia di prova collaudo 1G-12` (indirizzo `figlia-prova-1g-12`), e una notizia pubblicata nella figlia, `Notizia di prova collaudo 1G-12 bis` (indirizzo `notizia-di-prova-collaudo-1g-12-bis`), con un paragrafo inventato.

**Titolo e primo piano della notizia (DR-278, DR-286).** Obiettivi:

- la notizia `bis` non mostra più il titolo: resta la data e un solo titolo `h1`, invisibile e letto dai lettori di schermo (`class="screen-reader-text"`); poi lo mostra di nuovo;
- la notizia `bis` è messa in primo piano. Come nel sito di partenza, nessun elenco del sito la sposta in testa: annota se l'area te lo dice prima che tu lo scopra sul sito. Poi toglila dal primo piano.

```powershell
(Invoke-WebRequest http://127.0.0.1:3300/notizia-di-prova-collaudo-1g-12-bis/ -UseBasicParsing).Content | Select-String -Pattern '<h1[^>]*>' -AllMatches | ForEach-Object { $_.Matches.Value }
```

**Categorie complete (DR-280).** Obiettivi, nell'ordine:

1. La figlia ha la descrizione `Descrizione di prova collaudo 1G-12`: il suo archivio la porta come descrizione per i motori (`meta name="description"`), non nel testo visibile, come nel sito di partenza.
2. L'archivio della figlia ha il titolo per i motori `Archivio SEO prova collaudo 1G-12`, la descrizione per i motori `Descrizione SEO di prova collaudo 1G-12`, che prende il posto della descrizione del punto 1, e le direttive di non indicizzare e di non seguire i collegamenti (`noindex` e `nofollow`). Tolte le due direttive e la descrizione per i motori, `noindex` e `nofollow` spariscono e torna la descrizione del punto 1.
3. La figlia diventa figlia della madre: il suo archivio risponde a `/category/madre-prova-1g-12/figlia-prova-1g-12/` e il vecchio indirizzo `/category/figlia-prova-1g-12/` porta al nuovo con un solo redirect permanente (301).
4. Fare della madre una figlia della figlia è rifiutato, con un messaggio in italiano.
5. Eliminare la madre, che ha una figlia, e la figlia, che ha una notizia, è rifiutato con un messaggio che dice il perché. Spostata la notizia `bis` in `Categoria di prova collaudo 1G-12 rinominata`, la figlia si elimina dopo una conferma e il suo archivio risponde 404; annota che cosa risponde il vecchio indirizzo `/category/figlia-prova-1g-12/`. Poi, con nel menu principale una voce `Prova collaudo 1G-12 categoria` che porta all'archivio della madre, l'eliminazione della madre è rifiutata con un messaggio che dice che è nel menu. Tolta la voce, il menu del sito torna com'era e la madre si elimina.
6. Alla fine ritira la notizia `bis`.

```powershell
foreach ($p in '/category/figlia-prova-1g-12/','/category/madre-prova-1g-12/figlia-prova-1g-12/','/category/madre-prova-1g-12/') { curl.exe -s -o NUL -w "$p %{http_code} %{redirect_url}\n" "http://127.0.0.1:3300$p" }
$archivio = '/category/figlia-prova-1g-12/'  # dopo lo spostamento: /category/madre-prova-1g-12/figlia-prova-1g-12/
$h = (Invoke-WebRequest "http://127.0.0.1:3300$archivio" -UseBasicParsing).Content
$h | Select-String -Pattern '<title>.*?</title>' -AllMatches | ForEach-Object { $_.Matches.Value }
$h | Select-String -Pattern '<meta[^>]+(description|robots)[^>]*>' -AllMatches | ForEach-Object { $_.Matches.Value }
```

Annota i minuti di queste due prove a parte.

**Registro (1D-37).** Obiettivo, con l'account `amministrazione`: creazione, pubblicazione, modifica e ritiro della notizia, e la creazione, la rinomina, la modifica, lo spostamento e l'eliminazione delle categorie, risultano nel registro delle operazioni con account e orario. Annota quelle che non trovi. Conta i minuti a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-28 | creare, modificare, pubblicare e ritirare un articolo |
| 1D-37 | le operazioni sulla notizia e sulle categorie lasciano una riga di registro (prova accessoria) |
| DR-278, DR-286 | nascondere il titolo di una notizia; metterla in primo piano (prova accessoria) |
| DR-280 | descrizione, categoria genitrice, SEO dell'archivio ed eliminazione di una categoria (prova accessoria) |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-12**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Testo del rifiuto di pubblicare senza categoria
- Se l'immagine in evidenza compare negli elenchi e negli archivi (sì / no, dove no)

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-047 (1G-12): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-12):
Minuti prova accessoria (registro, 1D-37):
Minuti prove accessorie (titolo e primo piano, categorie complete):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Rifiuto senza categoria (testo esatto):
Elenco, archivio e ricerca mostrano estratto (sì / no, dove no):
Indirizzo dell'archivio invariato dopo la rinomina (sì / no):
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Titolo della notizia nascosto, data e un solo h1 per i lettori di schermo (sì / no):
Primo piano: l'area dice che non cambia gli elenchi (sì / no) e il sito non cambia (sì / no):
Descrizione della categoria come descrizione per i motori (sì / no):
Titolo SEO, descrizione SEO, noindex e nofollow dell'archivio visti e poi tolti (sì / no):
Spostamento: nuovo indirizzo e un solo 301 dal vecchio (sì / no):
Ciclo rifiutato, messaggio (testo esatto):
Eliminazioni rifiutate (figlia, notizia, voce di menu), messaggi (testo esatto):
Voce di menu di prova tolta, menu come prima (sì / no):
Figlia eliminata, archivio 404 (sì / no), vecchio indirizzo risponde:
Operazioni senza riga di registro (elenco):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
