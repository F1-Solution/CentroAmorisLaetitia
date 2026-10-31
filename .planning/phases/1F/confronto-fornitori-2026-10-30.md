# Confronto fornitori — server e backup fuori sede — rilevazione del 2026-10-30

Riverifica del confronto preliminare del 2026-10-28 (`.planning/phases/1F/CONTEXT.md` §3, DR-295). Lavoro di sola
lettura su pagine pubbliche: nessun account, ordine, modulo o configuratore con login. **Nessuna raccomandazione:
la scelta spetta all'utente.** Tutte le fonti sono state lette il **2026-10-30**.

Legenda della provenienza, usata in ogni cella:

- **U** — letto sulla pagina o sul documento ufficiale del fornitore;
- **A** — letto su un'interfaccia pubblica ufficiale del fornitore, senza login, che alimenta le sue pagine
  (listino di Hetzner, catalogo e disponibilità di OVHcloud);
- **T** — fonte di terze parti;
- **D** — deduzione o calcolo mio a partire da dati U o A.

I prezzi sono mensili e **IVA esclusa**, salvo diversa indicazione. I codici fra parentesi quadre rimandano al §5.

---

## 1. Server: piano da circa 8 GB (e quello da 4 GB come riferimento)

| | Hetzner | OVHcloud | Aruba Cloud |
|---|---|---|---|
| **Piano da 8 GB** | **CPX32** «Regular Performance»: 4 vCPU AMD condivise, 8 GB, 160 GB NVMe, 20 TB di traffico [H1, U] | **VPS-2 2027**: 4 vCore, 8 GB, 75 GB SSD NVMe, traffico illimitato a 1 Gbps [O1, U] | **VPS O4A8** (Cloud VPS OpenStack): 4 vCPU, 8 GB, 80 GB, 50 TB/mese, 1 Gb/s [A1, A2, U] |
| **Prezzo da 8 GB e condizione** | **35,99 €/mese** come tetto massimo; 0,0577 €/ora; nessun impegno; prezzo comprensivo dell'IPv4 [H1, U] | **7,21 €** con impegno di 12 mesi **pagato in anticipo**; 8,06 € con 6 mesi; **8,49 €** senza impegno [O3, A]. La pagina mostra solo «Da 7,21 €» [O1, U] | **11,79 €/mese** [A2, U]; pagamento con credito prepagato («Ricarica») [A7, U] |
| **Altre taglie da 8 GB dello stesso fornitore** | CX33 «Cost-Optimized» (4 vCPU, 8 GB, 80 GB) 8,99 €, segnato **«not available»** [H2, U]; CAX21 (Arm, 4 vCPU, 8 GB, 80 GB) 10,99 €, **«not available»** [H2, U]; CCX13 con vCPU dedicate (2 vCPU, 8 GB, 80 GB) 43,49 € [H3, U] | VPS-3 (6 vCore, 12 GB, 100 GB) 10,40 € con 12 mesi, 12,24 € senza impegno [O1, U; O3, A] | OpenStack Cloud Server **PRO O4A8** (4 vCPU, 8 GB, 120 GB, «prestazioni garantite», traffico illimitato): 0,045 €/ora, 31,20 €/mese, 364 €/anno [A3, U] |
| **Piano da 4 GB (riferimento)** | **CPX22**: 2 vCPU, 4 GB, 80 GB, **19,99 €** [H1, U]. CX23 (2 vCPU, 4 GB, 40 GB) 5,99 €, «not available» [H2, U] | **VPS-1**: 2 vCore, 4 GB, 40 GB, 500 Mbps: 3,81 € (12 mesi anticipati), 4,26 € (6 mesi), 4,49 € (senza impegno) [O1, U; O3, A] | **VPS O2A4**: 2 vCPU, 4 GB, 40 GB, 25 TB/mese, **6,29 €** [A2, U] |
| **IPv4** | Incluso nel prezzo indicato («Price incl. IPv4») [H1, U]; l'IPv4 primario vale 0,50 €/mese [H5, A] ed è fatturato a parte finché esiste [H6, U] | «Indirizzo IPv4 dedicato — Incluso» [O1, U] | «i nostri VPS includono 1 IP pubblico»; IPv4 e IPv6 indicati nel listino [A1, A2, U] |
| **Traffico** | 20 TB inclusi nelle sedi UE; ogni TB in più 1,00 € [H1, U] | Illimitato in Europa [O1, U] | 50 TB/mese per O4A8, 25 TB/mese per O2A4 [A1, U] |
| **Disponibilità il 2026-10-30** | Prezzi e sedi pubblicati; non verificabile senza login se l'ordine vada a buon fine. I piani Cost-Optimized sono «not available» [H2, U] | **Esaurito in tutte le sedi UE per Linux**: VPS-2 «out-of-stock» ovunque, VPS-1 disponibile solo a BHS (Canada) e SGP (Singapore) [O4, A]. Il configuratore dice «VPS-2 non è al momento disponibile» e disattiva VPS-2, VPS-3 e VPS-4 [O2, U] | Non verificabile: la disponibilità per sede si vede solo nel carrello, non aperto |
| **Sedi UE per il piano** | Per CPX22 e CPX32 la pagina elenca **NBG1 (Norimberga) e HEL1 (Helsinki)** [H1, U]; il listino elenca anche FSN1 (Falkenstein) [H5, A]. Hetzner offre anche sedi USA e Singapore [H4, U] | Catalogo VPS 2027: GRA, RBX e SBG (Francia), DE/Limburg (Germania), WAW (Polonia), **EU-SOUTH-MIL (Milano)**; fuori UE: UK/Erith, BHS, SGP, SYD, YNM [O3, A]. **Milano è prevista per le VPS**, ma oggi è esaurita [O4, A]. Le Local Zone (Praga, Madrid, Amsterdam, Bruxelles, Marsiglia, Vienna, Zurigo) **non supportano Docker** [O1, U] e sono esaurite [O4, A] | «Crea il tuo Cloud VPS in Italia», «data center in Italia» [A1, U]; il centro si sceglie fra quelli disponibili per la taglia [A10, U]. Città non indicata: le prove di terzi riportano Arezzo (2025, 2026) e Bergamo (2023, 2024) [T3, T] |
| **Snapshot** | 0,0143 €/GB/mese [H1, U] | Opzione «Snapshot»: 0,30 € (VPS-1) [O1, O2, U]; 0,50 € (VPS-2) [O3, A] | Gratuito, uno per volta, **cancellato dopo 48 ore** [A9, U] |
| **Backup automatici del fornitore** | Giornalieri, 7 posti, legati al server e cancellati con esso [H1, H7, U]. Prezzo: «mo. price related to instance, starting at € 1,1980» [H1, U]; 1,198 € è il 20 % di 5,99 € [D]. **Il prezzo per CPX32 non è leggibile** | Backup giornaliero **incluso**, replicato tre volte **nello stesso datacenter** [O1, U]. «Premium» con ripristino a 7 giorni: 1,10 € (VPS-1) [O1, O2, U], 1,84 € (VPS-2) [O3, A] | **Nessun backup incluso**: «Aruba non esegue backup dei dati» (Sez. III, art. 7.4) [A7, U]. Prodotto separato «Cloud Backup»: 50 GB 6,99 €, 100 GB 12,99 € [A4, U] |
| **DPA art. 28 GDPR** | Esiste. Non è automatico: si **accetta online** nell'area account, spuntando «I agree to the agreement», senza firma; vanno indicati i tipi di dati e le categorie di interessati. Modello: `hetzner.com/AV/DPA_en.pdf`; accettazione: `accounts.hetzner.com/account/dpa`; sub-responsabili: `hetzner.com/AV/subunternehmer.pdf` [H8, U] | Esiste: «Contratto per il trattamento dei dati», versione del 17.10.2025, **parte integrante del contratto** con OVH S.r.l. e richiamato all'art. 28 [O6, U]; accettato con l'uso dei servizi [O8, U]. URL: `contract.eu.ovhapis.com/1.0/pdf/OVH_Data_Protection_Agreement-it.pdf` | Esiste: art. 21 «Nomina a responsabile del trattamento» nelle Condizioni di fornitura Cloud e Data Center v.1.4 (pubblicate l'8.10.2026), accettate con l'ordine online. Sub-responsabili su richiesta, con preavviso di 30 giorni per i cambi; DPO `dpo@staff.aruba.it` [A7, U] |
| **Sede legale e leggi extra-UE** | Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen (DE), HRB 6089 Ansbach. Nessuna capogruppo indicata [H11, U]. «Authorities from the USA or Singapore do not have direct access to the contents of your server data in the EU»; Hetzner risponde solo ad autorità tedesche o finlandesi [H8, U] | Controparte: **OVH S.r.l.**, Via Carlo Imbonati 18, 20159 Milano [O8, U]. Gruppo francese (OVH Groupe SA, OVH SAS) con affiliate anche fuori UE (Canada, Regno Unito, Singapore e altri); dall'elenco delle affiliate sono escluse le società con sede negli USA [O9, U]. La pagina VPS afferma che i dati sono «protetti da leggi extraterritoriali come il CLOUD Act» [O1, U]. Il DPA si oppone a richieste di autorità extraeuropee in alcuni casi (art. 4.3) [O6, U]. Da fonti terze: ordine di produzione canadese del 2024-2025 rivolto a OVH tramite la sua controllata canadese, impugnato [T1, T2, T] | Aruba S.p.A., Via San Clemente 53, 24036 Ponte San Pietro (BG) [A2, U]. «Siamo soggetti esclusivamente alle normative europee»; data center di proprietà in Italia e Repubblica Ceca [A11, U] |
| **Fatturazione** | Oraria con tetto mensile; fatture per mese solare, emesse fino a 28 giorni dopo la fine del mese; si paga finché il server esiste [H6, U] | Mensile, semestrale o annuale. Con 12 mesi si paga in anticipo: il configuratore mostra «45,72 € +tasse/12 mesi» per VPS-1 [O2, U]. Fattura a ogni ordine e rinnovo, con addebito automatico [O7, U] | Credito prepagato; il rinnovo avviene solo dal credito [A8, U]; con credito insufficiente il servizio è sospeso o cessa [A7, A8, U]; fattura per ogni ricarica [A7, U]. Nel listino dei VPS c'è solo il prezzo mensile [A2, U] |
| **Recesso e disdetta** | Nessuna durata minima indicata; disdetta generale con 30 giorni di preavviso a fine mese (T&C §2.5–2.6) [H13, U]; per il cloud la fatturazione cessa con l'eliminazione del server [H6, U]. Le condizioni specifiche Cloud non sono state lette | Rinnovo automatico per la stessa durata; per evitarlo si disattiva l'Auto-renew entro il 19 del mese, oppure del mese precedente se il ciclo non è mensile [O7, O8, U]. Il configuratore spiega che lo sconto vale per la durata d'impegno [O2, U] | Recesso **in qualsiasi momento senza penali**, efficace entro 30 giorni (art. 13.2) [A7, U]; rimborso del credito non usato (Sez. III, art. 5.1) [A7, U] |
| **Portabilità dei dati** | Nelle T&C non c'è una procedura; i backup vanno tenuti fuori dal server (§5.5) [H13, U] | Recupero a carico del cliente; «OVHcloud non mette a disposizione dei clienti alcun mezzo specifico»; assistenza alla reversibilità a pagamento; i contenuti, backup compresi, sono cancellati alla cessazione (CG 6.4–6.5) [O8, U] | Art. 10bis «Migrazione del Servizio»: richiesta con 30 giorni di preavviso, accesso mantenuto per esportare, poi 30 giorni per completare prima della cancellazione [A7, U] |
| **Assistenza in italiano** | **No**: telefono in tedesco e inglese (NBG, FSN) o solo inglese (HEL) [H12, U] | **Sì**: telefono +39 02 5560 0423, lunedì-venerdì 8-18 [O2, U] | **Sì**: contratto in italiano, richieste tramite assistenza.aruba.it [A7, U]; «Supporto tecnico H24» [A5, U]. Che l'assistenza tecnica risponda in italiano è una deduzione [D] |

