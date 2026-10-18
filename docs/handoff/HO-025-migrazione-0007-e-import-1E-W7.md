# HO-025 — Migrazione `0007` e import in locale (`1E-W7`, T7)

Fase 1E, wave `1E-W7`. Scritto il 2026-10-18.

Migrazione e import reale sono fra le azioni a **conferma obbligatoria** (`CLAUDE.md`).
Questo documento chiede una sola conferma, per una sola esecuzione, **solo sul database
di sviluppo locale** `amoris` in Docker. Nessun dato esce dalla macchina, nessuna email,
nessun pagamento.

---

## 1. Perché serve

Il codice dei gruppi 2 e 3 della T7 è scritto e provato (lint e typecheck 18/18, prove
8/8 pacchetti, 1 503 prove; revisione del codice e della sicurezza senza problemi critici o alti). Una parte si vede solo con dati nuovi:

| Decisione | Che cosa porta l'import |
|---|---|
| DR-179, DR-180 (M3, M4) | colonna `contents.description_source`: la description calcolata come All in One SEO, dal testo grezzo, dopo la restrizione delle pagine riservate. Prova sul dump: **105 description su 106** uguali alla sorgente (l'unica diversa è un articolo con lo stesso slug di una pagina) |
| DR-186 | colonna `contents.modified_at` con la data di modifica della sorgente (`dateModified` del JSON-LD) |
| DR-174, DR-191 (M5) | title di `/vuoi-diventare-consulente-familiare/` tradotto in `{title} - {site_title}` |
| DR-184 (I3) | i 4 blocchi video `.mp4` diventano lettori nella pagina (tipo `file`) |
| DR-193, DR-181 (M8) | la categoria dei moduli prende il percorso `/download-category/moduli-consulenze/` |
| DR-185 | impostazioni nuove `contact.phone` (vuota) e `social.profiles` (vuota): la sorgente non ha profili social |

Dopo l'import vanno riavviate l'API (legge le colonne nuove, nuove letture pubbliche,
richieste a intervalli di DR-189) e il sito, ricompilato con `SITE_URL` (DR-196).

## 2. Che cosa farò, dopo la tua conferma

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-025-2026-10-18.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c "TABLE DATA"'
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. migrazione 0007 (due colonne nullable, nessun dato toccato)
pnpm --filter @amoris/db migrate

# 3. import completo, come HO-023
pnpm --filter @amoris/importer start apply --confirm
```

L'import va eseguito per intero: la sola fase `contents` lascerebbe percorsi provvisori e
indirizzi `/wp-content/uploads/` che solo le fasi `relations` e `rewrite` sistemano.

Poi: riavvio dell'API su `127.0.0.1:3002`; compilazione e riavvio del sito su
`127.0.0.1:3200` con `SITE_URL=http://127.0.0.1:3200`; verifiche del §3; ricattura e
confronto delle viste toccate (§3.3).

## 3. Esito atteso

### 3.1 Database

| Controllo | Atteso |
|---|---|
| Migrazione | `0007_descrizione_e_data_di_modifica` applicata; migrazioni da 7 a 8 |
| `ESITO` dell'import | `success`, verifiche a zero |
| `contents` | 108 |
| `description_source` valorizzata | 64 (35 pagine, 29 articoli); le altre 44 sono calcolate dall'API |
| `modified_at` valorizzata | 108 |
| `content_seo` | 2: `Home - Centro Amoris Laetitia` e `{title} - {site_title}` |
| problemi `seo-title-variable-unresolved` | 0 |
| impostazioni | 17 scritte dalla fase; 21 in tabella; `contact.phone` = `""`, `social.profiles` = `[]` |
| categoria dei moduli | `/download-category/moduli-consulenze/`; quella dei file riservati invariata |
| blocchi video | 7: 4 `file`, 3 `youtube` |
| compilazioni dei form | 425, invariate |

### 3.2 API e sito

| Controllo | Atteso |
|---|---|
| `GET /public/terms?path=/download-category/moduli-consulenze/` | 200 |
| `GET /public/documents?termId=…` | 4 moduli pubblici, nell'ordine della sorgente |
| `GET /public/sitemap` e `/sitemap.xml` | 113 percorsi, compresi 4 `/download/…` e la categoria |
| un `.mp4` con `Range: bytes=0-1` | 206 |
| `verifica-metadati.ts` | M1-M8 senza difformità, salvo quelle registrate come correzioni |
| `python tests/visual/stati-matrice.py` | 292 conformi |
| prova 1E-19 | contenuti identici prima e dopo un salvataggio senza modifiche |

### 3.3 Viste da ricatturare e confrontare

- I2 (DR-183, DR-195): i 26 URL in fondo ad `analisi-impatto-T7.md` e `/category/news/`, alle 6 viewport.
- I1 (DR-194): lo stato hover del bottone «Invia» di `/contatti/`.
- DR-181: `/download-category/moduli-consulenze/`, pagina nuova: va aggiunta alla matrice e catturata anche sul riferimento.
- I3: la pagina dei due video dopo il clic.

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Migrazione o import con esito diverso da `success` | mi fermo, riporto solo codici e conteggi, non riprovo senza nuova conferma |
| Dati da riportare indietro | `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'`; le due colonne in più restano vuote e non danno fastidio |

## 5. Rischi

- **Contenuti salvati dopo l'ultimo import:** 4 contenuti risultano modificati il
  2026-10-17 alle 00:25 ora locale (`/attraversare-le-emozioni/`, `/chi-siamo/`,
  `/seminario-estivo/`, `/corsi-2022-2023/`). Sono i 4 della prova 1E-19, salvati dal CMS
  **senza modifiche** (`docs/qa/confronto/prova-1e-19.json`, pagine pubbliche identiche).
  L'import li riscrive: nessuna modifica redazionale va persa. `page_layout = no_sidebar`
  è quello che la regola dell'import dà alle pagine Divi.
- **Impostazioni:** la fase `settings` riscrive le sue 17 chiavi; nessuna risulta modificata
  dal CMS.
- **Privacy:** `description_source` si calcola dopo la restrizione delle pagine riservate;
  per le pagine riservate l'estratto non si usa. Documenti e file riservati restano fuori da
  sitemap ed elenchi (prove negative). Nessun dato nuovo da fuori.
- **Dati reali:** le compilazioni storiche non cambiano, l'import le salta.

## 6. Come confermare

```
HO-025: confermo migrazione e import in locale.
```

Se preferisci rimandare: `HO-025: rimandata`.
