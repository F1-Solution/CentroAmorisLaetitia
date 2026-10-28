# HO-039 — Modificare un contenuto che ha un blocco di riserva (compito 1G-4)

Fase 1G, wave `1G-W8`, compito 1G-4. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Cambiare il testo di un contenuto che contiene un blocco non convertito (un frammento che il sistema ha tenuto così
com'era), senza rovinare quel blocco, e capire dall'avviso che ti viene mostrato che cosa quel blocco è e che cosa
succede se lo si tocca. Il criterio vale se l'avviso è comprensibile a chi non conosce il sistema.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

| Dato | Valore |
|---|---|
| Contenuto | `http://127.0.0.1:3300/litighiamo-oggi/` (pagina Gutenberg con due blocchi di riserva, scelta dall'agente il 2026-10-28) (sono 8 i blocchi di riserva in tutto il sito; ultima risorsa, se resta vuoto: cerca un contenuto che ne abbia uno e annota quale; se non lo trovi in 10 minuti, annota anche questo) |
| Frase da cambiare | aggiungi `[prova collaudo 1G-4]` all'inizio di un paragrafo vicino al blocco |

Prima di cominciare salva una fotografia a pagina intera della pagina pubblica.

## 4. Come riconoscere la riuscita sul sito

1. La pagina pubblica mostra la tua frase con `[prova collaudo 1G-4]`.
2. Il frammento di riserva si vede **identico a prima**: confronto con la fotografia.
3. L'avviso: scrivilo parola per parola nel rapporto, e rispondi in poche righe con parole tue a due domande. Che cosa è quel blocco? Che cosa succede se lo cambi? Se non riesci a rispondere dall'avviso, il criterio non è soddisfatto: è proprio quello che si vuole sapere.
4. Dai all'avviso un voto da 1 (incomprensibile) a 5 (chiarissimo).
5. Anteprima e pagina pubblica coincidono (1G-10): annota se no.

## 5. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-29 | il testo accanto al blocco si modifica senza danni |

## 6. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-4**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Testo esatto dell'avviso
- Le tue due risposte con parole tue
- Voto di comprensibilità da 1 a 5

## 7. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 8. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-039 (1G-4): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-4):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Contenuto usato:
Avviso (testo esatto):
Che cosa è il blocco, con parole mie:
Che cosa succede se lo cambio, con parole mie:
Voto da 1 a 5:
Anteprima uguale alla pagina pubblicata (sì / no, dove no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
