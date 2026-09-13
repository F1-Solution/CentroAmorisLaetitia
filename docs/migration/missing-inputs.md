# Input mancanti — Fase 1A, wave 1A-W5

Cosa non si ricava dalla sorgente e serve per proseguire. Per ogni voce: chi la
fornisce, entro quando, e cosa si blocca se manca.

Le voci marcate **AZIONE UTENTE** hanno o avranno un documento in `docs/handoff/`.

---

## 1. Bloccanti per la Fase 1B

### MI-01 — Comportamento dei form nella Fase 1 · **AZIONE UTENTE**

25 form WPForms compaiono nelle pagine pubbliche. Il form builder appartiene alla
fase gestionale, ma le pagine che li contengono devono superare la parità adesso.

Serve la tua decisione fra: form resi ma disabilitati con messaggio esplicito; form
minimale che recapita per email; pagina che rimanda a un contatto esistente.

*Blocca:* la ricostruzione di 15 pagine di registrazione ai corsi più contatti e
iscrizione soci. *Termine:* Fase 1B.

### MI-02 — Destinazione dei 4 documenti dell'area riservata

`WP Customer Area` è **disattivato**, ma restano 4 `cuar_private_file`. Non sono
raggiungibili dal sito pubblico.

Serve sapere se quei documenti debbano riemergere da qualche parte, o restare
inaccessibili fino alla fase gestionale. Non ho aperto i file: sono contenuti
riservati.

*Blocca:* nulla in Fase 1 — è già deciso che l'area riservata non si riproduce.
Serve però che la scelta sia dichiarata, non implicita. *Termine:* Fase 1B.

### MI-03 — Versione PHP di produzione

Non è deducibile dal backup. L'istanza di riferimento usa **PHP 8.2** e rende in
modo identico al sito online sulle pagine campione, quindi non è un problema aperto;
va però registrata per riproducibilità.

Si ricava da una riga dell'amministrazione WordPress (Strumenti → Salute del sito →
Informazioni → Server) oppure dal pannello dell'hosting.

*Blocca:* nulla. *Termine:* prima della chiusura della Fase 1B.

---

## 2. Bloccanti per la Fase 1F

### MI-04 — Provider, dominio e costi · **AZIONE UTENTE**

Decisione D6 del Round 1, ancora aperta. Serve sapere: quale VPS, chi è il
registrar del dominio, se e come usare Cloudflare, chi sostiene i costi ricorrenti,
e dove risiedono fisicamente i dati — che con dati personali di questo tipo non è un
dettaglio.

*Blocca:* l'intera Fase 1F. *Termine:* prima dell'inizio della 1F.

### MI-05 — Restrizione e rotazione della chiave Google Maps · **AZIONE UTENTE**

La chiave è in chiaro nell'HTML pubblico e va limitata per referrer e ruotata prima
del passaggio al nuovo dominio. È un'operazione sull'account Google del Centro: non
posso farla io.

*Blocca:* nulla adesso; va fatta prima della messa in produzione. *Termine:* 1F.

### MI-06 — Verifica privacy e legale · **AZIONE UTENTE**

Conseguenza diretta della decisione di importare tutti i dati senza bonifica
(DR-025). Prima della produzione servono, validati da un professionista: base
giuridica del trattamento delle 425 compilazioni di form; informativa; tempi di
conservazione; procedura di cancellazione; conformità del banner cookie.

Non posso dichiarare alcuna conformità: posso solo predisporre i controlli tecnici
una volta che le regole sono state definite da chi può definirle.

*Blocca:* la messa in produzione. *Termine:* 1F.

### MI-07 — Accesso al sito in produzione per il delta finale · **AZIONE UTENTE**

La sorgente è congelata al 2026-09-13, ma il sito resta vivo. Prima del passaggio
serve un backup aggiornato, per importare ciò che è stato pubblicato nel frattempo.

*Blocca:* il passaggio in produzione. *Termine:* 1F.

---

## 3. Non bloccanti, da chiarire

### MI-08 — Difformità visive accettabili

Alcuni elementi non hanno senso da riprodurre: Universal Analytics, il banner
cookie servito da CDN esterno, i riferimenti a Elegant Themes. Sono modifiche
dichiarate, non difformità silenziose, e come tali vanno approvate da te in Fase 1E.

*Termine:* UAT di Fase 1E.

### MI-09 — Testi non recuperabili dalla sorgente

Non risulta alcuna pagina con contenuto mancante: solo **1 pagina pubblicata** ha
meno di 50 caratteri di contenuto. Se in Fase 1E emergesse testo oggi reso da widget
dinamici e non presente a database, servirà che tu lo fornisca.

*Termine:* 1E, se e quando si presenta.

### MI-10 — Priorità di parità per gli allegati

`url-matrix.csv` marca a priorità bassa le 170 pagine allegato: sono redirect a un
file, senza aspetto proprio. Se preferisci che anche quelli entrino nel perimetro
formale di parità, va detto ora, perché cambia il numero di URL da confrontare da
**123** a **293**.

*Termine:* Fase 1B, prima della definizione dei criteri di accettazione.

---

## 4. Riepilogo

| # | Input | Chi | Termine | Blocca |
|---|---|---|---|---|
| MI-01 | Comportamento dei form in Fase 1 | utente | 1B | 15+ pagine |
| MI-02 | Destinazione dei 4 documenti riservati | utente | 1B | nulla, ma va dichiarato |
| MI-03 | Versione PHP di produzione | utente | 1B | nulla |
| MI-04 | Provider, dominio, costi | utente | 1F | tutta la 1F |
| MI-05 | Chiave Google Maps | utente | 1F | produzione |
| MI-06 | Verifica privacy e legale | professionista | 1F | produzione |
| MI-07 | Backup aggiornato per il delta | utente | 1F | passaggio |
| MI-08 | Difformità accettabili | utente | 1E | UAT |
| MI-09 | Testi non recuperabili | utente | 1E | se si presenta |
| MI-10 | Perimetro di parità degli allegati | utente | 1B | criteri di accettazione |
