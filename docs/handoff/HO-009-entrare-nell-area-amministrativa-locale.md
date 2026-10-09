# HO-009 — Entrare nell'area amministrativa locale con i contenuti importati

**Stato:** chiuso il 2026-10-09, su segnalazione dell'utente.

Scritto il 2026-10-04, dopo la creazione dell'account locale
(`.planning/phases/1D/LOCAL-ACCOUNT-PLAN.md`).

## Che cosa vedrai

L'area amministrativa con i **108 contenuti importati**, i media, i menu, il SEO
e i redirect. L'anteprima dell'editor mostra ogni contenuto reso con i
componenti dei blocchi. **Non è il sito pubblico**, che si ricostruisce in Fase
1E: l'aspetto non è ancora quello dell'originale.

## Prerequisiti

- Docker Desktop avviato, con `amoris-dev-db-1` e `amoris-dev-objects-1` attivi.
- L'account: indirizzo `administrator@locale.invalid`, ruolo «Redattore», che
  ha tutti e cinque i permessi e quindi accesso alle aree Redazione e
  Impostazioni. La password è quella che hai scelto: **non è scritta in nessun
  file del repository**.

## Passi

1. Dalla radice del repository: `pnpm dev`
2. Attendi che compaiano le righe di avvio dell'API (porta 3002) e dell'area
   amministrativa (porta 3001).
3. Apri `http://localhost:3001` e accedi con l'indirizzo e la password.
4. Scegli l'area **Redazione**: trovi l'elenco dei contenuti; aprine uno e usa
   l'anteprima.
5. Per fermare tutto: `Ctrl+C` nel terminale di `pnpm dev`.

## Se qualcosa non va

- **Accesso rifiutato:** controlla di aver scritto l'indirizzo esatto. Dopo
  troppi tentativi l'accesso si blocca per qualche minuto: è voluto.
- **La pagina non si apre:** verifica che i container siano attivi
  (`docker ps`). Non usare `pnpm compose:reset`, che cancella i volumi e con
  essi l'import.
- **Immagini mancanti nell'anteprima:** segnalalo con l'indirizzo del
  contenuto: è un dato utile per la Fase 1E.

## Attenzione

- La password è stata scritta nella conversazione con l'agente. L'account vive
  solo nel database locale, ma conviene cambiarla quando l'area amministrativa
  avrà la schermata per farlo; il servizio ha già l'operazione
  (`/auth/password`).
- **Non modificare contenuti** per ora: la protezione dei contenuti pubblicati
  dall'area di gestione (DR-087) non è ancora attuata, e una riesecuzione
  dell'import sovrascriverebbe le modifiche. Le copie di lavoro, invece, sono
  protette.

## Come segnalare il completamento

Scrivi, per esempio: `HO-009: entrato, contenuti visibili` oppure descrivi che
cosa non funziona.
