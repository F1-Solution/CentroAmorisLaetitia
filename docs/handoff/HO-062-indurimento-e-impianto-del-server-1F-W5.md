# HO-062 — Indurimento e impianto del server (Fase 1F, W5)

**Stato:** ✅ **eseguito** il 2026-11-21 dalla bozza, con le riserve del §14 (correzioni in HO-066).

**Scopo:** rendere il server Aruba pronto per i rilasci. Prevede:
- un utente amministrativo con sola chiave, `root` escluso da SSH, firewall con 22, 80 e 443;
- aggiornamenti di sicurezza con riavvio notturno (DR-437) e Docker dal repository ufficiale con versione fissata;
- l'utente `deploy` con comando forzato, le cartelle di `/opt/amoris`, i file d'ambiente e l'ingresso comune avviato senza nomi.

Questo handoff **non** crea record DNS (HO-063), **non** carica la chiave del rilascio (HO-064) e
**non** avvia la produzione né lo staging (T7, T8).

**Stile:** come HO-056: una azione per passo, forma imperativa, gli stessi termini in tutto il
documento. Un'AVVERTENZA indica un rischio per i dati o per la sicurezza. Un'ATTENZIONE indica un
rischio di servizio. Avvertenze e attenzioni sono sempre **prima** del passo.

**Dove si lavora:** i passi segnati **[PC]** sul computer del manutentore, in PowerShell, nella
cartella del repository. I passi segnati **[server]** sul server, in `bash`. Il §4 fino al passo 4 si fa da
`root`; dal §4.5 in poi dall'utente amministrativo `gestore`, con `sudo`.

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D246 | Sistema operativo | **DR-353**: Ubuntu Server 24.04 LTS |
| D295 | Porte 80 e 443 | **DR-409**: ingresso comune, unico a pubblicare 80 e 443; si avvia prima degli ambienti |
| D297 | Rilasci | **DR-411**: utente `deploy` con comando forzato; `deploy` nel gruppo `docker` equivale a root (rischio accettato) |
| D288, D298 | Sottoreti | **DR-402**, **DR-412**: sottoreti dell'app e dei backup diverse per ambiente |
| D300 | Riavvii | **DR-437**: aggiornamenti di sicurezza automatici, riavvio automatico di notte dopo il backup, verifica del ritorno |
| D302 | Staging | **DR-439**: staging acceso solo per prove e rilasci |
| D304, D305 | Nome dello staging e IPv6 | **DR-440**, **DR-441**: `staging.centroamorislaetitia.it`, solo IPv4 nella W5 (HO-063) |
| — | Disposizione sul server | `infra/deploy/README.md` §3 e §10 |

## 2. Prerequisiti

- [ ] HO-056 chiuso: accesso come `root` con la chiave `amoris_vps`, indirizzo IPv4 annotato.
- [ ] Accesso al pannello `https://my.arubacloud.com` e alla console web del server (rientro, §3).
- [ ] Il repository aggiornato sul PC, al commit indicato dall'agente (`git rev-parse HEAD`).
- [ ] Il gestore di password di HO-056.
- [ ] Due finestre di PowerShell e circa 3 ore.

## 3. Regole di sicurezza per tutto il documento

> **AVVERTENZA:** Non inviare all'agente password, chiavi private o il contenuto dei file
> d'ambiente. Le uscite da segnalare (§13) non contengono segreti.

> **AVVERTENZA:** Mentre cambi SSH o il firewall (§5–§7), tieni **sempre aperta** una seconda
> sessione già collegata, la **sessione di riserva**. Chiudila solo quando la prova del passo
> riesce da una finestra nuova. Se perdi l'accesso, usa la console web di Aruba
> (**BARE METAL & VPS** → **VPS** → `amoris-prod-1` → console) ed entra come `gestore` con la sua
> password (§4.2): la console non passa da SSH.

