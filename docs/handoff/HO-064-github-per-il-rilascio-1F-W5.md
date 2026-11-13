# HO-064 — GitHub per il rilascio: chiave, `known_hosts` e impostazioni di Actions (Fase 1F, W5)

**Stato:** 📝 **bozza**, da eseguire nella `1F-W5` T6 dopo HO-062. Non eseguire prima che il
documento passi a «da eseguire».

**Scopo:** dare al workflow «Rilascio» (`.github/workflows/rilascio.yml`) ciò che gli serve per
raggiungere il server, e indurire le impostazioni di GitHub Actions del repository
`F1-Solution/CentroAmorisLaetitia`. Al termine, il rilascio può partire ma **non si avvia**: il
primo rilascio è la T7, con una conferma propria.

**Stile:** come HO-059: una azione per passo, forma imperativa. Un'AVVERTENZA indica un rischio per
la sicurezza.

**Dove si lavora:** i passi segnati **[PC]** sul computer del manutentore, in PowerShell, con la
CLI `gh` già autenticata come amministratore del repository. I passi segnati **[server]** sul
server, in `bash`, dall'utente amministrativo creato in HO-062.

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D297 | Rilasci senza approvazione dell'ambiente (piano Free) | **DR-411**: avvio a mano solo da `main`, comando forzato sul server, `GITHUB_TOKEN` del lavoro per GHCR; l'approvazione è la conferma dell'utente prima di ogni avvio |
| D295 | Porte 80 e 443 | **DR-409**: ingresso comune; il rilascio controlla la rete `amoris-ingresso-<ambiente>` |
| D305 | IPv6 | **DR-441**: solo IPv4 nella W5, quindi `RILASCIO_HOST` e `RILASCIO_KNOWN_HOSTS` usano l'indirizzo IPv4, non un nome DNS |
| D300 | Riavvii notturni | **DR-437**: il server può riavviarsi alle 04:30; non avviare un rilascio in quella finestra |
| — | Disposizione sul server | `infra/deploy/README.md` §10 (utente `deploy`, `/etc/ssh/authorized_keys/deploy`, `ForceCommand`), impiantata da HO-062 §5 e §6 |

## 2. Fatti letti dall'agente il 2026-11-13 (sola lettura, `gh api`)

| Impostazione | Valore di oggi | Valore atteso a fine handoff |
|---|---|---|
| Actions abilitate, azioni ammesse | `enabled: true`, `allowed_actions: all` | invariato |
| Azioni fissate per SHA obbligatorie | `sha_pinning_required: false` | **`true`** (§7) |
| Permessi predefiniti del `GITHUB_TOKEN` | `read`, nessuna approvazione di PR (repository e organizzazione) | invariato, solo verificato (§7) |
| Segreti e variabili del repository | nessuno | `RILASCIO_SSH_KEY` (segreto), `RILASCIO_HOST` e `RILASCIO_KNOWN_HOSTS` (variabili) |

I due workflow usano già solo azioni fissate per SHA (`actions/checkout`, `actions/setup-node`,
`actions/upload-artifact`, `pnpm/action-setup`) e dichiarano i propri permessi (`ci.yml`:
`packages: write` solo nel lavoro delle immagini; `rilascio.yml`: `contents: read`,
`packages: read`). Il §7 quindi non rompe la CI.

## 3. Prerequisiti

- [ ] HO-062 chiuso: utente `deploy` creato (§5), blocco `Match User deploy` in `sshd_config` (§6),
  file `/etc/ssh/authorized_keys/deploy` presente e vuoto, `rilascia.sh` in `/opt/amoris/rilascio/`.
  HO-063 non serve: il rilascio raggiunge il server per indirizzo.
- [ ] L'indirizzo IPv4 del server (HO-056 §7). Non è segreto.
- [ ] La CLI `gh` sul PC, autenticata come amministratore (`gh auth status`).
- [ ] 30 minuti.

## 4. Regole di sicurezza per tutto il documento

> **AVVERTENZA:** La chiave privata del rilascio dà a chi la possiede il rilascio di qualunque
> immagine pubblicata, e `deploy` equivale a root sul server (DR-411). Non inviarla all'agente,
> non incollarla in chat, issue o email, non salvarla nel repository.

> **AVVERTENZA:** Non scrivere la chiave privata come argomento di un comando (`--body`): resterebbe
> nella cronologia di PowerShell. Il §5 la passa con una pipe da file.

## 5. Procedura A — Chiave SSH del rilascio

