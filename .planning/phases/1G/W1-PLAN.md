# Piano della wave 1G-W1 — Account e ruoli

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice
> (`superpowers:test-driven-development`). Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave.

Scritto il 2026-10-19, dopo la chiusura della `1G-W0` (DR-222, commit `62b79f5`).

**Obiettivo:** separare il ruolo `amministrazione` dalla redazione e dare all'area
Impostazioni la schermata «Persone e permessi» (elenco, crea, disattiva, riattiva,
reimposta password, ruoli), con prove negative per ruolo e revisione di sicurezza.

**Architettura:** il meccanismo dei permessi e delle aree resta quello di DR-067 (ruolo
attivo, area dichiarata sulla rotta). Si aggiungono permessi come **dati** (righe di
`permissions` e `role_permissions`, seminate da una migrazione), un ruolo di sistema
`amministrazione`, un modulo dell'API per gli account nell'area `impostazioni` e una
schermata nell'area amministrativa. Le colonne che servono esistono già in `users`
(`isActive`, `mustChangePassword`): **nessuna colonna nuova prevista**.

**Stack:** Fastify, Zod, Drizzle, `@node-rs/argon2` (già presente, `lib/password.ts`),
Next.js nell'area amministrativa, Vitest, Playwright. **Nessuna dipendenza nuova.**

**Riferimenti:** `CONTEXT.md` §7 (1G-16, 1G-17, 1G-18, 1G-20), `PLAN.md` §1, DR-219,
DR-220, DR-224, ADR-007 (§3.1, §3.2, §6), DR-050, DR-066, DR-067, DR-070.

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W1-1 | Con il solo ruolo di redazione non si entra nell'area Impostazioni, né dal commutatore, né scrivendo `/impostazioni/persone`, né chiamando `/accounts` | prove dell'API (403 per area e per permesso) ed e2e |
| W1-2 | L'amministrazione elenca, crea, disattiva, riattiva un account, ne cambia i ruoli e ne reimposta la password | prove dell'API ed e2e dell'intero ciclo |
| W1-3 | Un account disattivato non entra e le sue sessioni aperte cessano subito | prova: sessione attiva → disattivazione → richiesta successiva 401 |
| W1-4 | Dopo la reimpostazione, la persona deve cambiare la password al primo accesso prima di qualunque altra cosa | prova dell'API (rotte rifiutate finché `mustChangePassword`) ed e2e della schermata |
| W1-5 | Non si può restare senza amministrazione: né togliendo a sé il ruolo, né disattivando l'ultimo account amministratore | prove dell'API, messaggio in italiano |
| W1-6 | Nessuna password, temporanea o no, in log, registro, risposte diverse da quella di creazione o reimpostazione | prova sui log catturati e su `audit_log.detail` |
| W1-7 | Ogni operazione sugli account scrive una riga di registro | prova su `audit_log` per ogni azione |
| W1-8 | ADR-007: i 12 controlli del §3.1 restano verdi; righe dell'autenticazione rimisurate e dichiarate; revisione datata (DR-224) | `adr007Controls.test.ts`, `authLineCount.test.ts`, riga in «Revisioni» |
| W1-9 | Revisione di sicurezza senza esiti critici o alti aperti | rapporto del revisore in `docs/qa/verifiche/sicurezza-1G-W1.md` |
| W1-10 | Verifica come la CI verde | lint, Prettier, tipi, build, test, `db:verify`, copertura, e2e |

## 2. Fatti accertati il 2026-10-19

