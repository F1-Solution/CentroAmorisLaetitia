# Architecture Decision Record — indice

Fase 1B, wave `1B-W1`. Una ADR per decisione: contesto, opzioni reali, scelta
proposta, alternativa scartata con il motivo, conseguenze.

**Nessuna ADR è vincolante finché l'utente non la approva.** Fino ad allora lo
stato resta `proposta` e non autorizza alcuno scaffold né alcuna dipendenza
(vincolo di D5, confermato da DR-035).

Quando una ADR viene approvata: si aggiorna il campo **Stato** qui e nel file, e si
registra la decisione in [`../decision-register.md`](../decision-register.md) con un
identificatore `DR-0xx`.

---

## Elenco

| ADR | Titolo | Decide | Stato |
|---|---|---|---|
| [ADR-001](ADR-001-framework-api.md) | Framework del servizio API | Fastify · NestJS · solo Next.js | **proposta** |
| [ADR-002](ADR-002-orm.md) | Accesso al database e migrazioni | Prisma · Drizzle · Kysely | **proposta** |
| [ADR-003](ADR-003-reverse-proxy.md) | Reverse proxy e terminazione TLS | Caddy · Nginx · Traefik | **proposta** |
| [ADR-004](ADR-004-storage-media-e-url.md) | Storage dei media e URL storici | 3 strategie di percorso | **proposta** |
| [ADR-005](ADR-005-modello-contenuti-a-blocchi.md) | Rappresentazione dei contenuti | HTML · blocchi · modello doppio | **proposta** |
| [ADR-006](ADR-006-editor-contenuti.md) | Editor redazionale | TipTap · BlockNote · Lexical | **proposta** |
| [ADR-007](ADR-007-autenticazione-e-sessioni.md) | Autenticazione e sessioni | sessioni proprie · Auth.js · Better Auth | **proposta** |
| [ADR-008](ADR-008-struttura-applicazioni.md) | Struttura delle applicazioni nel monorepo | app unica · due app · SPA | **proposta** |
| [ADR-009](ADR-009-hosting-e-deployment.md) | Forma del deployment | Compose su VPS singolo | **proposta, decisione rinviata alla 1F** |
| [ADR-010](ADR-010-form-fase-1.md) | Funzionamento dei form in Fase 1 | attuazione di DR-032 | **proposta** |

## Come leggerle

Ogni ADR ha la stessa struttura:

1. **Stato** e data.
2. **Contesto** — i fatti del progetto che rendono necessaria la decisione, con
   riferimento alla sorgente o al requisito.
3. **Opzioni** — almeno due reali, ciascuna con costi e rischi.
4. **Scelta proposta** e **alternativa scartata** con il motivo dello scarto.
5. **Conseguenze** — cosa diventa più facile e cosa più difficile.
6. **Reversibilità** — quanto costa cambiare idea dopo.
7. **Verifica** — come si controlla, più avanti, che la scelta abbia retto.
