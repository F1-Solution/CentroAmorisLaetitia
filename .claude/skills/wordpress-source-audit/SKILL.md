---
name: wordpress-source-audit
description: Audit in sola lettura del sito/backup WordPress sorgente (versione, tema, plugin, contenuti, tassonomie, menu, SEO, media, URL) per produrre l'inventario di migrazione in docs/migration/. Usare PRIMA di qualunque import dati o sviluppo frontend, quando si chiede "cosa c'e' nel sito WordPress", "inventario contenuti", "audit sorgente", "cosa dobbiamo migrare".
---

# WordPress Source Audit

Ricognizione **esclusivamente in lettura** del sito WordPress sorgente. Produce
l'inventario di verita' su cui si basano import, parita' visiva e collaudo.
Non migra nulla, non importa nulla, non modifica nulla.

## Gate di progetto (non negoziabile)

Nessuna fase gestionale (back-office, moduli gestionali, aree riservate, workflow
interni) puo' essere pianificata, avviata o rilasciata finche' non sono entrambe vere:

1. migrazione WordPress dichiarata **pixel-perfect e approvata esplicitamente
   dall'utente** in `docs/qa/visual-parity-report.md`;
2. deploy in produzione **eseguito e verificato**, con release report e smoke test
   in `docs/deploy/`.

Se una richiesta viola il gate: fermarsi, citare il gate, elencare cosa manca,
chiedere conferma. Mai procedere in autonomia.

## Stack di destinazione

React + Next.js (App Router) + Node.js + PostgreSQL. Nessuna dipendenza
PHP/WordPress a runtime nel target. L'audit descrive il sorgente; non presume che
il target lo replichi tecnicamente.

## Trigger

- Richiesta di inventario, audit, ricognizione o "cosa c'e' dentro" il sito WordPress.
- Prima di eseguire `wordpress-postgres-import` o di costruire la `url-matrix.csv`.
- Quando un import o una verifica di parita' fallisce per un contenuto mai censito.
- Quando si deve stimare l'ampiezza della migrazione.

## Input richiesti

Elencare quali sono disponibili; **fermarsi e chiedere** se manca il minimo indispensabile.

| Input | Obbligatorio | Note |
|---|---|---|
| Dump SQL WordPress (o accesso read-only al DB) | si | serve almeno schema + conteggi |
| Albero file del sito (`wp-content/`) | si | temi, plugin, mu-plugins, uploads |
| URL del sito sorgente raggiungibile | consigliato | per HTML reso, SEO, redirect |
| `wp-config.php` | **no** | non leggerlo; se serve il solo `table_prefix`, chiederlo |
| Export WXR (`.xml`) | opzionale | controprova dei conteggi |
| Elenco licenze plugin commerciali | opzionale | alimenta il debito di migrazione |

Minimo indispensabile: dump SQL **oppure** albero file. Con uno solo dei due,
dichiarare esplicitamente cosa non e' verificabile.

## Obiettivi dell'audit

1. **Piattaforma** — versione WordPress, prefisso tabelle, tema padre/child,
   plugin attivi, plugin presenti ma inattivi, mu-plugins, drop-ins, page builder
   in uso, shortcode registrati, widget, menu location, Customizer / Site Editor
   (FSE), font, CSS, JS, dipendenze front-end.
2. **Contenuti** — conteggi per post, pagine, articoli, CPT, tassonomie,
   categorie, tag, termini, commenti (se rilevanti), media, revisioni, bozze,
   privati, password-protected, contenuti non raggiungibili dal menu, orfani.
3. **Struttura** — gerarchia pagine (parent/child), menu e loro location, template
   assegnati, struttura permalink, elenco URL pubblici.
4. **SEO e routing** — title, meta description, canonical, OpenGraph/Twitter,
   redirect esistenti, sitemap, `robots.txt`, hreflang, URL hardcoded dentro i
   contenuti (link assoluti, media con dominio esplicito).
5. **Debito di migrazione** — plugin, licenze, servizi esterni, form, e-commerce,
   integrazioni e configurazioni che **non** sono dati e vanno **ricreati** nel target.

## Vincoli e divieti

- **Nessun import DB.** Solo lettura: conteggi e query `SELECT`.
- **Nessuna scrittura** in `source-private/`, `wp-content/`, dump o qualunque
  cartella sorgente. Gli output vanno solo in `docs/migration/`.
- **Nessun aggiornamento** di WordPress, tema o plugin. Nessun comando che muti stato.
- **Nessun accesso a sistemi remoti** oltre al sito sorgente gia' autorizzato.
- **Nessuna affermazione di completezza senza prove**: ogni numero riportato deve
  avere accanto la fonte (tabella, query, path, comando) che lo produce.
- **Nessun dato sensibile in output**: mai credenziali, chiavi API, token, hash
  password (`wp_users.user_pass`), e-mail o nomi di persone reali, indirizzi, IBAN,
  dati di pagamento, numeri di telefono, contenuti di file di credenziali o `.env`.
  Usare segnaposto (`<REDACTED>`, `utente-esempio@example.invalid`) e riferirsi alle
  persone per ruolo. Le tabelle utenti si contano, non si citano.

## Decisioni non definite: grill-me

