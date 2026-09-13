# CLAUDE.md — Centro per la Famiglia Amoris Laetitia

Istruzioni di progetto. Prevalgono sulle impostazioni generali dell'agente e
integrano le regole globali dell'utente.

## Cos'è questo progetto

Sostituzione del sito WordPress `www.centroamorislaetitia.it` con una piattaforma
React + Next.js, Node.js + TypeScript e PostgreSQL, dotata di CMS interno, e in
seguito di un'area gestionale per il consultorio.

WordPress è **solo la sorgente** da cui estrarre contenuti, asset, struttura, URL,
SEO, menu e comportamento pubblico. Il runtime finale **non** dipende da WordPress,
PHP, MySQL o MariaDB.

## Gate assoluto

Nessuna fase gestionale — back-office, appuntamenti, contabilità, corsi, soci,
area riservata, pagamenti, comunicazioni, PWA, integrazioni — può essere
**pianificata**, avviata o rilasciata finché non sono entrambe vere:

1. parità pixel-perfect approvata esplicitamente dall'utente in
   `docs/qa/visual-parity-report.md`;
2. deploy in produzione eseguito e verificato, con release report e smoke test in
   `docs/deploy/`.

Se viene chiesto di scavalcarlo: citare il gate, elencare cosa manca, attendere
conferma esplicita. Vedi la skill `deployment-gate`.

## Stack vincolante

Monorepo pnpm + Turborepo · TypeScript strict · Next.js App Router + React ·
Node.js + TypeScript (framework API da ADR) · PostgreSQL · ORM da ADR (Prisma o
Drizzle) · validazione Zod o equivalente · OpenAPI documentata e testata · storage
S3-compatible con MinIO in locale · reverse proxy da ADR (Caddy o Nginx) · Docker
Compose · Vitest, React Testing Library, Playwright, integrazione su PostgreSQL ·
GitHub Actions · ESLint, Prettier.

Qualunque scostamento richiede una ADR approvata dall'utente.

## Sorgenti

| Path | Natura | Regola |
|---|---|---|
| `source-private/wordpress-2026-09-13/` | Installazione WordPress completa, 2026-09-13 | **sorgente autorevole**, sola lettura |
| `source-private/BackupDB-2026-09-13/` | Dump del database, 2026-09-13 | **sorgente autorevole**, sola lettura |
| `source-private/wordpress/` | Backup di marzo 2026, WordPress 6.9 | superato, solo riscontro storico |
| `source-private/planning/` | Documentazione di un progetto .NET abbandonato | requisiti business sì, scelte tecnologiche no |

`source-private/` e `source-readonly/` **non si modificano mai**.

## Privacy — non negoziabile

Il Centro tratta dati di particolare delicatezza: consulenze familiari, minori,
dati economici, documenti.

- Mai dati reali in test, seed, fixture, screenshot, README, log, Git, prompt o
  documentazione. Solo dati sintetici.
- Mai segreti, token, password, IBAN, dati sanitari o anagrafici completi nei log
  o nei documenti.
- `source-private/planning/credenziali.txt` non si apre.
- `source-private/planning/modelli/` contiene dati finanziari e personali reali:
  se ne usa la **forma**, mai il contenuto.
- `wp-config.php` del backup contiene credenziali del database: non stamparlo.
- I file `uploads/backwpup-*` contengono backup annidati: non estrarli senza motivo.
- `.env.example` sì, `.env` con valori reali mai.
- Segnalare sempre quando serve verifica legale, fiscale o privacy. Non dichiarare
  mai conformità GDPR o fiscale senza validazione umana.

Vedi la skill `privacy-safe-development`.

## Decisioni

I **fatti** si cercano nell'ambiente. Le **decisioni** si chiedono all'utente, con
la skill `grill-me`: massimo 5 domande per round, numerate in modo stabile, con
opzioni, raccomandazione, impatto e riga "Default vietato".

Ogni decisione approvata va registrata in `docs/decisions/decision-register.md`,
append-only. Si registra la risposta dell'utente, non la raccomandazione.

Non decidere da soli: requisiti ambigui, priorità, UX o copy che cambiano il
significato del sito, conservazione e cancellazione dati, ruoli e autorizzazioni,
provider e costi, trade-off architetturali, schema contabile, integrazioni,
criteri di accettazione, difformità dalla sorgente.

## Conferma obbligatoria prima di

Deploy · modifiche DNS, dominio, certificati · configurazione o invio di email ·
pagamenti · import reali non dry-run · migrazioni su database di produzione ·
cancellazioni · modifiche a dati reali · commit e push.

Prima di ognuna: mostrare comando, file coinvolti, impatto, backup e rollback,
verifica successiva. Una conferma vale per quella azione, non si eredita.

## Esecuzione per wave

Protocollo `PROGRESS.md` obbligatorio: leggere prima di ogni wave, appendere una
riga dopo. Mai rieseguire una wave completata. Alla ripresa dopo interruzione,
riportare ultima wave completata e wave rimanenti prima di proseguire.

Prima di qualunque completamento di milestone o fase, eseguire **prima** il passo
di audit e validazione.

## Pixel-perfect

Il termine non si usa senza prove. Per ogni URL della matrice: screenshot sorgente
alle viewport concordate, browser versionati e documentati, diff con soglia
motivata, verifica manuale di interazioni, hover, menu, form, navigazione mobile,
caricamento font, immagini, breakpoint, embed e accessibilità di base. Tutto
registrato in `docs/qa/visual-parity-report.md`.

Vale per il **sito pubblico**. L'area amministrativa **non deve assomigliare a
WordPress**: ha un proprio design, scelto dall'utente fra proposte.

## Documenti di handoff

Ogni volta che si chiede un'azione all'utente, produrre un documento in
`docs/handoff/` con istruzioni passo passo, prerequisiti, comandi esatti, esito
atteso, cosa fare se fallisce, e come segnalare il completamento.

## Formato delle risposte

Ogni risposta contiene, in quest'ordine: stato della fase · evidenze osservate ·
file letti o modificati · decisioni già documentate · assunzioni vietate e
decisioni richieste · rischi e mitigazioni · verifiche effettuate e risultato ·
prossima azione proposta · conferma richiesta.

Ogni risposta si chiude con tre elementi:

1. tabella dello **stato delle fasi**;
2. tabella delle **azioni bloccanti attese dall'utente**;
3. il **prompt successivo** suggerito, così che l'utente possa ripulire il contesto.

## Lingua

Documentazione, commenti e messaggi all'utente in italiano. Nomi di classi, metodi
e variabili in inglese secondo le convenzioni del linguaggio.

## Divieti

Nessun refactor non richiesto · nessuna dipendenza inutile o non manutenuta ·
nessun plugin esterno installato di iniziativa · nessuna fase pianificata fuori
sequenza · nessun piano che presupponga il gate superato senza le sue prove ·
mai dichiarare completata una fase senza prove verificabili.
