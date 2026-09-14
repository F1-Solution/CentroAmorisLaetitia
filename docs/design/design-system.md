# Sistema di design dell'area amministrativa

| | |
|---|---|
| **Progetto** | Centro per la Famiglia Amoris Laetitia |
| **Data** | 2026-09-15 |
| **Fase** | 1D, prodotto per la wave `1D-W7` |
| **Ambito** | **solo** l'area amministrativa (`apps/admin`) e il pacchetto `packages/ui` |
| **Origine** | DR-044, DR-045, DR-046, DR-047, DR-048 (Round 5 del registro delle decisioni), HO-004 §10 punto 3 |
| **Sorgenti** | `docs/design/ui-proposals.md` proposta 1 «Scrivania» · `docs/design/ux-proposals.md` proposta B «Le aree di responsabilità» · ADR-005, ADR-006, ADR-007, ADR-008 |

> Questo documento è la fonte unica da cui la wave `1D-W7` costruisce
> `packages/ui`. Dove un valore proviene dalle proposte, la fonte è citata. Dove
> un valore è fissato qui per la prima volta, è marcato **[fissato in 1D-W7]** con
> la motivazione. Non esistono valori senza una di queste due etichette.
>
> Il capitolo 11 elenca **sette decisioni non approvate**. Finché non sono
> confermate dall'utente restano assunzioni e non autorizzano codice.

---

## 1. Che cosa è stato scelto, e perché

Il 2026-09-15 l'utente ha risposto a HO-004. Cinque decisioni, registrate in
`docs/decisions/decision-register.md` §9.

| Decisione | Scelta | Effetto su questo documento |
|---|---|---|
| **DR-044** | UI 1 «Scrivania» | palette, tipografia, griglia, densità e trattamento dei componenti vengono da `ui-proposals.md` proposta 1 |
| **DR-045** | UX B «Le aree di responsabilità» | l'architettura dell'informazione viene da `ux-proposals.md` §4 |
| **DR-046** | il Centro ha ruoli abbastanza distinti | la premessa della proposta B regge: le aree restano il primo livello di navigazione |
| **DR-047** | tutti i ruoli attivi insieme, unione dei permessi, **nessuna commutazione** | sparisce il selettore di ruolo previsto da `ui-proposals.md` §5 e la barra «Stai lavorando come…» di `ux-proposals.md` §4.3 |
| **DR-048** | carattere d'interfaccia distinto da quello del sito pubblico | Inter ospitato in proprio, capitolo 3 |

«Scrivania» è stata scelta su una raccomandazione che pesava il costo marginale di
ogni modulo nuovo: elenco, filtri, dettaglio e pannello di ispezione sono gli stessi
mattoni in tutti i moduli (`ui-proposals.md`, «Raccomandazione»). «Le aree di
responsabilità» è stata scelta su una raccomandazione che pesava la riservatezza come
separazione di ambiente (`ux-proposals.md` §9). La matrice di compatibilità dichiara
**B + navigazione laterale persistente** come l'accoppiamento più solido delle sedici
possibili (`ux-proposals.md` §8).

**DR-047 è stata scelta contro la raccomandazione.** Il registro lo dice
esplicitamente, e questo documento non la rimette in discussione: la recepisce e ne
trae le conseguenze al capitolo 8, dove sta anche la tensione aperta fra DR-045 e
DR-047.

Il vincolo che precede tutti: **l'area amministrativa non deve assomigliare a
WordPress** (DR-018). Nessuna barra nera superiore, nessuna colonna grigio scuro con
icone bianche, nessuna bacheca a widget, nessun vocabolario WordPress
(`ui-proposals.md`, «Come leggere questo documento»). `packages/ui` è deliberatamente
separato e **non** viene importato dal sito pubblico: condividerne i componenti
farebbe convergere le due estetiche senza che nessuno lo decida (ADR-008 §3.1 e §3.3
regola 3).

---

## 2. Token di colore

Tutti i valori esadecimali e tutti i rapporti di contrasto delle due tabelle che
seguono provengono da `ui-proposals.md`, proposta 1, §2 «Palette», **tranne** le
righe marcate **[fissato in 1D-W7]**.

I rapporti sono stati **ricalcolati in questa wave** con la formula della luminanza
relativa di WCAG 2.2 su ogni coppia: i 26 valori ereditati dalla proposta 1
coincidono con quelli dichiarati, entro l'arrotondamento a due cifre. Non sono stati
arrotondati al rialzo né riscritti.

**Nessun colore è preso in prestito da altre proposte.** I tre prestiti raccomandati
in `ui-proposals.md` («Raccomandazione») riguardano comportamenti, non colori, e sono
trattati ai capitoli 5 e 6.

### 2.1 Tema chiaro

Fondo dell'applicazione `bg-app`; superficie di riferimento per il testo `bg-surface`.

| Token | HEX | Ruolo semantico | Contrasto | Fonte |
|---|---|---|---|---|
| `bg-app` | `#F4F6F9` | fondo dell'applicazione | — (fondo di riferimento) | proposta 1 |
| `bg-surface` | `#FFFFFF` | schede, tabelle, pannelli | 1.08:1 su `bg-app` — separazione **decorativa**, sempre rinforzata da `border` | proposta 1 |
| `surface-hover` | `#EEF2F7` | riga di tabella o voce sotto il puntatore | 1.12:1 su `bg-surface`; `text-primary` su di esso 14.44:1 | **[fissato in 1D-W7]** — la proposta 1 non dichiara il fondo di passaggio del puntatore, e la tabella è il componente centrale |
| `surface-selected` | `#E3EDF7` | riga selezionata, voce di navigazione attiva | 1.18:1 su `bg-surface`; `text-primary` 13.70:1; `accent` 6.65:1 | **[fissato in 1D-W7]**, stessa ragione. Non porta informazione da solo: la selezione è data anche dalla casella spuntata e dalla barra a sinistra |
| `text-primary` | `#17212E` | testo corrente, titoli | 16.24:1 su `bg-surface` · 15.00:1 su `bg-app` | proposta 1 |
| `text-secondary` | `#4E5A6B` | metadati, etichette, date | 7.00:1 su `bg-surface` · 6.23:1 su `surface-hover` | proposta 1 |
| `border` | `#D7DDE5` | separatori fra righe | 1.37:1 su `bg-surface` — **decorativo**, non porta informazione | proposta 1 |
| `border-strong` | `#7E8A99` | bordi di campi e caselle, confini informativi | 3.51:1 su `bg-surface` — supera 3:1 | proposta 1 |
| `accent` | `#14538F` | bottone principale, collegamenti, voce attiva | 7.88:1 su `bg-surface` | proposta 1 |
| `on-accent` | `#FFFFFF` | testo sopra `accent` | 7.88:1 su `accent` | proposta 1 |
| `accent-hover` | `#0F3F6D` | `accent` sotto il puntatore e alla pressione | 10.76:1 su `bg-surface` | proposta 1 |
| `focus-ring` | `#0A6FD1` | anello di fuoco, spessore 2 px, scostamento 2 px | 4.99:1 su `bg-surface` — supera 3:1 | proposta 1 |
| `success` | `#15693F` | stato «Pubblicata», conferme | 6.72:1 su `bg-surface` | proposta 1 |
| `warning` | `#8A5200` | stato «Bozza», avvisi | 6.39:1 su `bg-surface` | proposta 1 |
| `danger` | `#A3201A` | errori, eliminazioni | 7.56:1 su `bg-surface` | proposta 1 |
| `restricted` | `#6D28A8` | marcatore di contenuto riservato (barra, icona) | 8.34:1 su `bg-surface` | proposta 1 |
| `restricted-surface` | `#F2E9FB` | fondo del pannello di visibilità di un contenuto riservato | 1.18:1 su `bg-surface` — decorativo, rinforzato dalla barra `restricted` | proposta 1, §5 (dichiarato nel testo, non nella tabella) |
| `restricted-ink` | `#4B1C75` | testo dell'etichetta riservata su `restricted-surface` | 10.35:1 su `restricted-surface` | proposta 1 |

