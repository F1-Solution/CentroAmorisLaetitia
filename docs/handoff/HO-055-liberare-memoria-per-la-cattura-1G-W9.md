# HO-055 — Liberare memoria per la cattura integrale della `1G-W9`

Fase 1G, wave `1G-W9`, attività T10. Scritto il 2026-10-29. Stesso schema di HO-053.

## 1. Perché serve

Il confronto visivo integrale (criterio W9-4) cattura 585 schermate del sito di sviluppo con
un browser automatico. Per una cattura affidabile servono **almeno 6 GB liberi**. Il
2026-10-29, con i server di sviluppo accesi, la macchina ne ha **2,3 su 31,5**.

I maggiori consumatori misurati, che non servono alla cattura:

| Che cosa | Memoria indicativa |
|---|---|
| Chrome (molte schede) | ~6,7 GB |
| Compilatore C++ (`cl`, una compilazione in corso di un altro progetto) | ~2,8 GB |
| Edge WebView (app che lo usano, per esempio Teams o Outlook nuovo) | ~2,8 GB |
| ChatGPT, Granola, Slack, OneDrive | ~3,6 GB in tutto |

Non vanno chiusi: Docker Desktop e i contenitori `amoris-dev-db-1`,
`amoris-dev-objects-1`, `wpref-wp-1`, `wpref-db-1`; Claude Code; le finestre dei server
di sviluppo, se ne vedi.

## 2. Passi

1. Lascia finire o interrompi la compilazione C++ in corso; chiudi Chrome (o almeno le schede
   che non ti servono) e le app che non ti servono nelle prossime due ore.
2. In PowerShell controlla la memoria libera:

   ```powershell
   $o = Get-CimInstance Win32_OperatingSystem; '{0:N1} GB liberi' -f ($o.FreePhysicalMemory/1MB)
   ```

   **Esito atteso:** almeno 6 GB liberi.
3. Lascia la macchina accesa e non riaprire le applicazioni chiuse finché Claude Code non
   dice che la cattura è finita (circa un'ora e mezza).

## 3. Se qualcosa non va

| Problema | Che cosa fare |
|---|---|
| Restano meno di 6 GB | riavvia Windows, avvia Docker Desktop, non aprire altro e ripeti il passo 2; i contenitori del progetto ripartono da soli, i server di sviluppo li riavvia Claude Code |
| Un contenitore del progetto manca | `docker compose -f infra/compose/docker-compose.yml --env-file .env up -d` dalla radice del progetto |

## 4. Come segnalare il completamento

```
HO-055: fatto, <N> GB liberi. Avvia la cattura integrale della 1G-W9.
```
