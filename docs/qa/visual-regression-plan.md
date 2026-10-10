# Piano di visual regression — Fase 1B, wave `1B-W6`

Come si dimostra, con numeri, che il nuovo sito è identico a quello attuale.

| | |
|---|---|
| **Stato** | **approvato** il 2026-10-10 con DR-110 |
| **Esecuzione** | Fase 1E |
| **Riferimento** | istanza WordPress congelata al 2026-09-13, `tools/wp-reference/` (DR-025) |
| **Registro dei risultati** | `docs/qa/visual-parity-report.md`, prodotto in Fase 1E |
| **Criteri di accettazione** | [`acceptance-criteria.md`](acceptance-criteria.md) |

`CLAUDE.md` vieta l'uso del termine «pixel-perfect» senza prove. Questo documento
definisce quali sono le prove.

## Revisioni

| Data | Revisione |
|---|---|
| 2026-10-10 | **DR-112**: i confronti sono **585** (§2). **DR-113**: con il rumore misurato a zero la soglia di superamento automatico è lo **0 %** (§6.3). **DR-111**: il riferimento di 4 pagine viene dal sito online (§1) |
| 2026-10-10 | **Approvato con DR-110** e allineato alle decisioni successive alla 1B: cartella e impronte delle immagini (§7, DR-106), D13 chiusa da DR-040 (§9 e §12), maschere alla luce di DR-107 (§5.1), stampa fuori perimetro per DR-041 (§11). Viewport, soglie e numero dei confronti **invariati** |

---

## 1. Che cosa si confronta, e contro che cosa

Il riferimento è l'**istanza congelata**, non il sito online. Il sito online resta
vivo e cambia (R-15): confrontarsi con un bersaglio in movimento renderebbe
irripetibile ogni approvazione.

Il sito online serve a un solo scopo: **controprova a campione**, per escludere che
l'istanza di riferimento renda diversamente dalla produzione a causa della
differenza di ambiente PHP (R-16). Se emergesse una divergenza, **fa fede il sito
online**.

> **Applicato il 2026-10-10, DR-111:** il riferimento di 4 pagine viene dal sito
> online, perché l'istanza non le rende come la produzione. Sono elencate in
> `visual-parity-report.md` §6.

## 2. Perimetro

Da `url-matrix.csv`, con DR-034 che esclude dal confronto visivo le 170 pagine
allegato perché sono redirect a un file e non hanno aspetto proprio.

| Livello | URL | Viewport | Fonte |
|---|---|---|---|
| **A — alta priorità** | 81 | tutte e 6 | `priorita_parita = alta` |
| **B — media priorità** | 36 | 3 (1440, 768, 390) | `priorita_parita = media` |
| **Non visivi** | 6 | — | feed, `robots.txt`, `sitemap.xml`: confronto strutturale, §9 |
| **Redirect** | 180 | — | verifica di codice e destinazione, §10 |

Immagini attese: 81 × 6 + 36 × 3 = **594 confronti**.

> **Rivisto il 2026-10-10, DR-112.** I livelli contano anche righe senza aspetto
> proprio: `robots.txt` e `sitemap.xml` (livello A), `wp-sitemap.xml` e i 4 documenti
> che rispondono 301 (livello B). Restano **567** catture dalla matrice (79 × 6 + 31 × 3),
> a cui si aggiungono le 4 pagine di destinazione dei documenti e le pagine 2 e 3
> dell'archivio delle notizie, a 3 viewport: **585 confronti**.

## 3. Viewport — fissate, e scelte sui punti di rottura reali

Non sono taglie convenzionali: sono ricavate dai media query effettivamente
presenti nel CSS del tema della sorgente.

Punti di rottura misurati, per numero di regole: **980/981** (528 regole),
**767/768** (294), **479/480** (138), **1100** (43), **1405** (15), **380** (5).
Il contenitore è largo l'80% con un massimo di **1080 px**.

