# HO-056 — Acquisto del server Aruba Cloud VPS O4A8 (Fase 1F)

**Stato:** ⏳ **eseguibile** dal 2026-11-06. DR-374 (D265 = B) supera DR-352: il server si
compra subito e resta **senza dati del Centro** fino alla chiusura della `1F-W4`. Fonti
ricontrollate il 2026-11-06 (§1 bis).

**Scopo:** comprare il server della produzione e dello staging (DR-334, DR-296) e
verificare il primo accesso. Questo handoff **non** mette dati sul server, **non** cambia il
DNS e **non** configura la posta.

**Stile:** le istruzioni seguono le regole di ASD-STE100, adattate all'italiano: una sola
azione per passo, frasi brevi, forma attiva e imperativa, gli stessi termini in tutto il
documento. Un'AVVERTENZA indica un rischio per i dati o per la sicurezza. Un'ATTENZIONE indica
un rischio di costi o di servizio. Avvertenze e attenzioni sono sempre **prima** del passo.

**Fonti dei nomi dell'interfaccia:** guide ufficiali di Aruba Cloud, lette il 2026-11-03:
`kb.arubacloud.com/en/bare-metal-vps/cloud-vps/create.aspx`, `…/preliminary-information.aspx`,
`…/ssh-key.aspx`; prezzo da `www.cloud.it/vps/`. Le guide sono in inglese. L'interfaccia in
italiano può mostrare nomi tradotti. Se un nome non corrisponde, usa la voce con lo stesso
significato e scrivi la differenza nella segnalazione (§11).

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D245 | Quando si compra il server | **DR-352**: nella `1F-W5`, come dice il PLAN |
| D246 | Sistema operativo | **DR-353**: Ubuntu Server 24.04 LTS |
| D247 | Account Aruba per l'acquisto | **DR-354**: l'account del Centro che ha già il dominio |
| D265 | Accelerazione della 1F | **DR-374**: acquisto subito, supera DR-352; nessun dato prima della `1F-W4` |

## 1 bis. Ricontrollo del 2026-11-06

- Prezzo di VPS O4A8 su `www.cloud.it/vps/`: **11,79 € + IVA al mese**, invariato.
- Sistemi della scheda ufficiale dei template (`kb.arubacloud.com/en/utilities/template/template-datasheets.aspx`):
  per i Cloud VPS compare «Ubuntu 24». La versione esatta (24.04 LTS) si controlla al primo
  accesso (§8, passo 5).
- Data center dei Cloud VPS: si vedono solo nel carrello. Aruba ha sedi in Italia ad Arezzo,
  Bergamo e Roma; quale serve i Cloud VPS non è pubblicato.

## 2. Prerequisiti

- [ ] L'agente ha ricontrollato prezzo e sistemi (§1 bis, 2026-11-06). Se esegui dopo il
  2026-11-20, chiedi un nuovo ricontrollo.
- [ ] Un computer Windows 11 con PowerShell. Il client OpenSSH è già incluso in Windows 11.
- [ ] Un gestore di password (per esempio quello che usa già il Centro).
- [ ] Le credenziali dell'account Aruba del Centro che ha già il dominio (DR-354).
- [ ] Un mezzo di pagamento del Centro: carta di credito o PayPal (DR-302).
- [ ] 30 minuti di tempo.

## 3. Regole di sicurezza per tutto il documento

> **AVVERTENZA:** Non inviare all'agente password, chiavi private, codici di verifica o dati
> della carta. L'agente non deve ricevere credenziali di fornitori o del server
> (`deployment-gate`).

> **AVVERTENZA:** Non copiare dati del Centro sul server. Il server resta senza dati del
> Centro fino alla chiusura della `1F-W4` (security review, DR-374).

> **ATTENZIONE:** Non cambiare il DNS del dominio. Non creare o cambiare caselle di posta.
> Queste operazioni hanno handoff separati (§12).

## 4. Procedura A — Crea la chiave SSH

La chiave SSH sostituisce la password per entrare nel server. La parte privata resta solo sul
tuo computer.

1. Apri PowerShell.
2. Scrivi questo comando e premi Invio:

   ```powershell
   ssh-keygen -t ed25519 -a 100 -C "amoris-vps-2026-11" -f "$env:USERPROFILE\.ssh\amoris_vps"
   ```

3. Quando il programma chiede la passphrase, scrivi una passphrase nuova e lunga.
4. Scrivi la stessa passphrase una seconda volta.
5. Salva la passphrase nel gestore di password, con il nome «Server Amoris — passphrase SSH».
6. Scrivi questo comando e premi Invio:

   ```powershell
   ssh-keygen -lf "$env:USERPROFILE\.ssh\amoris_vps.pub"
   ```

7. Scrivi su un foglio l'impronta che inizia con `SHA256:`. Questa impronta non è segreta.

