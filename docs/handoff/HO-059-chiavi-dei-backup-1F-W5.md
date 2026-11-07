# HO-059 — Chiavi dei backup: password del repository e chiave SSH (Fase 1F, W5)

**Stato:** ⏳ **da eseguire nella `1F-W5`**, non ora. Richiede il server (HO-056) e la Storage
Box (HO-058). Nessun dato del Centro sul server prima della chiusura della `1F-W4`.

**Scopo:** creare la password del repository restic e la coppia di chiavi SSH per la Storage
Box, metterle sul server, e custodirne **due copie cifrate** fuori dal server e fuori dai
backup: una al manutentore e una in custodia istituzionale del Centro (DR-380, che integra
DR-298). Senza queste due cose, i backup non si leggono.

**Stile:** come HO-058: una azione per passo, forma imperativa. Un'AVVERTENZA indica un rischio
per i dati o per la sicurezza. Un'ATTENZIONE indica un rischio di perdere l'accesso ai backup.

**Dove si lavora:** i passi segnati **[server]** vanno eseguiti sul server, in `bash`. I passi
segnati **[PC]** vanno eseguiti sul computer del manutentore, in PowerShell.

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D192 | Backup fuori dal server, cifrati prima dell'invio | **DR-298** |
| D224 | Destinazione e strumento | **DR-335**: Hetzner Storage Box, restic via SFTP |
| D268 | Custodia della password e della chiave SSH | **DR-380**: due copie cifrate, una al manutentore e una al Centro; prova di ripristino con la copia del Centro prima della produzione |
| — | Parere MI-06, punti 7b e 12 | la chiave non dipende da una sola persona; recupero provato |

## 2. Prerequisiti

- [ ] HO-058 chiuso: hai nome utente e nome del server della Storage Box (non segreti).
- [ ] Il server esiste, con Docker e la cartella `infra/` del repository (`1F-W5`).
- [ ] Il file d'ambiente di produzione esiste sul server, con permessi 600.
- [ ] Un computer con OpenSSH (`ssh`, `scp`, `ssh-keygen`) e 7-Zip.
- [ ] Un gestore di password (lo stesso di HO-056 e HO-058).
- [ ] Una persona del Centro che custodisce la copia istituzionale, e un supporto per
  consegnargliela (per esempio una chiavetta USB).
- [ ] Un canale **diverso** per consegnare la parola d'ordine della copia del Centro
  (busta chiusa o gestore di password del Centro): mai insieme al supporto.
- [ ] 60 minuti.

## 3. Regole di sicurezza per tutto il documento

> **AVVERTENZA:** Non inviare all'agente password, chiavi private, parole d'ordine o il
> contenuto dei file di chiavi. L'agente non deve riceverli (`deployment-gate`).

> **AVVERTENZA:** Non scrivere password o chiavi in Git, nei log, nei messaggi di commit, nelle
> email o in chat. Non salvarle dentro la cartella del repository.

> **ATTENZIONE:** Se perdi la password del repository, i backup non si leggono più e non c'è
> modo di recuperarli. Per questo servono due copie in mani diverse.

## 4. Procedura A — Crea la password del repository [server]

1. Apri una sessione sul server.
2. Esegui:

   ```bash
   umask 077
   openssl rand -hex 32 > ~/restic-password.txt
   cat ~/restic-password.txt
   ```

3. Nel gestore di password, crea la voce «Backup Amoris — password del repository» e incolla
   il valore.
4. Apri il file d'ambiente di produzione con `sudoedit "<file-ambiente>"`.
5. Scrivi la riga `RESTIC_PASSWORD=` seguita dal valore. Salva.

**Esito atteso:** `grep -c '^RESTIC_PASSWORD=.' "<file-ambiente>"` risponde `1`. Non stampare
il valore.

## 5. Procedura B — Fissa la chiave del server della Storage Box [server]

Questo passo evita di fidarsi di un server falso: la chiave dell'host si fissa **prima** di
collegarsi con la password.

1. Crea la cartella delle chiavi:

   ```bash
   sudo install -d -m 0755 /etc/amoris/backup-chiavi
   ```

2. Leggi la chiave dell'host sulla porta 23:

   ```bash
   cd /etc/amoris/backup-chiavi
   ssh-keyscan -p 23 -t ed25519 "<host-storage-box>" | sudo tee known_hosts >/dev/null
   ```