| # | Viewport | Perché questa |
|---|---|---|
| 1 | **1440 × 900** | sopra 1405: il contenitore è al massimo e i margini sono ampi |
| 2 | **1280 × 800** | fra 1100 e 1405: la taglia da portatile più comune |
| 3 | **1024 × 768** | fra 981 e 1100: **38 regole vivono solo qui**, ed è la fascia più facile da dimenticare |
| 4 | **768 × 1024** | tablet verticale, dentro la fascia 768–980 |
| 5 | **390 × 844** | telefono corrente, sotto 479 |
| 6 | **360 × 800** | telefono stretto, sotto 380: attiva le ultime 5 regole |

Fattore di scala del dispositivo: **1** su tutte. Non 2: un fattore 2 quadruplica il
peso delle immagini senza aggiungere informazione a un confronto fra due rese dello
stesso motore.

## 4. Browser — come si fissa la versione

Un confronto al pixel ha senso su **un solo motore di resa**. Confrontare Chromium
con Firefox produce differenze in ogni pagina: è antialiasing, non difformità.

| Voce | Valore |
|---|---|
| Strumento | Playwright, versione **fissata in modo esatto** in `package.json`, senza intervallo |
| Motore del confronto | **Chromium** fornito da quella versione di Playwright |
| Registrazione | la stringa di versione completa del browser viene scritta nell'intestazione di ogni esecuzione e in `visual-parity-report.md` |
| Regola | **la versione non cambia per tutta la Fase 1E.** Un aggiornamento invalida le linee di riferimento e obbliga a rigenerarle |

Firefox e Safari **non** entrano nel confronto al pixel. Entrano nella verifica
funzionale manuale del §8, che è dove le differenze fra browser contano davvero.

Sull'ambiente di sviluppo attuale risultano già presenti tre build di Chromium di
Playwright: la scelta di quale fissare si fa all'inizio della Fase 1E e si registra
nel rapporto, non si eredita per caso da ciò che è installato.

## 5. Condizioni di cattura — la parte che decide se il confronto è affidabile

Ogni elemento non deterministico produce falsi allarmi, e un piano che ne genera
molti smette di essere letto.

| # | Condizione | Perché |
|---|---|---|
| 1 | Fuso orario `Europe/Rome`, lingua `it-IT` | le date rese devono coincidere, mese compreso |
| 2 | Sessione **anonima**, nessun cookie | `1B-W0` §3: da autenticato il menu ha 64 voci invece di 41 |
| 3 | Attesa di `document.fonts.ready` | il testo con carattere di ripiego occupa uno spazio diverso |
| 4 | Attesa di quiete della rete, più un ritardo fisso dichiarato | Divi carica moduli in differita |
| 5 | Animazioni portate a conclusione prima dello scatto | 38 immagini hanno un'animazione in ingresso (`1B-W5` §3.3) |
| 6 | Barre di scorrimento nascoste | la loro larghezza varia e sposta il contenuto |
| 7 | Cursore di testo nascosto, nessun elemento a fuoco | il cursore lampeggia |
| 8 | Profilo colore `srgb`, suggerimenti di resa dei caratteri disattivati | rende la rasterizzazione riproducibile fra macchine diverse |
| 9 | Schermata **a pagina intera**, non solo la parte visibile | le difformità si nascondono più spesso in fondo |
| 10 | Tre scatti della stessa pagina prima di accettare una linea di riferimento | se i tre non coincidono fra loro, la pagina non è deterministica: va mascherata, non confrontata |

Il punto 10 è il controllo più importante: **una linea di riferimento instabile
produce un piano che fallisce a caso**, e un piano che fallisce a caso viene
ignorato.

### 5.1 Aree mascherate

Si escludono dal confronto, con maschera dichiarata e motivata:

| Area | Motivo | Dove |
|---|---|---|
| Mappa Google | tessere servite da un servizio esterno, mai identiche due volte | pagina Contatti |
| Banner dei cookie | sostituito da un componente proprio: **difformità dichiarata** (MI-08) | tutte le pagine |
| Video incorporati, area del riproduttore | anteprima fornita da un servizio esterno | 7 occorrenze |

Dal 2026-10-10 (DR-107) il sito nuovo non chiama terzi: video e mappa compaiono
come immagine di copertina e si caricano solo al clic, e il banner dei cookie
della sorgente non ha un corrispondente in Fase 1E. Le tre aree restano
mascherate e sono **difformità dichiarate**, da approvare nel rapporto.

