# HO-005 — Proteggere con password la pagina di diagnostica

| | |
|---|---|
| **Fase** | 1C |
| **Origine** | risposta a [HO-003](HO-003-rimozione-phpinfo-produzione.md), registrata come **DR-042** |
| **Urgenza** | media — non blocca nulla del progetto, ma il file oggi è pubblico |
| **Chi la esegue** | tu, sull'hosting del Centro. Io non ho accesso in scrittura al sito |
| **Tempo stimato** | 15 minuti |
| **File pronti** | [`files/HO-003/htaccess`](files/HO-003/htaccess) e [`files/HO-003/htpasswd`](files/HO-003/htpasswd) |

> **Chiusa il 2026-09-15.** DR-049.

---

## 1. Prima di tutto: una cosa che devi sapere

Hai chiesto i due file da caricare. Te li do, ma con un avvertimento che conta più
dei file stessi.

**Non caricare il file `.htaccess` nella cartella radice del sito.** Lì ce n'è già
uno, di WordPress, che contiene le regole con cui funzionano tutti gli indirizzi
delle pagine. Sovrascriverlo manda il sito in errore 404 su ogni pagina.

Per questo il metodo che ti propongo sposta prima `ver.php` in una **cartella
nuova, tutta sua**. Così i due file finiscono in una cartella vuota, non c'è niente
da sovrascrivere, e se sbagli qualcosa il danno è confinato a quella cartella.

Se preferisci non spostare il file, al §7 c'è la strada alternativa: aggiungere
poche righe all'`.htaccess` esistente, senza sostituirlo.

> **Nota, una volta sola.** Proteggere con password è meno sicuro che cancellare:
> il file resta sul server e la protezione vale finché la configurazione regge. Il
> rischio **R-17** passa da «alto» a «basso», non sparisce. Quando la Fase 1F
> porterà il sito nuovo in produzione, il vecchio `ver.php` sparirà da sé.

---

## 2. Passo 1 — Generare la riga con la tua password

La password la scegli tu e **non la scrivi mai** in nessun file di questo progetto,
né me la mandi. Quello che serve è la sua forma cifrata.

Hai tre strade. La prima è la più semplice se il tuo hosting la offre.

### Strada A — dal pannello dell'hosting (se c'è, usa questa)

Molti pannelli hanno una voce chiamata **«Protezione directory»**, **«Directory
Privacy»** o **«Password protect directories»**. Se c'è:

1. Crea la cartella `diagnostica` (passo 2 qui sotto) e spostaci `ver.php`.
2. Apri quella voce del pannello, seleziona la cartella `diagnostica`, attiva la
   protezione e crea un utente con la tua password.
3. **Hai finito.** Il pannello scrive da sé i due file. Salta i passi 3 e 4 e vai
   direttamente alla verifica del §6.

### Strada B — generare la riga sul tuo computer con Docker

Docker è già installato sulla tua macchina. Apri un terminale e scrivi, sostituendo
`METTI-QUI-LA-TUA-PASSWORD` con la password che hai scelto:

```
docker run --rm httpd:2.4 htpasswd -nbB centro "METTI-QUI-LA-TUA-PASSWORD"
```

Stampa una riga simile a questa — la tua sarà diversa:

```
centro:$2y$05$esempio.non.valido.di.hash.bcrypt.che.non.apre.niente
```

**Quella riga è ciò che serve.** `centro` è il nome utente: se ne vuoi un altro,
cambialo nel comando.

> Se `-nbB` dà errore, o se il tuo hosting usa Apache 2.2, usa `-nbm` al suo posto:
> è più vecchio ma funziona ovunque.
>
> Il comando scrive la password nella cronologia del terminale. Se la cosa ti dà
> fastidio, dopo averlo eseguito chiudi il terminale e svuota la cronologia.

### Strada C — nessuna delle due

Se non hai il pannello e non vuoi usare Docker, dimmelo e ti indico un'altra strada.
**Non usare i generatori online**: significherebbe consegnare la password a un sito
di cui non sai nulla.

---

## 3. Passo 2 — Creare la cartella e spostare `ver.php`

Dal gestore file del pannello, oppure via FTP:

1. Vai nella cartella radice del sito, quella che contiene `wp-config.php`,
   `wp-content`, `wp-admin`.
2. Crea una cartella nuova chiamata **`diagnostica`**.
3. **Sposta** `ver.php` dentro `diagnostica`. Non copiarlo: spostalo, altrimenti
   la copia nella radice resta pubblica e non hai protetto niente.

Da questo momento l'indirizzo della pagina diventa
`https://www.centroamorislaetitia.it/diagnostica/ver.php`.

---

## 4. Passo 3 — Trovare il percorso assoluto della cartella

Serve per una riga del file `.htaccess`. È il percorso che il server vede, non
l'indirizzo web: qualcosa come `/home/nomeaccount/public_html/diagnostica`.

Come trovarlo, in ordine di comodità:

| Dove | Come |
|---|---|
| Gestore file del pannello | di solito lo mostra in alto, nella barra del percorso, mentre sei dentro la cartella |
| Pannello, sezione informazioni | cerca «Document root» o «Percorso home» e aggiungi `/diagnostica` |
| La pagina `ver.php` stessa | è ancora raggiungibile: cerca nella tabella la riga **`DOCUMENT_ROOT`** e aggiungi `/diagnostica`. Falla adesso, prima di proteggerla |

---

## 5. Passo 4 — Preparare e caricare i due file

