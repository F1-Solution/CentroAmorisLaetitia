# Verifica del backup e del ripristino (1F-W3)

**Stato:** prova **locale**, con dati sintetici, chiusa il 2026-11-07. Non prova il server, la
Storage Box né le chiavi vere: quelle si provano nella `1F-W5` (§8). Questo documento non
dichiara alcuna conformità GDPR o fiscale: serve la validazione umana (MI-06).

**Riferimenti:** ADR-009 §4.5 e §9; DR-366…DR-373, DR-378…DR-381; piano `W3-PLAN.md`.
Istruzioni d'uso: `infra/deploy/README.md` §8.

## 1. Che cosa si è provato

Un servizio `backup` copia database e oggetti in un repository restic cifrato, via SFTP, e un
ripristino riporta lo stesso contenuto su uno stack con volumi nuovi.

| Criterio | Esito |
|---|---|
| W3-1 immagine fissata, utente non `root`, controllata | provato (T1) |
| W3-2 dump coerente, ripristinabile su database vuoto | provato (T2, T3, T6) |
| W3-3 i due bucket copiati, anche l'oggetto da 0 byte | provato (T2, T6) |
| W3-4 repository cifrato, nessuna stringa nota in chiaro | provato (T5) |
| W3-5 conservazione | provato con la regola 7/4 di DR-379 (T5, riscritta nella T8) |
| W3-6 esito registrato, uscita diversa da 0 a ogni errore | provato (T2, T7) |
| W3-7 ripristino completo senza differenze | provato (T6) |
| W3-8 trasporto SFTP | provato contro un server **di prova** (T6) |
| W3-9 nessun segreto in immagine, log o Git | provato (T2, T4) |
| W3-10 memoria sotto 7 GiB | provato sul Compose (T4) |

## 2. Metodo

- Tutto in locale, nessun dato reale, nessun server. Chiavi e password sono **di prova**,
  generate per la prova e fuori da Git.
- Destinazione SFTP: contenitore di prova, solo per le prove (DR-370, DR-378), con chiavi
  generate dalla prova. Non fa parte del Compose né della CI di pubblicazione.
- Ogni attività ha scritto la prova prima del codice: prova rossa, poi verde. Le prove
  d'infrastruttura chiamano `docker` con processi reali; due esecuzioni insieme danno falsi
  rossi, quindi si lanciano una alla volta.
- La prova di ripristino (T6) usa uno stack di produzione locale completo, con il progetto
  Compose `amoris-production`, non uno stack ridotto.

## 3. Versioni

| Elemento | Versione |
|---|---|
| Base dell'immagine | `postgres:17.11-alpine`, fissata per digest (`sha256:562a6e0a…`), la stessa del `db` del Compose |
| `pg_dump`, `pg_restore`, `psql` | 17.x, dalla base |
| restic | 0.19.1, binario ufficiale con SHA-256 della release verificato alla build |
| `mc` | copiato dall'immagine Chainguard `minio-client`, fissata per digest (`sha256:5feb4dcc…`) |
| Client `ssh` | `openssh-client-default` 10.3_p1-r2 (Alpine 3.24); il pacchetto è fissato alla versione |
| Server SFTP di prova | `openssh-server` 10.3_p1-r2 sulla stessa base, solo per le prove |
| Utente del servizio | `backup`, uid 10003, non `root` |
| Dimensione dell'immagine | 517 MB |
| Controllo dei file (`check-image.mjs`) | 3920 voci, nessun file vietato, nessuna chiave o file d'ambiente |

## 4. Esiti delle prove, per attività

| Att. | Prove | Rosse prima | Esito |
|---|---|---|---|
| T1 immagine | prove dei Dockerfile e della CI, 41; 7 sull'immagine | 9 su 41; le 7 dell'immagine non partivano | verdi |
| T2 backup | `backup-1f`: 25 | 22 su 25 | 25/25 |
| T3 ripristino | `ripristino-1f`: 16 | 13 su 16 | 16/16 |
| T4 Compose | `compose-1f`: 47; `env-example-1f`: 13 | 14 su 48; 2 su 14 | 47/47 e 13/13 |
| T5 conservazione e cifratura | `conservazione-1f`: 10, con 3 mutazioni rosse (1 su 10 ciascuna) e 1 mutazione rossa sulla cifratura | sì | 10/10, 87 s |
| T7 revisione | `backup-1f` sale a 37 casi; correzione di 1 rilievo alto e 4 medi, più i bassi | sì, per ognuno | verdi |
| T8 conservazione 7/4 (DR-379) | `backup-1f` e `conservazione-1f`: 48; mutazioni `--keep-monthly 6` e `--keep-weekly 3` rosse (2 prove ciascuna), `--keep-daily 6` rossa sull'argomento esatto | 2 su 48 | 48/48; `test:images` 213/213 |

