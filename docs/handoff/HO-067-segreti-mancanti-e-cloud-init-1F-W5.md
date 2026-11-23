# HO-067 — Segreti mancanti nei file d'ambiente e aggiornamento di `cloud-init` (Fase 1F, W5)

**Stato:** ⏳ **da eseguire** — nato dalla segnalazione di HO-066 del 2026-11-21. Serve prima della
T7 (primo rilascio sullo staging).

**Scopo:** due correzioni sul server Aruba, senza toccare Docker o l'ingresso.

1. Compilare sei segreti rimasti vuoti in tutti e due i file d'ambiente.
2. Aggiornare a mano `cloud-init`, che gli aggiornamenti automatici saltano.

**Tempo:** 20 minuti. **Chi esegue:** il manutentore, come `gestore`.

---

## 1. Perché

**Segreti.** HO-066 §5.2 ha stampato, in tutti e due i file, queste chiavi vuote oltre a quelle
attese: `POSTGRES_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `IP_HASH_SALT`, `CSRF_SECRET`,
`SCRUB_SERVICE_TOKEN`. HO-061 §4.3 nominava solo le cinque credenziali a privilegi minimi e
`TOTP_ENCRYPTION_KEY`, e questo ha fatto credere che bastassero quelle: la colpa è del documento.
Senza questi sei valori il primo rilascio si fermerebbe.

**`cloud-init`.** Il dry run degli aggiornamenti ha risposto `Package cloud-init has conffile prompt
and needs to be upgraded manually`. Un file di configurazione di `cloud-init` è stato modificato
dall'immagine di Aruba, quindi l'aggiornamento automatico non sa quale versione tenere e salta il
pacchetto. Si aggiorna a mano tenendo la configurazione attuale, la stessa con cui il server è
partito.

## 2. Prerequisiti

- [ ] HO-062 e HO-066 eseguiti.
- [ ] Password di `gestore` e gestore di password aperto.

## 3. Regole di sicurezza

> **AVVERTENZA:** Non inviare all'agente i valori dei segreti, né l'uscita di un comando che li
> stampa. I comandi di controllo di questo documento stampano solo **nomi** e **conteggi**.

> **AVVERTENZA:** **Nessun segreto in comune** fra `production.env` e `staging.env`: genera ogni
> valore a parte, anche se il comando è lo stesso.

## 4. Procedura A — I sei segreti

Per ognuno dei due file, uno alla volta:

1. **[server]** Apri il file:

   ```bash
   sudo nano /opt/amoris/segreti/staging.env
   ```

2. **[server]** Per ciascuna delle sei chiavi, in una **seconda** sessione genera il valore con il
   comando scritto nel commento sopra la riga, copialo e incollalo dopo il `=`, senza spazi né
   apici:

   | Chiave | Comando |
   |---|---|
   | `POSTGRES_PASSWORD` | `openssl rand -hex 32` |
   | `S3_ACCESS_KEY` | `openssl rand -hex 16` |
   | `S3_SECRET_KEY` | `openssl rand -hex 32` |
   | `IP_HASH_SALT` | `openssl rand -hex 32` |
   | `CSRF_SECRET` | `openssl rand -hex 32` |
   | `SCRUB_SERVICE_TOKEN` | `openssl rand -hex 32` |

3. Salva (Ctrl+O, Invio) ed esci (Ctrl+X).
4. Ripeti i passi 1–3 con `/opt/amoris/segreti/production.env`, con valori **nuovi**.
5. Salva i sei valori di produzione nel gestore di password, con gli altri segreti del server.

## 5. Procedura B — Controlli senza stampare valori

1. **[server]** Chiavi ancora vuote:

   ```bash
   sudo grep -oE '^[A-Z0-9_]+=$' /opt/amoris/segreti/production.env /opt/amoris/segreti/staging.env
   ```

   **Esito atteso:** in tutti e due i file solo `IMAGE_TAG=`, `RESTIC_PASSWORD=` e le tre
   `BACKUP_SFTP_*=`; in `production.env` anche `STAGING_BASIC_AUTH_USER=` e
   `STAGING_BASIC_AUTH_HASH=`.

2. **[server]** Nessun valore in comune fra i due file. Il comando stampa solo un numero:

   ```bash
   sudo bash -c "comm -12 <(grep -E '^(POSTGRES_PASSWORD|S3_ACCESS_KEY|S3_SECRET_KEY|IP_HASH_SALT|CSRF_SECRET|SCRUB_SERVICE_TOKEN|DB_OWNER_PASSWORD|DB_APP_PASSWORD|DB_BACKUP_PASSWORD|S3_API_SECRET_KEY|S3_BACKUP_SECRET_KEY|TOTP_ENCRYPTION_KEY)=.+' /opt/amoris/segreti/production.env | cut -d= -f2- | sort) <(grep -E '^(POSTGRES_PASSWORD|S3_ACCESS_KEY|S3_SECRET_KEY|IP_HASH_SALT|CSRF_SECRET|SCRUB_SERVICE_TOKEN|DB_OWNER_PASSWORD|DB_APP_PASSWORD|DB_BACKUP_PASSWORD|S3_API_SECRET_KEY|S3_BACKUP_SECRET_KEY|TOTP_ENCRYPTION_KEY)=.+' /opt/amoris/segreti/staging.env | cut -d= -f2- | sort) | wc -l"
   ```

   **Esito atteso:** `0`.

3. **[server]** Proprietario e modo invariati:

   ```bash
   sudo stat -c '%U:%G %a %n' /opt/amoris/segreti/production.env /opt/amoris/segreti/staging.env
   ```

   **Esito atteso:** `root:deploy 640` per tutti e due.

## 6. Procedura C — `cloud-init`

1. **[server]** Aggiorna il pacchetto tenendo la configurazione attuale (`--force-confold`):

   ```bash
   sudo apt-get update
   sudo apt-get install --only-upgrade -y -o Dpkg::Options::=--force-confold cloud-init
   ```

2. **[server]** Ripeti il dry run degli aggiornamenti:

   ```bash
   sudo unattended-upgrade --dry-run 2>&1 | grep -ciE 'conffile prompt|error|traceback'
   ```

   **Esito atteso:** `0`.

3. **[server]** Controlla che SSH sia rimasto come in HO-062 §6.4:

   ```bash
   sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication) '
   ```

   **Esito atteso:** `permitrootlogin no`, `passwordauthentication no`,
   `kbdinteractiveauthentication no`.

## 7. Che cosa fare se qualcosa non va

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Il §5.1 stampa ancora una delle sei chiavi | valore non salvato o spazio prima del `=` | riapri il file e ricontrolla quella riga |
| Il §5.2 stampa un numero diverso da `0` | stesso valore incollato in tutti e due i file | rigenera in **un** file le chiavi copiate (non dire all'agente quali valori) e ripeti |
| Il §6.1 si ferma con una domanda su un file di configurazione | opzione non letta | rispondi `N` (tieni la versione installata) |
| Il §6.3 mostra `yes` su una delle tre righe | `cloud-init` ha riscritto la configurazione di SSH | non chiudere la sessione; segnala le righe: l'agente prepara la correzione |

## 8. Come segnalare il completamento

```text
HO-067 fatto.
Data: <data>
Chiavi vuote: <uscita del §5.1>
Valori in comune: 0
File d'ambiente: root:deploy 640
cloud-init aggiornato; dry run: 0
sshd -T: <le tre righe del §6.3>
```

## 9. Esito

Da compilare dopo la segnalazione.