**Esito atteso:** nella cartella `C:\Users\<tuo nome>\.ssh\` ci sono due file:
`amoris_vps` (privato) e `amoris_vps.pub` (pubblico).

> **AVVERTENZA:** Non inviare, non caricare e non copiare in altre cartelle il file
> `amoris_vps` senza `.pub`. Chi ha questo file e la passphrase entra nel server.

## 5. Procedura B — Apri il configuratore del VPS

1. Apri il browser.
2. Vai a `https://my.arubacloud.com`.
3. Entra con l'account Aruba del Centro che ha già il dominio (DR-354). Se l'account non ha ancora un account Cloud, vai al
   passo 6: Aruba crea l'account Cloud dopo il primo acquisto.
4. Nel menu, fai clic su **BARE METAL & VPS**, poi su **VPS**.
5. Fai clic su **Go to service** (in italiano: «Vai al servizio»).
6. Fai clic su **Setup VPS**. Se non hai un account Cloud, apri invece
   `https://www.cloud.it/vps/` e scegli il piano dal listino.
7. Trova la riga **VPS O4A8**: 4 vCPU, 8 GB di RAM, 80 GB di disco.

> **ATTENZIONE:** Controlla il prezzo prima di continuare. Il prezzo rilevato il 2026-11-03 è
> 11,79 € + IVA al mese. Se il prezzo è diverso, fermati e segnala il prezzo nuovo (§11).

8. Fai clic su **Setup** alla fine della riga VPS O4A8.

**Esito atteso:** il browser apre il carrello `cart.aruba.it` al passo **CONFIGURATION**.

## 6. Procedura C — Configura e compra

1. In **SERVER FEATURES**, controlla che la taglia sia VPS O4A8. Non cambiarla.

> **ATTENZIONE:** Scegli solo un data center in Italia (DR-334). Se nessun data center
> italiano è disponibile per O4A8, fermati e segnala (§11).

2. In **LOCATION**, scegli un data center in Italia. Scrivi il nome del data center sul foglio.
3. In **OPERATING SYSTEM**, scegli Ubuntu Server 24.04 LTS (DR-353). Il carrello può
   chiamarlo «Ubuntu 24». Se non c'è nessun Ubuntu 24, fermati e segnala l'elenco completo
   (§11).
4. In **SERVER MANAGEMENT ACCOUNT**, genera una password nuova con il gestore di password:
   almeno 24 caratteri.
5. Salva la password nel gestore, con il nome «Server Amoris — password root».
6. Incolla la password nel campo della password.
7. Fai clic su **Add SSH key**.
8. Seleziona il file `C:\Users\<tuo nome>\.ssh\amoris_vps.pub`. Seleziona **solo** il file che
   finisce con `.pub`.
9. Seleziona **SSH access without password** (accesso SSH senza password).
10. In **INFO**, scrivi il nome del server: `amoris-prod-1`.
11. Non aggiungere altri servizi a pagamento (firewall, switch, storage). Il PLAN non li
    prevede.
12. Fai clic su **CONTINUE and go to the summary**.
13. In **SUMMARY**, controlla: VPS O4A8, data center in Italia, Ubuntu 24,
    prezzo 11,79 € + IVA al mese.
14. Fai clic su **CONTINUE with the purchase**.
15. In **LOGIN**, entra con l'account Aruba del Centro (DR-354).
16. In **CLIENT DETAILS**, controlla che l'intestatario sia il Centro. Se l'intestatario non è
    il Centro, fermati e segnala (§11).
17. Fai clic su **CONFIRM**.
18. In **PAYMENT**, scegli la carta o PayPal del Centro.
19. Leggi le condizioni di fornitura.
20. Accetta le condizioni.

> **ATTENZIONE:** Il passo seguente fa un acquisto con addebito.

21. Fai clic su **CONFIRM ORDER and proceed to payment**.
22. Completa il pagamento.

**Esito atteso:** Aruba mostra la conferma dell'ordine e invia un'email di conferma.

## 7. Procedura D — Trova l'indirizzo del server

1. Attendi l'email di attivazione del servizio. Di solito arriva in pochi minuti.
2. Vai a `https://my.arubacloud.com`.
3. Nel menu, fai clic su **BARE METAL & VPS**, poi su **VPS**.
4. Fai clic sul server `amoris-prod-1`.
5. Scrivi sul foglio l'indirizzo IPv4 pubblico.
6. Se la pagina mostra un indirizzo IPv6, scrivi anche l'indirizzo IPv6.

**Esito atteso:** lo stato del server è attivo e hai l'indirizzo IPv4.

## 8. Procedura E — Verifica il primo accesso

Questa procedura legge soltanto. Non cambia niente sul server.

