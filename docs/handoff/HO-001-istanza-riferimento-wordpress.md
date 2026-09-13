# HO-001 — Istanza WordPress di riferimento per la parità visiva

**Fase:** serve dalla 1A (verifica del rendering) e diventa indispensabile in 1E
(visual diff). **Stato:** in attesa di tua decisione.

---

## 1. Perché serve

La parità pixel-perfect (DR-014) si prova confrontando immagini: per ogni URL
servono uno screenshot **sorgente** e uno screenshot **nuovo**, alla stessa
viewport, con lo stesso browser, e una differenza misurata.

Gli screenshot sorgente devono venire da qualcosa che **renda** le pagine. Il
backup che mi hai dato contiene i file e il database, ma non li renderizza: il tema
Divi 4.18 costruisce le pagine a partire da shortcode elaborati da PHP e poi
completati in JavaScript. Senza un WordPress in esecuzione, gli screenshot sorgente
non esistono.

Il sito online c'è, ma da solo non basta come riferimento: può cambiare durante lo
sviluppo (e lo farà, perché resta in produzione per mesi), e ogni sua modifica
invaliderebbe confronti già approvati.

---

## 2. Cosa ho già verificato, così non devi controllarlo tu

| Verifica | Esito |
|---|---|
| Il backup del 2026-09-13 è un'installazione WordPress completa | sì — 21.350 file, 875 MB, `wp-admin`, `wp-content`, `wp-includes`, `wp-config.php` |
| Versione WordPress del backup | **7.1** (i documenti storici dicevano 6.9: il sito è stato aggiornato) |
| Tema | Divi 4.18.0, nessun child theme |
| Plugin presenti | 18, coincidono con quelli dichiarati attivi |
| Media | 1.546 file, **2017–2026** — il backup di marzo si fermava al 2021 |
| Dump del database | 11,6 MB, 53 tabelle, stesso schema del dump di marzo |
| Docker su questa macchina | presente — Docker 29.7.2, Compose v5.5.0 |

**Conclusione: non devi installare né PHP né MySQL.** Docker basta e avanza.

---

## 3. Le tue opzioni

### Opzione A — la costruisco io in Docker *(raccomandata)*

Preparo un `docker-compose.reference.yml` fuori dal runtime del progetto, con
un'immagine PHP-Apache e una MySQL o MariaDB, monto il backup in sola lettura e
carico il dump in un volume locale. Poi congelo l'istanza: da quel momento è il
riferimento immutabile per tutta la Fase 1E.

**La tua azione si riduce a una riga di approvazione.** Nessun comando da eseguire.

### Opzione B — la avvii tu con un tuo stack PHP/MySQL

Percorribile ma sconsigliata: dovresti replicare a mano versione di PHP,
estensioni, permessi e configurazione, e ogni scostamento dalla produzione
falserebbe gli screenshot sorgente. Se la scegli, le istruzioni sono al §6.

### Opzione C — solo il sito online

Più rapido, ma il riferimento non è congelato. Lo userei comunque come controprova
su un campione di pagine, **in aggiunta** ad A, mai al posto suo.

---

## 4. Cosa devi approvare esplicitamente (Opzione A)

Sono tre cose distinte. Servono tutte e tre.

1. **Avviare in locale un container con MySQL o MariaDB e PHP.** Non contraddice il
   divieto di dipendenze WordPress a runtime: è uno strumento di test, temporaneo,
   che non entra nel prodotto finale né nel `docker-compose.yml` del progetto.
2. **Caricare il dump reale in quel container.** Il dump contiene dati personali:
   utenti, compilazioni dei form, commenti, log di invio email. Il container resta
   sulla tua macchina, non si espone in rete, non si committa, e si distrugge alla
   fine della Fase 1E.
3. **Che il container non invii email né chiami servizi esterni.** Lo configuro per
   non farlo, ma è bene che sia una tua decisione consapevole: un WordPress avviato
   con la configurazione di produzione potrebbe altrimenti tentare invii reali.

