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

## 3. Confronto preliminare dei fornitori (DR-295)

Rilevato il 2026-10-28 dalle pagine pubbliche, **da riverificare sul configuratore nella wave 1F-W1**: le fonti di terze parti non concordano fra loro. Prezzi mensili IVA esclusa, per una macchina da almeno 4 GB di RAM. La stima d'uso è di 3-4 GB per i sette servizi più lo staging (DR-296) e il contenitore di `ffmpeg` da 1 GB (DR-263), quindi la taglia realistica è **8 GB**.

| | Hetzner (DE/FI) | OVHcloud (FR/DE/PL/UK) | Aruba (IT) |
|---|---|---|---|
| VPS da 4 GB | «Regular Performance» da 6,49 €; i piani economici risultano «Currently not available»; listino aumentato nel 2026 (aprile e giugno, da fonti terze) | VPS-1: 2 vCore, 4 GB, 40 GB, 3,81 € | CS O2A4: 2 vCPU, 4 GB, 40 GB, 17,52 € (listino «Virtual Data Center»); un VPS OpenStack O2A4 a 6,29 € compare solo su un aggregatore |
| VPS da 8 GB | da verificare sul configuratore | VPS-2: 4 vCore, 8 GB, 75 GB, 7,21 € | da verificare |
| Collocazione in UE | Germania (Norimberga, Falkenstein), Finlandia | **Sì, confermato**: «13 località in Europa» sulle pagine ufficiali delle VPS. Da una fonte terza: Gravelines, Roubaix, Strasbourg, Francoforte, Varsavia, Londra. **Milano non è confermata per le VPS** (compare solo per i server dedicati) | Italia (Arezzo e altre sedi) |
| Note | | Il prezzo indicato sembra legato al pagamento anticipato di 12 mesi; nelle «Local Zone» alcune funzioni non ci sono | Supporto in italiano |
| Fonti | [hetzner.com/cloud](https://www.hetzner.com/cloud/), [findstack](https://findstack.com/resources/hetzner-price-increase-2026) | [ovhcloud.com/it/vps](https://www.ovhcloud.com/it/vps/), [vps-france](https://www.ovhcloud.com/en/vps/vps-france/), [learnwithhasan](https://learnwithhasan.com/vps-providers/ovh-vps/) | [arubacloud.com/pricing](https://www.arubacloud.com/pricing/public-cloud/virtual-data-center), [whtop](https://www.whtop.com/it/plans/arubacloud.com/139875) |

Da verificare per tutti e tre nella 1F-W1:

- DPA conforme all'art. 28 GDPR, sede legale e eventuale soggetto a leggi extra-UE;
- snapshot e backup del fornitore;
- IPv4 incluso;
- fatturazione mensile o annuale;
- recesso e portabilità.

Il Regno Unito è fuori dall'UE: va escluso o motivato.

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

Resta da decidere il fornitore del server (DR-295), dopo il confronto verificato.
