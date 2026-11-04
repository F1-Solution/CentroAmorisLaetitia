# Fase 1F — Staging e produzione — CONTESTO

Scritto il 2026-10-28 durante il collaudo della 1G, come consente DR-272: **solo pianificazione**, senza acquisti, deploy, DNS o email. L'esecuzione comincia dopo l'approvazione della Fase 1G e HO-017 (`.planning/phases/1G/PLAN.md`).

## 1. Obiettivo

Mettere in produzione il sito pubblico e l'area amministrativa su un server in UE, con:

- staging;
- security review;
- backup provato con un ripristino;
- smoke test, misure di prestazione e piano di rientro;
- rapporto di rilascio in `docs/deploy/`.

Questo è il secondo punto del gate di `CLAUDE.md`.

## 2. Già deciso

| Riferimento | Che cosa |
|---|---|
| DR-038, ADR-009 | Docker Compose su un host singolo. Servizi `caddy`, `web`, `admin`, `api`, `db`, `objects`, `backup`. Immagini dalla CI, etichettate con l'hash del commit, mai `latest`. Migrazioni come passo esplicito. Rientro: etichetta precedente, oppure ripristino del backup |
| ADR-003 | Caddy come reverse proxy, TLS automatico |
| ADR-009 §4.5 | Backup giornaliero di PostgreSQL e degli oggetti; conservazione 7 giornalieri, 4 settimanali, 6 mensili; destinazione fuori dall'host; ripristino provato prima del rilascio |
| ADR-009 §9 | Verifica: ricostruzione da zero dalla sola documentazione, ripristino completo provato, nessun segreto in Git, health check, ritorno all'etichetta precedente |
| ADR-007 §8, DR-066 | Security review esplicita del modulo di autenticazione |
| ADR-010 | Invio email provato prima verso destinatari interni, poi attivato verso quelli reali |
| DR-263 (D159) | `qpdf` e `ffmpeg` in un contenitore separato: limite di memoria intorno a 1 GB, senza rete, utente dedicato |
| DR-264 (D160) | Video ammessi solo `h264`, `hevc` e `aac`: attuato nella `1G-W7` |
| DR-073, MI-06 | Verifica privacy e legale di un professionista **prima della produzione** |
| DR-272 | Pianificazione durante il collaudo, senza acquisti né deploy |
| DR-295 | Fornitore: confronto fra tre, con verifica di OVH in Europa |
| DR-296 | Staging sullo stesso server, come progetto Compose separato |
| DR-297 | MinIO sullo stesso server |
| DR-298 | Backup cifrati prima dell'invio, presso un altro fornitore UE; chiave custodita dall'utente |
| DR-334 (D223) | Server: Aruba Cloud VPS O4A8, 4 vCPU, 8 GB, 80 GB, Italia; prezzo e disponibilità da ricontrollare all'ordine |
| DR-335 (D224) | Backup: Hetzner Storage Box BX11, restic via SFTP |

## 3. Confronto verificato dei fornitori (DR-295)

Rilevato il 2026-10-30 sulle pagine e sui listini ufficiali, senza account né ordini. Dettaglio, fonti e punti ancora aperti sono in [`confronto-fornitori-2026-10-30.md`](confronto-fornitori-2026-10-30.md). Questo confronto supera quello preliminare del 2026-10-28, che per Hetzner riportava il prezzo di un piano da 1 GB.

Prezzi mensili IVA esclusa per una macchina da 8 GB. La stima d'uso è di 3-4 GB per i sette servizi, più lo staging (DR-296) e il contenitore di `ffmpeg` da 1 GB (DR-263). In sviluppo file e database occupano meno di 1 GB: 75-80 GB di disco bastano anche con lo staging.

