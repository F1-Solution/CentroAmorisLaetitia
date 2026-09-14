# Design dell'area amministrativa

Prodotto nella wave `1B-W7`, in attuazione di DR-019 (quattro proposte di UI e
quattro di UX, prodotte dagli agenti di design) e di DR-028 (perimetro completo
dell'area amministrativa futura, con il CMS come primo modulo).

| Documento | Contenuto | Stato |
|---|---|---|
| [`ui-proposals.md`](ui-proposals.md) | 4 proposte di UI: palette, tipografia, griglia, componenti, mockup, accessibilità, costo | **in attesa di scelta** |
| [`ux-proposals.md`](ux-proposals.md) | 4 proposte di UX: architettura, navigazione, ruoli, riservatezza, flussi, punti deboli | **in attesa di scelta** |
| [`chooser/index.html`](chooser/index.html) | Le otto proposte rese a schermo, con palette e caratteri reali, interruttore chiaro/scuro e schermo/telefono, matrice di compatibilità e le cinque domande | strumento di scelta |

Il modo più rapido per scegliere è aprire `chooser/index.html` con un doppio clic:
è una pagina autonoma, non richiede installazioni e non manda nulla da nessuna parte
(carica solo i caratteri da Google Fonts, per mostrarli davvero).

La scelta si fa rispondendo alle cinque domande dell'handoff
[`../handoff/HO-004-scelta-ui-ux-area-amministrativa.md`](../handoff/HO-004-scelta-ui-ux-area-amministrativa.md).

## Vincoli rispettati

- **L'area amministrativa non assomiglia a WordPress** (DR-018): nessuna delle otto
  proposte riproduce l'aspetto o l'architettura di wp-admin.
- **Solo dati sintetici** (DR-010): nomi, date, importi e contenuti dei mockup sono
  inventati.
- **Nessun codice**: le proposte sono documenti. Nessuno scaffold parte prima
  dell'approvazione delle ADR (D5, DR-035).

## Verifica eseguita sulle proposte

I rapporti di contrasto dichiarati nelle otto palette sono stati **ricalcolati**
con la formula della luminanza relativa: 32 coppie colore/fondo verificate, tutte
corrispondenti al valore dichiarato. Una sola cifra citata nel testo discorsivo è
stata corretta.

## Che cosa nasce dopo la scelta

Un documento unico di sistema di design — token, componenti, stati, regole di
accessibilità — prodotto **in Fase 1D**, quando servirà a costruire il CMS. Le
proposte scartate restano qui: sono la traccia di ciò che è stato considerato.
