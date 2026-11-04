# Collaudo della `1G-W9` — esiti e difetti

Nuovo collaudo della `1G-W9` (attività T11, criterio W9-6 di `.planning/phases/1G/W9-PLAN.md`). Ripete i compiti che nella `1G-W8` avevano difetti medi: 1G-1, 1G-2, 1G-5, 1G-13, 1G-16, più le verifiche di W8-34, W8-35 e W8-38 e la verifica a vista di W8-26. Li ha eseguiti l'agente con Playwright, con account sintetici propri (DR-290, DR-291), il 2026-10-30 dalle 07:06 alle 07:53 ora di Roma.

Rapporto completo, passo per passo: [`collaudo-1G-W9-agente.md`](collaudo-1G-W9-agente.md). Severità come nella `1G-W8`: **alta** impedisce il compito; **media** lo rende difficile o richiede aiuto; **bassa** è estetica o non si vede dall'utente.

## 1. Ambiente

- Commit `aaedbf5`, locale e non pubblicato, con le correzioni T1-T10b.
- Ambiente ricreato il 2026-10-30 con `tools/collaudo/crea.ps1`, prima con `-Simula` e poi con la conferma scritta:
  - database copiato senza differenze: 20 tabelle, 108 contenuti, 178 media;
  - oggetti copiati: 1970 su 1970;
  - 425 compilazioni svuotate e 14 sessioni tolte;
  - 8 account disattivati, nessuno attivo.
- Sito 3300, area 3301, API 3302: tutti 200 all'avvio. In tutto il collaudo nessuna risposta 500 o 503.
- Account dell'agente: Redazione e Amministrazione, `@example.invalid`, con le password solo in `C:\work\amoris-collaudo.stato`.
- Due account di prova creati dall'area per 1G-16.

Ogni scrittura è passata dall'interfaccia dell'area. Fanno eccezione le prove di rifiuto di DR-314 e W8-38: sono chiamate all'API con la sessione dell'area, e sono state tutte rifiutate. Il database è stato solo letto.

## 2. Esiti per compito

I tempi sono quelli dello script, quindi un limite inferiore per una persona.

| Compito | Handoff | Esito | Tempo | Errori dell'applicazione in console |
|---|---|---|---|---|
| 1G-1 | HO-036 | riuscito | 32 s | 0 |
| 1G-2 | HO-037 | **riuscito con difficoltà** (W9-N2) | circa 10 s, più 11 di prove accessorie | 0 |
| 1G-5 | HO-040 | riuscito | 16 s, più 13 di verifiche | 0 |
| 1G-13 | HO-048 | riuscito | circa 24 s utili | 0 |
| 1G-16 A, B, C | HO-051 | riuscito | A 39 s; B 20 s; C 119 s, di cui circa 65 di ritardo voluto dopo le password errate | 0 |
| W8-34, W8-35 | passata di copertura | riuscito | 13 s | 0 |
| W8-38 | passata di copertura | riuscito | 8 s | 0 |
| W8-26 a vista | HO-050 | riuscito | 13 s | 0 |

In 1G-1, 1G-2 e 1G-5 lo script dell'agente ha sbagliato tre volte. Ogni volta ha corretto dall'area, e lo annota nel rapporto completo. Nessuno dei tre sbagli è un difetto dell'area.

## 3. Difetti della `1G-W8` verificati

**Nessun difetto della `1G-W8` si ripresenta.**