---

## 2. Backup cifrati fuori sede presso un altro fornitore UE (DR-298)

Il backup viene cifrato prima dell'invio (DR-298), quindi conta che lo strumento acceda alla destinazione; la
cifratura del fornitore non serve. I costi per 50-100 GB sono calcoli miei [D] sul prezzo unitario ufficiale.

| Candidato | Prezzo per circa 50-100 GB | Uscita e ripristino | Sedi UE | DPA | Accesso con restic, rclone o S3 | Società e capogruppo | Va bene se il server è da… |
|---|---|---|---|---|---|---|---|
| **Hetzner Storage Box BX11** | 1 TB a **3,20 €/mese**; non ci sono taglie più piccole [H14, U] | Traffico illimitato [H14, U] | Germania o Finlandia, a scelta [H14, U] | Art. 28, «optional», da concludere nell'account [H14, H8, U] | SFTP, SCP, rsync via SSH, WebDAV, SMB; **Restic, Rclone, BorgBackup** citati espressamente; 10 snapshot; nessuna durata minima, disdetta immediata [H14, U] | Hetzner Online GmbH (DE), nessuna capogruppo extra-UE indicata [H11, U] | OVH **sì** · Aruba **sì** · Hetzner **no** |
| **OVHcloud Object Storage** (S3) | One Zone Standard circa 0,0071 €/GiB/mese; Multi Zone Standard circa 0,0140 €/GiB/mese [O11, U]. Quindi 100 GiB ≈ **0,71 €** (One Zone) o 1,40 € (Multi Zone) [D] | Traffico esterno in entrata e uscita gratuito [O11, U] | Strasburgo, Gravelines, Roubaix, Parigi (3 zone), **Milano (3 zone)**, Francoforte/Limburg, Varsavia; Londra è fuori UE [O12, U]. La pagina non dice in quali sedi c'è la classe One Zone | Stesso DPA di OVH [O6, U] | Compatibile S3; «OVHcloud» è fra i fornitori di rclone [R1, U]; restic tramite S3 [D] | OVH S.r.l. (IT), gruppo francese con affiliate extra-UE; caso canadese [O9, U; T1, T] | Hetzner **sì** · Aruba **sì** · OVH **no** |
| **Aruba Cloud Object Storage** (S3) | A consumo: 0,00028 €/ora per 10 GB, a blocchi di 10 GB [A5, A6, U]. Su 730 ore fa 50 GB ≈ **1,02 €** e 100 GB ≈ **2,04 €/mese** [D]. Il «da 0,011 €/GB/mese» della pagina riguarda i pacchetti da 4 TB in su [A5, A6, U; D] | Uscita 0,50 € ogni 10 GB [A6, U]; ripristinare 100 GB costa circa 5 € [D] | «7 Data Center in Italia e in Europa», region a scelta [A5, U]. Città ed endpoint non letti; da terzi l'endpoint `r1-it` [T4, T] | Art. 21 delle Condizioni Cloud [A7, U] | «supporta pienamente il protocollo S3»; guide ufficiali con rclone [A5, U]. Aruba non è nell'elenco dei fornitori di rclone: si usa la configurazione S3 generica [R1, U; D] | Aruba S.p.A. (IT) [A11, U]; servizio qualificato ACN [A5, U] | Hetzner **sì** · OVH **sì** · Aruba **no** |
| **Scaleway Object Storage** (S3) | Prezzo per Parigi: One Zone **0,00803 €/GB/mese**, Multi-AZ 0,01606 €/GB/mese [S1, U]. Quindi 100 GB ≈ **0,80 €** o 1,61 € [D]. IVA non indicata sulla pagina | 75 GB/mese di uscita gratuiti, poi 0,01 €/GB [S1, U] | Parigi, Amsterdam, Varsavia, **Milano**: Standard One Zone e Multi-AZ disponibili in tutte e quattro [S2, U] | «Data Processing Agreement» scaricabile dalla pagina dei contratti [S3, U]; non verificato se si accetti con le condizioni generali | Compatibile S3; «Scaleway» è fra i fornitori di rclone [R1, U] | Scaleway SAS, Parigi [S4, U]; «A subsidiary of the iliad Group» (FR) [S5, U] | Hetzner **sì** · OVH **sì** · Aruba **sì** |