Questa skill non decide al posto dell'utente. Quando non e' possibile stabilire il
comportamento corretto di una funzionalita', o manca un input, **fermarsi** ed
eseguire `/grill-me` (skill utente installata da `mattpocock/skills`; usare
`/batch-grill-me` quando le decisioni aperte sono molte).

Casi tipici da portare a grill-me:

- un plugin fa qualcosa che non e' deducibile dal DB (form, automazioni, cron);
- un CPT o una tassonomia potrebbero non dover essere migrati;
- contenuti privati o password-protected: migrare, escludere o riprogettare;
- shortcode e blocchi page builder senza equivalente ovvio nel target;
- revisioni e commenti: conservare o scartare.

Regola: i **fatti** si cercano nell'ambiente, le **decisioni** si chiedono.

## Output obbligatori

Tutti in `docs/migration/`, creata se assente:

| File | Contenuto |
|---|---|
| `source-audit.md` | report narrativo: piattaforma, tema, plugin, rischi, debito, domande aperte |
| `content-inventory.csv` | `tipo,id_wp,slug,titolo,stato,parent_id,template,url,data_mod,note` |
| `taxonomy-inventory.csv` | `tassonomia,termine,slug,parent,conteggio_oggetti` |
| `menu-inventory.csv` | `menu,location,voce,tipo_target,target_id,url,ordine,parent` |
| `media-inventory.csv` | `id_wp,path,mime,byte,larghezza,altezza,usato_da,alt_presente` |
| `seo-inventory.csv` | `url,title,meta_description,canonical,og_presente,noindex,redirect_da` |
| `migration-debt.md` | cosa va **ricreato** e non importato: plugin, licenze, form, integrazioni |
| `open-questions.md` | decisioni aperte, con opzioni e raccomandazione, da chiudere via grill-me |

CSV: separatore `,`, quoting `"`, encoding UTF-8, prima riga di intestazione.

## Checklist di verifica

Da riportare compilata in coda a `source-audit.md`. Ogni voce: `OK` / `N/D` /
`BLOCCATO`, sempre con la prova (query, path, comando) accanto.

- [ ] Versione WordPress e prefisso tabelle rilevati e documentati
- [ ] Tema padre e child identificati; child theme diffato rispetto al padre
- [ ] Plugin attivi e inattivi elencati con versione
- [ ] mu-plugins e drop-ins verificati, non solo la cartella `plugins/`
- [ ] Page builder e shortcode censiti con numero di occorrenze
- [ ] Conteggi per ogni tipo e stato di contenuto, con la query che li produce
- [ ] Somma dei conteggi riconciliata col totale della tabella post; scarti spiegati
- [ ] Tassonomie e termini censiti, inclusi termini orfani
- [ ] Gerarchia pagine ricostruita; cicli e parent mancanti segnalati
- [ ] Menu e location mappati; voci che puntano a contenuti inesistenti segnalate
- [ ] Media contati e riconciliati tra record in DB e file su disco
- [ ] Media orfani (su disco, non in DB) e mancanti (in DB, non su disco) elencati
- [ ] Contenuti non raggiungibili dal menu elencati esplicitamente
- [ ] Bozze, privati e password-protected contati separatamente
- [ ] Struttura permalink ed elenco URL pubblici estratti
- [ ] URL hardcoded e media con dominio assoluto contati
- [ ] Redirect, sitemap, `robots.txt` e canonical documentati
- [ ] Debito di migrazione compilato: cosa va ricreato a mano
- [ ] Nessun segreto, hash o PII presente negli output (verifica esplicita)
- [ ] Ogni numero riportato ha la sua fonte citata
- [ ] Domande aperte raccolte in `open-questions.md`

## Condizioni di stop

Fermarsi **subito** e chiedere all'utente quando:

- manca sia il dump SQL sia l'albero file;
- l'unica via per ottenere un dato richiede scrittura, import o aggiornamento;
- si incontra un file di credenziali o un `.env`: non leggerlo, segnalarne solo l'esistenza;
- i conteggi non si riconciliano e la causa non e' determinabile dai soli dati;
- una funzionalita' del sito non e' deducibile dall'ambiente: usare `/grill-me`;
- l'utente chiede di passare a import, sviluppo o fase gestionale mentre l'audit e'
  incompleto: citare il gate e attendere conferma.

Non dichiarare mai l'audit "completo" se esiste anche una sola voce `BLOCCATO`:
dichiararlo **parziale** ed elencare cosa manca.

## Formato della risposta

Al termine, in chat, esattamente in questo ordine:

1. **Stato** — `COMPLETO` / `PARZIALE` / `BLOCCATO`, una riga, con il motivo.
2. **Numeri chiave** — tabella compatta: tipo contenuto, conteggio, fonte.
3. **File prodotti** — elenco dei path in `docs/migration/`.
4. **Rischi di migrazione** — massimo 10 voci, ordinate per impatto.
5. **Domande aperte** — numerate, con opzioni e raccomandazione; se maggiori di zero,
   proporre `/grill-me`.
6. **Prossimo passo proposto** — uno solo, poi attendere conferma.

Nessuna dichiarazione di completezza senza i numeri del punto 2.
