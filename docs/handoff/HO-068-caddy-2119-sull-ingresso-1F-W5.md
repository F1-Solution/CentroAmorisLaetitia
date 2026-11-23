# HO-068 — Caddy 2.11.9 sull'ingresso del server (Fase 1F, W5)

**Stato:** 📝 **bozza** — diventa «da eseguire» dopo il commit e la CI verde dell'aggiornamento a
Caddy 2.11.9. In quel momento l'agente scrive qui il commit da cui copiare il file (§4.1).

**Scopo:** ricreare l'ingresso comune avviato in HO-062 con l'immagine di Caddy 2.11.9 (DR-444,
DR-446). Va fatto **prima** di HO-063, che attiva il primo nome. L'ingresso resta senza nomi.

**Tempo:** 15 minuti. **Chi esegue:** il manutentore, come `gestore`.

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D312 | Rilasci con Caddy 2.11.7 | **DR-420**: nessun rilascio sul server con il 2.11.7 |
| D330 | Ingresso già avviato con il 2.11.7 | **DR-444**: resta acceso senza nomi, 2.11.9 prima di HO-063 |
| D332 | Alti residui nel 2.11.9 | **DR-446**: accettati per la Fase 1 |

## 2. Prerequisiti

- [ ] Commit dell'aggiornamento con CI verde: `<hash>` (lo scrive l'agente).
- [ ] Repository aggiornato sul PC a quel commit (`git pull`, poi `git rev-parse HEAD`).
- [ ] HO-062 e HO-066 eseguiti.

## 3. Regole di sicurezza

> **AVVERTENZA:** Non inviare all'agente password o chiavi private.

> **ATTENZIONE:** Ricreare l'ingresso interrompe per pochi secondi le connessioni su 80 e 443. Oggi
> non serve nessun sito, quindi nessun visitatore se ne accorge.

## 4. Procedura A — Nuovo file dell'ingresso

1. **[PC]** Copia il file e calcola l'impronta, dalla cartella del repository:

   ```powershell
   git rev-parse HEAD
   scp -i "$env:USERPROFILE\.ssh\amoris_vps" infra/deploy/ingresso/compose.yml gestore@<IPv4>:/tmp/compose.yml
   (Get-FileHash -Algorithm SHA256 infra/deploy/ingresso/compose.yml).Hash
   ```

2. **[server]** Confronta l'impronta e controlla l'immagine scritta nel file:

   ```bash
   sha256sum /tmp/compose.yml
   grep -c 'caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0' /tmp/compose.yml
   ```

   **Esito atteso:** impronta uguale a quella del passo 1 (maiuscole a parte); il `grep` stampa `1`.
   Se no, fermati (§6).

3. **[server]** Installa il file al posto del vecchio, tenendo una copia:

   ```bash
   sudo cp -a /opt/amoris/ingresso/compose.yml /opt/amoris/ingresso/compose.yml.bak-2117
   sudo install -m 0644 -o root -g root /tmp/compose.yml /opt/amoris/ingresso/compose.yml
   rm /tmp/compose.yml
   ```

## 5. Procedura B — Ricreare l'ingresso

1. **[server]** Scarica la nuova immagine e ricrea il contenitore:

   ```bash
   sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env pull
   sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env up -d --wait --force-recreate
   ```

2. **[server]** Controlla immagine, stato e reti:

   ```bash
   sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env ps --format '{{.Image}} {{.Status}}'
   sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env exec -T ingresso caddy version
   sudo docker network inspect amoris-ingresso-production --format '{{.Name}} {{range .IPAM.Config}}{{.Subnet}}{{end}}'
   sudo docker network inspect amoris-ingresso-staging --format '{{.Name}} {{range .IPAM.Config}}{{.Subnet}}{{end}}'
   ```

   **Esito atteso:** l'immagine contiene `caddy:2.11.9-alpine` e lo stato è `Up … (healthy)`;
   `caddy version` comincia con `v2.11.9`; le due reti con `10.77.88.0/24` e `10.77.89.0/24`, come
   prima.

3. **[server]** Togli l'immagine vecchia, ora non più usata da nessun contenitore:

   ```bash
   sudo docker image rm caddy:2.11.7-alpine@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5
   ```

   **Esito atteso:** righe `Untagged` e `Deleted`. Se risponde `image is being used`, non forzare e
   segnala.

4. **[PC]** Ricontrolla le porte dall'esterno, come in HO-062 §10.4:

   ```powershell
   foreach ($p in 22,80,443,2019,2020,3000,5432,9000) { "{0} {1}" -f $p, (Test-NetConnection <IPv4> -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded }
   ```

   **Esito atteso:** `True` per 22, `False` per tutte le altre.

## 6. Che cosa fare se qualcosa non va

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Impronta diversa o `grep` a `0` | file di un altro commit | rifai il §4.1 dal commit indicato |
| `pull` fallisce | rete del server o Docker Hub | ripeti dopo qualche minuto; incolla solo la riga d'errore |
| `up --wait` fallisce o lo stato non è `healthy` | file o variabile errati | rientro: `sudo cp -a /opt/amoris/ingresso/compose.yml.bak-2117 /opt/amoris/ingresso/compose.yml`, poi lo stesso `up -d --wait --force-recreate`; segnala la riga d'errore di `sudo docker compose … logs --tail 20` |
| Le reti hanno sottoreti diverse | `ingresso.env` cambiato | non procedere; segnala le due righe |
| Il §5.4 mostra `True` su una porta diversa da 22 | servizio in ascolto non previsto | non procedere; segnala la porta e `sudo ss -ltnp` per quella porta |

## 7. Come segnalare il completamento

```text
HO-068 fatto.
Data: <data>
Commit del file: <hash>; impronte uguali: sì; grep: 1
ps: <uscita del §5.2, prima riga>
caddy version: <uscita>
Reti dell'ingresso: <le due righe del §5.2>
Immagine 2.11.7 rimossa: sì
Porte dall'esterno: <uscita del §5.4>
```

## 8. Esito

Da compilare dopo la segnalazione.