**Fornitori con capogruppo extra-UE.** Fra i quattro candidati nessuno ha una capogruppo extra-UE dichiarata.
Due precisazioni:

- il gruppo OVHcloud ha affiliate fuori UE, ed è oggetto del caso canadese citato sopra [O9, U; T1, T];
- servizi S3 diffusi come Backblaze B2, Wasabi, Amazon S3 e Cloudflare R2 hanno capogruppo statunitense. È
  un'informazione generale che non ho verificato oggi, e per questo li ho esclusi senza esaminarli.

---

## 3. Differenze rilevanti, senza raccomandazione

- **Prezzo da 8 GB:**
  - OVH costa 7,21 € con 12 mesi anticipati e 8,49 € senza impegno, ma oggi è **esaurito in tutta l'UE**;
  - Aruba costa 11,79 € al mese, con credito prepagato;
  - Hetzner chiede 35,99 € per CPX32; il CX33 da 8,99 € risulta «not available».
- **Disco:** VPS-2 di OVH ha 75 GB, il minimo indicato per il progetto. Aruba O4A8 ha 80 GB, Hetzner CPX32 ne ha
  160. Su OVH si possono aggiungere dischi: 50 GB costano 2,15 € al mese [O2, U].
- **Backup del fornitore:**
  - OVH ne include uno giornaliero, ma nello stesso datacenter;
  - Hetzner li fa pagare in proporzione al server;
  - Aruba non ne fa (art. 7.4) e offre solo snapshot di 48 ore.
