# ADR-004 — Storage dei media e destino degli URL storici

| | |
|---|---|
| **Stato** | **approvata** il 2026-09-14 con DR-038 (approvazione in blocco) |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | dove risiedono i file e con quale URL vengono serviti |
| **Origine** | DR-005 (storage S3-compatible, MinIO in sviluppo), RC-07, DR-034 |

---

## 1. Contesto

DR-005 fissa lo storage: S3-compatible, MinIO in locale. Resta aperta la parte che
pesa davvero sulla parità: **con quale URL i file vengono serviti.**

I numeri della sorgente:

| Dato | Valore | Fonte |
|---|---|---|
| Allegati a database | 170 | 1A §4.3 |
| File in `wp-content/uploads/` | **1.546** | 1A §4.3 |
| PDF | 44 | 1A §4.3 |
| Dimensioni derivate generate | 150, 300, 768, 1024 px | `1B-W0` §8.6 |
| Pagine allegato che rispondono 301 al file | **169** | `url-matrix.csv`, DR-034 |
| Anni coperti | 2017–2026 | 1A §4.3 |

La differenza fra 170 e 1.546 non è spreco: sono le **dimensioni derivate** che
WordPress genera e che l'HTML dei contenuti referenzia direttamente, spesso dentro
attributi `srcset`. Un'immagine servita alla dimensione sbagliata cambia il layout:
è un problema di parità, non di ottimizzazione.

Il vincolo che decide la scelta: **169 URL indicizzati puntano a
`/wp-content/uploads/AAAA/MM/nomefile.ext`**, e per DR-034 quei 301 devono
continuare a funzionare.

## 2. Opzioni

### Opzione A — Conservare `/wp-content/uploads/…` come percorso pubblico definitivo

- **A favore:** nulla da riscrivere, nessun redirect aggiuntivo, rischio di parità
  nullo.
- **Contro:** il nuovo sito esporrebbe per sempre un percorso che dichiara
  «WordPress», in contrasto con DR-002 e con lo spirito del progetto. Vincola anche
  i **nuovi** caricamenti a un percorso privo di senso nel sistema nuovo.

### Opzione B — Nuovo percorso `/media/AAAA/MM/nomefile.ext`, con 301 dai percorsi storici

- **A favore:** percorso pulito e coerente col sistema nuovo; i vecchi URL
  continuano a funzionare grazie ai 301, quindi collegamenti esterni e indicizzazione
  sono salvi.
- **Contro:** ogni riferimento dentro l'HTML importato va **riscritto** durante
  l'import, altrimenti ogni immagine del sito costerebbe un redirect. La riscrittura
  è la parte che va fatta bene: se sbaglia, si vede.

### Opzione C — Nuovo schema di percorso con identificatore opaco

Esempio: `/media/01J8ZK…/copertina.jpg`.

- **A favore:** rinominare un file non rompe nulla; nessuna informazione di data nel
  percorso.
- **Contro:** perde ogni leggibilità, e soprattutto perde la corrispondenza uno a
  uno con la sorgente, che durante una migrazione è ciò che permette di verificare
  che i file siano tutti arrivati. Complica anche la verifica manuale in Fase 1E.

## 3. Scelta proposta

**Opzione B.** In dettaglio:

### 3.1 Percorso pubblico

```
/media/<anno>/<mese>/<nome-file>.<est>
/media/<anno>/<mese>/<nome-file>-<larghezza>x<altezza>.<est>   ← dimensioni derivate
```

Il nome del file e il suffisso di dimensione **restano identici alla sorgente**. Non
si normalizzano, non si ripuliscono, non si rinominano: qualunque normalizzazione
rischierebbe di far divergere il `srcset`.

### 3.2 Tutti i 1.546 file si importano, byte per byte

Comprese le dimensioni derivate. **Non si rigenerano.** Rigenerarle con una libreria
diversa da quella usata da WordPress produrrebbe immagini di peso e compressione
diversi, e su una pagina con molte immagini la differenza si vede.

> **Revisione del 2026-10-23 (DR-225, DR-249).** Il testo sopra vale per i 1.546 file
> importati, che restano byte per byte. Da `1G-W5` le dimensioni derivate **si generano**
> al caricamento di un'immagine dall'area e **si rigenerano** alla sostituzione del suo
> file, con `sharp` (DR-225), con le stesse misure e gli stessi ritagli di WordPress e
> Divi e nome `<base>-<L>x<A>.<est>` nella cartella dell'originale. L'originale si
> riscrive orientato e senza metadati (EXIF, GPS) e, oltre 2560 px sul lato lungo, si
> riduce e prende il nome `<base>-scaled` (D145-A). Se la sostituzione farebbe sparire
> una derivata citata da un contenuto, si rifiuta con `409 MEDIA_VARIANT_IN_USE`
> (D146-A). Nessuna rigenerazione in blocco: i file importati non si toccano finché non
> si sostituiscono.

