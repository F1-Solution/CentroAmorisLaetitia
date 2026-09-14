# ADR-006 — Editor redazionale

| | |
|---|---|
| **Stato** | **approvata** il 2026-09-14 con DR-038 (approvazione in blocco) |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | con quale libreria si modifica il testo dentro i blocchi |
| **Origine** | RC-03, DR-033, ADR-005 |

---

## 1. Contesto

ADR-005 stabilisce che il corpo di un contenuto è un albero di 14 tipi di blocco e
che il blocco di lavoro è `rich_text`, che contiene HTML ristretto a un elenco
chiuso di elementi e attributi.

Restano due cose da decidere, di natura diversa:

1. **Chi disegna l'albero dei blocchi**: aggiunta, spostamento, eliminazione,
   annidamento di sezioni, righe e colonne.
2. **Chi modifica il testo ricco** dentro un blocco `rich_text`.

La prima non ha una libreria pronta che corrisponda a questo modello: l'albero di
ADR-005 nasce da Divi ed è annidato (sezione → riga → colonna → blocchi), mentre
quasi tutti gli editor a blocchi pronti gestiscono un **elenco piatto**. La seconda
ha invece diverse librerie mature.

Il vincolo che pesa più di ogni altro viene da ADR-005 §7:

> Aprire un contenuto nell'editor e salvarlo senza modifiche non deve cambiare né i
> blocchi né l'HTML reso.

Un editor che normalizza il markup a modo proprio — riscrivendo `<b>` in `<strong>`,
riordinando attributi, spostando spazi — fa fallire questo controllo e degrada in
silenzio una parità già approvata. È il criterio discriminante.

## 2. Opzioni

### Opzione A — Un editor a blocchi pronto (BlockNote, Plate, Editor.js)

- **A favore:** interfaccia a blocchi già fatta, con trascinamento, menu di
  inserimento, scorciatoie. Molto lavoro risparmiato.
- **Contro:** impongono il **loro** modello di documento. Adattarlo all'albero
  annidato di ADR-005 significa scrivere e mantenere una conversione in entrambe le
  direzioni, e ogni loro aggiornamento può romperla. Il rischio di andata e ritorno
  non è sotto controllo, perché la normalizzazione avviene dentro la libreria.

### Opzione B — TipTap per il solo testo ricco, albero dei blocchi proprio

TipTap, costruito su ProseMirror, dentro ogni blocco `rich_text`. L'albero dei
blocchi è un componente React proprio.

- **A favore:** lo schema di ProseMirror si dichiara: si ammettono **esattamente**
  gli elementi e gli attributi del §3.5 di ADR-005, e nulla di più. Il
  comportamento in andata e ritorno diventa verificabile con un test, perché lo
  schema è esplicito. L'albero dei blocchi resta nostro, quindi corrisponde
  esattamente al modello e non richiede conversioni.
- **Contro:** l'interfaccia dell'albero — trascinamento, inserimento, annidamento —
  va scritta. È lavoro reale, e su un team di una persona va dimensionato.

### Opzione C — Lexical per il solo testo ricco

- **A favore:** prestazioni eccellenti, architettura moderna, buon supporto
  all'accessibilità.
- **Contro:** per convertire da e verso HTML servono nodi e trasformazioni scritti a
  mano; ProseMirror ha vent'anni di lavoro fatto proprio su quel punto.
  L'ecosistema di estensioni pronte è più povero, e per un team di una persona conta.

## 3. Scelta proposta

**Opzione B — TipTap dentro i blocchi `rich_text`, albero dei blocchi proprio.**

### 3.1 Schema dell'editor

Lo schema di TipTap ammette esattamente gli elementi del §3.5 di ADR-005.
`h1` è escluso: il titolo appartiene al template. Lo stile in linea è escluso. Ciò
che non è ammesso viene **rifiutato all'incollaggio**, non silenziosamente
riscritto: il redattore che incolla da Word deve vedere che la formattazione è stata
ripulita, non scoprirlo mesi dopo.

### 3.2 Ambito dell'editor dell'albero in Fase 1

DR-033 chiede un backend minimale «per aggiungere e modificare pagine». Minimale
significa questo, e non di più:

| In Fase 1 | Rimandato |
|---|---|
| creare, modificare, pubblicare, ritirare una pagina o un articolo | modelli di pagina riutilizzabili |
| modificare testo e immagini dentro i blocchi esistenti | modifica fine degli stili per blocco |
| aggiungere, spostare, eliminare blocchi dentro una colonna | creazione di layout complessi da zero |
| cambiare la ripartizione delle colonne di una riga | libreria di blocchi estendibile |
| gestire media, menu, SEO per contenuto, redirect, impostazioni | modifica collaborativa, commenti, flussi di approvazione |

Va detto con chiarezza: **in Fase 1 l'editor serve a manutenere il sito esistente,
non a costruirne uno nuovo dal nulla.** È quanto DR-033 chiede e quanto la Fase 1G
collauderà.

### 3.3 Anteprima

L'anteprima usa **gli stessi componenti di resa del sito pubblico**, non una
riproduzione approssimata dentro l'editor. Un'anteprima che diverge dal sito è
peggio di nessuna anteprima, perché fa approvare modifiche sbagliate.

Conseguenza pratica: i componenti di resa dei 14 blocchi stanno in un pacchetto
condiviso del monorepo, usato sia dal sito sia dall'area amministrativa.

### 3.4 Il blocco di riserva `html`

Si modifica in un'area di testo con evidenziazione della sintassi, **non** con
l'editor di testo ricco, e mostra un avviso esplicito: «questo blocco non è stato
convertito, modificarlo può alterare la resa». Trattarlo come testo ricco lo
farebbe normalizzare, che è esattamente ciò che non deve accadere a un frammento
conservato per fedeltà.

## 4. Alternativa scartata e motivo

**Un editor a blocchi pronto** è scartato perché il modello di ADR-005 è annidato e
deriva dalla sorgente, non da una libreria: adattarlo significherebbe mantenere una
conversione fragile in entrambe le direzioni, proprio nel punto in cui il progetto
non può permettersi fragilità. Il tempo risparmiato sull'interfaccia si
ripagherebbe in difetti di conversione.

**Lexical** è scartato perché il lavoro sulla conversione da e verso HTML — che è il
90% del problema in una migrazione — è più maturo in ProseMirror.

## 5. Conseguenze

**Più facile:** controllare esattamente quale HTML può entrare nel database;
verificare l'andata e ritorno con un test automatico; far coincidere anteprima e
sito.

**Più difficile:** l'interfaccia dell'albero dei blocchi è lavoro da scrivere. Il
perimetro del §3.2 serve a tenerlo entro la Fase 1: se cresce, cresce a scapito
della parità, che è ciò che il gate misura.

**Nuove dipendenze:** `@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit` e le
poche estensioni necessarie a coprire il §3.1. Licenza MIT.

## 6. Reversibilità

**Alta per il testo ricco, media per l'albero.** Il testo ricco è confinato dentro
un tipo di blocco: sostituirlo tocca un componente. L'albero è codice proprio, e
riscriverlo costa quanto scriverlo la prima volta.

## 7. Verifica

**Test di andata e ritorno**, automatico, eseguito su **tutti** i contenuti della
sorgente in locale: caricare, aprire nell'editor, salvare senza modifiche,
confrontare. Deve risultare identico. I contenuti usati restano locali, non entrano
in Git né nella documentazione.

**Fase 1G:** un redattore modifica testo e immagine su tre contenuti di famiglie
diverse, senza assistenza, e la resa è corretta.
