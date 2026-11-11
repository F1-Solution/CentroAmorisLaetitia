# PLAN — Fase 1F · Staging e produzione

Piano di fase, scritto il 2026-10-31 durante il collaudo della 1G, come consente DR-272:
**solo pianificazione**. L'esecuzione comincia dopo l'approvazione della Fase 1G
(`1G-W10`) e HO-017. Una riga in `PROGRESS.md` per ogni wave completata, un commit per
wave, ognuno con la sua conferma. Ogni wave riceve, prima di partire, il suo piano di
dettaglio (`Wn-PLAN.md`): file da toccare, prove da scrivere prima del codice, comandi di
verifica.

Contesto, decisioni già prese e confronto dei fornitori: [`CONTEXT.md`](CONTEXT.md),
[`confronto-fornitori-2026-10-30.md`](confronto-fornitori-2026-10-30.md). Criteri di uscita:
1F-1…1F-12 di [`docs/qa/acceptance-criteria.md`](../../../docs/qa/acceptance-criteria.md) §7.
L'approvazione di questo piano è la condizione 14 del gate: **approvato dall'utente il
2026-10-31 (DR-337)**.

**Obiettivo in una frase:** portare sito pubblico e area amministrativa su un server
Aruba in Italia (DR-334), con staging, backup cifrati provati con un ripristino (DR-335),
security review e piano di rientro provato, e verificare il rilascio con smoke test e
rapporto in `docs/deploy/` (secondo punto del gate).

---

## 1. Wave

