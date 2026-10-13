# HO-016 — UAT di parità visiva (`1E-W8`)

Fase 1E, wave `1E-W8`. Scritto il 2026-10-12. **Non ancora attivo:** si apre
quando `docs/qa/visual-parity-report.md` e `.planning/phases/1E/AUDIT.md` sono
completi. Questo documento descrive già la prova, così puoi pianificarla.

## 1. Che cosa è

La UAT è la tua prova di accettazione: guardi il sito nuovo accanto alla sorgente e
dichiari se lo approvi. È la **condizione 13 del gate**: nessuna fase gestionale
si pianifica senza la tua approvazione esplicita, registrata nel rapporto. Io non
dichiaro mai la parità al posto tuo.

## 2. Prerequisiti

| Che cosa | Come verificarlo |
|---|---|
| HO-013, HO-014 e HO-015 chiusi | tabella di `docs/handoff/README.md` |
| Rapporto di parità completo | `docs/qa/visual-parity-report.md` esiste, senza voci «da completare» |
| Sito nuovo e sorgente attivi | http://127.0.0.1:3200/ e http://127.0.0.1:8088/ si aprono; se non è così, chiedimi di avviarli |
| Tempo | circa 2 ore, anche in più sessioni |

## 3. Passi

1. **Leggi il rapporto** `docs/qa/visual-parity-report.md`: ambiente, soglia, numeri
   del confronto, maschere e difformità che hai già approvato in HO-015.
2. **Confronto a vista** sulle pagine più importanti. Apri le due versioni affiancate
   e controlla almeno queste: `/`, `/chi-siamo/`, `/contatti/`, `/dove-siamo/`,
   `/category/news/`, un articolo recente, `/informazioni-sui-cookie/`.
3. **Prova da telefono:** nel browser premi F12, poi Ctrl+Shift+M, e scegli una
   larghezza di 390 px. Apri e chiudi il menu, scorri una pagina lunga.
4. **Prova un form** su `/contatti/` con **dati inventati** (per esempio
   «Mario Prova», `prova@example.invalid`). Atteso: il messaggio di conferma; nessuna
   email parte (DR-108). Non usare mai dati veri.
5. **Annota ogni differenza** che non ti convince: pagina, larghezza, che cosa vedi.

## 4. Come rispondere

Se approvi:

```
HO-016: approvo la parità visiva del sito pubblico (UAT 1E).
```

Se non approvi, elenca le differenze:

```
HO-016: non approvo. 1) <pagina>, <larghezza>: <che cosa vedi>. 2) …
```

Registrerò la tua risposta, con le tue parole, nel rapporto e nel registro delle
decisioni. Le differenze diventano correzioni, poi si ripete la UAT su quelle.

## 5. Che cosa la UAT non copre

Sicurezza, prestazioni, email, privacy e cookie sono della Fase 1F. MI-06, la
verifica legale, resta aperta e richiede un professionista.
