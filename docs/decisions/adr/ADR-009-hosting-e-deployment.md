# ADR-009 — Forma del deployment

| | |
|---|---|
| **Stato** | **proposta sulla forma. La scelta del fornitore resta aperta e si decide in Fase 1F (D6)** |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | come è fatto il rilascio. **Non** decide dove, né con quali costi |
| **Origine** | DR-006, D6 ancora aperta, MI-04 |

---

## 1. Perché questa ADR esiste adesso, se la decisione è rinviata

D6 — fornitore, dominio, costi — è deliberatamente rinviata alla Fase 1F, per non
decidere ora su listini che a quel punto saranno vecchi di mesi. Non è però rinviabile
la **forma** del rilascio, perché condiziona come si scrive il codice: variabili
d'ambiente, migrazioni, health check, gestione dei file, avvio dei processi.

Questa ADR fissa la forma. Il fornitore lo sceglie l'utente in Fase 1F, con costi
reali alla mano.

## 2. Contesto

| Fatto | Fonte | Effetto |
|---|---|---|
| Docker Compose per sviluppo e primo rilascio | DR-006 | La forma è già decisa in parte |
| Utenti simultanei < 100, ~100 documenti al mese | RB-02 | Un solo host basta e avanza |
| Disponibilità *best effort* | RB-04 | Nessuna alta disponibilità, nessun bilanciamento |
| Manutentore: una persona | RB-03 | Meno pezzi mobili possibile |
| Backup giornaliero | RN-05 | Requisito, non opzione |
| Dati personali di particolare delicatezza | RN-02, R-04 | La collocazione geografica dei dati è materia di D6, con verifica legale |
| Produzione attuale su hosting condiviso, PHP 7.4 | `1B-W0` §7 | L'hosting attuale **non** può ospitare il sistema nuovo |

L'ultimo punto va detto chiaramente perché chiude un'opzione: l'hosting attuale è un
ambiente PHP condiviso, senza Docker e senza Node.js. L'opzione B di D6 —
«mantenere l'hosting attuale» — **non è praticabile** per il sistema nuovo. Resta
praticabile per il sito WordPress finché resta in piedi.

## 3. Forma proposta

### 3.1 Servizi

| Servizio | Ruolo | Persistenza |
|---|---|---|
| `caddy` | TLS, instradamento (ADR-003) | volume dei certificati |
| `web` | sito pubblico (ADR-008) | nessuna |
| `admin` | area amministrativa | nessuna |
| `api` | API (ADR-001) | nessuna |
| `db` | PostgreSQL | **volume dati** |
| `objects` | storage S3-compatible | **volume dati** |
| `backup` | processo periodico di backup | volume di destinazione |

Nessun servizio di cache separato: a questi volumi non serve, e sarebbe un pezzo in
più da sorvegliare. Se le misure della Fase 1F dicessero il contrario, si aggiunge
allora, con il dato in mano.

### 3.2 Storage a oggetti in produzione

Due strade, entrambe compatibili con DR-005, da decidere in Fase 1F insieme a D6:

| | MinIO sullo stesso host | Servizio S3-compatible gestito |
|---|---|---|
| Costo | nessuno oltre l'host | canone, di solito modesto |
| Backup | a carico nostro | spesso incluso o replicato |
| Collocazione dei dati | nota e sotto controllo | da verificare per il GDPR |
| Pezzi da mantenere | uno in più | uno in meno |

In sviluppo è **MinIO**, come DR-005 stabilisce, e non è in discussione.

### 3.3 Configurazione

Tutta la configurazione viene da **variabili d'ambiente**, verificate all'avvio con
Zod: se manca o è malformata una variabile obbligatoria, il servizio **non parte** e
dice quale. Un servizio che parte con una configurazione incompleta e fallisce più
tardi è molto più difficile da diagnosticare.

`.env.example` sta nel repository con valori fittizi e commentati. `.env` con valori
reali **non entra mai** in Git.

### 3.4 Migrazioni

Le migrazioni girano come **passo esplicito del rilascio**, non all'avvio
dell'applicazione. Un'applicazione che migra all'avvio, se riavviata più volte,
esegue migrazioni in parallelo.

Su database di produzione ogni migrazione è preceduta da backup e richiede
**conferma puntuale** dell'utente, come `CLAUDE.md` impone.

### 3.5 Backup — requisito RN-05

| Cosa | Come | Frequenza |
|---|---|---|
| PostgreSQL | dump compresso, coerente | giornaliero |
| Storage a oggetti | sincronizzazione incrementale | giornaliero |
| Configurazione e `Caddyfile` | sono in Git | a ogni modifica |

Conservazione: 7 giornalieri, 4 settimanali, 6 mensili. Destinazione **fuori
dall'host**: un backup che vive solo sulla macchina di cui è il backup non è un
backup.

**Il ripristino va provato prima del rilascio**, non dopo il primo guasto. È un
punto del gate di Fase 1F.

### 3.6 Health check e osservabilità minima

Ogni servizio espone `/health` con verifica delle dipendenze. In Fase 1 bastano:
log strutturati in JSON senza dati personali, e una sonda esterna che controlla che
il sito risponda. RS-06 chiede telemetria applicativa, ma appartiene alla fase
gestionale.

### 3.7 Rilascio

Immagini costruite dalla CI di GitHub Actions (DR-008), con l'hash del commit come
etichetta. Mai `latest` in produzione: senza un'etichetta precisa non si sa cosa sta
girando e non si può tornare indietro.

Il rientro è la sostituzione dell'etichetta con quella precedente e il riavvio. Per
le migrazioni il rientro è il ripristino del backup: non tutte le migrazioni si
annullano, ed è più onesto dirlo che promettere il contrario.

### 3.8 Conferme obbligatorie

Ogni rilascio in produzione, ogni migrazione su dati reali, ogni modifica di DNS o
certificati, ogni configurazione di invio email richiede **conferma puntuale**
dell'utente, con comando, file toccati, impatto, backup, rientro e verifica mostrati
prima. Una conferma vale per quell'azione e non si eredita.

## 4. Cosa resta da decidere in Fase 1F (D6, MI-04)

1. Fornitore e taglia della macchina, con costi reali.
2. Registrar del dominio e gestione DNS.
3. Se usare Cloudflare davanti, e con quale configurazione.
4. **Collocazione geografica dei dati**, con verifica rispetto al GDPR. Con dati di
   consulenze familiari non è un dettaglio amministrativo.
5. Storage a oggetti autogestito o gestito.
6. Chi sostiene i costi ricorrenti.
7. Destinazione dei backup fuori host.

## 5. Conseguenze

**Più facile:** l'ambiente di sviluppo somiglia alla produzione; il rilascio è
riproducibile; la scelta del fornitore non condiziona il codice.

**Più difficile:** un host unico è un punto singolo di guasto. È coerente con RB-04
e va detto all'utente in modo esplicito, non nascosto in una nota.

## 6. Reversibilità

**Alta.** Tutto è in container con configurazione esterna: cambiare fornitore
significa spostare volumi e ripuntare il DNS.

## 7. Verifica

**Fase 1F:** lo stack si ricostruisce da zero su una macchina pulita seguendo la
sola documentazione; un ripristino completo da backup è stato **provato** e
documentato; nessun segreto in Git; ogni servizio risponde al proprio health check;
è possibile tornare all'etichetta precedente.