- **DPA:** OVH e Aruba lo integrano nel contratto. Hetzner chiede di accettarlo espressamente nell'account,
  indicando i tipi di dati.
- **Dati in Italia:** Aruba è in Italia. OVH prevede Milano, oggi esaurita. Hetzner ha sedi solo in Germania e
  Finlandia per l'UE.
- **Assistenza in italiano:** c'è con OVH e Aruba, non con Hetzner.
- **Vincolo contrattuale:**
  - Hetzner fattura a ore, senza minimo;
  - OVH dà lo sconto solo con impegno di 6 o 12 mesi, rinnovato in automatico;
  - Aruba consente il recesso in ogni momento, con rimborso del credito non usato.
- **Portabilità:** Aruba ha una clausola di migrazione con tempi definiti (art. 10bis). OVH lascia il recupero al
  cliente. Nelle T&C generali di Hetzner non ho trovato una procedura.

---

## 4. Contraddizioni con il confronto del 2026-10-28

1. **Hetzner, prezzo da 4 GB.** Il 28 era indicato «Regular Performance da 6,49 €» come VPS da 4 GB. Oggi 6,49 € è
   il prezzo di **CPX02, che ha 1 vCPU e 1 GB**. I piani Regular Performance costano **19,99 € (CPX22, 4 GB)** e
   **35,99 € (CPX32, 8 GB)** [H1, U]. I piani economici da 4 e 8 GB (CX23 a 5,99 €, CX33 a 8,99 €) sono segnati «not
   available» [H2, U]. Il listino pubblico di Hetzner risulta aggiornato il 2026-10-08 [H5, A]. Gli aumenti di
   aprile e giugno 2026, citati da fonti terze, non li ho riverificati.
