# Account locale di redazione sul database importato — piano

Scritto il 2026-10-04 su richiesta dell'utente, dopo la chiusura della `1D-W11`.

**Obiettivo:** poter entrare nell'area amministrativa locale, dove oggi nessuno
può farlo: l'unico utente importato non ha password (le password di WordPress
non si importano) e il seme sintetico si rifiuta, per costruzione, di scrivere
su un database con dati importati.

## Che cosa fa lo strumento

`pnpm --filter @amoris/api account:create`, con i dati **solo** da variabili
d'ambiente:

| Variabile | Contenuto |
|---|---|
| `ACCOUNT_EMAIL` | indirizzo di accesso; in locale un indirizzo `.invalid` |
| `ACCOUNT_NAME` | nome mostrato |
| `ACCOUNT_PASSWORD` | almeno 12 caratteri; **mai stampata, mai scritta su file** |
| `ACCOUNT_ROLE` | chiave di un ruolo **già esistente** |

## Vincoli

- **Solo database locale**: rifiuta un `DATABASE_URL` che non punti a questa
  macchina.
- **Non crea ruoli né permessi** (ADR-007 §3.2): un ruolo inesistente è un errore.
- **Non sovrascrive** un account esistente con lo stesso indirizzo.
- Hash Argon2id con gli stessi parametri del servizio; nessun messaggio di
  errore riporta la password.
- Logica in `apps/api/src/accounts/localAccount.ts` (tipizzata e provata),
  comando sottile in `apps/api/tools/createLocalAccount.ts`.

## Prove

Account creato con hash verificabile e ruolo assegnato; indirizzo già esistente
rifiutato; ruolo inesistente rifiutato; password corta rifiutata senza
riportarla; database non locale rifiutato.

## Nota sul ruolo «administrator»

Nel database esiste un solo ruolo, `editor` («Redattore»), con **tutti e cinque**
i permessi di ADR-007 §3.2, quindi con accesso a entrambe le aree (Redazione e
Impostazioni): in Fase 1 è di fatto il ruolo di amministrazione. Un ruolo con un
altro nome sarebbe una decisione su ruoli e autorizzazioni, non si crea qui.