> **AVVERTENZA:** Non copiare dati del Centro sul server. Nella W5 il server riceve solo dati
> sintetici (DR-410).

## 4. Procedura A — Utente amministrativo `gestore`

1. **[PC]** Entra come `root` (HO-056 §8). Questa è la **sessione di riserva**: non chiuderla fino
   al §6.

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\amoris_vps" root@<IPv4>
   ```

2. **[server]** Crea l'utente. Quando il programma chiede la password, scrivi una password nuova e
   lunga e salvala nel gestore di password come «Server Amoris — gestore». Serve per `sudo` e per la
   console, **non** per SSH.

   ```bash
   adduser --gecos "" gestore
   usermod -aG sudo gestore
   ```

3. **[server]** Dai a `gestore` la stessa chiave pubblica di `root`:

   ```bash
   install -d -m 700 -o gestore -g gestore /home/gestore/.ssh
   install -m 600 -o gestore -g gestore /root/.ssh/authorized_keys /home/gestore/.ssh/authorized_keys
   ```

4. **[server]** Imposta il fuso orario: le finestre notturne del §8 sono in ora italiana.

   ```bash
   timedatectl set-timezone Europe/Rome
   timedatectl | grep "Time zone"
   ```

   **Esito atteso:** `Time zone: Europe/Rome`.

5. **[PC]** In una **seconda** finestra di PowerShell, prova l'accesso come `gestore` e `sudo`:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\amoris_vps" gestore@<IPv4>
   ```

   ```bash
   sudo -v && id
   ```

   **Esito atteso:** dopo la password di `gestore`, `id` mostra il gruppo `sudo`. Da qui in poi
   lavora da questa sessione.

6. **[PC]** Copia sul server i file del repository che servono a questo handoff, dalla cartella del
   repository e dal commit indicato dall'agente:

   ```powershell
   git rev-parse HEAD
   scp -i "$env:USERPROFILE\.ssh\amoris_vps" infra/deploy/rilascio/rilascia.sh infra/deploy/firewall/backup-out.sh infra/deploy/.env.production.example infra/deploy/ingresso/compose.yml infra/deploy/ingresso/Caddyfile infra/deploy/ingresso/ingresso.env.example gestore@<IPv4>:/tmp/
   scp -i "$env:USERPROFILE\.ssh\amoris_vps" -r infra/deploy/ingresso/siti gestore@<IPv4>:/tmp/siti
   Get-FileHash -Algorithm SHA256 infra/deploy/rilascio/rilascia.sh, infra/deploy/firewall/backup-out.sh | Format-Table Hash, Path
   ```

7. **[server]** Confronta le impronte con quelle del passo 6:

   ```bash
   sha256sum /tmp/rilascia.sh /tmp/backup-out.sh
   ```

   **Esito atteso:** le due impronte sono uguali a quelle di `Get-FileHash` (maiuscole e minuscole
   a parte). Se sono diverse, fermati (§11).

## 5. Procedura B — Utente `deploy` e cartelle di `/opt/amoris`

1. **[server]** Crea l'utente del rilascio, senza password:

   ```bash
   sudo adduser --disabled-password --gecos "" deploy
   ```

2. **[server]** Crea le cartelle con proprietari e modi del README §10:

   ```bash
   sudo install -d -m 0755 -o root -g root /opt/amoris /opt/amoris/rilascio /opt/amoris/ingresso
   sudo install -d -m 0750 -o root -g deploy /opt/amoris/segreti
   sudo install -d -m 0700 -o deploy -g deploy /opt/amoris/rilasci
   sudo install -d -m 0755 -o root -g root /etc/ssh/authorized_keys
   sudo install -m 0644 -o root -g root /dev/null /etc/ssh/authorized_keys/deploy
   ```

3. **[server]** Installa i due script che esegue `root` o il comando forzato:

   ```bash
   sudo install -m 0755 -o root -g root /tmp/rilascia.sh /tmp/backup-out.sh /opt/amoris/rilascio/
   ls -l /opt/amoris/rilascio/
   ```

   **Esito atteso:** due file `-rwxr-xr-x root root`.

