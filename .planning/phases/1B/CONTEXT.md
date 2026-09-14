# CONTEXT — Fase 1B · Architettura della migrazione e piano eseguibile

Creato il 2026-09-14. Prerequisito richiesto da `CLAUDE.md` §«GSD Workflow
Prerequisites» e previsto da `docs/discovery/phase-plan.md` §1.

---

## 1. Perimetro

La Fase 1B **progetta**. Non scaffolda, non installa dipendenze, non scrive codice
applicativo, non tocca `source-private/`. Il suo prodotto è documentazione
decisionale ed eseguibile: ADR, schema, mapping, specifica dell'importer, strategia
di conversione dei contenuti, criteri di accettazione visiva, proposte di design.

Vincolo esplicito di D5: **nessuno scaffold prima che le ADR siano approvate.**

## 2. Stato in ingresso

| Voce | Valore |
|---|---|
| Fase 1A | approvata dall'utente il 2026-09-14 |
| Gate assoluto di Fase 1 | **NON superato** |
| Sorgente autorevole | `source-private/wordpress-2026-09-13/`, `source-private/BackupDB-2026-09-13/` |
| Istanza di riferimento | attiva, `tools/wp-reference/`, congelata al 2026-09-13 |
| Decisioni registrate | DR-001 … DR-030 in `docs/decisions/decision-register.md` |

## 3. Fatti della sorgente che vincolano questa fase

Da `docs/migration/wp-source-inventory.md` e dai rilievi della wave `1B-W0`.

| # | Fatto | Conseguenza sul progetto |
|---|---|---|
| F-01 | 78 pagine, 29 articoli + 1 bozza, 170 allegati, 2 categorie, 0 tag | Lo schema non deve reggere volumi grandi: reggere **bene** volumi piccoli |
| F-02 | 10 shortcode Divi distinti; 5 coprono il 97% delle occorrenze | Modello a blocchi ridotto, non un clone di Divi |
| F-03 | 60 contenuti su 107 sono HTML semplice, senza page builder | Servono **due** rappresentazioni del contenuto, non una |
| F-04 | 0 commenti, 1 solo utente | Nessun modello commenti; l'autenticazione parte da zero |
| F-05 | 169 pagine allegato rispondono 301 al file, per impostazione AIOSEO | I redirect sono dati, non codice |
| F-06 | 2 title SEO personalizzati, 0 description, 0 og:image su 282 record | Si migrano le **regole**, non i record |
| F-07 | 1 slider con 12 slide | Un componente carosello, non una libreria |
| F-08 | 41 voci di menu su 64 sono visibili agli anonimi | Il menu pubblico ha una sua visibilità, distinta dal menu a database |
| F-09 | 425 compilazioni form e 187 log email, importati per decisione DR-026 | Tabelle di sola conservazione, isolate, senza uso funzionale in Fase 1 |
| F-10 | Un solo tema (Divi 4.18.0), nessun child theme, CSS dinamico in `et-cache/` | I design token si estraggono dal CSS reso, non dal tema |

## 4. Decisioni utente che entrano in questa fase

| id | Contenuto |
|---|---|
| MI-01 | Form: **form minimale che recapita per email**, da sostituire in fase gestionale con form generati dal backend |
| MI-02 | I 4 documenti riservati **devono esistere anche nella futura area riservata**. Il primo deploy ha frontend pixel-perfect **e** backend minimale per creare e modificare pagine |
| MI-03 | PHP di produzione **7.4.33**, estensione `mysqli`, server MySQL **5.6.51-91.0-log** |
| MI-10 | Le 170 pagine allegato **restano 301**: il comportamento va mantenuto |
| D5 | Le scelte su framework API, ORM e reverse proxy arrivano come **tre ADR argomentate** in questa fase |
| D7 | Schema in **inglese snake_case**, allineato ai nomi dei modelli |

## 5. Vincoli non negoziabili

- Nessun dato reale in documentazione, esempi, screenshot, fixture, Git.
- Nessuna dichiarazione di conformità GDPR o fiscale.
- Nessuna fase gestionale pianificata: l'area amministrativa si **progetta** nello
  spazio di navigazione (DR-028), ma in Fase 1 si **costruisce** solo il CMS.
- L'area amministrativa non deve assomigliare a WordPress (DR-018).
- Ogni decisione architetturale è una **proposta** finché l'utente non la approva.

## 6. Output attesi

Elencati in `PLAN.md`.

## 7. Criteri di uscita

1. Ogni ADR ha contesto, opzioni, alternativa scartata, conseguenze, e stato
   dichiarato (`proposta` o `approvata`).
2. Ogni tabella dello schema è riconducibile a un requisito di
   `docs/discovery/requirements-consolidated.md`.
3. Ogni colonna sorgente di WordPress ha destinazione o motivo di esclusione.
4. La specifica dell'importer dichiara cosa accade rieseguendolo due volte di fila.
5. Ogni shortcode Divi rilevato in 1A ha una destinazione dichiarata.
6. Le soglie di diff visivo sono numeriche e motivate; viewport e browser fissati.
7. Esistono 4 proposte di UI e 4 di UX, su dati sintetici, pronte per la scelta.
8. `PROGRESS.md` ha una riga per ogni wave completata.
