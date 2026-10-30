# HO-045 — La pagina pubblica corrisponde all'anteprima (compito 1G-10)

Fase 1G, wave `1G-W8`, compito 1G-10. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Per ogni modifica che pubblichi, la pagina sul sito deve essere uguale a quella che l'anteprima ti aveva mostrato.
Nei compiti 1G-1…1G-8 hai già annotato il confronto per ogni pubblicazione; qui lo fai in modo esplicito su cinque
modifiche di tipo diverso, e verifichi che il lavoro in corso non cambi il sito finché non lo pubblichi.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Pagina `Pagina di prova collaudo 1G-10` (indirizzo `prova-collaudo-1g-10`), da creare, con quattro paragrafi e due immagini fra quelle già caricate. Poi cinque modifiche, ciascuna seguita da una pubblicazione:

1. un paragrafo riscritto;
2. un'immagine sostituita con un'altra fra quelle già caricate;
3. il layout della pagina cambiato, in modo che l'aspetto sul sito sia diverso da prima;
4. l'ordine di due blocchi scambiato;
5. un blocco aggiunto e uno eliminato.

Per ciascuna ottieni il confronto fra l'anteprima della modifica e la pagina pubblicata. Per un confronto rigoroso salva l'HTML dell'anteprima (Ctrl+S, solo HTML) e quello pubblico, e confrontali:

```powershell
Invoke-WebRequest http://127.0.0.1:3300/prova-collaudo-1g-10/ -UseBasicParsing -OutFile "$HOME\collaudo\1g-10-pubblico.html"
Compare-Object (Get-Content "$HOME\collaudo\1g-10-anteprima.html") (Get-Content "$HOME\collaudo\1g-10-pubblico.html")
```

Differenze di soli identificativi generati a ogni richiesta si annotano come tali; contano le differenze di contenuto, di struttura e di aspetto.

## 4. Come riconoscere la riuscita sul sito

1. Per ciascuna delle cinque modifiche: stessa pagina in anteprima e sul sito, a larghezza piena e da telefono. Annota per ognuna uguale / diversa e dove.
2. **Il lavoro in corso non tocca il sito, finché non si sceglie di aggiornarlo:** la copia di lavoro automatica e l'anteprima non cambiano `http://127.0.0.1:3300/prova-collaudo-1g-10/`. Su un contenuto pubblicato il pulsante «Salva e aggiorna il sito» (e, nella scheda «Pagina», «Salva il layout e aggiorna il sito») scrive subito sul sito, come dice l'avviso accanto: dopo averlo premuto, la pagina pubblica mostra la modifica. Su un contenuto non pubblicato il pulsante «Salva» non la rende visibile finché non si pubblica.
3. L'anteprima non è raggiungibile da chi non è entrato: dalla finestra privata, il suo indirizzo risponde 404 e non mostra la bozza (1G-19).
4. **Andata e ritorno:** apri `Pagina di prova collaudo 1G-10` e premi «Salva e aggiorna il sito» senza aver modificato nulla: la pagina pubblica non cambia (confronto dell'HTML prima e dopo, come nel compito 1G-3).
5. Riporta in una riga le pubblicazioni dei compiti precedenti in cui anteprima e sito differivano.

## 5. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-36 | aprire e salvare senza modifiche non cambia nulla |
| 1G-19 (come verifica a vista) | l'anteprima non si vede da anonimo |

## 6. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-10**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Per ciascuna delle cinque modifiche: uguale / diversa e dove
- Quante pubblicazioni dei compiti precedenti erano difformi dall'anteprima

## 7. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 8. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-045 (1G-10): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-10):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Modifica 1 (paragrafo), uguale / diversa:
Modifica 2 (immagine), uguale / diversa:
Modifica 3 (layout), uguale / diversa:
Modifica 4 (ordine blocchi), uguale / diversa:
Modifica 5 (aggiungi e togli), uguale / diversa:
Lavoro in corso non cambia il sito (sì / no):
Andata e ritorno senza differenze (sì / no):
Pubblicazioni dei compiti precedenti difformi (numero ed elenco):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