## 6. Procedura C — SSH: solo chiave, niente `root`

> **ATTENZIONE:** Un errore in questo passo può chiudere fuori anche `gestore`. Tieni aperta la
> sessione di riserva di `root` (§4.1) fino al passo 7.

1. **[server]** Salva una copia della configurazione:

   ```bash
   sudo cp -a /etc/ssh/sshd_config /etc/ssh/sshd_config.bak-ho062
   ```

2. **[server]** Scrivi le regole generali in un file che Ubuntu legge **prima** degli altri (il
   primo valore letto vale, e un file di cloud-init può contenere `PasswordAuthentication yes`):

   ```bash
   sudo tee /etc/ssh/sshd_config.d/00-amoris.conf >/dev/null <<'EOF'
   PermitRootLogin no
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PubkeyAuthentication yes
   AllowUsers gestore deploy
   EOF
   ```

3. **[server]** Aggiungi in fondo a `/etc/ssh/sshd_config` il blocco del rilascio (README §10). Il
   blocco `Match` va in fondo al file principale, non in `sshd_config.d`:

   ```bash
   sudo tee -a /etc/ssh/sshd_config >/dev/null <<'EOF'

   Match User deploy
       AuthorizedKeysFile /etc/ssh/authorized_keys/%u
       ForceCommand /opt/amoris/rilascio/rilascia.sh
       AllowTcpForwarding no
       X11Forwarding no
       PermitTTY no
       ClientAliveInterval 30
       ClientAliveCountMax 4
   EOF
   ```

4. **[server]** Controlla la sintassi e i valori effettivi, senza ricaricare:

   ```bash
   sudo sshd -t && echo SINTASSI-OK
   sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|allowusers) '
   sudo sshd -T -C user=deploy,host=prova,addr=192.0.2.1 | grep -Ei '^(forcecommand|authorizedkeysfile|permittty|allowtcpforwarding) '
   ```

   **Esito atteso:** `SINTASSI-OK`; `permitrootlogin no`, `passwordauthentication no`,
   `kbdinteractiveauthentication no`, `allowusers gestore` e `allowusers deploy`; per `deploy`
   `forcecommand /opt/amoris/rilascio/rilascia.sh`, `authorizedkeysfile /etc/ssh/authorized_keys/%u`,
   `permittty no`, `allowtcpforwarding no`.

5. **[server]** Ricarica SSH. Le sessioni aperte restano collegate:

   ```bash
   sudo systemctl reload ssh
   ```

6. **[PC]** In una **nuova** finestra prova i due accessi:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\amoris_vps" gestore@<IPv4> "echo ACCESSO-OK"
   ssh -i "$env:USERPROFILE\.ssh\amoris_vps" root@<IPv4> "echo NON-DEVE-APPARIRE"
   ```

   **Esito atteso:** la prima riga stampa `ACCESSO-OK`; la seconda risponde
   `Permission denied (publickey)`.

7. Solo se il passo 6 dà l'esito atteso, chiudi la sessione di riserva di `root` con `exit`.

## 7. Procedura D — Firewall

1. **[server]** Imposta le regole di `ufw`. `limit` sulla 22 rifiuta un indirizzo che apre più di 6
   connessioni in 30 secondi:

   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw limit 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 443/udp
   ```

2. **[server]** Attiva il firewall. Alla domanda scrivi `y`:

   ```bash
   sudo ufw enable
   sudo ufw status verbose
   ```

   **Esito atteso:** `Status: active`, `Default: deny (incoming), allow (outgoing)`, le quattro
   regole per IPv4 e per IPv6 (`(v6)`).

3. **[PC]** Da una **nuova** finestra ripeti la prima riga del §6.6. **Esito atteso:**
   `ACCESSO-OK`.

