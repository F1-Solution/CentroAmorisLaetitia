# HO-053 — Liberare memoria per la cattura integrale della `1G-W7`

Fase 1G, wave `1G-W7`, attività T4. Scritto il 2026-10-27.

## 1. Perché serve

Il confronto visivo integrale (1G-21) cattura 585 schermate del sito di sviluppo con un
browser automatico. Per una cattura affidabile servono **almeno 6 GB liberi** (come
HO-014). Il 2026-10-27, con i server di sviluppo accesi, la macchina ne ha **4,1 su 31,5**.

I maggiori consumatori misurati, che non servono alla cattura:

| Che cosa | Memoria indicativa |
|---|---|
| Chrome (molte schede) | ~6,8 GB |
| Edge WebView (app che lo usano, per esempio Teams o Outlook nuovo) | ~2,9 GB |
| Visual Studio (`devenv`) | ~1,3 GB |

Non vanno chiusi: Docker Desktop e i contenitori `amoris-dev-db-1`,
`amoris-dev-objects-1`, `wpref-wp-1`, `wpref-db-1`; Claude Code; le finestre dei server
di sviluppo, se ne vedi.

## 2. Passi

1. Chiudi Chrome (o almeno le schede che non ti servono), Visual Studio e le app che non
   ti servono nelle prossime due ore.
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
| Restano meno di 6 GB | riavvia Windows, avvia Docker Desktop, non aprire altro e ripeti il passo 2; i contenitori del progetto ripartono da soli |
| Un contenitore del progetto manca | `docker compose -f infra/compose/docker-compose.yml --env-file .env up -d` dalla radice del progetto |

## 4. Come segnalare il completamento

```
HO-053: fatto, <N> GB liberi. Avvia la cattura integrale della 1G-W7.
```

## 5. Seconda esecuzione (2026-10-27, dopo il commit `0dd1efb`)

La prima esecuzione ha liberato 9,2 GB, ma la cattura è stata rinviata per le attività aggiunte
(DR-278…DR-288). Ora, con i server di sviluppo accesi, i GB liberi sono **3,8**: Chrome ~3,3 GB,
Edge WebView ~1,4 GB, Visual Studio ~0,4 GB; Docker (~8,6 GB) **non** va chiuso. Ripeti i passi
del §2 e segnala con:

```
HO-053: fatto di nuovo, <N> GB liberi. Avvia la cattura integrale della 1G-W7.
```