Note:

- I conteggi sono quelli dichiarati nel piano alla chiusura di ogni attività; il file
  `backup-1f.test.ts` ha oggi 37 casi dopo la revisione di T7.
- Il rifiuto di un ripristino su destinazione piena (65) è coperto da `ripristino-1f`; non è
  stato rifatto nella prova completa di T6.
- Verifica come la CI, il 2026-11-07: `install --frozen-lockfile`, lint, Prettier sui file di Git,
  typecheck, build, test di tutti i pacchetti (280 file, 3130 prove), `db:verify`, copertura
  93,64 % delle righe, e2e 69/69; `test:images` 213/213.

### Difetti trovati e corretti nella revisione di T7

| Rilievo | Correzione |
|---|---|
| Stato non scrivibile: l'esito andava perso | scrittura di prova all'avvio, passo `state_write`, codice 74 |
| Uscite senza riga di esito (errore imprevisto, SIGTERM) | riga di esito `unexpected` con il codice; `init: true` nel Compose |
| Due esecuzioni insieme | blocco esclusivo non bloccante, codice 75 |
| Istantanea senza identificativo | l'esecuzione fallisce |
| Valori di host e tempo di collegamento non validi | rifiutati con codice 78 |

## 5. Prova di ripristino completo (T6)

Eseguita il 2026-11-07. Dati sintetici, stack locale; i numeri sono di una prova **piccola**.

**Riferimento.** 34 tabelle (schemi `public` e `drizzle`, 12 migrazioni), 75 righe in tutto;
estensioni `citext` 1.6, `pgcrypto` 1.3, `unaccent` 1.1 e `plpgsql` 1.0; 9 oggetti (5
pubblici, 4 riservati) di cui uno da 3 MiB, uno da 68 KiB, uno da 1 byte, uno da **0 byte**,
uno con spazi nel nome e uno in un percorso annidato; SHA-256 e dimensione di ognuno.

**Sequenza.**

1. Stack di produzione locale: `up -d --wait`, `migrate`, seme sintetico, oggetti aggiunti.
2. Server SFTP di prova collegato alla rete `backup-out`; `init`, `backup`, `check`.
3. Perdita dei volumi: `down -v` del solo progetto, dopo aver elencato i sette volumi.
4. Stack nuovo con volumi nuovi: `up -d --wait`, **senza** `migrate`; poi `restore latest`,
   a stack acceso.
5. Confronto con il riferimento.

**Esito.**

| Misura | Esito |
|---|---|
| Tabelle e righe | 34 su 34, 75 righe su 75, uguali tabella per tabella |
| Estensioni e versioni | uguali |
| Oggetti | 9 su 9, SHA-256 e byte uguali, compreso quello da 0 byte e quello annidato |
| Differenze | **0** |
| E2e di lettura attraverso Caddy (`regole-strutturali`, `titolo-nel-head`) | 8 su 8 verdi |
| E2e di accesso (`cms/accesso.spec.ts`) con gli account ripristinati | 5 su 5 verdi, eseguita dopo il confronto |
| File pubblico ripristinato e sitemap | 200 |

Gli altri 23 spec di `cms/` non sono stati eseguiti: scrivono contenuti, media, account e
impostazioni.