3. Mostra l'impronta:

   ```bash
   ssh-keygen -lf known_hosts
   ```

4. Apri la documentazione di Hetzner sulle impronte delle chiavi dell'host delle Storage Box.
   Confronta l'impronta SHA256 per `ssh-ed25519`.
5. Se le impronte sono **uguali**, continua. Se sono diverse, **fermati** (§10).

**Esito atteso:** il file `known_hosts` contiene una riga che comincia con
`[<host-storage-box>]:23 ssh-ed25519`. La forma con le parentesi quadre e la porta è
obbligatoria: senza, la verifica dell'host nel contenitore fallisce.

## 6. Procedura C — Crea la chiave SSH e installala sulla Storage Box [server]

1. Crea la coppia di chiavi, **senza** frase d'accesso (il backup parte da solo):

   ```bash
   cd /etc/amoris/backup-chiavi
   sudo ssh-keygen -t ed25519 -N '' -C amoris-backup -f ssh_key
   ```

2. Installa la chiave pubblica sulla Storage Box. Il comando chiede la password
   «Storage Box Amoris — utente principale» del gestore:

   ```bash
   sudo cat ssh_key.pub | ssh -p 23 -o UserKnownHostsFile=/etc/amoris/backup-chiavi/known_hosts -o StrictHostKeyChecking=yes "<utente-storage-box>@<host-storage-box>" install-ssh-key
   ```

3. Dai i permessi giusti. Il contenitore gira con l'utente **10003** e deve leggere i due file:

   ```bash
   sudo chown 10003:10003 ssh_key ssh_key.pub known_hosts
   sudo chmod 0400 ssh_key
   sudo chmod 0444 ssh_key.pub known_hosts
   ```

4. Controlla che la chiave entri senza password:

   ```bash
   sudo ssh -p 23 -i ssh_key -o IdentitiesOnly=yes -o BatchMode=yes -o UserKnownHostsFile=known_hosts -o StrictHostKeyChecking=yes "<utente-storage-box>@<host-storage-box>" ls
   ```

**Esito atteso:** il passo 4 mostra l'elenco della cartella iniziale, senza chiedere
password e senza avvisi sulla chiave dell'host.

## 7. Procedura D — Dì al Compose dove sono i file [server]

1. Apri il file d'ambiente di produzione con `sudoedit "<file-ambiente>"`.
2. Scrivi queste righe, con i tuoi valori:

   ```text
   BACKUP_SFTP_HOST=<host-storage-box>
   BACKUP_SFTP_USER=<utente-storage-box>
   BACKUP_SFTP_PATH=amoris-repo
   BACKUP_SSH_KEY_PATH=/etc/amoris/backup-chiavi/ssh_key
   BACKUP_KNOWN_HOSTS_PATH=/etc/amoris/backup-chiavi/known_hosts
   ```

   `BACKUP_SFTP_PATH` è la cartella del repository, relativa alla cartella iniziale della
   Storage Box. La porta 23 è già il valore predefinito.
3. Controlla i permessi: `ls -l "<file-ambiente>"` deve mostrare `-rw-------`.
4. Crea il repository, dalla radice del repository sul server:

   ```bash
   docker compose -f infra/deploy/compose.yml --env-file "<file-ambiente>" --profile backup run --rm --no-deps backup init
   ```

**Esito atteso:** una riga JSON con `"outcome":"ok"` e `"repository":"created"`. Se il
repository esiste già, `"repository":"present"`.

## 8. Procedura E — Prepara le due copie cifrate

Le copie contengono: la password del repository, la chiave SSH privata e pubblica, il
`known_hosts`. **Mai** una copia si tiene sul server o in un backup.

### E1 — Raccogli i file [server]

```bash
sudo tar -C /etc/amoris/backup-chiavi -cf ~/chiavi-backup.tar ssh_key ssh_key.pub known_hosts
sudo chown "$USER" ~/chiavi-backup.tar
tar -rf ~/chiavi-backup.tar -C ~ restic-password.txt
```

### E2 — Porta il pacchetto sul PC [PC]

1. Apri PowerShell sul PC. Crea una cartella **fuori da qualunque repository**:

   ```powershell
   $cartella = Join-Path $env:USERPROFILE 'amoris-chiavi-backup'
   New-Item -ItemType Directory -Path $cartella
   Set-Location $cartella
   ```

