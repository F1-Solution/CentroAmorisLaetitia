# HO-044 — Trovare chi ha modificato un contenuto e quando (compito 1G-9)

Fase 1G, wave `1G-W8`, compito 1G-9. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Rispondere a due domande, senza aiuto: chi ha fatto l'ultima modifica a un contenuto e quando; e che cosa ha fatto
un certo account in una certa fascia di tempo. Poi controllare che ogni operazione dei compiti precedenti abbia
lasciato una traccia.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione` per la prima parte, `amministrazione` per la seconda. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.
- Hai fatto i compiti 1G-1…1G-8 e hai annotato, per ciascuno, l'ora approssimativa delle operazioni.

## 3. Dati di partenza sintetici

- Contenuto: `Pagina di prova collaudo 1G-1`. Cambia una parola di un paragrafo e annota l'ora al minuto, leggendola da un orologio.
- Parte 1 (account `redazione`): trovare chi e quando.
- Parte 2 (account `amministrazione`): trovare, per lo stesso contenuto, tutte le operazioni registrate; poi tutto ciò che ha fatto l'account `redazione` nella fascia dell'intero collaudo.

## 4. Come riconoscere la riuscita sul sito

1. Parte 1: la risposta contiene l'account `redazione` e un orario che differisce di non più di un minuto da quello che hai annotato. Il tempo conta: se ci metti oltre 10 minuti è un difetto di usabilità.
2. Parte 2: l'elenco per il contenuto mostra, in ordine di tempo, le operazioni che hai fatto nei compiti 1G-1, 1G-7 e in questo, ciascuna con account e orario.
3. **Ogni operazione lascia una riga (1D-37):** per ciascun compito precedente confronta le tue note con l'elenco: creazione, pubblicazione, ritiro, sostituzione dell'immagine, cambio di menu, SEO, redirect, accesso. Annota quelle che non hai trovato. Le operazioni dei compiti 1G-11, 1G-12, 1G-13, 1G-15 e 1G-16 (redirect automatici, notizia, eliminazioni, documento e carosello, account) si controllano nei loro handoff.
4. Nelle righe non compare nessuna password né testo che somigli a una password.

## 5. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-37 | ogni operazione produce una riga di registro |

## 6. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-9**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Risposta alla domanda «chi e quando», con l'orario che avevi annotato
- Elenco delle operazioni che non hai ritrovato

## 7. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 8. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-044 (1G-9): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-9):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Chi e quando (risposta trovata):
Orario annotato da me:
Operazioni senza riga (elenco):
Password visibili nelle righe (sì / no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