| Id | Severità | Esito | Prova principale |
|---|---|---|---|
| W8-01 | media | risolto | miniature caricate dal sito (3300) nei selettori Immagine, «Media e testo» e immagine in evidenza |
| W8-03 | bassa | risolto | dopo ogni «Pubblica» il registro non ha nessun 404 |
| W8-04 | media | risolto | la prima opzione è «Scegli un contenuto»; senza scelta, «Non è stata aggiunta — Scegli il contenuto a cui punta la voce.» |
| W8-05 | bassa | risolto | 109 contenuti proposti su 109 |
| W8-06 | media | risolto | «Cambia immagine» nel blocco; dopo la sostituzione la pagina ha una sola immagine |
| W8-09 | bassa | risolto | `/auth/me`, `/draft` e `/seo/contents/:id` rispondono 204 |
| W8-10 | media | risolto | il selettore propone il testo alternativo di Media; con il blocco vuoto, il sito usa testo alternativo e didascalia di Media |
| W8-11 | media | risolto | didascalia leggibile a 1440 e a 390 px; le fotografie sono state guardate |
| W8-12 | bassa | risolto secondo DR-313 | il `title` del blocco compare nel sorgente |
| W8-13 | media | risolto secondo DR-293 | pulsante «Salva e aggiorna il sito» con l'avviso «Le modifiche salvate compaiono subito sul sito.»; la sola copia di lavoro non tocca il sito |
| W8-15 | bassa | risolto | nessun pulsante senza nome nell'albero del menu |
| W8-16 | bassa | risolto | dopo l'aggiunta e l'eliminazione di due voci le posizioni del menu sono identiche alla partenza |
| W8-19 | bassa | risolto | «File eliminato.» |
| W8-23 | bassa | risolto per Persone e permessi e per Menu | «Account creato.», «Account disattivato.», «Voce aggiunta.» e gli altri avvisi |
| W8-24 | media | risolto | nell'elenco «Senza titolo — Pagina iniziale»; nell'editor «Pagina iniziale» |
| W8-26 | media | risolto | titoli delle slide senza tag visibili: a capo, centrati, con il cuore |
| W8-27 | media | risolto | «Cambia la password» nel menu della persona |
| W8-28 | media | risolto | «Ruoli cambiati: la sessione è stata chiusa. Entra di nuovo.» |
| W8-29 | bassa | risolto | il registro conserva i titoli dei contenuti eliminati |
| W8-30 | bassa | risolto nell'elenco | l'elenco del registro non mostra più le righe ambigue |
| W8-32 | bassa | risolto | nessun 401 o 403 nei rinvii da Impostazioni |
| W8-34 | media | risolto | dopo una ricarica la scheda nomina l'immagine; «Togli l'immagine» la toglie anche dal sito |
| W8-35 | bassa | risolto | «Usa questo media» è attivo senza testo alternativo |
| W8-37 | bassa | risolto | un campo nato vuoto, compilato e poi svuotato torna vuoto |
| W8-38 | media | risolto | scelta da elenco; cambio e ripristino riusciti; valori non validi rifiutati con 400 in italiano |

Anche DR-314 è attuato: sulla pagina iniziale «Ritira» è disattivato con un aiuto, e l'API rifiuta con 409 in italiano.

I difetti W8-07, W8-14, W8-18, W8-20, W8-21, W8-22, W8-25, W8-31, W8-33 e W8-36 non stanno nei compiti ripetuti: restano provati dalle prove automatiche indicate in `collaudo-1G-W8.md` §2.

## 4. Console (W9-2, 1G-24)

- **Errori dell'applicazione: 0** in tutti i compiti. Nessuna eccezione e nessun `console.error` scritto dal codice. Sul sito e nell'anteprima, nessuna voce.
- Restano in console come righe rosse di Chromium solo i rifiuti che il compito stesso provoca: accessi sbagliati (401), password attuale errata (403), indirizzo già usato e media in uso (409), valori non validi (400). Nei compiti senza rifiuti voluti non c'è nessuna riga rossa.
- Il resto è rumore del browser: avvisi gialli di Next sul precaricamento dei CSS e risposte 204 che Playwright segnala come interrotte.

## 5. Difetti nuovi

La numerazione segue W9-N1, il difetto trovato nella T10. Fra parentesi, il nome nel rapporto completo.