Restano **escluse** le cartelle di servizio già identificate in 1A §4.3:
`uploads/backwpup*`, `uploads/wpforms`, `uploads/aioseo`, `uploads/wpdm-cache`,
`uploads/et_temp`.

**Correzione (DR-060):** `uploads/download-manager-files` è stata rimossa dall'esclusione.
La classificazione iniziale era basata sul nome della cartella; la verifica diretta ha
mostrato che contiene 4 moduli PDF pubblici scaricabili dal sito, non cache di plugin.
Le altre cinque cartelle restano escluse, come contenenti backup, cache o risorse interne.

### 3.3 Riscrittura dei riferimenti durante l'import

Ogni occorrenza di `https://www.centroamorislaetitia.it/wp-content/uploads/` e delle
sue varianti — con e senza `www`, `http` e `https`, relative — diventa `/media/`
dentro:

- il contenuto dei blocchi;
- gli attributi `src`, `srcset`, `href`, `poster`, `data-*` dei blocchi HTML;
- i parametri delle slide del carosello;
- i campi immagine delle impostazioni globali.

La riscrittura è **una regola sola, applicata in un punto solo** dell'importer, e ha
un test che fallisce se un riferimento sfugge.

### 3.4 Redirect permanenti dai percorsi storici

`/wp-content/uploads/*` → `/media/*`, **301**, come regola unica con carattere
jolly. Non 1.546 regole: una.

Questi redirect servono ai collegamenti esterni e all'indicizzazione, non al sito:
dopo la riscrittura del §3.3, il sito non li usa mai.

### 3.5 Le 169 pagine allegato

Restano **301 verso il file**, come oggi, per DR-034. Cambia solo la destinazione,
che diventa il percorso `/media/…`. La regola è configurabile, non cablata, perché
nella sorgente è una impostazione di AIOSEO e non un comportamento nativo
(`1B-W0` §2.6).

### 3.6 Organizzazione nello storage a oggetti

| Bucket | Contenuto | Accesso |
|---|---|---|
| `media-public` | i file serviti dal sito pubblico | lettura pubblica attraverso l'applicazione, mai URL firmati |
| `media-private` | i 4 documenti di `cuar_private_file` e ciò che nascerà riservato | **nessun accesso pubblico**, nemmeno indovinando il nome |

La separazione nasce da DR-033: i 4 documenti riservati devono esistere per la
futura area riservata, ma **non devono essere raggiungibili adesso**. Metterli nello
stesso bucket dei media pubblici e contare sulla segretezza del nome non è una
protezione.

L'applicazione **non reindirizza** verso lo storage: serve i file lei, attraverso
uno stream, così che il controllo di accesso resti in un punto solo e valga anche
quando arriveranno i permessi per documento (RD-04, RD-05).

### 3.7 WebP e ottimizzazione delle immagini

RC-08 chiede WebP e lazy loading. **Non in Fase 1E.** Cambiare formato o aggiungere
`loading="lazy"` altera peso, tempi di comparsa e talvolta il layout durante il
caricamento, cioè proprio ciò che gli screenshot di confronto misurano.

Si introducono **dopo** l'approvazione della parità, come miglioria dichiarata, con
un secondo giro di confronto visivo a dimostrare che nulla è cambiato.

## 4. Alternativa scartata e motivo

**Opzione A** è scartata perché fisserebbe per sempre, nel sistema nuovo, un
percorso che appartiene al sistema che si sta sostituendo, e lo imporrebbe anche ai
contenuti futuri. Il costo dell'alternativa — una riscrittura di riferimenti e una
regola di redirect — è contenuto e si paga una volta sola.

**Opzione C** è scartata perché durante una migrazione la verificabilità vale più
dell'eleganza: con percorsi opachi, «i file sono arrivati tutti?» diventa una
domanda difficile.

## 5. Conseguenze

**Più facile:** separare pubblico e riservato fin dall'inizio; verificare la
completezza dell'import confrontando due alberi di percorsi; introdurre più avanti
un CDN davanti a `/media/`.

**Più difficile:** la riscrittura dei riferimenti diventa un punto critico
dell'importer. Se sbaglia, si manifesta come immagini mancanti sparse, che è un
difetto fastidioso da diagnosticare. Per questo il §3.3 impone regola unica, punto
unico, test dedicato.

## 6. Reversibilità

**Media.** I file nello storage si possono ricollocare; ciò che costa è la
riscrittura dei riferimenti già importati, che andrebbe rifatta. Finché l'import è
rieseguibile da zero — ed è un requisito dell'ADR sull'importer — il costo resta
contenuto.

## 7. Verifica

In Fase 1D: numero di oggetti nel bucket pubblico pari ai file della sorgente meno
le cartelle escluse; **zero** occorrenze della stringa `wp-content/uploads` nei
contenuti importati; i 4 documenti riservati non raggiungibili da un anonimo
nemmeno conoscendo il nome del file; un campione di URL storici risponde 301 alla
destinazione attesa.

In Fase 1E: le pagine con più immagini confrontate al pixel, per escludere che una
dimensione derivata sia stata servita al posto di un'altra.
