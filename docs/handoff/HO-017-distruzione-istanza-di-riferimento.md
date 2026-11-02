# HO-017 — Distruzione dell'istanza WordPress di riferimento (dopo la Fase 1G)

Scritto il 2026-10-12 per la fine della Fase 1E e rinviato a dopo la Fase 1G (DR-212).
**Aggiornato il 2026-11-02**, dopo l'approvazione del collaudo redazionale (DR-347) e la
chiusura della 1G (DR-348). È una **cancellazione**, quindi chiede la tua conferma puntuale
(DR-025). Viene prima dell'esecuzione della Fase 1F (DR-272, `1F-W1`).

## 1. Che cosa si distrugge

La copia locale di WordPress usata come strumento di misura, rilevata il 2026-11-02:

| Oggetto | Nome | Dimensione |
|---|---|---|
| Contenitore WordPress | `wpref-wp-1` (spento) | — |
| Contenitore database | `wpref-db-1` (spento) | — |
| Volume dei file | `wpref_html` | 873 MB |
| Volume del database | `wpref_dbdata` | 155 MB |
| Immagine costruita (solo con D242 = B) | `wpref-wp:latest` | 849 MB |

**Non** si tocca `source-private/`, che resta la sorgente autorevole: da lì l'istanza si
ricostruisce con HO-001. Non si toccano neppure i contenitori di sviluppo (`amoris-dev-*`) né
l'immagine `mariadb:10.11`.

## 2. Prerequisiti, già verificati

| Controllo | Esito il 2026-11-02 |
|---|---|
| UAT di parità approvata | ✅ DR-210, `docs/qa/visual-parity-report.md` §12 |
| Collaudo redazionale approvato e Fase 1G chiusa | ✅ DR-347, DR-348 |
| Catture di riferimento conservate | ✅ 118 file in `docs/qa/screenshots/riferimento/`, 585 righe di impronte in `docs/qa/riferimento/catture.csv` |
| Riferimenti salvati di menu e metadati | ✅ `docs/qa/riferimento/menu.csv`, `metadati.csv`, `controprova.csv`, `rumore.csv` |
| Istanza spenta | ✅ entrambi i contenitori sono in stato `Exited` |

## 3. Che cosa si perde

- Le prove di metadati e redirect della 1G-22 usavano l'istanza **accesa**
  (`AUDIT.md` della 1G). Per rifarle sul vecchio WordPress servirà ricostruirla con HO-001,
  oppure confrontare con i riferimenti salvati del §2.
- Il confronto di parità della `1F-W7` segue il metodo di 1E-19 (DR-202): confronta il sito
  nuovo prima e dopo un salvataggio, e non usa l'istanza.

## 4. Decisione prima di eseguire

**D242 — Si toglie anche l'immagine costruita `wpref-wp:latest` (849 MB)?**

| Opzione | Effetto |
|---|---|
| **A** | Solo contenitori e volumi, come nel testo originale di HO-017. L'immagine resta |
| **B** | Anche l'immagine (`--rmi local`): libera 849 MB in più. Si ricostruisce dal `Dockerfile` di `tools/wp-reference/` |
| **C** | Rinviare HO-017 |

**Raccomandazione: B.** Il disco C: è stato un vincolo nella 1G (HO-053, HO-055), e
l'immagine senza volumi non serve a nulla. **Default vietato:** senza risposta non eseguo.

## 5. Che cosa farò, dopo la tua conferma

Comandi da PowerShell, nella radice del progetto:

```powershell
# D242 = A
docker compose -f tools/wp-reference/docker-compose.yml down -v
# D242 = B
docker compose -f tools/wp-reference/docker-compose.yml down -v --rmi local
```

**Verifica successiva:** ognuno di questi comandi deve rispondere con nessuna riga
(per l'immagine, solo con B).

```powershell
docker ps -a --format "{{.Names}}" | Select-String "wpref"
docker volume ls --format "{{.Name}}" | Select-String "wpref"
docker images --format "{{.Repository}}" | Select-String "wpref"
```

Controllerò anche che i contenitori `amoris-dev-*` siano ancora in salute.

- **Copia di sicurezza:** nessuna. Tutto è ricostruibile da `source-private/` con HO-001.
  Se invece vuoi una copia dei volumi prima di cancellarli, dimmelo: costa circa 1 GB di disco.
- **Rientro:** ricostruzione con HO-001, dalle stesse sorgenti.
- **Se fallisce:** se `down` dice che il file di compose non trova le variabili, oppure se
  restano contenitori o volumi, mi fermo e ti mostro l'uscita. Non uso `docker rm` né
  `docker volume rm` a mano senza una nuova conferma.

## 6. Come confermare

Rispondi nella chat con una di queste righe:

```
HO-017: D242 = B, confermo la distruzione dell'istanza di riferimento.
HO-017: D242 = A, confermo la distruzione dell'istanza di riferimento.
HO-017: D242 = C, rinvio.
```

Esito: lo registro qui, in `docs/handoff/README.md` e in `PROGRESS.md`.

## 7. Esito — 2026-11-02, ✅ fatto (DR-349)

Confermato dall'utente con D242 = B. Eseguito
`docker compose -f tools/wp-reference/docker-compose.yml down -v --rmi local`: tolti i
contenitori `wpref-wp-1` e `wpref-db-1`, la rete `wpref_default`, i volumi `wpref_html` e
`wpref_dbdata` e l'immagine `wpref-wp:latest`.

Verifica:
- nessun contenitore, volume o immagine `wpref`;
- `mariadb:10.11` ancora presente;
- `amoris-dev-db-1` e `amoris-dev-objects-1` accesi e in salute.