1. Apri PowerShell.
2. Scrivi questo comando. Sostituisci `<IPv4>` con l'indirizzo del §7:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\amoris_vps" root@<IPv4>
   ```

3. Il programma chiede se continuare la connessione. Scrivi `yes` e premi Invio.
4. Scrivi la passphrase della chiave.

**Esito atteso:** il prompt finisce con `#` e mostra il nome del server.

5. Scrivi questo comando e premi Invio:

   ```bash
   cat /etc/os-release; nproc; free -h; df -h /
   ```

6. Copia l'uscita del comando in un file di testo. L'uscita non contiene segreti.
7. Scrivi `exit` e premi Invio.

> **AVVERTENZA:** Non installare programmi e non cambiare impostazioni. L'indurimento del
> server ha un handoff proprio (DR-357, DR-374).

## 9. Procedura F — Prepara il credito per il rinnovo

Aruba rinnova i Cloud VPS **solo** con il credito dell'account Cloud. Se il credito non
basta, Aruba sospende il server «per credito insufficiente».

> **ATTENZIONE:** Se il credito finisce, il sito si ferma. Fai questa procedura prima della
> data di rinnovo.

1. Vai a `https://my.arubacloud.com`.
2. Apri la sezione del credito (in inglese **wallet**; nel listino «Ricarica»).
3. Ricarica almeno 3 mesi di servizio: circa 43 € IVA compresa.
4. Scrivi sul foglio la data del primo rinnovo.

**Esito atteso:** il credito disponibile copre almeno 3 rinnovi.

## 10. Che cosa fare se qualcosa non va

| Problema | Azione |
|---|---|
| Il prezzo di O4A8 non è 11,79 € + IVA | Fermati. Segnala il prezzo nuovo. L'agente prepara una decisione |
| Nessun data center in Italia per O4A8 | Fermati. Segnala le sedi offerte. Non scegliere una sede fuori dall'Italia |
| Nessun Ubuntu 24 nell'elenco, oppure `/etc/os-release` non dice 24.04 | Fermati. Segnala l'elenco dei sistemi offerti |
| Il carrello rifiuta la chiave `.pub` | Fermati. Segnala il messaggio esatto. L'agente prepara una chiave RSA come alternativa |
| L'intestatario non è il Centro | Fermati prima del pagamento. Segnala il caso |
| `ssh` risponde `Permission denied` | Controlla di usare il file `amoris_vps` e l'utente `root`. Se l'errore resta, segnala il messaggio senza la passphrase |
| `ssh` risponde `Connection timed out` | Attendi 10 minuti. Prova un'altra volta. Se l'errore resta, segnala il messaggio |
| Il pagamento fallisce | Non ripetere l'ordine più volte. Controlla nell'«Area Clienti» se l'ordine esiste. Segnala |

## 11. Come segnalare il completamento

Scrivi all'agente un messaggio come questo. Non aggiungere password, passphrase o dati della
carta.

```text
HO-056 fatto.
Data dell'ordine: <data>
Prezzo nel carrello: <prezzo> + IVA al mese
Data center: <nome>
Sistema operativo: <nome e versione>
IPv4: <indirizzo>   IPv6: <indirizzo o «nessuno»>
Impronta della chiave: SHA256:<...>
Primo accesso: riuscito / non riuscito (<messaggio>)
Uscita del §8 passo 5: <testo incollato>
Credito ricaricato: <importo>, primo rinnovo il <data>
Differenze fra i nomi di questo documento e l'interfaccia: <elenco o «nessuna»>
```

L'agente registra l'esito qui sotto (§13), con DR nuove dove servono.

## 12. Altre operazioni su Aruba, in handoff separati

Queste operazioni **non** sono in questo documento. Ognuna avrà il suo handoff e la sua
conferma.

| Operazione | Quando | Dipende da |
|---|---|---|
| Indurimento del server: utente non `root`, solo chiave SSH, firewall con le porte 22, 80 e 443, aggiornamenti automatici, Docker | `1F-W5`, in parallelo alla `1F-W4` (DR-374) | DR-357; nessun dato prima della `1F-W4` |
| Record DNS dello staging | `1F-W5` | DR-375 (sottodominio con password) |
| Casella di posta del Centro per l'invio dei moduli (SMTP di Aruba, DR-301) | `1F-W6` | parere MI-06 (HO-054) |
| Riduzione del TTL, poi cambio dei record A e AAAA | `1F-W8` | D230, `gate-checklist.md` senza voci rosse |
| Rimozione di `phpinfo()` dal vecchio hosting (R-17) | `1F-W8` | rilascio |
| Destino del vecchio hosting WordPress | dopo la `1F-W9` | D231 |

La Storage Box dei backup è di Hetzner, non di Aruba (DR-335): handoff HO-058.

## 13. Esito

Da compilare dopo la segnalazione.