2. **Hetzner, sedi.** Il 28 erano indicate Norimberga e Falkenstein. La pagina di CPX22 e CPX32 elenca invece NBG1
   e HEL1, senza FSN1 [H1, U], mentre il listino comprende anche FSN1 [H5, A].
3. **OVH, Milano.** Il 28 risultava «non confermata per le VPS». Oggi il catalogo pubblico delle VPS 2027 include
   **EU-SOUTH-MIL** [O3, A] e la verifica di disponibilità la elenca [O4, A]. Milano è quindi prevista per le VPS, ma
   il 2026-10-30 è «out-of-stock».
4. **OVH, condizione di prezzo.** È confermato che 7,21 € richiede l'impegno di 12 mesi pagato in anticipo. Senza
   impegno il prezzo è **8,49 €** [O3, A; O2, U].
5. **OVH, disponibilità.** Il 28 la disponibilità non era stata rilevata. Oggi tutte le VPS 2027 Linux sono esaurite
   in ogni sede UE, Local Zone comprese [O4, A; O2, U].
6. **OVH, località.** La frase «13 località in Europa» non è nel testo statico della pagina riletta oggi: il blocco
   delle località viene caricato dinamicamente. Il catalogo elenca 7 sedi europee ordinarie, di cui una (UK) fuori
   UE, e 7 Local Zone, di cui una (Zurigo) fuori UE [O3, A]. Novità: **le Local Zone non supportano Docker** [O1, U].
7. **Aruba.** Il 28 il VPS O2A4 a 6,29 € «compare solo su un aggregatore». Oggi è sulla **pagina ufficiale** e nel
   listino [A1, A2, U]. Il piano da 8 GB, VPS O4A8, costa 11,79 € [A2, U]. Il «CS O2A4 a 17,52 €» del 28 proveniva
   dal listino «Virtual Data Center», che è un altro prodotto.
8. **IPv4.** Il 28 era «da verificare». Oggi risulta incluso nel prezzo per tutti e tre i fornitori; per Hetzner
   vale 0,50 € del totale [H1, U; H5, A; O1, U; A1, U].

---

## 5. Fonti, tutte lette il 2026-10-30

### Hetzner