### 2.2 Tema scuro

| Token | HEX | Ruolo semantico | Contrasto | Fonte |
|---|---|---|---|---|
| `bg-app` | `#0F151C` | fondo dell'applicazione | — (fondo di riferimento) | proposta 1 |
| `bg-surface` | `#19212B` | schede e tabelle | 1.13:1 su `bg-app` — decorativo | proposta 1 |
| `surface-hover` | `#202A36` | riga sotto il puntatore | 1.12:1 su `bg-surface`; `text-primary` 12.23:1 | **[fissato in 1D-W7]** |
| `surface-selected` | `#23303F` | riga selezionata, voce attiva | 1.21:1 su `bg-surface`; `text-primary` 11.29:1; `accent` 6.29:1 | **[fissato in 1D-W7]** |
| `text-primary` | `#E7ECF2` | testo corrente | 13.66:1 su `bg-surface` | proposta 1 |
| `text-secondary` | `#A2AFBF` | metadati | 7.28:1 su `bg-surface` | proposta 1 |
| `border` | `#2E3945` | separatori | 1.38:1 su `bg-surface` — decorativo | proposta 1 |
| `border-strong` | `#6C7A8A` | bordi di campi, confini informativi | 3.70:1 su `bg-surface` — supera 3:1 | proposta 1 |
| `accent` | `#7FB6F0` | bottone principale, collegamenti, voce attiva | 7.61:1 su `bg-surface` | proposta 1 |
| `on-accent` | `#0F151C` | testo sopra `accent` | 8.61:1 su `accent` | proposta 1 |
| `accent-hover` | `#A6CCF5` | `accent` sotto il puntatore e alla pressione | 9.72:1 su `bg-surface`; `on-accent` su di esso 10.99:1 | **[fissato in 1D-W7]** — la proposta 1 dichiara `accent-hover` solo nel tema chiaro. Nel tema scuro lo stato di passaggio schiarisce, non scurisce |
| `focus-ring` | `#7FB6F0` | anello di fuoco | 8.61:1 su `bg-app` — supera 3:1 | proposta 1 |
| `success` | `#5FD39A` | stato «Pubblicata» | 8.71:1 su `bg-surface` | proposta 1 |
| `warning` | `#E2A33A` | stato «Bozza» | 7.37:1 su `bg-surface` | proposta 1 |
| `danger` | `#F08076` | errori | 6.23:1 su `bg-surface` | proposta 1 |
| `restricted` | `#C39BF0` | marcatore di contenuto riservato | 7.16:1 su `bg-surface` | proposta 1 |
| `restricted-surface` | `#2B1F3D` | fondo del pannello di visibilità riservata | 1.06:1 su `bg-surface` · 1.19:1 su `bg-app` — decorativo, come il corrispettivo chiaro | **[fissato in 1D-W7]** — mancava nel tema scuro |
| `restricted-ink` | `#D9C2F7` | testo dell'etichetta riservata | 9.52:1 su `restricted-surface` | **[fissato in 1D-W7]** — mancava nel tema scuro |

### 2.3 Regole d'uso dei token

1. **Diciotto nomi, due valori ciascuno.** I nomi non cambiano fra i temi: cambia
   solo il valore. Nessun componente conosce il tema; conosce solo il nome.
2. I token si dichiarano come **variabili CSS native** sull'elemento radice, con il
   tema scuro applicato da un attributo. Nessuna libreria di temi
   (`ui-proposals.md`, proposta 1 §9: «CSS con token in variabili native»).
3. `border` e le coppie superficie/superficie stanno sotto 3:1 **di proposito**:
   sono decorative. Dove un confine porta informazione — bordo di un campo, limite
   di un'area selezionabile — si usa `border-strong`
   (`ui-proposals.md`, «Nota di metodo»).
4. **Nessun colore esprime da solo uno stato.** Vale per `success`, `warning`,
   `danger`, `restricted` e per `surface-selected`. Vedi capitolo 9.
5. Nessun valore esadecimale compare nei componenti: solo nomi di token. È una
   regola verificabile da lint e va verificata.

### 2.4 Stato del tema scuro — **decisione richiesta, non presa qui**

HO-004 §7 elenca «tema scuro nel primo rilascio o solo predisposto» fra le domande
**rimandate a prima della Fase 1D**. La Fase 1D è adesso, quindi la domanda è
adesso. Non la decido io: è la **decisione 1** del capitolo 11.

Che cosa questo documento fa comunque, perché non costa nulla: definisce i token per
entrambi i temi. Che cosa **non** fa e non può fare senza la risposta: dichiarare il
tema scuro «supportato». Supportato significa verificato schermata per schermata, e
nessuna schermata esiste ancora.

---

## 3. Tipografia

### 3.1 Il carattere

**Inter**, versione variabile, **ospitata in proprio** (`woff2`, sottoinsieme
latino), con ripiego `system-ui, "Segoe UI", Roboto, sans-serif`.

Fonte: `ui-proposals.md`, proposta 1 §3 «Tipografia». La proposta 1 fissava già il
carattere, quindi DR-048 — che chiede «un carattere d'interfaccia distinto» senza
nominarlo — si attua senza inventare nulla.

**Verifica di distribuibilità, eseguita in questa wave.** Inter è pubblicato da
Rasmus Andersson con licenza **SIL Open Font License 1.1**, che consente
redistribuzione, incorporazione e installazione su un proprio server; il solo divieto
è la vendita del carattere in quanto tale. Fonte controllata: `github.com/rsms/inter`.

**Nessuna dipendenza da servizi esterni.** I file `woff2` stanno nel repository e sono
serviti da `apps/admin`. Non si usa Google Fonts né altro CDN di caratteri: l'area
amministrativa deve funzionare senza chiamate a terzi, e dopo il gate dovrà
funzionare da PWA installata (DR-030). Il file di licenza `OFL.txt` va incluso
accanto ai `woff2`: è una condizione della licenza, non una cortesia.

> La pagina `docs/design/chooser/index.html` carica i caratteri da Google Fonts.
> È uno strumento di scelta locale, non è l'applicazione, e non stabilisce un
> precedente.

**Un solo carattere, nessun secondario** (`ui-proposals.md`, proposta 1 §3): riduce il
peso scaricato e la manutenzione.

**Cifre tabellari** (`font-variant-numeric: tabular-nums`) obbligatorie su tutte le
colonne numeriche e su tutte le date, perché le tabelle sono il cuore di questa
interfaccia.

**Pesi in uso: 400, 500, 600, 700.** Il peso 300 è vietato: sotto i 14 px è
illeggibile per gli utenti più anziani (`ui-proposals.md`, proposta 1 §3).

### 3.2 Scala tipografica

Tutte le dimensioni provengono da `ui-proposals.md`, proposta 1 §3. L'equivalenza in
px vale alla dimensione radice predefinita del browser (16 px); i componenti usano
`rem`, mai `px`, così che lo zoom del browser funzioni.

