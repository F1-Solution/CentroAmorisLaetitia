# HO-027 — Ripristino di una description e nuova prova 1E-19 (`1E-W7`)

Fase 1E, wave `1E-W7`. Scritto il 2026-10-18. Analisi in
`docs/qa/verifiche/analisi-1E-19-HO-026.md`.

## 1. Perché serve

Durante HO-026 la prova 1E-19 ha salvato `/corsi-2022-2023/` reinviando i blocchi senza
il testo; l'API ha quindi azzerato `description_source` (DR-180) e la meta description
pubblica dell'articolo è cambiata. Il CMS reale non ha il difetto. Servono due decisioni
e una conferma di scrittura, **solo sul database locale `amoris`**.

## 2. Decisioni

| # | Domanda | Opzioni | Raccomandazione |
|---|---|---|---|
| D101 | Come si corregge | **A** la prova invia il testo calcolato dai blocchi, come il CMS; più `'\s+'` a `apps/api/src/modules/content/service.ts:189`, con prova · **B** l'API confronta l'HTML quando arrivano blocchi senza testo | **A** |
| D102 | Come si ripristina | **A** un solo `update` di `description_source` di quel contenuto, con il valore della copia `amoris-prima-HO-026-2026-10-18.dump`, in una transazione che si annulla se tocca più di una riga · **B** `pg_restore --clean` dell'intera copia | **A** |

Default vietato: rieseguire 1E-19 senza correzione; lasciare la description vuota.

## 3. Che cosa farò dopo la conferma (D102 = A)

1. Nuova copia di salvataggio in `$HOME\amoris-backup\amoris-prima-HO-027-<data>.dump`.
2. Transazione: `update contents set description_source = <valore della copia> where path = '/corsi-2022-2023/' and description_source is null`; `raise exception` se le righe non sono 1.
3. Verifica: la riga coincide con la copia di HO-026 in ogni colonna salvo `updated_at`; la meta description pubblica torna quella di prima.
4. Correzione D101 con prove, `lint`/`typecheck`/`test` verdi; poi 1E-19 rieseguita (scrive di nuovo `updated_at` di 3-4 contenuti, come HO-026).

## 4. Esito atteso

| Controllo | Atteso |
|---|---|
| Passo 2 | `COMMIT`, 1 riga |
| 1E-19 | tutti i contenuti del campione identici; `modified_at` e `description_source` invariate |

## 5. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Il passo 2 tocca 0 o più righe | la transazione si annulla, mi fermo |
| 1E-19 ancora diversa | mi fermo e riporto la differenza |
| Serve tornare indietro | `pg_restore --clean` dalla copia del passo 1, su tua conferma |

## 6. Come confermare

```
HO-027: D101=A, D102=A, confermo il ripristino e la nuova prova 1E-19.
```