2. Scarica il pacchetto:

   ```powershell
   scp "<utente-server>@<host-server>:chiavi-backup.tar" .
   ```

### E3 — Cancella i file in chiaro dal server [server]

```bash
shred -u ~/chiavi-backup.tar ~/restic-password.txt
```

Non cancellare `/etc/amoris/backup-chiavi`: serve al servizio.

### E4 — Crea la copia del manutentore [PC]

1. Esegui. 7-Zip chiede una parola d'ordine due volte: usa una frase lunga, nuova:

   ```powershell
   $sz = 'C:\Program Files\7-Zip\7z.exe'
   & $sz a -t7z -mhe=on -p copia-manutentore.7z chiavi-backup.tar
   ```

2. Nel gestore di password, crea la voce «Backup Amoris — parola d'ordine della copia del
   manutentore».
3. Controlla l'archivio. 7-Zip chiede la parola d'ordine:

   ```powershell
   & $sz t -p copia-manutentore.7z
   ```

4. Metti `copia-manutentore.7z` su un supporto che resta fuori dal server (per esempio un
   disco cifrato del manutentore).

### E5 — Crea la copia del Centro [PC]

1. Esegui. Usa una parola d'ordine **diversa** da quella del manutentore:

   ```powershell
   & $sz a -t7z -mhe=on -p copia-centro.7z chiavi-backup.tar
   & $sz t -p copia-centro.7z
   Get-FileHash -Algorithm SHA256 copia-centro.7z
   ```

2. Scrivi la parola d'ordine su carta e chiudila in una busta. Non salvarla sul PC.
3. Copia `copia-centro.7z` sul supporto del Centro (chiavetta USB).
4. Annota l'impronta SHA256 mostrata: va nel verbale.

### E6 — Cancella i file in chiaro dal PC [PC]

```powershell
Remove-Item chiavi-backup.tar
Set-Location $env:USERPROFILE
cipher /w:"$cartella"
```

`cipher /w` sovrascrive lo spazio libero della cartella: ci vuole qualche minuto. Lascia sul
PC solo le due copie cifrate, se non le hai già spostate.

**Esito atteso:** sul server non resta alcuna copia in chiaro oltre ai file di
`/etc/amoris/backup-chiavi` e al file d'ambiente. Sul PC non resta alcun file in chiaro.

## 9. Procedura F — Consegna la copia al Centro e prova il ripristino

### F1 — Consegna

1. Consegna a mano il supporto con `copia-centro.7z` alla persona che custodisce la copia
   istituzionale del Centro.
2. Consegna la busta con la parola d'ordine **separatamente**, in un altro momento o a un'altra
   persona del Centro.
3. Compila il verbale di consegna. Non scrivere password, parole d'ordine o chiavi.

```text
Verbale di consegna — copia istituzionale delle chiavi dei backup
Data: <data>
Consegnato da: <ruolo del manutentore>     Ricevuto da: <ruolo del custode del Centro>
Contenuto: password del repository e chiave SSH dei backup, archivio cifrato
Impronta SHA256 dell'archivio: <impronta>
Supporto: <tipo di supporto>      Luogo di custodia: <luogo>
Parola d'ordine: consegnata a parte, in busta chiusa, il <data> a <ruolo>
Copia del manutentore: custodita fuori dal server e fuori dai backup
Prova di ripristino con la copia del Centro: <data e esito>
Firme dei due ruoli: <firme>
```

### F2 — Prova di ripristino con la copia del Centro

La prova si fa **prima** di mettere dati reali sul server. Usa la copia del Centro, non quella
del manutentore.

1. [PC] Chiedi al custode il supporto e la busta. Decifra:

   ```powershell
   $sz = 'C:\Program Files\7-Zip\7z.exe'
   & $sz x -p copia-centro.7z -o"$env:USERPROFILE\prova-centro"
   scp "$env:USERPROFILE\prova-centro\chiavi-backup.tar" "<utente-server>@<host-server>:"
   ```

2. [server] Estrai in una cartella temporanea e dai i permessi:

   ```bash
   mkdir -m 0700 ~/prova-centro && tar -C ~/prova-centro -xf ~/chiavi-backup.tar
   sudo chown 10003:10003 ~/prova-centro/ssh_key ~/prova-centro/known_hosts
   ```