| Token | rem | px | Interlinea | Peso | Uso |
|---|---|---|---|---|---|
| `text-xs` | 0.75 | 12 | 1.3 | 600 | intestazioni di colonna, pastiglie di stato, etichette in maiuscoletto |
| `text-sm` | 0.8125 | 13 | 1.45 | 400 | metadati, testo di aiuto sotto i campi, righe del registro |
| `text-base` | 0.875 | 14 | 1.5 | 400 | corpo dell'interfaccia, celle di tabella, valore dei campi |
| `text-md` | 1 | 16 | 1.6 | 400 | testo dentro l'editor di contenuto |
| `text-lg` | 1.125 | 18 | 1.35 | 600 | titolo di sezione, intestazione di pannello |
| `text-xl` | 1.375 | 22 | 1.3 | 600 | titolo di schermata |
| `text-2xl` | 1.75 | 28 | 1.25 | 700 | titolo di area |

**Perché il testo dell'editor è più grande del resto** (16 px contro 14 px): dentro
l'editor si legge prosa destinata al pubblico, non dati. È una scelta della proposta 1
e va mantenuta: è anche il punto in cui il redattore passa più tempo.

**Maiuscoletto**: `text-xs` con spaziatura fra lettere 0.04em e peso 600, usato solo
per le etichette di gruppo nella colonna delle sezioni e per le pastiglie di stato.
**[fissato in 1D-W7]** — la proposta 1 cita il maiuscoletto senza dichiarare la
spaziatura; senza un valore due componenti la scriverebbero diversa.

---

## 4. Griglia e spaziatura

Tutti i valori di questo capitolo provengono da `ui-proposals.md`, proposta 1 §4,
tranne dove indicato.

### 4.1 Unità e scala