| Codice | Tipo | Fonte |
|---|---|---|
| H1 | U | https://www.hetzner.com/cloud/regular-performance/ — prezzi letti nella pagina renderizzata |
| H2 | U | https://www.hetzner.com/cloud/cost-optimized/ |
| H3 | U | https://www.hetzner.com/cloud/general-purpose/ |
| H4 | U | https://www.hetzner.com/cloud/ |
| H5 | A | https://website-price-api.hetzner.com/api/v1/products/CLOUD_126%2BCLOUD_21 (CPX32 con IPv4), …/CLOUD_124%2BCLOUD_21 (CPX22), …/CLOUD_21 (IPv4), …/views/cloud_matrix (`updatedAt` 2026-10-08) |
| H6 | U | https://docs.hetzner.com/cloud/billing/faq/ |
| H7 | U | https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/ |
| H8 | U | https://docs.hetzner.com/general/company-and-policy/data-protection-at-hetzner — rimanda a `hetzner.com/AV/DPA_en.pdf` (non aperto) e a `accounts.hetzner.com/account/dpa` (richiede login, non aperto) |
| H11 | U | https://www.hetzner.com/legal/legal-notice/ |
| H12 | U | https://www.hetzner.com/support/ |
| H13 | U | https://www.hetzner.com/legal/terms-and-conditions/ |
| H14 | U | https://www.hetzner.com/storage/storage-box/ |

### OVHcloud

| Codice | Tipo | Fonte |
|---|---|---|
| O1 | U | https://www.ovhcloud.com/it/vps/ |
| O2 | U | https://www.ovhcloud.com/it/vps/configurator/?planCode=vps-2027-model2&brick=VPS%2BModel%2B2&pricing=upfront12 — configuratore pubblico senza login, consultato soltanto (nessun carrello) |
| O3 | A | https://eu.api.ovh.com/1.0/order/catalog/public/vps?ovhSubsidiary=IT — prezzi per modalità `default`, `upfront6` e `upfront12`, sedi, opzioni |
| O4 | A | https://eu.api.ovh.com/1.0/vps/order/rule/datacenter?ovhSubsidiary=IT&planCode=vps-2027-model2 (e model1, model3, model4, model1.LZ, model2.LZ) |
| O5 | U | https://www.ovhcloud.com/it/terms-and-conditions/contracts/ |
| O6 | U | https://contract.eu.ovhapis.com/1.0/pdf/OVH_Data_Protection_Agreement-it.pdf (versione 17.10.2025) |
| O7 | U | https://contract.eu.ovhapis.com/1.0/pdf/Conditions_Particulieres_VPS-it.pdf (versione 10.04.2025) |
| O8 | U | https://contract.eu.ovhapis.com/1.0/pdf/contrat_genServices-it.pdf (versione 17.01.2025) |
| O9 | U | https://contract.eu.ovhapis.com/1.0/pdf/OVHcloud_Affiliates-IT.pdf (versione 13.10.2025) |
| O10 | U | https://contract.eu.ovhapis.com/1.0/pdf/OVH_Sub_processors-it.pdf — link presente su O5, documento non aperto |
| O11 | U | https://www.ovhcloud.com/it/public-cloud/prices/ (sezione Object Storage) |
| O12 | U | https://www.ovhcloud.com/it/public-cloud/regions-availability/ |

### Aruba Cloud

| Codice | Tipo | Fonte |
|---|---|---|
| A1 | U | https://www.cloud.it/vps/ |
| A2 | U | https://www.cloud.it/prezzi/bare-metale-vps/vps-server-virtuali-privati |
| A3 | U | https://www.cloud.it/openstack-cloud-server/ |
| A4 | U | https://www.cloud.it/prezzi/bare-metale-vps/cloud-backup |
| A5 | U | https://www.cloud.it/cloud-storage/cloud-object-storage |
| A6 | U | https://www.cloud.it/prezzi/public-cloud/cloud-object-storage |
| A7 | U | https://www.cloud.it/termini-e-condizioni e il PDF «Condizioni di fornitura dei servizi Aruba Cloud e Data Center» v.1.4, pubblicato l'8.10.2026: https://www.cloud.it/doc/jcr:9cfb945b-9932-4f85-9b44-655ff1bdc692/lang:it/CONDIZIONI%20DI%20FORNITURA%20DEI%20SERVIZI%20ARUBA%20CLOUD%20e%20Data%20center%20v.1.4.2026-10-14-18-17-57.pdf |
| A8 | U | https://kb.arubacloud.com/en/bare-metal-vps/cloud-vps/preliminary-information.aspx |
| A9 | U | https://kb.arubacloud.com/en/bare-metal-vps/cloud-vps/snapshot.aspx |
| A10 | U | https://kb.arubacloud.com/en/bare-metal-vps/cloud-vps/create.aspx |
| A11 | U | https://www.cloud.it/perche-scegliere-arubacloud/sovranita-dei-dati-aruba-cloud |

