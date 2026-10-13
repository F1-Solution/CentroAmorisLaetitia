# HO-015 — Approvazione delle maschere e delle difformità (`1E-W6`)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-12, **attivo dal 2026-10-13**: la
ricattura integrale e il confronto finale sono fatti, la classificazione è in
`docs/qa/confronto/classificazione.md`.

**Attenzione:** approvare queste voci **non** chiude la wave. Il confronto ha
585 esiti falliti su 585, dovuti a nove famiglie di difetti (A–I del §1 della
classificazione) che vanno corrette, non approvate. Le maschere 2 e 3 andranno
rimisurate dopo quelle correzioni.

## 1. Che cosa ti verrà chiesto

Il piano (PLAN §7, conferma n. 3) chiede la tua approvazione **voce per voce** di:

1. ogni **maschera**: un'area esclusa dal confronto, con il motivo e le coordinate;
2. ogni **difformità** che si propone di non correggere: che cosa cambia rispetto
   alla sorgente, dove e perché.

Ciò che approvi va nel rapporto di parità (criterio 1E-11). Ciò che non approvi
si corregge, o resta una difformità aperta che blocca la chiusura della fase.

## 2. Voci da approvare

| # | Voce | Tipo | Riferimento |
|---|---|---|---|
| 1 | Banner dei cookie della sorgente assente nel sito nuovo | maschera su tutte le pagine | DR-107, MI-08 |
| 2 | Mappa: copertina al posto della mappa Google, caricamento solo al clic | maschera su `/contatti/` e `/dove-siamo/`, 12 rettangoli | DR-107, DR-121 |
| 3 | Video: copertina al posto del riproduttore, caricamento solo al clic | maschera su `/riparte-il-corso-per-consulenti-familiari/` e `/dal-vizioso-al-virtuoso/`, 15 rettangoli | DR-107, DR-122 |
| 4 | Tabella dei cookie che scorre nel proprio riquadro al telefono | difformità su `/informazioni-sui-cookie/` a 390 e 360 px | DR-120 |
| 5 | Suffisso di paginazione in italiano, « - Pagina N», nel titolo del documento | difformità sugli archivi | DR-040 |

Coordinate in `docs/qa/confronto/maschere.json` (29 rettangoli), motivi nel §2
di `docs/qa/confronto/classificazione.md`. Nessuna nuova voce è emersa dal
confronto finale: tutte le altre differenze sono difetti.

## 3. Come esaminare una voce

1. Apri `docs/qa/confronto/classificazione.md` e trova la voce.
2. Guarda le tre immagini indicate per quella voce, in `docs/qa/screenshots/`:
   riferimento (`riferimento/…`), sito nuovo (`sito/…`) e differenza (in rosso i
   pixel diversi).
3. Se vuoi vederla dal vivo: sorgente su http://127.0.0.1:8088/<percorso>, sito
   nuovo su http://127.0.0.1:3200/<percorso>. Te li avvio io se non sono attivi.

## 4. Come rispondere

Una riga per voce, con il numero del §2:

```
HO-015: 1 approvata, 2 approvata, 3 approvata, 4 approvata, 5 approvata
```

Una voce senza risposta resta aperta: non la considero approvata.

## 5. Se qualcosa non torna

Se un'immagine manca o non corrisponde alla voce, scrivi il numero della voce e
il percorso: la ricontrollo prima di considerarla.

## 6. Come segnalare il completamento

Incolla la riga del §4 nel prompt successivo. Le voci approvate entrano nel
registro delle decisioni e nel rapporto di parità.
