# HO-017 — Distruzione dell'istanza WordPress di riferimento (fine Fase 1E)

Fase 1E, a chiusura. Scritto il 2026-10-12. **Rinviato a dopo la Fase 1G** (DR-212,
2026-10-19): l'istanza resta disponibile come riferimento durante il collaudo del CMS. È una **cancellazione**, quindi chiede la tua
conferma puntuale (PLAN §7, conferma n. 5; DR-025).

## 1. Che cosa si distrugge

I contenitori `wpref-wp-1` e `wpref-db-1` e i loro volumi: la copia locale di
WordPress usata come strumento di misura. **Non** si tocca `source-private/`, che
resta la sorgente autorevole e da cui l'istanza si può ricostruire (HO-001).

## 2. Prima di distruggere

| Controllo | Esito atteso |
|---|---|
| UAT approvata | registrata in `docs/qa/visual-parity-report.md` |
| Catture di riferimento conservate | `docs/qa/screenshots/riferimento/` presente, con le impronte in `docs/qa/riferimento/catture.csv` |

## 3. Che cosa farò, dopo la tua conferma

```powershell
docker compose -f tools/wp-reference/docker-compose.yml down -v
docker ps -a --format "{{.Names}}" | Select-String "wpref"   # atteso: nessuna riga
```

Se in quel momento il file di compose ha un percorso diverso, te lo mostro prima
di eseguire.

## 4. Come confermare

```
HO-017: confermo la distruzione dell'istanza di riferimento.
```