1. **[PC]** Crea una cartella temporanea e la coppia di chiavi, **senza passphrase** (Actions non
   può digitarla; la protezione è il comando forzato). Alle due richieste di passphrase premi solo
   Invio:

   ```powershell
   $d = Join-Path $env:TEMP "ho064"; New-Item -ItemType Directory -Force $d | Out-Null
   ssh-keygen -t ed25519 -C "rilascio-github" -f "$d\rilascio"
   ```

   La variabile `$d` serve fino al §5.6: resta nella stessa finestra di PowerShell.

2. **[PC]** Stampa la **chiave pubblica** (non è segreta) e copiala:

   ```powershell
   Get-Content "$d\rilascio.pub"
   ```

3. **[server]** Scrivi la riga di `authorized_keys` con il modello di
   `infra/deploy/rilascio/authorized_keys.esempio`: `restrict,command="/opt/amoris/rilascio/rilascia.sh" `
   seguito dalla chiave pubblica intera. Apri il file con:

   ```bash
   sudo nano /etc/ssh/authorized_keys/deploy
   ```

   Incolla la riga, salva (Ctrl+O, Invio) ed esci (Ctrl+X). Poi:

   ```bash
   sudo chown root:root /etc/ssh/authorized_keys/deploy
   sudo chmod 0644 /etc/ssh/authorized_keys/deploy
   sudo grep -c '^restrict,command="/opt/amoris/rilascio/rilascia.sh" ssh-ed25519 ' /etc/ssh/authorized_keys/deploy
   ```

   **Esito atteso:** l'ultimo comando stampa `1`.

4. **[PC]** Prova che la chiave apre **solo** il comando forzato. Sostituisci `<IPv4>`:

   ```powershell
   ssh -i "$d\rilascio" -o IdentitiesOnly=yes deploy@<IPv4> "ls /"
   ```

   **Esito atteso:** nessun elenco di cartelle; compare `rilascia: comando non consentito (atteso:
   rilascia <production|staging> <hash> [--migrazioni])`. Controlla il codice con `$LASTEXITCODE`
   (deve essere `64`). Se vedi l'elenco
   di `/`, **fermati**: il comando forzato non è attivo (§9).

5. **[PC]** Carica la chiave privata come segreto del repository, con una pipe:

   ```powershell
   Get-Content -Raw "$d\rilascio" | gh secret set RILASCIO_SSH_KEY --repo F1-Solution/CentroAmorisLaetitia
   ```

   **Esito atteso:** `✓ Set Actions secret RILASCIO_SSH_KEY for F1-Solution/CentroAmorisLaetitia`.

6. **[PC]** Cancella la coppia di chiavi dal PC. GitHub non restituisce il segreto: se serve una
   chiave nuova, si rifà questa procedura (§10).

   ```powershell
   Remove-Item -Recurse -Force $d
   ```

## 6. Procedura B — Indirizzo e `known_hosts` del server

1. **[server]** Stampa la chiave pubblica dell'host (non è segreta):

   ```bash
   cat /etc/ssh/ssh_host_ed25519_key.pub
   ```

   La riga ha la forma `ssh-ed25519 AAAA... root@<nome>`. Tieni solo le prime due parti.

2. **[PC]** Scrivi le due variabili. Sostituisci `<IPv4>` e `<AAAA...>`; la riga di `known_hosts` è
   `<IPv4> ssh-ed25519 <AAAA...>`, tutto su una riga:

   ```powershell
   gh variable set RILASCIO_HOST --repo F1-Solution/CentroAmorisLaetitia --body "<IPv4>"
   gh variable set RILASCIO_KNOWN_HOSTS --repo F1-Solution/CentroAmorisLaetitia --body "<IPv4> ssh-ed25519 <AAAA...>"
   ```

   La chiave dell'host si prende dal server attraverso la sessione amministrativa già fidata, non
   con `ssh-keyscan`: così nessuno in mezzo può sostituirla.

3. **[PC]** Controlla:

   ```powershell
   gh variable list --repo F1-Solution/CentroAmorisLaetitia
   gh secret list --repo F1-Solution/CentroAmorisLaetitia
   ```

   **Esito atteso:** due variabili, `RILASCIO_HOST` e `RILASCIO_KNOWN_HOSTS`; un segreto,
   `RILASCIO_SSH_KEY` (il valore non si vede).

## 7. Procedura C — Impostazioni di Actions

