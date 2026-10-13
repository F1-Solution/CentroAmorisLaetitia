# HO-015 — Approvazione delle maschere e delle difformità (`1E-W6`)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-12. **Non ancora attivo:** si apre
quando la ricattura integrale è finita (HO-013 e HO-014 fatti) e la
classificazione è completa. Questo documento descrive già il procedimento, così
sai cosa ti verrà chiesto.

## 1. Che cosa ti verrà chiesto

Il piano (PLAN §7, conferma n. 3) chiede la tua approvazione **voce per voce** di:

1. ogni **maschera**: un'area esclusa dal confronto, con il motivo e le coordinate;
2. ogni **difformità** che si propone di non correggere: che cosa cambia rispetto
   alla sorgente, dove e perché.

Ciò che approvi va nel rapporto di parità (criterio 1E-11). Ciò che non approvi
si corregge, o resta una difformità aperta che blocca la chiusura della fase.

## 2. Voci già note

| # | Voce | Tipo | Riferimento |
|---|---|---|---|
| 1 | Banner dei cookie della sorgente assente nel sito nuovo | maschera su tutte le pagine | DR-107, MI-08 |
| 2 | Mappa: copertina al posto della mappa Google, caricamento solo al clic | maschera su `/contatti/` e `/dove-siamo/` | DR-107, D50 |
| 3 | Video: copertina al posto del riproduttore, caricamento solo al clic | maschera sull'area del riproduttore, 7 occorrenze | DR-107, D51 |
| 4 | Tabella dei cookie che scorre nel proprio riquadro al telefono | difformità su `/informazioni-sui-cookie/` a 390 e 360 px | DR-120 |
| 5 | Suffisso di paginazione in italiano, « - Pagina N» | difformità sugli archivi | DR-040 |

L'elenco completo, con coordinate, sarà in `docs/qa/confronto/maschere.json` e in
`docs/qa/confronto/classificazione.md`.

## 3. Come esaminare una voce

1. Apri `docs/qa/confronto/classificazione.md` e trova la voce.
2. Guarda le tre immagini indicate per quella voce, in `docs/qa/screenshots/`:
   riferimento (`riferimento/…`), sito nuovo (`sito/…`) e differenza (in rosso i
   pixel diversi).
3. Se vuoi vederla dal vivo: sorgente su http://127.0.0.1:8088/<percorso>, sito
   nuovo su http://127.0.0.1:3200/<percorso>. Te li avvio io se non sono attivi.

## 4. Come rispondere

Una riga per voce, con il numero dell'elenco che ti presenterò:

```
HO-015: 1 approvata, 2 approvata, 3 approvata, 4 approvata, 5 approvata, 6 da correggere, …
```

Una voce senza risposta resta aperta: non la considero approvata.
