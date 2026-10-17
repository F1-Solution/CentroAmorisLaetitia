# HO-022 — Conferma dell'import in locale (`1E-W6`, tipografia D70)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-16.

L'import reale è fra le azioni a **conferma obbligatoria** (`CLAUDE.md`). Questo
documento chiede una sola conferma, per una sola esecuzione, **solo sul database di
sviluppo locale** `amoris` in Docker. Nessuna migrazione.

---

## 1. Perché serve

D70 (DR-151, DR-152): l'importer ora riproduce `wptexturize()` della sorgente con le
regole italiane: virgolette e apostrofi tipografici, lineette, puntini, elisioni come
«po’». Lo applica al testo dei contenuti, ai titoli, ai riassunti scritti a mano, alle
voci di menu e ai titoli dei download. Il sito conta già gli estratti come Divi. I dati
attuali hanno ancora apici dritti: senza import la correzione non si vede.

Linea di partenza (`tipografia.py`, testo visibile di contenuto, titolo e menu dei 115
indirizzi): **98 indirizzi con differenze, 1.258 scarti** (1.085 nel contenuto, 166 nei
titoli, 7 nel menu).

## 2. Che cosa farò, dopo la tua conferma

Tutto in locale: nessun dato fuori dalla tua macchina, nessuna email, nessun pagamento.

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-022-2026-10-16.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c "TABLE DATA"'   # atteso 34
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. import
pnpm --filter @amoris/importer start apply --confirm
```

Poi ricompilo e riavvio il sito su `http://127.0.0.1:3200` (l'API non cambia).

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| `ESITO` dell'import | `success`, conteggi come HO-021, ripartizione 57/47/4, verifiche a zero |
| `tipografia.py` | scarti molto sotto 1.258; quelli rimasti spiegati uno per uno |
| Estratti di archivio e ricerca | uguali alla sorgente, salvo differenze di testo già note |
| `python tests/visual/stati-matrice.py` | 292 conformi, 0 difformi |
| Ricerca, 9 frasi | ordine dei risultati comuni ancora identico |

Dopo: ricattura e confronto della `1E-W6`.

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Import con esito diverso da `success` | mi fermo, riporto solo codici e conteggi, non riprovo senza nuova conferma |
| Testo trasformato in modo sbagliato | ripristino la copia e correggo il porto con una prova in più |
| Dati da riportare indietro | `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |

## 5. Rischi

- **Privacy:** nessun dato nuovo; cambia solo la forma di caratteri già presenti.
- **Dati reali:** le 425 compilazioni storiche non cambiano, l'import le salta.
- **Ricerca:** una frase scritta con l'apice dritto («l'altro») deve trovare il testo con
  quello tipografico. La sorgente aveva lo stesso comportamento, perché WordPress cerca nel
  grezzo, che ha apici dritti. Lo verifico dopo l'import con le 9 frasi e con «l'altro».

## 6. Come confermare

```
HO-022: confermo l'import in locale.
```

Se preferisci rimandare: `HO-022: rimandata`.
