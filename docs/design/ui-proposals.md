# Proposte di UI per l'area amministrativa

**Progetto:** Centro per la Famiglia Amoris Laetitia
**Data:** 2026-09-14
**Wave:** `1B-W7`
**Decisioni di riferimento:** DR-018 (l'area amministrativa non deve assomigliare a
WordPress), DR-019 (quattro proposte di UI fra cui l'utente sceglie), DR-028
(le proposte coprono l'intera area amministrativa futura, con il CMS come primo
modulo), DR-030 (la PWA riguarda solo l'area amministrativa).

> Questo documento contiene **quattro proposte alternative in attesa di scelta
> dell'utente**. Nessuna di esse è stata adottata, nessuna è in corso di
> realizzazione e nessuna vincola le fasi successive finché l'utente non ne
> sceglie una e la scelta non è registrata in
> `docs/decisions/decision-register.md`. La raccomandazione in fondo è una
> raccomandazione, non una decisione.

---

## Come leggere questo documento

Le quattro proposte non sono varianti di colore della stessa interfaccia. Sono
**quattro modi diversi di organizzare il lavoro**: cambiano la struttura della
navigazione, la quantità di informazioni per schermata, il carattere visivo e
l'utente a cui si rivolgono per primo.

| # | Nome | In una riga |
|---|---|---|
| 1 | **Scrivania** | Banco di lavoro denso a due colonne di navigazione, per chi entra ogni giorno. |
| 2 | **Accoglienza** | Interfaccia guidata a schede grandi e passi numerati, per chi entra tre volte l'anno. |
| 3 | **Comando** | Nessun menu permanente: si naviga cercando ed eseguendo comandi, con la tastiera. |
| 4 | **Quaderno** | Il documento al centro della pagina, la struttura del sito ad albero a sinistra, i dati a margine. |

Tutte e quattro rispettano gli stessi vincoli non negoziabili:

- **Nessun richiamo a wp-admin**: niente barra nera superiore, niente colonna
  grigio scuro con icone bianche, niente "bacheca a widget", niente terminologia
  WordPress. Si parla di *Pagine*, *Notizie*, *Media*, *Menu*, *Registro delle
  operazioni*, *Impostazioni del sito*.
- **Ruolo attivo sempre visibile e commutabile** in alto a destra, con lo stesso
  nome e la stessa posizione in tutte le schermate.
- **Contenuto riservato riconoscibile senza colore**: etichetta testuale
  `RISERVATO`, bordo spesso sul lato sinistro e icona; il colore è il terzo
  segnale, mai l'unico.
- **Registro delle operazioni** (chi ha fatto cosa e quando) raggiungibile da un
  unico punto coerente in ogni modulo, e mostrato in forma ridotta accanto al
  record che si sta guardando.
- **Mobile utilizzabile**, non solo non rotto: la PWA (DR-030) è l'unico modo in
  cui alcuni volontari useranno l'area.
- **Interfaccia in italiano**; nomi dei token, delle classi e delle variabili in
  inglese.
- **Tema chiaro e tema scuro** completi, con lo stesso significato dei colori.

---

## Criteri di valutazione comuni

Griglia con cui confrontare le quattro proposte. Ogni criterio ha una definizione
operativa, così che il confronto non dipenda dal gusto.

| Criterio | Cosa misura | Come si verifica |
|---|---|---|
| **Leggibilità** | Quanto è facile capire dove si è, cosa si sta guardando e qual è l'azione principale, per un volontario non tecnico. | Prova su compito: "pubblica una pagina" senza istruzioni, con un utente che non ha mai visto l'interfaccia. |
| **Densità informativa** | Quante righe e quanti dati utili stanno in una schermata da 1366×768 senza affaticare. | Conteggio righe di tabella visibili senza scorrere e numero di campi visibili nella schermata di modifica. |
| **Accessibilità** | Contrasto, navigazione da tastiera, bersagli tattili, comprensibilità senza colore, rispetto della riduzione del movimento. | Contrasto calcolato (WCAG 2.2 AA: 4.5:1 testo, 3:1 elementi di interfaccia), percorso completo da sola tastiera, prova in scala di grigi. |
| **Scalabilità ai 9 moduli** | Se la struttura regge quando ai contenuti si aggiungono soci, corsi, agenda, documenti, contabilità, moduli, comunicazioni e statistiche. | Simulazione: la navigazione con 9 moduli e circa 40 sottosezioni resta usabile senza riprogettarla. |
| **Costo per un team di una persona** | Giornate di realizzazione iniziale e peso della manutenzione a regime. | Stima in giornate-uomo per il sistema di design e per il primo modulo, più il costo marginale di un modulo successivo. |
| **Resa su mobile** | Quanto è realmente usabile sotto i 600 px, non solo quanto non si rompe. | Le tre operazioni più frequenti si completano con una mano, senza zoom e senza scorrimento orizzontale. |
| **Distanza da WordPress** | Quanto l'interfaccia è riconoscibilmente altra cosa rispetto a wp-admin (DR-018). | Confronto affiancato: struttura, colori, terminologia, disposizione dei comandi. |

Punteggi da 1 (scarso) a 5 (ottimo) nella tabella comparativa finale.

---

## Proposta 1 — «Scrivania»

### 1. Identità in una frase

È un **banco di lavoro**: due colonne di navigazione sempre presenti (moduli a
sinistra, sezioni del modulo accanto) e tabelle compatte che mostrano molte righe
insieme, pensate per chi entra tutti i giorni e vuole vedere tutto senza aprire
nulla.

### 2. Palette

Blu istituzionale desaturato su grigi freddi. Diverge dal blu Divi `#2EA3F2` del
sito pubblico, che su fondo bianco raggiunge solo 2.75:1 e non è utilizzabile per
testo o bordi: il blu qui proposto ne conserva la famiglia cromatica portandola a
livelli conformi.

**Tema chiaro** — fondo applicazione `#F4F6F9`, superficie delle schede `#FFFFFF`.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#F4F6F9` | Fondo dell'applicazione | — | fondo di riferimento |
| `bg-surface` | `#FFFFFF` | Schede, tabelle, pannelli | 1.1:1 su `bg-app` | separazione decorativa, rinforzata da `border` |
| `text-primary` | `#17212E` | Testo corrente, titoli | 16.2:1 su bianco · 15.0:1 su `bg-app` | supera 4.5:1 |
| `text-secondary` | `#4E5A6B` | Metadati, etichette, date | 7.0:1 su bianco | supera 4.5:1 |
| `border` | `#D7DDE5` | Separatori decorativi fra righe | 1.4:1 su bianco | decorativo: non porta informazione |
| `border-strong` | `#7E8A99` | Bordi di campi, caselle, confini informativi | 3.5:1 su bianco | supera 3:1 |
| `accent` | `#14538F` | Bottone principale, collegamenti, voce attiva | 7.9:1 su bianco | supera 4.5:1 |
| `on-accent` | `#FFFFFF` | Testo sul bottone principale | 7.9:1 su `accent` | supera 4.5:1 |
| `accent-hover` | `#0F3F6D` | Stato premuto e passaggio del puntatore | 10.8:1 su bianco | supera 4.5:1 |
| `focus-ring` | `#0A6FD1` | Anello di focus (spessore 2 px + scostamento 2 px) | 5.0:1 su bianco | supera 3:1 |
| `success` | `#15693F` | Stato "pubblicato", conferme | 6.7:1 su bianco | supera 4.5:1 |
| `warning` | `#8A5200` | Stato "in bozza", avvisi | 6.4:1 su bianco | supera 4.5:1 |
| `danger` | `#A3201A` | Errori, eliminazioni | 7.6:1 su bianco | supera 4.5:1 |
| `restricted` | `#6D28A8` | Marcatore di contenuto riservato | 8.3:1 su bianco | supera 4.5:1 |
| `restricted-ink` | `#4B1C75` | Testo dell'etichetta riservata su fondo `#F2E9FB` | 10.3:1 | supera 4.5:1 |

**Tema scuro** — fondo applicazione `#0F151C`, superficie `#19212B`.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#0F151C` | Fondo dell'applicazione | — | fondo di riferimento |
| `bg-surface` | `#19212B` | Schede e tabelle | 1.1:1 su `bg-app` | separazione decorativa |
| `text-primary` | `#E7ECF2` | Testo corrente | 13.7:1 su `bg-surface` | supera 4.5:1 |
| `text-secondary` | `#A2AFBF` | Metadati | 7.3:1 su `bg-surface` | supera 4.5:1 |
| `border` | `#2E3945` | Separatori decorativi | 1.4:1 | decorativo |
| `border-strong` | `#6C7A8A` | Bordi di campi e confini informativi | 3.7:1 | supera 3:1 |
| `accent` | `#7FB6F0` | Collegamenti, voce attiva, bottone principale | 7.6:1 su `bg-surface` | supera 4.5:1 |
| `on-accent` | `#0F151C` | Testo sul bottone principale | 8.6:1 su `accent` | supera 4.5:1 |
| `focus-ring` | `#7FB6F0` | Anello di focus | 8.6:1 su `bg-app` | supera 3:1 |
| `success` | `#5FD39A` | Stato "pubblicato" | 8.7:1 | supera 4.5:1 |
| `warning` | `#E2A33A` | Stato "in bozza" | 7.4:1 | supera 4.5:1 |
| `danger` | `#F08076` | Errori | 6.2:1 | supera 4.5:1 |
| `restricted` | `#C39BF0` | Marcatore riservato | 7.2:1 | supera 4.5:1 |

### 3. Tipografia

- **Famiglia:** Inter (variabile), **self-hosted** in `woff2` con sottoinsieme
  latino; ripiego `system-ui, "Segoe UI", Roboto, sans-serif`. Cifre tabellari
  attive (`font-variant-numeric: tabular-nums`) su tutte le colonne numeriche e
  sulle date, perché le tabelle sono il cuore di questa proposta.
- **Nessun font secondario**: un solo file riduce il peso e la manutenzione.

| Ruolo | Dimensione | Peso | Interlinea |
|---|---|---|---|
| `text-xs` — etichette di tabella, badge | 0.75 rem (12 px) | 600 | 1.3 |
| `text-sm` — metadati, aiuti in linea | 0.8125 rem (13 px) | 400 | 1.45 |
| `text-base` — corpo, celle, campi | 0.875 rem (14 px) | 400 | 1.5 |
| `text-md` — testo dell'editor | 1 rem (16 px) | 400 | 1.6 |
| `text-lg` — titolo di sezione | 1.125 rem (18 px) | 600 | 1.35 |
| `text-xl` — titolo di schermata | 1.375 rem (22 px) | 600 | 1.3 |
| `text-2xl` — titolo di modulo | 1.75 rem (28 px) | 700 | 1.25 |

Pesi in uso: 400, 500, 600, 700. Nessun peso 300: sotto i 14 px è illeggibile per
gli utenti più anziani.

### 4. Griglia e spaziatura

- **Unità di base:** 4 px.
- **Scala di spaziatura:** 4, 8, 12, 16, 24, 32, 48, 64.
- **Larghezze:** barra dei moduli 56 px (sola icona con etichetta al passaggio);
  colonna delle sezioni 240 px (richiudibile a 0); area di lavoro fluida con
  larghezza massima 1440 px; pannello di ispezione a destra 320 px.
- **Altezza di riga:** 36 px in densità compatta, 44 px in densità comoda;
  l'utente sceglie e la scelta è ricordata. **Il valore predefinito è "comoda"**.
- **Breakpoint:** 600 px, 900 px, 1200 px, 1600 px.

### 5. Trattamento dei componenti

- **Navigazione:** due colonne permanenti. La prima elenca i nove moduli come
  icone con etichetta testuale al passaggio e alla messa a fuoco; la seconda
  elenca le sezioni del modulo attivo, raggruppate sotto intestazioni in
  maiuscoletto. La voce attiva ha una barra piena a sinistra spessa 3 px più il
  peso 600: riconoscibile anche senza colore. In alto, una barra chiara (mai
  scura) con briciole di pane, campo di ricerca e selettore di ruolo.
- **Tabelle ed elenchi lunghi:** intestazione fissa allo scorrimento,
  ordinamento sulle intestazioni, selezione multipla con casella, barra delle
  azioni di gruppo che compare al posto della barra dei filtri quando c'è una
  selezione. Impaginazione numerata con scelta degli elementi per pagina;
  caricamento progressivo solo nelle liste di media. Righe a zebratura assente e
  separatori sottili: la densità viene dalla tipografia, non dal colore.
- **Form:** due colonne su schermo largo (contenuto a sinistra, attributi a
  destra), una colonna sotto 900 px. Etichetta sempre sopra il campo, mai dentro.
  Testo di aiuto sotto il campo, permanente. Salvataggio con barra fissa in basso
  che indica sempre lo stato ("Salvato 2 minuti fa", "Modifiche non salvate").
- **Bottoni:** rettangolo con raggio 4 px, altezza 36 px (compatto) o 40 px.
  Principale pieno `accent`; secondario con bordo `border-strong`; terziario di
  solo testo sottolineato al passaggio. Il distruttivo è secondario con testo
  `danger` e chiede conferma digitata per le eliminazioni definitive.
- **Badge di stato:** pastiglia con bordo 1 px, testo in maiuscoletto 12 px e
  puntino pieno a sinistra; il testo dice sempre lo stato ("Pubblicata",
  "Bozza", "Programmata"), il colore lo accompagna.
- **Modali:** usate solo per conferme brevi e per scelte che bloccano; tutto il
  resto è un pannello laterale che scorre da destra (larghezza 480 px) e non
  nasconde la tabella. Fuoco intrappolato, chiusura con Esc, ritorno del fuoco
  all'elemento che l'ha aperta.
- **Notifiche:** striscia sotto la barra superiore per gli esiti delle azioni
  (persistente fino a chiusura per gli errori, 6 secondi per le conferme);
  nessun avviso che copre i comandi. Le notifiche non sono mai l'unico posto in
  cui compare un errore.
- **Stato vuoto:** titolo, una frase che spiega cosa contiene la sezione,
  bottone principale di creazione e collegamento alla guida. Mai solo un disegno.
- **Stato di errore:** riquadro con bordo `danger` spesso 2 px a sinistra, icona,
  titolo dell'errore, spiegazione in italiano corrente e azione di recupero. Gli
  errori di campo compaiono sotto il campo e il campo prende bordo `danger` più
  icona.
- **Indicatore di ruolo attivo:** in alto a destra, pastiglia con etichetta
  `Ruolo: REDAZIONE` e freccia; il menu elenca solo i ruoli posseduti, con una
  riga che descrive cosa cambia. Al cambio di ruolo la barra superiore mostra per
  4 secondi una striscia con il nuovo ruolo, e la colonna delle sezioni si
  ricompone. Nei ruoli con poteri estesi (amministratore) la pastiglia ha bordo
  spesso 2 px.
- **Marcatore di contenuto riservato:** barra piena `restricted` spessa 4 px sul
  bordo sinistro della riga o della scheda, etichetta testuale `RISERVATO` e
  icona di lucchetto. Nella schermata di modifica, l'intero pannello di
  visibilità assume fondo `#F2E9FB` con testo `restricted-ink`. Una riga fissa
  ricorda chi può vedere il record.

### 6. Mockup ASCII


**Elenco delle pagine del CMS** (schermo largo, densità comoda). `(R)` segnala il
contenuto riservato; nell'interfaccia reale è barra colorata più etichetta
`RISERVATO` più lucchetto.

```
+------------------------------------------------------------------------------------------------+
| Amoris - Area di gestione     [ Cerca o esegui un comando ]       Ruolo: REDAZIONE v   AB      |
+-----+------------------------+-----------------------------------------------------------------+
| [C] | CONTENUTI              | Pagine                                        [ + Nuova pagina ]|
| [S] | - Pagine            24 | 24 pagine - 3 bozze - 1 riservata                               |
| [E] | - Notizie           58 |                                                                 |
| [A] | - Media            312 | [ Cerca ]  [Stato: tutti v]  [Autore v]  [Ordina: modifica v]   |
| [D] | - Menu               4 | --------------------------------------------------------------  |
| [B] | - SEO e redirect       |   TITOLO                      PERCORSO        STATO    MODIF.   |
| [F] | - Impostazioni         | --------------------------------------------------------------  |
| [M] |                        | [ ] Chi siamo                 /chi-siamo      Pubbl.   12/09    |
| [G] | GESTIONE               | [ ] Servizi alla famiglia     /servizi        Pubbl.   11/09    |
|     | - Soci e volontari     | [ ] Corsi 2027                /corsi-2027     Bozza    10/09    |
|     | - Corsi ed eventi      | [ ] Equipe clinica            /equipe         Pubbl.   09/09    |
|     | - Appuntamenti         | [ ] Note interne     (R)      /note-interne   Privata  09/09    |
|     | - Documenti            | [ ] Dove siamo                /contatti       Pubbl.   05/09    |
|     | - Contabilita          | --------------------------------------------------------------  |
|     | - Moduli e risposte    | Selezionate: 0                        < 1 2 3 >   25 per pagina |
|     | - Comunicazioni        |                                                                 |
|     | - Statistiche          | (R) = contenuto riservato: bordo spesso + etichetta             |
+-----+------------------------+-----------------------------------------------------------------+
| Registro: M. Rossi ha pubblicato la pagina Servizi - 11/09 16:40            [ Apri registro ]  |
+------------------------------------------------------------------------------------------------+
```

**Modifica di una pagina.** Il contenuto a sinistra, gli attributi a destra, il
registro delle modifiche in coda al pannello, la barra di salvataggio sempre
visibile in basso.

```
+------------------------------------------------------------------------------------------------+
| Contenuti / Pagine / Chi siamo                  Bozza non salvata       Ruolo: REDAZIONE v     |
+-----+------------------------------------------------+-----------------------------------------+
| [C] | Titolo                                         | PUBBLICAZIONE                           |
| [S] | [ Chi siamo                                ]   | Stato    [ Bozza v ]                    |
| [E] |                                                | Data     [ 14/09/2026 ] [ 09:00 ]       |
| [A] | Percorso  /chi-siamo           [ Modifica ]    | Autore   M. Rossi                       |
| [D] | ---------------------------------------------  | --------------------------------------  |
| [B] | [ G ] [ C ] [ Titolo v ] [ link ] [ imm. ]     | VISIBILITA                              |
| [F] | ---------------------------------------------  | ( ) Pubblica                            |
| [M] | Il Centro per la Famiglia accompagna le        | ( ) Solo utenti autenticati             |
| [G] | coppie e i genitori del territorio con         | (o) RISERVATO - segreteria e            |
|     | ascolto, consulenza e percorsi di gruppo.      |     amministrazione                     |
|     |                                                | --------------------------------------  |
|     | ## La nostra storia                            | SEO                                     |
|     |                                                | Titolo   [ Chi siamo - Centro   ]       |
|     | Nata nel 2011 su iniziativa di un gruppo di    | Descriz. [ Chi siamo e come     ]       |
|     | volontari, offre oggi quattro servizi stabili. |          [ lavoriamo            ]       |
|     |                                                | --------------------------------------  |
|     | [ Blocco immagine: sede-esterno.jpg ]          | REGISTRO DELLE MODIFICHE                |
|     |                                                | 14/09 09:12  A. Bianchi - bozza         |
|     | + Aggiungi blocco                              | 12/09 17:03  M. Rossi - pubblicaz.      |
|     |                                                | [ Registro completo ]                   |
+-----+------------------------------------------------+-----------------------------------------+
| [ Salva bozza ]   [ Anteprima ]             Salvato 2 minuti fa           [ Pubblica ]         |
+------------------------------------------------------------------------------------------------+
```

### 7. Resa su mobile

Sotto i 600 px le due colonne di navigazione scompaiono. Restano: una barra
superiore con titolo della sezione, pulsante menu e selettore di ruolo; una barra
inferiore con i quattro moduli più usati più «Altro»; le tabelle diventano schede
impilate che mostrano tre informazioni (titolo, percorso, stato + data + autore)
e aprono il dettaglio con un tocco. I filtri diventano un pannello a comparsa dal
basso. La barra di salvataggio resta ancorata sopra la barra inferiore. La
selezione multipla è disponibile con pressione prolungata.

```
+----------------------------------------+
| [=] Pagine              REDAZIONE v    |
+----------------------------------------+
| [ Cerca ]              [ Filtri (1) ]  |
+----------------------------------------+
| Chi siamo                              |
| /chi-siamo                             |
| Pubbl. - 12/09 - M. Rossi              |
+----------------------------------------+
| Corsi 2027                             |
| /corsi-2027                            |
| Bozza - 10/09 - A. Bianchi             |
+----------------------------------------+
| || Note interne            (R)         |
| || /note-interne                       |
| || Privata - 09/09 - Segreteria        |
+----------------------------------------+
|           [ + Nuova pagina ]           |
+----------------------------------------+
| [Contenuti] [Soci] [Agenda] [Altro]    |
+----------------------------------------+
```

### 8. Accessibilità

- **Focus visibile:** anello `focus-ring` spesso 2 px con scostamento 2 px, mai
  rimosso, visibile anche sopra i bottoni pieni grazie a un doppio anello
  (interno chiaro, esterno scuro). L'ordine di tabulazione segue l'ordine visivo;
  un collegamento «Vai al contenuto» è il primo elemento focalizzabile.
- **Bersagli tattili:** minimo 44×44 px su tocco anche in densità compatta (la
  riga resta 36 px ma l'area attiva è estesa); spaziatura minima 8 px fra
  bersagli adiacenti.
- **Senza colore:** ogni stato ha testo ed è distinguibile per forma (puntino,
  bordo, peso tipografico). La prova di controllo è la schermata in scala di
  grigi: deve restare comprensibile.
- **Movimento:** transizioni 120–180 ms, solo opacità e traslazione;
  `prefers-reduced-motion: reduce` azzera scorrimenti e animazioni dei pannelli,
  che compaiono istantaneamente.
- **Testo scalabile:** tutto in `rem`; l'interfaccia regge lo zoom al 200 % senza
  scorrimento orizzontale (le colonne meno importanti della tabella si nascondono
  progressivamente).

### 9. Costo e rischio

- **Librerie proposte:** Radix UI Primitives (componenti non stilizzati e
  accessibili: menu, dialoghi, pannelli, selettori) + TanStack Table v8 (solo
  logica di tabella) + CSS con token in variabili native. Nessuna libreria di
  componenti "vestita": lo stile è interamente nostro, quindi nessun rischio di
  somiglianza con altri gestionali.
- **Costo iniziale (ordine di grandezza, da confermare in fase di piano):** 5–7
  giornate per il sistema di design e i componenti di base, 20–25 giornate per il
  modulo CMS completo.
- **Costo marginale di un modulo successivo:** basso. Elenco + filtri + dettaglio
  + pannello di ispezione sono gli stessi mattoni ovunque: 3–5 giornate a modulo
  di sola composizione.
- **Manutenzione:** bassa. Poche astrazioni, un solo font, nessun aggiornamento
  di libreria visiva che possa cambiare l'aspetto.
- **Rischio principale:** la densità può intimidire il volontario che entra due
  volte l'anno. Mitigazione: densità "comoda" come valore predefinito, stati
  vuoti che spiegano, e testi di aiuto permanenti sotto i campi.
- **Rischio secondario:** due colonne di navigazione tolgono 296 px di larghezza;
  su schermi da 1280 px l'area di lavoro resta accettabile ma non generosa.
  Mitigazione: colonna delle sezioni richiudibile con memoria della scelta.

---

## Proposta 2 — «Accoglienza»

### 1. Identità in una frase

È un'interfaccia **guidata e a bassa densità**: niente colonne di navigazione, ma
poche schede grandi e percorsi a passi numerati che accompagnano chi usa l'area
raramente e non vuole imparare nulla prima di cominciare.

### 2. Palette

Colori caldi e naturali, lontani tanto dal blu di WordPress quanto dal blu Divi
del sito pubblico: la divergenza è deliberata e serve a segnalare che si è "dietro
le quinte" e non sul sito. Il verde salvia profondo è il colore d'azione; il
terracotta è l'accento che richiama l'attenzione senza gridare.

**Tema chiaro** — fondo `#FAF6F1` (avorio caldo), superficie `#FFFFFF`.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#FAF6F1` | Fondo dell'applicazione | — | fondo di riferimento |
| `bg-surface` | `#FFFFFF` | Schede | 1.1:1 su `bg-app` | separazione decorativa, rinforzata da ombra e bordo |
| `text-primary` | `#2B2420` | Testo corrente e titoli | 15.3:1 su bianco · 14.2:1 su `bg-app` | supera 4.5:1 |
| `text-secondary` | `#5F5349` | Metadati e descrizioni | 7.4:1 su bianco | supera 4.5:1 |
| `border` | `#E6DCCF` | Separatori decorativi | 1.4:1 su bianco | decorativo |
| `border-strong` | `#93856F` | Bordi dei campi e delle schede | 3.6:1 su bianco | supera 3:1 |
| `primary` | `#2F6154` | Bottone principale, voce attiva | 7.1:1 su bianco | supera 4.5:1 |
| `on-primary` | `#FFFFFF` | Testo sul bottone principale | 7.1:1 su `primary` | supera 4.5:1 |
| `primary-hover` | `#24493F` | Passaggio del puntatore e pressione | 10.0:1 su bianco | supera 4.5:1 |
| `accent` | `#A8471A` | Passo corrente, evidenziazioni, anello di focus | 5.9:1 su bianco · 5.4:1 su `bg-app` | supera 4.5:1 |
| `on-accent` | `#FFFFFF` | Testo su accento pieno | 5.9:1 su `accent` | supera 4.5:1 |
| `success` | `#2E6B41` | Conferme, stato "online" | 6.4:1 su bianco | supera 4.5:1 |
| `warning` | `#8A5A00` | Stato "bozza" | 5.9:1 su bianco | supera 4.5:1 |
| `danger` | `#A32015` | Errori ed eliminazioni | 7.6:1 su bianco | supera 4.5:1 |
| `restricted` | `#6B3E86` | Marcatore di contenuto riservato | 7.9:1 su bianco | supera 4.5:1 |

**Tema scuro** — fondo `#1A1613`, superficie `#241F1A`.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#1A1613` | Fondo | — | fondo di riferimento |
| `bg-surface` | `#241F1A` | Schede | 1.1:1 su `bg-app` | separazione decorativa |
| `text-primary` | `#F0E9E1` | Testo corrente | 13.6:1 su `bg-surface` | supera 4.5:1 |
| `text-secondary` | `#BCAE9F` | Metadati | 7.5:1 | supera 4.5:1 |
| `border` | `#3A322A` | Separatori decorativi | 1.3:1 | decorativo |
| `border-strong` | `#8B7C6A` | Bordi dei campi | 4.0:1 | supera 3:1 |
| `primary` | `#7FC0AE` | Bottone principale e voce attiva | 7.8:1 | supera 4.5:1 |
| `on-primary` | `#1A1613` | Testo sul bottone principale | 8.6:1 su `primary` | supera 4.5:1 |
| `accent` | `#E39A62` | Passo corrente, focus | 7.0:1 | supera 4.5:1 |
| `success` | `#86CF9F` | Conferme | 8.9:1 | supera 4.5:1 |
| `warning` | `#E6B44E` | Stato "bozza" | 8.6:1 | supera 4.5:1 |
| `danger` | `#F58C7E` | Errori | 6.9:1 | supera 4.5:1 |
| `restricted` | `#C7A2DE` | Marcatore riservato | 7.5:1 | supera 4.5:1 |

### 3. Tipografia

- **Famiglia:** **Open Sans**, **self-hosted** in `woff2` (pesi 400, 600, 700),
  la stessa del sito pubblico. È l'unica proposta che mantiene la continuità
  tipografica con il sito: chi gestisce e chi legge vedono le stesse forme, e il
  carattere è già familiare ai volontari. Il peso 300 del tema Divi **non** viene
  importato: troppo sottile per un'interfaccia.
- Ripiego `system-ui, "Segoe UI", Roboto, sans-serif`.

| Ruolo | Dimensione | Peso | Interlinea |
|---|---|---|---|
| `text-sm` — note e aiuti | 0.875 rem (14 px) | 400 | 1.55 |
| `text-base` — corpo e campi | 1.0625 rem (17 px) | 400 | 1.6 |
| `text-lg` — titolo di scheda | 1.25 rem (20 px) | 600 | 1.4 |
| `text-xl` — titolo di sezione | 1.5 rem (24 px) | 600 | 1.35 |
| `text-2xl` — titolo di schermata | 1.875 rem (30 px) | 700 | 1.25 |
| `text-3xl` — titolo di modulo | 2.25 rem (36 px) | 700 | 1.2 |

Il corpo a 17 px è una scelta deliberata: l'utenza comprende volontari con vista
affaticata e il testo dell'interfaccia deve essere leggibile senza zoom.

### 4. Griglia e spaziatura

- **Unità di base:** 8 px.
- **Scala di spaziatura:** 8, 16, 24, 32, 48, 64, 96.
- **Larghezze:** contenuto centrato con larghezza massima 960 px; griglia di
  schede a 2 colonne da 900 px in su, 3 colonne oltre 1400 px, 1 colonna sotto;
  scheda con larghezza minima 320 px e altezza minima 128 px.
- **Barra dei moduli** orizzontale in alto, alta 48 px, con le voci dei nove
  moduli; oltre lo spazio disponibile le ultime confluiscono in «Altro».
- **Breakpoint:** 600 px, 900 px, 1200 px, 1400 px.

### 5. Trattamento dei componenti

- **Navigazione:** schede orizzontali in alto per i moduli, nessuna colonna
  laterale. Dentro il modulo si naviga per **schede di sezione**, non per menu:
  la prima schermata del modulo elenca "Pagine", "Notizie", "Media", "Menu" come
  riquadri con una frase di spiegazione e il conteggio. La posizione corrente è
  segnata da briciole di pane testuali grandi.
- **Tabelle ed elenchi lunghi:** non esistono tabelle nella vista predefinita.
  Gli elenchi sono **schede** con titolo, stato in parole, data, autore e due
  bottoni espliciti. È disponibile una «vista elenco compatto» per chi ha molti
  record, ma non è il valore predefinito. Impaginazione con «Mostra altre 20»,
  mai numeri di pagina.
- **Form:** una sola colonna, campi larghi, un **percorso a passi numerati**
  (1 Contenuto → 2 Aspetto → 3 Chi la vede → 4 Pubblica) sempre visibile in alto,
  con indicazione «passo 1 di 4». Ogni campo ha etichetta grande sopra e una
  frase che spiega a cosa serve. Salvataggio automatico con messaggio in chiaro.
- **Bottoni:** altezza 48 px, raggio 8 px, testo 17 px con verbo esplicito
  («Pubblica la pagina», non «OK»). Principale pieno `primary`; secondario con
  bordo `border-strong` spesso 2 px. Il distruttivo è sempre separato dagli altri
  e richiede una conferma che ripete il nome dell'elemento.
- **Badge di stato:** parole, non pastiglie minute: «Pubblicata», «In bozza —
  non è online», «Programmata per il 20/09», con icona a sinistra e colore di
  supporto.
- **Modali:** solo per conferme distruttive. Tutto il resto avviene in pagina,
  perché la finestra sovrapposta confonde chi non usa spesso il computer.
- **Notifiche:** messaggio in cima al contenuto, non fluttuante, con testo lungo
  e comprensibile («La pagina Chi siamo è ora online. Puoi vederla sul sito»),
  con collegamento all'azione successiva. Nessuna notifica che sparisce da sola
  quando riporta un errore.
- **Stato vuoto:** grande, con titolo, spiegazione di due righe, esempio di cosa
  si può fare e un solo bottone. È trattato come una schermata di benvenuto.
- **Stato di errore:** riquadro con fondo tenue e bordo `danger` 2 px, che dice
  cosa è andato storto, che cosa non è stato salvato e quale è il passo
  successivo. Nessun codice tecnico in primo piano; il dettaglio tecnico è dietro
  «Mostra dettagli» per chi deve segnalarlo.
- **Indicatore di ruolo attivo:** frase esplicita in alto a destra — «Sto
  operando come: **REDAZIONE**» — con menu che descrive ogni ruolo in una riga
  («Tesoreria: registri i movimenti e chiudi il rendiconto»). Il cambio di ruolo
  ricarica la barra dei moduli e mostra un messaggio in cima.
- **Marcatore di contenuto riservato:** intestazione della scheda con etichetta
  `*** RISERVATA ***` in maiuscolo, bordo `restricted` su tutti e quattro i lati
  spesso 2 px, icona di lucchetto e, sotto, la frase «Visibile solo a segreteria
  e amministrazione» con un bottone «Chi può vederla».

### 6. Mockup ASCII

**Elenco delle pagine del CMS.** Schede grandi, due per riga, azioni esplicite.

```
+----------------------------------------------------------------------------------------+
| CENTRO AMORIS LAETITIA - Gestione                 Sto operando come: REDAZIONE v       |
|  Contenuti | Persone | Corsi | Agenda | Documenti | Conti | Altro                      |
+----------------------------------------------------------------------------------------+
|                                                                                        |
|   Pagine del sito                                                                      |
|   Sono le pagine fisse: chi siamo, servizi, contatti.                                  |
|                                                                                        |
|   [ Cerca una pagina...                          ]   [ + Crea una pagina ]             |
|                                                                                        |
+------------------------------------------+------------------------------------------+
| Chi siamo                                | Servizi alla famiglia                    |
| Pubblicata - aggiornata il 12/09         | Pubblicata - aggiornata l 11/09          |
| da Maria Rossi                           | da Maria Rossi                           |
|                                          |                                          |
| [ Modifica ]  [ Vedi sul sito ]          | [ Modifica ]  [ Vedi sul sito ]          |
+------------------------------------------+------------------------------------------+
| Corsi 2027                               | Note interne      *** RISERVATA ***      |
| BOZZA - non e online                     | Visibile solo a segreteria e             |
| aggiornata il 10/09 da Anna Bianchi      | amministrazione - aggiornata 09/09       |
|                                          |                                          |
| [ Riprendi ]  [ Elimina ]                | [ Modifica ]  [ Chi puo vederla ]        |
+------------------------------------------+------------------------------------------+
|                                                                                        |
|   Mostrate 4 pagine su 24     [ Mostra altre 20 ]                                      |
+----------------------------------------------------------------------------------------+
```

**Modifica di una pagina.** Percorso a quattro passi, una colonna, aiuto in linea.

```
+----------------------------------------------------------------------------------------+
| < Torna alle pagine                               Sto operando come: REDAZIONE v       |
+----------------------------------------------------------------------------------------+
|                                                                                        |
|   Modifica la pagina Chi siamo                                                         |
|                                                                                        |
|    (1) CONTENUTO  -->  (2) Aspetto  -->  (3) Chi la vede  -->  (4) Pubblica            |
|    passo 1 di 4                                                                        |
|                                                                                        |
+----------------------------------------------------------------------------------------+
|                                                                                        |
|   Titolo della pagina                                                                  |
|   [ Chi siamo                                                        ]                 |
|   Comparira in cima alla pagina e nel menu del sito.                                   |
|                                                                                        |
|   Testo                                                                                |
|   [ G ]  [ C ]  [ Titolo ]  [ Elenco ]  [ Collegamento ]  [ Immagine ]                 |
|   +--------------------------------------------------------------+                     |
|   | Il Centro per la Famiglia accompagna le coppie e i           |                     |
|   | genitori del territorio con ascolto, consulenza e            |                     |
|   | percorsi di gruppo.                                          |                     |
|   |                                                              |                     |
|   | La nostra storia                                             |                     |
|   | Nata nel 2011 su iniziativa di un gruppo di volontari.       |                     |
|   +--------------------------------------------------------------+                     |
|                                                                                        |
|   Hai bisogno di aiuto?  [ Come si scrive una buona pagina ]                           |
|                                                                                        |
+----------------------------------------------------------------------------------------+
|   [ Salva e continua dopo ]                       [ Avanti: Aspetto > ]                |
|   Salvato automaticamente 2 minuti fa.                                                 |
+----------------------------------------------------------------------------------------+
```

### 7. Resa su mobile

È la proposta che cambia meno sotto i 600 px, perché nasce già a una colonna: le
schede diventano a piena larghezza, la barra dei moduli diventa un menu a
comparsa, il percorso a passi si dispone in verticale come elenco numerato con il
passo corrente evidenziato. I bottoni restano alti 48 px e il bottone principale
si ancora in fondo allo schermo. Nessuna tabella da far scorrere lateralmente.

```
+----------------------------------------+
|   < Pagine                             |
|   REDAZIONE v                          |
+----------------------------------------+
|                                        |
|   Modifica Chi siamo                   |
|                                        |
|   (1) CONTENUTO                        |
|   (2) Aspetto                          |
|   (3) Chi la vede                      |
|   (4) Pubblica                         |
|   passo 1 di 4                         |
+----------------------------------------+
|                                        |
|   Titolo della pagina                  |
|   [ Chi siamo                    ]     |
|                                        |
|   Testo                                |
|   [G] [C] [Titolo] [Elenco] [...]      |
|   +----------------------------+       |
|   | Il Centro per la Famiglia  |       |
|   | accompagna le coppie e i   |       |
|   | genitori del territorio.   |       |
|   +----------------------------+       |
|                                        |
+----------------------------------------+
|         [ Avanti: Aspetto > ]          |
|          Salvato 2 minuti fa           |
+----------------------------------------+
```

### 8. Accessibilità

- **Focus visibile:** anello `accent` spesso 3 px con scostamento 2 px — più
  marcato delle altre proposte, perché l'utenza usa poco la tastiera e quando la
  usa deve trovarsi subito.
- **Bersagli tattili:** minimo 48×48 px ovunque, spaziatura minima 12 px. È la
  proposta con i bersagli più generosi.
- **Senza colore:** gli stati sono frasi complete; il colore non aggiunge
  informazione, la rinforza. In scala di grigi non si perde nulla.
- **Movimento:** nessuna animazione se non la comparsa dei messaggi (150 ms in
  opacità); `prefers-reduced-motion` la elimina. Nessun effetto di scorrimento
  automatico.
- **Testo scalabile:** base 17 px, tutto in `rem`; al 200 % la pagina resta a una
  colonna senza perdite, perché la larghezza massima è già contenuta.

### 9. Costo e rischio

- **Librerie proposte:** shadcn/ui (Radix + Tailwind, componenti copiati nel
  progetto e non installati come dipendenza) per partire in fretta, con
  **ridefinizione obbligatoria di colori, raggi, altezze e tipografia**: senza
  quella ridefinizione l'interfaccia assume l'aspetto generico riconoscibile di
  molti progetti recenti. Costo di adozione per un team di una persona: basso
  all'inizio, ma ogni componente copiato diventa codice da mantenere.
- **Costo iniziale:** 4–6 giornate per il sistema di design, 18–22 giornate per
  il CMS.
- **Costo marginale di un modulo successivo:** **alto**. I percorsi guidati non
  si riusano: ogni modulo richiede di progettare i propri passi. Si stimano 6–9
  giornate a modulo, contro le 3–5 di una interfaccia a elenco e dettaglio.
- **Manutenzione:** media. Molte schermate, ognuna con testi propri da tenere
  aggiornati.
- **Rischio principale:** **non regge la contabilità e le anagrafiche**. Prima
  nota, movimenti bancari, libro soci e presenze richiedono di vedere molte righe
  insieme; con le schede servirebbe comunque una vista tabellare, che è un
  secondo sistema da progettare e mantenere.
- **Rischio secondario:** chi usa l'area tutti i giorni la troverà lenta — molti
  clic per operazioni che altrove sono una riga di tabella.

---


## Proposta 3 — «Comando»

### 1. Identità in una frase

**Non c'è nessun menu permanente**: si arriva ovunque scrivendo, da un'unica
barra di comando richiamabile con `Ctrl+K`, e l'intera schermata è dedicata ai
dati — una interfaccia quasi monocromatica, molto densa, pensata per chi lavora
di tastiera e per un'area che dovrà contenere nove moduli senza far crescere
alcun menu.

### 2. Palette

Quasi assenza di colore: nero, bianco e una scala di grigi neutri, con **un solo
colore d'azione** blu elettrico. Il colore compare solo dove significa qualcosa
— selezione, stato, riservatezza — e per questo si nota. È la proposta più
lontana dal blu Divi e la più lontana dall'immaginario WordPress.

**Tema chiaro** — fondo `#FFFFFF`, superficie secondaria `#F6F6F7`.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#FFFFFF` | Fondo dell'applicazione | — | fondo di riferimento |
| `bg-subtle` | `#F6F6F7` | Intestazioni di tabella, barra di stato, righe alternate | 1.1:1 su bianco | decorativo |
| `text-primary` | `#0A0A0B` | Testo corrente | 19.8:1 su bianco | supera 4.5:1 |
| `text-secondary` | `#5C5C63` | Metadati, scorciatoie, etichette | 6.6:1 su bianco | supera 4.5:1 |
| `border` | `#E3E3E6` | Separatori decorativi | 1.3:1 | decorativo |
| `border-strong` | `#8A8A90` | Bordi dei campi, riquadro della barra di comando | 3.4:1 su bianco | supera 3:1 |
| `accent` | `#0B4FD4` | Riga selezionata, bottone principale, collegamenti, focus | 6.8:1 su bianco | supera 4.5:1 |
| `on-accent` | `#FFFFFF` | Testo su accento pieno | 6.8:1 su `accent` | supera 4.5:1 |
| `accent-hover` | `#0940AC` | Pressione | 9.0:1 su bianco | supera 4.5:1 |
| `success` | `#17643C` | Stato "pubblicata" | 7.2:1 su bianco | supera 4.5:1 |
| `warning` | `#7E5300` | Stato "bozza" | 6.7:1 su bianco | supera 4.5:1 |
| `danger` | `#B01B14` | Errori, comandi distruttivi nella palette | 7.0:1 su bianco | supera 4.5:1 |
| `restricted` | `#5B2FAF` | Marcatore riservato | 8.5:1 su bianco | supera 4.5:1 |

**Tema scuro** — fondo `#0A0A0B`, superficie `#151517`. In questa proposta il
tema scuro è il più curato: è il modo in cui verrà usata più spesso.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#0A0A0B` | Fondo | — | fondo di riferimento |
| `bg-subtle` | `#151517` | Intestazioni, barra di stato | 1.1:1 su `bg-app` | decorativo |
| `text-primary` | `#F5F5F6` | Testo corrente | 16.7:1 su `bg-subtle` | supera 4.5:1 |
| `text-secondary` | `#A4A4AC` | Metadati e scorciatoie | 7.4:1 | supera 4.5:1 |
| `border` | `#2A2A2F` | Separatori decorativi | 1.3:1 | decorativo |
| `border-strong` | `#77777E` | Bordi dei campi | 4.1:1 | supera 3:1 |
| `accent` | `#8AB0FF` | Selezione, collegamenti, focus | 8.5:1 | supera 4.5:1 |
| `on-accent` | `#0A0A0B` | Testo su accento pieno | 9.2:1 su `accent` | supera 4.5:1 |
| `success` | `#5CCB92` | Stato "pubblicata" | 9.0:1 | supera 4.5:1 |
| `warning` | `#E0A83C` | Stato "bozza" | 8.5:1 | supera 4.5:1 |
| `danger` | `#FF8B80` | Errori | 8.0:1 | supera 4.5:1 |
| `restricted` | `#B79BFF` | Marcatore riservato | 7.9:1 | supera 4.5:1 |

### 3. Tipografia

- **Famiglia di interfaccia:** nessun font scaricato. Pila di sistema
  `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`.
  È l'unica proposta **senza font self-hosted**: zero richieste di rete, nessuno
  spostamento di impaginazione al caricamento, nessun file da mantenere.
- **Famiglia monospaziata:** JetBrains Mono, **self-hosted** con sottoinsieme
  ridotto (cifre, lettere, punteggiatura), usata per percorsi, identificativi,
  importi, date e scorciatoie: è il segno distintivo di questa proposta.

| Ruolo | Dimensione | Peso | Interlinea |
|---|---|---|---|
| `text-xs` — scorciatoie, barra di stato | 0.75 rem (12 px) | 400 | 1.3 |
| `text-sm` — intestazioni di colonna, metadati | 0.8125 rem (13 px) | 500 | 1.4 |
| `text-base` — celle, campi, corpo | 0.875 rem (14 px) | 400 | 1.45 |
| `text-md` — testo dell'editor | 1 rem (16 px) | 400 | 1.6 |
| `text-lg` — titolo di schermata | 1.125 rem (18 px) | 600 | 1.3 |
| `text-xl` — titolo di documento | 1.5 rem (24 px) | 600 | 1.25 |

Pesi: 400, 500, 600. Nessun peso 700: il rilievo si ottiene con il contrasto,
non con il nero tipografico.

### 4. Griglia e spaziatura

- **Unità di base:** 4 px, con mezzi passi ammessi (2 px) nelle tabelle.
- **Scala di spaziatura:** 2, 4, 8, 12, 16, 24, 32, 48.
- **Larghezze:** nessuna colonna fissa; il contenuto occupa tutta la larghezza
  fino a 1600 px. Pannello degli attributi 320 px, apribile e richiudibile con
  `Tab` o `Ctrl+I`. Barra di comando 640 px centrata, sovrapposta.
- **Altezza di riga:** 28 px (compattissima) o 32 px; intestazione di tabella
  24 px. È la proposta con la densità più alta: circa 22 righe visibili su
  1366×768.
- **Barre fisse:** barra superiore 40 px (briciole di pane + ruolo), barra di
  stato inferiore 28 px con le scorciatoie disponibili nel contesto corrente.
- **Breakpoint:** 640 px, 1024 px, 1440 px.

### 5. Trattamento dei componenti

- **Navigazione:** la barra di comando è la navigazione. `Ctrl+K` apre un campo
  che filtra insieme **azioni** ("Crea una nuova pagina"), **destinazioni**
  ("Pagine", "Registro delle operazioni"), **record** ("Chi siamo") e **ruoli**
  ("Passa a Tesoreria"). In alto restano solo le briciole di pane e il ruolo
  attivo. Per chi non usa la tastiera, ogni schermata ha in testa un elenco
  orizzontale delle sezioni sorelle, e la barra di comando è raggiungibile con un
  bottone sempre visibile.
- **Tabelle ed elenchi lunghi:** è il componente centrale. Riga selezionabile con
  `j`/`k` e frecce, selezione multipla con `x`, azioni con tasti singoli
  (`e` modifica, `p` pubblica), intestazione fissa, colonne ridimensionabili e
  nascondibili, scorrimento virtualizzato senza impaginazione. Il numero di riga
  e il totale sono nella barra di stato.
- **Form:** gli attributi sono una **lista di coppie chiave/valore** modificabili
  in posizione: si sposta il fuoco con `Tab`, si preme `Invio` per modificare, si
  conferma con `Invio`. Nessuna finestra, nessun passo. Le validazioni compaiono
  accanto al valore.
- **Bottoni:** rari e discreti. Rettangolo con raggio 4 px, altezza 28–32 px,
  testo 13 px, con la scorciatoia indicata a destra in monospaziato. Il
  principale è pieno `accent`; gli altri sono di solo testo con bordo al
  passaggio.
- **Badge di stato:** nessuna pastiglia. Lo stato è una parola in minuscolo nella
  propria colonna, con un quadratino colorato 8×8 px a sinistra.
- **Modali:** solo la barra di comando e le conferme distruttive. Tutto il resto
  è un pannello laterale o una modifica in posizione.
- **Notifiche:** riga nella barra di stato in basso, con testo breve; gli errori
  aprono invece un riquadro in cima al contenuto che resta finché non viene
  chiuso. Nessuna notifica fluttuante che copre le righe.
- **Stato vuoto:** una riga di testo e i due o tre comandi pertinenti con le loro
  scorciatoie, presentati come suggerimenti («premi `Ctrl+N` per creare la prima
  pagina»). Insegna l'interfaccia mentre la usa.
- **Stato di errore:** riquadro con bordo `danger` 2 px in cima al contenuto,
  testo dell'errore e comando di recupero già selezionabile. Nella barra di stato
  compare il conteggio degli errori aperti.
- **Indicatore di ruolo attivo:** in alto a destra, in maiuscoletto, con il nome
  utente accanto; si cambia con `Ctrl+Shift+R` o dalla barra di comando, sezione
  «Cambia ruolo». Quando il ruolo attivo ha poteri estesi, la barra superiore
  assume un bordo inferiore spesso 2 px in `accent`.
- **Marcatore di contenuto riservato:** colonna dedicata con il segno `(R)` in
  monospaziato, riga con bordo sinistro `restricted` spesso 3 px, e filtro
  rapido «solo riservati». Aprendo il record, la barra di stato mostra in
  permanenza «RISERVATO — visibile a: segreteria, amministrazione».

### 6. Mockup ASCII

**Elenco delle pagine del CMS con la barra di comando aperta.** Il riquadro
centrale compare sopra la tabella e filtra azioni, destinazioni e ruoli.

```
+--------------------------------------------------------------------------------------------+
| Contenuti / Pagine                      Ctrl+K comandi        REDAZIONE v    a.bianchi     |
+--------------------------------------------------------------------------------------------+
| 24 elementi                   filtro: stato=bozza           ordinamento: modifica desc     |
|                                                                                            |
|   TITOLO                          PERCORSO            STATO       MODIFICA    AUTORE       |
| -----------------------------------------------------------------------------------------  |
| > Chi siamo                       /chi-siamo          pubblicata  12/09 16:40 m.rossi      |
|   Servizi alla famiglia           /servizi            pubblicata  11/09 09:12 m.rossi      |
|   Corsi 2027                      /corsi-2027         bozza       10/09 18:03 a.bianchi    |
|   Note interne   (R)              /note-interne       privata     09/09 11:20 segreteria   |
|   Dove siamo                      /contatti           pubblicata  05/09 14:55 m.rossi      |
| -----------------------------------------------------------------------------------------  |
|                                                                                            |
|         +-------------------------------------------------------------+                    |
|         | > pag                                                       |                    |
|         +-------------------------------------------------------------+                    |
|         | AZIONI                                                      |                    |
|         |   Crea una nuova pagina                          Ctrl+N     |                    |
|         |   Pubblica la pagina selezionata                 Ctrl+Enter |                    |
|         |   Segna come riservata                                      |                    |
|         | VAI A                                                       |                    |
|         |   Pagine - Notizie - Media - Menu - Redirect                |                    |
|         |   Registro delle operazioni                                 |                    |
|         | CAMBIA RUOLO                                                |                    |
|         |   Redazione / Tesoreria / Segreteria                        |                    |
|         +-------------------------------------------------------------+                    |
|                                                                                            |
+--------------------------------------------------------------------------------------------+
| j/k muovi   Enter apri   e modifica   / cerca   ? aiuto       5 di 24                      |
+--------------------------------------------------------------------------------------------+
```

**Modifica di una pagina.** Editor a sinistra, attributi come coppie
chiave/valore a destra, scorciatoie nella barra di stato.

```
+--------------------------------------------------------------------------------------------+
| Contenuti / Pagine / chi-siamo          modificata, non salvata   REDAZIONE v              |
+----------------------------------------------------------+---------------------------------+
| # Chi siamo                                              | stato        bozza              |
|                                                          | percorso     /chi-siamo         |
| Il Centro per la Famiglia accompagna le                  | visibilita   pubblica           |
| coppie e i genitori del territorio con                   | riservato    no                 |
| ascolto, consulenza e percorsi di gruppo.                | autore       m.rossi            |
|                                                          | aggiornata   14/09 09:12        |
| ## La nostra storia                                      | ------------------------------  |
|                                                          | seo.title    Chi siamo - Centro |
| Nata nel 2011 su iniziativa di un gruppo                 | seo.descr    Chi siamo e come   |
| di volontari, l associazione offre oggi                  |              lavoriamo          |
| quattro servizi stabili.                                 | ------------------------------  |
|                                                          | REGISTRO                        |
| [ immagine: sede-esterno.jpg — Sede del Centro ]         | 14/09 09:12 a.bianchi  bozza    |
|                                                          | 12/09 17:03 m.rossi    pubbl.   |
|                                                          | 09/09 10:41 m.rossi    creata   |
|                                                          |                                 |
|                                                          | Tab passa al pannello           |
+----------------------------------------------------------+---------------------------------+
| Ctrl+S salva   Ctrl+Enter pubblica   Ctrl+P anteprima   Esc esci    1.240 parole           |
+--------------------------------------------------------------------------------------------+
```

### 7. Resa su mobile

È la proposta che deve cambiare di più. Sotto i 600 px la tabella diventa un
elenco a due righe per record (titolo; percorso, stato e data in monospaziato
ridotto), le colonne non essenziali scompaiono, e la barra di comando diventa una
**barra fissa in fondo allo schermo**, con i tre comandi più probabili già
elencati sotto — di fatto sostituisce la barra di navigazione inferiore delle
altre proposte. La modifica in posizione degli attributi diventa un pannello a
comparsa dal basso, perché in posizione sarebbe impossibile da centrare col dito.

```
+----------------------------------------+
| Pagine                REDAZIONE v      |
+----------------------------------------+
| bozza - 3 elementi          filtri     |
+----------------------------------------+
| Chi siamo                              |
| /chi-siamo   pubbl.   12/09            |
| Corsi 2027                             |
| /corsi-2027  bozza    10/09            |
| Note interne                   (R)     |
| /note-interne privata 09/09            |
| Dove siamo                             |
| /contatti    pubbl.   05/09            |
+----------------------------------------+
|                                        |
|                                        |
|                                        |
+----------------------------------------+
|     [ Cerca o esegui un comando ]      |
|   nuova pagina - pubblica - registro   |
+----------------------------------------+
```

### 8. Accessibilità

- **Focus visibile:** è il fondamento della proposta. Anello `accent` spesso
  2 px su ogni elemento, più riga selezionata con fondo `accent` al 12 % e bordo
  sinistro pieno. Il fuoco non si perde mai: chiudendo la barra di comando torna
  alla riga da cui è partita.
- **Bersagli tattili:** su tocco la riga cresce automaticamente a 44 px e la
  densità compattissima è disattivata; su puntatore restano 28–32 px. Occorre
  quindi mantenere due misure, non una.
- **Senza colore:** lo stato è una parola, il riservato è il segno `(R)` più
  bordo; la selezione è segnata dal bordo sinistro oltre che dal fondo.
- **Movimento:** nessuna animazione tranne la comparsa della barra di comando
  (100 ms); con `prefers-reduced-motion` compare istantaneamente.
- **Punto di attenzione:** una interfaccia guidata dalla tastiera richiede un
  lavoro serio con il lettore di schermo — la barra di comando deve annunciare i
  risultati con una regione `aria-live`, e ogni scorciatoia deve avere un
  equivalente raggiungibile con il puntatore. È un costo reale, non un dettaglio.

### 9. Costo e rischio

- **Librerie proposte:** `cmdk` per la barra di comando, Radix UI Primitives per
  i pochi componenti sovrapposti, TanStack Table v8 con virtualizzazione. Costo
  di adozione basso in termini di installazione, alto in termini di disciplina:
  il registro dei comandi e delle scorciatoie va progettato una volta e
  mantenuto per nove moduli.
- **Costo iniziale:** 6–8 giornate per il sistema di design e l'infrastruttura
  dei comandi, 22–28 giornate per il CMS.
- **Costo marginale di un modulo successivo:** il più basso di tutti — 2–4
  giornate — perché ogni nuovo modulo è un insieme di comandi e una tabella, e la
  navigazione non va ripensata.
- **Manutenzione:** media, concentrata sull'accessibilità e sul registro dei
  comandi.
- **Rischio principale, ed è grave per questo progetto:** presuppone utenti
  esperti. Un volontario che entra due volte l'anno davanti a una schermata senza
  menu non sa dove cliccare. Mitigazione possibile (elenco delle sezioni sempre
  visibile in testa, bottone «Cerca o esegui un comando» ben evidente), ma la
  mitigazione erode proprio il vantaggio della proposta.
- **Rischio secondario:** su mobile la proposta diventa un'altra interfaccia, e
  due interfacce costano il doppio a un team di una persona.

---

## Proposta 4 — «Quaderno»

### 1. Identità in una frase

Il **documento è al centro**, largo quanto una colonna di lettura: la struttura
del sito sta a sinistra come un indice ad albero e i dati di servizio stanno a
destra come note a margine, così che modificare una pagina somigli a scrivere su
un foglio e non a compilare un modulo.

### 2. Palette

Avorio da carta, inchiostro verde-nero, un verde profondo d'azione e un oro
spento come secondo accento. Il carattere è editoriale e istituzionale, coerente
con il tono caldo e non commerciale del sito pubblico ma senza riprenderne il
blu: la divergenza è motivata dal fatto che il foglio bianco-azzurro di WordPress
è esattamente ciò che DR-018 chiede di evitare.

**Tema chiaro** — fondo `#FAF8F3`, superficie del foglio `#FFFFFF`.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#FAF8F3` | Fondo (la scrivania attorno al foglio) | — | fondo di riferimento |
| `bg-sheet` | `#FFFFFF` | Il foglio del documento | 1.1:1 su `bg-app` | separazione decorativa, rinforzata da ombra sottile |
| `text-primary` | `#1E211F` | Testo del documento e titoli | 15.3:1 su `bg-app` · 16.2:1 su `bg-sheet` | supera 4.5:1 |
| `text-secondary` | `#565F5B` | Note a margine, metadati | 6.2:1 su `bg-app` | supera 4.5:1 |
| `border` | `#E2DCCD` | Filetti decorativi | 1.3:1 | decorativo |
| `border-strong` | `#8C8577` | Bordi dei campi, confine del foglio | 3.4:1 su `bg-app` | supera 3:1 |
| `primary` | `#1D5B54` | Bottone principale, voce attiva dell'albero, focus | 7.4:1 su `bg-app` | supera 4.5:1 |
| `on-primary` | `#FFFFFF` | Testo sul bottone principale | 7.8:1 su `primary` | supera 4.5:1 |
| `accent` | `#7A5A10` | Secondo accento: revisioni, annotazioni, evidenziazioni | 6.0:1 su `bg-app` | supera 4.5:1 |
| `success` | `#2C6B45` | Stato "pubblicata" | 6.0:1 su `bg-app` | supera 4.5:1 |
| `warning` | `#8A5200` | Stato "bozza" | 6.0:1 su `bg-app` | supera 4.5:1 |
| `danger` | `#9E2622` | Errori ed eliminazioni | 7.2:1 su `bg-app` | supera 4.5:1 |
| `restricted` | `#6A3B7A` | Marcatore riservato | 7.9:1 su `bg-app` | supera 4.5:1 |

**Tema scuro** — fondo `#15191A`, foglio `#1D2224`.

| Token | HEX | Uso previsto | Contrasto | Esito |
|---|---|---|---|---|
| `bg-app` | `#15191A` | Fondo | — | fondo di riferimento |
| `bg-sheet` | `#1D2224` | Il foglio | 1.1:1 su `bg-app` | separazione decorativa |
| `text-primary` | `#ECEFEC` | Testo del documento | 13.9:1 su `bg-sheet` | supera 4.5:1 |
| `text-secondary` | `#A6B0AC` | Note a margine | 7.2:1 | supera 4.5:1 |
| `border` | `#313A3C` | Filetti decorativi | 1.4:1 | decorativo |
| `border-strong` | `#7C8783` | Bordi dei campi | 4.3:1 | supera 3:1 |
| `primary` | `#6FBDB0` | Bottone principale, voce attiva, focus | 7.3:1 | supera 4.5:1 |
| `on-primary` | `#15191A` | Testo sul bottone principale | 8.1:1 su `primary` | supera 4.5:1 |
| `accent` | `#D9B05C` | Revisioni e annotazioni | 7.9:1 | supera 4.5:1 |
| `success` | `#79CFA0` | Stato "pubblicata" | 8.6:1 | supera 4.5:1 |
| `warning` | `#E3AE4E` | Stato "bozza" | 8.0:1 | supera 4.5:1 |
| `danger` | `#F08C82` | Errori | 6.7:1 | supera 4.5:1 |
| `restricted` | `#C79FD6` | Marcatore riservato | 7.2:1 | supera 4.5:1 |

### 3. Tipografia

Unica proposta con due famiglie, **entrambe self-hosted** in `woff2`:

- **Source Serif 4** per il contenuto del foglio (titoli e corpo del documento):
  segnala che quello è il testo che finirà sul sito, e non un campo di un modulo.
- **Source Sans 3** per l'interfaccia: albero, note a margine, bottoni, tabelle.
- Ripieghi: `Georgia, "Times New Roman", serif` e
  `system-ui, "Segoe UI", sans-serif`.

| Ruolo | Famiglia | Dimensione | Peso | Interlinea |
|---|---|---|---|---|
| `ui-xs` — etichette a margine | Sans | 0.75 rem (12 px) | 600 | 1.35 |
| `ui-sm` — note a margine, albero | Sans | 0.875 rem (14 px) | 400 | 1.5 |
| `ui-base` — campi e bottoni | Sans | 0.9375 rem (15 px) | 400 | 1.5 |
| `doc-base` — corpo del documento | Serif | 1.0625 rem (17 px) | 400 | 1.7 |
| `doc-h3` — sottotitolo nel documento | Serif | 1.25 rem (20 px) | 600 | 1.4 |
| `doc-h2` — titolo di sezione nel documento | Serif | 1.5 rem (24 px) | 600 | 1.35 |
| `doc-h1` — titolo del documento | Serif | 2 rem (32 px) | 600 | 1.25 |

### 4. Griglia e spaziatura

- **Unità di base:** 4 px, con **ritmo verticale di 8 px** nel foglio: ogni
  blocco di testo si allinea a un reticolo di 8 px, come in una pagina stampata.
- **Scala di spaziatura:** 4, 8, 12, 20, 32, 56, 88 (progressione vicina alla
  serie di Fibonacci, per ottenere stacchi netti fra livelli).
- **Larghezze:** albero della struttura 260 px (richiudibile); foglio con
  larghezza di lettura **68 caratteri** (circa 680–720 px) e margini interni
  32 px; colonna delle note a margine 280 px. Il foglio resta centrato anche su
  schermi molto larghi: lo spazio in più diventa margine, non contenuto.
- **Breakpoint:** 640 px, 1024 px, 1360 px. Sotto 1360 px le note a margine
  diventano un pannello richiamabile; sotto 1024 px l'albero diventa un cassetto.

### 5. Trattamento dei componenti

- **Navigazione:** albero della struttura sempre a sinistra, che rispecchia la
  vera gerarchia del sito (Pagine con le loro figlie, poi Notizie, Media, Menu,
  SEO, Impostazioni) e, sotto un filetto, l'elenco piano degli altri otto moduli.
  L'albero si espande e si contrae, ricorda lo stato ed è navigabile con le
  frecce. La voce attiva ha fondo pieno tenue e peso 600.
- **Tabelle ed elenchi lunghi:** l'elenco predefinito è un **sommario**: titolo
  in serif, sotto una riga in sans con percorso, stato e data. Per i moduli che
  lo richiedono (contabilità, soci, presenze) esiste una vista tabellare
  compatta che condivide filtri e comandi, ma non è la vista predefinita del CMS.
  Raggruppamenti per sezione con intestazioni fisse.
- **Form:** non hanno l'aspetto di un modulo. Il titolo e il corpo si modificano
  direttamente nel foglio, in posizione, con la stessa tipografia che avranno sul
  sito; tutto il resto (stato, percorso, SEO, visibilità, registro) vive nelle
  note a margine, come annotazioni. I campi a margine sono compatti, con
  etichetta piccola sopra il valore.
- **Bottoni:** altezza 36 px, raggio 6 px, bordi netti. Principale pieno
  `primary`; secondario con bordo `border-strong`; le azioni sul contenuto («+
  testo», «+ immagine») sono di solo testo, in linea nel foglio, e compaiono in
  modo permanente in coda al documento.
- **Badge di stato:** testo in maiuscoletto piccolo nelle note a margine, con
  filetto colorato sopra; nel sommario lo stato è una parola in coda alla riga di
  metadati. Nessuna pastiglia piena: sarebbe estranea al carattere editoriale.
- **Modali:** solo per conferme distruttive e per la scelta di un media. Ogni
  altra scelta è a margine o in linea.
- **Notifiche:** riga discreta in cima al foglio, con filetto colorato a
  sinistra, che scorre via con il contenuto anziché fluttuare. Gli errori
  restano finché non risolti.
- **Stato vuoto:** il foglio compare comunque, con un titolo segnaposto in grigio
  e la riga «Inizia a scrivere». L'elenco vuoto mostra una frase e il comando di
  creazione.
- **Stato di errore:** filetto `danger` spesso 3 px sul lato sinistro del foglio
  o del campo a margine interessato, con il messaggio nella colonna a margine,
  all'altezza esatta del problema — come una correzione a bordo pagina.
- **Indicatore di ruolo attivo:** in alto a destra, testo in maiuscoletto
  «Redazione» con freccia; cambiando ruolo cambia il colore del filetto superiore
  del foglio e l'albero si ricompone. Nelle note a margine compare sempre la riga
  «Stai modificando come: Redazione».
- **Marcatore di contenuto riservato:** il foglio prende un **bordo sinistro
  spesso 6 px** in `restricted` per tutta l'altezza, l'etichetta `RISERVATO`
  appare in testa alle note a margine con icona, e nel sommario la voce ha lo
  stesso bordo più il segno `(R)`. È il marcatore più evidente delle quattro
  proposte, perché occupa un intero lato della pagina.

### 6. Mockup ASCII

**Elenco delle pagine del CMS come sommario**, con l'albero della struttura a
sinistra e i dati di riepilogo a destra.

```
+--------------------------------------------------------------------------------------------+
| Centro Amoris Laetitia                  Sezione: Contenuti          Redazione v            |
+------------------------+--------------------------------------------+--------------------+
| STRUTTURA DEL SITO     | Pagine                                     | 24 pagine          |
|                        |                                            | 3 bozze            |
| v Pagine               | Il sito pubblico e composto da             | 1 riservata        |
|   - Chi siamo          | queste pagine, nell ordine in cui          |                    |
|   - Servizi            | compaiono nel menu.                        | Ultima modifica    |
|   - Corsi 2027         |                                            | 14/09 09:12        |
|   - Contatti           | -----------------------------------------  | a.bianchi          |
|   - Note interne (R)   |                                            |                    |
| > Notizie              | Chi siamo                                  | [ Registro ]       |
| > Media                | /chi-siamo - pubblicata 12/09              |                    |
| > Menu                 |                                            |                    |
| > SEO e redirect       | Servizi alla famiglia                      |                    |
| > Impostazioni         | /servizi - pubblicata 11/09                |                    |
|                        |                                            |                    |
| ALTRE SEZIONI          | Corsi 2027                                 | [ + Nuova ]        |
| Persone                | /corsi-2027 - bozza 10/09                  |                    |
| Corsi ed eventi        |                                            |                    |
| Agenda                 | || Note interne          (R)               |                    |
| Documenti              | || /note-interne - privata 09/09           |                    |
| Contabilita            | || solo segreteria e amministraz.          |                    |
| Moduli                 |                                            |                    |
| Comunicazioni          | Dove siamo                                 |                    |
| Statistiche            | /contatti - pubblicata 05/09               |                    |
+------------------------+--------------------------------------------+--------------------+
```

**Modifica di una pagina.** Il foglio al centro, le note a margine a destra,
l'albero richiuso.

```
+--------------------------------------------------------------------------------------------+
| Contenuti / Pagine / Chi siamo                    bozza       Redazione v                  |
+--------+--------------------------------------------------------+------------------------+
|        |                                                        | A MARGINE              |
|        |         Chi siamo                                      | stato    bozza         |
| [<]    |                                                        | percorso /chi-siamo    |
|        |   Il Centro per la Famiglia                            | autore   m.rossi       |
|        |   accompagna le coppie e i genitori del                | ---------------------  |
|        |   territorio con ascolto, consulenza e                 | VISIBILITA             |
|        |   percorsi di gruppo.                                  | (o) pubblica           |
|        |                                                        | ( ) autenticati        |
|        |   La nostra storia                                     | ( ) riservata          |
|        |                                                        | ---------------------  |
|        |   Nata nel 2011 su iniziativa di un                    | SEO                    |
|        |   gruppo di volontari, l associazione                  | Chi siamo - Centro     |
|        |   offre oggi quattro servizi stabili.                  | Chi siamo e come       |
|        |                                                        | lavoriamo              |
|        |   [ immagine: sede-esterno.jpg ]                       | ---------------------  |
|        |   Didascalia: la sede di via Esempio                   | REGISTRO               |
|        |                                                        | 14/09 09:12            |
|        |   + testo  + immagine  + elenco                        | a.bianchi - bozza      |
|        |                                                        | 12/09 17:03            |
|        |                                                        | m.rossi - pubblic.     |
+--------+--------------------------------------------------------+------------------------+
| [ Salva ]   [ Anteprima ]                         salvato 2 min fa      [ Pubblica ]       |
+--------------------------------------------------------------------------------------------+
```

### 7. Resa su mobile

Sotto i 1024 px l'albero diventa un cassetto richiamabile; sotto i 640 px le note
a margine diventano una sezione richiudibile posta **sotto** il foglio, intitolata
«A margine», e il foglio occupa tutta la larghezza con margini di 16 px,
mantenendo il corpo a 17 px in serif. La barra di salvataggio si ancora in fondo.
La modifica in posizione resta, perché su mobile scrivere direttamente nel testo è
più semplice che passare da campi separati.

```
+----------------------------------------+
| [=] Chi siamo             Redaz. v     |
+----------------------------------------+
|                                        |
|       Chi siamo                        |
|                                        |
|   Il Centro per la Famiglia            |
|   accompagna le coppie e i             |
|   genitori del territorio.             |
|                                        |
|   La nostra storia                     |
|                                        |
|   Nata nel 2011 su iniziativa          |
|   di un gruppo di volontari.           |
|                                        |
|   [ immagine: sede-esterno ]           |
|                                        |
|   + testo  + immagine  + elenco        |
+----------------------------------------+
| > A margine  (stato, SEO, registro)    |
+----------------------------------------+
| [ Salva ]             [ Pubblica ]     |
+----------------------------------------+
```

### 8. Accessibilità

- **Focus visibile:** anello `primary` spesso 2 px con scostamento 2 px; nel
  foglio, il blocco in modifica riceve anche un filetto pieno a sinistra, perché
  in un testo lungo il solo anello si perde.
- **Bersagli tattili:** 44×44 px per i comandi; le voci dell'albero hanno altezza
  40 px con area attiva estesa a 44 px e rientro di 16 px per livello, con al
  massimo tre livelli.
- **Senza colore:** stati in parole, riservatezza segnata dallo spessore del
  bordo e dall'etichetta, gerarchia data dalla tipografia serif/sans prima che
  dal colore.
- **Movimento:** espansione dell'albero 150 ms; nessun effetto di parallasse né
  transizione sul foglio. `prefers-reduced-motion` rende tutto immediato.
- **Testo scalabile:** il foglio è dimensionato in `ch`, quindi allo zoom del
  200 % la riga resta di 68 caratteri e non si formano righe lunghissime; le note
  a margine passano sotto il foglio.

### 9. Costo e rischio

- **Librerie proposte:** Radix UI Primitives, e per la modifica in posizione un
  editor a blocchi (Tiptap su ProseMirror). L'editor è la voce di costo più
  pesante dell'intera proposta: la modifica in posizione fedele all'aspetto
  finale richiede di tenere allineati due sistemi di stili (foglio e sito
  pubblico).
- **Costo iniziale:** 6–9 giornate per il sistema di design, 24–30 giornate per
  il CMS.
- **Costo marginale di un modulo successivo:** **alto per i moduli a dati**
  (contabilità, soci, presenze), perché richiedono la vista tabellare, che è un
  secondo linguaggio visivo da costruire e mantenere: 5–8 giornate a modulo.
  Basso per i moduli documentali (verbali, bilanci, bandi), dove il foglio è
  esattamente la forma giusta.
- **Manutenzione:** media-alta. Due famiglie tipografiche, due viste, un editor.
- **Rischio principale:** **disallineamento fra i nove moduli**. Il carattere
  editoriale è perfetto per contenuti e documenti e innaturale per prima nota e
  presenze; il rischio è che l'area si spacchi in due metà che sembrano due
  applicazioni diverse.
- **Rischio secondario:** la modifica in posizione promette un'anteprima fedele
  che, se il foglio non somiglia davvero al sito pubblico, diventa una promessa
  tradita e una fonte di segnalazioni.

---


## Tabella comparativa

Punteggi da 1 (scarso) a 5 (ottimo) sui criteri comuni. I punteggi sono una
lettura tecnica di chi ha prodotto le proposte, non una graduatoria di merito:
servono a rendere espliciti i compromessi, non a scegliere.

| Criterio | 1 · Scrivania | 2 · Accoglienza | 3 · Comando | 4 · Quaderno |
|---|:--:|:--:|:--:|:--:|
| Leggibilità per un volontario non tecnico | 4 | 5 | 2 | 4 |
| Densità informativa | 5 | 2 | 5 | 3 |
| Accessibilità | 4 | 5 | 3 | 4 |
| Scalabilità ai 9 moduli | 5 | 2 | 5 | 3 |
| Costo per un team di una persona | 4 | 4 | 2 | 2 |
| Resa su mobile | 3 | 5 | 3 | 4 |
| Distanza da WordPress | 4 | 5 | 5 | 5 |
| **Totale** | **29** | **28** | **25** | **25** |

**Motivazioni, una riga per proposta.**

| Proposta | Motivazione del punteggio |
|---|---|
| **1 · Scrivania** | Regge i nove moduli con gli stessi mattoni e costa poco a estendersi; paga qualcosa in leggibilità per l'utente occasionale e in resa su mobile, dove le due colonne di navigazione vanno comunque sostituite. |
| **2 · Accoglienza** | È di gran lunga la più comprensibile e la migliore su mobile, ma la bassa densità la rende inadatta a contabilità, libro soci e presenze, e i percorsi guidati non si riusano da un modulo all'altro. |
| **3 · Comando** | Densità e scalabilità eccellenti e costo marginale minimo per modulo, annullati però dal presupposto sbagliato per questa utenza: un volontario occasionale davanti a una schermata senza menu non sa da dove cominciare. |
| **4 · Quaderno** | Perfetta per contenuti e documenti, con il marcatore di riservatezza più chiaro delle quattro; rischia però di spaccarsi in due linguaggi visivi quando arrivano i moduli a dati, e l'editor in posizione è la voce di costo più alta. |

---

## Raccomandazione

> **Questa è una raccomandazione tecnica, non una decisione.** La scelta spetta
> all'utente e va registrata in `docs/decisions/decision-register.md` prima che
> qualunque fase di realizzazione la dia per acquisita.

**Si raccomanda la Proposta 1 «Scrivania» come base, con tre prestiti espliciti
dalle altre.**

Le ragioni, in ordine di peso:

1. **Il perimetro è l'intera area amministrativa (DR-028), non il solo CMS.**
   Delle quattro, «Scrivania» è quella in cui un modulo nuovo è una composizione
   di componenti già esistenti — elenco, filtri, dettaglio, pannello di
   ispezione — invece di un nuovo linguaggio da progettare. Con un team di una
   persona e nove moduli davanti, il costo marginale per modulo pesa più
   dell'effetto della prima schermata.
2. **Contabilità, libro soci e presenze esistono già nel perimetro.** Sono viste
   a molte righe: «Accoglienza» richiederebbe comunque una seconda vista
   tabellare, e «Quaderno» pure. Partire da una interfaccia che le tratta
   nativamente evita di costruire due sistemi.
3. **Il rischio di «Scrivania» è mitigabile, quello delle altre no.** La sua
   debolezza — la densità che intimidisce l'utente occasionale — si corregge con
   scelte locali (densità comoda predefinita, stati vuoti che spiegano, percorsi
   guidati sulle operazioni rare). Le debolezze delle altre sono strutturali.

I tre prestiti raccomandati:

- **Da «Accoglienza»:** densità comoda come valore predefinito, testi di stato in
  parole complete, e un **percorso guidato a passi** riservato alle operazioni
  rare e delicate (creare un nuovo socio, chiudere il rendiconto, inviare una
  comunicazione a molti destinatari), non alle operazioni quotidiane.
- **Da «Comando»:** la barra di ricerca e comando `Ctrl+K` come **acceleratore**
  per chi entra spesso, mai come unica via di navigazione: i due menu restano.
- **Da «Quaderno»:** il marcatore di riservatezza a bordo spesso su tutto il lato
  del record, che è il più leggibile delle quattro proposte e va bene su una
  materia che non ammette equivoci.

**Cosa perde questa raccomandazione, dichiarato apertamente:** il volontario che
entra due volte l'anno troverà «Scrivania» meno immediata di «Accoglienza», anche
con i prestiti. Se la priorità dell'utente è che chiunque riesca al primo tentativo
senza formazione, e si accetta di progettare separatamente le viste contabili, la
Proposta 2 è la scelta coerente e questa raccomandazione va scartata.

---

## Cosa serve dall'utente per decidere

Cinque decisioni. Le domande sono numerate in modo stabile: si potranno citare
per numero nelle risposte e nel registro delle decisioni.

**1. Quale delle quattro proposte di UI si adotta come base?**
- Opzioni: (a) 1 · Scrivania · (b) 2 · Accoglienza · (c) 3 · Comando ·
  (d) 4 · Quaderno · (e) nessuna, si chiede un quinto giro di proposte.
- Raccomandazione: **(a)**, con i tre prestiti descritti sopra.
- Impatto: determina il sistema di design, i componenti da costruire e la stima
  di tutte le fasi successive dell'area amministrativa.
- *Default vietato: nessuna proposta può essere considerata scelta per silenzio o
  per sola raccomandazione.*

**2. Chi è l'utente prioritario dell'area amministrativa?**
- Opzioni: (a) il volontario che entra ogni giorno (segreteria) · (b) il
  volontario che entra poche volte l'anno · (c) entrambi con pari peso, accettando
  il costo di due modalità (densità comoda + percorsi guidati).
- Raccomandazione: **(a) come priorità, con le mitigazioni per (b)**.
- Impatto: decide la densità predefinita, la quantità di testi di aiuto e se i
  percorsi guidati vanno estesi oltre le operazioni rare.
- *Default vietato: non si assume che l'utente prioritario sia la segreteria
  senza conferma.*

**3. Si mantiene Open Sans, il carattere del sito pubblico, anche nell'area
amministrativa?**
- Opzioni: (a) sì, continuità con il sito · (b) no, carattere di interfaccia
  distinto (Inter per la Proposta 1, Source Serif/Sans per la 4, pila di sistema
  per la 3).
- Raccomandazione: **(b)**, perché l'area amministrativa deve essere
  riconoscibilmente un'altra cosa e i caratteri di interfaccia sono disegnati per
  dimensioni piccole; è però una scelta di identità, non tecnica.
- Impatto: peso dei file, coerenza percepita con il sito, costo di manutenzione
  dei font self-hosted.
- *Default vietato: non si eredita il font del tema Divi per inerzia.*

**4. Il tema scuro è richiesto fin dal primo rilascio o è rimandabile?**
- Opzioni: (a) fin dal primo rilascio · (b) previsto nei token ma realizzato
  dopo il gate · (c) non previsto.
- Raccomandazione: **(b)** — i token restano definiti in entrambe le versioni
  (costo quasi nullo se fatto subito, costo alto se aggiunto dopo), ma la
  verifica visiva del tema scuro si sposta a dopo il primo rilascio.
- Impatto: circa 2–3 giornate di verifica e correzione sul primo modulo.
- *Default vietato: non si dichiara "supporta il tema scuro" senza averlo
  verificato schermata per schermata.*

**5. Il nome e il comportamento del cambio di ruolo: come devono funzionare?**
- Opzioni: (a) un solo ruolo attivo per volta, scelto esplicitamente, e
  l'interfaccia mostra solo ciò che quel ruolo può fare · (b) tutti i ruoli
  attivi insieme, con l'unione dei permessi e nessuna commutazione · (c) tutti
  attivi, ma con un filtro visivo commutabile.
- Raccomandazione: **(a)**, perché rende leggibile il registro delle operazioni
  («chi ha fatto cosa, in quale ruolo») e riduce il rischio di operare per errore
  con poteri estesi su dati riservati.
- Impatto: tocca il modello dei permessi, il registro delle operazioni e
  l'intestazione di ogni schermata; è una scelta che è molto costosa da cambiare
  dopo.
- *Default vietato: non si sceglie il modello dei ruoli come effetto collaterale
  dell'implementazione.*

---

## Nota di metodo

I rapporti di contrasto riportati nelle tabelle delle palette sono stati calcolati
con la formula della luminanza relativa di WCAG 2.2 su ciascuna coppia
colore/fondo indicata, e non stimati. Le coppie marcate come «decorativo» sono
superfici e filetti che non portano informazione: dove un confine ha significato
(bordo di un campo, limite di un'area selezionabile) si usa `border-strong`, che
in tutte e otto le palette supera 3:1.

Tutti i nomi, i titoli, le date e i percorsi usati nei mockup sono **inventati** e
non corrispondono a persone, contenuti o dati reali del Centro.
