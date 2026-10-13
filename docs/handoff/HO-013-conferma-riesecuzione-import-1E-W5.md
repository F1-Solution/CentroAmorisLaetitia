# HO-013 — Conferma della riesecuzione dell'import in locale (`1E-W5`)

Fase 1E, wave `1E-W5` e `1E-W6`. Scritto il 2026-10-12, aggiornato lo stesso giorno con la correzione della `1E-W6`.

L'import reale è fra le azioni a **conferma obbligatoria** (`CLAUDE.md`): questo
documento ti chiede una sola conferma, puntuale, per una sola esecuzione.

---

## 1. Perché serve

Le `1E-W5` e `1E-W6` hanno cambiato l'importer in tre punti; il database locale li riceve solo
rieseguendo l'import:

| Modifica | Effetto sul sito | Fonte |
|---|---|---|
| Parametro `offset` dell'elenco degli articoli | la home salta l'articolo più recente, come nella sorgente | richiesta dell'utente del 2026-10-12, DR-116 |
| Configurazione PayPal di ogni form | dopo l'invio di un form con pagamento compare «Vai al pagamento» con l'importo | DR-039 |
| `wpautop()` sui contenuti non Gutenberg (`1E-W6`) | gli «a capo» del testo tornano a essere righe e paragrafi come nella sorgente: è la causa della maggior parte delle differenze del confronto | rilievo della `1E-W6` |

Finché non si riesegue, la home mostra un articolo in più della sorgente e il
confronto visivo della home nella `1E-W6` resta classificato «in attesa della
riesecuzione dell'import».

## 2. Che cosa farò, dopo la tua conferma

Li eseguo **io**: a te basta la conferma del §6. Tutto in locale, sul database di
sviluppo `amoris` in Docker. Nessun dato reale fuori dalla tua macchina, nessuna
email, nessun pagamento.

Se vuoi eseguirli tu, in Windows PowerShell dalla radice del repository: la copia
si scrive **dentro il contenitore** e poi si copia fuori, perché in PowerShell la
redirezione `>` riscrive i byte in UTF-16 e rende il file inservibile. Nei comandi
che passano a `sh -c` non ci sono virgolette doppie: Windows PowerShell 5.1 le
toglie, e `grep -c "TABLE DATA"` diventerebbe `grep -c TABLE`, che conta 68.

```powershell
# 1. copia di salvataggio nel contenitore, poi fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-1E-W5-<data>.dump"

# 2. verifica: atteso 34
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c TABLE.DATA'
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 3. import
pnpm --filter @amoris/importer start apply --confirm
```

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| `ESITO` dell'import | `success`, stessi conteggi delle esecuzioni del 2026-10-12 |
| Blocco `post_list` della home | `offset: 1` |
| Form con pagamento | 22 con la configurazione PayPal nella definizione (conto mai stampato) |
| Home sul sito locale | il primo articolo è il secondo più recente, come nella sorgente |
| Una pagina con testo a righe, es. `/affettivita-e-sessualita-il-lungo-viaggio/` | il testo va a capo come nella sorgente |
| `python tests/visual/stati-matrice.py` | 292 conformi, 0 difformi |

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Esito diverso da `success` | mi fermo, ti riporto le anomalie (solo codici e conteggi) e non riprovo senza nuova conferma |
| Dati da riportare indietro | ripristino la copia: `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |

## 5. Rischi

- **Privacy:** il conto PayPal del Centro entra nel database locale. Non compare
  in Git, nei log, nei documenti, né nella pagina: solo nella risposta all'invio
  di un form, come nella sorgente.
- **Dati reali:** le 425 compilazioni storiche non cambiano: l'import le salta,
  come nelle esecuzioni precedenti.

## 6. Come confermare

Scrivi nel prompt successivo:

```
HO-013: confermo la riesecuzione dell'import in locale.
```

Se preferisci non farla ora: `HO-013: rimandata`. Il confronto della home resterà
dichiarato in attesa.
