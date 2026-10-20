# Revisione di sicurezza — wave 1G-W1 (account e ruoli)

| | |
|---|---|
| **Data** | 2026-10-20 |
| **Wave** | `1G-W1`, attività T6 |
| **Criterio** | W1-9: nessun esito critico o alto aperto |
| **Riferimenti** | ADR-007 §3.1 e revisione del 2026-10-20 (DR-224), DR-219, DR-220, DR-227, DR-228, DR-229 |

## 1. Ambito

Il diff della wave: modulo `accounts` dell'API (rotte, schemi, servizio), cambio
obbligatorio della password, permessi e aree nuove, migrazione `0008`, schermata
«Persone e permessi» e schermata «Cambia password» dell'area amministrativa, seme
sintetico. Il codice vicino è stato letto quando serviva a confermare un rischio:
riconoscimento della sessione, anti-CSRF, sessioni, rotte di autenticazione.

## 2. Metodo

- Revisore indipendente, in sola lettura, sul diff della wave. Ha esaminato
  autorizzazione per area e per permesso, enumerazione degli account, CSRF,
  limitazione delle richieste, generazione della password, log e registro.
- Ogni correzione è nata da una prova che falliva prima ed è passata dopo,
  nelle prove dell'API (`apps/api/tests`) e dell'area amministrativa
  (`apps/admin/tests`).
- Durante le correzioni è emerso un esito nuovo, S13: è riportato qui con la
  stessa regola.
- Solo dati sintetici `*@esempio.invalid`. Nessun segreto e nessun dato reale in
  questo documento.

## 3. Esiti

| id | Gravità | Esito | Stato | Prova o motivo |
|---|---|---|---|---|
| S1 | Media | `/auth/password` accettava una nuova password uguale a quella attuale: una password temporanea poteva «cambiare» restando nota a chi l'aveva reimpostata | **corretto**: 400 con messaggio in italiano; anche la schermata lo rifiuta prima di chiamare il servizio | `passwordChange.test.ts` «S1: rifiuta una nuova password uguale…»; `password.test.tsx` «rifiuta una nuova password uguale a quella attuale…» |
| S2 | Media | `/auth/password` non aveva una limitazione dei tentativi, eppure verifica la password attuale (controllo 8) | **corretto**: i fallimenti si contano per account e per indirizzo come per l'accesso, con gli stessi tetti e la stessa finestra; oltre il tetto risponde 429 | `passwordChange.test.ts` «per account…» e «per indirizzo…» |
| S3 | Bassa | Il blocco del cambio obbligatorio elencava le rotte da rifiutare: una rotta autenticata nuova sarebbe nata aperta | **corretto**: rifiuto per difetto di ogni rotta autenticata, tranne quelle che lo dichiarano nella propria configurazione (`/auth/me`, `/auth/password`, `/auth/logout`) | `passwordChange.test.ts` «S3: … rotte autenticate senza area…», «S3: … una scrittura con token anti-CSRF valido…», «S3: … una seconda sessione della stessa persona è revocata» |
| S4 | Bassa | Le risposte degli account (elenco, password temporanee) non vietavano la cache | **corretto**: `Cache-Control: no-store` su tutte le risposte di `/accounts` e su `/auth/password`, che rinnova la sessione | `accounts.test.ts` «S4: …no-store»; `passwordChange.test.ts` «S3: … seconda sessione…» |
| S5 | Bassa | La riga di registro della creazione non diceva quali ruoli fossero stati concessi | **corretto**: `account.create` registra anche le chiavi dei ruoli, senza indirizzi né password | `accounts.test.ts` «ogni riga degli account porta l'id toccato…» |
| S6 | Bassa | La password temporanea non scade | **rinviato** alla revisione di sicurezza della Fase 1F | richiede una colonna nuova o una regola sulla data, cioè una decisione dell'utente; la wave vieta colonne nuove |
| S7 | Bassa | La riattivazione rimette in funzione la vecchia password | **rinviato** alla Fase 1F | è una scelta di processo (riattivare o reimpostare) da decidere con l'utente; oggi la reimpostazione è a un clic dalla riattivazione |
| S8 | Bassa | Cambiando i ruoli, si toglievano anche i ruoli non assegnabili dall'amministrazione | **corretto**: si aggiungono e tolgono solo `editor` e `amministrazione`; gli altri ruoli restano | `accounts.test.ts` «S8: …» con il ruolo `segreteria` |
| S9 | Bassa | La sessione non ricontrolla che il ruolo attivo sia ancora posseduto | **rinviato** alla Fase 1F | difesa in profondità: le rotte degli account già revocano le sessioni quando tolgono un ruolo; il caso riguarda solo modifiche fatte fuori dal servizio |
| S10 | Bassa | Corsa fra cambio della password e reimpostazione | **rinviato** alla Fase 1F | effetto contenuto: la sessione che ne nasce resta bloccata dal cambio obbligatorio |
| S11 | Bassa | Dopo la `0008` nessun account ha `amministrazione` | **gestito da `docs/handoff/HO-030-migrazione-0008-1G-W1.md`** | l'account con `ACCOUNT_ROLE=amministrazione` si crea dopo la `0008`, con la procedura di `docs/handoff/HO-030-migrazione-0008-1G-W1.md` |
| S12 | Bassa | «Copia la password» lascia la password temporanea negli appunti del sistema | **rinviato** alla Fase 1F | rischio legato alla postazione; da valutare con le regole d'uso delle postazioni del Centro |
| S13 | **Critica** | Su una rotta di scrittura, il rifiuto per area sbagliata (e per cambio password in sospeso) rispondeva 403 ma **il gestore veniva eseguito lo stesso**: una sessione di redazione poteva creare un account o darsi il ruolo `amministrazione` | **corretto**: il controllo di accesso ferma la richiesta prima del gestore in ogni caso di rifiuto. Anche `requireSession` e `requirePermission` prima lasciavano partire il gestore dopo un 401, senza effetto sfruttabile perché l'hook anti-CSRF rifiuta prima le scritture anonime | `accounts.test.ts` «S13: il 403 per area sbagliata ferma davvero il gestore…»: prima della correzione l'account veniva creato; «S13: nessun rifiuto del controllo di accesso lascia partire il gestore» verifica in modo deterministico area sbagliata, 401, cambio password in sospeso e permesso mancante |

## 4. Righe dell'autenticazione

Misura dopo le correzioni: **nucleo 469** su 500, **totale 1298**. Il nucleo resta
sotto la soglia di DR-070; per il totale vale la deroga di DR-066. Dichiarazione in
`apps/api/tests/auth-line-count.json`.

## 5. Verdetto

**Nessun esito critico o alto aperto.** S13, critico, e S1, S2, S3, S4, S5, S8 sono
corretti, ciascuno con la prova che lo dimostra. S6, S7, S9, S10 e S12 sono bassi e
rinviati alla revisione di sicurezza della Fase 1F con il motivo indicato. S11 si
chiude con `docs/handoff/HO-030-migrazione-0008-1G-W1.md`. W1-9 è soddisfatto.

Nota: S13 esisteva prima della wave, in ogni modulo con area. Va citato nella
revisione di sicurezza della Fase 1F come difetto corretto, perché tocca il
controllo di accesso di tutte le aree.
