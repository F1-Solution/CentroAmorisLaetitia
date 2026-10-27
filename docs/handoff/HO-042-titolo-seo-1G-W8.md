# HO-042 — Cambiare il titolo SEO di una pagina e vederne l'effetto (compito 1G-7)

Fase 1G, wave `1G-W8`, compito 1G-7. Scritto il 2026-10-26, aggiornato il 2026-10-27 (DR-278).

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Cambiare titolo e descrizione per i motori di ricerca di una pagina, le sue direttive per i motori e i dati di
condivisione, e riconoscere l'effetto sulla pagina pubblica. Cambiare poi il modello globale del titolo per le
pagine e vedere l'effetto su una pagina senza titolo proprio.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.
- Il compito 1G-1 è fatto: esiste `Pagina di prova collaudo 1G-1`.

## 3. Dati di partenza sintetici

| Dato | Valore |
|---|---|
| Pagina | `http://127.0.0.1:3300/prova-collaudo-1g-1/` |
| Titolo SEO | `Titolo SEO prova collaudo 1G-7` |
| Descrizione SEO | `Descrizione SEO prova collaudo 1G-7` |
| Titolo e descrizione di condivisione | `Condivisione prova collaudo 1G-7` e `Descrizione di condivisione prova collaudo 1G-7` |
| Direttiva | la pagina non deve essere indicizzata, e poi tornare indicizzabile |
| Modello globale | aggiungi `| prova collaudo 1G-7` in coda al modello del titolo delle pagine; ripristina alla fine |

## 4. Come riconoscere la riuscita sul sito

Ricarica la pagina pubblica (Ctrl+F5) e controlla:

1. La linguetta del browser mostra `Titolo SEO prova collaudo 1G-7`.
2. Nel sorgente: `<title>` col nuovo titolo, `meta name="description"` con la nuova descrizione, i tag di condivisione (`og:title`, `og:description`) coi valori di condivisione, la direttiva per i motori `noindex` quando l'hai chiesta e assente quando l'hai tolta.

```powershell
$h = (Invoke-WebRequest http://127.0.0.1:3300/prova-collaudo-1g-1/ -UseBasicParsing).Content
$h | Select-String -Pattern '<title>.*?</title>' -AllMatches | ForEach-Object { $_.Matches.Value }
$h | Select-String -Pattern '<meta[^>]+(description|robots|og:title|og:description)[^>]*>' -AllMatches | ForEach-Object { $_.Matches.Value }
```

3. Il modello globale: una pagina **senza** titolo SEO proprio mostra il suo titolo con in coda `| prova collaudo 1G-7`; la pagina con titolo proprio no, o come il modello prevede. Ripristinato il modello, la coda sparisce.
4. Se dopo un minuto un valore non è cambiato, annotalo come difetto con il valore atteso e quello visto.
5. Per ogni pubblicazione di questo compito, la pagina pubblicata è uguale all'anteprima che ne avevi visto (1G-10): annota se no.

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-7: conta i loro minuti a parte e non sommarli a quelli del compito.

**Tipo di dati strutturati (DR-278).** Obiettivo: ottenere che i dati per i motori di ricerca di `Pagina di prova collaudo 1G-1` descrivano la pagina come articolo di blog (`BlogPosting`) e non più solo come pagina web, poi riportarla com'era. Poi ottenere lo stesso effetto per **tutte** le pagine senza scelta propria, cambiando il modello globale delle pagine, e verificarlo su una pagina qualunque del sito; ripristina il modello alla fine. Il tipo si sceglie fra valori dati, non si scrive.

```powershell
$h = (Invoke-WebRequest http://127.0.0.1:3300/prova-collaudo-1g-1/ -UseBasicParsing).Content
$h | Select-String -Pattern '"@type":"(WebPage|BlogPosting)"' -AllMatches | ForEach-Object { $_.Matches.Value }
```

Con la scelta attiva compare anche `"@type":"BlogPosting"`; ripristinato, resta solo `"@type":"WebPage"`. Annota i minuti a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-33 | metadati SEO di un contenuto e modelli globali |
| HO-006, prove SEO | scrivere titolo e descrizione e chiedere di non indicizzare; cambiare il modello del titolo delle pagine |
| DR-278 | scegliere il tipo di dati strutturati di una pagina e del modello delle pagine (prova accessoria) |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-7**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Valori attesi e valori visti nel sorgente, uno per uno
- Se il modello globale ha avuto effetto e dove

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-042 (1G-7): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-7):
Minuti prova accessoria (tipo di dati strutturati):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Titolo SEO atteso / visto:
Descrizione attesa / vista:
noindex presente quando chiesto (sì / no):
Modello globale con effetto (sì / no):
Tipo di dati strutturati della pagina visto nel sorgente (sì / no):
Tipo di dati strutturati del modello visto su un'altra pagina (sì / no, quale):
Pagina e modello ripristinati (sì / no):
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
