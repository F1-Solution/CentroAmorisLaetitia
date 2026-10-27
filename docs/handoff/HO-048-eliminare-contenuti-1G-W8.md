# HO-048 — Eliminare un contenuto, con conferma e rifiuti spiegati (compito 1G-13)

Fase 1G, wave `1G-W8`, compito 1G-13. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Eliminare per sempre una pagina di prova dopo una conferma, e controllare che l'eliminazione sia rifiutata, con una
spiegazione comprensibile, quando il contenuto ha pagine figlie, quando è raggiungibile dal menu e quando è la pagina
iniziale del sito. Non eliminare mai la pagina iniziale: il rifiuto è la prova.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`; `amministrazione` solo per la prova accessoria. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Crea e pubblica:

- `Pagina di prova collaudo 1G-13` (indirizzo `prova-collaudo-1g-13`): quella che elimini davvero;
- `Pagina di prova collaudo 1G-13 madre` con una figlia `Pagina di prova collaudo 1G-13 figlia`;
- `Pagina di prova collaudo 1G-13 in menu`, raggiungibile da una voce del menu principale.

Poi tenta di eliminare, in quest'ordine: la madre, la pagina in menu, la pagina iniziale del sito (annota a quale pagina corrisponde), la pagina da eliminare. Al termine elimina tutte le pagine di prova, in un ordine che il sistema accetta.

## 4. Come riconoscere la riuscita sul sito

1. Prima che l'eliminazione avvenga ti viene chiesta una conferma esplicita; se annulli, nulla cambia.
2. La madre con una figlia: eliminazione rifiutata, con un messaggio in italiano che dice che ci sono pagine figlie.
3. La pagina raggiungibile dal menu: rifiutata, con un messaggio che dice che è nel menu.
4. La pagina iniziale del sito: rifiutata, con un messaggio che lo dice. Annota se, per riconoscere quale pagina sia la pagina iniziale, ti è servito aiuto.
5. La pagina isolata, confermata, scompare: `http://127.0.0.1:3300/prova-collaudo-1g-13/` risponde 404, e non risulta più fra i contenuti che l'area ti propone.
6. Eliminate le altre nell'ordine che il sistema accetta, nessuna resta. Dopo l'eliminazione della pagina raggiungibile dal menu, la sua voce non c'è più nel menu del sito, su una pagina qualunque.
7. La pagina iniziale del sito è ancora al suo posto e risponde 200.

```powershell
curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:3300/
curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:3300/prova-collaudo-1g-13/
```

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-13: conta i loro minuti a parte e non sommarli a quelli del compito.

Obiettivo (1D-37), con l'account `amministrazione`: ogni eliminazione che è andata a buon fine risulta nel registro delle operazioni con account e orario, anche se il contenuto non c'è più. Annota quelle che non trovi. Conta i minuti a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1G-13 | eliminazione con conferma; rifiuto spiegato se il contenuto ha figlie |
| 1D-37 | ogni eliminazione lascia una riga di registro (prova accessoria) |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-13**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Testo esatto di ogni rifiuto e di ogni conferma

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-048 (1G-13): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-13):
Minuti prova accessoria (registro, 1D-37):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Rifiuto con figlie (testo esatto):
Rifiuto per pagina nel menu (testo esatto):
Rifiuto per pagina iniziale (testo esatto):
Pagina iniziale ancora raggiungibile (sì / no):
Pagina isolata eliminata (sì / no):
Eliminazioni senza riga di registro (elenco):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
