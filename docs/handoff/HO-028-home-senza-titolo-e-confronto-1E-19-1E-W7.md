# HO-028 — Home senza titolo e confronto della prova 1E-19 (`1E-W7`)

Fase 1E, wave `1E-W7`. Scritto il 2026-10-18. Analisi in
`docs/qa/verifiche/analisi-1E-19-HO-026.md` §6.

## 1. Decisioni

| # | Domanda | Opzioni | Raccomandazione | Impatto |
|---|---|---|---|---|
| D103 | La home ha il titolo vuoto (come nella sorgente) e l'API rifiuta ogni salvataggio con titolo vuoto: oggi la home non si modifica dal CMS | **A** l'API accetta il titolo vuoto in modifica per i contenuti che già lo hanno (nessun cambio per gli altri), con prova · **B** titolo vuoto ammesso per tutti i contenuti · **C** titolo obbligatorio: l'editor chiede un titolo alla home prima di salvare (il titolo resta nascosto se `show_title` è falso) | **A** | A e B non cambiano la pagina pubblica; C cambia `<title>` e metadati della home rispetto alla sorgente |
| D104 | La prova 1E-19 confronta l'HTML intero, ma l'ordine del payload RSC di Next.js cambia a ogni lettura anche senza salvataggi | **A** la prova confronta l'HTML senza gli script del payload, più il testo dei metadati (`<head>`), e controlla nel database `modified_at` e `description_source` · **B** rendere deterministico il payload (indagine su Next.js, esito incerto) · **C** confrontare gli screenshot invece dell'HTML | **A** | A misura ciò che il visitatore riceve; B tocca il sito |

Default vietato: dichiarare 1E-19 superata senza una nuova esecuzione; aggirare la home
escludendola dal campione.

## 2. Memoria

La voce 4 dei form (45/81), le prove e2e e la ricompilazione del sito sono ferme: memoria
libera 1,9 GB, il sistema ferma i processi sotto quella soglia. Prima di riprendere, chiudi
le applicazioni che non servono (Chrome occupava 9,6 GB), come in HO-014.

## 3. Dopo la conferma

1. Correzioni D103 e D104 con prove; `lint`/`typecheck`/`test` verdi; API riavviata.
2. 1E-19 rieseguita (scrive `updated_at` di 4 contenuti, nient'altro), con copia di salvataggio prima.
3. Voce 4 ripresa da `stato-form-HO-026.json`, poi cancellazione delle compilazioni sintetiche come in HO-026.
4. `pnpm test:e2e`, poi ricompilazione e riavvio del sito su `:3200` con `SITE_URL`.
5. Report visivo.

## 4. Come confermare

```
HO-028: D103=A, D104=A, memoria liberata; procedi.
```