Le porte pubblicate da Docker scavalcano `ufw`: per questo solo l'ingresso pubblica porte, e il
§10.4 controlla dall'esterno che le altre restino chiuse.

## 8. Procedura E — Aggiornamenti di sicurezza e riavvio notturno (DR-437)

1. **[server]** Controlla che `unattended-upgrades` sia installato e acceso:

   ```bash
   sudo apt-get update
   sudo apt-get install -y unattended-upgrades
   sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
   APT::Periodic::Update-Package-Lists "1";
   APT::Periodic::Unattended-Upgrade "1";
   EOF
   ```

2. **[server]** Attiva il riavvio automatico alle 04:30, quando un aggiornamento lo chiede. Il
   backup deve finire prima: la T8 fissa il suo timer in un orario che termina prima delle 04:30
   (proposta dell'agente: 02:00).

   ```bash
   sudo tee /etc/apt/apt.conf.d/52amoris-riavvio >/dev/null <<'EOF'
   Unattended-Upgrade::Automatic-Reboot "true";
   Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
   Unattended-Upgrade::Automatic-Reboot-Time "04:30";
   EOF
   ```

3. **[server]** Verifica:

   ```bash
   apt-config dump | grep -E 'Periodic::(Update-Package-Lists|Unattended-Upgrade)|Automatic-Reboot'
   sudo unattended-upgrade --dry-run 2>&1 | tail -n 3
   systemctl list-timers apt-daily-upgrade.timer --no-pager
   ```

   **Esito atteso:** i due valori `"1"`, `Automatic-Reboot "true"` e `Automatic-Reboot-Time
   "04:30"`; il dry run finisce senza errori; il timer `apt-daily-upgrade` ha una prossima
   esecuzione.

4. **Verifica del ritorno dopo un riavvio.** Questo passo si completa quando l'handoff passa a «da
   eseguire»: l'agente aggiunge un'unità di systemd che, a ogni avvio, controlla servizi,
   regole del firewall e timer e scrive l'esito nel journal (prova nella T9, W5-8). Fino ad allora,
   dopo un riavvio, esegui:

   ```bash
   last -x reboot | head -n 3
   sudo ufw status | head -n 1
   sudo docker ps --format '{{.Names}} {{.Status}}'
   systemctl list-timers 'amoris-*' --no-pager
   ```

   **Esito atteso:** `Status: active`; i contenitori accesi prima del riavvio sono di nuovo `Up`; i
   timer `amoris-*` hanno una prossima esecuzione (esistono solo dopo la T8).

## 9. Procedura F — Docker dal repository ufficiale, con versione fissata

1. **[server]** Aggiungi il repository di Docker (istruzioni ufficiali per Ubuntu,
   `docs.docker.com/engine/install/ubuntu/`):

   ```bash
   sudo apt-get install -y ca-certificates curl
   sudo install -m 0755 -d /etc/apt/keyrings
   sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   sudo chmod a+r /etc/apt/keyrings/docker.asc
   gpg --show-keys /etc/apt/keyrings/docker.asc | grep -A1 '^pub'
   ```

   **Esito atteso:** l'impronta della chiave è `9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88`
   (gli spazi possono mancare). Se è diversa, fermati (§11).

2. **[server]** Registra il repository e leggi le versioni offerte:

   ```bash
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
   sudo apt-get update
   apt-cache madison docker-ce | head -n 5
   ```

3. **[server]** Scegli la versione: la riga **più recente** che comincia con `5:29.` (la serie
   provata in sviluppo, Docker 29). Scrivila in una variabile, per esempio:

   ```bash
   V='<versione copiata dalla colonna centrale, per esempio 5:29.x.y-1~ubuntu.24.04~noble>'
   sudo apt-get install -y docker-ce="$V" docker-ce-cli="$V" containerd.io docker-buildx-plugin docker-compose-plugin
   sudo apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

   `apt-mark hold` impedisce che gli aggiornamenti cambino Docker: un cambio di versione si fa a
   mano, con una prova.

4. **[server]** Metti `deploy` nel gruppo `docker` (DR-411). `gestore` **non** ci va: usa `sudo`.

   ```bash
   sudo usermod -aG docker deploy
   ```

5. **[server]** Verifica:

   ```bash
   sudo docker version --format '{{.Server.Version}}'
   sudo docker compose version
   apt-mark showhold
   systemctl is-enabled docker
   id deploy
   ```

   **Esito atteso:** versione `29.x`; `Docker Compose version v2.…` (plugin di sistema, richiesto
   dal rilascio, README §10 passo 7); i cinque pacchetti in `showhold`; `enabled`; `deploy` nei
   gruppi `deploy` e `docker`.

## 10. Procedura G — Ingresso comune senza nomi

L'ingresso si avvia per primo e crea le reti a cui si agganciano gli ambienti (README §3). Qui parte
**senza nomi**: nessun sito e nessuna richiesta di certificato. Il nome dello staging si attiva in
HO-063, dopo il record DNS.

1. **[server]** Installa i file. Caddy gira senza privilegi: i file devono essere leggibili da tutti.

   ```bash
   sudo install -m 0644 -o root -g root /tmp/compose.yml /tmp/Caddyfile /opt/amoris/ingresso/
   sudo install -d -m 0755 -o root -g root /opt/amoris/ingresso/siti
   sudo install -m 0644 -o root -g root /tmp/siti/* /opt/amoris/ingresso/siti/
   sudo install -m 0644 -o root -g root /tmp/ingresso.env.example /opt/amoris/ingresso/ingresso.env
   ```

2. **[server]** Compila il file d'ambiente dell'ingresso. Non contiene segreti.

   ```bash
   sudo nano /opt/amoris/ingresso/ingresso.env
   ```

   Scrivi solo queste righe e lascia vuote le due dei nomi:

   ```text
   INGRESS_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
   INGRESS_PRODUCTION_SUBNET=10.77.88.0/24
   INGRESS_STAGING_SUBNET=10.77.89.0/24
   ```

3. **[server]** Avvia l'ingresso e controlla le reti:

   ```bash
   sudo docker compose -f /opt/amoris/ingresso/compose.yml --env-file /opt/amoris/ingresso/ingresso.env up -d --wait
   sudo docker network inspect amoris-ingresso-production --format '{{.Name}} {{range .IPAM.Config}}{{.Subnet}}{{end}}'
   sudo docker network inspect amoris-ingresso-staging --format '{{.Name}} {{range .IPAM.Config}}{{.Subnet}}{{end}}'
   ```

   **Esito atteso:** il contenitore è `healthy`; `amoris-ingresso-production 10.77.88.0/24` e
   `amoris-ingresso-staging 10.77.89.0/24`.

4. **[PC]** Dall'esterno controlla le porte. Senza nomi l'ingresso non ascolta ancora su 80 e 443:
   le due porte si provano in HO-063 §8.5.

   ```powershell
   foreach ($p in 22,80,443,2019,2020,3000,5432,9000) { "{0} {1}" -f $p, (Test-NetConnection <IPv4> -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded }
   ```

   **Esito atteso:** `True` per 22; per 80 e 443 `True` o `False`; `False` per tutte le altre.

## 11. Procedura H — File d'ambiente dei due ambienti

1. **[server]** Crea i due file da `.env.production.example`, con proprietario e modo del README §10:

   ```bash
   sudo install -m 0640 -o root -g deploy /tmp/.env.production.example /opt/amoris/segreti/production.env
   sudo install -m 0640 -o root -g deploy /tmp/.env.production.example /opt/amoris/segreti/staging.env
   ```

2. **[server]** Compila ogni file seguendo HO-061 §4, passi 2–5: sottoreti, segreti generati con il
   comando sopra ogni riga (**nessun segreto in comune** tra i due file), password dello staging,
   percorsi del backup. Apri un file alla volta con `sudo nano`. Scrivi anche queste righe:

   | Chiave | `production.env` | `staging.env` |
   |---|---|---|
   | `AMORIS_ENV` | `production` | `staging` |
   | `IMAGE_PREFIX` | `ghcr.io/f1-solution/amoris` | `ghcr.io/f1-solution/amoris` |
   | `CADDY_SITE_ADDRESS` | `www.centroamorislaetitia.it` | `staging.centroamorislaetitia.it` |
   | `SITE_URL` | `https://www.centroamorislaetitia.it` | `https://staging.centroamorislaetitia.it` |

   Il nome della produzione nel suo file non pubblica niente: l'ingresso lo instrada solo dalla W8.
   Lascia vuote `IMAGE_TAG` (la scrive il rilascio), `RESTIC_PASSWORD` e le tre `BACKUP_SFTP_*`
   (HO-059, nella T8).

3. **[server]** Controlla le righe che il rilascio verifica, senza stampare valori:

   ```bash
   sudo grep -cE '^(AMORIS_ENV=production|INGRESS_SUBNET=10\.77\.88\.0/24|APP_SUBNET=10\.77\.84\.0/24|BACKUP_OUT_SUBNET=10\.77\.86\.0/24)$' /opt/amoris/segreti/production.env
   sudo grep -cE '^(AMORIS_ENV=staging|INGRESS_SUBNET=10\.77\.89\.0/24|APP_SUBNET=10\.77\.85\.0/24|BACKUP_OUT_SUBNET=10\.77\.87\.0/24)$' /opt/amoris/segreti/staging.env
   sudo grep -oE '^[A-Z0-9_]+=$' /opt/amoris/segreti/production.env /opt/amoris/segreti/staging.env
   sudo stat -c '%U:%G %a %n' /opt/amoris/segreti/production.env /opt/amoris/segreti/staging.env
   ```

   **Esito atteso:** `4` e `4`. Il terzo comando stampa solo i **nomi** delle chiavi vuote: in
   tutti e due i file `IMAGE_TAG=`, `RESTIC_PASSWORD=` e le tre `BACKUP_SFTP_*=`, in produzione anche
   `STAGING_BASIC_AUTH_USER=` e `STAGING_BASIC_AUTH_HASH=`; nessun'altra. `root:deploy 640` per i due
   file.

4. **[server]** Cancella le copie temporanee:

   ```bash
   rm -rf /tmp/rilascia.sh /tmp/backup-out.sh /tmp/.env.production.example /tmp/compose.yml /tmp/Caddyfile /tmp/ingresso.env.example /tmp/siti
   ```

## 12. Che cosa fare se qualcosa non va

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Le impronte del §4.7 sono diverse | file cambiato nel trasferimento o commit diverso | rifai il §4.6 dal commit giusto; se restano diverse, fermati e segnala le due impronte |
| `sshd -t` dà un errore | riga scritta male | correggi il file indicato; non ricaricare finché non dà `SINTASSI-OK` |
| Dopo il §6.5 `gestore` non entra | regola errata in `00-amoris.conf` | dalla sessione di riserva: `sudo cp -a /etc/ssh/sshd_config.bak-ho062 /etc/ssh/sshd_config && sudo rm /etc/ssh/sshd_config.d/00-amoris.conf && sudo systemctl reload ssh`; segnala il messaggio |
| Accesso perso e sessione di riserva chiusa | — | console web di Aruba (§3), utente `gestore` e la sua password; ripristina come la riga sopra |
| `ufw enable` chiude la sessione | regola della 22 mancante | console web di Aruba: `sudo ufw allow 22/tcp`, poi ricontrolla il §7 |
| L'impronta della chiave di Docker è diversa | file sbagliato o intercettato | `sudo rm /etc/apt/keyrings/docker.asc`, fermati e segnala |
| Nessuna versione `5:29.` in `madison` | serie di Docker cambiata | fermati e segnala le prime cinque righe: l'agente prepara una decisione |
| `up -d --wait` dell'ingresso fallisce | variabile mancante o porta occupata | incolla solo la riga d'errore; `sudo ss -ltnp | grep -E ':(80|443) '` mostra chi tiene la porta |
| Il §10.4 mostra `True` su una porta diversa da 22, 80 e 443, o `False` sulla 22 | servizio in ascolto non previsto | non procedere; segnala la porta e l'uscita di `sudo ss -ltnp` per quella porta |

## 13. Come segnalare il completamento

Scrivi all'agente un messaggio come questo. **Non** aggiungere password, chiavi o valori dei file
d'ambiente.

```text
HO-062 fatto.
Data: <data>
Commit dei file copiati: <hash>; impronte uguali: sì
gestore con sudo: sì; fuso orario: Europe/Rome
sshd -T: <le quattro righe del §6.4>; per deploy: <le quattro righe del §6.4>
root via SSH: Permission denied (publickey)
ufw: active, regole 22 limit, 80, 443, 443/udp
Aggiornamenti: <uscita di apt-config dump del §8.3>
Docker: <versione>, Compose <versione>, pacchetti tenuti: 5
deploy nei gruppi: <uscita di id deploy>
Reti dell'ingresso: <le due righe del §10.3>
Porte dall'esterno: <uscita del §10.4>
File d'ambiente: 4 e 4, root:deploy 640
Differenze fra i nomi di questo documento e il server: <elenco o «nessuna»>
```

## 14. Esito

Segnalato dall'utente il 2026-11-21: **eseguito, con riserve**. Il documento era ancora in bozza:
l'unità del §8.4 non c'era e il commit non era stato indicato dall'agente.

- File copiati da `11a9336`, impronte uguali. Per `infra/deploy/` quel commit è uguale a `f4f8803`.
- `gestore` con `sudo`, fuso `Europe/Rome`. `sshd -T` come atteso: niente `root`, niente password,
  `allowusers gestore` e `deploy`, comando forzato e niente TTY né inoltro per `deploy`. `root` via
  SSH rifiutato.
- Aggiornamenti automatici e riavvio alle 04:30 come DR-437. Dry run e timer del §8.3 non riportati
  (HO-066 §5.1).
- Docker 29.10.0 tenuto con `apt-mark hold` (5 pacchetti). Compose v5.8.0: il §9.5 diceva `v2.…`,
  ma la postazione di sviluppo usa v5.7.0, quindi l'atteso del documento era sbagliato e la
  versione va bene.
- `deploy` nei gruppi `deploy`, `docker` e anche `users`, che `adduser` di Ubuntu 24.04 aggiunge
  da sé; non dà permessi su `/opt/amoris`.
- Reti dell'ingresso `10.77.88.0/24` e `10.77.89.0/24`. Dall'esterno: 22 aperta, 80 e 443 chiuse
  (senza nomi), le altre chiuse. File d'ambiente: `4` e `4`, `root:deploy 640`. Chiavi vuote del
  §11.3 e copie temporanee del §11.4 non riportate (HO-066 §5.2 e §5.3).
- **Firewall:** prima della regola `LIMIT` sulla 22 c'è `22/tcp (OpenSSH) ALLOW IN`, che arriva
  dall'immagine di Aruba. `ufw` applica la prima regola che corrisponde, quindi il limite non scatta
  mai. Si corregge con HO-066 §4.
- **Caddy dell'ingresso:** l'ingresso è avviato con Caddy 2.11.7. DR-420 vieta rilasci sul server
  con quella versione. Oggi non serve nomi e 80 e 443 risultano chiuse dall'esterno, ma va portato a
  2.11.9 prima di HO-063 (**D330**, `1F-W5` §4).