- **Unità di base: 4 px.** Ogni spaziatura è un multiplo di 4.
- **Scala:** `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 ·
  `space-8` 32 · `space-12` 48 · `space-16` 64.
- **Raggio degli angoli:** 4 px su bottoni, campi, pastiglie e schede. Un solo
  valore. **[fissato in 1D-W7]** — la proposta 1 dichiara 4 px per i bottoni e tace
  sul resto; un secondo raggio comparirebbe per caso.

### 4.2 Larghezze

| Elemento | Larghezza | Nota |
|---|---|---|
| Colonna delle aree (prima colonna) | 56 px | sola icona, etichetta al passaggio e alla messa a fuoco |
| Colonna delle sezioni (seconda colonna) | 240 px | richiudibile a 0, la scelta è ricordata |
| Area di lavoro | fluida, massimo 1440 px | |
| Pannello di ispezione a destra | 320 px | |
| Pannello laterale a scorrimento | 480 px | sostituisce la finestra di dialogo per tutto ciò che non è una conferma breve |
| Colonna di lettura dell'editor | massimo 68 caratteri | **[fissato in 1D-W7]** — la proposta 1 non fissa una misura di riga per l'editor. Oltre i 70–75 caratteri la lettura di prosa peggiora, e l'editor è l'unico posto dove si legge prosa |

Le due colonne di navigazione tolgono **296 px** alla larghezza utile. È il rischio
secondario dichiarato dalla proposta 1 (§9): la mitigazione è che la colonna delle
sezioni si richiude e la scelta è ricordata.

### 4.3 Punti di rottura

| Nome | Larghezza | Comportamento |
|---|---|---|
| `bp-sm` | 600 px | sotto: le due colonne scompaiono, barra superiore più barra inferiore con le voci più usate, le tabelle diventano schede impilate (`ui-proposals.md`, proposta 1 §7) |
| `bp-md` | 900 px | sotto: i moduli a due colonne diventano una colonna sola |
| `bp-lg` | 1200 px | sotto: il pannello di ispezione si richiude in una scheda |
| `bp-xl` | 1600 px | sopra: l'area di lavoro resta a 1440 px e si centra |

---

## 5. Densità

La proposta 1 è densa per scelta: è un banco di lavoro per chi entra tutti i giorni
(`ui-proposals.md`, proposta 1 §1).

| Grandezza | Densità compatta | Densità comoda | Fonte |
|---|---|---|---|
| Altezza di riga di tabella | 36 px | 44 px | proposta 1 §4 |
| Altezza di bottone e di campo | 36 px | 40 px | proposta 1 §5 |
| Spaziatura verticale fra campi | `space-3` (12) | `space-4` (16) | **[fissato in 1D-W7]** |
| Spaziatura orizzontale nelle celle | `space-3` (12) | `space-4` (16) | **[fissato in 1D-W7]** |

**Il valore predefinito è «comoda»** (proposta 1 §4). È il primo dei tre prestiti
dalla proposta 2 «Accoglienza» raccomandati in `ui-proposals.md`, ed è la mitigazione
del rischio principale di «Scrivania»: la densità che intimidisce chi entra due volte
l'anno. L'utente può passare a «compatta» e la scelta è ricordata.

### 5.1 Densità e accessibilità: come convivono

La riga può scendere a 36 px; **il bersaglio di clic non scende mai sotto 44×44 px**.
I due numeri non sono in conflitto perché l'area attiva si estende oltre il riquadro
disegnato (`ui-proposals.md`, proposta 1 §8).

Regole vincolanti, valide in **entrambe** le densità:

1. Bersaglio minimo 44×44 px per ogni elemento attivabile con il dito.
2. Spaziatura minima 8 px fra due bersagli adiacenti.
3. L'anello di fuoco è spesso 2 px con scostamento 2 px: la densità compatta non lo
   comprime e non lo taglia. Le righe devono lasciare spazio all'anello.
4. La densità **non** cambia la dimensione del testo: cambia la spaziatura. Ridurre
   il corpo sotto 14 px per guadagnare righe è vietato.
5. La scelta della densità è una preferenza della persona, non dell'organizzazione,
   e non modifica quali dati si vedono.

---

## 6. Inventario dei componenti di `packages/ui`

`packages/ui` contiene i componenti dell'area amministrativa e **non** è importato
dal sito pubblico (ADR-008 §3.1, §3.3 regola 3, verificato da lint).

I componenti di **resa dei 14 blocchi** non stanno qui: stanno in `packages/blocks`,
condiviso fra sito e amministrazione, perché ADR-006 §3.3 impone che l'anteprima usi
gli stessi componenti del sito pubblico. `packages/ui` fornisce il **contenitore**
dell'anteprima, non ciò che vi si disegna dentro.

**Legenda degli stati.** R riposo · H passaggio del puntatore · F fuoco da tastiera ·
A attivo o premuto · D disabilitato · L in caricamento · E errore · V vuoto ·
S selezionato. Uno stato assente significa che il componente non lo ha.

La colonna «Serve in» dice la wave che lo usa per prima. Tutti sono costruiti in
`1D-W7`.

| # | Nome | Che cosa fa | Stati | Serve in |
|---|---|---|---|---|
| 1 | `AppShell` | guscio a due colonne di navigazione più barra superiore, area di lavoro e barra di registro in fondo; gestisce il richiudersi della seconda colonna e i punti di rottura | R, L | `1D-W8` |
| 2 | `AreaNav` | prima colonna, 56 px: le aree esistenti come icona con etichetta al passaggio e alla messa a fuoco; la voce attiva ha barra piena 3 px a sinistra e peso 600 | R, H, F, A, S | `1D-W8` |
| 3 | `SectionNav` | seconda colonna, 240 px: le sezioni dell'area attiva, raggruppate sotto etichette in maiuscoletto; richiudibile con memoria della scelta | R, H, F, A, S, V | `1D-W8` |
| 4 | `TopBar` | barra superiore **chiara**, mai scura (DR-018): briciole di pane, ricerca, menu della persona | R, L | `1D-W8` |
| 5 | `Breadcrumbs` | percorso «Area / Sezione / Oggetto», ultimo elemento non cliccabile | R, H, F | `1D-W8` |
| 6 | `UserMenu` | menu della persona in alto a destra: nome, dati dell'account, disconnessione. **Non** contiene un commutatore di ruolo (DR-047, vedi capitolo 8) | R, H, F, A | `1D-W8` |
| 7 | `CommandSearch` | ricerca e comandi con `Ctrl+K`, come **acceleratore** e mai come unica via di navigazione (prestito dalla proposta 3 «Comando») | R, F, L, V, E | `1D-W9` |
| 8 | `PageHeader` | intestazione di schermata: titolo, riga di riepilogo, azione principale a destra | R, L | `1D-W8` |
| 9 | `Button` | bottone principale (pieno `accent`), secondario (bordo `border-strong`), terziario (solo testo), distruttivo (secondario con testo `danger`) | R, H, F, A, D, L | `1D-W8` |
| 10 | `IconButton` | bottone di sola icona con etichetta accessibile obbligatoria e suggerimento al passaggio | R, H, F, A, D | `1D-W8` |
| 11 | `DataTable` | tabella densa: intestazione fissa allo scorrimento, ordinamento sulle intestazioni, selezione multipla, cifre tabellari, nessuna zebratura, colonne che si nascondono per priorità sotto `bp-lg`; sotto `bp-sm` diventa schede impilate | R, H, F, S, L, V, E | `1D-W8` |
| 12 | `TableToolbar` | riga di filtri sopra la tabella: ricerca, stato, autore, ordinamento; conteggio dei filtri attivi | R, F, D, V | `1D-W8` |
| 13 | `BulkActionBar` | sostituisce `TableToolbar` quando c'è una selezione: conteggio, azioni di gruppo, annulla selezione | R, H, F, D, L | `1D-W9` |
| 14 | `Pagination` | impaginazione numerata con scelta degli elementi per pagina | R, H, F, D | `1D-W8` |
| 15 | `EmptyState` | titolo, una frase che spiega che cosa contiene la sezione, azione di creazione, collegamento alla guida. **Mai solo un disegno** | R | `1D-W8` |
| 16 | `TextField` | campo di testo a riga singola con etichetta **sopra** il campo (mai dentro) e testo di aiuto **permanente** sotto | R, H, F, D, E, L | `1D-W8` |
| 17 | `TextArea` | campo di testo a più righe, altezza crescente con il contenuto | R, H, F, D, E | `1D-W8` |
| 18 | `SelectField` | scelta da elenco chiuso, con ricerca sopra le dieci voci | R, H, F, A, D, E, L, V | `1D-W8` |
| 19 | `CheckboxField` | casella singola e casella di riga di tabella, con stato indeterminato | R, H, F, A, D, E, S | `1D-W8` |
| 20 | `RadioGroup` | scelta esclusiva; usata dal pannello di visibilità del contenuto | R, H, F, A, D, E, S | `1D-W8` |
| 21 | `DateTimeField` | data e ora della pubblicazione, cifre tabellari, immissione da tastiera sempre possibile | R, H, F, D, E | `1D-W8` |
| 22 | `FieldGroup` | gruppo di campi con titolo in maiuscoletto e descrizione; è il mattone dei pannelli «PUBBLICAZIONE», «VISIBILITÀ», «SEO» | R, D | `1D-W8` |
| 23 | `FormLayout` | due colonne sopra `bp-md` (contenuto a sinistra, attributi a destra), una colonna sotto | R | `1D-W8` |
| 24 | `SaveBar` | barra fissa in fondo che dichiara **sempre** lo stato: «Salvato 2 minuti fa», «Modifiche non salvate»; contiene salva, anteprima, pubblica | R, D, L, E | `1D-W8` |
| 25 | `Alert` | riquadro di avviso in linea con bordo sinistro 2 px, icona, titolo, spiegazione in italiano corrente e azione di recupero; varianti informazione, attenzione, errore, successo | R, E | `1D-W8` |
| 26 | `Toast` | striscia sotto la barra superiore per l'esito delle azioni: persistente per gli errori, 6 secondi per le conferme. **Mai l'unico posto in cui compare un errore** | R, H, F | `1D-W8` |
| 27 | `Dialog` | finestra di dialogo modale, riservata alle conferme brevi e alle scelte che bloccano: fuoco intrappolato, chiusura con Esc, ritorno del fuoco all'elemento che l'ha aperta | R, F, L | `1D-W8` |
| 28 | `SidePanel` | pannello da destra, 480 px, per tutto ciò che non è una conferma breve; non nasconde la tabella | R, F, L, E | `1D-W8` |
| 29 | `ConfirmDestructive` | conferma di eliminazione definitiva **con digitazione** del nome dell'oggetto | R, F, D, L, E | `1D-W9` |
| 30 | `PublishStatusBadge` | pastiglia di stato di pubblicazione: bordo 1 px, `text-xs` in maiuscoletto, puntino pieno a sinistra. Il **testo** dice lo stato («Pubblicata», «Bozza», «Programmata», «Ritirata»), il colore lo accompagna | R | `1D-W8` |
| 31 | `RestrictedMarker` | marcatore di contenuto riservato: barra piena `restricted` **spessa 4 px su tutto il lato sinistro** della riga o della scheda, etichetta testuale `RISERVATO` e icona di lucchetto. Il lato intero è il prestito dalla proposta 4 «Quaderno» | R | `1D-W8` |
| 32 | `VisibilityPanel` | pannello di visibilità di un contenuto: fondo `restricted-surface` e testo `restricted-ink` quando la scelta è «riservato»; riga fissa che ricorda chi può vedere il record | R, F, D, E, S | `1D-W8` |
| 33 | `MediaPicker` | selettore di media: griglia con ricerca e filtri, anteprima, testo alternativo obbligatorio alla scelta; apre in `SidePanel`, non in `Dialog` | R, H, F, A, S, L, V, E | `1D-W8` |
| 34 | `MediaUploader` | caricamento con trascinamento e da pulsante, avanzamento per file, errori per file | R, H, F, D, L, E | `1D-W9` |
| 35 | `PreviewPane` | riquadro di anteprima: contenitore, commutatore schermo/telefono, aggiornamento. Ciò che disegna dentro viene da `packages/blocks` (ADR-006 §3.3): l'anteprima **è** il sito, non una sua riproduzione | R, L, E | `1D-W8` |
| 36 | `BlockTreeEditor` | editor dell'albero dei blocchi di ADR-005: aggiunge, sposta, elimina e annida blocchi dentro una colonna; ambito limitato da ADR-006 §3.2 | R, H, F, A, D, S, L, V, E | `1D-W8` |
| 37 | `BlockInserter` | «Aggiungi blocco»: elenco dei 14 tipi di ADR-005 §3.2 con ricerca; l'insieme è **chiuso** e non si allarga in Fase 1 | R, H, F, V | `1D-W8` |
| 38 | `ColumnRatioControl` | cambia la ripartizione delle colonne di una riga; è l'unica modifica di impaginazione ammessa in Fase 1 (ADR-006 §3.2) | R, H, F, A, D | `1D-W8` |
| 39 | `RichTextToolbar` | barra degli strumenti del testo ricco sopra un blocco `rich_text`: solo i comandi che corrispondono agli elementi ammessi da ADR-005 §3.5. `h1` assente, stile in linea assente. L'incollaggio non ammesso è **rifiutato con avviso visibile**, mai riscritto in silenzio (ADR-006 §3.1) | R, H, F, A, D, S | `1D-W8` |
| 40 | `HtmlFallbackEditor` | editor del blocco di riserva `html`: area di testo con evidenziazione della sintassi, **non** testo ricco, con avviso permanente «questo blocco non è stato convertito, modificarlo può alterare la resa» (ADR-006 §3.4) | R, F, D, E | `1D-W8` |
| 41 | `MenuTreeEditor` | albero del menu di navigazione del sito: sposta, annida, collega a un contenuto o a un indirizzo | R, H, F, A, D, S, V, E | `1D-W9` |
| 42 | `SeoPanel` | titolo, descrizione, immagine di condivisione, con conteggio dei caratteri e anteprima del risultato di ricerca | R, F, D, E | `1D-W9` |
| 43 | `AuditTrail` | storia breve in fondo alla scheda dell'oggetto e registro esteso di area, scritto in frasi compiute e non in righe tecniche (innesto dalla proposta D, `ux-proposals.md` §9) | R, L, V | `1D-W9` |
| 44 | `DensityToggle` | passa fra densità comoda e compatta e ricorda la scelta | R, H, F, A, S | `1D-W9` |
| 45 | `Tabs` | schede dentro una sezione, quando le sottosezioni sono poche e paritetiche | R, H, F, A, S | `1D-W9` |
| 46 | `Tooltip` | suggerimento al passaggio **e alla messa a fuoco**; mai l'unico veicolo di un'informazione necessaria | R, F | `1D-W8` |
| 47 | `Spinner` | indicatore di attesa con testo accompagnatorio; per le tabelle si preferisce la sagoma di caricamento | R | `1D-W8` |
| 48 | `SkipLink` | «Vai al contenuto», primo elemento focalizzabile di ogni schermata | R, F | `1D-W8` |
| 49 | `GuidedFlow` | percorso a passi numerati, riservato alle **operazioni rare e delicate**, mai a quelle quotidiane (prestito dalla proposta 2 «Accoglienza»). In Fase 1 non ha ancora un caso d'uso obbligato | R, F, D, L, E | `1D-W9` |

**49 componenti: 37 servono in `1D-W8`, 12 in `1D-W9`.**

### 6.1 Librerie ammesse

Da `ui-proposals.md`, proposta 1 §9: **Radix UI Primitives** (componenti non
stilizzati e accessibili: menu, dialoghi, pannelli, selettori) e **TanStack Table v8**
(sola logica di tabella). Lo stile è interamente proprio, in variabili CSS native.

**Nessuna libreria di componenti già vestita.** È la garanzia pratica di DR-018:
un'interfaccia vestita da altri assomiglia a ciò che quegli altri hanno vestito.

Per l'editor: `@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit` e le sole
estensioni necessarie, come deciso da ADR-006 §5.

---

## 7. Architettura dell'informazione

Dalla proposta B (`ux-proposals.md` §4.2). Il primo livello di navigazione sono le
**aree**; dentro un'area stanno le sezioni.

### 7.1 Le sei aree a regime

`Redazione` · `Segreteria` · `Tesoreria` · `Formazione` · `Consulenza` · `Direzione`.

DR-046 conferma che questa ripartizione corrisponde a come il Centro si organizza:
era la domanda che poteva ribaltare la raccomandazione, e non la ribalta.

### 7.2 Che cosa esiste in Fase 1

**Due aree e nient'altro.**

| Area | Sezioni in Fase 1 | Fonte |
|---|---|---|
| **Redazione** | Situazione dell'area · Pagine · Notizie · Media · Menu · SEO e indirizzi | `ux-proposals.md` §4.2 versione 1; ADR-006 §3.2 per il perimetro |
| **Impostazioni** | Persone e permessi · Registro delle operazioni · Impostazioni del sito | `ux-proposals.md` §4.2 chiamava quest'area «Direzione» |

**Il nome «Impostazioni» invece di «Direzione» è [fissato in 1D-W7].** Motivo: con
DR-047 non esiste più una veste che si indossa, e «Direzione» nominava una veste. Ciò
che resta in Fase 1 è un insieme di impostazioni di sistema — chi può fare cosa, che
cosa è successo, come è configurato il sito — e chiamarlo per quello che è evita di
promettere un'area di direzione che non esiste. È la **decisione 4** del capitolo 11.

### 7.3 Le altre quattro aree non si mostrano affatto

**Scelta: non compaiono nella navigazione. Né attive, né disabilitate, né marcate
«in arrivo».**

Motivazione, in ordine di peso:

1. **Il gate.** `CLAUDE.md` vieta di **pianificare** — non solo di realizzare —
   qualunque fase gestionale prima della parità approvata e del deploy verificato.
   Una voce «Tesoreria (in arrivo)» è una promessa di pianificazione fatta
   nell'interfaccia, e sarebbe il gate scavalcato di fatto.
2. **La proposta B lo prescrive già.** «Le aree non possedute non compaiono»
   (`ux-proposals.md` §4.2): nessuna persona possiede aree che non esistono.
3. **Chi ha una sola area non vede nemmeno la scelta** (`ux-proposals.md` §4.3): in
   Fase 1 quasi tutti hanno solo Redazione, e per loro il sistema è semplicemente più
   piccolo. Quattro voci spente lo renderebbero più grande senza dare nulla.

**Divergenza dichiarata.** Il mockup della proposta 1 (`ui-proposals.md` §6) mostra
nove moduli con il gruppo «GESTIONE». È un mockup **a regime**, non di Fase 1, ed è
corretto così nel suo documento. In Fase 1 quel gruppo non esiste.

### 7.4 Come si naviga

1. **Ingresso.** Chi possiede una sola area entra direttamente nella sua «Situazione
   dell'area». Chi ne possiede più d'una vede la schermata di scelta, con un conteggio
   in chiaro per riquadro (`ux-proposals.md` §4.2). In Fase 1 la schermata di scelta
   compare a pochissime persone, e va costruita comunque perché è il primo livello
   dell'architettura.
2. **Prima colonna:** le aree possedute. **Seconda colonna:** le sezioni dell'area
   attiva. La seconda colonna cambia interamente al cambio di area: è la struttura
   resa visibile, ed è la ragione per cui la matrice di `ux-proposals.md` §8 dichiara
   questo accoppiamento «ottimo».
3. **Briciole di pane** sempre presenti: «Redazione / Pagine / Chi siamo».
4. **`Ctrl+K`** raggiunge qualunque sezione e qualunque oggetto. È un acceleratore: i
   due menu restano, sempre.
5. **Rimando fra aree esplicito.** Se da un'area serve un dato che vive in un'altra,
   compare un rimando dichiarato, mai un salto silenzioso (`ux-proposals.md` §4.3).
6. **Sotto `bp-sm`:** una sola area per volta a schermo intero, con il cambio d'area
   in un menu esplicito (`ux-proposals.md` §4.7).
7. **Innesto dalla proposta D:** la «Situazione dell'area» porta in cima la riga «In
   questo periodo dell'anno di solito si fa…». È l'elemento che meglio risolve il
   rientro dopo sei mesi (`ux-proposals.md` §9) e non richiede alcuna architettura
   temporale: basta una tabella di ricorrenze per area.

---

## 8. Ruoli e permessi in interfaccia

### 8.1 Che cosa impone DR-047

Tutti i ruoli di una persona sono attivi insieme. I permessi sono l'**unione** di
quelli dei suoi ruoli. **Non esiste commutazione di ruolo.**

Conseguenze dirette sull'interfaccia, tutte da attuare in `packages/ui`:

1. **Non esiste il selettore di ruolo.** La pastiglia «Ruolo: REDAZIONE» descritta in
   `ui-proposals.md`, proposta 1 §5, **non si costruisce**. Al suo posto, nella stessa
   posizione in alto a destra, c'è `UserMenu`: nome della persona, account,
   disconnessione.
2. **Non esiste la barra «Stai lavorando come…»** di `ux-proposals.md` §4.3. Nessuna
   schermata dichiara una veste attiva, perché non ce n'è una.
3. **L'intestazione di schermata dichiara il luogo, non la veste.** `PageHeader` e
   `Breadcrumbs` dicono «Redazione / Pagine»: è una posizione nella navigazione, non
   un ruolo indossato. È una differenza di sostanza, non di parole.
4. **Nessuna striscia di cambio ruolo.** La conferma di 4 secondi dopo la
   commutazione, prevista dalla proposta 1 §5, non ha più oggetto.
5. **Il registro delle operazioni non può attribuire un'azione al ruolo con cui è
   stata compiuta**, perché non esiste un ruolo attivo. Registra **chi**, **che
   cosa**, **quando** e **in quale area della navigazione** si trovava. Il registro
   delle decisioni lo dichiara già come conseguenza di DR-047 (§9, note sul Round 5).
6. **Che cosa vede una persona con più ruoli:** tutte le aree per cui possiede almeno
   un permesso, tutte insieme, nella prima colonna; dentro ogni area, tutte le sezioni
   per cui possiede almeno un permesso. Nessuna scelta da compiere all'ingresso se le
   aree sono più d'una — solo la schermata con i conteggi, che resta un punto di
   partenza e non un interruttore.
7. **I permessi, non i nomi dei ruoli, decidono che cosa si vede.** È già quanto
   ADR-007 §3.2 prescrive: le autorizzazioni si esprimono come permessi
   (`content.read`, `content.write`, `content.publish`, `media.write`,
   `settings.write`), mai come confronti sul nome del ruolo.
8. **Un'azione non permessa non si mostra disabilitata: non si mostra.** Un bottone
   spento comunica l'esistenza di una funzione a chi non deve averla.
   **[fissato in 1D-W7]** — né le proposte né le ADR lo dicono; senza una regola, metà
   dei componenti nasconderebbe e metà disabiliterebbe. È la **decisione 7**.

### 8.2 La tensione fra DR-045 e DR-047 — **dichiarata, non risolta**

**Il problema.** La proposta B nasce sull'idea che scegliere una veste **riconfiguri
l'ambiente**, e arriva a legare la sessione all'area: «finché si sta in Tesoreria il
sistema rifiuta di restituire dati di Consulenza *anche se l'account di quella persona
avrebbe il permesso*» (`ux-proposals.md` §4.4 punto 2). DR-047 esclude la
commutazione. Se non c'è commutazione, non c'è un'area in cui «stare», e quel
meccanismo non ha su che cosa appoggiarsi.

**La lettura proposta.** Le aree restano **navigazione e raggruppamento**, non
**permesso**:

- l'area dice **dove si trova** un oggetto e **dove si trova** la persona che naviga;
- il permesso dice **che cosa** quella persona può fare su quell'oggetto, e viene
  dall'unione dei suoi ruoli;
- le due cose non si sovrappongono e non si sostituiscono: si può essere in un'area e
  non poter fare tutto ciò che vi si trova.

**Perché è coerente con entrambe le risposte.** Con DR-045, perché conserva ciò che la
proposta B fa meglio delle altre tre: un primo livello che cresce di quattro voci
invece che di nove, un vocabolario che chiunque capisce, aree indipendenti che si
costruiscono una per volta senza toccare le precedenti (`ux-proposals.md` §9, ragioni
2, 3 e 4). Con DR-047, perché non introduce alcuno stato di sessione che dipenda da
una scelta dell'utente, e quindi nessuna commutazione.

**Che cosa si perde, detto apertamente.** Si perde la ragione numero 1 per cui la
proposta B era raccomandata: la riservatezza come separazione di ambiente
(`ux-proposals.md` §9). Con la lettura proposta, la riservatezza torna a essere una
regola di permesso applicata a dati che convivono — che è il modello delle proposte A,
C e D. Per un consultorio familiare questo è un arretramento, e va saputo **adesso**,
non quando l'area Consulenza verrà costruita dopo il gate.

**Che cosa resta possibile.** La separazione di ambiente si può recuperare più tardi
senza reintrodurre la commutazione di ruolo: per esempio con una **soglia di ingresso**
all'area riservata — una conferma esplicita, registrata sempre, che apre un contesto a
tempo — che è un gesto diverso dallo scegliere una veste. Non è deciso, non è
progettato e non si progetta qui: la fase gestionale è bloccata dal gate.

**Stato: non approvata.** È la **decisione 2** del capitolo 11 ed è già aperta nel
registro («Lettura delle aree come navigazione», termine: prima della wave `1D-W8`).
In Fase 1 esistono solo Redazione e Impostazioni, quindi oggi la tensione ha effetti
limitati — ma la lettura scelta oggi è quella su cui si costruisce `packages/ui`.

---

## 9. Accessibilità

### 9.1 Livello a cui si punta

**WCAG 2.2 livello AA.** È il criterio già usato per valutare le quattro proposte
(`ui-proposals.md`, «Criteri di valutazione comuni») ed è quello con cui sono stati
calcolati i contrasti del capitolo 2.

«Si punta» è letterale: è l'obiettivo di progetto, non una conformità dichiarata.
Vedi §9.7.

### 9.2 Contrasti minimi

| Che cosa | Minimo | Dove è verificato |
|---|---|---|
| Testo corrente e metadati | 4.5:1 | capitolo 2, ogni riga |
| Testo grande (almeno 18.66 px in peso 700, oppure 24 px) | 3:1 | soddisfatto con margine da `text-primary` |
| Bordi informativi, icone che portano significato, anello di fuoco | 3:1 | `border-strong` e `focus-ring`, capitolo 2 |
| Superfici decorative (`border`, `surface-hover`, `restricted-surface`) | nessuno | sono decorative **e dichiarate tali**: non portano mai da sole un'informazione |

### 9.3 Fuoco e tastiera

- **Anello di fuoco** `focus-ring`, 2 px con scostamento 2 px, **mai rimosso**. Sopra
  i bottoni pieni è doppio (interno chiaro, esterno scuro) perché resti visibile
  (`ui-proposals.md`, proposta 1 §8).
- **Ordine di tabulazione uguale all'ordine visivo.** Nessun `tabindex` positivo.
  Nell'`AppShell` l'ordine è: `SkipLink`, `TopBar`, `AreaNav`, `SectionNav`, area di
  lavoro, `SaveBar`.
- **`SkipLink` «Vai al contenuto»** è il primo elemento focalizzabile di ogni
  schermata.
- **Ogni operazione si completa da sola tastiera**, editor compreso. `Dialog` e
  `SidePanel` intrappolano il fuoco, si chiudono con Esc e restituiscono il fuoco
  all'elemento che li ha aperti.
- **Nessuna scorciatoia a tasto singolo** che non si possa disattivare o rimappare:
  `Ctrl+K` è una combinazione, e va bene.

### 9.4 Movimento

Transizioni 120–180 ms, solo opacità e traslazione. Con
`prefers-reduced-motion: reduce` scorrimenti e animazioni dei pannelli sono
**azzerati**: i pannelli compaiono istantaneamente (`ui-proposals.md`, proposta 1 §8).
Nessun contenuto che lampeggia, scorre da solo o si muove in continuo.

### 9.5 Testi alternativi

- Il testo alternativo è **obbligatorio** al momento in cui un'immagine entra nel
  contenuto: `MediaPicker` non lascia scegliere un media senza di esso.
- L'immagine puramente decorativa si dichiara tale con una spunta esplicita, che
  produce `alt=""`. Dichiararlo è un gesto, non un'omissione.
- Ogni `IconButton` ha un'etichetta accessibile testuale, sempre, anche quando mostra
  un suggerimento al passaggio.
- Gli stati di caricamento e gli esiti delle azioni si annunciano alle tecnologie
  assistive con una regione dinamica; `Toast` non è mai l'unico posto in cui compare
  un errore.

### 9.6 Il colore non è mai l'unico veicolo — regola vietante

| Informazione | Veicolo primario | Veicolo secondario | Colore |
|---|---|---|---|
| Stato di pubblicazione | parola intera: «Pubblicata», «Bozza», «Programmata», «Ritirata» | puntino pieno e bordo della pastiglia | terzo segnale |
| Contenuto riservato | etichetta `RISERVATO` | barra 4 px su tutto il lato sinistro, icona di lucchetto | terzo segnale |
| Voce di navigazione attiva | peso 600 | barra piena 3 px a sinistra | terzo segnale |
| Riga selezionata | casella spuntata | conteggio nella `BulkActionBar` | terzo segnale |
| Campo in errore | messaggio testuale sotto il campo | icona nel campo, bordo `danger` più spesso | terzo segnale |

**La prova di controllo è la schermata in scala di grigi** (`ui-proposals.md`,
proposta 1 §8): se un'informazione sparisce, la schermata è sbagliata, non il monitor.

### 9.7 Che cosa **non** è verificato

Dichiarato perché nessuno lo dia per fatto:

1. **Nessuna prova con lettori di schermo reali** (NVDA, VoiceOver, JAWS). I contrasti
   si calcolano; il resto si prova, e non è stato provato perché non esiste ancora
   nulla da provare.
2. **Nessuna prova con persone reali**, né esperte né volontarie del Centro.
3. **Nessuna verifica dello zoom al 200 %**: la proposta 1 §8 dichiara l'obiettivo,
   questo documento lo recepisce, ma la verifica avviene su schermate costruite.
4. **Nessuna prova di simulazione delle alterazioni della visione dei colori** oltre
   la scala di grigi.
5. **Nessun contrasto verificato sul tema scuro in uso**: i rapporti sono calcolati, le
   schermate non esistono. È una delle ragioni della decisione 1.
6. **Nessuna dichiarazione di conformità.** Questo documento fissa obiettivi
   verificabili; la conformità si dichiara solo dopo un audit, e l'audit di
   accessibilità dell'area amministrativa non è ancora pianificato.

---

## 10. Che cosa questo sistema di design **non** copre

| Fuori ambito | Perché | Dove sta o starà |
|---|---|---|
| **Il sito pubblico** | i suoi token non si scelgono: si **ricavano** dalla sorgente WordPress in Fase 1E, perché DR-014 impone la parità pixel-perfect. Sono un'altra cosa e non devono convergere con questi (DR-018) | Fase 1E; `apps/web` |
| **Il carattere del sito pubblico** | resta Open Sans, che viene dalla sorgente. DR-048 separa i due caratteri di proposito | Fase 1E |
| **I componenti di resa dei 14 blocchi** | stanno in `packages/blocks` e sono condivisi fra sito e amministrazione, perché l'anteprima deve essere identica al sito (ADR-006 §3.3) | `packages/blocks`, wave `1D-W1` |
| **Le quattro aree gestionali** (Segreteria, Tesoreria, Formazione, Consulenza) | bloccate dal gate: non si pianificano, non si progettano, non si mostrano | dopo il gate |
| **La PWA e il comportamento fuori linea** | DR-030 la limita all'area amministrativa e il gate la colloca dopo. Questo documento fissa il comportamento sotto `bp-sm`, che è un'altra cosa | dopo il gate |
| **Il secondo fattore, gli inviti, il recupero password** | fuori perimetro in Fase 1 per ADR-007 §3.1 punto 11 e §3.2 | riesame di ADR-007 §3.3 |
| **La separazione di ambiente per i dati riservati** | dipende dalla decisione 2 e riguarda aree che non esistono in Fase 1 | dopo il gate |
| **Le email transazionali e la loro impaginazione** | conferma obbligatoria prima di qualunque configurazione o invio | Fase 1F |

---

## 11. Assunzioni vietate e decisioni richieste

Nessuna di queste ha un valore predefinito. **Nessuna si considera presa per
silenzio.** Ognuna va registrata in `docs/decisions/decision-register.md` prima che la
wave `1D-W8` la dia per acquisita.

---

### Decisione 1 — Il tema scuro nel primo rilascio

Rimandata da HO-004 §7 «a prima della Fase 1D». È adesso.

| Opzioni | |
|---|---|
| **(a)** realizzato e verificato fin dal primo rilascio | |
| **(b)** token definiti ora, verifica visiva e realizzazione dopo il primo rilascio | |
| **(c)** non previsto: si definisce solo il tema chiaro | |

**Raccomandazione: (b).** Il costo dei token è già stato sostenuto — le due tabelle
del capitolo 2 sono complete e i 36 valori sono calcolati. Il costo che resta è la
**verifica**, che è schermata per schermata e non si può anticipare a schermate che non
esistono. Aggiungere i token dopo, invece, costa caro: significa rileggere ogni
componente.

**Impatto.** Con (a): circa 2–3 giornate di verifica e correzione sul primo modulo,
sottratte alla parità del sito, che è ciò che il gate misura (`ui-proposals.md`, «Cosa
serve dall'utente per decidere», domanda 4). Con (b): l'area amministrativa esce solo
in tema chiaro e non si dichiara «supporta il tema scuro». Con (c): i 18 valori scuri
si cancellano e rientrano più tardi a costo pieno.

**Compresa in questa decisione:** l'approvazione dei cinque token scuri **[fissati in
1D-W7]** — `surface-hover`, `surface-selected`, `accent-hover`, `restricted-surface`,
`restricted-ink` — che nella proposta 1 mancavano.

*Default vietato: non si dichiara il tema scuro supportato senza averlo verificato
schermata per schermata.*

---

### Decisione 2 — La lettura delle aree

La tensione del capitolo 8.2. Già aperta nel registro delle decisioni (§9, «Decisioni
rimaste aperte dopo il Round 5»), con termine «prima della wave `1D-W8`».

| Opzioni | |
|---|---|
| **(a)** le aree sono **navigazione e raggruppamento**; i permessi sono l'unione dei ruoli e valgono ovunque | |
| **(b)** le aree sono anche **contesto di permesso**: entrare in un'area restringe ciò che la sessione può leggere, anche se il permesso ci sarebbe | |
| **(c)** ibrido: (a) per le aree ordinarie, (b) per la sola area riservata, quando esisterà | |

**Raccomandazione: (a) per la Fase 1, con (c) da riesaminare prima della fase
gestionale.** (a) è l'unica lettura che non reintroduce una commutazione, e DR-047 la
esclude. (b) è ciò che la proposta B descrive, ma richiede uno stato di sessione scelto
dall'utente: è commutazione con un altro nome. (c) conserva la ragione principale per
cui B è stata raccomandata, ma riguarda l'area Consulenza, che è bloccata dal gate e
**non si progetta ora**.

**Impatto.** Determina se `packages/ui` deve prevedere un contesto di area nelle
richieste, e se il registro delle operazioni registra l'area come fatto di navigazione
o come fatto di autorizzazione. Con (a) si perde la riservatezza come separazione di
ambiente, che era la ragione numero 1 della raccomandazione di B.

*Default vietato: la lettura del capitolo 8.2 è un'assunzione finché non è confermata.
Non si scrive codice che la dia per vera.*

---

### Decisione 3 — Il carattere d'interfaccia

DR-048 dice «un carattere distinto», non quale.

| Opzioni | |
|---|---|
| **(a)** Inter, variabile, ospitato in proprio | |
| **(b)** un'altra famiglia con licenza libera e ospitabile in proprio | |
| **(c)** la pila di caratteri di sistema, nessun file scaricato | |

**Raccomandazione: (a).** È il carattere che la proposta 1 fissava (§3), quindi DR-044
lo porta già con sé; la licenza OFL 1.1 è stata verificata in questa wave e consente
l'ospitalità in proprio; è disegnato per funzionare a 12–14 px, che è dove vive questa
interfaccia. (c) costa zero ma rende l'area amministrativa diversa su ogni sistema
operativo, il che rende inutilizzabili i confronti visivi.

**Impatto.** Circa 100–200 kB di `woff2` con sottoinsieme latino, serviti da
`apps/admin`. Nessuna chiamata a servizi esterni, in nessuna delle tre opzioni: è un
vincolo, non un'opzione.

*Default vietato: non si aggiunge una dipendenza da un servizio esterno di caratteri
senza una decisione esplicita.*

---

### Decisione 4 — Il nome della seconda area e le aree non costruite

| Opzioni | |
|---|---|
| **(a)** «Impostazioni», e le altre quattro aree **non compaiono** | |
| **(b)** «Direzione», come in `ux-proposals.md` §4.2, e le altre quattro non compaiono | |
| **(c)** le altre quattro compaiono spente o marcate «in arrivo» | |

**Raccomandazione: (a).** «Direzione» nominava una veste, e con DR-047 le vesti non si
indossano più; ciò che resta in Fase 1 è configurazione di sistema. (c) è sconsigliata
con forza: mostrare aree non costruite è pianificazione della fase gestionale fatta
dentro l'interfaccia, e il gate di `CLAUDE.md` la vieta.

**Impatto.** Solo sul nome visibile e sulla prima colonna. Cambiarlo dopo costa poco
finché le aree sono due; costa molto quando saranno sei e il vocabolario sarà entrato
nell'uso e nel registro delle operazioni.

*Default vietato: non si introduce un'area nella navigazione perché è prevista dalla
roadmap.*

---

### Decisione 5 — I tre prestiti dalle altre proposte

DR-044 registra «(a) Scrivania». La raccomandazione di `ui-proposals.md` era «la 1
**con tre prestiti**». I prestiti non sono stati registrati, quindi non sono approvati.

| Opzioni | |
|---|---|
| **(a)** tutti e tre: densità comoda predefinita e testi in parole intere dalla proposta 2; `Ctrl+K` come acceleratore dalla 3; marcatore di riservatezza su tutto il lato dalla 4 | |
| **(b)** solo alcuni, da indicare | |
| **(c)** nessuno: «Scrivania» così com'è | |

**Raccomandazione: (a).** Il primo è la mitigazione dichiarata del rischio principale
di «Scrivania», cioè la densità che intimidisce chi entra di rado. Il secondo è un
acceleratore che non toglie nulla a chi non lo conosce. Il terzo è il marcatore più
leggibile delle quattro proposte, su una materia che non ammette equivoci.

**Impatto.** Questo documento li ha già recepiti: densità al capitolo 5,
`CommandSearch` al componente 7, `RestrictedMarker` al componente 31. Se la risposta è
(b) o (c), i capitoli 5 e 6 vanno corretti **prima** di `1D-W7`.

*Default vietato: un prestito non registrato non è una scelta, è un'abitudine presa
leggendo la raccomandazione.*

---

### Decisione 6 — L'utente prioritario dell'area amministrativa

Era la domanda 2 di `ui-proposals.md` («Cosa serve dall'utente per decidere») e **non è
entrata** nelle cinque di HO-004. Resta aperta, e tocca decisioni concrete.

| Opzioni | |
|---|---|
| **(a)** chi entra ogni giorno (segreteria) | |
| **(b)** chi entra poche volte l'anno | |
| **(c)** entrambi con pari peso, accettando il costo di due modalità | |

**Raccomandazione: (a) come priorità, con le mitigazioni per (b)** — che è esattamente
ciò che la densità comoda predefinita e i testi di aiuto permanenti sono.

**Impatto.** Decide la densità predefinita, quanto testo di aiuto resta visibile in
permanenza e se `GuidedFlow` (componente 49) serve già in Fase 1 o solo dopo il gate.
Con (c), ogni schermata di creazione va progettata due volte.

*Default vietato: non si assume che l'utente prioritario sia la segreteria senza
conferma.*

---

### Decisione 7 — Le azioni non permesse: nascoste o disabilitate

Regola **[fissata in 1D-W7]** al capitolo 8.1 punto 8, perché senza una regola ciascun
componente sceglierebbe da sé.

| Opzioni | |
|---|---|
| **(a)** un'azione non permessa **non si mostra** | |
| **(b)** si mostra disabilitata, con una spiegazione al passaggio | |

**Raccomandazione: (a).** Un bottone spento dichiara a chi non deve averla che una
funzione esiste, e in un consultorio questo è un'informazione di troppo. (b) è più
gentile quando il permesso si può chiedere a qualcuno — ma in Fase 1 i permessi si
assegnano a mano su due o tre account, e non c'è nessuno a cui chiederli.

**Impatto.** Tocca `Button`, `IconButton`, `BulkActionBar`, `SectionNav` e `AreaNav`:
è una regola trasversale, e cambiarla dopo significa rileggerli tutti.

*Default vietato: non si sceglie fra nascondere e disabilitare componente per
componente.*

---

## 12. Nota di metodo

I 36 valori di contrasto del capitolo 2 sono stati calcolati in questa wave con la
formula della luminanza relativa di WCAG 2.2, coppia per coppia, e non stimati né
copiati. I 26 ereditati dalla proposta 1 coincidono con quelli dichiarati in
`ui-proposals.md` entro l'arrotondamento a due cifre; i 10 introdotti qui sono marcati
**[fissato in 1D-W7]**.

La licenza di Inter è stata verificata sulla fonte del progetto, non ricordata.

Nessun nome, data, importo, indirizzo o contenuto reale del Centro compare in questo
documento. Gli esempi di stato, di percorso e di registro sono inventati.

Questo documento **non** crea codice, scaffold o dipendenze: li descrive, perché la
wave `1D-W7` possa costruirli senza inventare nulla.
