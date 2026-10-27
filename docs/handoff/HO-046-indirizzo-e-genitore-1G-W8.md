# HO-046 — Cambiare l'indirizzo e la pagina genitore di una pagina (compito 1G-11)

Fase 1G, wave `1G-W8`, compito 1G-11. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Cambiare l'indirizzo di una pagina e la sua pagina genitore, e ottenere che i vecchi indirizzi portino ai nuovi con un
solo passaggio permanente, che gli indirizzi delle pagine figlie si aggiornino e che il sito non crei mai catene né
cicli di spostamenti. I reindirizzamenti già presenti nel sito non devono cambiare.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`; `amministrazione` solo per la prova accessoria. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Crea e pubblica tre pagine:

- `Pagina di prova collaudo 1G-11 madre`, indirizzo `prova-collaudo-1g-11-madre`;
- `Pagina di prova collaudo 1G-11 figlia`, figlia della madre;
- `Pagina di prova collaudo 1G-11 altra`, indirizzo `prova-collaudo-1g-11-altra`, senza genitore.

Poi:

1. cambia l'indirizzo della madre in `prova-collaudo-1g-11-madre-nuova`;
2. cambialo ancora in `prova-collaudo-1g-11-madre-terza`;
3. riportalo a `prova-collaudo-1g-11-madre`;
4. sposta la figlia sotto `altra`;
5. prova a fare della madre una figlia della sua stessa figlia.

**Prima di cominciare** controlla tre redirect già esistenti e annota la risposta:

```powershell
foreach ($p in '/modulo-per-consulenze/','/modulo-consulenze-per-minori/','/modulo-consulenze-a-distanza-per-minori/') { curl.exe -s -o NUL -w "$p %{http_code} %{redirect_url}\n" "http://127.0.0.1:3300$p" }
```

## 4. Come riconoscere la riuscita sul sito

Per controllare un indirizzo dopo ciascun passo usa questo comando, cambiando la prima riga:

```powershell
$percorso = '/prova-collaudo-1g-11-madre/'  # sostituiscilo con l'indirizzo da controllare
curl.exe -s -o NUL -w "%{http_code} %{num_redirects} %{url_effective}\n" -L "http://127.0.0.1:3300$percorso"
```

1. Dopo il passo 1: il vecchio indirizzo della madre e quello della figlia rispondono con un solo spostamento 301 ai nuovi, e i nuovi rispondono 200. L'indirizzo pubblico della figlia contiene ora quello nuovo della madre.
2. Dopo il passo 2: i due indirizzi di partenza (il primo originale, il secondo intermedio) raggiungono direttamente l'ultimo con **uno** spostamento (`num_redirects` = 1), mai due.
3. Dopo il passo 3 (ritorno all'indirizzo di partenza): nessun ciclo, ogni vecchio indirizzo termina con 200, mai in un giro infinito.
4. Dopo il passo 4: la figlia risponde sotto `altra`, il vecchio indirizzo sotto la madre porta lì con un solo spostamento.
5. Passo 5 rifiutato, con un messaggio in italiano che spiega il motivo.
6. Le tre risposte dei redirect preesistenti sono identiche a quelle annotate prima.
7. Per ogni pubblicazione di questo compito, la pagina pubblicata è uguale all'anteprima che ne avevi visto (1G-10): annota se no.

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-11: conta i loro minuti a parte e non sommarli a quelli del compito.

Obiettivo (1D-37), con l'account `amministrazione`: ogni cambio di indirizzo o di genitore dei passi 1-4, e ciascuno dei redirect che ne sono nati, risulta nel registro delle operazioni con account e orario. Annota quelli che non trovi. Conta i minuti a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-37 | ogni operazione, compresi i redirect nati dal cambio, lascia una riga di registro (prova accessoria) |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-11**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Risposta e numero di spostamenti per ogni vecchio indirizzo dopo ciascun passo
- Testo del rifiuto del passo 5

## 8. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-046 (1G-11): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-11):
Minuti prova accessoria (registro, 1D-37):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Passo 1 (spostamenti e esito):
Passo 2 (spostamenti e esito):
Passo 3 (spostamenti e esito):
Passo 4 (spostamenti e esito):
Passo 5 rifiutato, testo esatto:
Redirect preesistenti invariati (sì / no):
Operazioni senza riga di registro (elenco):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