Ogni maschera è elencata nel rapporto con le sue coordinate. **Una maschera non
dichiarata è una difformità nascosta**, ed è esattamente ciò che il gate vieta.

## 6. Soglie — numeriche, e calibrate invece che inventate

### 6.1 Come si confronta

Confronto per pixel con tolleranza percettiva, non per uguaglianza di byte. Due
rese identiche dello stesso HTML differiscono comunque di qualche pixel per
antialiasing dei caratteri.

- Tolleranza per pixel: **0,1** sulla distanza percettiva. Sotto questa soglia due
  pixel si considerano uguali.
- Metrica riportata: **percentuale di pixel diversi** sul totale.

### 6.2 Soglie proposte

| Esito | Pixel diversi | Azione |
|---|---|---|
| **Superato** | ≤ **0,10%** | automatico |
| **Da esaminare** | da 0,10% a **0,50%** | ispezione manuale dell'immagine di differenza, esito registrato |
| **Fallito** | > 0,50% | difformità: si corregge o si dichiara e si fa approvare |

**Regola aggiuntiva, che le percentuali da sole non catturano:** anche sotto lo
0,10%, nessuna singola area contigua di differenza può superare **32 × 32 pixel**.
Un'icona mancante o un elemento spostato di dieci pixel producono una percentuale
minuscola su una pagina lunga, e passerebbero inosservati. È il caso che questa
regola intercetta.

### 6.3 Perché proprio questi numeri, e come si confermano

Sono un **punto di partenza motivato**, non un dogma. La motivazione: su una pagina
da 1440 × 4000 pixel, lo 0,10% è circa 5.760 pixel, che corrisponde all'ordine di
grandezza del rumore di antialiasing su un testo lungo, e resta sotto la
dimensione di qualunque elemento visibile.

La conferma è **empirica** e va fatta all'inizio della Fase 1E:

1. Si cattura la stessa pagina dell'istanza di riferimento **due volte**, a distanza
   di tempo.
2. Si misura la differenza fra i due scatti. È il **rumore di fondo**.
3. La soglia di superamento automatico si fissa a **tre volte il rumore di fondo
   misurato**, e comunque non oltre lo 0,10%.
4. Il numero misurato e la data della misura finiscono nel rapporto.

> **Misurato il 2026-10-10:** rumore **zero** fuori dalle aree da mascherare. Per
> **DR-113** la soglia di superamento automatico è quindi lo **0 %**: supera da solo
> solo il confronto identico al pixel; da 0 a 0,50 % si esamina a mano.

Se il rumore di fondo risultasse superiore allo 0,10%, la catena di cattura non è
deterministica e va corretta prima di iniziare: alzare la soglia per farci stare il
rumore significherebbe smettere di misurare.

## 7. Organizzazione delle esecuzioni

| Fase | Cosa fa | Quando |
|---|---|---|
| **Cattura del riferimento** | 594 immagini dall'istanza congelata | una volta sola, all'inizio della 1E |
| **Confronto** | 594 immagini dal sito nuovo, confrontate | a ogni giro di correzione |
| **Rapporto** | tabella per URL e viewport, con percentuale ed esito | a ogni giro |
| **Controprova online** | 10 URL ad alta priorità confrontati con il sito in produzione | all'inizio e prima dell'approvazione |

Le immagini di riferimento **non entrano in Git**: sono 594 file, alcuni contengono
testi di pagine reali, e Git non è il posto giusto per artefatti binari rigenerabili.
Stanno in **`docs/qa/screenshots/`**, cartella esclusa da Git, organizzate per URL e
viewport (DR-106). Il rapporto riporta per ogni immagine l'**impronta SHA-256**,
così un'immagine conservata si riconosce come quella giudicata. La cartella va
conservata fino all'approvazione della parità: perderla obbliga a ricatturare.

Entra in Git **il rapporto**: percorsi, percentuali, esiti, maschere, versioni. Cioè
ciò che serve a ricostruire il giudizio.

## 8. Verifica manuale — ciò che le immagini non dimostrano

`CLAUDE.md` la richiede esplicitamente. Per **ogni URL ad alta priorità**:

| # | Verifica | Come si registra |
|---|---|---|
| 1 | Passaggio del puntatore su voci di menu, bottoni, collegamenti | esito per URL |
| 2 | Menu a più livelli: apertura, chiusura, terzo livello | il menu ha **tre livelli** (`public-menu.csv`) |
| 3 | Navigazione da telefono: apertura, scorrimento, chiusura | ai due viewport telefono |
| 4 | Form: aspetto, messaggi di validazione, messaggio di conferma | 23 pagine, ADR-010 |
| 5 | Caricamento dei caratteri: nessuno spostamento visibile del testo | Open Sans, 5 pesi con corsivi |
| 6 | Immagini: la dimensione derivata servita è quella attesa | ADR-004 §3.2 |
| 7 | Punti di rottura: ridimensionamento continuo da 1440 a 360 senza salti | le 6 viewport non coprono l'intervallo |
| 8 | Contenuti incorporati: video, mappa | 7 video, 1 mappa |
| 9 | Accessibilità di base: navigazione da tastiera, fuoco visibile, gerarchia dei titoli, testi alternativi | vedi `acceptance-criteria.md` §6 |
| 10 | Carosello della home: 12 slide, avanzamento, comandi | 1 pagina |

## 9. Confronto dei metadati e dei contenuti non visivi

Separato dal confronto visivo. D13 è chiusa da **DR-040** (opzione C): i metadati
non visibili si **correggono** invece di riprodurne i difetti, e le 29 pagine senza
`<h1>` lo ricevono, reso identico al testo che oggi lo sostituisce. Una
differenza di metadati dovuta a quella correzione è attesa e si classifica come
tale, non come fallimento.

| Confronto | Riferimento | Numero |
|---|---|---|
| `<title>`, description, canonical, Open Graph, robots, `<h1>`, tipi Schema.org | `seo-rendered-baseline.csv` | 117 URL |
| `robots.txt` | testo servito dalla sorgente | 1 |
| Indice della sitemap e sue figlie | struttura e numero di URL | 6 |
| Feed RSS | struttura e numero di elementi | 2 |
| Voci di menu rese a un anonimo | `public-menu.csv` | **41 voci, con gerarchia ed etichette** |

## 10. Verifica dei redirect

180 regole (`wp-to-postgres-mapping.md` §3.2). Per ciascuna si verifica **codice di
stato e destinazione**, in modo automatico, senza seguire il redirect.

| Gruppo | Regole | Atteso |
|---|---|---|
| Pagine allegato | 169 | 301 verso il file in `/media/…` |
| Documenti scaricabili | 4 | 301 verso `/download/<slug>/` |
| Slug storici | 6 | 301 verso il contenuto attuale |
| Percorsi storici dei media | 1 con carattere jolly | 301 verso `/media/…`, provato su 20 file a campione |

Si verifica anche l'opposto: **nessun URL che oggi risponde 200 deve rispondere
301**, e nessun URL che oggi risponde 301 deve rispondere 200. È un controllo
simmetrico e va scritto come tale.

## 11. Che cosa questo piano non copre

- **Prestazioni.** PageSpeed > 80 (RC-08) si misura in Fase 1F, non qui: è un
  criterio diverso e con strumenti diversi.
- **Confronto fra browser.** Per costruzione, §4.
- **Stampa.** Fuori perimetro per **DR-041**: non si confronta e non si riproduce.
- **Difformità approvate.** Ciò che l'utente approva come diverso esce dal confronto
  ed entra nell'elenco delle difformità dichiarate.

## 12. Condizione di chiusura della Fase 1E

La Fase 1E si chiude quando, **tutte insieme**:

1. 594 confronti su 594 hanno esito superato o esaminato-e-accettato;
2. nessuna area contigua di differenza supera 32 × 32 pixel su alcun URL;
3. le verifiche manuali del §8 sono registrate per tutti gli 81 URL ad alta priorità;
4. i confronti dei metadati del §9 sono registrati, con le difformità classificate
   secondo DR-040;
5. i 180 redirect rispondono come atteso, nei due sensi;
6. ogni maschera e ogni difformità è dichiarata e **approvata esplicitamente
   dall'utente** in `visual-parity-report.md`;
7. la controprova sul sito online non ha rivelato divergenze dell'istanza di
   riferimento.

Finché anche una sola manca, il termine «pixel-perfect» non si usa.