3. [server] Esegui `check` con **quei** file e quella password, dalla radice del repository:

   ```bash
   RESTIC_PASSWORD="$(cat ~/prova-centro/restic-password.txt)" \
   BACKUP_SSH_KEY_PATH="$HOME/prova-centro/ssh_key" \
   BACKUP_KNOWN_HOSTS_PATH="$HOME/prova-centro/known_hosts" \
   docker compose -f infra/deploy/compose.yml --env-file "<file-ambiente>" --profile backup run --rm --no-deps backup check
   ```

4. [server] Cancella tutto:

   ```bash
   sudo shred -u ~/prova-centro/ssh_key ~/prova-centro/ssh_key.pub ~/prova-centro/restic-password.txt ~/chiavi-backup.tar
   sudo rm -rf ~/prova-centro
   ```

5. [PC] Cancella i file in chiaro: `Remove-Item -Recurse "$env:USERPROFILE\prova-centro"`.

**Esito atteso:** `check` risponde con `"outcome":"ok"`. Quando esiste un primo backup vero,
ripeti la prova con `restore` su uno stack vuoto, come in `docs/deploy/backup-verification.md`
§8, ancora con la copia del Centro.

## 10. Che cosa fare se qualcosa non va

| Problema | Azione |
|---|---|
| L'impronta di `known_hosts` non coincide con quella di Hetzner | Fermati. Non installare la chiave. Segnala le due impronte |
| `install-ssh-key` rifiuta la password | Controlla la password nel gestore. Controlla che «SSH support» sia attivo (HO-058). Segnala il messaggio |
| `ssh` chiede ancora la password al passo 4 della §6 | La chiave non è installata. Ripeti il passo 2. Segnala il messaggio |
| `init` risponde con codice 78 | Manca una variabile, o un file non è leggibile dall'utente 10003. Controlla i permessi della §6 |
| `init` risponde con codice 12 | La password del repository non è quella del repository. Fermati. Segnala |
| `init` risponde con altri codici | Segnala la riga JSON intera (non contiene segreti) |
| La parola d'ordine di una copia non apre l'archivio | Fermati. Rifai la copia dal §8, se i file in chiaro esistono ancora; altrimenti riparti dalla §4 con una password nuova **prima di scrivere backup** |
| Hai perso una delle due copie | Crea subito una copia nuova dalla copia rimasta e consegnala; segnala la perdita |

## 11. Rotazione

Ripeti la procedura ogni volta che: una persona con accesso alle copie lascia l'incarico, una
copia si perde o si sospetta compromessa, o si cambia server.

**Rotazione della chiave SSH.**

1. [server] Crea una chiave nuova con un altro nome (`ssh_key_nuova`) e installala come nella §6.
2. Sostituisci i file in `/etc/amoris/backup-chiavi`, con gli stessi permessi (proprietario
   10003, chiave `0400`).
3. Esegui `check` (§7, passo 4). Se risponde `ok`, continua.
4. Togli la chiave vecchia da `.ssh/authorized_keys` sulla Storage Box. Controlla che `check`
   risponda ancora `ok`.
5. Rifai le copie (§8), il verbale e la prova (§9). Distruggi le copie vecchie: le consegnate al
   Centro si restituiscono e si cancellano.

**Rotazione della password del repository.** Non è coperta da questo handoff: cambiare la
password di un repository restic ha una procedura propria (aggiungere la nuova, provarla,
togliere la vecchia). Non è stata provata nella `1F-W3`. Prima di farlo con dati reali,
l'agente prepara un handoff dedicato e lo si prova su un repository di prova.

## 12. Come segnalare il completamento

Scrivi all'agente un messaggio come questo. **Non** aggiungere password, parole d'ordine,
chiavi o impronte di chiavi private.

```text
HO-059 fatto.
Data: <data>
Impronta dell'host confrontata con quella di Hetzner: sì
Chiave SSH installata e provata senza password: sì
init del repository: <created o present>
Copia del manutentore: creata, controllata, custodita fuori dal server
Copia del Centro: consegnata il <data>, verbale firmato; parola d'ordine consegnata a parte
Prova di ripristino con la copia del Centro (check): <ok o errore>, il <data>
File in chiaro cancellati da server e PC: sì
Differenze fra i nomi di questo documento e l'interfaccia: <elenco o «nessuna»>
```

## 13. Esito

Da compilare dopo la segnalazione.
