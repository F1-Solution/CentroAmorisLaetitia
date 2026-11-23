# HO-061 — Azioni sul server nate dalla security review (Fase 1F, W5)

**Stato:** ⏳ **da eseguire nella `1F-W5`**, non ora. Richiede il server (HO-056), la Storage Box
(HO-058) e le chiavi dei backup (HO-059). Il piano della `1F-W5` ordina questi passi insieme agli
altri; questo documento raccoglie ciò che la `1F-W4` lascia da fare sul server.

**Scopo:** applicare sul server le correzioni della security review che il codice da solo non
basta ad attivare: sottoreti, credenziali a privilegi minimi, firewall del backup, pulizia
periodica, procedure degli account. Rapporto completo: `docs/deploy/security-review-1F.md`.

**Stile:** come HO-059: una azione per passo, forma imperativa. Un'AVVERTENZA indica un rischio per
i dati o per la sicurezza.

**Dove si lavora:** sul server, in `bash`, da utente amministrativo con `sudo`. Sul server non c'è
un clone del repository: ogni comando d'ambiente parte dall'ultimo rilascio
(`/opt/amoris/rilasci/<ambiente>/corrente`, vedi `infra/deploy/README.md` §10) e va lanciato con
`sudo`, perché `rilasci/` e `segreti/` non sono leggibili dall'amministratore, che non è nel gruppo
`docker`. `<compose>` indica la seconda riga qui sotto, con `<ambiente>` uguale a `production` o
`staging`; la prima si ripete dopo ogni rilascio:

```bash
R=$(sudo readlink -f /opt/amoris/rilasci/<ambiente>/corrente)
sudo docker compose -f "$R/infra/deploy/compose.yml" --env-file /opt/amoris/segreti/<ambiente>.env --env-file "$R/rilascio.env"
```

Si passa dalla cartella reale dell'hash, come fa lo script: stessi percorsi, quindi nessuna
ricreazione inutile dei contenitori. `rilascio.env` va per ultimo: fissa `IMAGE_TAG` e `AMORIS_ENV`
del rilascio. I file dei segreti sono `/opt/amoris/segreti/production.env` e `staging.env`.

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
- [ ] Docker con il plugin `compose` installato a livello di sistema, utente `deploy`, cartelle e ingresso comune pronti (HO-062).
- [ ] Le procedure dal §5 in poi partono dalla cartella `corrente`, che esiste solo dopo il primo rilascio riuscito di ogni ambiente (§5).
- [ ] Un gestore di password (lo stesso di HO-056).
- [ ] 90 minuti.

## 3. Regole di sicurezza per tutto il documento

> **AVVERTENZA:** Non inviare all'agente password, hash, chiavi o il contenuto dei file
> d'ambiente. Per verificare un file usa solo i comandi di questo documento, che non stampano valori.

> **AVVERTENZA:** Non eseguire `docker compose config` senza `--quiet` e non incollare l'uscita di
> `docker inspect`: mostrano i segreti in chiaro (rischio accettato da DR-387).

## 4. Procedura A — File d'ambiente dei due ambienti

1. Copia `infra/deploy/.env.production.example` in `/opt/amoris/segreti/production.env` e
   `/opt/amoris/segreti/staging.env`, con proprietario `root:deploy` e permessi 640.
2. Scrivi `APP_SUBNET=10.77.84.0/24` nel file di produzione e `APP_SUBNET=10.77.85.0/24` in
   quello di staging. Scrivi anche la rete dei backup (DR-412): `BACKUP_OUT_SUBNET=10.77.86.0/24` e
   `BACKUP_OUT_BRIDGE=amoris-bkp-prod` in produzione, `10.77.87.0/24` e `amoris-bkp-stag` in staging.
