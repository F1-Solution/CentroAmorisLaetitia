# Prima dell'audit `1D-W12` — form del modulo di contatto e copertura in CI

Piano scritto il 2026-10-07 su richiesta dell'utente, dopo la chiusura della
`1D-W9b`. Attua **DR-094** (seconda metà) e **DR-095**. Protocollo
`PROGRESS.md`: una riga per sotto-wave.

## `1D-W11e` — un form proprio per `et_pb_contact_form` (DR-094)

**Obiettivo:** il modulo di contatto di Divi della pagina con `legacy_id` 42
diventa un form vero, e la pagina lo cita con un blocco `form` invece del blocco
di riserva. Il criterio di uscita 10 della fase torna a zero.

**Fatti** (dalla sorgente, sola lettura): un solo `et_pb_contact_form` in tutta
la sorgente; titolo «Richiesta informazioni»; quattro campi — Nome (testo),
Indirizzo e-mail (email), Telefono (non obbligatorio), Messaggio (testo su più
righe); messaggio di conferma; un indirizzo di destinazione per la notifica;
captcha numerico di Divi attivo per impostazione predefinita.

**Come:**

1. `apps/importer/src/stages/forms/diviContactForm.ts` — funzione pura
   `findDiviContactForms(posts)`: legge i contenuti pubblicati con il parser di
   shortcode già esistente e restituisce titolo, campi, conferma e notifica.
   Campo Divi `input` o assente → `text`; `email` → `email`; `text` → `text` con
   l'opzione `multiline: true`; `required_mark="off"` → non obbligatorio.
2. Fase `forms`: oltre ai form di WPForms, scrive i form di Divi.
   Corrispondenza in `import_id_map` con `source_table = 'divi_contact_form'` e
   `source_id` = identificativo della pagina; `forms.legacy_id` resta vuoto,
   perché è la chiave di WPForms. Slug derivato dal titolo, con il prefisso
   `contatto-` per non collidere con i form di WPForms.
3. `buildFormResolver`: risolve `divi-contact-form:<titolo>` sul form di Divi
   con quel titolo, trovato attraverso `import_id_map`.
4. Conteggio atteso di `forms`: **26** invece di 25, conseguenza dichiarata di
   DR-094, in `report/tableCounts.ts` e in `database-schema.md` §6.

**Non si fa senza conferma:** la **notifica email**. Inserirne la
destinazione è configurazione di email (`CLAUDE.md`, conferma obbligatoria): è
la decisione D28 qui sotto. Fino ad allora il form nasce **senza** notifiche.

**Prove (dati sintetici):** il lettore trova il modulo, i quattro campi, i tipi,
l'obbligatorietà e il messaggio di conferma; la fase `forms` crea il form e la
riga della corrispondenza, e una seconda esecuzione non ne crea un altro; il
convertitore produce un blocco `form` che lo cita e nessun blocco di riserva.

**Verifica sulla sorgente vera, senza scrivere:** `importer plan` deve dare
blocchi di riserva **7** invece di 8 e `forms` **26**. L'`apply` reale che porta
il form nel database locale è un import reale: **conferma puntuale** a parte.

## `1D-W10b` — copertura in CI con soglia dell'80 % (DR-095)

**Obiettivo:** la CI fallisce se la copertura scende sotto l'80 %, su tutte e
quattro le misure (istruzioni, diramazioni, funzioni, righe).

**Come:**

1. `vitest.config.ts` di radice: `coverage.thresholds` a 80 per le quattro
   misure; il commento d'intestazione si aggiorna (oggi dice che non entra in CI).
2. `.github/workflows/ci.yml`: passo «Copertura» con `pnpm test:coverage`, dopo
   i test, con gli stessi servizi (PostgreSQL e archivio a oggetti).
3. Prove aggiunte dove la misura di oggi resta sotto soglia, scelte fra i file
   meno coperti; mai prove scritte solo per far salire un numero.
4. `docs/qa/coverage-report.md` aggiornato con la misura nuova.

**Verifica:** `pnpm test:coverage` passa la soglia in locale; la CI vera si vede
al primo push, che resta a conferma dell'utente.

## Decisioni aperte

### D28. La notifica email del modulo di contatto (bloccante solo per la notifica)

- **A** — si crea la notifica come nella sorgente: destinazione l'indirizzo del
  Centro scritto nel modulo, testo con i quattro campi.
- **B** — il form nasce senza notifica; le richieste si leggono dall'area
  amministrativa, e la notifica si aggiunge quando si collauda l'invio.
- **Raccomandazione:** A. È ciò che il sito fa oggi, e una richiesta di contatto
  che nessuno riceve è il danno peggiore che R-11 segnala.

## Conferme puntuali necessarie

- `apply --confirm` sul database locale, per portarvi il nuovo form.
- Il push, per vedere la soglia di copertura in CI.