---

## 5. Credenziali di amministrazione: non servono

Mi hai offerto le password dell'amministrazione. **Non mi servono, e preferisco non
averle.**

Con il backup completo dei file più il dump del database ho già tutto ciò che
l'amministrazione mostrerebbe: impostazioni, menu, SEO, redirect, configurazione
dei plugin, contenuti non pubblicati. Le leggo direttamente dalle tabelle, senza
autenticarmi da nessuna parte.

Del sito online mi basta la parte pubblica, in sola lettura, che è già autorizzata
da DR-016.

Se in Fase 1A trovassi qualcosa di visibile **solo** dall'amministrazione e non
ricavabile dal dump, te lo chiederei allora, per quel singolo punto, spiegando
perché. Non prima.

---

## 6. Istruzioni passo passo — solo se scegli l'Opzione B

**Prerequisiti:** PHP 8.1 o superiore con le estensioni `mysqli`, `gd`, `mbstring`,
`xml`, `zip`, `curl`; MySQL 5.7+ o MariaDB 10.4+; ~1 GB di spazio libero.

1. **Copia il backup** in una cartella di lavoro, senza toccare l'originale.
   Su PowerShell:
   ```powershell
   Copy-Item -Recurse "C:\work\CentroAmorisLaetitia\source-private\wordpress-2026-09-13" "C:\wp-reference"
   ```

2. **Crea il database** e importa il dump:
   ```powershell
   mysql -u root -p -e "CREATE DATABASE wpref CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p wpref < "C:\work\CentroAmorisLaetitia\source-private\BackupDB-2026-09-13\Sql1138799_1.sql"
   ```

3. **Aggiorna `C:\wp-reference\wp-config.php`** con nome database, utente e password
   del tuo MySQL locale. Aggiungi in fondo, **prima** della riga
   `require_once ABSPATH . 'wp-settings.php';`:
   ```php
   define('WP_HOME', 'http://localhost:8080');
   define('WP_SITEURL', 'http://localhost:8080');
   define('DISABLE_WP_CRON', true);
   define('AUTOMATIC_UPDATER_DISABLED', true);
   define('WP_MAIL_SMTP_DISABLE', true);
   ```
   Le ultime tre righe servono a impedire che l'istanza invii email, si aggiorni da
   sola o esegua job pianificati.

4. **Avvia il server** sulla porta 8080:
   ```powershell
   php -S localhost:8080 -t C:\wp-reference
   ```

5. **Verifica** aprendo `http://localhost:8080`. Esito atteso: la homepage si carica
   con la grafica del sito reale.

6. **Segnalami** che è attiva, indicando la porta.

**Se fallisce:**

| Sintomo | Causa più probabile |
|---|---|
| Pagina bianca | Estensione PHP mancante — controlla `php -m` |
| «Error establishing a database connection» | Credenziali in `wp-config.php` non allineate al tuo MySQL |
| Grafica assente, solo testo | `WP_HOME`/`WP_SITEURL` non impostati sulla porta giusta |
| Redirect verso `www.centroamorislaetitia.it` | Le stesse due costanti non hanno avuto effetto: verifica di averle messe **prima** di `wp-settings.php` |

Incollami l'errore così com'è: non serve che lo interpreti.

---

## 7. Cosa faccio dopo la tua risposta

1. Costruisco (Opzione A) o collego (Opzione B) l'istanza di riferimento.
2. Verifico su 3 pagine campione che il rendering locale coincida con quello
   online: se divergono, te lo dico prima di andare avanti, perché in quel caso il
   riferimento locale non è valido.
3. Congelo l'istanza e proseguo con la Fase 1A.
4. In Fase 1B fisso viewport, versioni di browser e soglie di diff, e te le
   sottopongo prima di usarle.

---

## 8. Come segnalare il completamento

`HO-001: opzione A` — oppure `opzione B, istanza su porta <n>`, o `opzione C`.