1. **[PC]** Rendi obbligatorie le azioni fissate per SHA, lasciando invariato il resto:

   ```powershell
   gh api -X PUT repos/F1-Solution/CentroAmorisLaetitia/actions/permissions -F enabled=true -f allowed_actions=all -F sha_pinning_required=true
   ```

2. **[PC]** Verifica:

   ```powershell
   gh api repos/F1-Solution/CentroAmorisLaetitia/actions/permissions
   gh api repos/F1-Solution/CentroAmorisLaetitia/actions/permissions/workflow
   ```

   **Esito atteso:** `"sha_pinning_required":true`; `"default_workflow_permissions":"read"` e
   `"can_approve_pull_request_reviews":false`.

3. **[PC]** Rilancia l'ultima CI di `main` per provare che il §7.1 non la blocca:

   ```powershell
   gh run list --repo F1-Solution/CentroAmorisLaetitia --workflow ci.yml --branch main --limit 1
   gh run rerun <id> --repo F1-Solution/CentroAmorisLaetitia
   ```

   **Esito atteso:** la CI torna verde in tutti i lavori.

## 8. Procedura D — Accesso del repository ai pacchetti GHCR

Il lavoro di rilascio scarica le immagini con il proprio `GITHUB_TOKEN`: ogni pacchetto deve dare
al repository almeno la lettura.

1. Apri `https://github.com/orgs/F1-Solution/packages`.
2. Per ognuno dei cinque pacchetti `amoris-web`, `amoris-admin`, `amoris-api`, `amoris-scrub`,
   `amoris-backup`: apri il pacchetto → **Package settings** → **Manage Actions access**.
3. Controlla che `CentroAmorisLaetitia` sia presente con ruolo **Read** o **Write**, e che la
   visibilità del pacchetto sia **Private**.

**Esito atteso:** cinque pacchetti privati, ognuno con il repository nell'elenco.

## 9. Che cosa fare se qualcosa non va

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Il §5.4 mostra l'elenco di `/` | `ForceCommand` o `command=` non attivi | togli subito la riga da `/etc/ssh/authorized_keys/deploy`, ricontrolla il blocco `Match User deploy` con HO-062 §6.4, poi ripeti il §5 |
| Il §5.4 risponde `Connection refused` o va in timeout dopo più tentativi | limite di frequenza di `ufw` sulla 22 (HO-062 §7) | attendi 30 secondi e ripeti una volta sola |
| Il §5.4 chiede una password o risponde `Permission denied (publickey)` | riga di `authorized_keys` incompleta o permessi diversi da `root:root 0644` | ricontrolla il §5.3 |
| `gh secret set` risponde `HTTP 403` | l'account di `gh` non è amministratore del repository | `gh auth status`; accedi con un amministratore |
| La CI del §7.3 fallisce con un messaggio sul pinning per SHA | un'azione non è fissata per SHA | riporta `sha_pinning_required` a `false` con lo stesso comando del §7.1 e scrivi all'agente il nome dell'azione |
| Un pacchetto del §8 non elenca il repository | pacchetto creato fuori dal workflow | **Add Repository** → `CentroAmorisLaetitia` → ruolo **Read** |

## 10. Revoca e rotazione della chiave

- **Revoca:** togli la riga da `/etc/ssh/authorized_keys/deploy` sul server e cancella il segreto
  con `gh secret delete RILASCIO_SSH_KEY --repo F1-Solution/CentroAmorisLaetitia`.
- **Rotazione** (cambio di amministratori, sospetto di furto, ogni anno): rifai il §5 con una chiave
  nuova, sostituendo la riga in `authorized_keys`; il segreto si sovrascrive.
- Se cambia la chiave dell'host del server (server rifatto), rifai il §6.

## 11. Come segnalare il completamento

Scrivi all'agente un messaggio come questo. **Non** aggiungere la chiave privata.

```text
HO-064 fatto.
Data: <data>
Riga di authorized_keys: grep stampa 1
Prova del comando forzato (§5.4): uscita 64, nessun elenco di /
Chiave privata cancellata dal PC: sì
Variabili RILASCIO_HOST e RILASCIO_KNOWN_HOSTS: presenti
Segreto RILASCIO_SSH_KEY: presente
sha_pinning_required: true; default_workflow_permissions: read
CI rilanciata dopo il §7: <id>, <verde o rossa>
Pacchetti GHCR: 5 privati, repository con ruolo <Read o Write>
Differenze fra i nomi di questo documento e l'interfaccia: <elenco o «nessuna»>
```

## 12. Esito

Da compilare dopo la segnalazione.
