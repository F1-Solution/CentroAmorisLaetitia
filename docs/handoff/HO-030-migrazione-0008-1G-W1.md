# HO-030 — Migrazione `0008` e primo account di amministrazione (`1G-W1`, T7)

Fase 1G, wave `1G-W1`. Scritto il 2026-10-20.

La migrazione sul database di sviluppo è un'azione a **conferma obbligatoria** (`CLAUDE.md`,
`PLAN.md` §7 conferma 2). Questo documento chiede una conferma per una sola esecuzione,
**solo sul database di sviluppo locale** `amoris` in Docker. Nessun dato esce dalla
macchina, nessuna email.

---

## 1. Perché serve

La `1G-W1` ha separato l'amministrazione dalla redazione (DR-219, DR-220, DR-227…DR-229).
La migrazione `0008_amministrazione`:

| Che cosa | Effetto |
|---|---|
| tre permessi nuovi: `users.manage`, `audit.read`, `site.settings.write` | righe nuove in `permissions` |
| ruolo di sistema `amministrazione` con i tre permessi | riga nuova in `roles` e in `role_permissions` |
| ruolo `editor` rietichettato «Redazione» | cambia solo l'etichetta |

Nessuna colonna nuova, nessun contenuto toccato, nessuna compilazione toccata.

**Conseguenza da sapere prima (D123 = A):** dopo la migrazione **nessun account ha il
ruolo `amministrazione`**. Il tuo account attuale ha solo `editor`, quindi entra in
Redazione ma **non** più in Impostazioni: «Impostazioni del sito» (titolo, piè di pagina,
recapiti) e «Persone e permessi» passano all'amministrazione. Per questo serve il passo 3,
che esegui tu.

## 2. Che cosa farò, dopo la tua conferma

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-030-2026-10-20.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c "TABLE DATA"'
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. migrazione 0008
pnpm --filter @amoris/db migrate
```

Poi: riavvio dell'API su `127.0.0.1:3002`; ricompilazione e riavvio dell'area
amministrativa e del sito su `127.0.0.1:3200` con `SITE_URL=http://127.0.0.1:3200` (le
prove end-to-end li hanno ricompilati per l'ambiente di prova); controlli del §4.

## 3. Che cosa fai tu, dopo la migrazione

Crea **un** account di amministrazione con il comando locale. Scegli tu indirizzo, nome e
password (almeno 12 caratteri): non scriverli in questo documento né nella chat.
L'indirizzo deve essere **diverso** da quello del tuo account attuale.

```powershell
$env:ACCOUNT_EMAIL = "indirizzo-che-scegli"
$env:ACCOUNT_NAME = "Nome che scegli"
$env:ACCOUNT_PASSWORD = Read-Host "Password (almeno 12 caratteri)"
$env:ACCOUNT_ROLE = "amministrazione"
pnpm --filter @amoris/api account:create
Remove-Item Env:ACCOUNT_EMAIL, Env:ACCOUNT_NAME, Env:ACCOUNT_PASSWORD, Env:ACCOUNT_ROLE
```

`Read-Host` evita che la password resti nella cronologia di PowerShell. Il comando
risponde `Account creato: <indirizzo>, ruolo «amministrazione». La password non viene
mostrata.` e accetta solo un database locale.

Facoltativo, dall'area amministrativa: entra con il nuovo account, scegli
«Impostazioni» → «Persone e permessi» e aggiungi il ruolo «Amministrazione» anche al tuo
account abituale. Da quel momento il commutatore ti offre entrambe le aree.

## 4. Esito atteso

| Controllo | Atteso |
|---|---|
| migrazione | `0008_amministrazione` applicata |
| `permissions` | 8 righe |
| `roles` | `editor` («Redazione»), `amministrazione` («Amministrazione») |
| contenuti, media, compilazioni | conteggi invariati (108, 170, 425) |
| account attuale, dopo l'accesso | entra in Redazione; Impostazioni non compare |
| account creato al passo 3 | entra in Impostazioni; vede «Persone e permessi» e «Impostazioni del sito» |
| sito pubblico | stati 292/292 come prima |

## 5. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| migrazione con errore | mi fermo, riporto il solo messaggio, non riprovo senza nuova conferma |
| dati da riportare indietro | `docker cp "$HOME\amoris-backup\amoris-prima-HO-030-2026-10-20.dump" amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |
| `account:create` risponde «Account non creato» | l'indirizzo è già usato o la password è corta: riprova con un altro indirizzo o una password più lunga |

## 6. Note per la Fase 1F

- `account:create` accetta solo un database locale: come creare il primo account di
  amministrazione in produzione si decide nella 1F (S11 di
  `docs/qa/verifiche/sicurezza-1G-W1.md`).
- I limiti per indirizzo IP di accesso e cambio password si basano su `trustProxy: true`:
  in produzione il proxy deve sovrascrivere `X-Forwarded-For`.

## 7. Come confermare

```
HO-030: confermo la migrazione 0008 sul database di sviluppo.
```

Se preferisci rimandare: `HO-030: rimandata`.
