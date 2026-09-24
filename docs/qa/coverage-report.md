# Copertura delle prove — misura della wave `1D-W10`

**Misurata il 2026-09-24**, su `main`, con

```bash
pnpm test:coverage
```

che esegue tutti i pacchetti in un processo solo (`vitest.config.ts` alla
radice) e scrive il rapporto navigabile in `coverage/`. Il comando **non** fa
parte della CI di ogni modifica: dura molto più di `pnpm test`, che sfrutta la
cache di Turborepo. Si rifà quando serve una misura, e il risultato si scrive
qui.

---

## 1. Che cosa è entrato nella misura

**129 file di prove, 1005 prove, tutte superate.** In 585 secondi.

Sono le **sole suite sintetiche**: `tests/real/**` dell'importer — che legge
`source-private/` — ha una configurazione separata e non è inclusa (DR-010).
Non sono incluse nemmeno le prove end-to-end di Playwright: girano contro le
applicazioni **compilate**, e uno strumento di copertura che misura il codice
sorgente non le vede. Il §4 dice perché la cosa conta nel leggere i numeri.

---

## 2. Il totale

| Misura | Coperto / totale | Percentuale |
|---|---|---|
| Istruzioni | 15 907 / 18 566 | **85,67 %** |
| Righe | 15 907 / 18 566 | **85,67 %** |
| Diramazioni | 2 924 / 3 714 | **78,72 %** |
| Funzioni | 766 / 990 | **77,37 %** |

---

## 3. Per pacchetto

| Pacchetto | File | Istruzioni | Diramazioni | Funzioni |
|---|---|---|---|---|
| `apps/admin` | 38 | 68,13 % | 73,68 % | 64,75 % |
| `apps/api` | 45 | 88,36 % | 71,87 % | 82,91 % |
| `apps/importer` | 100 | 86,66 % | 77,44 % | 89,01 % |
| `packages/blocks` | 54 | 95,65 % | 86,67 % | 100,00 % |
| `packages/contracts` | 3 | 100,00 % | — | — |
| `packages/db` | 17 | 99,85 % | 97,06 % | 12,50 % |
| `packages/ui` | 64 | 95,86 % | 90,35 % | 76,39 % |
| **totale** | **321** | **85,67 %** | **78,72 %** | **77,37 %** |

`packages/db` è quasi tutto dichiarazione di schema: le istruzioni si eseguono
all'importazione, le «funzioni» sono i costruttori di indice che nessuna prova
chiama direttamente. Il 12,50 % sulle funzioni dice questo, non una mancanza di
prove: lo schema è verificato da `pnpm db:verify`, che lo confronta con la
forma canonica di `docs/architecture/schema.sql`.

---

## 4. Dove manca, e perché

I dodici file con più istruzioni scoperte:

| File | Istruzioni scoperte | Copertura |
|---|---|---|
| `apps/admin/src/components/ContentList.tsx` | 234 | 0 % |
| `apps/admin/src/components/editor/RichTextEditor.tsx` | 143 | 13,33 % |
| `apps/admin/src/components/editor/ContentEditor.tsx` | 86 | 74,25 % |
| `apps/admin/src/components/editor/BlockInspector.tsx` | 81 | 28,94 % |
| `apps/importer/src/cli/index.ts` | 70 | 0 % |
| `apps/admin/src/app/accesso/page.tsx` | 68 | 0 % |
| `apps/admin/src/components/menu/MenuManager.tsx` | 66 | 78,43 % |
| `apps/importer/src/cli/commands/rollback.ts` | 66 | 0 % |
| `apps/importer/src/convert/divi/convert.ts` | 58 | 86,81 % |
| `apps/importer/src/cli/args.ts` | 56 | 0 % |
| `apps/admin/src/app/scelta-area/page.tsx` | 55 | 0 % |
| `apps/importer/src/cli/commands/verify.ts` | 50 | 0 % |

Tre categorie, e vanno distinte perché non hanno lo stesso significato.

**1. Codice provato dalle prove end-to-end, che questa misura non vede.**
`ContentList`, `accesso/page.tsx`, `scelta-area/page.tsx`, `MenuManager` e
buona parte di `ContentEditor` sono percorsi **eseguiti** dalle venti prove di
Playwright della `1D-W10`: elenco e ricerca dei contenuti, accesso con password
sbagliata e giusta, scelta della veste, creazione e pubblicazione di una
pagina, aggiunta di una voce di menu. La copertura li conta come scoperti
perché misura il sorgente e quelle prove girano contro le applicazioni
compilate. **Non sono codice senza prove: sono codice con prove di un altro
tipo.** Un numero unico che le sommasse sarebbe più alto e meno vero.

**2. Il programma a riga di comando dell'importer.** `cli/index.ts`,
`cli/args.ts`, `cli/commands/rollback.ts` e `cli/commands/verify.ts` sono
l'involucro: leggono gli argomenti, stampano il rapporto, chiamano ciò che le
prove coprono davvero — orchestratore, fasi, rollback, verifiche — e che sta
sopra l'86 % di copertura. La wave `1D-W11` li esegue tutti sulla sorgente
vera, ed è lì che si vedranno funzionare.

**3. `RichTextEditor` e `BlockInspector`, che sono la mancanza vera.** Sono i
due punti in cui un redattore lavora davvero e sono i meno coperti. Il motivo è
noto e dichiarato: TipTap ha bisogno di un ambiente di resa completo, e le
prove esistenti lo esercitano dall'esterno — `richtext.test.ts` prova lo schema
e la ripulitura del markup, non l'editor. **È il punto su cui la Fase 1G
collauderà con una persona vera**, e resta un candidato dichiarato per prove
nuove.

---

## 5. Soglie

Le regole generali dell'utente chiedono **80 % minimo**. Istruzioni e righe lo
superano (85,67 %); diramazioni (78,72 %) e funzioni (77,37 %) no, e non si
arrotonda per eccesso: la differenza sta quasi tutta nei due file del punto 3 e
nelle tre categorie di codice che le prove end-to-end coprono senza comparire
qui.

**Nessuna soglia è applicata automaticamente**, e la scelta è deliberata: una
soglia che fa fallire la CI su un numero che la CI stessa non misura — perché
`pnpm test:coverage` non gira in CI — sarebbe una regola scritta e non
applicata. Se la si vuole vincolante, va deciso prima **dove** misurarla.

---

## 6. Come si rifà

```bash
pnpm test:coverage
```

Il rapporto navigabile si apre da `coverage/index.html`. La cartella `coverage/`
non entra in Git.
