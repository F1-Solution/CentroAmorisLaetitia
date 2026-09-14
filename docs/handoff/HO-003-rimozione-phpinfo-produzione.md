# HO-003 — Rimuovere la pagina `phpinfo()` dal sito in produzione

| | |
|---|---|
| **Fase** | 1B |
| **Origine** | rischio R-17, rilevato nella wave `1B-W0` |
| **Urgenza** | media — non blocca la Fase 1B, ma va fatto prima del passaggio in produzione |
| **Chi la esegue** | tu, sull'hosting del Centro. Io non ho accesso in scrittura al sito |

---

## 1. Che cosa ho trovato

Nel rispondere a HO-002 mi hai indicato una pagina del sito in produzione da cui
leggere i valori di ambiente. Quella pagina è un **`phpinfo()` completo**,
raggiungibile da chiunque, senza password.

`phpinfo()` non espone la password del database, ma espone:

- i **percorsi assoluti** del server e della cartella del sito;
- le opzioni con cui PHP è stato compilato e l'elenco completo delle estensioni
  installate, **con le rispettive versioni**;
- la configurazione di sessione, di upload, di gestione errori;
- le **variabili di ambiente** del processo web.

Serve a un attaccante per sapere esattamente quali vulnerabilità note provare, senza
tentativi a vuoto. È una delle prime cose che uno scanner automatico cerca.

Non ho copiato nulla di quel contenuto nella documentazione del progetto, oltre ai
valori che servivano a chiudere l'input mancante MI-03: versione di PHP, versione
del database, limiti di runtime.

## 2. Cosa ti chiedo di fare

**Cancellare il file dal sito in produzione.** È il nome file che mi hai indicato,
nella cartella radice del sito.

### Opzione A — dal pannello dell'hosting (consigliata)

1. Entra nel pannello di controllo dell'hosting.
2. Apri il **gestore file** e vai nella cartella radice del sito, quella che
   contiene `wp-config.php`, `wp-content`, `wp-admin`.
3. Individua il file `ver.php`.
4. **Prima di cancellarlo**, scaricalo sul tuo computer se vuoi conservarne una
   copia. Non serve al progetto: i valori li ho già.
5. Cancellalo.

### Opzione B — via FTP o SFTP

1. Collegati con il tuo client FTP abituale.
2. Vai nella cartella radice del sito.
3. Cancella `ver.php`.

### Se preferisci tenerlo per consultarlo in futuro

Va bene, ma non pubblico. Due strade, in ordine di preferenza:

1. **Rinominarlo non basta.** Un nome diverso resta indovinabile e gli scanner
   provano centinaia di nomi. Non è una protezione.
2. **Proteggerlo con password** creando un `.htaccess` nella sua cartella. Se
   scegli questa strada dimmelo e ti preparo i due file da caricare, con la
   password generata da te e mai scritta qui.

La strada più semplice e più sicura resta cancellarlo e, se un domani ti servisse
di nuovo, ricrearlo per il tempo necessario e rimuoverlo subito dopo.

## 3. Come verifico che è fatto

Apri un browser in **finestra anonima** — importante, perché la cache può ingannare —
e visita l'indirizzo della pagina.

| Esito | Significato |
|---|---|
| Pagina di errore 404 del sito | ✅ fatto correttamente |
| Ancora la tabella viola con «PHP Version 7.4.33» | ❌ il file è ancora lì, o è rimasta una copia in cache |
| Richiesta di nome utente e password | ✅ accettabile, se hai scelto la protezione con `.htaccess` |

Se vedi ancora la pagina dopo averla cancellata, attendi qualche minuto: alcuni
hosting mantengono una cache di pagina. Se dopo dieci minuti persiste, il file non è
stato cancellato o ne esiste una seconda copia.

## 4. Cosa fare se qualcosa va storto

| Problema | Cosa fare |
|---|---|
| Non trovi il file nella radice | Cercalo dal gestore file per nome `ver.php` in tutto il sito: potrebbe essere in una sottocartella |
| Il gestore file non ti fa cancellare | Segnalamelo: può essere un problema di permessi del file, si risolve dal pannello |
| Hai cancellato il file sbagliato | Il sito non deve risentirne: `ver.php` non è un file di WordPress. Se qualcosa si è rotto, scrivimelo subito con il messaggio d'errore |
| Dopo la cancellazione il sito dà errore | Improbabile. Se accade, incolla il messaggio: nessun file di WordPress dipende da questo |

## 5. Cosa non ti sto chiedendo

- Non ti sto chiedendo di cambiare password.
- Non ti sto chiedendo di toccare `wp-config.php`, che non ho letto nelle sue parti
  riservate e che non va aperto senza necessità.
- Non ti sto chiedendo di aggiornare PHP: la versione 7.4 è fuori supporto, ma
  aggiornarla adesso rischia di rompere il sito attuale, che deve restare in piedi e
  identico fino al passaggio. Il tema si affronta in Fase 1F, non ora.

## 6. Come segnalarmi il completamento

Nel prompt successivo scrivi:

```
HO-003: fatto
```

oppure, se hai scelto un'altra strada:

```
HO-003: protetto con password anziché cancellato
```

Se vuoi che ti prepari i file per la protezione con password, scrivi
`HO-003: voglio proteggerlo, preparami i file`.
