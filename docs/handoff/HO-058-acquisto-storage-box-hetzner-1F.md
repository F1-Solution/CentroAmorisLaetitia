# HO-058 — Acquisto della Storage Box Hetzner BX11 per i backup (Fase 1F)

**Stato:** ⏳ **eseguibile** dal 2026-11-06; sede Germania (DR-376, D266 = A). Il nome della
sede resta quello del carrello. DR-374 (D265 = B): acquisto subito, in parallelo alla `1F-W3`.

**Scopo:** comprare lo spazio dove andranno i backup cifrati del server (DR-298, DR-335) e
accettare il contratto per il trattamento dei dati. Questo handoff **non** mette backup sulla
Storage Box, **non** installa chiavi e **non** attiva le istantanee: lo fa la `1F-W5`, quando
il server esiste.

**Stile:** come HO-056 (ASD-STE100 adattato all'italiano): una azione per passo, forma
imperativa. Un'AVVERTENZA indica un rischio per i dati o per la sicurezza. Un'ATTENZIONE indica
un rischio di costi o di servizio.

**Fonti dei nomi dell'interfaccia:** documentazione ufficiale di Hetzner, letta il 2026-11-06:
`hetzner.com/storage/storage-box/`, `docs.hetzner.com/storage/storage-box/getting-started/creating-a-storage-box/`,
`docs.hetzner.com/storage/storage-box/access/access-ssh-rsync-borg/`,
`docs.hetzner.com/general/general-terms-and-conditions/data-privacy-faq/`. L'interfaccia è in
inglese o in tedesco. Se un nome non corrisponde, usa la voce con lo stesso significato e
scrivi la differenza nella segnalazione (§9).

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D192 | Backup fuori dal server | **DR-298**: altro fornitore UE, backup cifrati prima dell'invio, chiave custodita dall'utente |
| D224 | Destinazione dei backup | **DR-335**: Hetzner Storage Box BX11, restic via SFTP |
| D195 | Costi | **DR-302**: account intestato al Centro, che paga |
| D265 | Quando si compra | **DR-374**: subito |
| D266 | Sede della Storage Box | **DR-376**: Germania |

## 2. Ricontrollo del 2026-11-06

- BX11: 1 TB a **3,20 € + IVA al mese** (0,0051 € l'ora), nessuna durata minima, disdetta
  immediata. La pagina indica anche un costo di attivazione una tantum, senza l'importo nel
  testo: controllalo nel riepilogo prima di pagare.
- Sede a scelta: Germania o Finlandia.
- L'ordine si fa solo nella **Hetzner Console** (`console.hetzner.com`). Robot non gestisce
  più le Storage Box singole dal 29 luglio 2025.
- Il contratto per il trattamento dei dati (DPA, art. 28 GDPR) **non** è automatico: si accetta
  nell'account, alla pagina `accounts.hetzner.com/account/dpa`.

## 3. Prerequisiti

- [x] D266 decisa: Germania (DR-376).
- [ ] Un computer con browser.
- [ ] Un gestore di password (lo stesso di HO-056).
- [ ] Un indirizzo email del Centro per l'account Hetzner (DR-302).
- [ ] Dati di fatturazione del Centro e un mezzo di pagamento del Centro.
- [ ] 30 minuti. Hetzner può chiedere una verifica dell'identità per i clienti nuovi: in quel
  caso l'attivazione può richiedere qualche giorno.

## 4. Regole di sicurezza per tutto il documento

> **AVVERTENZA:** Non inviare all'agente password, codici di verifica o dati della carta.
> L'agente non deve ricevere credenziali di fornitori (`deployment-gate`).

> **AVVERTENZA:** Non caricare file sulla Storage Box. Riceverà solo backup cifrati dal
> server, dalla `1F-W5`.

## 5. Procedura A — Crea l'account Hetzner del Centro

1. Apri `https://accounts.hetzner.com/signUp`.
2. Registra l'account con l'email del Centro e i dati di fatturazione del Centro.
3. Genera una password nuova con il gestore: almeno 24 caratteri.
4. Salva la password nel gestore con il nome «Hetzner — account del Centro».
5. Attiva l'autenticazione a due fattori nelle impostazioni dell'account, se Hetzner la offre.
6. Completa le verifiche che Hetzner chiede.

**Esito atteso:** entri in `accounts.hetzner.com` con l'account del Centro.

## 6. Procedura B — Accetta il contratto per il trattamento dei dati

> **ATTENZIONE:** I backup contengono dati personali, anche se cifrati. Accetta il DPA
> **prima** che arrivi il primo backup (`1F-W5`). La sua adeguatezza la valuta MI-06.

1. Apri `https://accounts.hetzner.com/account/dpa`.
2. Leggi il contratto. Il modello è anche su `https://www.hetzner.com/AV/DPA_en.pdf`.
3. Compila i tipi di dati e le categorie di interessati che la pagina chiede. Usa questi
   testi: tipi di dati «copie di backup cifrate del sito e dell'area amministrativa: account
   del personale, compilazioni dei moduli di contatto, documenti e immagini pubblicati»;
   categorie di interessati «personale del Centro, persone che scrivono al Centro dai moduli
   del sito».
4. Spunta «I agree to the agreement».
5. Salva o scarica la conferma in PDF, se la pagina la offre.

**Esito atteso:** la pagina mostra il DPA come concluso, con la data.

## 7. Procedura C — Compra la Storage Box

1. Apri `https://console.hetzner.com`.
2. Crea un progetto con il nome `amoris`.
3. Apri il progetto.
4. Nel menu, fai clic su **Storage Boxes**.
5. Fai clic su **Create Storage Box**.
6. In **Location**, scegli la sede di D266.
7. In **Type**, scegli **BX11** (1 TB).

> **ATTENZIONE:** Controlla il prezzo prima di continuare: 3,20 € + IVA al mese. Se il prezzo
> è diverso, fermati e segnala il prezzo nuovo (§9).

8. In **Access**, scegli **Password**. Non aggiungere una chiave SSH: la chiave del backup
   nasce sul server nella `1F-W5` e si installa da lì.
9. Genera una password nuova con il gestore: almeno 24 caratteri.
10. Salva la password nel gestore con il nome «Storage Box Amoris — utente principale».
11. Incolla la password nel campo.
12. In **Additional settings**, attiva **SSH support**.
13. Attiva **External reachability**: il server è da Aruba, fuori dalla rete di Hetzner.
14. Non attivare Samba, WebDAV o altri protocolli.
15. In **Name**, scrivi `amoris-backup`.
16. Controlla il riepilogo: BX11, sede di D266, prezzo, costo di attivazione.

> **ATTENZIONE:** Il passo seguente fa un acquisto con addebito.

17. Fai clic su **Create & Buy now**.

**Esito atteso:** la Storage Box `amoris-backup` compare nell'elenco con lo stato attivo.

## 8. Procedura D — Annota i dati non segreti

1. Apri la Storage Box `amoris-backup`.
2. Scrivi sul foglio il nome utente: inizia con `u` seguito da numeri.
3. Scrivi sul foglio il nome del server: ha la forma `uNNNNN.your-storagebox.de`.

Questi due dati non sono segreti: servono all'agente per preparare la `1F-W5`.

> **AVVERTENZA:** Non attivare le istantanee automatiche e non creare sottoaccount adesso.
> Si configurano nella `1F-W5`, insieme alla chiave e all'orario del backup.

## 9. Che cosa fare se qualcosa non va

| Problema | Azione |
|---|---|
| Il prezzo di BX11 non è 3,20 € + IVA | Fermati. Segnala il prezzo nuovo. L'agente prepara una decisione |
| La sede scelta in D266 non è disponibile | Fermati. Segnala le sedi offerte |
| Hetzner chiede una verifica dell'identità | Completala con i dati del Centro. Segnala la data di attivazione |
| La pagina del DPA non esiste o chiede dati diversi | Fermati prima di comprare. Segnala che cosa chiede la pagina |
| L'intestatario non è il Centro | Fermati prima del pagamento. Segnala il caso |
| Il pagamento fallisce | Non ripetere l'ordine. Controlla nella Console se la Storage Box esiste. Segnala |

## 10. Come segnalare il completamento

Scrivi all'agente un messaggio come questo. Non aggiungere password o dati della carta.

```text
HO-058 fatto.
Data dell'ordine: <data>
Prezzo: <prezzo> + IVA al mese; attivazione: <importo o «nessuna»>
Sede: <Germania o Finlandia, con il nome del data center se visibile>
DPA concluso il: <data>
Nome utente: uNNNNN   Server: uNNNNN.your-storagebox.de
SSH support: attivo   External reachability: attivo
Differenze fra i nomi di questo documento e l'interfaccia: <elenco o «nessuna»>
```

## 11. Che cosa segue, in handoff separati (`1F-W5`)

- Chiave SSH del backup generata sul server e installata con `install-ssh-key` sulla porta 23.
- Impronta della chiave del server della Storage Box confrontata con quella pubblicata da
  Hetzner e fissata in `known_hosts`.
- Password del repository restic: creazione e custodia di una copia fuori dal server (DR-298).
- Istantanee automatiche della Storage Box, che il server non può cancellare via SFTP (cartella
  `/.zfs` in sola lettura); sottoaccount limitato alla cartella dei backup.

## 12. Esito

Da compilare dopo la segnalazione.