| Fatto | Fonte |
|---|---|
| Permessi: 5 costanti; «le autorizzazioni si esprimono come permessi, mai come confronti sul nome del ruolo» | `apps/api/src/auth/permissions.ts` |
| `settings.write` vale per SEO e redirect (area Redazione) **e** per le impostazioni del sito (area Impostazioni): con un solo permesso la redazione entra anche in Impostazioni | `apps/api/src/auth/areaMap.ts`, `app.ts:221-232` |
| Le aree raggiungibili si ricavano dai permessi di tutti i ruoli posseduti; autorizzano solo i permessi del ruolo attivo | `permissions.ts` (`collectPermissions`), `auth/sessions.ts` |
| Nel database importato il ruolo è `editor` («Redattore», di sistema) con i 5 permessi, seminato dall'importer a ogni esecuzione | `apps/importer/src/stages/users/roleSeed.ts` |
| Il seme sintetico (e2e) crea invece `redazione` (tutti i permessi) e `segreteria` (nessuno) | `apps/api/tools/seedSintetico.ts:90-103` |
| `users` ha già `isActive`, `mustChangePassword`, `lastLoginAt`; `resolveSession` rifiuta gli account non attivi; il login li rifiuta | `packages/db/src/schema/auth.ts`, `auth/sessions.ts:126`, `modules/auth/service.ts:52` |
| Esistono `revokeAllSessions` e `/auth/password` (cambio della propria password con la vecchia, minimo 12 caratteri, revoca delle sessioni) | `auth/sessions.ts:231`, `modules/auth/routes.ts:295` |
| `mustChangePassword` è restituito al client ma **nessuna schermata lo applica** e l'area amministrativa non ha una schermata per cambiare la propria password | `apps/admin/src/lib/session.tsx:32`; nessun uso altrove |
| Non esiste alcuna rotta per gli account; i ruoli si leggono soli (`GET /roles`) | `apps/api/src/modules/roles/` |
| Gli account si creano solo con `account:create`, accettato solo su database locale; password minima 12 | `apps/api/tools/createLocalAccount.ts`, `src/accounts/localAccount.ts:13` |
| Conteggio delle righe dell'autenticazione: soglia 500 (DR-070), nucleo 439, totale 861 (deroga DR-066 per il totale). La regola del 2026-09-20 vieta di tenere fuori dal conteggio i file che partecipano all'autenticazione | `apps/api/tests/auth-line-count.json`, `tools/countAuthLines.ts` |
| Il database di sviluppo contiene l'utente importato dalla sorgente (dati reali) | `apps/importer/src/stages/users/index.ts` |

## 3. Decisioni richieste prima di eseguire

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D123** | Permessi che attuano DR-220. Oggi un solo permesso (`settings.write`) apre sia SEO e redirect sia le impostazioni del sito | A — tre permessi nuovi: `users.manage` (persone e permessi), `audit.read` (registro, usato nella `1G-W2`), `site.settings.write` (impostazioni del sito); `settings.write` resta per SEO e redirect e porta solo all'area Redazione · B — solo `users.manage`; le impostazioni del sito restano anche alla redazione · C — `users.manage` e `audit.read`; impostazioni del sito a entrambi | **A**: è l'unica che dà all'amministrazione esattamente ciò che DR-220 elenca e toglie alla redazione l'ingresso nell'area Impostazioni; il costo è che la redazione **perde** «Impostazioni del sito» (titolo, piè di pagina, recapiti), che passa all'amministrazione | aggiungere permessi senza decisione |
| **D124** | Come si reimposta una password senza email (le email sono della 1F) | A — il sistema genera una password temporanea, la mostra **una sola volta** all'amministrazione, revoca le sessioni e impone il cambio al primo accesso · B — l'amministrazione scrive la password temporanea · C — collegamento monouso a scadenza, mostrato all'amministrazione | **A**: nessuna password scelta o vista due volte da un'altra persona, nessun token da conservare; il costo è consegnare la password a voce o di persona. B espone password deboli scelte di fretta; C aggiunge una tabella di token e una superficie in più | memorizzare o rimostrare una password |
| **D125** | Chiavi dei ruoli. Nel database reale il ruolo si chiama `editor` («Redattore»), nel seme degli e2e `redazione` | A — si tiene la chiave `editor` e la si rietichetta «Redazione»; nuovo ruolo `amministrazione`; il seme sintetico si allinea alle stesse chiavi · B — migrazione che rinomina `editor` in `redazione` | **A**: non tocca chiavi che l'importer, `account:create` e la visibilità del menu già usano; B cambia dati importati e va riprovata su ogni riferimento | rinominare chiavi senza decisione |

