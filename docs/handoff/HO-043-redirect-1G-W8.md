# HO-043 — Creare un redirect da un vecchio indirizzo (compito 1G-8)

Fase 1G, wave `1G-W8`, compito 1G-8. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Fare in modo che un vecchio indirizzo inventato porti il visitatore a una pagina esistente, con risposta di
spostamento permanente. Poi modificare quel reindirizzamento e spegnerlo senza cancellarlo.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.
- Il compito 1G-1 è fatto: esiste `Pagina di prova collaudo 1G-1`.

## 3. Dati di partenza sintetici

| Dato | Valore |
|---|---|
| Vecchio indirizzo | `/prova-collaudo-1g-8/` |
| Destinazione | `/prova-collaudo-1g-1/` |
| Nota | `redirect di prova collaudo 1G-8` |
| Modifica | la destinazione passa a un'altra pagina pubblicata a tua scelta (annota quale), poi torna a `/prova-collaudo-1g-1/` |

## 4. Come riconoscere la riuscita sul sito

1. Prima di crearlo, `http://127.0.0.1:3300/prova-collaudo-1g-8/` risponde 404.
2. Dopo averlo creato risponde 301 con destinazione `/prova-collaudo-1g-1/`:

```powershell
curl.exe -sI http://127.0.0.1:3300/prova-collaudo-1g-8/
curl.exe -s -o NUL -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:3300/prova-collaudo-1g-8/
```

3. Dopo la modifica della destinazione la risposta punta alla nuova pagina.
4. Spento, il vecchio indirizzo torna a rispondere 404; riacceso, torna a rispondere con il redirect verso la pagina.

## 5. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-34 | creare, modificare e disattivare un redirect |
| HO-006, prova dei redirect | creare un redirect; spegnerlo senza cancellarlo |

## 6. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-8**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Risposta ricevuta nei quattro stati (non creato, creato, modificato, spento)

## 7. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 8. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-043 (1G-8): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-8):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Risposte (codice e destinazione) nei quattro stati:
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
