# HO-060 — Approvazione scritta del rischio residuo di DR-385 (Fase 1F, W4)

**Stato:** ✅ **chiuso** il 2026-11-08 (DR-394): rischio approvato per iscritto dal legale
rappresentante, originale conservato dal Centro e dal manutentore fuori da Git. Resta DR-374:
nessun dato del Centro sul server prima della chiusura della `1F-W4`.

**Scopo:** ottenere dal Centro, in quanto titolare del trattamento, l'accettazione scritta del
rischio di non cifrare a riposo i dati sul server in Fase 1. Il parere MI-06 (domanda 12)
proponeva la cifratura a riposo come requisito di rilascio, o «misure equivalenti motivate e
validate». DR-385 ha scelto di non adottarla. Per questo la scelta va accettata da chi
risponde dei dati, non dal manutentore.

**Chi esegue:** il manutentore prepara e consegna. Il **legale rappresentante del Centro**, o
chi il Centro ha delegato per iscritto alle decisioni sulla protezione dei dati, approva.
Conviene che il professionista di MI-06 ne sia informato, perché la scelta si discosta dalla sua
proposta. Questo documento non è un parere legale e non attesta conformità.

---

## 1. Decisioni già prese

| Id | Decisione | Esito |
|---|---|---|
| D272 | Cifratura a riposo delle tre tabelle con dati personali | **DR-385**: opzione C, nessuna cifratura applicativa né del disco in Fase 1; cifrati backup (DR-298) e trasporto (TLS); rischio residuo **approvato per iscritto dal Centro** |
| D265 | Accelerazione della Fase 1F | **DR-374**: nessun dato del Centro sul server prima della chiusura della `1F-W4` |
| — | Parere MI-06, domanda 12 | il Centro «approva il rischio residuo» |

## 2. Prerequisiti

- [ ] La persona che approva è individuata: legale rappresentante o delegato con delega scritta.
- [ ] Un canale tracciabile dal Centro verso il manutentore: email dall'indirizzo istituzionale
  del Centro, oppure documento firmato (a mano e scansionato, o con firma digitale).
- [ ] 20 minuti per leggere il §3 con la persona che approva e rispondere alle sue domande.

## 3. Che cosa si approva (da leggere con il Centro)

**Dati interessati.** Tre tabelle del database del nuovo sito:

- `form_submissions`: le compilazioni dei moduli del sito, con nome, recapiti e testo libero;
- `legacy_email_log`: lo storico delle email dei moduli importato dal vecchio sito;
- `users`: gli account dell'area amministrativa, con email e password salvate solo come hash.

Comprendono anche i file caricati nell'archivio degli oggetti del server.

**Che cosa è protetto:**

- i **backup** sono cifrati prima di lasciare il server, con la chiave in due copie custodite da
  persone diverse (DR-298, DR-380);
- il **trasporto** è cifrato con HTTPS;
- gli **indirizzi IP** sono salvati solo come digest con sale, mai in chiaro (DR-390);
- l'area amministrativa ha **accesso con secondo fattore** (TOTP, DR-384) e sessioni limitate a
  14 giorni con 8 ore di inattività (DR-391);
- l'accesso al server è ristretto al manutentore, con chiave SSH (`1F-W5`).

**Che cosa non è protetto (rischio residuo):**

- sul disco del server i dati delle tre tabelle e i file caricati sono **in chiaro**;
- chi ottiene una copia del disco, di un volume o di un dump fatto sul server li legge senza
  altre barriere. Può succedere con un accesso `root` non autorizzato, un errore del fornitore
  del server, un disco dismesso non cancellato o una copia fatta per manutenzione e lasciata in
  giro;
- la cifratura del disco non avrebbe protetto da un'applicazione compromessa; la cifratura dei
  campi sì, in parte. Nessuna delle due è adottata in Fase 1.

