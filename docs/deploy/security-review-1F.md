# Rapporto della security review (1F-W4)

**Stato:** completo; chiude la `1F-W4` con l'audit del 2026-11-09 (criteri W4-1…W4-11).

| Voce | Valore |
|---|---|
| Wave | `1F-W4`, security review della Fase 1F |
| Date | 2026-11-08 e 2026-11-09 |
| Commit esaminati | `1afed56` (revisione della T4), `57c4ae6` (riesame della T7, diff `6c6e4ed..57c4ae6`) |
| Correzioni del riesame (T7a) | `1a0f674`, riesaminate prima del commit sul loro solo diff |
| Revisore | agente `security-reviewer` a contesto nuovo (DR-383) |
| Piano | `.planning/phases/1F/W4-PLAN.md` |

## 1. Natura e limiti

> **Questo rapporto NON è un audit umano indipendente e NON è un penetration test** (DR-383).
> La revisione è stata fatta da un agente IA a contesto nuovo, che ha letto il codice e la
> configurazione senza ricevere le ipotesi del coordinatore. Il coordinatore ha riprodotto o
> verificato sul codice i rilievi critici e alti.
>
> **Nessuna dichiarazione di conformità.** Il rapporto non attesta conformità al GDPR né a norme
> fiscali. Il criterio 1F-11 resta al professionista incaricato (parere MI-06).
>
> **Stato reale non verificato.** Server, firewall dell'host, SSH, Storage Box e impostazioni del
> repository GitHub non esistono ancora o non sono leggibili dal codice: si verificano nella
> `1F-W5`.
>
> **Segreti nell'ambiente dei contenitori.** Restano un rischio accettato (DR-387). Il revisore
> non ha trovato nel codice un percorso concreto di esposizione.

Altri limiti:

- Il revisore ha letto, non eseguito: nessuna prova dinamica, nessuna scansione sua. Le prove
  dinamiche sono della T3 e della T7, eseguite dal coordinatore.
- Non letti per intero: `apps/importer` (non è in nessuna immagine), il codice di `apps/web` e
  `apps/admin` (solo i punti a rischio e la configurazione di Next), alcuni servizi dei moduli di
  contenuto.
- Il calendario di supporto di Node e Debian è stato riletto dal coordinatore il 2026-11-08.
- Nessuna parte della revisione ha toccato dati reali: `source-private/`, file `.env`, dump e
  database di sviluppo non sono stati letti. Le prove sui dati usano solo un seme sintetico.
- Il riesame della T7 non ha rieseguito prove, `pnpm audit`, Trivy né il conteggio delle righe.

## 2. Perimetro e metodo

| Attività | Che cosa è stato fatto |
|---|---|
| T0 | Linea di base: `main` su `1afed56`, CI verde, Docker in salute, nessuno stack di produzione o staging acceso, versioni degli strumenti fissate per digest |
| T1 | Scansione dei segreti: cronologia, working tree, filesystem delle cinque immagini |
| T2 | `pnpm audit --prod` e Trivy sulle cinque immagini (solo misura) |
| T3 | Prove di ADR-007 §8 attraverso Caddy sullo stack d'immagini, con seme sintetico |
| T4 | Revisione del revisore separato su `1afed56`: 29 rilievi (R1-R29) |
| T5 | Verifica dei rilievi alti da parte del coordinatore e decisioni DR-388…DR-392 |
| T6 | Correzioni (T6a…T6l), prova rossa prima di ciascuna |
| T7 | Riesame del solo diff delle correzioni (9 rilievi nuovi, N1-N9), decisioni DR-400…DR-404, correzioni T7a |
| T8 | Questo rapporto e i documenti collegati |

**Strumenti.** Tutti girano in contenitore, senza rete, con i rapporti fuori dal repository.
Gli scanner non entrano nelle immagini di produzione.

| Strumento | Versione | Digest | Note |
|---|---|---|---|
| gitleaks | v8.30.1 (2026-03-21) | `ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` | `--redact`; la v8.28.0 già in locale è superata e non si usa |
| Trivy | v0.76.1 (2026-10-21) | `aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c` | immagini lette da archivi `docker save`; la v0.76.2 (2026-11-05) aveva meno di due settimane; `cosign` assente, quindi fissata solo per digest |
| actionlint | 1.7.7 | per digest | solo sul workflow della CI (T6d) |

**Stack di prova.** Le immagini sono costruite in locale da `git archive` del commit esaminato,
con i comandi della CI (le immagini del registro non erano scaricabili con il token disponibile).
Le prove dinamiche usano un progetto Compose effimero con seme sintetico, raggiunto
attraverso Caddy. Le risorse di prova si cancellano alla chiusura della T8 (DR-404).

## 3. Scansioni (solo conteggi e verdetti)

Nessun valore di segreto compare in questo rapporto.

### 3.1 Segreti (criterio 1F-4)

