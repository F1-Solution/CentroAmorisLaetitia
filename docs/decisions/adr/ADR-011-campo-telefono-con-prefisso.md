# ADR-011 — Campo telefono con bandiera e prefisso internazionale

| | |
|---|---|
| **Stato** | **approvata** il 2026-10-13 con DR-132 (D55 = A) |
| **Data** | 2026-10-13 |
| **Wave** | `1E-W6` |
| **Decide** | come si rende il campo telefono dei form del sito pubblico |
| **Origine** | confronto visivo della `1E-W6`, famiglia C (`docs/qa/confronto/analisi-impatto-A-D.md`) |

---

## 1. Contesto

Nella sorgente il campo telefono dei form WPForms ha formato `smart`: a sinistra del
campo compare la bandiera italiana con il menu dei prefissi internazionali. Lo
disegna la libreria **intl-tel-input 17.0.5**, inclusa in WPForms
(`wp-content/plugins/wpforms/pro/assets/css/vendor/intl-tel-input.min.css`).

Il campo compare in **24 form**, quasi sempre due volte (un telefono per ciascun
coniuge). Senza la bandiera il campo è più largo a sinistra e la differenza si vede
in ogni confronto di quelle pagine.

## 2. Opzioni

| | Opzione | Costi | Rischi |
|---|---|---|---|
| A | **intl-tel-input**, versione mantenuta, servita dal sito | una dipendenza in più, da aggiornare | la resa della versione attuale può discostarsi di poco dalla 17.0.5 |
| B | Campo semplice, difformità dichiarata | nessuno | differenza visibile in 24 form |

La versione 17.0.5 della sorgente non si usa: è del 2021 e non riceve più
aggiornamenti, contro il divieto di dipendenze non mantenute (`CLAUDE.md`).

## 3. Scelta

**Opzione A** (DR-132): `intl-tel-input` **29.5.3**, licenza MIT, nessuna dipendenza
transitiva, pubblicata il 2026-09-24. Si carica nel browser solo dove c'è un campo
telefono, dal sito stesso e non da una CDN: nessuna richiesta a terzi al caricamento.
Paese iniziale Italia, come la sorgente.

Scartata: **B**, perché lascerebbe una differenza visibile in quasi tutti i form.

## 4. Conseguenze

- Il numero si invia com'è scritto; se si sceglie un paese diverso dall'Italia e il
  numero non comincia con «+», si salva con il prefisso del paese davanti, così la
  scelta fatta con la bandiera non si perde (revisione del codice della `1E-W6`).
- I fogli di stile della libreria si importano nel layout del sito; le immagini delle
  bandiere passano dalla build di Next.js.
- Se la libreria non si carica, il campo resta un normale campo telefono.

## 5. Reversibilità

Alta: il campo continua a funzionare anche senza libreria; togliere la dipendenza
significa rimuovere un'importazione e un effetto nel componente del campo.

## 6. Verifica

- Confronto visivo dei form con telefono nella prossima ricattura della `1E-W6`.
- Nessuna richiesta di rete verso domini esterni al caricamento di un form (criterio
  già controllato da `tests/visual/verifica-sito.ts`).
- Aggiornamento della libreria con le altre dipendenze, rispettando l'età minima di
  due settimane.