| Id | Severità | Dove | Difetto | Stato |
|---|---|---|---|---|
| W9-N1 (T10) | media | editor › «Media e testo» ed «Elenco di contenuti» | L'ispettore mostrava il nome interno del tipo e nessun pannello: non si sceglievano l'immagine, le categorie né il numero di articoli | corretto nella T10b (DR-320…DR-323; prova `block-inspector-d211.test.tsx`) |
| **W9-N2** (N1) | **media** | editor › blocco «Testo» | Mentre si scrive, una parte dei tasti premuti va persa: fino a 6 «Canc» su 22 senza pausa, 1 su 22 con 50 ms fra un tasto e l'altro, in una prova 10 «Backspace» su 10. Così è stato pubblicato un testo sbagliato, senza nessun avviso | corretto nella T11b (DR-326, DR-327); confermato dalla 1G-2 ripetuta il 2026-10-31 (§9) |
| W9-N3 (N2) | bassa | Menu › «Aggiungi una voce» › «Contenuto»; Impostazioni › «Pagina iniziale» | La pagina iniziale, che non ha titolo, compare come opzione vuota o come «(/home/)». Anche una notizia in bozza senza titolo compare vuota | corretto nella T11b (DR-328); esteso all'eliminazione dei contenuti, dove un contenuto senza titolo si eliminava senza scrivere nulla (DR-331) |
| W9-N4 (N3) | bassa | Pagine › «Nuova pagina» › aiuto di «Indirizzo» | Refuso: «Si puo' correggere.» invece di «Si può correggere.» | corretto nella T11b (DR-327) |
| W9-N5 (N4) | bassa | editor › «Immagine in evidenza» | Scelta e rimozione non danno messaggi e cambiano subito il sito, senza che il pannello lo dica | corretto nella T11b (DR-329) |
| W9-N6 (N5) | bassa | editor › albero dei blocchi | Un blocco Immagine che usa il testo alternativo di Media si chiama solo «Immagine — immagine»: due immagini così non si distinguono | corretto nella T11b (DR-327) |
| W9-N7 (revisione della T11b) | bassa | editor › copia di lavoro | Su una rete lenta due salvataggi della copia di lavoro possono arrivare in ordine inverso: resta la copia più vecchia mentre lo schermo dice «salvata». Un salvataggio ancora in viaggio dopo «Scarta la copia di lavoro», «Salva» o «Pubblica» può far ricomparire la copia alla riapertura. Esisteva già prima della T11b | corretto nella `1F-W1` (DR-350, DR-355; §10) |
| W9-N8 (1G-2 del 2026-10-31) | bassa | editor › blocco «Testo» | «Ctrl+Home» premuto pochi millisecondi dopo il clic nel testo a volte non sposta il cursore: i «Canc» seguenti cadono in fondo al paragrafo e non tolgono nulla. 2 prove su 45, 1 su 24 già prima della T11b | non riprodotto nella `1F-W1`, corretto in via preventiva (DR-351; §10) |

**W9-N2, causa (T11b, DR-326).** Il rapporto completo indicava `RichTextEditor.tsx:105-115`, ma la causa vera era un'altra.

- **Nessuna perdita fuori dal collaudo.** Fuori dal collaudo, 40 prove strumentate nell'ambiente e2e non hanno perso alcun tasto, nemmeno con la CPU rallentata fino a 16 volte.
- **Riprodotta nel collaudo.** Il 2026-10-30 il collaudo è stato riacceso sullo stesso commit e la prova strumentata è stata ripetuta su una pagina sintetica, poi eliminata dall'area. Risultato:
  - scenario e09 dell'agente, 24 prove: 54 «Canc» persi su 528. Di questi, 32 in 15 prove con perdite parziali, il segno di W9-N2; 22 in una prova in cui nessun «Canc» ha avuto effetto, un fenomeno diverso (W9-N8, §9);
  - scenario e10, 23 prove: 2 «Backspace» persi.
- **Che cosa succedeva.** A ogni tasto perso:
  - il fuoco era nell'editor, l'editor era uno solo e non c'era alcun ricaricamento del testo;
  - il cursore per ProseMirror era ancora quello di prima (in fondo al paragrafo), mentre il browser lo aveva già spostato con Ctrl+Home o con le frecce;
  - ProseMirror legge lo spostamento solo all'evento `selectionchange`: quando la pagina è occupata, quell'evento arriva dopo i tasti successivi, e un tasto che arriva prima lavora sul cursore vecchio;
  - un «Canc» con l'editor convinto di essere in fondo viene ignorato;
  - un «Backspace» con l'editor convinto di essere a inizio riga unirebbe due paragrafi.
- **Correzione.** Prima di gestire un tasto, l'editor legge il cursore dal browser (`syncSelectionFromDom`). Lo dimostrano due prove che fallivano prima della correzione: in `richtext-typing-w9.test.tsx` e nell'e2e `tests/e2e/cms/digitazione.spec.ts`, che trattiene l'evento per qualche tasto.
- **Due difetti latenti nella stessa area**, corretti con una prova ciascuno che falliva prima (DR-327):
  - l'editor ricaricava il testo se riceveva in ritardo un valore che aveva già prodotto;
  - ciò che si scrive mentre la copia di lavoro viaggia verso il servizio non arrivava mai alla copia, e lo stato diceva «salvata». Lo mostrano `working-copy-inflight-w9.test.tsx` e due e2e di `digitazione.spec.ts`. Ora quella modifica resta «da salvare» e va nella copia successiva.

## 6. Osservazioni (non difetti)

