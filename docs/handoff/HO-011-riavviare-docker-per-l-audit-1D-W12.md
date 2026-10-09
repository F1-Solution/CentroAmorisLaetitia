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
4. I container `amoris-dev-db-1` e `amoris-dev-objects-1` ripartono da soli con
   Docker Desktop. Se non ripartono, dalla radice del repository:
   `docker compose -f infra/compose/docker-compose.yml --env-file .env up -d db objects`.
   Si nominano i due servizi perché `objects-init` oggi non si scarica (D22) e
   fermerebbe tutto. Senza `--env-file .env` compose non trova le variabili:
   sono gli avvisi «variable is not set».
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

## 7. Aggiornamento del 2026-10-08 — il riavvio non è bastato

Dopo il riavvio segnalato, da qui `docker ps` risponde ancora `500`, sia da
Git Bash sia da PowerShell. Risultano attivi **tre processi «Docker Desktop»
avviati il 03/10** accanto a quello avviato oggi alle 12:27: la vecchia istanza
non si è chiusa davvero.

1. Chiudi Docker Desktop (*Quit Docker Desktop*).
2. In PowerShell, controlla che non resti nulla:
   `Get-Process "Docker Desktop","com.docker.*" -ErrorAction SilentlyContinue`
3. Se resta qualcosa: `Stop-Process -Name "Docker Desktop" -Force`, poi di nuovo il passo 2.
4. `wsl --shutdown`, poi riapri Docker Desktop.
5. Controlla: `docker ps --format "{{.Names}} {{.Status}}"`. Se non riparte,
   riavvia Windows.

Esito atteso: la tabella dei container, senza `500`.

## 8. Correzione del 2026-10-09

Il passo 4 della prima versione indicava `infra/compose/dev.yml`, che non
esiste, e ometteva `--env-file .env`: era un errore di questo documento. L'errore
`401 UNAUTHORIZED` su `quay.io/minio/mc` è un'altra cosa: l'immagine del servizio
che crea i bucket non è più scaricabile (decisione D22). Non blocca l'ambiente
locale, dove i bucket esistono già nei volumi.
