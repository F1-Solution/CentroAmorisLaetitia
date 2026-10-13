# HO-014 — Liberare memoria per la ricattura della `1E-W6`

Fase 1E, wave `1E-W6`. Scritto il 2026-10-12.

## 1. Perché serve

Il confronto visivo cattura 585 schermate del sito nuovo con un browser
automatico. Il 2026-10-12 la macchina aveva circa **2 GB liberi su 31,5**: Claude
Code ha fermato la cattura a 475 su 585 e, per regola, non la riavvia senza una
tua richiesta. Per una cattura affidabile servono **almeno 6 GB liberi**.

Misurati il 2026-10-12, i maggiori consumatori che non servono al progetto:

| Che cosa | Memoria indicativa | Serve alla 1E? |
|---|---|---|
| Contenitori Docker `agenticos-*` (`hermes`, `postgres`, `caddy`) e `buildx_buildkit_default` | parte dei 1,2 GB di `vmmemWSL` | no |
| Visual Studio (`devenv`, due istanze) | ~1 GB | no |
| Browser con molte schede (Chrome, Edge WebView) | ~1,8 GB | no |
| OneDrive | ~0,5 GB | no |

Servono invece, e **non vanno fermati**: `amoris-dev-db-1`, `amoris-dev-objects-1`,
`wpref-wp-1`, `wpref-db-1`.

## 2. Passi

1. Chiudi Visual Studio e le schede del browser che non ti servono.
2. In PowerShell, ferma i contenitori estranei al progetto:

   ```powershell
   docker stop agenticos-hermes-1 agenticos-postgres-1 agenticos-caddy-1 buildx_buildkit_default
   ```

   `docker stop` non cancella nulla: li riavvii quando vuoi con `docker start <nome>`.
3. Controlla la memoria libera in PowerShell:

   ```powershell
   $o = Get-CimInstance Win32_OperatingSystem; '{0:N1} GB liberi' -f ($o.FreePhysicalMemory/1MB)
   ```

   **Esito atteso:** almeno 6 GB liberi.
4. Controlla che i contenitori del progetto siano attivi:

   ```powershell
   docker ps --format "{{.Names}}" | Select-String "amoris|wpref"
   ```

   **Esito atteso:** quattro righe, `amoris-dev-db-1`, `amoris-dev-objects-1`,
   `wpref-wp-1`, `wpref-db-1`.

## 3. Se qualcosa non va

| Problema | Che cosa fare |
|---|---|
| Restano meno di 6 GB | riavvia Windows, avvia Docker Desktop e ripeti dal passo 3; i contenitori del progetto ripartono da soli |
| Un contenitore del progetto manca | `docker compose -f infra/compose/docker-compose.yml --env-file .env up -d` dalla radice del progetto per `amoris-dev-*`; per `wpref-*` vedi HO-001 |

## 4. Come segnalare il completamento

```
HO-014: fatto, <N> GB liberi. Rilancia la ricattura integrale della 1E-W6.
```