- **O1.** Dopo una password attuale errata, ogni salvataggio del proprio account attende 21-22 s, anche con la password giusta. È il ritardo di sicurezza voluto, ma l'area non lo spiega.
- **O2.** Nel registro, le righe sugli account hanno come oggetto solo «Account». Il nome della persona dipende dalla regola di DR-315.
- **O3.** I rifiuti voluti restano righe rosse in console (§4). Toglierle sarebbe una scelta di progetto.
- **O4.** Ogni pagina dell'area ha avvisi gialli di Next sul precaricamento dei CSS.
- **O5.** «Cambia immagine» non sceglie una variante. Un blocco importato con una variante, per esempio 724×1024, non si riporta identico dall'area: si ottiene il file intero, con le stesse proporzioni.

## 7. Residui nel collaudo

Confronto con SELECT fra l'inizio e la fine. Menu, media, contenuti, slide, redirect, modelli e impostazioni coincidono con la partenza; logo e pagina iniziale sono ripristinati. Le pagine e i media di prova sono eliminati, e non resta nessuna copia di lavoro. Restano:

1. `/reinventa-la-tua-vita/`: la frase e l'immagine di prova sono tolte, con tre differenze dalla partenza.
   - Il blocco Immagine serve il file intero invece della variante 724×1024 (O5).
   - Il primo blocco «Testo» è salvato senza gli a capo fra i paragrafi, e sul sito non si vede.
   - La data di ultima modifica è il 30/10/2026.
2. `site.description` vale `null` invece di `""`. È l'effetto voluto della correzione di W8-37, e il sito non cambia.
3. Due account di prova disattivati, perché l'area non cancella gli account.
4. 224 righe nuove nel registro, tutte del collaudo.

## 8. Riservatezza

- Il controllo finale ha confrontato le 4 password note con 212 file: **0 corrispondenze**.
- In 8 file comparivano IBAN o indirizzi della pagina reale e dell'elenco delle persone: sono stati oscurati prima di chiudere.
- I profili del browser con i cookie di sessione sono stati cancellati.
- Spec, giornali e fotografie stanno in `.superpowers/sdd/strumenti-1G/collaudo-w9/`, fuori da Git.

## 9. Esito rispetto a W9-6

Il criterio chiede che i compiti dei difetti medi riescano senza difficoltà. È soddisfatto in 7 compiti su 8. **1G-2 non lo soddisfa** per W9-N2, un difetto medio nuovo. Come prevede il piano (§6, «i medi si correggono nella wave»), W9-6 resta aperto finché W9-N2 non è corretto e 1G-2 non è ripetuto. In alternativa, l'utente può approvare W9-N2 voce per voce.

**Dopo la T11b.** W9-N2 è corretto e W9-N3…W9-N6 anche. Per DR-324, W9-6 si chiude solo dopo questi passi, ciascuno su conferma separata:

1. nuovo commit locale;
2. collaudo ricreato con `crea.ps1`;
3. 1G-2 ripetuto dall'agente senza difficoltà.

**1G-2 ripetuto il 2026-10-31 (passo 3).**

- **Ambiente.**
  - Commit `ec640c2`, collaudo ricreato il 2026-10-30 con `crea.ps1`: 20 tabelle senza differenze, 108 contenuti, 178 media, 2057 oggetti come lo sviluppo.
  - Alla prima accensione l'API non raggiungeva il database: dopo il riavvio di Docker Desktop del 30 ottobre, le porte 5432 e 9000 dall'host interrompevano le connessioni. Riavviati i due contenitori, `avvia.ps1` ha dato 200 su API, sito e area.
  - Account dell'agente ricreati (DR-291), con le password solo nel file di stato.

| Passo | Esito |
|---|---|
| 1G-2, frase e immagine (`02-1g2`) | **riuscito senza difficoltà**, 16 s. Frase, testo alternativo e didascalia sul sito; didascalia sotto l'immagine a 1440 e a 390 px |
| Ripristino della pagina (`02d`) | riuscito, 15 s. I 22 «Canc» con 200 ms di pausa hanno tolto esattamente la frase |
| Prova dei tasti persi, su una pagina sintetica creata ed eliminata dall'area | e09: 45 prove e 990 «Canc», **nessuna prova con perdite parziali** (su `aaedbf5` erano 15 su 24). e10: 44 prove, 1804 lettere e 440 «Backspace», nessuno perso |

- **Errori.** Nessun errore dell'applicazione in console e nessuna risposta HTTP ≥ 400; restano gli avvisi di O4.
- **Differenze dalla partenza.** Il resto della pagina cambia come il 30 ottobre: gli spazi unificatori (`&nbsp;`) del primo blocco «Testo» diventano spazi normali, come l'editor annuncia, e l'immagine torna intera (O5).
- **Residuo.** Il media `prova-1g-2.png`, da togliere con la pulizia della `1G-W10`.