Regola applicata, non decisione: il nuovo modulo degli account si **conta** fra le righe
dell'autenticazione (lettura del totale), perché crea credenziali e revoca sessioni. Se il
**nucleo** supera 500, la wave si ferma e torna all'utente (ADR-007 §6, contromisura 3).

## 4. Struttura dei file

| Percorso | Che cosa |
|---|---|
| `packages/db/drizzle/0008_amministrazione.sql` (nuovo, nome definitivo da `drizzle-kit`) | inserimento idempotente dei permessi di D123, del ruolo `amministrazione` di sistema e dei suoi permessi; rietichetta `editor` → «Redazione» (D125) |
| `apps/api/src/auth/permissions.ts`, `auth/areaMap.ts` | costanti nuove; `settings.write` solo Redazione; i permessi nuovi solo Impostazioni |
| `apps/api/src/modules/settings/routes.ts` | richiede `site.settings.write` invece di `settings.write` |
| `apps/api/src/modules/accounts/` (nuovo: `routes.ts`, `schemas.ts`, `service.ts`) | rotte degli account, area `impostazioni`, permesso `users.manage` |
| `apps/api/src/modules/auth/routes.ts` | rifiuto delle rotte diverse da `/auth/me`, `/auth/password`, `/auth/logout` finché `mustChangePassword` |
| `apps/api/src/lib/password.ts` | generatore della password temporanea (crittograficamente sicuro) |
| `apps/api/src/app.ts` | registrazione di `accounts` nell'area `impostazioni` |
| `apps/api/tools/countAuthLines.ts`, `tests/auth-line-count.json` | modulo `accounts` nel totale; misura nuova |
| `apps/api/tools/seedSintetico.ts`, `src/accounts/localAccount.ts` | chiavi di D125; ruolo `amministrazione` nel seme e accettato da `account:create` |
| `packages/contracts/src/` | tipi delle richieste e risposte degli account |
| `apps/admin/src/app/impostazioni/persone/page.tsx` (nuova), `components/accounts/` (nuova) | elenco, creazione, scheda dell'account |
| `apps/admin/src/app/password/page.tsx` (nuova) | cambio della propria password, obbligatorio quando richiesto |
| `apps/admin/src/lib/areas.ts`, `components/AreaShell.tsx` | voce già presente; reindirizzamento a `/password` se `mustChangePassword` |
| `apps/api/tests/accounts.test.ts`, `apps/admin/tests/accounts.test.tsx`, `tests/e2e/cms/account.spec.ts` (nuovi) | prove |
| `docs/decisions/adr/ADR-007-*.md` | revisione datata (DR-224) |
| `docs/qa/verifiche/sicurezza-1G-W1.md` (nuovo) | esito della revisione di sicurezza |

## 5. Interfacce

Rotte dell'API, area `impostazioni`, permesso `users.manage`, CSRF sulle scritture come le
altre rotte:

| Metodo e percorso | Corpo | Risposta |
|---|---|---|
| `GET /accounts` | — | `{ items: [{ id, email, fullName, isActive, roleKeys: string[], lastLoginAt, createdAt }] }` — mai `passwordHash` |
| `POST /accounts` | `{ email, fullName, roleKeys: ('editor' \| 'amministrazione')[] (almeno 1) }` | `201 { account, temporaryPassword }` — l'unica risposta che porta la password |
| `PATCH /accounts/:id` | `{ fullName?, roleKeys?, isActive? }` | `{ account }`; `isActive: false` revoca tutte le sessioni |
| `POST /accounts/:id/password-reset` | — | `{ temporaryPassword }`; imposta `mustChangePassword`, revoca le sessioni |