### File 1 — `.htaccess`

1. Apri [`files/HO-003/htaccess`](files/HO-003/htaccess).
2. Sostituisci `/PERCORSO/ASSOLUTO/DA/SOSTITUIRE/.htpasswd` con il percorso trovato
   al passo 3, seguito da `/.htpasswd`. Per esempio:
   `AuthUserFile /home/nomeaccount/public_html/diagnostica/.htpasswd`
3. Carica il file nella cartella `diagnostica` **rinominandolo `.htaccess`**, con il
   punto davanti e senza estensione.

### File 2 — `.htpasswd`

1. Apri [`files/HO-003/htpasswd`](files/HO-003/htpasswd).
2. Sostituisci la riga `SOSTITUISCI-QUESTA-RIGA-CON-QUELLA-GENERATA-DA-TE` con la
   riga ottenuta al passo 1.
3. Carica il file nella cartella `diagnostica` **rinominandolo `.htpasswd`**.

> Su Windows i nomi che iniziano con un punto danno spesso fastidio: per questo i
> due file nel repository si chiamano `htaccess` e `htpasswd`, senza punto. La
> rinomina si fa **dopo** il caricamento, dal gestore file del pannello, che non ha
> quel problema.

---

## 6. Come verifico che è fatto

Apri il browser in **finestra anonima** — importante, perché una sessione già
autenticata o la cache ti farebbero vedere la pagina comunque — e visita
`https://www.centroamorislaetitia.it/diagnostica/ver.php`.

| Esito | Significato |
|---|---|
| Una finestrella che chiede nome utente e password | ✅ fatto. Provali: devono funzionare |
| La tabella viola con «PHP Version 7.4.33», senza password | ❌ la protezione non è attiva. Vedi §8 |
| **Errore 500** | ❌ quasi sempre è il percorso di `AuthUserFile` sbagliato. Vedi §8 |
| Errore 404 | il file non è in quella cartella: controlla dove l'hai spostato |

Poi verifica anche il vecchio indirizzo, `https://www.centroamorislaetitia.it/ver.php`:
deve rispondere **404**. Se risponde ancora con la tabella viola, il file è stato
copiato e non spostato, e la copia pubblica va cancellata.

E un ultimo controllo, che vale la pena: prova a scaricare
`https://www.centroamorislaetitia.it/diagnostica/.htpasswd`. Deve dare **403** o
**404**, mai mostrare del testo.

---

## 7. Strada alternativa — senza spostare il file

Se preferisci lasciare `ver.php` dov'è, **non sostituire** l'`.htaccess` della
radice: scaricalo, tienine una copia di sicurezza sul tuo computer, e aggiungi
queste righe **in cima**, prima della riga `# BEGIN WordPress`.

```
<Files "ver.php">
    AuthType Basic
    AuthName "Area riservata"
    AuthUserFile /PERCORSO/ASSOLUTO/DA/SOSTITUIRE/.htpasswd
    Require valid-user
</Files>
```

Il file `.htpasswd` va comunque caricato, nella radice, preparato come al §5.

Perché non la consiglio: si lavora sul file che tiene in piedi tutti gli indirizzi
del sito, e WordPress a volte lo riscrive da solo fra i marcatori
`# BEGIN WordPress` e `# END WordPress`. Mettendo il blocco **prima** del marcatore
si evita il problema, ma il rischio di un errore di battitura resta, e il suo
effetto è il sito offline.

---

## 8. Cosa fare se qualcosa va storto

| Problema | Cosa fare |
|---|---|
| **Errore 500 sulla sola cartella** | Nove volte su dieci è `AuthUserFile` con un percorso sbagliato. Ricontrolla il passo 3. Se non ne vieni a capo, rinomina `.htaccess` in `htaccess-off`: la cartella torna a funzionare subito e riproviamo con calma |
| **Errore 500 su tutto il sito** | Hai toccato l'`.htaccess` della radice. Ripristina la copia di sicurezza. Se non l'hai fatta, scrivimelo: le regole standard di WordPress si riscrivono in due minuti |
| La password non viene accettata | La riga del passo 1 è incompleta o spezzata su due righe. Rigenerala e incollala tutta su una riga sola, senza spazi |
| Chiede la password ma poi dà 500 | Il modulo di autenticazione non è attivo sull'hosting. Segnalamelo: si risolve diversamente |
| Non chiede niente e la pagina si vede | L'hosting ignora i file `.htaccess`. Capita con alcuni server: in quel caso l'unica strada vera è cancellare `ver.php` |

**In ogni caso: se il sito si rompe, la via d'uscita è sempre la stessa** —
rinominare o cancellare il file `.htaccess` che hai appena caricato. Non serve
altro, e il sito torna com'era.

---

## 9. Cosa non ti sto chiedendo

- Non ti sto chiedendo di dirmi la password. Non deve arrivarmi, e se me la mandassi
  dovrei chiederti di cambiarla.
- Non ti sto chiedendo di toccare `wp-config.php`.
- Non ti sto chiedendo di aggiornare PHP: vale ancora quanto scritto in HO-003 §5.

---

## 10. Come segnalarmi il completamento

Nel prompt successivo scrivi una di queste:

```
HO-005: fatto, la pagina chiede la password
HO-005: fatto dal pannello con la protezione directory
HO-005: non ci sono riuscito, ecco cosa è successo: ...
HO-005: ci ho ripensato, l'ho cancellato
```

L'ultima resta la risposta migliore, e chiude del tutto il rischio R-17.
