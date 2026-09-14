# ADR-008 — Struttura delle applicazioni nel monorepo

| | |
|---|---|
| **Stato** | **approvata** il 2026-09-14 con DR-038 (approvazione in blocco) |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | quante applicazioni esistono e come si dividono le responsabilità |
| **Origine** | DR-003 (monorepo pnpm + Turborepo), DR-030, DR-018, DR-033 |

---

## 1. Contesto

DR-003 fissa monorepo pnpm con Turborepo. Restano da decidere **quante
applicazioni** ci stanno dentro.

Vincoli che pesano:

| Vincolo | Fonte | Effetto |
|---|---|---|
| La PWA riguarda **solo** l'area amministrativa | DR-030 | Il service worker non deve mai toccare il sito pubblico |
| Un service worker può servire pagine vecchie e **falsare i confronti visivi** | D12, motivazione della decisione | Tenerlo lontano dal sito pubblico durante la Fase 1E non è prudenza, è necessità |
| L'area amministrativa non deve assomigliare a WordPress | DR-018 | Design proprio, nessuna eredità dal sito pubblico |
| Il primo rilascio contiene sito **più** CMS minimo | DR-033 | Entrambe le applicazioni vanno in produzione insieme |
| Il sito pubblico deve essere veloce e indicizzabile | RC-08, RC-05 | Resa sul server, HTML statico dove possibile |
| L'area amministrativa non va indicizzata | buon senso, RU-04 | `noindex`, e meglio ancora non raggiungibile dai crawler |

Le due parti hanno requisiti opposti su quasi tutto: indicizzazione, cache, peso del
JavaScript, design, autenticazione, service worker.

## 2. Opzioni

### Opzione A — Una sola applicazione Next, con un gruppo di rotte `/admin`

- **A favore:** un solo progetto da configurare e distribuire; sessione condivisa
  senza sforzo; nessuna duplicazione di configurazione.
- **Contro:** stessa origine, quindi il service worker della PWA **può** intercettare
  le richieste del sito pubblico. Limitarne l'ambito è possibile ma è una
  configurazione da non sbagliare, e sbagliarla significa falsare la visual
  regression. Inoltre il pacchetto JavaScript tende a mescolarsi, e l'area
  amministrativa — che sarà molto più pesante — finisce per zavorrare pagine
  pubbliche che devono superare PageSpeed 80.

### Opzione B — Due applicazioni Next: `apps/web` e `apps/admin`

- **A favore:** separazione netta di service worker, indicizzazione, pacchetti,
  design e cache; `apps/web` resta leggero per sempre; l'area amministrativa può
  essere spostata su un sottodominio o protetta a livello di rete senza toccare il
  sito; la PWA si installa solo dove deve.
- **Contro:** due configurazioni da mantenere; la sessione va condivisa
  esplicitamente; qualche duplicazione iniziale.

### Opzione C — Sito Next e area amministrativa come applicazione a pagina singola servita dall'API

- **A favore:** massima separazione; l'area amministrativa non ha bisogno di resa sul
  server.
- **Contro:** due modelli di sviluppo diversi da mantenere per una persona sola;
  si perde la possibilità di riusare i componenti di resa dei blocchi per
  l'anteprima, che ADR-006 §3.3 rende obbligatoria.

## 3. Scelta proposta

**Opzione B.**

### 3.1 Struttura

```
apps/
  web/      Next.js — sito pubblico. Nessun service worker, nessun manifest.
  admin/    Next.js — area amministrativa. Diventerà PWA dopo il gate.
  api/      Fastify — API (ADR-001).
  importer/ Programma a riga di comando per la migrazione (ADR di 1B-W4).
packages/
  blocks/   Modello dei 14 blocchi (Zod) e componenti di resa. Usato da web e admin.
  db/       Schema Drizzle e migrazioni.
  contracts/ Schemi Zod condivisi e client generato dall'OpenAPI.
  ui/       Componenti dell'area amministrativa. Non usati dal sito pubblico.
  config/   ESLint, TypeScript, Prettier condivisi.
infra/
  compose/  Docker Compose, Caddyfile.
```

