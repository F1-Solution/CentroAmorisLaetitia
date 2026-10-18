# 1E-19 durante HO-026 — analisi della differenza

Fase 1E, wave `1E-W7`, audit di chiusura. Scritto il 2026-10-18.

## 1. Che cosa è successo

`tests/visual/prova-1e-19.ts`, eseguito come previsto da HO-026 dopo la copia di
salvataggio `amoris-prima-HO-026-2026-10-18.dump`:

| Contenuto | Tipo | Esito |
|---|---|---|
| `/attraversare-le-emozioni/` | pagina | identica |
| `/chi-siamo/` | pagina | identica |
| `/corsi-2022-2023/` | articolo | **diversa** |

Il campione è di 3 contenuti, non 4: la home non ha un contenuto con percorso `/` (si
serve da `site.home_content_id`), quindi la prima riga della query non trova nulla.
Nei giri precedenti il campione era di 4 per un altro contenuto ora escluso dal filtro.

Secondo HO-026 §4 mi sono fermato: nessun nuovo tentativo.

## 2. Causa (provata in sola lettura)

Confronto della riga di `/corsi-2022-2023/` fra la copia di salvataggio e il database
attuale: cambiano **solo** `updated_at` (atteso) e `description_source`, che passa da
«Quest'anno l'offerta formativa del Centro…» a `NULL`. `modified_at` è invariata,
`excerpt`, `blocks`, `content_text` e `summary_source` sono identici. La meta
description pubblica dell'articolo è quindi cambiata.

Catena:

1. il dettaglio `GET /contents/:id` non contiene `contentText`
   (`apps/api/src/modules/content/schemas.ts:61-70`);
2. la prova reinvia `contentText: corpo.contentText`, che è `undefined` e sparisce dal
   JSON (`tests/visual/prova-1e-19.ts:136-150`);
3. con `blocks` presenti e `contentText` assente l'API azzera la description importata,
   perché non può confrontare il testo (`apps/api/src/modules/content/service.ts:145-146`,
   DR-180).

Le due pagine non cambiano perché la loro `description_source` era già `NULL`.

## 3. Il CMS reale non ha il difetto

| Chiamante di `PATCH /contents/:id` | Invia `blocks` | Invia `contentText` | Esito a salvataggio identico |
|---|---|---|---|
| `apps/admin/src/components/editor/ContentEditor.tsx:225-240` | sì | sì, calcolato dai blocchi | **nessuna scrittura** (`isUnchanged`, `apps/admin/src/lib/editor/roundtrip.ts:173-182`) |
| `apps/admin/src/components/editor/ContentLayoutPanel.tsx:45` | no | no | solo `pageLayout` |
| `apps/admin/src/components/editor/ContentSeoPanel.tsx` | no | no | solo campi SEO |
| `tests/visual/prova-1e-19.ts:136` | sì | **no** | azzera la description |

Il difetto è della **prova**, che non riproduce ciò che il CMS invia. Il ramo dell'API
che azzera la description quando arrivano blocchi senza testo è voluto (DR-180).

## 4. Osservazione a margine, non bloccante

`apps/api/src/modules/content/service.ts:189` scrive `'\s+'` dentro un modello
`sql\`…\``: in JavaScript diventa `'s+'`, cioè sostituisce le «s» invece degli spazi.
Il confronto resta simmetrico, ma uno scarto di soli spazi nel testo aggiorna la data di
modifica. La riga 130 usa correttamente `'\\s+'`. Da correggere con la D101, se approvata.

## 5. Decisioni richieste

Vedi la risposta di Claude del 2026-10-18 (D101, D102).

## 6. Dopo HO-027 (DR-199, DR-200)

- Ripristino: `description_source` di `/corsi-2022-2023/` riportata al valore della copia di
  HO-026 (1 riga, `COMMIT`); la meta description pubblica è di nuovo quella della sorgente.
- Correzioni: la prova invia HTML e testo calcolati dai blocchi come l'editor e controlla
  `modified_at` e `description_source`; il campione legge la home da
  `site.home_content_id`; regex degli spazi corretta in `service.ts:189`, con prova in
  `apps/api/tests/descriptionSource.test.ts` (rossa prima, verde dopo; API 239/239).
  Verificato prima: per i 106 contenuti pubblicati il testo calcolato dai blocchi coincide
  con quello salvato, spazi esclusi.
- Nuova esecuzione: 1 identico su 4. Nel database cambia solo `updated_at` dei 3 contenuti
  salvati (confronto con la copia di HO-027); `modified_at` e `description_source` invariate.
  Mi sono fermato (HO-027 §5).

### 6.1 Le pagine non sono deterministiche (causa delle differenze)

Tre letture consecutive di `/chi-siamo/` e `/corsi-2022-2023/` **senza alcun salvataggio**
danno HTML diversi della stessa lunghezza: cambiano l'ordine e i riferimenti interni delle
righe del payload RSC (`self.__next_f.push`), perché metadati e componenti si risolvono in
ordine variabile. Tolti gli script del payload, l'HTML è identico nelle tre letture. La prova confronta la stringa intera,
quindi segnala differenze che non dipendono dal salvataggio. Decisione D104.

### 6.2 La home non si può salvare (difetto del prodotto)

La home ha il titolo vuoto, come nella sorgente; `PATCH /contents/:id` richiede un titolo di
almeno un carattere (`apps/api/src/modules/content/schemas.ts:88`, `updateBody`) e risponde
400. L'editor invia il titolo così com'è (`ContentEditor.tsx:233-240`), quindi qualunque
modifica della home dal CMS fallisce. Nessuna scrittura è avvenuta. Decisione D103.

## 7. Dopo HO-028 (DR-201, DR-202)

- DR-201: titolo vuoto ammesso in modifica e nella copia di lavoro solo se il contenuto lo ha
  già vuoto (spazi compresi); creazione invariata. Prove in `apps/api/tests/emptyTitle.test.ts`
  (7), API 246/246; revisione del codice senza critici o alti, il punto medio (soli spazi)
  corretto.
- DR-202: la prova confronta l'HTML senza gli script del payload RSC; verificato su due
  coppie di letture senza salvataggi.
- Esecuzione dopo la copia `amoris-prima-HO-028-2026-10-18.dump`: **4/4 identici**, home
  compresa; nel database cambia solo `updated_at` di 4 righe su 108.
