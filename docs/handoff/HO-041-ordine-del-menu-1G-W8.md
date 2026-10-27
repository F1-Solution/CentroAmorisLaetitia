# HO-041 — Cambiare l'ordine di due voci del menu (compito 1G-6)

Fase 1G, wave `1G-W8`, compito 1G-6. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Scambiare di posto due voci del menu principale e vedere l'ordine nuovo su tutto il sito, anche nel menu da telefono.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.
- Il compito 1G-1 è fatto: esiste la voce `Prova collaudo 1G-1`.

## 3. Dati di partenza sintetici

- Le due voci da scambiare: `Prova collaudo 1G-1` e la voce che la precede o la segue al suo stesso livello. Annota quale e l'ordine di partenza di tutte le voci del livello.

## 4. Come riconoscere la riuscita sul sito

1. Nel menu principale, su una pagina qualunque a larghezza piena, le due voci sono nell'ordine scambiato. Lo stesso a larghezza da telefono.
2. Le altre voci non si sono mosse.
3. Per ogni pubblicazione di questo compito, la pagina pubblicata è uguale all'anteprima che ne avevi visto (1G-10): annota se no.

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-6: conta i loro minuti a parte e non sommarli a quelli del compito.

Obiettivo (1D-32, prova del menu di HO-006), senza guida: ottenere che la voce `Prova collaudo 1G-1` compaia sul sito come sottovoce della precedente e poi di nuovo al livello alto; poi che sia visibile solo a chi è entrato con certi ruoli (un visitatore non entrato non la vede) e poi di nuovo a tutti. Annota i minuti a parte e, a fine prova, rimetti l'ordine come all'inizio.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-32 | aggiungere, spostare, annidare, cambiare visibilità (qui spostare; annidare e visibilità fra le prove accessorie; l'aggiunta è nel compito 1G-1) |
| HO-006, prova del menu | spostare su e giù, annidare, riportare al livello superiore, cambiare visibilità |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-6**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Ordine delle voci prima e dopo
- Esito delle prove accessorie (annidamento, visibilità)

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-041 (1G-6): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-6):
Minuti prove accessorie (annidamento e visibilità):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Ordine prima:
Ordine dopo:
Prove accessorie riuscite (annidamento, visibilità):
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