**Fino a quando:** per tutta la Fase 1. La scelta si riesamina prima della fase gestionale, o
prima se cambiano i dati trattati (per esempio moduli che raccolgono dati di salute).

**Alternative scartate e che cosa costano:**

- **A — cifratura del disco del server:** a ogni riavvio serve una persona che sblocchi il disco;
  non protegge da un'applicazione compromessa;
- **B — cifratura dei campi di `form_submissions` e `legacy_email_log`:** lavoro di sviluppo
  nella `1F-W6`, con una chiave in più da custodire e recuperare.

Se il Centro **non approva**, la decisione si riapre con A o B e i tempi della Fase 1F si
allungano di conseguenza.

## 4. Procedura — Raccogli l'approvazione

1. Leggi con la persona che approva il §3 di questo documento.
2. Chiedi di inviare, dall'indirizzo istituzionale del Centro o come documento firmato, il testo
   del §5 completato con data, ruolo e firma.
3. Conserva l'originale **fuori dal repository**: nell'archivio del Centro e in una copia del
   manutentore. Non metterlo in Git, perché contiene nome e firma di una persona.
4. Scrivi all'agente solo questa riga, senza nomi e senza allegati:

   ```text
   HO-060 fatto: rischio di DR-385 approvato per iscritto il <AAAA-MM-GG> da <ruolo>, originale conservato da <Centro e manutentore>.
   ```

**Esito atteso:** l'agente registra l'approvazione nel registro delle decisioni, citando data e
ruolo e nessun nome. Poi aggiorna il rapporto della security review e toglie questo vincolo
dall'elenco delle condizioni per i dati sul server.

## 5. Testo da far approvare

**Documento pronto da consegnare:** [modulo Word](../legal/HO-060-approvazione-rischio-residuo-DR-385.docx)
e [sorgente Markdown](../legal/HO-060-approvazione-rischio-residuo-DR-385.md).
Comprende la descrizione del rischio, le misure da attuare e verificare, le alternative e
la dichiarazione qui sotto, con spazio per ruolo, eventuale delega, data e firma.
È un modello da compilare: la sua preparazione non chiude l'handoff né vale come approvazione.
Conservare l'esemplare compilato fuori dal repository, come previsto al §4.

> Il Centro per la Famiglia Amoris Laetitia, titolare del trattamento, ha letto la descrizione
> del rischio contenuta nel documento HO-060 (§3). Approva che, per la Fase 1 del nuovo sito, i
> dati delle compilazioni dei moduli, lo storico delle email dei moduli, gli account dell'area
> amministrativa e i file caricati siano conservati sul server **senza cifratura a riposo**,
> fermo restando che i backup sono cifrati, il trasporto avviene con HTTPS, l'accesso all'area
> amministrativa richiede il secondo fattore e l'accesso al server è ristretto al manutentore.
> Accetta il rischio residuo descritto, per la sola Fase 1, con riesame prima della fase
> gestionale o prima di trattare categorie di dati diverse da quelle descritte.
>
> Luogo e data: ____________ Ruolo: ____________ Firma: ____________

## 6. Se qualcosa va storto

| Situazione | Che cosa fare |
|---|---|
| La persona che approva vuole il parere del professionista | Inoltra al professionista di MI-06 il §3 e la domanda 12 del parere; attendi la sua risposta prima della firma |
| Il Centro chiede modifiche al testo | Riporta all'agente le modifiche richieste: se cambiano la sostanza del rischio, la decisione D272 si riapre |
| Il Centro non approva | Scrivi all'agente «HO-060: rischio di DR-385 non approvato»; la decisione si ripresenta con le opzioni A e B |
| Non è chiaro chi possa approvare | Chiedi al Centro chi ha la rappresentanza legale o una delega privacy scritta; non procedere con un'approvazione di chi non ne ha titolo |

## 7. Come segnalare il completamento

Con la riga del §4, punto 4, nella sessione dell'agente. Non servono allegati.
