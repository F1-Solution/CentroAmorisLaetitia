# HO-002 — Rilevare la versione PHP del server di produzione

**Fase:** 1B · **Stato:** in attesa · **Blocca:** nulla, ma serve per riproducibilità
· **Tempo richiesto:** 2 minuti

---

## 1. Perché serve

L'istanza di riferimento gira su **PHP 8.2** e rende in modo identico al sito online
sulle pagine campione, quindi non c'è un problema aperto. Ma se in Fase 1E emergesse
una difformità non spiegabile, la versione di PHP sarebbe una delle prime cose da
escludere, e a quel punto vorrei saperla già.

Dal backup non è deducibile: `.user.ini` non la riporta.

---

## 2. Istruzioni

Basta una delle due strade.

### Strada A — dall'amministrazione WordPress

1. Accedi a `https://www.centroamorislaetitia.it/wp-admin`.
2. Menu di sinistra → **Strumenti** → **Salute del sito**.
3. Scheda **Informazioni** in alto.
4. Apri la sezione **Server**.
5. Copia il valore della riga **Versione PHP** (per esempio `8.1.29`).

### Strada B — dal pannello dell'hosting

Nel pannello del provider cerca una voce «Versione PHP», «PHP Selector» o
«Impostazioni PHP» per il dominio `www.centroamorislaetitia.it`.

---

## 3. Cosa mi serve

Solo la stringa di versione, per esempio `PHP 8.1.29`.

Mentre sei in quella schermata, se ti capita sott'occhio, mi è utile anche la
versione di **MySQL o MariaDB** indicata nella sezione **Database**: mi conferma che
MariaDB 10.11 usata nell'istanza di riferimento è allineata.

---

## 4. Cosa non mi serve

Nessuna credenziale, nessuno screenshot dell'intera pagina, nessun altro dato di
quella schermata. Se trovi più semplice incollare l'intero blocco «Server», togli
prima percorsi assoluti e nomi utente.

---

## 5. Come segnalare il completamento

`HO-002: PHP <versione>` — e, se l'hai vista, `DB <versione>`.

Se la sezione non è raggiungibile o la voce non c'è, scrivimelo: l'istanza attuale
resta valida e la questione decade.
