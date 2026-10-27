# HO-036 — Creare una pagina, pubblicarla, metterla nel menu (compito 1G-1)

Fase 1G, wave `1G-W8`, compito 1G-1. Scritto il 2026-10-26, aggiornato il 2026-10-27 (DR-283).

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Ottenere una pagina nuova, scritta da te, pubblicata e raggiungibile dal menu principale del sito. Poi ritirare
una seconda pagina dopo averla pubblicata. Riesce senza assistenza.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Tutto quello che crei porta un nome riconoscibile come prova.

- Pagina principale: titolo `Pagina di prova collaudo 1G-1`, indirizzo `prova-collaudo-1g-1`.
- Contenuto: almeno tre paragrafi di testo inventato, un separatore, un'immagine fra quelle già caricate che l'area ti propone (una qualunque, annota quale) con testo alternativo `Immagine di prova collaudo 1G-1`, e due altri blocchi a tua scelta.
- Seconda pagina, solo per il ritiro: titolo `Pagina di prova collaudo 1G-1 bis`, indirizzo `prova-collaudo-1g-1-bis`.
- Voce di menu: etichetta `Prova collaudo 1G-1`, collocata al livello più alto, con destinazione la pagina principale. La userà il compito 1G-6.

## 4. Come riconoscere la riuscita sul sito

Controlli dal browser e dalla finestra privata:

1. `http://127.0.0.1:3300/prova-collaudo-1g-1/` risponde con la tua pagina: titolo, i tre paragrafi nell'ordine scritto, il separatore, l'immagine visibile, e nel sorgente l'immagine ha `alt="Immagine di prova collaudo 1G-1"` (DR-283).
2. Prima della pubblicazione lo stesso indirizzo, dalla finestra privata, non mostra la pagina (404).
3. Nel menu principale, su una pagina qualunque del sito, compare la voce `Prova collaudo 1G-1` e porta alla tua pagina.
4. Dopo il ritiro della seconda pagina, `http://127.0.0.1:3300/prova-collaudo-1g-1-bis/` non la mostra più (404) e la voce, se l'avevi messa, non compare nel menu.
5. Per ogni pubblicazione di questo compito, la pagina pubblicata è uguale all'anteprima che ne avevi visto (1G-10): annota se no.

Controllo comodo dei punti 1, 2 e 4:

```powershell
curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:3300/prova-collaudo-1g-1/
```

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-1: conta i loro minuti a parte e non sommarli a quelli del compito.

Obiettivo (1D-30): dentro una colonna della pagina principale, ottenere che un blocco aggiunto, uno spostato in un'altra posizione e uno eliminato si vedano sul sito esattamente così: presenza e ordine corrispondono a ciò che hai fatto. Annota i minuti a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare in questo compito |
|---|---|
| 1D-28 | creare, modificare, pubblicare e ritirare una pagina (la parte sulle notizie è nel compito 1G-12) |
| 1D-30 | aggiungere, spostare ed eliminare blocchi dentro una colonna (prove accessorie) |
| 1D-32 | aggiungere una voce al menu |
| DR-283 | mettere nella pagina un'immagine nuova, scelta fra quelle caricate, con il testo alternativo |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-1**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Immagine usata, e se hai potuto metterla nella pagina senza aiuto (DR-283)
- Se hai trovato senza aiuto il modo di collocare la pagina nel menu (sì / no)

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-036 (1G-1): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-1):
Minuti prove accessorie (blocchi nelle colonne):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Immagine usata:
Immagine messa nella pagina senza aiuto (sì / no):
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
