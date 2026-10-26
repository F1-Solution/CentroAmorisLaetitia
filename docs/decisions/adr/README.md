# Architecture Decision Record — indice

Fase 1B, wave `1B-W1`. Una ADR per decisione: contesto, opzioni reali, scelta
proposta, alternativa scartata con il motivo, conseguenze.

**Tutte e dieci le ADR sono state approvate il 2026-09-14**, in blocco, con la
decisione **DR-038** del Round 4. Da quella data il vincolo di D5 e DR-035 è
soddisfatto: lo scaffold del monorepo e l'installazione delle dipendenze sono
autorizzati, ed è ciò che la Fase 1C esegue.

Due precisazioni che restano vere:

- **ADR-009** è approvata nella **forma** (Docker Compose su host singolo). La scelta
  del **fornitore** resta la decisione aperta **D6**, con termine alla Fase 1F.
- **ADR-007** impone nel proprio §6 un **riesame obbligatorio** prima della fase
  gestionale. L'approvazione in blocco lo conferma, non lo cancella.

Una ADR che cambia non si riscrive: si sostituisce con una nuova ADR che cita la
precedente, e la decisione si registra in
[`../decision-register.md`](../decision-register.md) con un identificatore `DR-0xx`.

---

## Elenco

| ADR | Titolo | Decide | Stato |
|---|---|---|---|
| [ADR-001](ADR-001-framework-api.md) | Framework del servizio API | Fastify · NestJS · solo Next.js | **approvata** (DR-038) |
| [ADR-002](ADR-002-orm.md) | Accesso al database e migrazioni | Prisma · Drizzle · Kysely | **approvata** (DR-038) |
| [ADR-003](ADR-003-reverse-proxy.md) | Reverse proxy e terminazione TLS | Caddy · Nginx · Traefik | **approvata** (DR-038) |
| [ADR-004](ADR-004-storage-media-e-url.md) | Storage dei media e URL storici | 3 strategie di percorso | **approvata** (DR-038) |
| [ADR-005](ADR-005-modello-contenuti-a-blocchi.md) | Rappresentazione dei contenuti | HTML · blocchi · modello doppio | **approvata** (DR-038) |
| [ADR-006](ADR-006-editor-contenuti.md) | Editor redazionale | TipTap · BlockNote · Lexical | **approvata** (DR-038) |
| [ADR-007](ADR-007-autenticazione-e-sessioni.md) | Autenticazione e sessioni | sessioni proprie · Auth.js · Better Auth | **approvata** (DR-038) |
| [ADR-008](ADR-008-struttura-applicazioni.md) | Struttura delle applicazioni nel monorepo | app unica · due app · SPA | **approvata** (DR-038) |
| [ADR-009](ADR-009-hosting-e-deployment.md) | Forma del deployment | Compose su VPS singolo | **approvata nella forma** (DR-038); fornitore aperto in D6 |
| [ADR-010](ADR-010-form-fase-1.md) | Funzionamento dei form in Fase 1 | attuazione di DR-032 | **approvata** (DR-038) |
| [ADR-011](ADR-011-campo-telefono-con-prefisso.md) | Campo telefono con bandiera e prefisso | parità dei form, `1E-W6` | **approvata** (DR-132) |
| [ADR-012](ADR-012-pulizia-dei-metadati.md) | Pulizia dei metadati di PDF e MP4 | programmi esterni `qpdf` e `ffmpeg`, `1G-W6` | **approvata** (DR-258, DR-262) |

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