3. Genera ogni segreto con il comando scritto sopra la sua riga. Ogni ambiente ha i propri:
   **nessun segreto in comune**. Comprende `POSTGRES_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
   `IP_HASH_SALT`, `CSRF_SECRET`, `SCRUB_SERVICE_TOKEN`, le cinque credenziali a privilegi minimi
   (`DB_OWNER_PASSWORD`, `DB_APP_PASSWORD`, `DB_BACKUP_PASSWORD`, `S3_API_SECRET_KEY`,
   `S3_BACKUP_SECRET_KEY`) e `TOTP_ENCRYPTION_KEY`: ogni riga con «Generare con» sopra.
   Scrivi in ogni file anche `INGRESS_SUBNET`, uguale alla sottorete della rete d'ingresso di quell'ambiente
   (`10.77.88.0/24` in produzione, `10.77.89.0/24` in staging), e i due percorsi del backup (HO-059, obbligatori
   anche in staging): `BACKUP_SSH_KEY_PATH=/etc/amoris/backup-chiavi/ssh_key` e
   `BACKUP_KNOWN_HOSTS_PATH=/etc/amoris/backup-chiavi/known_hosts`.
4. Solo nel file di staging: compila `STAGING_BASIC_AUTH_USER` e `STAGING_BASIC_AUTH_HASH` con il
   comando scritto sopra le due righe; l'hash va tra apici singoli. In produzione restano vuote.
5. Conserva `TOTP_ENCRYPTION_KEY` di produzione nel gestore di password, con gli altri segreti.
   Se si perde, tutti i secondi fattori vanno reimpostati (DR-399).
6. Verifica ciascun ambiente **dopo il suo primo rilascio** (§5): prima non c'è la cartella
   `corrente`. Senza stampare valori:

   ```bash
   <compose> config --quiet && echo OK
   ```

**Esito atteso:** `OK` per entrambi gli ambienti. Prima del primo rilascio i controlli sono quelli dello
script di rilascio, che si ferma in fase `configurazione` se manca `INGRESS_SUBNET` o un percorso del backup
non è assoluto. **Se fallisce:** il messaggio nomina la chiave mancante (per esempio «manca APP_SUBNET»):
compila quella riga e ripeti. Per un rilascio fallito leggi il registro sul server (`infra/deploy/README.md` §10).

## 5. Procedura B — Avvio con ruoli e utenti a privilegi minimi

1. Avvia ogni ambiente con un rilascio con `--migrazioni` (`infra/deploy/README.md` §10), dopo l'ingresso
   comune. Il primo rilascio crea la cartella `corrente`.
2. Controlla che `db-init` e `objects-init` siano usciti con codice 0:

   ```bash
   <compose> ps -a --format '{{.Service}} {{.State}} {{.ExitCode}}'
   ```

3. Avvia lo staging **dopo** la produzione: con due `APP_SUBNET` diverse il secondo `up` non
   deve dare «pool overlaps».

**Esito atteso:** `db-init exited 0`, `objects-init exited 0`, gli altri servizi `running`.
**Se fallisce:** incolla solo la riga di errore di `docker compose up`, non l'ambiente.

## 6. Procedura C — Firewall della rete `backup-out` (R13, N6)

1. Copia lo script in una cartella di root, una sola volta, e usa sempre la copia: la cartella dei rilasci è
   scrivibile da `deploy` e non va eseguita da root.

   ```bash
   R=$(sudo readlink -f /opt/amoris/rilasci/production/corrente)
   sudo install -o root -g root -m 0755 "$R/infra/deploy/firewall/backup-out.sh" /opt/amoris/rilascio/backup-out.sh
   ```

   Rifai la copia dopo ogni rilascio che cambia lo script.

2. Applica le regole da root, **una volta per ambiente** (`infra/deploy/README.md` §8, «Firewall dell'host»):

   ```bash
   sudo sh /opt/amoris/rilascio/backup-out.sh --env production --env-file /opt/amoris/segreti/production.env
   sudo sh /opt/amoris/rilascio/backup-out.sh --env production --env-file /opt/amoris/segreti/production.env --check; echo "uscita=$?"
   sudo sh /opt/amoris/rilascio/backup-out.sh --env staging --env-file /opt/amoris/segreti/staging.env
   sudo sh /opt/amoris/rilascio/backup-out.sh --env staging --env-file /opt/amoris/segreti/staging.env --check; echo "uscita=$?"
   ```

   Ogni applicazione tocca solo la catena del suo ambiente.

3. Rendi le regole persistenti dopo ogni riavvio e rinnovale ogni giorno, perché l'indirizzo della
   Storage Box può cambiare. Per **ciascun** ambiente crea `/etc/systemd/system/amoris-backup-out-<ambiente>.service`
   (sotto, per la produzione; per lo staging cambia nome, descrizione e file d'ambiente):

   ```ini
   [Unit]
   Description=Regole DOCKER-USER della rete backup-out (Amoris)
   After=docker.service
   Requires=docker.service

   [Service]
   Type=oneshot
   ExecStart=/bin/sh /opt/amoris/rilascio/backup-out.sh --env <ambiente> --env-file /opt/amoris/segreti/<ambiente>.env
   ```

   e `/etc/systemd/system/amoris-backup-out-<ambiente>.timer`:

   ```ini
   [Unit]
   Description=Rinnovo giornaliero delle regole di backup-out

   [Timer]
   OnBootSec=2min
   OnUnitActiveSec=1d

   [Install]
   WantedBy=timers.target
   ```

4. Attiva: `sudo systemctl daemon-reload && sudo systemctl enable --now amoris-backup-out-production.timer amoris-backup-out-staging.timer`.
5. Riavvia il server una volta e ripeti i due `--check` del punto 2.

**Esito atteso:** `uscita=0` per entrambi gli ambienti prima e dopo il riavvio; il backup successivo riesce. **Se
fallisce:** con uscita 2 la Storage Box non si risolve e la rete resta chiusa (fallisce chiuso):
controlla `BACKUP_SFTP_HOST` e il DNS dell'host; con uscita 64 manca o è sbagliato `AMORIS_ENV`, `BACKUP_OUT_SUBNET` o `BACKUP_OUT_BRIDGE`, il prefisso della sottorete è fuori da `/16`–`/32`, oppure (in applicazione, non con `--check`) la sottorete o il bridge sono già usati dalla catena dell'altro ambiente.

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
   ExecStart=/usr/bin/docker compose -f /opt/amoris/rilasci/production/corrente/infra/deploy/compose.yml --env-file /opt/amoris/segreti/production.env --env-file /opt/amoris/rilasci/production/corrente/rilascio.env run --rm --no-deps api node bin/auth-purge.js
   ```

   L'unità gira da root, quindi senza `sudo` e con percorsi assoluti, senza `WorkingDirectory`. Passa dal collegamento `corrente`: un contenitore usa e getta non ricrea i servizi, e a ogni rilascio usa l'immagine in uso.

   e `/etc/systemd/system/amoris-auth-purge.timer` con `OnCalendar=*-*-* 03:30:00` e
   `Persistent=true` nella sezione `[Timer]`, `WantedBy=timers.target` in `[Install]`.
2. Attiva: `sudo systemctl daemon-reload && sudo systemctl enable --now amoris-auth-purge.timer`.
3. Prova subito: `sudo systemctl start amoris-auth-purge.service && journalctl -u amoris-auth-purge -n 5`.
4. Ripeti i punti 1–3 per lo staging, con la sua cartella `corrente`, il suo file dei segreti e nomi di unità diversi.

**Esito atteso:** nel journal «Pulizia eseguita: N sessioni e M righe di tentativi cancellate.».
**Se fallisce:** incolla la riga del journal.

## 8. Procedura E — Account e secondo fattore

- **Primo account di produzione (R24):** `account-create` funziona sul server con `--ambiente <production|staging> --conferma`, genera la password temporanea e impone TOTP e cambio al primo accesso; comando completo in `infra/deploy/README.md` §3, «Primo account» (DR-228, DR-398).
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