| | Hetzner | OVHcloud | Aruba Cloud |
|---|---|---|---|
| Piano da 8 GB | CPX32, 4 vCPU, 160 GB: **35,99 €** senza impegno. Il CX33 da 8,99 € è «not available» | VPS-2, 4 vCore, 75 GB: **8,49 €** senza impegno, 7,21 € con 12 mesi pagati in anticipo | VPS O4A8, 4 vCPU, 80 GB: **11,79 €**, con credito prepagato |
| Disponibilità il 2026-10-30 | ordine non verificabile senza login | **esaurito in tutte le sedi UE** | non verificabile senza aprire il carrello |
| Sedi UE | Norimberga, Helsinki (Falkenstein solo nel listino) | Francia, Germania, Polonia, Milano | Italia |
| Backup del fornitore | a pagamento, in proporzione al server | giornaliero incluso, nello stesso datacenter | nessuno (art. 7.4); snapshot cancellati dopo 48 ore |
| DPA art. 28 | da accettare nell'account | parte integrante del contratto | art. 21 delle condizioni, accettato con l'ordine |
| Società | Hetzner Online GmbH (DE) | OVH S.r.l. (IT), gruppo francese con affiliate fuori UE | Aruba S.p.A. (IT) |
| Recesso | fatturazione oraria, nessun minimo | rinnovo automatico; lo sconto vale solo con impegno | in ogni momento, senza penali |
| Assistenza in italiano | no | sì | sì |

Per i backup cifrati presso un fornitore diverso dal server (DR-298) ci sono quattro candidati:

- Hetzner Storage Box BX11: 1 TB a 3,20 €, restic e Borg via SFTP, traffico illimitato;
- Object Storage S3 di OVH: circa 0,71 € per 100 GiB, uscita gratuita, anche a Milano;
- Object Storage S3 di Aruba: circa 2 € per 100 GB, uscita a 0,50 € ogni 10 GB;
- Object Storage S3 di Scaleway: circa 0,80 € per 100 GB, anche a Milano.

Il Regno Unito e Zurigo sono fuori dall'UE e non sono considerati. Restano da verificare, al momento dell'ordine:

- se il piano si può ordinare e in quale sede;
- il prezzo dei backup del fornitore;
- il recesso con impegno.

L'adeguatezza dei DPA va valutata nella MI-06 (DR-073, DR-303): il confronto non dichiara conformità al GDPR.

## 4. Stato del repository

- Esistono soltanto `infra/compose/docker-compose.yml` e `Caddyfile`, per lo sviluppo: non ci sono immagini di produzione.
- Non esistono `docs/deploy/` né i Dockerfile delle applicazioni.
- La CI esistente (DR-008) va estesa con la costruzione e la pubblicazione delle immagini.

## 5. Decisioni del secondo round (2026-10-28)

- DR-300 (D193): dominio e DNS restano su Aruba, senza Cloudflare; al passaggio si cambiano solo i record A/AAAA.
- DR-301 (D194): invio dei moduli con l'SMTP di Aruba e una casella del Centro.
- DR-302 (D195): contratti e account intestati al Centro, che paga.
- DR-303 (D196): MI-06 avviata subito, con un documento di ambito senza dati reali.
- DR-310 (D201): schermata «Compilazioni» in sola lettura con permesso del solo amministratore e registro delle consultazioni, nella 1F prima della produzione e dopo il parere MI-06. Oggi l'API non ha né la rotta di lettura né il permesso, e non invia email.

Il 2026-10-31 il confronto verificato ha chiuso DR-295 con DR-334 (Aruba) e DR-298 con DR-335 (Hetzner Storage Box). Piano della fase: [`PLAN.md`](PLAN.md).

## 6. Rinviati dalla 1G

- DR-330 (D221): W9-N7, salvataggi della copia di lavoro che si superano su rete lenta (`docs/qa/collaudo-1G-W9.md` §5). Corretto nella `1F-W1` (DR-350, DR-355; `collaudo-1G-W9.md` §10).
- DR-336 (D232): W9-N8, «Ctrl+Home» premuto subito dopo il clic nel testo che a volte non sposta il cursore (`docs/qa/collaudo-1G-W9.md` §9). Non riprodotto e corretto in via preventiva nella `1F-W1` (DR-351; `collaudo-1G-W9.md` §10).
- DR-338 (D233): N2, misura di un caricamento da 100 MB e taratura dei tempi dell'archivio, sul server (`.planning/phases/1G/W9-PLAN.md` §7).