Errori, con messaggio in italiano: `409` email già usata; `409` operazione che lascerebbe
zero account attivi con `amministrazione` (W1-5); `404` account inesistente; `400` corpo
non valido. Azioni del registro: `account.create`, `account.update`, `account.deactivate`,
`account.reactivate`, `account.roles`, `account.password_reset`; `detail` senza password né
email di terzi (solo l'id dell'account toccato).

## 6. Revisione di attenzione (casi che le prove ordinarie non coprono)

1. **Restare chiusi fuori**: l'unica amministrazione toglie a sé il ruolo o si disattiva →
   `409` (prova in T3).
2. **Sessione ancora aperta dopo la disattivazione** in un'altra scheda → la richiesta
   successiva è `401` (prova in T3).
3. **Ruolo attivo revocato durante la sessione**: a una persona si toglie `amministrazione`
   mentre lavora in Impostazioni → la richiesta successiva è rifiutata e il commutatore non
   la offre più (prova in T3).
4. **Email con maiuscole o spazi**: `Persona@Esempio.invalid ` e `persona@esempio.invalid`
   sono lo stesso account (`citext` più normalizzazione degli spazi; prova in T3).
5. **Password temporanea nei log**: il logger di Fastify registra corpo e risposta? Prova
   che la stringa restituita non compare nei log catturati (T3).

---

## 7. Attività

### T0 — Decisioni D123, D124, D125
- [ ] Portare le tre decisioni all'utente; registrare le risposte in
  `decision-register.md`. Se D123 ≠ A o D125 ≠ A, aggiornare §4 e §5 di questo piano prima
  di T1.

### T1 — Permessi, ruolo `amministrazione`, migrazione
**File:** migrazione nuova, `permissions.ts`, `areaMap.ts`, `modules/settings/routes.ts`,
seme sintetico, `localAccount.ts`.
- [ ] Prova (fallisce): con il solo ruolo di redazione `GET /settings` risponde 403 e le aree
  raggiungibili sono solo `['redazione']`; con `amministrazione` le aree sono
  `['impostazioni']`; chi ha entrambi i ruoli ha entrambe le aree.
- [ ] Prova (fallisce): la migrazione applicata due volte lascia 8 permessi e il ruolo
  `amministrazione` con 3 permessi (idempotenza, `db:verify`).
- [ ] Attuazione minima; `account:create` accetta `ACCOUNT_ROLE=amministrazione`.
- [ ] Prove verdi; aggiornare le prove e2e esistenti che usano «Impostazioni del sito» con
  l'account di redazione (`corredo.spec.ts`: titolo del sito, valore segreto) perché usino
  l'account di amministrazione del seme.
- [ ] Commento in `PROGRESS.md`.

### T2 — Cambio obbligatorio della password
**File:** `modules/auth/routes.ts`, `apps/admin/src/app/password/page.tsx`, `AreaShell.tsx`.
- [ ] Prova (fallisce): con `mustChangePassword` vero, ogni rotta di area risponde 403 con
  codice `PASSWORD_CHANGE_REQUIRED`; `/auth/me`, `/auth/password`, `/auth/logout` rispondono.
- [ ] Prova (fallisce): dopo `/auth/password` riuscito `mustChangePassword` è falso.
- [ ] Prova dell'area amministrativa: con `mustChangePassword` si arriva a `/password` da
  qualunque pagina; la schermata ha etichette, messaggi in italiano, minimo 12 caratteri.
- [ ] Attuazione minima; prove verdi; commento in `PROGRESS.md`.

### T3 — Modulo `accounts` dell'API
**File:** `modules/accounts/*`, `lib/password.ts`, `app.ts`, `packages/contracts/src/`.
- [ ] Prove (falliscono), una per riga del §5 e per i cinque casi del §6: elenco senza
  `passwordHash`; creazione con password temporanea di almeno 16 caratteri casuali;
  `409` email duplicata anche con maiuscole e spazi; disattivazione → `401` alla richiesta
  successiva della persona; riattivazione; cambio ruoli; ruolo attivo revocato → richiesta
  rifiutata; reimpostazione → `mustChangePassword` e sessioni revocate; ultima
  amministrazione protetta (`409`, due casi); redazione → `403` su ogni rotta; una riga di
  registro per azione senza password; password temporanea assente dai log catturati.
