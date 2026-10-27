# HO-051 — Creare e disattivare un account, reimpostare la password; impostazioni del sito (compito 1G-16)

Fase 1G, wave `1G-W8`, compito 1G-16. Scritto il 2026-10-26, aggiornato il 2026-10-27 (DR-270, DR-273, DR-282, DR-288).

Questo documento dice **che cosa** ottenere e come riconoscerlo sul sito, non **come** farlo: il collaudo misura se la redazione ci riesce da sola (`acceptance-criteria.md` §5). Durante il compito non chiedere aiuto all'agente. Se ti blocchi, annota dove e passa oltre.

---

## 1. Obiettivo

**Compito 1G-16 (Parte A).** Creare un account di prova con il ruolo di redazione, entrare con esso, reimpostarne la
password, disattivarlo e vedere che non entra più.

La **Parte B** (impostazioni globali del sito) e la **Parte C** (nome ed email di un account, il proprio account) sono prove accessorie, ciascuna con un cronometro a parte.

## 2. Ruolo, account e prerequisiti

- Ruolo e account: `amministrazione`. La password la conosci solo tu: non scriverla né nell'handoff né nella chat.
- L'ambiente di collaudo è acceso e riportato allo stato iniziale: lo crei con HO-034 e, se ripeti il compito, lo ripristini con HO-035. Sito `http://127.0.0.1:3300`, area `http://127.0.0.1:3301/admin`.
- Un cronometro, un browser e una finestra privata del browser (per vedere il sito come lo vede chi non è entrato). Apri gli strumenti per sviluppatori (F12) prima di cominciare e tieni d'occhio la console: ogni errore rosso va annotato.

## 3. Dati di partenza sintetici

Account nuovo: nome `Persona di prova collaudo 1G-16`, indirizzo `prova-1g-16@example.invalid`, ruolo redazione. Le password, temporanea o scelta da te, non vanno scritte da nessuna parte e non vanno incollate nel rapporto. Entra con l'account di prova in una finestra privata, distinta dalla tua sessione.

## 4. Come riconoscere la riuscita sul sito

1. L'account nuovo risulta esistente, attivo e con il ruolo redazione, e nessuna password si vede in chiaro.
2. L'account di prova entra e può fare il lavoro della redazione (i compiti 1G-1…1G-8); non può gestire le persone, cambiare le impostazioni del sito né leggere il registro.
3. Dopo la reimpostazione la vecchia password non entra e quella nuova sì.
4. Disattivato, l'account non entra: il messaggio non rivela se l'account esiste. Una sessione che aveva già aperto smette di funzionare.
5. Riattivato, entra di nuovo; lo disattivi di nuovo alla fine.
6. Nessuna password compare in schermate o avvisi dopo la creazione o la reimpostazione, oltre al momento in cui la ricevi.
7. 1D-37: creazione, reimpostazione, disattivazione e riattivazione risultano nel registro delle operazioni a nome di `amministrazione`, con orario; non a nome dell'account di prova.

## 5. Prove accessorie (cronometro separato)

Queste prove servono ad altri criteri, non al compito 1G-16: conta i loro minuti a parte e non sommarli a quelli del compito.

**Parte B — impostazioni globali del sito (1D-35, HO-006).** Obiettivo: cambiare le impostazioni e riconoscere sul sito quelle che hanno un effetto. Annota prima i valori di partenza, e a fine prova ripristinali. Conta i minuti a parte.

| Impostazione | Valore di prova |
|---|---|
| Titolo del sito | `Centro Amoris Laetitia - prova collaudo 1G-16` |
| Descrizione del sito | `Descrizione di prova collaudo 1G-16` |
| Testo del piè di pagina | `Piè di pagina di prova collaudo 1G-16` |
| Indirizzo e telefono del Centro | valori inventati: `Via Inventata 1, 00000 Cittàdiprova`, `+39 000 0000000` |
| Articoli per pagina | un numero diverso da quello di partenza; poi prova anche `0` |
| Formato data | `d/m/Y` |
| Lingua del sito | `en_US`, il tempo di vederne l'effetto, poi il valore di partenza |
| Fuso orario | `UTC` |
| Formato ora e primo giorno della settimana | un valore diverso da quello di partenza |

Risultati attesi:

1. Ricaricata una pagina del sito (Ctrl+F5), la linguetta del browser mostra il titolo di prova dove il sito usa il titolo del sito, anche sulla pagina che non esiste (404), e il piè di pagina mostra `Piè di pagina di prova collaudo 1G-16`.
2. Per ognuna delle altre impostazioni annota se hai visto un effetto sul sito e dove. Alcune sono lette dal sito solo nei dati per i motori di ricerca o nel feed: nessun effetto visibile è atteso. In particolare (DR-270):
   - **Formato data:** nella pagina pubblica di un documento (`/download/…/`) «Data di creazione» e «Ultimo aggiornamento» seguono il formato di prova; la data sotto il titolo delle notizie e negli archivi **non** cambia, perché nella sorgente seguiva un'opzione del tema;
   - **Lingua del sito:** con `en_US` i mesi nella pagina di un documento sono in inglese e `og:locale` è `en_US`; con il valore di partenza tornano come prima;
   - **Fuso orario:** una data cambia solo se cade vicino alla mezzanotte; annota se ne vedi una cambiare;
   - **Articoli per pagina:** oggi nessun elenco del sito ne dipende (l'unico elenco ha un numero proprio, archivi e ricerca seguono il tema), quindi nessun effetto è atteso; `0` è rifiutato con un messaggio in italiano;
   - **Formato ora e primo giorno della settimana:** si salvano, ma nessun punto del sito li usa, come nella sorgente.

```powershell
curl.exe -s http://127.0.0.1:3300/404-url-inesistente/ | Select-String -Pattern '<title>.*?</title>' -AllMatches | ForEach-Object { $_.Matches.Value }
(Invoke-WebRequest http://127.0.0.1:3300/ -UseBasicParsing).Content | Select-String -Pattern '<html[^>]*>|<meta[^>]+og:locale[^>]*>' -AllMatches | ForEach-Object { $_.Matches.Value }
```

3. Il contenuto di `robots.txt` e la sitemap non si cambiano dall'area, e nessuna impostazione nuova si può aggiungere (DR-282); il file `robots.txt` e la sitemap del sito rispondono come prima delle tue modifiche (stesso codice di risposta):

```powershell
curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:3300/robots.txt
curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:3300/sitemap.xml
```

4. Nessuna chiave o segreto compare in ciò che hai visto: se ne vedi, è un difetto grave da annotare.
5. A fine prova i valori sono ripristinati.

**Parte C — nome ed email di un account, e il proprio account (DR-282, DR-288).** I punti 1 e 2 si fanno con il tuo account `amministrazione`, mentre l'account di prova è attivo, prima di disattivarlo l'ultima volta nella Parte A. Obiettivi:

1. L'account di prova si chiama `Persona di prova collaudo 1G-16 rinominata` e ha l'indirizzo `prova-1g-16-nuova@example.invalid`: l'elenco li mostra, e per un account diverso dal tuo la password attuale non ti è chiesta. L'indirizzo di un altro account dell'elenco è rifiutato con un messaggio in italiano (non scriverlo nel rapporto).
2. Dopo il cambio di indirizzo, la sessione che l'account di prova aveva aperto nella finestra privata smette di funzionare; l'account entra con l'indirizzo nuovo e la sua password, e non con il vecchio.
3. **Il proprio account, con una seconda amministrazione (DR-288).** Le modifiche al proprio account si provano solo con una seconda amministrazione sintetica, **mai** con l'account `amministrazione` con cui lavori. Creala tu da PowerShell 7.3 o successivo, come in HO-034: lo strumento chiede la password a terminale e non la stampa; non scriverla da nessuna parte.

   ```powershell
   Set-Location C:\work\CentroAmorisLaetitia
   .\tools\collaudo\crea-account.ps1 -Indirizzo 'amministrazione-prova-1g-16@example.invalid' -Nome 'Seconda amministrazione di prova collaudo 1G-16' -Ruolo amministrazione
   ```

   Chiudi la finestra privata dell'account di prova, aprine una nuova ed entra con la seconda amministrazione. Su di sé, ogni modifica chiede la password attuale; senza password o con una password errata la modifica è rifiutata e **non cambia nulla**. Gli errori voluti sono pochi e restano ben sotto i limiti: 5 password errate per account e 20 per indirizzo di rete in 15 minuti. Tutto il collaudo parte da 127.0.0.1, quindi un blocco per indirizzo chiuderebbe fuori anche il tuo account di lavoro: non aggiungere tentativi errati oltre a quelli chiesti. Se compare il blocco dei tentativi, annota il messaggio e attendi 15 minuti; se poi non riesci a rientrare, segui «Se qualcosa non va». Obiettivi, tutti sulla seconda amministrazione stessa:
   - il nome diventa `Seconda amministrazione di prova collaudo 1G-16 rinominata`: prima senza password e poi con una password errata la modifica è rifiutata e l'elenco mostra ancora il nome di prima; con la password giusta riesce;
   - ai suoi ruoli si aggiunge la redazione, poi si toglie: anche qui, senza password o con una errata i ruoli restano quelli di prima;
   - la propria password si cambia con la procedura che l'area offre a chi è entrato: con una password attuale errata il cambio è rifiutato e la vecchia password entra ancora; con quella giusta la nuova password entra e la vecchia no;
   - nella propria riga dell'elenco non si offrono né la reimpostazione della password né la disattivazione;
   - l'indirizzo diventa `amministrazione-prova-1g-16-nuova@example.invalid`, con la password giusta: la sessione in corso si chiude, e si rientra con l'indirizzo nuovo e non con il vecchio.

   Alla fine, con il tuo account `amministrazione`, disattiva la seconda amministrazione.
4. Nel registro delle operazioni le modifiche dei punti 1 e 3 risultano con account e orario (quelle del punto 3 a nome della seconda amministrazione), e nessuna riga mostra un indirizzo email o una password.

Conta i minuti della Parte C a parte.

## 6. Verifiche collegate (criteri della 1D e HO-006)

| Criterio | Che cosa deve risultare |
|---|---|
| 1D-35 | modificare le impostazioni globali (Parte B) |
| 1D-37 | le operazioni sugli account lasciano una riga di registro (Parte A, punto 7) |
| HO-006, prova delle impostazioni | cambiare titolo e articoli per pagina; nessun valore riservato si mostra; sitemap e robots non sono modificabili (Parte B) |
| DR-270, DR-273 | impostazioni lette dal sito, titolo del sito anche nella 404; formato ora e primo giorno senza effetto (Parte B) |
| DR-282 | nome ed email di un account; robots, sitemap e chiavi nuove non modificabili (Parti B e C) |
| DR-288 | la password attuale per modificare il proprio account (Parte C) |

## 7. Che cosa annotare

Per il compito: **esito** (riuscito / riuscito con difficoltà / non riuscito), **minuti del solo compito 1G-16**, dall'inizio alla riuscita (pause e prove accessorie escluse), **difficoltà** incontrate, **messaggi** visti (testo esatto) ed eventuali errori in console. Il tempo si registra e non vincola: oltre 10 minuti il compito apre un difetto di usabilità da esaminare, non un fallimento (DR-221). Se rinunci, scrivi a che punto e perché.

In più, per questo compito:

- Messaggio mostrato all'account disattivato, parola per parola
- Parte B: impostazione per impostazione, effetto visto sul sito (sì / no, dove)

## 8. Se qualcosa non va

Se l'account di prova si blocca (troppi tentativi di accesso), attendi qualche minuto e riprova: annota il messaggio. Se non riesci a rientrare con `amministrazione`, scrivilo senza tentare altro: non reimpostare account di cui non hai la password.

## 9. Come segnalare il completamento

Nel prompt successivo copia e compila:

```
HO-051 (1G-16): fatto
Esito: riuscito / riuscito con difficoltà / non riuscito
Minuti (solo il compito 1G-16):
Minuti Parte B (impostazioni, accessoria):
Minuti Parte C (account, accessoria):
Difficoltà incontrate:
Messaggi visti (testo esatto):
Errori in console:
Parte A, creazione e ingresso riusciti (sì / no):
Parte A, reimpostazione riuscita (sì / no):
Parte A, account disattivato respinto, messaggio (testo esatto):
Parte A, operazioni nel registro a nome di amministrazione (sì / no):
Parte B, titolo con effetto (sì / no, dove):
Parte B, piè di pagina con effetto (sì / no):
Parte B, altre impostazioni (elenco con effetto sì / no):
Parte B, titolo di prova anche nella 404 (sì / no):
Parte B, formato data nella pagina dei documenti e non sotto i titoli (sì / no):
Parte B, lingua en_US: mesi in inglese e og:locale (sì / no):
Parte B, articoli per pagina 0 rifiutato, messaggio (testo esatto):
Parte B, robots.txt e sitemap invariati (sì / no):
Parte C, nome ed email dell'account di prova cambiati (sì / no):
Parte C, indirizzo già usato rifiutato, messaggio (testo esatto):
Parte C, vecchia sessione chiusa, ingresso con l'indirizzo nuovo e non con il vecchio (sì / no):
Parte C, seconda amministrazione creata con lo strumento (sì / no):
Parte C, proprio nome: rifiutato senza password e con password errata, nome invariato (sì / no), messaggi (testo esatto):
Parte C, propri ruoli: rifiutati senza password e con password errata, ruoli invariati (sì / no):
Parte C, propria password: rifiutata con password attuale errata, poi cambiata (sì / no), messaggio (testo esatto):
Parte C, propria riga senza reimpostazione né disattivazione (sì / no):
Parte C, proprio indirizzo cambiato, sessione chiusa, ingresso con l'indirizzo nuovo e non con il vecchio (sì / no):
Parte C, blocco dei tentativi comparso (sì / no, messaggio):
Parte C, seconda amministrazione disattivata alla fine (sì / no):
Parte C, registro con le modifiche e senza indirizzi né password (sì / no):
Valori riservati visibili (sì / no):
Contenuti toccati (titolo o indirizzo):
```

Se un passo non si può fare, scrivilo accanto al campo: non serve interpretarlo.