| Momento | Oggetto | Rilievi | Verdetto |
|---|---|---|---|
| T1 (`1afed56`) | cronologia di tutti i rami, 143 commit | 0 | pulita |
| T1 | working tree, 1320 file visibili a Git | 0 | pulito |
| T1 | immagini: web 6, admin 6, api 1, scrub 1, backup 0 | 14 | 4 falsi positivi (costante pubblica in un'intestazione di Node), 10 chiavi generate dalla build di Next |
| T1 | prova sentinella: segreto finto in un file non tracciato | rilevato (uscita 1, valore oscurato) | lo strumento funziona; file tolto |
| T6d | cronologia, passo in CI e prova locale | 0 su 143 commit | passo bloccante nella CI |
| Prima del commit `57c4ae6` | modifiche in stage | 1 | falso positivo (valore sintetico di una prova); sostituito con un valore a bassa entropia, nuova scansione 0 |
| T7 | cronologia, 144 commit | 0 | pulita |
| T7 | modifiche non committate | 0 | pulite |
| T7a (`1a0f674`) | cronologia di tutti i rami, 144 commit; modifiche in stage prima del commit | 0; 0 | pulite |
| T7a | immagini `w4-t7a`: web 3, admin 5, api 0, scrub 0, backup 0 | 8 | tutti in file generati dalla build di Next (anteprima e Server Actions); i 4 falsi positivi delle intestazioni di Node sono spariti con la T6b |

Le 10 chiavi di Next sono generate a ogni build (anteprima e cifratura delle Server Actions) e
restano nell'immagine, ma il codice non le usa: nessun `draftMode`, nessuna Server Action. Non
sono credenziali del Centro. Se un giorno si usano le Server Actions, la chiave va impostata
dall'ambiente. Le immagini sono private (DR-356).

Le eccezioni motivate sono quelle di questa tabella. Il passo gitleaks della CI scansiona solo la
cronologia di Git, che non ha rilievi: per questo `.gitleaks.toml` non serve e non è stato creato.

### 3.2 Dipendenze e immagini (DR-386)

| Momento | Strumento | Esito |
|---|---|---|
| T2 | `pnpm audit --prod`, 316 dipendenze | 0 critici, 7 alti, 12 moderati, 5 bassi |
| T6c | `pnpm audit --prod` | nessun avviso (riesecuzione del coordinatore, uscita 0) |
| T6d | `pnpm audit --prod --audit-level=high` | bloccante nella CI; eccezioni in `pnpm-workspace.yaml`, elenco vuoto |
| T2 | Trivy, web, admin, api, scrub (Node 25.0.0, Debian 12.12) | 6 critici e 53 alti di sistema; 1 critico e 29 alti nel `npm` globale |
| T2 | Trivy, backup | 1 critico e 52 alti nei binari Go |
| T6b | Trivy, web, admin, scrub | 1 critico e 36 alti di sistema; `npm` globale 0 |
| T6b | Trivy, api | come sopra, più 1 alto in `drizzle-orm` (corretto poi nella T6c) |
| T6b | Trivy, backup | 0 critici e 27 alti, in `restic` e `mc` |
| T7a, immagini `w4-t7a` (Debian 12.15) | Trivy, web, admin, api, scrub | 1 critico e 36 alti di sistema ciascuna, 2 alti con correzione (`apt` e `libapt-pkg` 2.6.2); nessun avviso nelle dipendenze applicative, `drizzle-orm` compreso |
| T7a | Trivy, backup | 0 critici e 27 alti nei binari Go (`restic` 23, `mc` 4), tutti con correzione a monte |

Il critico residuo delle immagini Node è un avviso di `zlib1g` senza correzione e noto come
falso positivo (riguarda `minizip`, assente). I due alti con correzione riguardano `apt`, che il
contenitore non esegue (utente non root, file system in sola lettura): spariscono con la prossima
base di Node per digest, da ricontrollare al rilascio della `1F-W5`. Nelle immagini web, admin e scrub 35 avvisi su 37
non hanno correzione disponibile. Gli avvisi di `restic` e `mc` riguardano backend che il
servizio non usa. Il revisore ha giudicato l'esposizione effettiva bassa. Restano da rivalutare
a ogni nuova base.

Trivy non segnala l'avviso di `zod`: vale l'unione dei due strumenti.

Le immagini non si scansionano nella CI (DR-386, opzione B): `pnpm audit --prod` e gitleaks sì.

### 3.3 Prove dinamiche

| Prova | Esito |
|---|---|
| Sicurezza attraverso Caddy (T3), `sicurezza-1f.test.ts` | 55 prove, rosse prima con sette mutazioni temporanee, poi 55/55; dopo la T7 adeguata e riesecuzione 60/60 |
| E2E attraverso Caddy sullo stack d'immagini del commit `57c4ae6` | 71/71, anche il secondo fattore con codici veri |
| `test:images` sulle altre 11 suite (T7) | 283/283 |
| CI del commit `57c4ae6` | verde (lint, tipi, build, test, e2e, cinque immagini pubblicate) |
| `test:images` sulle immagini `w4-t7a` (T7a), 12 suite | 340/340 |
| E2E attraverso Caddy sullo stack delle immagini `w4-t7a` | 71/71 |

Due uscite con codice 1 per il timeout `onTaskUpdate` di Vitest a prove verdi sono note dalla W3.

## 4. Autenticazione: i 12 controlli di ADR-007 §3.1

Esito complessivo: attuata. Prima della T6 il revisore ha trovato 11 controlli su 12 con un
test e il dodicesimo fuori perimetro. La colonna «Dopo la T6» dice che cosa è cambiato.

| # | Controllo | Esito T4 | Prova | Dopo la T6 e la T7a |
|---|---|---|---|---|
| 1 | Password Argon2id, parametri in configurazione | Attuato | `adr007Controls.test.ts` | in produzione minimi di 19 MiB e t=2 imposti (R27); rinnovo dell'hash all'accesso non fatto, annotato |
| 2 | Token a 256 bit, a database solo il digest | Attuato | `adr007Controls.test.ts` | invariato |
| 3 | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, senza `Domain` | Attuato | `adr007Controls.test.ts`; attraverso Caddy in `sicurezza-1f.test.ts` | cookie di sessione senza `Max-Age` né `Expires` (DR-391); manca il prefisso `__Host-` (R26f, annotato) |
| 4 | Scadenza assoluta e per inattività, lato server | Attuato | `adr007Controls.test.ts` | 14 giorni e 8 ore, massimi imposti in produzione (DR-391; erano 30 giorni e 12 ore) |
| 5 | Rotazione del token a ogni accesso e cambio password | Attuato | `adr007Controls.test.ts`; prova di fissazione in `sicurezza-1f.test.ts` | cambio password e revoca in una transazione (R26a) |
| 6 | Revoca immediata di una o di tutte le sessioni | Attuato nella lettera, con lacune minori | `adr007Controls.test.ts`; `sicurezza-1f.test.ts` | manca la revoca di una singola altra sessione (R26b, annotato); sessioni revocate dopo un ripristino (R25) |
| 7 | CSRF a doppio invio su ogni richiesta che modifica | Attuato | `adr007Controls.test.ts`; T3: 37 rotte su 39 provate senza token, tutte rifiutate | le 2 esenti sono anonime (`POST /auth/login`, invio dei moduli) |
| 8 | Limitazione dei tentativi per IP e per account, ritardo progressivo | Attuato con rilievi | `adr007Controls.test.ts`; T3: tetto per account al 6º tentativo, per IP al 21º, `X-Forwarded-For` falsificato non sposta il conteggio | R5, R6, R8, N1 corretti (§8); coda in memoria per account (DR-400) chiude la corsa dichiarata da ADR-007; vincolo di un solo processo API |
| 9 | Nessuna enumerazione degli account | Attuato | `adr007Controls.test.ts`; T3: mediane 364 ms contro 363 ms | digest dell'identificativo digitato ora con chiave (R7) |
| 10 | Audit di accesso, fallimento, uscita, cambio password, revoca | Attuato | `adr007Controls.test.ts` | nuove azioni del secondo fattore e dello sblocco da CLI; rifiuti su letture non registrati (R26d, annotato) |
| 11 | Recupero password fuori perimetro | Fuori perimetro, confermato | `adr007Controls.test.ts` | invariato; reimpostazione manuale da parte di chi ha `users.manage`, ora con conferma recente (DR-396) |
| 12 | Segreti solo da ambiente, verificati all'avvio | Attuato con riserva | `adr007Controls.test.ts` | in produzione chiavi S3 obbligatorie, segreti distinti; manca la validazione della forma di `DATABASE_URL` (annotato) |

**Secondo fattore (DR-384).** Il TOTP (RFC 6238) è attuato con `node:crypto`, senza dipendenze
nuove. Il segreto è cifrato a riposo con una chiave dell'ambiente, il passo già usato è rifiutato,
la sessione senza secondo fattore non autorizza nulla. Reimpostazione solo da CLI (DR-397);
nessuna rotazione della chiave in Fase 1 (DR-399).

**Conferma recente (DR-391, DR-396).** Ogni rotta che richiede `users.manage` chiede password o
TOTP entro 10 minuti, anche l'elenco e il dettaglio degli account.

**Conteggio delle righe (ADR-007 §6, §8).** La regola di conteggio non è mai cambiata.

| Momento | Nucleo | Totale | Soglia del nucleo |
|---|---|---|---|
| Linea di base (`1afed56`) | 475 | 1416 | 500 |
| Dopo T6h | 544 | 1488 | 650 (DR-388, terza deroga) |
| Dopo T6j | 567 | 1515 | 650 |
| Con il TOTP (T6l-a) | 772 | 1946 | 800 (DR-395, quarta deroga) |
| Dopo T7a | 789 | 1989 | 800 |

Il margine residuo è di 11 righe. Il riesame con Better Auth (ADR-007 §3.3) resta obbligatorio
prima della fase gestionale. Il revisore della T7 non ha rieseguito il conteggio.

## 5. Esiti per area

| Area | Esito | Rilievi collegati |
|---|---|---|
| Rotte dell'API | Nessuna rotta con dati amministrativi senza sessione o permesso; 39 rotte che modificano, 37 con CSRF e 2 anonime esenti; validazione Zod su ogni corpo; query parametrizzate; nessun `sql.identifier` né `execFile` con dati di richiesta; errori che non trapelano dettagli | R6, R8, R22 corretti; N2 corretto |
| Area amministrativa e ruoli | Mappa delle aree e permessi letti a database a ogni richiesta; un solo account `users.manage` compromesso equivale a tutti: mitigato dal secondo fattore e dalla conferma recente | R4, R9; R26e annotato |
| Caricamenti e pulizia (`scrub`) | Tipo riconosciuto dal contenuto, SVG e HTML rifiutati, percorsi costruiti dal codice, `qpdf` e `ffmpeg` con argomenti in vettore e protocolli ammessi in lista; contenitore non root, sola lettura, rete interna | R17 corretto; R23 e R29 annotati; PDF in linea senza `Content-Disposition`, nessuna correzione obbligatoria |
| Caddy | TLS automatico, 308 da HTTP, `admin off`, intestazioni di sicurezza; staging con `basic_auth` davanti a tutto; `/api/openapi.json` e `/api/health*` non pubblici | R1, R22 corretti; R20 e R21 alla `1F-W5` |
| Compose e immagini | Utenti non root, `cap_drop ALL`, sola lettura, reti `app`, `data` e `scrub` interne, porte solo su Caddy; ruoli del database e utenti di MinIO a privilegi minimi; Node 26.12.1 per digest; runtime senza `npm`, `corepack`, `npx` e intestazioni | R2, R10, R11, R17 corretti; R19 corretto con N3 accettato; R23 annotato |
| Backup | Cifratura lato client, verifica del server SFTP, blocco esclusivo, copia in chiaro in `backup-data` svuotata all'avvio e a fine esecuzione, sessioni revocate dopo il ripristino, script di firewall per `backup-out` con prova | R13, R18, R25 corretti; R12, R14 e N6 alla `1F-W5` |
| CI e catena di fornitura | Permessi minimi del token, azioni fissate per SHA completo, `pnpm audit --prod` bloccante, gitleaks nel passo della CI, lockfile congelato | R15, R16 corretti; N7 verificato |
| Dati e log | Vedi §6 | R3, R7, R28 corretti |

Il revisore non ha trovato percorsi concreti di esposizione dei segreti nell'ambiente: DR-387
regge. Nel README si raccomanda di non incollare l'uscita di `docker inspect` e
`docker compose config`.

## 6. Tre tabelle con dati personali e log

| Tabella | Scrittura | Lettura | Esportazioni |
|---|---|---|---|
| `form_submissions` | invio anonimo dei moduli; importer (solo sviluppo) | **nessuna rotta dell'API** (il permesso `submissions.read` non esiste ancora); oggi solo accesso diretto al database | nessuna |
| `legacy_email_log` | solo importer | nessuna rotta | nessuna |
| `users` | gestione account, accesso (hash, ultimo accesso), CLI degli account | `/accounts` con `users.manage` e conferma recente; accesso; `/auth/me` | nessuna |

La regola «compilazioni leggibili solo con `submissions.read`» vale oggi perché non esiste un
lettore. Quando nascerà la lettura (fase gestionale) servirà il permesso, il secondo fattore con
conferma recente e un registro delle letture.

**Indirizzi IP.** Salvati solo come digest HMAC-SHA256 con `IP_HASH_SALT`; per IPv6 si digerisce
il prefisso /64. T3: nessuna corrispondenza a un indirizzo in chiaro in `sessions` (52 righe),
`audit_log` (135) e `form_submissions` (1) dello stack sintetico.

**`audit_log.detail`.** Contiene identificativi, nomi dei campi cambiati, chiavi dei ruoli, stato
HTTP e metodo, più l'etichetta di alcuni oggetti. Nessuna email, nessun corpo di richiesta,
nessun contenuto delle compilazioni. Restano due residui da dichiarare:

- un nome di file di un media o un'etichetta di menu, scelti dalla redazione, possono contenere un
  nome di persona;
- `audit_log.actor_label` conserva il nome dello staff anche dopo la rimozione dell'account
  (informativa interna, parere 5a).

**Digest dell'identificativo digitato.** Ora HMAC con una sottochiave di `IP_HASH_SALT` (R7). Le
righe con quel digest scadono dopo 30 giorni (R7, N4), ma il timer di pulizia manca fino alla
`1F-W5`.

**Log applicativi (DR-390).** Dopo la T6f contengono metodo, percorso senza query, esito, durata,
identificativo della richiesta e digest con sale dell'IP, senza nome dell'host. Nessun IP in
chiaro né query di ricerca (prova `requestLog.test.ts`). Rotazione `json-file` di 10 MB × 5 su
tutti i 10 servizi del Compose. Il digest dell'IP resta nei log: l'informativa (`1F-W6`) deve
descrivere solo ciò che c'è e non dichiarare «nessun dato personale nei log». Caddy non scrive
registri degli accessi.

**Log del servizio di backup.** Una riga JSON con comando, esito, durata, byte e identificativo
dell'istantanea; nessun nome di file né contenuto.

**Cifratura a riposo: non attuata.** Sono cifrati i backup e il trasporto. Restano in chiaro sul
disco del server i volumi del database e dell'archivio. Chi ottiene una copia del disco, di un
volume, di uno snapshot o un accesso `root` non autorizzato legge i dati senza altre barriere. Una
compromissione dell'API dà già accesso completo ai dati: la cifratura di campo non la fermerebbe.
Il Centro ha approvato il rischio per iscritto (DR-385; approvazione registrata in DR-394 il
2026-11-08, legale rappresentante, originale conservato dal Centro e dal manutentore, fuori da
Git). Il caso è da riesaminare prima della fase gestionale o di categorie di dati diverse. Resta
DR-374: nessun dato del Centro sul server prima della chiusura della `1F-W4`. Opzione a basso
costo non adottata: cifratura del volume del server.

## 7. Rilievi

Severità secondo `code-review.md` (critico, alto, medio, basso). Origine: revisione della T4 (R1-R29, 0 critici, 4 alti, 13
medi, 12 bassi). Perimetro delle correzioni: DR-392.

### 7.1 Rilievi R1-R29

| R | Sev. | Sintesi | Esito | Rif. |
|---|---|---|---|---|
| R1 | Alto | Staging senza password | corretto in T6e (`basic_auth` da ambiente su tutto lo staging) | DR-375 |
| R2 | Alto | Node 25.0.0 e Debian 12.12 non aggiornati | corretto in T6a (Node 26.12.1 per digest) | DR-389 |
| R3 | Alto | IP in chiaro e query nei log, senza rotazione | corretto in T6f | DR-390 |
| R4 | Alto | TOTP assente, nucleo oltre la soglia | corretto in T6l; il residuo N1 corretto in T7a | DR-384, DR-388, DR-395 |
| R5 | Medio | Blocco per account autoalimentato, senza sblocco | corretto in T6h (sblocco da CLI) | DR-392 |
| R6 | Medio | Rotte anonime senza tetto, audit per ogni rifiuto, indici mancanti | corretto in T6h; il residuo N2 corretto in T7a | DR-392, DR-401 |
| R7 | Medio | Digest non salato dell'email nel registro | corretto in T6h (HMAC e scadenza a 30 giorni); il residuo N4 corretto in T7a | DR-392, DR-403 |
| R8 | Medio | Tetti aggirabili con IPv6 | corretto in T6h (prefisso /64) | DR-392 |
| R9 | Medio | Sessione lunga e cookie persistente | corretto in T6k e T6l | DR-391 |
| R10 | Medio | API collegata come superutente del database | corretto in T6g (tre ruoli) | DR-392 |
| R11 | Medio | API con le credenziali principali di MinIO | corretto in T6g (utenti di servizio) | DR-392 |
| R12 | Medio | Chi ha il server può cancellare i backup remoti | rinviato alla `1F-W5` con handoff | DR-392 |
| R13 | Medio | `backup-out` senza limite di destinazione | corretto in T6i come script con prova; applicazione e persistenza alla `1F-W5` | DR-392, N6 |
| R14 | Medio | Istantanee del fornitore oltre i 35 giorni | rinviato alla `1F-W5` con handoff | DR-392 |
| R15 | Medio | Azioni della CI per etichetta, niente audit né gitleaks | corretto in T6d | DR-386 |
| R16 | Medio | Dipendenze con correzione disponibile | corretto in T6c | DR-392 |
| R17 | Medio | Strumenti inutili nel runtime delle immagini | corretto in T6b | DR-392 |
| R18 | Basso | Copia in chiaro in `backup-data` | corretto in T6j; il residuo N5 corretto in T7a | DR-392, DR-403 |
| R19 | Basso | `trustProxy` fidato verso qualunque indirizzo | corretto in T6h; il residuo N3 accettato | DR-392, DR-402 |
| R20 | Basso | HSTS a un'ora | rinviato alla `1F-W5` | DR-392 |
| R21 | Basso | CSP in sola segnalazione, con `'unsafe-inline'` | rinviato alla `1F-W5`; rischio accettato fino ad allora | DR-364, DR-392 |
| R22 | Basso | Specifica e stato dell'API pubblici | corretto in T6j (404 da Caddy) | DR-392 |
| R23 | Basso | Indurimento incompleto, niente `pids_limit` né CPU | annotato | DR-392 |
| R24 | Basso | Procedura del primo account di produzione | rinviato alla `1F-W5` (handoff) | DR-392 |
| R25 | Basso | Nessuna pulizia, sessioni riattivate dal ripristino | corretto in T6j (revoca al ripristino, CLI di pulizia); timer alla `1F-W5` | DR-392, DR-403 |
| R26a | Basso | Cambio password e revoca non atomici | corretto in T6j | DR-392 |
| R26b | Basso | Nessuna revoca di una singola altra sessione | annotato | DR-392 |
| R26c | Basso | `no-store` mancante su `/auth/me` e `/auth/sessions` | corretto in T6j | DR-392 |
| R26d | Basso | Rifiuti 401/403 sulle letture non registrati | annotato | DR-392 |
| R26e | Basso | Reimpostazione dell'altro amministratore da `users.manage` | annotato; mitigato da conferma recente e reimpostazione del fattore solo da CLI | DR-392, DR-396, DR-397 |
| R26f | Basso | Cookie senza prefisso `__Host-` | annotato | DR-392 |
| R27 | Basso | Configurazione non validata fino in fondo | corretto in T6j; residuo (rinnovo dell'hash, forma di `DATABASE_URL`) annotato | DR-392, DR-403 |
| R28 | Basso | `user_agent` non troncato | corretto in T6h | DR-392 |
| R29 | Basso | Caricamenti interi in memoria prima del semaforo | annotato | DR-392 |

### 7.2 Rilievi del riesame N1-N9

Il riesame del diff `6c6e4ed..57c4ae6` ha dato 0 critici, 1 alto, 2 medi, 6 bassi. Sulle 23 voci
del perimetro con una correzione da verificare: 16 chiuse, 7 chiuse in parte (R4, R6, R7, R18, R19,
R25, R27), nessuna non chiusa. Le chiusure parziali sono i rilievi qui sotto.

| N | Sev. | Sintesi | Esito | Rif. |
|---|---|---|---|---|
| N1 | Alto | Tetto ai tentativi del secondo fattore superabile con richieste parallele (stesso schema in accesso e password) | corretto in T7a: coda in memoria per account nei 7 punti, tetto di 10 al minuto per sessione su codice e conferma; prova rossa prima | DR-400 |
| N2 | Medio | Ricerca e redirect senza tetto per la via del sito | corretto in T7a: il sito inoltra l'indirizzo del visitatore, esenzione tolta | DR-401 |
| N3 | Medio | `TRUSTED_PROXY` su tutta la sottorete `app`; `APP_SUBNET` uguale nei due ambienti | `APP_SUBNET` obbligatoria e diversa per ambiente (corretto in T7a); fiducia nella sottorete: rischio accettato | DR-402 |
| N4 | Basso | Scadenza incompleta delle righe con digest | corretto in T7a (30 giorni per ogni riga con il digest dell'identificativo); timer alla `1F-W5` | DR-403 |
| N5 | Basso | Copia in chiaro sopravvive a una terminazione brutale | corretto in T7a (svuotamento anche all'avvio, dopo il blocco) | DR-403 |
| N6 | Basso | Firewall non si applica da solo né si rinnova | rinviato alla `1F-W5` con handoff | DR-403 |
| N7 | Basso | SHA delle azioni da confrontare con i tag | verificato dal coordinatore con `gh api`: SHA uguali ai tag | DR-403 |
| N8 | Basso | Prova che non prova ciò che dichiara | corretto in T7a insieme a N2 (prova inversa) | DR-401, DR-403 |
| N9 | Basso | Dopo il passaggio di fattore lo stesso passo non vale per la conferma (30 secondi) | annotato: solo ergonomia | DR-403 |

Il riesame del revisore sul solo diff della T7a è nel §12.

## 8. Requisiti del parere MI-06 (domande 3e, 7b, 12)

I requisiti sono da valutare, non conformità: l'esito tecnico non sostituisce 1F-11.

| Dom. | Requisito tecnico | Esito |
|---|---|---|
| 3e | Finestra massima di 35 giorni per i backup | **Attuato** (7 giornaliere e 4 settimanali, nessuna mensile); condizionato da R14 sulle istantanee del fornitore |
| 3e | Cifratura, scadenza, divieto d'uso ordinario della copia | **Attuato**; gli accessi eccezionali dipendono dalla custodia delle chiavi (DR-380, `1F-W5`) |
| 3e | Registro delle cancellazioni riapplicato al ripristino prima di riaprire il servizio | **Da attuare nella `1F-W6`** (DR-381); la revoca delle sessioni al ripristino è attuata (R25) |
| 3e | Informare l'interessato del residuo di backup | **Fuori dal codice**: Centro e informativa (`1F-W6`); il testo dice 35 giorni solo se R14 è chiuso |
| 7b | Fornitore UE: contratto e istruzioni | **Rischio da far approvare / azione del Centro** |
| 7b | Cifratura prima dell'invio, chiave separata dai backup | **Attuato** (restic lato client) |
| 7b | Ripristino non dipendente da una sola persona | **Da attuare nella `1F-W5`**: custodia a doppia copia non ancora esercitata (DR-380); suggerita una chiave restic propria del Centro |
| 7b | Prova documentata di recupero; cessazione del contratto | **Parzialmente attuato**: ripristino provato in locale con dati sintetici; prova con la copia del Centro e verifica delle istantanee del fornitore da fare nella `1F-W5` |
| 12 | Cifratura dei trasferimenti | **Attuato** (TLS verso l'esterno, SSH verso la Storage Box) |
| 12 | Cifratura dei backup | **Attuato**; la copia in chiaro locale è svuotata (R18, N5) |
| 12 | Cifratura a riposo su server e computer | **Rischio approvato dal Centro** per iscritto (DR-385, DR-394); computer di sviluppo: non verificabile da qui |
| 12 | Chiavi separate e recuperabili dal Centro | **Da attuare nella `1F-W5`** (DR-380) |
| 12 | Autenticazione a più fattori per accessi privilegiati | **Attuata**: TOTP nell'area amministrativa per tutti gli account (DR-384); la casella che riceve dati delicati è fuori dal sistema |
| 12 | Cifratura dei campi, separazione, sessioni | **Valutata**: campi non cifrati (DR-385); ruoli e aree attuati; sessioni strette (DR-391) |
| 12 | Dati reali separati dallo sviluppo e dai percorsi leggibili dall'IA | **Da verificare** da Centro e manutentore: `source-private/` è nella cartella di lavoro dello strumento IA; non verificabile dal codice |
| 12 | Separazione effettiva del collaudo sullo stesso server | **Parziale**: separati a livello di progetto Compose, `APP_SUBNET` distinta (DR-402) e staging con password (R1); restano stesso demone, stesso kernel e assenza di limiti di CPU; da dichiarare al Centro |
| 12 | Non dichiarare «nessun dato personale nei log» se ci sono identificativi o hash | **Da applicare nell'informativa** (`1F-W6`): log con digest dell'IP (DR-390), `audit_log` con nomi dello staff |

## 9. Rischi accettati

| Rischio | Decisione | Note |
|---|---|---|
| Nessuna cifratura a riposo delle tre tabelle e dei file | DR-385, approvato per iscritto da DR-394 | solo Fase 1; riesame prima della fase gestionale |
| Segreti nell'ambiente dei contenitori | DR-387 | si riapre se emerge un percorso di esposizione |
| Prima attivazione del TOTP da parte di chi conosce la password temporanea | DR-398 | rimedio: comando di DR-397; password su canale sicuro |
| Nessuna rotazione della chiave dei segreti TOTP | DR-399 | se compromessa, si reimpostano tutti i secondi fattori da CLI |
| Un solo processo API (coda in memoria dei tentativi) | DR-400 | da riprendere se l'API passa a più processi; scritto in ADR-007 |
| Fiducia di `TRUSTED_PROXY` nell'intera sottorete `app` | DR-402 | per sfruttarla serve un contenitore `web` o `admin` già compromesso |
| Digest con sale dell'IP nei log | DR-390 | da descrivere nell'informativa |
| CSP in sola segnalazione e con `'unsafe-inline'` | DR-364 | da rivedere nella `1F-W5` (R21) |
| Nessuna scansione delle immagini nella CI | DR-386 (opzione B) | scansione una tantum nella W4 |
| Nucleo di autenticazione oltre le 500 righe | DR-066, DR-070, DR-388, DR-395 | quarta deroga, soglia 800, margine 11 righe; riesame con Better Auth prima della fase gestionale |
| Avvisi critici e alti residui delle immagini (§3.2) | DR-405 | esposizione effettiva giudicata bassa dal revisore; nuova scansione Trivy obbligatoria al primo rilascio della `1F-W5` |
| Rilievi annotati (R23, R26b, R26d-f, R29, N9, residuo di R27, R-A…R-F) | DR-392, DR-403; R-A…R-F dal riesame della T7a (§12) | nessuno critico, alto o medio |

## 10. Rinvii alla `1F-W5`

Le azioni sul server sono in `docs/handoff/HO-061-azioni-sul-server-dalla-security-review-1F-W5.md`,
da eseguire nella `1F-W5`.

- **Timer di `auth-purge`** (R25, N4): senza timer, sessioni scadute e righe di tentativo non
  vengono rimosse.
- **Firewall di `backup-out`** (R13, N6): applicazione con `--env-file` e `--check`, unità systemd
  dopo `docker.service`, controllo periodico, preferire indirizzi fissi; DNS verso i resolver
  dell'host come canale lento di uscita.
- **`APP_SUBNET` per ambiente** (DR-402): `10.77.84.0/24` per la produzione, `10.77.85.0/24` per
  lo staging.
- **Le cinque password e i ruoli del database** (T6g): `amoris_owner`, `amoris_app`,
  `amoris_backup`, utenti di MinIO, cartelle `db-init` e `objects` sul server, comando di
  ripristino nuovo; rieseguire `db-init` dopo la preparazione degli e2e.
- **Storage Box** (R12, R14): sotto-account limitato, istantanee del fornitore con conservazione
  pari alla finestra di 35 giorni, verifica che il server non possa cancellarle, prova con la
  copia del Centro.
- **Scansione delle immagini al primo rilascio** (DR-405): Trivy sulle basi più recenti per digest,
  solo conteggi (HO-061 §9).
- **HSTS** (R20): alzare `max-age` dopo la verifica di HTTPS.
- **CSP** (R21, DR-364): decisione su nonce o hash e raccolta delle segnalazioni.
- **Primo account di produzione** (R24): `account-create` rifiuta oggi un database non locale,
  quindi la procedura si scrive e si prova nella `1F-W5`: password temporanea su canale sicuro,
  cambio al primo accesso e attivazione del TOTP (DR-228, DR-398).
- **Segreti**: `TOTP_ENCRYPTION_KEY`, chiavi S3 e segreti distinti nel file d'ambiente; spazio di
  `backup-data`. I comandi di sblocco, reimpostazione del secondo fattore (DR-397) e pulizia sono
  già nell'immagine dell'API.
- **Custodia delle chiavi del backup** (DR-380, HO-059): custodia a doppia copia non ancora
  esercitata.
- **Accesso al server**: SSH, aggiornamenti dell'host, rotazione dei log del demone, cifratura del
  disco se decisa.
- **Impostazioni del repository GitHub**: protezione dei rami, politica delle Actions, visibilità
  del registro; aggiornamento controllato degli SHA delle azioni; `pnpm` installato da `npm` nei
  Dockerfile; digest delle immagini al rilascio.

Altri rinvii: `/health/ready` non controlla l'archivio a oggetti, senza rischio di sicurezza (T4):
si riprende con la sonda esterna della `1F-W8` (D227, DR-408).

Rinvii alla `1F-W6`: registro delle cancellazioni riapplicato al ripristino (DR-381), informativa
sui log, sul residuo di backup e sulla durata di `audit_log`.

## 11. Condizioni per i dati del Centro sul server

Restano in vigore due condizioni.

- DR-374: nessun dato del Centro sul server prima della chiusura della `1F-W4`.
- DR-394: l'approvazione scritta del rischio di DR-385 è già stata data; vale per la sola Fase 1.

## 12. Riesame delle correzioni della T7

Il revisore separato, a contesto nuovo e in sola lettura, ha riesaminato il solo diff delle
correzioni della T7a (DR-400…DR-403). Non ha eseguito prove: le ha lette.

| Rilievo | Esito del riesame | Prova rossa prima della correzione |
|---|---|---|
| N1 | chiuso: ogni punto che conta i tentativi passa dalla coda per account; il tetto per sessione scatta dopo il controllo della sessione | `attemptsRace1fT7.test.ts`: 32, 16, 8 e 12 fallimenti registrati contro il tetto di 5, nessun 429 per sessione; poi 7/7 |
| N2 | chiuso | `hardening1fT6h.test.ts`: quattro chiamate interne senza indirizzo tutte 404, ora la quarta 429; `visitorAddress-1f.test.ts`: 2 su 3 rosse, poi 3/3 |
| N3 | chiuso; fiducia nell'intera sottorete accettata (DR-402) | `compose-1f.test.ts`: 2 rosse (variabile obbligatoria, nessun predefinito), poi 57/57 |
| N4 | chiuso | `purgeAuthData.test.ts`: 2 righe cancellate invece di 5, poi verde |
| N5 | chiuso: lo svuotamento viene dopo il blocco, quindi non tocca un'esecuzione in corso | `backup-1f.test.ts`: il residuo c'era durante il dump, poi 40/40 |
| N8 | chiuso | coperto dalle prove di N2 |

**Rilievi nuovi del riesame: 0 critici, 0 alti, 0 medi, 6 bassi**, annotati e non corretti
(W4-6: i bassi si annotano):

| Id | Sintesi | Nota |
|---|---|---|
| R-A | il tetto di 10 al minuto vale per sessione su ciascuna rotta (attivazione, verifica, conferma), non sulle tre insieme | il tetto per account resta esatto; ADR-007 descrive il comportamento reale |
| R-B | il tetto per indirizzo si può superare in parallelo su account diversi | contenuto dal tetto HTTP di 30 accessi al minuto per indirizzo |
| R-C | chi attacca può allungare la coda di un account; le attese per account non hanno limite | l'account si blocca comunque dopo 5 fallimenti; da un solo indirizzo i tetti HTTP limitano la coda, da molti indirizzi l'account colpito può avere attese lunghe |
| R-D | il tetto di 120 al minuto per visitatore vale anche per più persone dietro lo stesso indirizzo | il sito non usa il prefetch di Next; un 429 sul redirect salta solo la regola, sulla ricerca dà la pagina d'errore |
| R-E | l'indirizzo inoltrato dal sito non è validato come IP | Caddy sostituisce `X-Forwarded-For` con l'indirizzo del client; correzione economica con `net.isIP` |
| R-F | lo svuotamento di `/backup/data` ignora gli errori | un residuo non cancellabile non blocca il backup; correzione economica |

R-E e R-F restano annotati per decisione dell'utente (DR-406).

Righe di autenticazione dopo la T7a, con regola invariata: nucleo 789 su 800, totale 1989.

## 13. Verifiche finali

Sul codice di `1a0f674`, prima del commit (fotografia identica per il codice) e poi nella CI:

| Verifica | Esito |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm audit --prod --audit-level=high` | coerente; nessun avviso |
| Lint, Prettier sui file di Git, typecheck, build, `db:verify` | verdi |
| Test per pacchetto | api 1121, admin 775, web 280, importer 411, blocks 328, ui 288, db 22, contracts 9; il timeout noto di `page.test.ts` sotto carico rieseguito da solo, verde |
| Copertura | 93,89 % (3234 prove), soglia 80 % |
| Immagini `w4-t7a` | costruite con i comandi della CI, `check-image` pulito su tutte e cinque |
| `test:images`, 12 suite | 340/340, compresi `sicurezza-1f` (60) e `ruoli-1f` (13) sulle immagini nuove |
| E2E attraverso Caddy sullo stack d'immagini | 71/71 |
| gitleaks | cronologia 144 commit 0; modifiche in stage 0; immagini: solo gli 8 file di Next già triati |
| CI 42584328349 di `1a0f674` | verde: verifica e cinque immagini pubblicate |

### Audit di chiusura (criteri W4-1…W4-11)

| Criterio | Esito | Prova |
|---|---|---|
| W4-1 Revisione indipendente | ✅ | T4 su `1afed56`, riesami della T7 e della T7a sul solo diff; ogni area con esito (§5); limite di DR-383 dichiarato (§1) |
| W4-2 Autenticazione | ✅ | 12 controlli (§4); tentativi e revoca provati attraverso Caddy sullo stack d'immagini; righe rimisurate con regola invariata, 789 su 800 |
| W4-3 Tre tabelle | ✅ | accessi, digest, `audit_log.detail` e log (§6); rischio di DR-385 descritto e approvato per iscritto (HO-060, DR-394) |
| W4-4 Segreti | ✅ | cronologia, working tree e cinque immagini; nessun rilievo non triato; valori mai stampati; eccezioni motivate nella tabella del §3.1 |
| W4-5 Dipendenze | ✅ | `pnpm audit --prod` a zero e bloccante nella CI; avvisi critici e alti residui delle immagini (§3.2) accettati con DR-405, nuova scansione al primo rilascio della `1F-W5` |
| W4-6 Esiti chiusi | ✅ | nessun critico o alto aperto; medi corretti, rinviati con DR-392 (R12, R14) o accettati (N3, DR-402); bassi annotati (§7, §12) |
| W4-7 Correzioni provate | ✅ | prova rossa prima di ogni correzione della T6 e della T7a; riesame del revisore sul diff delle correzioni |
| W4-8 Rinvii W4 chiusi | ✅ | MinIO e ruoli (T6g), firewall (T6i, applicazione in HO-061), segreti nell'ambiente (DR-387), `/health/ready` rinviato alla sonda della `1F-W8` (DR-408) |
| W4-9 Requisiti MI-06 | ✅ | §8, MFA TOTP attuata (DR-384) |
| W4-10 Nessuna regressione | ✅ | tabella qui sopra |
| W4-11 Documenti e chiusura | ✅ | rapporto, ADR-007, `database-schema.md` §8, README §9, CONTEXT §4, PLAN §8 e HO-061 scritti; commit e push su conferma dell'utente, CI verde, riga `STATUS:complete` |
