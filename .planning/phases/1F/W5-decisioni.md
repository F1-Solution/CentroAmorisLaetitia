# 1F-W5 — Decisioni D295…D299 del primo round

Round del 2026-11-09 con `grill-with-ui`, un invio. Le cinque decisioni del primo round del
[`W5-PLAN.md`](W5-PLAN.md) §4 sono prese e registrate come DR-409…DR-413 in
`docs/decisions/decision-register.md`. Tutte e cinque seguono la raccomandazione. Il secondo
round (D300…D304) resta aperto e si chiede prima della T6.

## Termini

| Termine | Definizione | Da evitare |
|---|---|---|
| ingresso comune | l'unico servizio del server che pubblica le porte 80 e 443, tiene i certificati e smista per nome verso il Caddy di ciascun ambiente | edge, reverse proxy di produzione |
| candidato | il commit della T5 le cui cinque immagini, pubblicate dalla CI, vanno nel primo rilascio prima sullo staging e poi in produzione | release, latest |
| insieme sintetico | dati inventati (persone `.invalid`, contenuti e media generati) creati in locale dalle stesse immagini, con conteggi e impronte di riferimento | dati di prova reali, dump di sviluppo |
| comando forzato | restrizione nella riga di `authorized_keys` che lascia alla chiave un solo comando sul server, senza shell | shell di rilascio, utente deploy libero |

## Perché

Chiudere le cinque decisioni che bloccano il codice della `1F-W5`: ingresso sulle porte 80 e
443, dati sul server, rilasci senza approvazione dell'ambiente, rete dei backup per ambiente,
basi delle immagini. Poi registrarle e preparare il commit del piano.

## Decisioni durature

| id | DR | Decisione | Scartate e perché |
|---|---|---|---|
| D295 | DR-409 | **A** — ingresso comune dedicato: terzo progetto Compose con la stessa immagine di Caddy, unico a pubblicare 80 e 443, TLS per i nomi valorizzati, inoltro per nome ai Caddy degli ambienti su due reti separate; i Caddy degli ambienti tengono intestazioni, password e instradamento, senza TLS; il nome della produzione si attiva nella W8 | B (Caddy della produzione come ingresso): lega lo staging alla produzione e chiede il certificato di `www` prima della W8; C (staging diretto fino alla W8): cambia l'ingresso dopo la validazione sullo staging; D (secondo IPv4): costo e disponibilità non verificati |
| D296 | DR-410 | **A** — solo dati sintetici: insieme sintetico portato in produzione con un ripristino da un repository restic di prova (sotto-account usa e getta della Storage Box), poi backup vero, ripristino nello staging e confronto a zero differenze; contenuti del Centro nella W7 | B (import locale già nella W5): tabelle storiche con dati personali sul server prima del registro delle cancellazioni (DR-381), e la W7 le sostituisce comunque; C (produzione vuota): 1F-2 e le misure slittano alla W7 |
| D297 | DR-411 | **A** — workflow avviato a mano solo da `main`; chiave SSH in un segreto del repository; utente `deploy` con comando forzato che accetta solo il rilascio di un ambiente e di un hash, con la cartella `infra/` di quel commit; login a GHCR con il `GITHUB_TOKEN` del lavoro; l'approvazione è la conferma dell'utente prima di ogni avvio. Supera DR-357 sul solo punto dell'approvazione dell'ambiente | B (piano GitHub superiore): costo ricorrente non previsto; C (rilasci da handoff): ogni rilascio a mano dal PC, meno ripetibile e senza traccia su GitHub |

## Scelte ordinarie

- D298 → DR-412: **A** — sottorete, bridge e catena del firewall per ambiente, script applicato
  una volta per ambiente; il backup resta solo in produzione, lo staging usa solo `restore`.
- D299 → DR-413: **A** — come DR-405 più Trivy, solo conteggi, sulle quattro immagini di terzi
  del Compose; di queste si aggiorna solo ciò che ha critici o alti con correzione; versioni
  pubblicate da almeno due settimane.

## Fatti verificati

Rilevati il 2026-11-09 (dettaglio in `W5-PLAN.md` §1):

- `compose.yml` dà a ogni ambiente un Caddy che pubblica `CADDY_HTTP_PORT` e
  `CADDY_HTTPS_PORT`; uno staging su altre porte non ottiene un certificato pubblico (README §9).
- La rete `backup-out` ha sottorete e bridge fissi; `firewall/backup-out.sh` riscrive una sola
  catena `AMORIS-BACKUP-OUT`.
- L'organizzazione GitHub è sul piano Free, il repository è privato, gli amministratori sono due;
  nessun ambiente né segreto; protezione dei rami non disponibile.
- Documentazione GitHub: con Free, Pro o Team i revisori obbligatori degli ambienti valgono solo
  per i repository pubblici; con Free niente segreti d'ambiente nei privati; GHCR accetta token
  classici con `read:packages` o il `GITHUB_TOKEN` di un repository con accesso al pacchetto.
- Documentazione Hetzner: BX11 con fino a 10 istantanee automatiche; i sotto-account vedono solo
  la propria cartella.
- Il seme sintetico non è nell'immagine dell'API; `compose.e2e.yml` non va mai sul server.

## Rischi

- **DR-409:** la memoria arriva al limite di 7168 MiB con l'ingresso; misura in T9, poi staging
  spento fuori dalle prove (D302) o limiti rivisti. La catena dell'indirizzo del visitatore passa
  da due salti: prova della W4 T3 ripetuta e riesame della T5.
- **DR-410:** spazio di `backup-data` e memoria del dump misurati con dati sintetici; vanno
  rimisurati con i dati veri nella W7.
- **DR-411:** manca un secondo controllo tecnico: chiunque abbia scrittura sul repository può
  avviare un rilascio, e un segreto sottratto da GitHub permette il rilascio di un hash pubblicato.
  Mitigazione: comando forzato senza shell, solo `main`, revoca togliendo la riga in
  `authorized_keys`.
- **DR-413:** un critico o alto con correzione in un'immagine di terzi apre un aggiornamento e le
  prove relative dentro la T4.

## Rinviate

Secondo round, prima della T6 (`W5-PLAN.md` §4): D300 riavvii automatici, D301 accessi e
istantanee della Storage Box, D302 separazione dello staging, D303 HSTS e CSP, D304 nome dello
staging. Esito del 2026-11-13 in [`W5-decisioni-round2.md`](W5-decisioni-round2.md).

## Discussioni aperte

Nessuna.
