# HO-010 — Prova a vista del trascinamento «dentro» e «accanto»

> **Chiuso il 2026-10-07:** «HO-010: resa approvata».

Scritto il 2026-10-06, alla fine della wave `1D-W9b` (DR-082, DR-084, DR-085,
DR-097). È lavoro visivo: le prove automatiche dicono che il gesto funziona, non
che si **capisca** prima del rilascio. Serve il tuo sguardo.

## Prerequisiti

- Docker Desktop avviato, con `amoris-dev-db-1` e `amoris-dev-objects-1` attivi.
- L'account locale di HO-009.
- **Attenzione:** il database locale contiene i contenuti importati. Le prove
  qui sotto spostano davvero voci di menu e blocchi. Per non toccare il menu
  vero, crea due voci di prova e cancellale alla fine; per i blocchi, usa una
  **pagina nuova** creata con «Nuova pagina».

## Passi

1. Dalla radice del repository: `pnpm dev`, poi apri `http://localhost:3001` e
   accedi nell'area **Redazione**.
2. **Menu.** Apri «Menu», aggiungi due voci con un indirizzo inventato (per
   esempio «Prova A» e «Prova B», indirizzo `/prova/`).
   - Prendi «Prova B» dalla maniglia `⠿` e portala lentamente su «Prova A»:
     - nella **fascia alta** della riga deve comparire una linea **sopra**: andrà prima, allo stesso livello;
     - al **centro** la riga si evidenzia e la linea **rientra a destra**: andrà dentro, come sottovoce;
     - nella **fascia bassa** una linea **sotto**: andrà dopo.
   - Lasciala al centro: «Prova B» diventa sottovoce di «Prova A».
   - Ora prova a portare «Prova A» dentro «Prova B»: la riga deve diventare
     **rossa** e, lasciata, non deve succedere nulla.
   - Con la tastiera: tab fino alla maniglia di una voce, **barra spaziatrice**,
     **freccia su**, **freccia destra** (dentro) o **sinistra** (accanto),
     **barra spaziatrice** per lasciare, **Esc** per annullare.
   - Alla fine elimina le due voci di prova.
3. **Blocchi.** Crea una pagina con «Nuova pagina», aggiungi un «Separatore» e
   un «Media e testo».
   - Porta il separatore al centro di «Media e testo»: deve entrarci, e
     comparire sotto di esso nell'albero e nell'anteprima.
   - Porta «Media e testo» sopra il separatore: la fascia «dentro» non esiste,
     perché un separatore non può contenere nulla.
   - Elimina la pagina di prova, o lasciala in bozza.

## Due comportamenti voluti, da non scambiare per difetti

- **Una colonna si sposta solo dentro la sua riga.** Portarla in un'altra riga
  cambierebbe la ripartizione di entrambe: il rilascio è rifiutato, e per
  cambiare le colonne si usa la ripartizione della riga. Quando invece riordini
  le colonne di una stessa riga, la ripartizione segue il nuovo ordine.
- **Con un lettore di schermo** si sentono due voci complementari: la presa e il
  rilascio, annunciati dalla libreria, e durante il movimento la frase che dice
  dove finirà l'elemento.

## Che cosa dirmi

Per ciascuna delle due schermate: si capisce **prima** di lasciare dove finirà
l'elemento? La linea, il rientro, l'evidenza e il rosso del rifiuto sono
abbastanza visibili, in tema chiaro? Se qualcosa non convince, dimmi che cosa:
i ritocchi stanno nei soli colori e spessori.

## Se qualcosa non va

- **La maniglia non prende:** il trascinamento parte dopo 8 pixel di movimento,
  apposta, per non confondersi con i clic sui bottoni.
- **Errore a schermo:** copia il messaggio e la schermata in cui è comparso.

## Come segnalare il completamento

Scrivi, per esempio: `HO-010: resa approvata` oppure `HO-010: <che cosa
cambiare>`.