| Wave | Che cosa produce | Come si verifica |
|---|---|---|
| `1F-W0` | **Pianificazione.** `CONTEXT.md`, confronto dei fornitori, questo piano; DR-272, DR-295…DR-303, DR-310, DR-334, DR-335 registrate | I file esistono e non sono vuoti; piano approvato dall'utente (condizione 14) |
| `1F-W1` | **Residui della 1G.** Correzione di W9-N7 (DR-330): i salvataggi della copia di lavoro non si superano e non ricompaiono dopo «Scarta», «Salva» o «Pubblica». Correzione di W9-N8 (DR-336): «Ctrl+Home» subito dopo il clic nel testo sposta sempre il cursore | Prove che falliscono prima della correzione, con la rete rallentata; e2e verdi; verifica come la CI |
| `1F-W2` | **Immagini e Compose di produzione.** Dockerfile di `web`, `admin`, `api` (impacchettamento dell'API, DR-080); contenitore separato per `qpdf`, `ffmpeg` e `ffprobe` (DR-263, ADR-012 §4); Compose di produzione e progetto separato di staging (DR-296); `Caddyfile` di produzione (TLS, HTTP verso HTTPS, HSTS, intestazioni di sicurezza, compressione, cache dei media secondo DR-253 e DR-074); `.env.example` di produzione; CI che costruisce le immagini con l'hash del commit, mai `latest` (ADR-009 §4.7), secondo D225 e D228 | Lo stack parte **in locale** dalle immagini, con dati sintetici; ogni servizio risponde al proprio health check; e2e verdi contro lo stack di immagini; nessun segreto nelle immagini (1F-4); contenitore di pulizia senza rete, con utente dedicato e limite di memoria verificati |
| `1F-W3` | **Backup e ripristino.** Servizio `backup` con restic: dump coerente di PostgreSQL e copia degli oggetti, cifrati prima dell'invio con la chiave custodita dall'utente (DR-298), conservazione 7 giornalieri, 4 settimanali, 6 mensili (ADR-009 §4.5); esito di ogni backup registrato senza dati personali | Ripristino completo **in locale** su uno stack pulito, da un repository restic di prova: conteggi delle 20 tabelle e impronte degli oggetti uguali; `docs/deploy/backup-verification.md` |
| `1F-W4` | **Security review** (1F-3, ADR-007 §8, DR-066). Revisore separato: modulo di autenticazione in modo esplicito, le tre tabelle con dati personali, rotte, `Caddyfile`, contenitori, dipendenze; scansione dei segreti su working tree e cronologia (`privacy-safe-development`) | Rapporto in `docs/deploy/`; nessun esito critico o alto aperto; scansione dei segreti pulita (1F-4) |
| `1F-W5` | **Server e staging.** Ordine di server e Storage Box da parte del Centro (DR-302), con prezzi ricontrollati nel carrello (DR-334, DR-335); accesso SSH a chiave, utente non `root`, firewall con le sole porte 22, 80 e 443, aggiornamenti di sicurezza automatici; Docker; staging raggiungibile secondo D226 e non indicizzabile; backup attivo verso la Storage Box; misura di un caricamento sintetico da 100 MB e taratura dei tempi dell'archivio (N2, DR-338) | Installazione eseguita seguendo **solo** la documentazione del repository (1F-1); smoke test sullo staging; ripristino completo provato **sul server**, nello staging, dal backup remoto (1F-2); `robots.txt` e `X-Robots-Tag` dello staging rifiutano l'indicizzazione |
| `1F-W6` | **Moduli, email e privacy**, dopo il parere MI-06 (1F-11). Invio delle compilazioni con l'SMTP di Aruba (DR-301, ADR-010), prima verso destinatari interni; schermata «Compilazioni» in sola lettura con registro delle consultazioni (DR-310); durata del registro (DR-232); durata dei registri del rilascio sul server (DR-427); esiti del parere applicati | Prove prima del codice; email ricevute dai soli destinatari interni sullo staging; prove negative per ruolo sulla schermata «Compilazioni»; ogni esito del parere con la sua attuazione o la sua accettazione registrata |
| `1F-W7` | **Contenuti e prove sullo staging.** Nuovo backup di WordPress (HO), import del differenziale con la protezione del lavoro redazionale (DR-087, 1F-8); esito di D229 sui PDF importati (DR-259); contenuti e oggetti sullo staging; prova di rientro: ritorno all'etichetta precedente e ripristino dal backup (1F-6); misure di prestazione (1F-5); `rollback-plan.md`, `infrastructure-plan.md`, `gate-checklist.md` con le dieci prove di `deployment-gate` (la UAT è in `visual-parity-report.md` §12, DR-210; il collaudo redazionale in `cms-editability-report.md` della `1G-W10`) | Conteggi dell'import riconciliati; confronto di parità sulle pagine prioritarie (metodo di 1E-19, DR-202); PageSpeed > 80 e risposta sotto i 3 secondi; rientro **eseguito**, non descritto; `gate-checklist.md` senza voci rosse |
| `1F-W8` | **Rilascio in produzione.** TTL dei record ridotto in anticipo; nella finestra di D230: copia di salvataggio, migrazioni, stessa immagine validata sullo staging, primo account di amministrazione; cambio dei soli record A/AAAA su Aruba (DR-300); chiave di Google Maps limitata e ruotata (MI-05, 1F-9); `phpinfo()` tolto dal vecchio hosting (R-17, 1F-10); sonda esterna secondo D227 | Smoke test di `deployment-gate` tutti verdi (1F-7); in caso contrario **rientro**, non correzione a caldo; `docs/deploy/release-report-<data>.md` |
| `1F-W9` | **Audit e chiusura.** `AUDIT.md` con 1F-1…1F-12 eseguiti uno per uno; ricostruzione da zero dalla sola documentazione su una macchina pulita (ADR-009 §9); ogni conferma irreversibile registrata (1F-12) | Ogni criterio ha un esito eseguito; poi **stop** e richiesta di approvazione della fase (condizione 15) |

## 2. Chi esegue, che cosa tocca

Regola della 1D: **Sonnet** per il codice, **Haiku** per la documentazione; la security
review a un revisore separato (`security-reviewer`). Ordini, pagamenti e accessi agli
account dei fornitori li fa l'utente per il Centro, con un handoff per ciascuno:
l'agente **non riceve mai** credenziali di fornitori, DNS o server (`deployment-gate`).
Chi esegue i comandi sul server lo stabilisce DR-357 (D228).

| Wave | Agente | File toccati |
|---|---|---|
| `1F-W0` | pianificazione | `.planning/phases/1F/*`, `docs/decisions/decision-register.md`, `PROGRESS.md` |
| `1F-W1` | **Sonnet** | `apps/admin/src/**` dell'editor, `apps/api/src/modules/content/**` solo se serve |
| `1F-W2` | **Sonnet** | `infra/` (Dockerfile, Compose di produzione e di staging, `Caddyfile` di produzione), `.github/workflows/`, `apps/api/package.json` per l'impacchettamento, `.env.example` |
| `1F-W3` | **Sonnet** | `infra/` (servizio `backup`), `docs/deploy/backup-verification.md` |
| `1F-W4` | revisore di sicurezza, poi **Sonnet** per le correzioni | `docs/deploy/`, file indicati dagli esiti |
| `1F-W5` | **Sonnet** (istruzioni e verifiche), utente (ordini e accessi) | `docs/deploy/`, `docs/handoff/` |
| `1F-W6` | **Sonnet** | `apps/api/src/modules/` (moduli, compilazioni), `apps/admin/src/**`, `packages/contracts/src/**`, `packages/db` se serve un permesso nuovo |
| `1F-W7` | **Sonnet** | `docs/deploy/`, `docs/migration/` per il rapporto del differenziale; secondo D229, uno script di pulizia dei PDF importati |
| `1F-W8` | **Sonnet** (osserva e registra), utente (DNS e conferme) | `docs/deploy/`, `docs/handoff/` |
| `1F-W9` | **Sonnet** | `.planning/phases/1F/AUDIT.md`, `docs/deploy/` |

## 3. Dipendenze fra wave

| Wave | Dipende da | Perché |
|---|---|---|
| `1F-W1` | approvazione della 1G, HO-017 | DR-272: l'esecuzione segue il collaudo |
| `1F-W2` | `1F-W1`, D225, D228 | Le immagini contengono il codice corretto; registro e modo di rilascio cambiano la CI |
| `1F-W3` | `1F-W2` | Il servizio `backup` fa parte del Compose di produzione |
| `1F-W4` | `1F-W2`, `1F-W3` | La revisione guarda immagini, `Caddyfile` e backup come andranno in produzione |
| `1F-W5` | ordine e indurimento: nessuna; dati del Centro: `1F-W4` | DR-374 (D265): server, Docker e staging vuoto avanzano in parallelo; nessun dato del Centro sul server prima della revisione |
| `1F-W6` | `1F-W5`, parere MI-06 | DR-310 e ADR-010: email e compilazioni solo dopo il parere |
| `1F-W7` | `1F-W5`, `1F-W6`, D229 | Lo staging deve avere funzioni e contenuti come andranno in produzione |
| `1F-W8` | `1F-W7`, D227, D230, gate-checklist verde | Rilascio solo della build validata sullo staging |
| `1F-W9` | tutte | L'audit raccoglie gli esiti |

`1F-W1` può procedere in parallelo alla `1F-W2` su file separati, se l'utente lo chiede.

## 4. Struttura del repository al termine

| Percorso | Novità |
|---|---|
| `infra/` | Dockerfile delle tre applicazioni e del contenitore di pulizia; Compose di produzione e di staging; `Caddyfile` di produzione; servizio `backup` (percorsi fissati nel `W2-PLAN.md`) |
| `.github/workflows/` | costruzione delle immagini con l'hash del commit; rilascio secondo DR-357 |
| `docs/deploy/` | `infrastructure-plan.md`, `backup-verification.md`, `rollback-plan.md`, `gate-checklist.md`, rapporto della security review, `release-report-<data>.md` |
| `.planning/phases/1F/AUDIT.md` | nuovo |

## 5. Dipendenze previste

Nessuna è autorizzata da questo piano: ognuna si dichiara nella wave che la introduce,
con il motivo, e l'audit le confronta con questo elenco.

| Possibile dipendenza | Perché potrebbe servire | Alternativa |
|---|---|---|
| immagini di base con versione fissa (Node, PostgreSQL, MinIO, Caddy) | le immagini di produzione | nessuna: servono comunque, mai `latest` |
| `restic`, nell'immagine del servizio `backup` | backup cifrati verso la Storage Box via SFTP (DR-335) | `borg`, indicato anch'esso dal fornitore |
| client di MinIO (`mc`) nell'immagine del servizio `backup` | copia coerente degli oggetti prima di restic | lettura diretta del volume a servizio fermo |
| bundler per l'API (per esempio `esbuild`) | DR-080: il `dist` di oggi non si esegue con Node | eseguire l'API con `tsx` anche in produzione |

Nessun client PHP o WordPress entra nel runtime.

## 6. Cosa questa fase non dimostrerà

- **Nessuna alta disponibilità.** Un solo server, punto singolo di guasto (ADR-009 §7,
  RB-04). Dominio, posta e server presso lo stesso fornitore (DR-334, DR-300, DR-301);
  i backup restano altrove (DR-335).
- **Nessuna conformità GDPR o fiscale dichiarata.** La dà, o la nega, il professionista
  di MI-06 (1F-11); contratti per i dati di Aruba e Hetzner compresi.
- **Nessuna fase gestionale.** Il gate si supera solo con il rilascio verificato e
  l'approvazione di questa fase.
- **Nessuna verifica delle licenze** di `qpdf`, `ffmpeg` (ADR-012) e del font
  `ETmodules` (DR-143): le fa una persona prima del rilascio.
- **Non tocca la sorgente.** `source-private/` resta byte per byte com'è.

## 7. Conferme richieste all'utente durante la fase

| # | Quando | Che cosa |
|---|---|---|
| 1 | alla fine di ogni wave | commit e push |
| 2 | `1F-W5` | ordine di server e Storage Box (pagamento del Centro); primo accesso e indurimento del server; ogni rilascio sullo staging |
| 3 | `1F-W3`, `1F-W5` | creazione e custodia della chiave dei backup (DR-298): senza la chiave i backup sono illeggibili |
| 4 | `1F-W6` | configurazione dell'SMTP e primi invii verso destinatari interni; poi l'attivazione verso quelli reali |
| 5 | `1F-W7` | nuovo backup di WordPress; import reale del differenziale; copia dei contenuti sullo staging |
| 6 | `1F-W8` | riduzione del TTL; rilascio; ogni migrazione sul database di produzione, con copia di salvataggio; cambio dei record A/AAAA; chiave di Google Maps; modifica del vecchio hosting |
| 7 | ogni wave | ogni cancellazione, anche di dati di prova sullo staging |

Una conferma vale per quella azione e non si eredita (`CLAUDE.md`, ADR-009 §4.8).

## 8. Assunzioni vietate e decisioni richieste

Già decise per la 1F:

| id | Decisione | Esito |
|---|---|---|
| ~~**D6a**~~, ~~**D223**~~ | Fornitore del server | **DR-334**: Aruba Cloud VPS O4A8, Italia |
| ~~**D190**~~ | Staging | **DR-296**: stesso server, progetto Compose separato |
| ~~**D191**~~ | Storage a oggetti | **DR-297**: MinIO sullo stesso server |
| ~~**D192**~~, ~~**D224**~~ | Backup fuori dal server | **DR-298**, **DR-335**: cifrati, Hetzner Storage Box BX11 |
| ~~**D193**~~ | Dominio e DNS | **DR-300**: restano su Aruba, si cambiano solo A/AAAA |
| ~~**D194**~~ | Email dei moduli | **DR-301**: SMTP di Aruba |
| ~~**D195**~~ | Costi | **DR-302**: intestati al Centro, che paga |
| ~~**D196**~~ | MI-06 | **DR-303**: avviata subito (HO-054) |
| ~~**D201**~~ | Compilazioni | **DR-310**: schermata in sola lettura nella 1F, dopo il parere |
| ~~**D221**~~ | W9-N7 | **DR-330**: corretto nella 1F |
| ~~**D232**~~ | W9-N8 | **DR-336**: corretto nella `1F-W1` |
| ~~**D233**~~ | N2, tempi dell'archivio | **DR-338**: misura e taratura nella `1F-W5` |
| ~~**D225**~~ | Dove si conservano le immagini | **DR-356**: registro di GitHub (GHCR), privato |
| ~~**D228**~~ | Chi esegue i comandi sul server | **DR-357**: impianto da handoff, rilasci da GitHub Actions avviata a mano |
| ~~**D226**~~ | Accesso allo staging | **DR-375**: sottodominio con DNS e password |
| ~~**D265**~~ | Accelerazione della 1F | **DR-374**: ordini subito; W5 sul server senza dati in parallelo alla W4 |
| ~~**D270**~~…~~**D274**~~ | Security review (`W4-PLAN.md` §4) | **DR-383**…**DR-387**: revisore agente; TOTP; nessuna cifratura a riposo con rischio approvato per iscritto dal Centro; `pnpm audit` nella CI; segreti nell'ambiente accettati |
| ~~**D275**~~…~~**D290**~~ | Esiti della security review (`W4-PLAN.md` §4) | **DR-388**…**DR-404**: deroghe del nucleo a 650 e 800 righe; Node 26.12.1; log senza IP né query; sessioni 14 giorni e 8 ore con conferma recente; TOTP con reimpostazione da CLI; coda per account sui tentativi; indirizzo del visitatore inoltrato dal sito; `APP_SUBNET` per ambiente; rischio della cifratura a riposo approvato per iscritto (DR-394) |
| ~~**D295**~~…~~**D299**~~ | Server e primo rilascio (`W5-PLAN.md` §4) | **DR-409**…**DR-413**: ingresso comune su 80 e 443; solo dati sintetici nella W5; rilasci avviati a mano solo da `main` con comando forzato (supera DR-357 sull'approvazione dell'ambiente, non disponibile con il piano Free); `backup-out` per ambiente; Trivy anche sulle immagini di terzi |

Ancora aperte, da chiedere con `grill-me` prima della wave indicata. Nessuna wave parte
con una decisione bloccante aperta.

| id | Decisione | Opzioni | Raccomandazione | Termine |
|---|---|---|---|---|
| **D229** | PDF importati con metadati (DR-259: 29 su 48 con l'autore) | A ripulirli tutti con la pulizia del CMS · B lasciarli byte per byte · C ripulire solo quelli con l'autore | da formulare con i numeri di ADR-012 §6 | prima della `1F-W7` |
| **D227** | Sonda esterna e destinatari degli avvisi | A servizio gratuito esterno · B sonda dalla Storage Box o da un'altra macchina del Centro · C nessuna sonda in Fase 1 | da formulare con i servizi verificati | prima della `1F-W8` |
| **D230** | Finestra del passaggio e indisponibilità accettata | A sera di un giorno feriale · B fine settimana · C data concordata con il Centro | da formulare con il calendario del Centro | prima della `1F-W8` |
| **D231** | Destino del vecchio hosting WordPress dopo il passaggio | A disdetta dopo un periodo di prova · B mantenuto come archivio · C disdetta subito | A, con una data fissata dopo l'audit | dopo la `1F-W9` |

Verifiche umane che nessuna decisione sostituisce: parere MI-06 (1F-11); licenze di
`qpdf` e `ffmpeg` (ADR-012) e del font `ETmodules` (DR-143); contratti per i dati di Aruba
e Hetzner, dentro MI-06.

Assunzioni vietate: che i prezzi del 2026-10-30 valgano ancora all'ordine; che lo staging
possa usare il database o il bucket della produzione; che un backup valga senza un
ripristino provato; che un rilascio riuscito sullo staging autorizzi la produzione.
