# ADR-001 — Framework del servizio API

| | |
|---|---|
| **Stato** | **approvata** il 2026-09-14 con DR-038 (approvazione in blocco) |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | con quale framework Node.js si costruisce il servizio API |
| **Origine** | D5, confermata da DR-035; direttiva DR-001 |

---

## 1. Contesto

La direttiva fissa **Node.js + TypeScript** per il backend e lascia il framework a
una ADR. `CLAUDE.md` aggiunge due vincoli che pesano sulla scelta: **validazione
con Zod o equivalente** e **OpenAPI documentata e testata**.

Fatti del progetto che contano davvero:

| Fatto | Fonte | Perché conta |
|---|---|---|
| Il primo rilascio contiene sito pubblico **più** CMS minimo | DR-033 | Serve già un'API di scrittura, non solo di lettura |
| Il software dovrà coprire sito, gestionale e futuro client mobile | RB-06 | Un'API HTTP vera è inevitabile: non basta il solo server di Next.js |
| L'area amministrativa diventerà una **PWA installabile** | DR-030, DR-017 | Il client PWA parlerà con un'API, non con azioni server accoppiate alle pagine |
| Team di sviluppo: **1 persona** | RB-03 | La verbosità costa più della potenza |
| Utenti simultanei < 100, ~100 documenti al mese | RB-02 | Le prestazioni non sono un criterio discriminante |
| Audit log obbligatorio su ogni operazione di backend | RU-05, RN-03 | Serve un punto unico in cui intercettare ogni scrittura |

La scelta non è fra «veloce» e «lento»: a questi volumi qualunque opzione regge. È
fra **quanto impianto** conviene a una persona sola che deve arrivare in produzione
con la Fase 1 e poi costruirci sopra nove moduli gestionali.

## 2. Opzioni

### Opzione A — Fastify come servizio separato

Fastify con `@fastify/swagger`, `fastify-type-provider-zod`, plugin ufficiali per
cookie, CORS, rate limiting, multipart.

- **A favore:** gli schemi Zod sono contemporaneamente validazione a runtime, tipi
  TypeScript e **sorgente dell'OpenAPI**: una sola dichiarazione per tre scopi, che
  è esattamente ciò che `CLAUDE.md` chiede. Impianto minimo. I plugin coprono senza
  scrivere codice proprio ciò che serve al progetto. Gli hook (`onRequest`,
  `preHandler`, `onResponse`) danno il punto unico per audit log e autorizzazione.
- **Contro:** nessuna struttura imposta. Con nove moduli in arrivo, l'organizzazione
  delle cartelle e l'iniezione delle dipendenze sono a carico di chi scrive, e un
  progetto senza disciplina degenera.
- **Costo di adozione:** basso.

### Opzione B — NestJS come servizio separato

NestJS con moduli, provider, decoratori, `@nestjs/swagger`.

- **A favore:** la struttura c'è già ed è quella che regge bene nove moduli
  eterogenei. L'iniezione delle dipendenze rende i test più semplici. Gli
  interceptor sono un ottimo posto per l'audit log. È l'opzione che invecchia meglio
  se un domani il progetto non fosse più di una persona sola.
- **Contro:** verboso. L'OpenAPI nasce dai decoratori e da `class-validator`, non
  da Zod: o si rinuncia a Zod, o si aggiunge `nestjs-zod` e si mantiene un pezzo di
  colla. Il tempo speso in impalcatura, con un team di una persona e una Fase 1 da
  chiudere, è tempo sottratto alla parità visiva, che è ciò che il gate misura.
- **Costo di adozione:** medio-alto.

### Opzione C — Nessun servizio separato: solo Next.js (Route Handlers e Server Actions)

- **A favore:** una sola applicazione da scrivere, distribuire e sorvegliare. Per la
  sola Fase 1 sarebbe sufficiente e sarebbe la strada più rapida.
- **Contro:** collide con RB-06 e con DR-030. Un client PWA e un eventuale client
  mobile hanno bisogno di un contratto HTTP stabile e versionato: le Server Actions
  non lo sono, e i Route Handlers lo diventano solo scrivendo a mano ciò che
  Fastify o NestJS danno di serie. Inoltre lega il ciclo di vita dell'API a quello
  del framework di frontend, che è la dipendenza che evolve più in fretta.
- **Costo di adozione:** bassissimo subito, alto dopo il gate.

## 3. Scelta proposta

**Opzione A — Fastify**, come servizio separato `apps/api` nel monorepo, con Zod
come unica fonte di verità per validazione, tipi e OpenAPI.

Disciplina che accompagna la scelta, e che va rispettata perché l'opzione A regga:

1. Un **modulo per dominio** (`content`, `media`, `menu`, `seo`, `redirects`,
   `settings`, `auth`), ciascuno con rotte, schemi e servizi propri.
2. Nessun accesso al database dalle rotte: solo attraverso i servizi del dominio.
3. Un **hook unico** che scrive l'audit log per ogni richiesta che modifica dati.
4. `GET /openapi.json` generata dagli schemi, e un test che fallisce se la
   specifica cambia senza che la modifica sia dichiarata.

## 4. Alternativa scartata e motivo

**NestJS** è scartato non perché sia peggiore in assoluto — a regime, con nove
moduli, sarebbe probabilmente più ordinato — ma perché il costo dell'impalcatura si
paga **adesso**, in una fase il cui unico criterio di successo è la parità visiva
del sito pubblico e un CMS realmente usabile. Se il progetto crescesse oltre la
persona sola, la migrazione da Fastify a NestJS è un lavoro di rotte e di
cablaggio, non di modello dati: il costo del ripensamento è contenuto e localizzato.

**Solo Next.js** è scartato perché contraddice RB-06 e DR-030: un'API che deve
servire anche una PWA e un futuro client mobile non può essere un dettaglio interno
del framework di frontend.

## 5. Conseguenze

**Più facile:** avere OpenAPI sempre allineata al codice; validare ai confini con
Zod come chiede `CLAUDE.md`; intercettare in un punto solo autorizzazione e audit;
sostituire il frontend senza toccare il backend.

**Più difficile:** mantenere ordine con nove moduli. La disciplina del §3 non è un
consiglio: senza, l'opzione A degenera e l'opzione B avrebbe avuto ragione.

**Nuove dipendenze introdotte:** `fastify`, `@fastify/cookie`, `@fastify/cors`,
`@fastify/rate-limit`, `@fastify/multipart`, `@fastify/swagger`,
`fastify-type-provider-zod`, `zod`. Tutte manutenute e senza costo di licenza.

## 6. Reversibilità

**Media.** Cambiare framework significa riscrivere le rotte e il cablaggio, non i
servizi di dominio né lo schema del database — a condizione che la disciplina del
§3 sia stata rispettata. Stima indicativa: pochi giorni, non settimane.

## 7. Verifica

Alla chiusura della Fase 1D si controlla che: esista `GET /openapi.json` generata e
non scritta a mano; ogni scrittura produca una riga di audit log; nessuna rotta
acceda direttamente al database. Se una di queste tre non è vera, la scelta non ha
retto e va riaperta prima della fase gestionale.