`packages/blocks` è il pacchetto chiave: è ciò che rende l'anteprima dell'area
amministrativa **identica** al sito, come ADR-006 esige. `packages/ui` è deliberatamente
separato e **non** viene usato dal sito pubblico: DR-018 vuole due estetiche
distinte, e condividere componenti visivi le farebbe convergere senza che nessuno lo
decida.

### 3.2 Instradamento

| Percorso | Destinazione |
|---|---|
| `/` e il sito pubblico | `apps/web` |
| `/admin/*` | `apps/admin` |
| `/api/*` | `apps/api` |
| `/media/*` | `apps/api`, che serve lo stream dallo storage (ADR-004 §3.6) |

Stesso dominio, percorsi distinti, gestiti da Caddy (ADR-003). Il cookie di sessione
è unico perché l'origine è una sola, e questo semplifica ADR-007.

Il sottodominio dedicato per l'area amministrativa resta possibile e si valuta in
Fase 1F: cambierebbe la configurazione del cookie, non l'architettura.

### 3.3 Regole che non si negoziano

1. **`apps/web` non registra alcun service worker e non serve alcun manifest**,
   per tutta la Fase 1 e finché il gate non è superato. Un test di Fase 1E lo
   verifica: se un service worker compare, i confronti visivi sono da rifare.
2. `apps/admin` risponde `X-Robots-Tag: noindex, nofollow` ed è escluso dal
   `robots.txt`.
3. `apps/web` **non importa** da `packages/ui`. Verificato da una regola di lint,
   non dalla buona volontà.
4. Nessuna delle due applicazioni Next parla direttamente al database: solo
   attraverso `apps/api`. L'unica eccezione ammessa è `apps/importer`, che è uno
   strumento di migrazione e non un servizio.

### 3.4 Nota sulla regola 4

È una scelta consapevole: Next.js consentirebbe di leggere il database direttamente
dai componenti server, e sarebbe più rapido da scrivere. Non lo si fa perché
altrimenti la stessa logica finirebbe scritta due volte — una nell'API per la PWA e
il futuro client mobile, una in Next per le pagine — e le due divergerebbero. Con
RB-06 all'orizzonte, la disciplina costa meno del doppione.

## 4. Alternativa scartata e motivo

**Opzione A** è scartata soprattutto per il service worker. Il progetto ha una
condizione di successo — la parità visiva approvata — che un service worker mal
delimitato può falsare in modo silenzioso e difficile da diagnosticare. La
separazione delle applicazioni rende l'errore **impossibile** invece che improbabile.
Il secondo motivo è il peso del JavaScript: l'area amministrativa crescerà molto, il
sito pubblico deve restare leggero.

**Opzione C** è scartata perché farebbe perdere il riuso dei componenti di resa per
l'anteprima, che è un requisito di ADR-006.

## 5. Conseguenze

**Più facile:** tenere leggero il sito pubblico; far crescere l'area amministrativa
senza toccare il sito; spostarla su un altro dominio o dietro una rete privata;
introdurre la PWA dopo il gate senza rischi per la parità.

**Più difficile:** due configurazioni di build; un po' di duplicazione iniziale;
ricordarsi che il sito non può importare i componenti dell'amministrazione — per
questo è una regola di lint.

## 6. Reversibilità

**Media.** Fondere due applicazioni Next è fattibile ma tocca configurazione,
instradamento e sessioni. Vale la pena decidere ora perché la separazione è la cosa
che protegge la parità, che è il criterio del gate.

## 7. Verifica

**Fase 1C:** le quattro applicazioni si avviano con un comando solo; la regola di
lint che vieta l'importazione fra sito e componenti amministrativi esiste e fallisce
quando deve.

**Fase 1E:** nessun service worker registrato su alcuna pagina pubblica, verificato
automaticamente; nessuna chiamata diretta al database da `apps/web` o `apps/admin`.
