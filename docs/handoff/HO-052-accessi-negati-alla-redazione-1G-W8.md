# HO-052 — La redazione non raggiunge «Persone e permessi» né il registro (compito 1G-17)

Fase 1G, wave `1G-W8`, compito 1G-17. Scritto il 2026-10-26.

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

Verificare che la redazione non raggiunga «Persone e permessi» né il registro delle operazioni: né dal menu, né
dall'indirizzo, né dall'API. Il compito misura il **divieto d'accesso**, non la capacità di scoprire dove si trovano
le schermate.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `redazione`, più una prova senza accesso in una finestra privata. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Gli indirizzi qui sotto sono **dati di partenza del compito, non una guida**: servono a provare il divieto.

| # | Tipo | Metodo e indirizzo | Esito atteso con `redazione` | Esito atteso senza accesso |
|---|---|---|---|---|
| 1 | area | `http://127.0.0.1:3301/admin/impostazioni/persone` | nessun accesso: rifiuto, pagina inesistente o reindirizzamento altrove | reindirizzamento all'ingresso |
| 2 | area | `http://127.0.0.1:3301/admin/impostazioni/registro` | nessun accesso: rifiuto, pagina inesistente o reindirizzamento altrove | reindirizzamento all'ingresso |
| 3 | API | GET `http://127.0.0.1:3302/accounts` | 403, nessun dato | 401 |
| 4 | API | GET `http://127.0.0.1:3302/audit` | 403, nessun dato | 401 |
| 5 | API | GET `http://127.0.0.1:3302/audit/contents?search=prova` | 403, nessun dato | 401 |
| 6 | API | POST `http://127.0.0.1:3302/accounts` | 403 | 401 o 403 |
| 7 | API | PATCH `http://127.0.0.1:3302/accounts/{id}` (un `id` qualunque) | 403 | 401 o 403 |
| 8 | API | POST `http://127.0.0.1:3302/accounts/{id}/password-reset` (un `id` qualunque) | 403 | 401 o 403 |

Le righe 3-5 si provano scrivendo l'indirizzo nella barra del browser mentre sei entrato come `redazione`. Le righe
6-8 non si provano da una barra degli indirizzi: provale senza accesso con questi comandi, e per `redazione` riporta
«non provato dal browser» (sono coperte dalle prove automatiche della revisione di sicurezza, 1G-18):

```powershell
curl.exe -s -o NUL -w "%{http_code}\n" -X POST http://127.0.0.1:3302/accounts
curl.exe -s -o NUL -w "%{http_code}\n" -X PATCH http://127.0.0.1:3302/accounts/00000000-0000-0000-0000-000000000000
curl.exe -s -o NUL -w "%{http_code}\n" -X POST http://127.0.0.1:3302/accounts/00000000-0000-0000-0000-000000000000/password-reset
```

## 4. Come riconoscere la riuscita sul sito

Con `redazione`:

1. Navigando nell'area non trovi alcuna proposta che porti a gestire persone e permessi o a leggere il registro.
2. Le righe 1 e 2 non ti danno la schermata. Annota che cosa ottieni e se l'eventuale messaggio è in italiano e non rivela nulla di più.
3. Le righe 3, 4 e 5 rispondono 403 e il corpo della risposta non contiene dati di account né di registro.
4. Senza accesso (finestra privata) le righe 1-5 danno gli esiti della colonna «senza accesso»; i tre comandi delle righe 6-8 danno 401 o 403.

## 5. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1G-17 | la redazione non raggiunge «Persone e permessi» né il registro: né dal menu, né dall'indirizzo, né dall'API |

## 6. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-17**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Risposta ricevuta per ciascuna riga della tabella, con `redazione` e senza accesso

## 7. Se qualcosa non va

Annota quello che vedi, con il testo esatto di ogni messaggio, e vai avanti. Un difetto trovato è un risultato del collaudo, non un tuo errore. Se l'ambiente sembra rotto (pagine bianche, risposte 500), scrivilo e ripristinalo con HO-035 prima di ripetere.

## 8. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-052 (1G-17): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-17):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Proposte nell'area per `redazione` (sì / no):
Riga 1, esito con redazione / senza accesso:
Riga 2, esito con redazione / senza accesso:
Riga 3, codice con redazione / senza accesso:
Riga 4, codice con redazione / senza accesso:
Riga 5, codice con redazione / senza accesso:
Righe 6-8, codici senza accesso:
Dati visibili in una risposta di rifiuto (sì / no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
