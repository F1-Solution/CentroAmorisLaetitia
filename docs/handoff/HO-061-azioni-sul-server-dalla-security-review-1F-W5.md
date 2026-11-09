# HO-061 — Azioni sul server nate dalla security review (Fase 1F, W5)

**Stato:** ⏳ **da eseguire nella `1F-W5`**, non ora. Richiede il server (HO-056), la Storage Box
(HO-058) e le chiavi dei backup (HO-059). Il piano della `1F-W5` ordina questi passi insieme agli
altri; questo documento raccoglie ciò che la `1F-W4` lascia da fare sul server.

**Scopo:** applicare sul server le correzioni della security review che il codice da solo non
basta ad attivare: sottoreti, credenziali a privilegi minimi, firewall del backup, pulizia
periodica, procedure degli account. Rapporto completo: `docs/deploy/security-review-1F.md`.

**Stile:** come HO-059: una azione per passo, forma imperativa. Un'AVVERTENZA indica un rischio per
i dati o per la sicurezza.

**Dove si lavora:** sul server, in `bash`, da utente con `sudo`, nella cartella del repository
(qui `<repo>`). `<file>` è il file d'ambiente dell'ambiente su cui si lavora (produzione o
staging), con permessi 600, fuori dal repository.

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D288 | Sottoreti dei due ambienti | **DR-402**: `APP_SUBNET` obbligatoria e diversa per ambiente |
| D277 | Log | **DR-390**: niente IP in chiaro né query; rotazione 10 MB × 5 nel Compose |
| D279 | Perimetro delle correzioni | **DR-392**: R12, R14, R20, R21, R24 alla `1F-W5` |
| D289 | Bassi del riesame | **DR-403**: firewall all'avvio e rinnovo (N6), timer della pulizia (R25) alla `1F-W5` |
| D283, D284, D285 | Secondo fattore | **DR-397**, **DR-398**, **DR-399**: reimpostazione solo da CLI, password temporanea su canale sicuro, nessuna rotazione della chiave |
| D226 | Accesso allo staging | **DR-375**: password davanti a tutto lo staging |
| D291 | Avvisi residui delle immagini | **DR-405**: accettati in Fase 1; nuova scansione Trivy al primo rilascio |

## 2. Prerequisiti

- [ ] HO-056, HO-058 e HO-059 chiusi.
- [ ] Docker e la cartella `infra/` del repository sul server.
- [ ] Un gestore di password (lo stesso di HO-056).
- [ ] 90 minuti.

## 3. Regole di sicurezza per tutto il documento

> **AVVERTENZA:** Non inviare all'agente password, hash, chiavi o il contenuto dei file
> d'ambiente. Per verificare un file usa solo i comandi di questo documento, che non stampano valori.

> **AVVERTENZA:** Non eseguire `docker compose config` senza `--quiet` e non incollare l'uscita di
> `docker inspect`: mostrano i segreti in chiaro (rischio accettato da DR-387).

## 4. Procedura A — File d'ambiente dei due ambienti

1. Copia `infra/deploy/.env.production.example` in due file fuori dal repository, uno per
   ambiente, con permessi 600.
2. Scrivi `APP_SUBNET=10.77.84.0/24` nel file di produzione e `APP_SUBNET=10.77.85.0/24` in
   quello di staging.
3. Genera ogni segreto con il comando scritto sopra la sua riga. Ogni ambiente ha i propri:
   **nessun segreto in comune**. Comprende le cinque credenziali a privilegi minimi
   (`DB_OWNER_PASSWORD`, `DB_APP_PASSWORD`, `DB_BACKUP_PASSWORD`, `S3_API_SECRET_KEY`,
   `S3_BACKUP_SECRET_KEY`) e `TOTP_ENCRYPTION_KEY`.
4. Solo nel file di staging: compila `STAGING_BASIC_AUTH_USER` e `STAGING_BASIC_AUTH_HASH` con il
   comando scritto sopra le due righe; l'hash va tra apici singoli. In produzione restano vuote.
5. Conserva `TOTP_ENCRYPTION_KEY` di produzione nel gestore di password, con gli altri segreti.
   Se si perde, tutti i secondi fattori vanno reimpostati (DR-399).
6. Verifica ciascun file, senza stampare valori:

   ```bash
   docker compose -f infra/deploy/compose.yml --env-file <file> config --quiet && echo OK
   ```

**Esito atteso:** `OK` per entrambi i file. **Se fallisce:** il messaggio nomina la chiave
mancante (per esempio «manca APP_SUBNET»): compila quella riga e ripeti.

## 5. Procedura B — Avvio con ruoli e utenti a privilegi minimi

1. Avvia ogni ambiente con i tre comandi di `infra/deploy/README.md` §3.
2. Controlla che `db-init` e `objects-init` siano usciti con codice 0:

   ```bash
   docker compose -f infra/deploy/compose.yml --env-file <file> ps -a --format '{{.Service}} {{.State}} {{.ExitCode}}'
   ```

3. Avvia lo staging **dopo** la produzione: con due `APP_SUBNET` diverse il secondo `up` non
   deve dare «pool overlaps».

**Esito atteso:** `db-init exited 0`, `objects-init exited 0`, gli altri servizi `running`.
**Se fallisce:** incolla solo la riga di errore di `docker compose up`, non l'ambiente.