- [ ] Attuazione minima; OpenAPI aggiornata (`openapi.snapshot.json`); prove verdi.
- [ ] Rimisurare le righe (`countAuthLines`), aggiungere `modules/accounts/*` al totale,
  aggiornare `auth-line-count.json`. **Se il nucleo supera 500: fermarsi e chiedere.**
- [ ] Commento in `PROGRESS.md`.

### T4 — Schermata «Persone e permessi»
**File:** `apps/admin/src/app/impostazioni/persone/page.tsx`, `components/accounts/*`.
- [ ] Prova dell'area amministrativa (fallisce): elenco con nome, email, ruoli, stato,
  ultimo accesso; creazione con scelta dei ruoli; la password temporanea si vede **una
  volta**, con il pulsante per copiarla e l'avviso «non verrà mostrata di nuovo»; conferma
  prima di disattivare e di reimpostare; errore `409` mostrato in italiano.
- [ ] Attuazione con i componenti di `packages/ui` e lo stile delle schermate esistenti
  (modello: `components/settings/SiteSettings.tsx`); navigazione da tastiera ed etichette.
- [ ] Prove verdi; commento in `PROGRESS.md`.

### T5 — Prove end-to-end
**File:** `tests/e2e/cms/account.spec.ts`, seme sintetico.
- [ ] Ciclo completo come amministrazione: crea un account di redazione, copia la password
  temporanea, esce; entra come il nuovo account, è portato a `/password`, cambia la
  password, entra in Redazione e **non** vede Impostazioni; riapre come amministrazione,
  disattiva l'account; il nuovo account non entra più.
- [ ] Caso negativo diretto: con l'account di redazione `/impostazioni/persone` riporta alla
  scelta dell'area e `GET /accounts` risponde 403.
- [ ] Commento in `PROGRESS.md`.

### T6 — ADR-007 e revisione di sicurezza
- [ ] Riga in «Revisioni» di ADR-007 (DR-224): gestione minima degli account dall'area
  Impostazioni (DR-219), ruolo `amministrazione` e permessi di D123 (DR-220), password
  temporanea di D124; §3.2 e §5 aggiornati; i 12 controlli del §3.1 invariati.
- [ ] Revisione di sicurezza con un revisore separato (`security-reviewer`) sul diff della
  wave: autorizzazione per area e permesso, enumerazione degli account, CSRF, limitazione
  delle richieste sulle rotte nuove, generazione della password, log, registro.
- [ ] Correggere critici, alti e medi; esito in `docs/qa/verifiche/sicurezza-1G-W1.md`.
- [ ] Commento in `PROGRESS.md`.

### T7 — Verifica e chiusura
- [ ] Verifica come la CI: `pnpm lint`, `pnpm format:check` (con `--end-of-line auto` in
  locale), `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:verify`, copertura,
  `pnpm test:e2e`; dopo gli e2e ricompilare e riavviare il sito di sviluppo.
- [ ] Migrazione sul database di sviluppo: **su conferma**, con copia di salvataggio e
  handoff (`PLAN.md` §7, conferma 2).
- [ ] Revisione del codice (`code-reviewer`) senza critici o alti aperti.
- [ ] Riga `PHASE:1G WAVE:1G-W1 STATUS:complete`; commit e push **su conferma**.

## 8. Cosa la wave non fa

- Non costruisce il registro delle operazioni: è la `1G-W2` (che userà `audit.read`).
- Non crea account in produzione né decide come crearvi il primo: Fase 1F.
- Non manda email: la password temporanea si consegna fuori dal sistema (D124).
- Non aggiunge ruoli oltre i due di DR-220, né permessi oltre quelli di D123.
- Non mostra né esporta dati dell'utente importato fuori dall'area amministrativa locale;
  nessuna cattura con dati reali nei documenti.
