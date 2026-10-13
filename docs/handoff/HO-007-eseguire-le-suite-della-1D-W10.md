# HO-007 — Eseguire a mano le suite della wave `1D-W10`

**Fase:** 1D, dopo la wave `1D-W10`. **Stato:** facoltativa, ma consigliata prima
di approvare la wave.

---

## 1. Perché

La wave aggiunge quattro cose che si possono **eseguire**, non solo leggere:
l'andata e ritorno su tutti i contenuti, i flussi del CMS nel browser,
l'idempotenza dell'import su un sottoinsieme sintetico e la misura della
copertura. Questo documento dice come eseguirle sulla tua macchina, che cosa ti
devi aspettare e che cosa fare se qualcosa non torna.

Nessuno di questi comandi tocca dati reali. Quelli che leggono
`source-private/` lo fanno **in sola lettura** e scrivono su database usa e
getta, distrutti alla fine.

---

## 2. Prerequisiti

1. Docker in esecuzione, con i servizi del progetto avviati:
   `pnpm compose:up`.
2. Un file `.env` alla radice completo — lo stesso che HO-006 chiedeva. I
   comandi lo leggono da soli.
3. Le dipendenze installate: `pnpm install`.
4. Per le prove nel browser, il browser di Playwright:
   `pnpm exec playwright install --with-deps chromium`.

---

## 3. Le quattro suite

### 3.1 Prove sintetiche, quelle che gira anche la CI

```powershell
pnpm test
```

Sono le prove di tutti i pacchetti. Dentro ci sono le tre novità della wave:

| Dove | Che cosa prova |
|---|---|
| `apps/admin/tests/roundtrip-corpus.test.ts` | andata e ritorno dentro l'editor, su tutti e 14 i tipi di blocco |
| `apps/api/tests/roundTripCorpus.test.ts` | andata e ritorno al confine del servizio, sugli stessi documenti |
| `apps/importer/tests/unit/syntheticSubset.test.ts` | catena completa dell'import su un sottoinsieme sintetico: idempotenza, andata e ritorno, ordine delle fasi di DR-062 |

Il corpus dei documenti sta in `tests/fixtures/block-corpus.json`, è generato e
si rigenera con:

```powershell
pnpm --filter @amoris/importer exec tsx ../../tests/fixtures/build-block-corpus.ts
```

### 3.2 Flussi del CMS nel browser

```powershell
pnpm test:e2e
```

**Che cosa fa, in quest'ordine:** ricrea da zero il database `amoris_e2e`, vi
scrive il seme sintetico, compila sito pubblico e area amministrativa, avvia i
tre server su porte proprie — 3100, 3101, 3102 — ed esegue venti prove.

**Non tocca il tuo database di sviluppo** e non usa le porte 3000, 3001 e 3002:
puoi lasciare `pnpm dev` acceso mentre gira.

Se una prova fallisce, il rapporto con schermate e tracce è in
`playwright-report/`; aprilo con `pnpm exec playwright show-report`.

### 3.3 Misura della copertura

```powershell
pnpm test:coverage
```

Esegue tutti i pacchetti in un processo solo e scrive il rapporto in
`coverage/`. Dura parecchio — molto più di `pnpm test`, che sfrutta la cache di
Turborepo — e per questo **non** fa parte della CI di ogni modifica. I numeri
dell'ultima misura sono in [`docs/qa/coverage-report.md`](../qa/coverage-report.md).

### 3.4 Misure sulla sorgente reale — solo in locale

```powershell
pnpm --filter @amoris/importer exec vitest run --config vitest.real.config.ts
```

Non gira in CI (DR-010). Contiene l'andata e ritorno su **tutti i 108 contenuti
veri** e la misura della soglia del blocco di riserva con l'ordine delle fasi di
DR-062. Riporta **solo conteggi**: nessun titolo, nessun testo, nessun
frammento di contenuto.

---

## 4. Che cosa ti devi aspettare

| Comando | Esito atteso |
|---|---|
| `pnpm test` | tutti i pacchetti verdi |
| `pnpm test:e2e` | 20 prove superate |
| `pnpm test:coverage` | rapporto scritto in `coverage/`, numeri coerenti con `docs/qa/coverage-report.md` |
| suite reale | andata e ritorno senza differenze; soglia del blocco di riserva **rispettata** |

---

## 5. Se qualcosa non va

| Sintomo | Che cosa significa | Che cosa fare |
|---|---|---|
| `IP_HASH_SALT non è impostata` | il `.env` è incompleto | confronta con `.env.example` come in HO-006 §3.1 |
| la porta 3100, 3101 o 3102 è occupata | un'esecuzione precedente non si è chiusa | chiudi il processo; le prove **non** riusano un server già acceso, apposta |
| `database "amoris_e2e" does not exist` | la preparazione non è andata a termine | rilancia `pnpm test:e2e`: ricrea tutto da zero |
| l'archivio a oggetti non risponde | MinIO non è avviato | `pnpm compose:up` |
| le prove reali si saltano da sole | `source-private/` non è raggiungibile | è voluto: senza sorgente, quelle prove si dichiarano saltate invece di fallire |

---

## 6. Effetti collaterali da sapere

- `pnpm test:e2e` **ricompila** sito pubblico e area amministrativa con
  l'indirizzo del servizio dell'end-to-end. Se poi ti serve la compilazione
  normale, rilancia `pnpm build`.
- Il database `amoris_e2e` resta sulla macchina fra un'esecuzione e l'altra e
  viene ricreato a ogni avvio. Contiene **solo** dati inventati.

---

## 7. Come segnalare il completamento

Basta dire quali comandi hai eseguito e quali sono andati a buon fine. Se uno
fallisce, servono la riga di comando, l'esito a terminale e — per le prove nel
browser — la cartella `playwright-report/`.
