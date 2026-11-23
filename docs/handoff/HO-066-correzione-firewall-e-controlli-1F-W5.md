# HO-066 — Correzione del firewall e controlli mancanti di HO-062 (Fase 1F, W5)

**Stato:** ✅ **eseguito** il 2026-11-21; seguito in HO-067.

**Scopo:** due cose, entrambe sul server Aruba e senza toccare Docker o l'ingresso.

1. Togliere una regola di `ufw` che rende inefficace il limite sulla porta 22.
2. Eseguire i controlli di HO-062 che la segnalazione non riportava: §8.3 (prova degli aggiornamenti
   e timer), §11.3 (nomi delle chiavi vuote) e §11.4 (copie temporanee cancellate).

**Tempo:** 15 minuti. **Chi esegue:** il manutentore, come `gestore`.

---

## 1. Perché

`ufw` applica la **prima** regola che corrisponde. Nella segnalazione la prima regola della 22 è
`22/tcp (OpenSSH) ALLOW IN Anywhere`, già presente nell'immagine di Aruba prima di HO-062. Viene
prima di `22/tcp LIMIT IN Anywhere`: ogni connessione SSH è accettata da quella e il limite di 6
connessioni in 30 secondi non scatta mai. L'accesso resta solo con chiave, quindi il rischio è
basso, ma la protezione prevista da HO-062 §7.1 non c'è.

## 2. Prerequisiti

- [ ] HO-062 eseguito (segnalazione del 2026-11-21).
- [ ] Chiave `amoris_vps` e password di `gestore` nel gestore di password.
- [ ] Due finestre di PowerShell.

## 3. Regole di sicurezza

> **AVVERTENZA:** Non inviare all'agente password, chiavi private o valori dei file d'ambiente.

> **AVVERTENZA:** Mentre cambi il firewall tieni aperta una **sessione di riserva** già collegata.
> Chiudila solo quando la prova del §4.4 riesce da una finestra nuova. Se perdi l'accesso, usa la
> console web di Aruba come in HO-062 §3.

## 4. Procedura A — Regola della porta 22

1. **[PC]** Apri due sessioni come `gestore`. La prima è la sessione di riserva:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\amoris_vps" gestore@<IPv4>
   ```

2. **[server]** Guarda le regole numerate:

   ```bash
   sudo ufw status numbered
   ```

   **Esito atteso:** in cima ci sono `22/tcp (OpenSSH) ALLOW IN` e, più sotto, `22/tcp LIMIT IN`.

3. **[server]** Togli la regola `OpenSSH`. Il comando la toglie per IPv4 e IPv6 insieme. Alla domanda
   scrivi `y`:

   ```bash
   sudo ufw delete allow OpenSSH
   sudo ufw status verbose
   ```

   **Esito atteso:** `Status: active`, `Default: deny (incoming), allow (outgoing)` e solo queste
   regole, ciascuna anche con `(v6)`: `22/tcp LIMIT IN`, `80/tcp ALLOW IN`, `443/tcp ALLOW IN`,
   `443/udp ALLOW IN`.

4. **[PC]** Da una **nuova** finestra prova l'accesso:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\amoris_vps" gestore@<IPv4> "echo ACCESSO-OK"
   ```

   **Esito atteso:** `ACCESSO-OK`. Solo allora chiudi la sessione di riserva.

## 5. Procedura B — Controlli mancanti di HO-062

1. **[server]** Prova degli aggiornamenti e timer (HO-062 §8.3):

   ```bash
   sudo unattended-upgrade --dry-run 2>&1 | tail -n 3
   systemctl list-timers apt-daily-upgrade.timer --no-pager
   ```

   **Esito atteso:** nessuna riga con `ERROR` o `Traceback`; il timer ha una data in `NEXT`.

2. **[server]** Nomi delle chiavi vuote nei file d'ambiente (HO-062 §11.3). Il comando stampa solo i
   **nomi**, mai i valori:

   ```bash
   sudo grep -oE '^[A-Z0-9_]+=$' /opt/amoris/segreti/production.env /opt/amoris/segreti/staging.env
   ```

   **Esito atteso:** in tutti e due i file `IMAGE_TAG=`, `RESTIC_PASSWORD=` e le tre
   `BACKUP_SFTP_*=`; in `production.env` anche `STAGING_BASIC_AUTH_USER=` e
   `STAGING_BASIC_AUTH_HASH=`; nessun'altra.

3. **[server]** Copie temporanee cancellate (HO-062 §11.4):

   ```bash
   ls /tmp/rilascia.sh /tmp/backup-out.sh /tmp/.env.production.example /tmp/compose.yml /tmp/Caddyfile /tmp/ingresso.env.example /tmp/siti 2>&1 | grep -vc 'No such file'
   ```

   **Esito atteso:** `0`. Se il numero è diverso, esegui il comando `rm -rf` di HO-062 §11.4 e
   ripeti.

## 6. Che cosa fare se qualcosa non va

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| `ufw delete allow OpenSSH` risponde `Could not delete non-existent rule` | regola scritta con un altro nome | `sudo ufw status numbered`, poi `sudo ufw delete <numero>` sulla riga `OpenSSH`, una per IPv4 e una per IPv6, ricontrollando i numeri dopo ogni cancellazione |
| Dopo il §4.3 la nuova finestra non entra | regola della 22 mancante | dalla sessione di riserva: `sudo ufw limit 22/tcp`; segnala l'uscita di `sudo ufw status verbose` |
| Il §5.2 stampa chiavi vuote diverse da quelle attese | una riga di HO-061 §4 non compilata | compilala con `sudo nano` come in HO-062 §11.2 e ripeti; segnala solo i **nomi** |
| Il dry run mostra un errore | pacchetto o configurazione di `apt` | incolla solo la riga d'errore |

## 7. Come segnalare il completamento

```text
HO-066 fatto.
Data: <data>
ufw status verbose: <uscita del §4.3>
Accesso da nuova finestra: ACCESSO-OK
Dry run: <ultime 3 righe>; timer apt-daily-upgrade: prossima esecuzione <data>
Chiavi vuote: <uscita del §5.2>
Copie temporanee rimaste: 0
```

## 8. Esito

Segnalato dall'utente il 2026-11-21: **eseguito**, con due rilievi passati a HO-067.

- `ufw`: solo `22/tcp LIMIT`, `80/tcp`, `443/tcp`, `443/udp`, anche per IPv6; accesso da una nuova
  finestra riuscito. `Default` mostra ora `deny (routed)` invece di `disabled (routed)`: `ufw`
  scrive `disabled` quando l'inoltro del kernel è spento, e Docker lo accende. È atteso.
- Timer `apt-daily-upgrade` con prossima esecuzione. Il dry run risponde
  `Package cloud-init has conffile prompt and needs to be upgraded manually` (HO-067 §6).
- Chiavi vuote: oltre a quelle attese, `POSTGRES_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
  `IP_HASH_SALT`, `CSRF_SECRET` e `SCRUB_SERVICE_TOKEN` in tutti e due i file (HO-067 §4). HO-061
  §4.3 non le nominava ed è stato corretto.
- Copie temporanee: nessuna.