**Tempi** (di script; con l'avvio del contenitore ogni comando dura circa 5 s in più):

| Passo | Durata |
|---|---:|
| Stack a freddo, `up -d --wait` | 44 s |
| `migrate` | 8 s |
| `init` | 6 s |
| `backup` (dump 97 959 byte, 9 oggetti, 6 432 582 byte, una istantanea) | 7 s |
| `check` | 2 s |
| Stack nuovo, `up -d --wait` | 27 s |
| `restore latest` | 2 s (7 s con il contenitore) |

Repository sul server di prova: 4 232 KiB. I tempi non dicono nulla sulla produzione.

**Pulizia.** Volumi del progetto, contenitore e volumi di prova rimossi; i volumi di sviluppo
sono rimasti accesi e intatti; il numero dei volumi è tornato uguale a prima.

**Difetti:** nessuno, né degli script né delle immagini.

## 6. Conservazione e manutenzione

- **Regola in vigore (DR-379):** `forget --prune` dopo ogni backup, con 7 istantanee
  giornaliere e 4 settimanali e **nessuna mensile**. Nessuna istantanea oltre circa 35 giorni,
  come proposto dal parere MI-06 (3e). Supera il 7/4/6 di DR-373 per la sola conservazione.
- **Ambito:** solo le istantanee di host `amoris` con etichetta `amoris-backup`; altre
  istantanee nello stesso repository non si potano.
- **Controllo:** `check` con rilettura del 10 % dei dati, ogni settimana (DR-373).
- **Stato della prova:** la prova di T5 (istantanee sintetiche su otto mesi più 5 estranee
  intatte) è stata riscritta nella T8 per la regola 7/4: restano esattamente le istantanee
  attese e nessuna supera 35 giorni. Rimettere `--keep-monthly 6` la fa diventare rossa.
  `--keep-daily 6` resta verde su questa prova in alcuni giorni della settimana, perché
  l'istantanea esclusa coincide con quella tenuta dalla settimanale: il valore 7 è coperto
  dalla prova sull'argomento esatto di `forget` in `backup-1f`.
- **Cancellazioni:** il parere MI-06 chiede di registrare le cancellazioni e riapplicarle dopo
  un ripristino, prima di riaprire il sito. Il registro minimo (DR-381) si fa nella `1F-W6`.
  Fino ad allora la procedura è un **punto aperto**: un ripristino con dati reali non va
  riaperto al pubblico senza quel passo.

## 7. Limiti della prova locale

| Limite | Perché conta |
|---|---|
| Server SFTP di prova, non la Storage Box | niente prova della porta 23, dei limiti di Hetzner, della latenza e della banda reali |
| Chiavi e password di prova | la custodia a doppia copia (DR-380) non è stata esercitata |
| Dati piccoli: 75 righe, 9 oggetti, 6 MiB | tempi, memoria (`384m`) e dimensione del repository con dati veri sono ignoti |
| Un solo giro di backup | nessuna prova di molti giorni di istantanee reali; la conservazione è provata con istantanee datate in modo sintetico |
| Nessun firewall dell'host | la rete `backup-out` non è limitata nella destinazione: vale solo con le regole della W4 |
| Nessun timer di systemd | l'avvio giornaliero è provato a mano |
| Cache e volume di appoggio piccoli | capacità non tarata |
| Estensioni | `citext`, `pgcrypto`, `unaccent` provate solo nello stack locale |
| Un solo ambiente di prova, su Windows con Docker Desktop | il server sarà Ubuntu Server 24.04 |
| Password del repository e altre password nell'ambiente del contenitore | visibili con `docker inspect`: rischio accettato (README §9, W4) |

## 8. Che cosa resta da provare sul server nella `1F-W5`

1. **SFTP reale** verso la Storage Box: `init`, `backup`, `check`, `restore` con il `known_hosts`
   nella forma `[host]:23`, sulla porta 23.
2. **Firewall `DOCKER-USER`** in uscita (W4): la rete `backup-out` esce solo verso la Storage
   Box sulla porta 23 e verso il DNS; ogni altra uscita è bloccata. Prova con un'uscita
   negata.
3. **Timer di systemd:** `backup` ogni giorno, `check` ogni settimana con `--no-deps`; lettura
   dell'esito nel journal; esito diverso da 0 visibile.
4. **Capacità:** spazio del volume `backup-data` (oggetti più dump) e della cache di restic
   (`backup-cache`), con i dati veri; se la cache manca, il ripiego su `/tmp` è di 16 MiB.
5. **Memoria:** il limite `384m` del servizio e `GOMEMLIMIT` con il dump vero.
6. **Chiavi vere (HO-059):** generate, installate, con i file leggibili dall'utente 10003.
7. **Ripristino con la copia della chiave del Centro** (DR-380): decifrare la copia custodita
   dal Centro e provare `check` e `restore` con quella, **prima** di mettere dati reali sul
   server (MI-06, 7b e 12).
8. **Ripristino completo su un ambiente vuoto del server**, con il confronto di tabelle,
   estensioni e oggetti come nella T6.
9. **Istantanee della Storage Box** non cancellabili dal server (DR-335): verifica
   all'ordine.
10. **Cancellazioni dopo un ripristino:** prova con il registro della `1F-W6` (DR-381).

## 9. Punti aperti e incoerenze da chiudere

- Gli handoff e i piani che citano «README §8» per i rinvii vanno riletti: la sezione dei
  rinvii è ora la §9.
