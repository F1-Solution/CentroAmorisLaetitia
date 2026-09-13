# Handoff — istruzioni operative per il proprietario

Ogni volta che serve un'azione **tua**, qui trovi un documento con istruzioni passo
passo: prerequisiti, comandi esatti, esito atteso, cosa fare se fallisce, come
segnalare il completamento.

Convenzione: `HO-<numero>-<argomento>.md`.

| # | Documento | Fase | Stato |
|---|---|---|---|
| HO-001 | [Istanza WordPress di riferimento](HO-001-istanza-riferimento-wordpress.md) | 1A → 1E | ✅ **chiuso** — opzione A approvata, istanza costruita e validata |
| HO-002 | [Versione PHP del server di produzione](HO-002-versione-php-produzione.md) | 1B | ⏳ in attesa — non bloccante |

## Azioni previste più avanti

Non ancora aperte come handoff: lo diventeranno quando la fase le rende attuali.
L'elenco completo è in [`../migration/missing-inputs.md`](../migration/missing-inputs.md).

| Input | Fase | Natura |
|---|---|---|
| MI-01 — comportamento dei form in Fase 1 | 1B | decisione, arriva nel Round 3 |
| MI-02 — destinazione dei 4 documenti riservati | 1B | decisione |
| MI-10 — perimetro di parità delle pagine allegato | 1B | decisione |
| MI-04 — provider, dominio, costi | 1F | decisione con costi reali |
| MI-05 — restrizione e rotazione della chiave Google Maps | 1F | azione sull'account Google |
| MI-06 — verifica privacy e legale | 1F | validazione professionale |
| MI-07 — backup aggiornato per il delta finale | 1F | azione operativa |

## Come segnalare il completamento

Nel prompt successivo scrivi `HO-<numero>: fatto` più eventuali note o errori.
Se un passo fallisce, incolla il messaggio d'errore: non serve che lo interpreti tu.