## 6. Procedura C — Firewall della rete `backup-out` (R13, N6)

1. Applica le regole da root (`infra/deploy/README.md` §8, «Firewall dell'host»):

   ```bash
   sudo sh infra/deploy/firewall/backup-out.sh --env-file <file di produzione>
   sudo sh infra/deploy/firewall/backup-out.sh --env-file <file di produzione> --check; echo "uscita=$?"
   ```

2. Rendi le regole persistenti dopo ogni riavvio e rinnovale ogni giorno, perché l'indirizzo della
   Storage Box può cambiare. Crea `/etc/systemd/system/amoris-backup-out.service`:

   ```ini
   [Unit]
   Description=Regole DOCKER-USER della rete backup-out (Amoris)
   After=docker.service
   Requires=docker.service

   [Service]
   Type=oneshot
   ExecStart=/bin/sh <repo>/infra/deploy/firewall/backup-out.sh --env-file <file di produzione>
   ```

   e `/etc/systemd/system/amoris-backup-out.timer`:

   ```ini
   [Unit]
   Description=Rinnovo giornaliero delle regole di backup-out

   [Timer]
   OnBootSec=2min
   OnUnitActiveSec=1d

   [Install]
   WantedBy=timers.target
   ```

3. Attiva: `sudo systemctl daemon-reload && sudo systemctl enable --now amoris-backup-out.timer`.
4. Riavvia il server una volta e ripeti il `--check` del punto 1.

**Esito atteso:** `uscita=0` prima e dopo il riavvio; il backup successivo riesce. **Se
fallisce:** con uscita 2 la Storage Box non si risolve e la rete resta chiusa (fallisce chiuso):
controlla `BACKUP_SFTP_HOST` e il DNS dell'host.

> **AVVERTENZA:** Il DNS verso i resolver dell'host resta un canale lento d'uscita (N6). Se il
> piano della `1F-W5` sceglie indirizzi fissi per la Storage Box, il DNS si può togliere.

## 7. Procedura D — Pulizia giornaliera di sessioni e tentativi (R25, N4)

1. Crea `/etc/systemd/system/amoris-auth-purge.service`:

   ```ini
   [Unit]
   Description=Pulizia di sessioni e tentativi oltre 30 giorni (Amoris)
   After=docker.service
   Requires=docker.service

   [Service]
   Type=oneshot
   WorkingDirectory=<repo>
   ExecStart=/usr/bin/docker compose -f infra/deploy/compose.yml --env-file <file di produzione> run --rm --no-deps api node bin/auth-purge.js
   ```

   e `/etc/systemd/system/amoris-auth-purge.timer` con `OnCalendar=*-*-* 03:30:00` e
   `Persistent=true` nella sezione `[Timer]`, `WantedBy=timers.target` in `[Install]`.
2. Attiva: `sudo systemctl daemon-reload && sudo systemctl enable --now amoris-auth-purge.timer`.
3. Prova subito: `sudo systemctl start amoris-auth-purge.service && journalctl -u amoris-auth-purge -n 5`.
4. Ripeti i punti 1–3 per lo staging, con il suo file e nomi di unità diversi.

**Esito atteso:** nel journal «Pulizia eseguita: N sessioni e M righe di tentativi cancellate.».
**Se fallisce:** incolla la riga del journal.

## 8. Procedura E — Account e secondo fattore

- **Primo account di produzione (R24):** lo strumento `account-create` rifiuta oggi un database
  che non sia sulla stessa macchina, quindi sul server **non** funziona. La procedura si scrive e
  si prova nella `1F-W5`; deve consegnare la password temporanea su un canale sicuro, imporre il
  cambio al primo accesso e l'attivazione del TOTP (DR-228, DR-398).
- **Account bloccato** e **secondo fattore perso:** comandi in `infra/deploy/README.md` §3.
  Verifica l'identità della persona prima di reimpostare il secondo fattore (DR-397).

## 9. Procedura F — Scansione delle immagini al primo rilascio (DR-405)

Prima del primo rilascio in produzione, l'agente ricostruisce le immagini sulle basi più recenti
per digest (Node, Chainguard per `mc`, `restic` se esce una release correttiva) e le scansiona con
Trivy, riportando solo i conteggi. Il manutentore non deve eseguire nulla: approva il rilascio
solo con il nuovo esito in mano.

**Esito atteso:** nessun critico o alto con correzione disponibile non applicata, oppure una nuova
decisione registrata.

## 10. Da decidere nella `1F-W5` (non sono comandi)

| Voce | Rilievo | Che cosa serve |
|---|---|---|
| Storage Box: chi può cancellare le istantanee; istantanee del fornitore entro 35 giorni | R12, R14 | configurazione verificata del sotto-account e delle istantanee, insieme a HO-058/HO-059 |
| HSTS più lungo | R20 | durata da scegliere dopo la verifica di HTTPS |
| CSP applicata | R21, DR-364 | raccolta delle segnalazioni, poi decisione su nonce o hash |
| Separazione dello staging | MI-06 domanda 12 | stesso demone e stesso kernel: limiti di CPU e memoria da dichiarare al Centro |

## 11. Come segnalare il completamento

Nel prompt successivo scrivi `HO-061: fatto` con, per ciascuna procedura, l'esito atteso
(`OK`, `uscita=0`, la riga del journal) o il messaggio d'errore. Non incollare valori dei file
d'ambiente.
