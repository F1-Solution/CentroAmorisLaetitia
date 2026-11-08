# Approvazione del rischio residuo per i dati sul server

**Centro per la Famiglia Amoris Laetitia — Nuovo sito, Fase 1**  
**Riferimenti:** HO-060, §§3 e 5; decisione DR-385 (D272) dell'8 novembre 2026.  
**Versione:** 1 dell'8 novembre 2026.

Si richiede al legale rappresentante del Centro, o a chi ha una delega scritta per le decisioni sulla protezione dei dati, di approvare la conservazione dei dati sul server senza cifratura a riposo per la sola Fase 1. Le sezioni 1–4 riportano la descrizione del rischio richiesta da HO-060 (§3). La firma va apposta dopo averla letta con il manutentore e aver chiarito le eventuali domande.

## 1 Dati interessati e scelta tecnica

La decisione DR-385 prevede di non adottare né la cifratura del disco né quella applicativa dei dati delle seguenti tre tabelle del database:

- `form_submissions`: compilazioni dei moduli del sito, con nome, recapiti e testo libero;
- `legacy_email_log`: storico delle email dei moduli importato dal vecchio sito;
- `users`: account dell'area amministrativa, con email e password salvate solo come hash.

La scelta comprende anche i file caricati nell'archivio degli oggetti del server. Le password restano sotto forma di hash: non sono conservate in chiaro.

## 2 Rischio residuo accettato

I dati delle tre tabelle, salvo la protezione specifica degli hash, e i file caricati restano leggibili sul disco del server, senza una protezione crittografica a riposo. Chi ottiene una copia del disco, di un volume o di un dump prodotto sul server può leggerne i contenuti senza doverli decifrare.

Questo può accadere per un accesso non autorizzato con privilegi di amministratore del server (`root`), un errore del fornitore, un disco dismesso senza cancellazione o una copia di manutenzione lasciata accessibile. Ne può derivare la divulgazione non autorizzata di dati personali e dei contenuti dei moduli o dei file.

La cifratura del disco non avrebbe protetto da un'applicazione compromessa; quella dei campi avrebbe offerto una protezione parziale. Nessuna delle due è adottata in Fase 1. MI-06, domanda 12, proponeva invece la cifratura a riposo come requisito di rilascio, o misure equivalenti motivate e validate: DR-385 si discosta da questa proposta.

## 3 Misure previste a presidio del rischio

L'approvazione presuppone l'attuazione e la verifica delle seguenti misure prima dell'uso dei dati. Questo documento non ne certifica il completamento nelle W4 e W5 della Fase 1F.

- **Backup cifrati prima di lasciare il server**, con due copie cifrate delle chiavi, separate dal server e dai backup: una al manutentore e una in custodia istituzionale del Centro, affidate a persone diverse (DR-298 e DR-380).
- **Trasporto cifrato con HTTPS**.
- **Indirizzi IP salvati solo come digest con sale**, mai in chiaro, nei dati e nei log applicativi interessati (DR-390).
- **Secondo fattore TOTP per tutti gli account amministrativi**, con sessioni limitate a 14 giorni e a 8 ore di inattività (DR-384 e DR-391).
- **Accesso al server ristretto al manutentore con chiave SSH**, da configurare nella 1F-W5.

Queste misure non cifrano i dati presenti sul disco del server.

## 4 Alternative e durata della scelta

**A — Cifratura del disco:** richiede una persona che sblocchi il disco a ogni riavvio e non protegge da un'applicazione compromessa. **B — Cifratura dei campi di `form_submissions` e `legacy_email_log`:** richiede sviluppo nella 1F-W6 e una chiave aggiuntiva da custodire e recuperare.

L'accettazione vale per tutta e per la sola Fase 1. La scelta va riesaminata prima della fase gestionale, o prima se cambiano i dati trattati, per esempio con moduli che raccolgono dati di salute. Se il Centro non approva, DR-385 si riapre con le alternative A o B e i tempi della Fase 1F si allungano.

## 5 Dichiarazione del Centro

Il Centro per la Famiglia Amoris Laetitia, titolare del trattamento, ha letto la descrizione del rischio contenuta nel documento HO-060 (§3). Approva che, per la Fase 1 del nuovo sito, i dati delle compilazioni dei moduli, lo storico delle email dei moduli, gli account dell'area amministrativa e i file caricati siano conservati sul server **senza cifratura a riposo**, fermo restando che i backup sono cifrati, il trasporto avviene con HTTPS, l'accesso all'area amministrativa richiede il secondo fattore e l'accesso al server è ristretto al manutentore. Accetta il rischio residuo descritto, per la sola Fase 1, con riesame prima della fase gestionale o prima di trattare categorie di dati diverse da quelle descritte.

**Ruolo di chi approva:** ____________________________________________________

Legale rappresentante oppure delegato con delega scritta alle decisioni sulla protezione dei dati.

**Riferimento della delega scritta, se applicabile:** _______________________________

**Luogo:** __________________________ **Data:** __________________________

**Firma:** _______________________________________________________________

## 6 Trasmissione e custodia

L'approvazione deve provenire dall'indirizzo email istituzionale del Centro oppure essere resa con questo documento firmato, a mano e scansionato o con firma digitale. Per l'email, riportare la dichiarazione della sezione 5 e completarla con luogo, data, ruolo e sottoscrizione.

È opportuno informare il professionista incaricato per MI-06 dello scostamento dalla proposta. Se chi approva ne richiede il parere, attendere la risposta prima della firma.

L'originale completato va conservato **fuori dal repository**, nell'archivio del Centro e in una copia del manutentore. Non inserire in Git documenti con firma, nomi o deleghe. All'agente va comunicata soltanto la riga seguente, completata senza nomi e senza allegati:

```text
HO-060 fatto: rischio di DR-385 approvato per iscritto il <AAAA-MM-GG> da <ruolo>, originale conservato da <Centro e manutentore>.
```

La preparazione di questo modulo non costituisce approvazione. Fino alla ricezione dell'approvazione scritta resta vietato portare dati del Centro sul server (DR-385); resta inoltre necessario chiudere la 1F-W4 (DR-374). Il presente documento non è un parere legale e non attesta conformità.
