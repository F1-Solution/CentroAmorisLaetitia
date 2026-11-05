# HO-057 — Liberare disco e riavviare Docker per le immagini della `1F-W2`

Fase 1F, wave `1F-W2`, attività T4. Scritto il 2026-11-05, dopo l'esecuzione: l'utente ha
segnalato «disco liberato e Docker riavviato» lo stesso giorno.

## 1. Perché serve

La prova delle immagini (`pnpm test:images`) costruisce tre immagini di produzione (`web`,
`admin`, `api`). Ogni costruzione scarica le dipendenze e compila: servono **almeno 20 GB
liberi** sul disco di Docker. Con il disco pieno la costruzione si interrompe e Docker può
lasciare file scompattati a metà.

## 2. Passi

1. Chiudi Claude Code se sta costruendo immagini (nessuna `docker build` in corso).
2. Libera spazio sul disco `C:` (cestino, download, cartelle temporanee che non ti servono).
3. In PowerShell controlla lo spazio libero:

   ```powershell
   '{0:N0} GB liberi' -f ((Get-PSDrive C).Free / 1GB)
   ```

   **Esito atteso:** almeno 20 GB.
4. Riavvia Docker Desktop (icona nella barra delle applicazioni → *Restart*) e attendi che
   indichi *Engine running*.
5. Controlla che i contenitori del progetto siano sani:

   ```powershell
   docker ps --format '{{.Names}} {{.Status}}'
   ```

   **Esito atteso:** `amoris-dev-db-1` e `amoris-dev-objects-1` con `(healthy)`.

## 3. Se qualcosa non va

| Problema | Che cosa fare |
|---|---|
| `failed to connect to the docker API` | Docker Desktop non è avviato: avvialo e ripeti il passo 5 |
| Un contenitore del progetto manca | `docker compose -f infra/compose/docker-compose.yml --env-file .env up -d` dalla radice del progetto |
| Dopo il riavvio `node` va in «Segmentation fault» nei contenitori | uno snapshot è rimasto troncato dal disco pieno: non intervenire, segnalalo a Claude Code (§5) |

## 4. Come segnalare il completamento

```
HO-057: fatto, <N> GB liberi, Docker riavviato.
```

## 5. Esito del 2026-11-05

- Docker Desktop non era avviato: l'ha avviato Claude Code. Contenitori di sviluppo sani.
- Disco `C:`: 122 GB liberi su 953.
- Effetto residuo del disco pieno: nello snapshot locale dell'immagine di base
  `node:25.0.0-bookworm-slim` il file `/usr/local/bin/node` era troncato a 4 194 304 byte
  (invece di 136 317 584) e `node` andava in «Segmentation fault» in ogni `docker run`. Né la
  rimozione dell'immagine né lo svuotamento della cache di build lo eliminavano. Claude Code
  ha confrontato i 2595 file dello snapshot con il livello integro del registro (solo quel
  file differiva) e l'ha sostituito con la copia integra (stessa impronta SHA-256). Dopo:
  `node v25.0.0` parte. Nessun dato del progetto toccato.
