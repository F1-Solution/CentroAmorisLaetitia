# HO-011 — Riavviare Docker Desktop per finire l'audit `1D-W12`

**Fase:** 1D, wave `1D-W12`. **Stato:** in attesa che tu la esegua.

## 1. Perché serve

Dal 2026-10-08 il motore di Docker Desktop risponde `500 Internal Server Error`
a ogni comando (`docker ps`, `docker version`). Senza Docker non sono
raggiungibili né il database né l'archiviazione, e 7 criteri dell'audit
(1, 2, 9, 10, 11, 15, 16) non si possono eseguire. Vedi
`.planning/phases/1D/AUDIT.md` §2.

## 2. Prerequisiti

- Nessun comando dell'importer o della suite di test in corso.
- I dati vivono nei volumi: un riavvio non li cancella. **Non** ricreare i volumi.

## 3. Passi

1. Chiudi Docker Desktop dall'icona nell'area di notifica (*Quit Docker Desktop*).
2. In PowerShell: `wsl --shutdown`
3. Riapri Docker Desktop e attendi «Engine running».
4. Dalla radice del repository, avvia l'ambiente come fai di solito, per esempio
   `docker compose -f infra/compose/dev.yml up -d`.
5. Controlla: `docker ps --format "{{.Names}} {{.Status}}"`

## 4. Esito atteso

`amoris-dev-db-1` e `amoris-dev-objects-1` risultano `Up … (healthy)`.

## 5. Se fallisce

- Se Docker Desktop non riparte: riavvia Windows e riprova dal passo 3.
- Se i container non ripartono: non ricreare i volumi, copia il messaggio di
  errore e segnalalo.

## 6. Come segnalare il completamento

Nel prompt successivo scrivi:

```
HO-011 fatto, Docker sano. D30 = <A|B>. Riprendi l'audit 1D-W12.
```