**W9-N8 (nuovo, bassa; rinviato alla `1F-W1` con DR-336).**

- **Che cosa succede.** In 2 prove su 45, e in 1 su 24 già su `aaedbf5`, nessuno dei 22 «Canc» ha avuto effetto.
- **Che cosa mostrano gli eventi registrati.**
  - Il fuoco era nell'editor.
  - «Ctrl+Home», premuto pochi millisecondi dopo il clic nel testo, non ha spostato il cursore.
  - Browser ed editor concordano che il cursore è in fondo al paragrafo, dove «Canc» non toglie nulla.
- **Che cosa vedrebbe una persona.** Il cursore rimasto in fondo e il testo invariato. Non si pubblica un testo sbagliato senza accorgersene, come con W9-N2.
- **Che cosa non è stato misurato.** Se capita anche con i tempi di una persona, che preme i tasti centinaia di millisecondi dopo il clic.

**Esito.** 1G-2 è riuscito senza difficoltà e il segno di W9-N2 è scomparso: W9-6 è soddisfatto. W9-N8 è basso e non cambia questo esito; l'utente lo ha rinviato alla `1F-W1` (DR-336).

## 10. Correzioni della `1F-W1` (2026-11-04)

I due difetti bassi rinviati dalla 1G sono stati corretti nella `1F-W1`, senza toccare API e database. Piano: `.planning/phases/1F/W1-PLAN.md`.

**W9-N7 (DR-350, DR-355).**

- **Correzione.** L'editor manda un solo salvataggio della copia di lavoro alla volta. Una modifica fatta mentre un salvataggio è in viaggio si salva subito dopo, con lo stato più recente. «Scarta la copia di lavoro», «Salva» e «Pubblica» attendono il salvataggio in viaggio prima di eliminare la copia. Durante l'attesa di «Scarta» i pulsanti sono disattivati (DR-355).
- **Prove, rosse prima della correzione.**
  - `apps/admin/tests/working-copy-order-1f.test.tsx`: risposte in ordine inverso, ora mostrata, «Scarta», «Salva», «Pubblica» e pulsanti disattivati durante lo scarto.
  - `apps/admin/tests/draft-save-queue-1f.test.ts`: la coda dei salvataggi.
  - `tests/e2e/cms/digitazione.spec.ts`: salvataggio trattenuto 3 s, «Scarta», riapertura senza copia.
- **Residuo annotato, non corretto (DR-355).** Il salvataggio della copia non ha un tempo massimo: su una connessione che resta bloccata, «Salva», «Pubblica» e «Scarta» attendono finché il browser non chiude la richiesta. È un'ipotesi della revisione, non un caso osservato. Un tempo massimo nel browser non basterebbe, perché il servizio potrebbe ricevere la richiesta interrotta più tardi.

**W9-N8 (DR-351).**

- **Riproduzione.** Prova strumentata fuori da Git (`.superpowers/sdd/strumenti-1F/`), con pagina sintetica creata ed eliminata: clic in fondo al paragrafo, «Ctrl+Home» dopo 0-10 ms, 22 «Canc». Sul codice prima della correzione nessuna prova senza effetto su 50 con CPU rallentata 4 volte e su 50 con CPU rallentata 16 volte. Il difetto non si è riprodotto, quindi la causa resta non osservata.
- **Correzione preventiva.** «Ctrl/Cmd+Home» e «Ctrl/Cmd+Fine» spostano il cursore dall'editor e non dal browser; con «Maiusc» estendono la selezione.
- **Prove, rosse prima della correzione.** `apps/admin/tests/richtext-document-edges-1f.test.tsx` e l'e2e W9-N8 di `digitazione.spec.ts`, in cui il browser non sposta il cursore. Ripetizione della prova strumentata sul codice corretto: 50 su 50 senza perdite sia a CPU ×4 sia a CPU ×16.

**Verifica.** Revisione del codice con 0 esiti critici e 0 alti. Verifica come la CI sul codice prima di DR-355: frozen, lint, Prettier, typecheck, build, db:verify, test (3060 prove), copertura 93,7 % ed e2e 69/69 verdi. Dopo DR-355: prove dell'area 750/750 al secondo giro (al primo, un timeout sotto carico di `content-preview.test.tsx`, verde da solo 3 volte su 3) ed e2e di digitazione 5/5.