### Scaleway

| Codice | Tipo | Fonte |
|---|---|---|
| S1 | U | https://www.scaleway.com/en/pricing/storage/ — prezzi mostrati per la region Parigi |
| S2 | U | https://www.scaleway.com/en/product-availability-by-region/ |
| S3 | U | https://www.scaleway.com/en/contracts/ |
| S4 | U | https://www.scaleway.com/en/legal-notice/ |
| S5 | U | https://www.scaleway.com/en/about-us/ |

### Strumenti

| Codice | Tipo | Fonte |
|---|---|---|
| R1 | U | https://rclone.org/s3/ — documentazione dello strumento, elenco dei fornitori S3 |

### Fonti di terze parti

| Codice | Tipo | Fonte |
|---|---|---|
| T1 | T | https://www.theregister.com/2025/11/27/canada_court_ovh |
| T2 | T | https://heise.de/-11092029 |
| T3 | T | https://www.vpsbenchmarks.com/trials/aruba_cloud_performance_trial_10Aug2025 (VPS O4A8, Arezzo) e https://www.vpsbenchmarks.com/trials/aruba_cloud_performance_trial_22Jun2026/yabs (PRO O4A8, Arezzo) |
| T4 | T | https://forum.rclone.org/t/aruba-cloud-object-storage/19704 (endpoint `r1-it`) |

Risultati di terzi contraddetti dalle fonti ufficiali: una ricerca indicava che Scaleway Object Storage avesse solo
tre region, ma S2 elenca anche Milano.

---

## 6. Da verificare ancora

### Hetzner

- Se CPX32 e CPX22 si possano davvero ordinare a NBG1 o HEL1: serve la console, con login.
- Il prezzo esatto dei backup per CPX32: la pagina mostra solo «da 1,198 €».
- Il conflitto sulle sedi: FSN1 è nel listino ma non nella pagina.
- Le condizioni specifiche Cloud e vServer, e la cancellazione o restituzione dei dati a fine contratto.
- Il testo del DPA in `hetzner.com/AV/DPA_en.pdf`, che non ho aperto.

### OVHcloud

- Quando VPS-2 tornerà disponibile nelle sedi UE, Milano compresa. Oggi è «out-of-stock» ovunque.
- Il backup «Standard»: il catalogo lo prezza 0,50 €/mese per VPS-2, mentre pagina e configuratore lo dicono
  «incluso».
- I prezzi di snapshot e backup Premium per VPS-2: li ho letti solo nel catalogo, non sulla pagina.
- Il recesso anticipato con impegno di 6 o 12 mesi: nelle CG lette non ho trovato rimborsi.
- Il conteggio «13 località in Europa», che oggi non compare nel testo statico.
- In quali sedi esiste la classe One Zone dell'Object Storage.
- L'elenco dei sub-responsabili (O10), che non ho aperto.

### Aruba Cloud

- In quale data center si attiva VPS O4A8 (Arezzo o Bergamo) e se è disponibile: si vede solo nel carrello, che
  non ho aperto.
- Se esista una tariffa annuale per i Cloud VPS: il listino mostra solo il prezzo mensile.
- Come avviene il rinnovo mensile dal credito: la pagina della knowledge base non l'ho letta.
- Se l'IPv4 sia incluso anche nell'OpenStack Cloud Server PRO O4A8.
- Region ed endpoint dell'Object Storage: ho solo una fonte terza.

### Scaleway

- Prezzi per Milano e per le altre region (ho letto solo Parigi).
- IVA.
- Come si accetta il DPA.

### Generale

- L'adeguatezza dei DPA e dei trasferimenti va valutata da un professionista privacy prima della produzione
  (DR-073, MI-06). Questo documento **non dichiara conformità al GDPR**.
- Tutti i prezzi e le disponibilità sono un'istantanea del 2026-10-30. Le disponibilità di OVH in particolare
  cambiano spesso.
