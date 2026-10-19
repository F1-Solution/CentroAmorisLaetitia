# CONTEXT — Fase 1G · Collaudo redazionale del CMS

Creato il 2026-10-19, nella wave `1G-W0`. Prerequisito richiesto da `CLAUDE.md`
§«GSD Workflow Prerequisites»: la fase si apre con una wave di sola pianificazione,
come le fasi precedenti.

Sblocco della fase: **DR-211** del 2026-10-19 chiude la Fase 1E. Il prerequisito di
`docs/discovery/phase-plan.md` per la 1G, «1D e 1E sostanzialmente complete», è
soddisfatto da DR-103 e DR-211. Le decisioni di perimetro sono in
[`DECISIONI-1G.md`](DECISIONI-1G.md), registrate come **DR-213…DR-221**.

---

## 1. Perimetro

La Fase 1G rende l'area amministrativa capace di tutto ciò che la condizione 7 del gate
chiede, e poi lo **prova con una persona**: l'utente, nel ruolo di redattore, esegue i
compiti 1G-1…1G-10 dall'interfaccia, senza assistenza, su un database di collaudo
separato. Alla fine della fase ogni compito ha un esito registrato, ogni difetto è chiuso
o approvato, e la fase si ferma per chiedere all'utente l'**approvazione del collaudo
redazionale**.

Dentro il perimetro (DR-213):

- **gestione degli account e ruoli** (DR-219, DR-220): ruolo `amministrazione` e permesso
  `users.manage`; schermata «Persone e permessi» con elenco, crea, disattiva, reimposta
  password; revisione di sicurezza;
- **registro delle operazioni leggibile** (DR-216 A): schermata filtrabile per contenuto e
  «ultima modifica di X il Y» nell'editor (1G-9);
- **contenuti** (DR-216 D, DR-217 A, B, C): slug e genitore modificabili, con redirect
  automatico dal vecchio indirizzo e ricalcolo dei percorsi delle pagine figlie; estratto
  e immagine in evidenza; categorie (assegnare, togliere, creare, rinominare);
  eliminazione con conferma;
- **media** (DR-216 C, DR-217 D): dimensioni derivate rigenerate alla sostituzione; tipi
  di file ammessi e messaggi in italiano per tipo rifiutato e file troppo grande;
- **anteprima della bozza sul sito pubblico** (DR-216 B): indirizzo riservato, `noindex`,
  resa identica a quella pubblicata (1G-10);
- **documenti scaricabili e caroselli** modificabili (DR-218): sostituire il file, il
  titolo, l'ordine delle immagini;
- **ambiente di collaudo** (DR-215): database, archivio dei media, API, area
  amministrativa e sito dedicati, ripristinabili;
- **il collaudo** (DR-214, DR-221): un handoff per compito, esito e tempo registrati;
  correzione dei difetti e nuovo collaudo dei compiti interessati;
- **la non regressione della parità** approvata con DR-210;
- **il rapporto** `docs/qa/cms-editability-report.md`, la matrice
  `docs/qa/editability-matrix.csv` e `AUDIT.md`.

Fuori dal perimetro, e non si comincia (DR-218):

- revisioni e ripristino; programmazione della pubblicazione; contenuti privati o
  protetti da password; configurazione dei form e lettura delle compilazioni; widget della
  barra laterale; ruoli oltre i due di DR-220. Sono **volutamente non modificabili** in
  Fase 1 e il rapporto li elenca come tali;
- creazione di nuovi menu e di nuove chiavi delle impostazioni: non richieste da alcun
  criterio;
- creazione di nuovi blocchi immagine, video, mappa, modulo, documento e presentazione:
  l'avviso dell'editor lo dichiara già; quelli presenti restano modificabili;
- staging, produzione, email, DNS: Fase 1F;
- correzione dei difetti ereditati che cambiano la resa (DR-115, DR-169): richiedono una
  decisione propria, perché toccano la parità approvata;
- qualunque cosa della fase gestionale: il gate lo vieta.

## 2. Stato in ingresso

| Voce | Stato al 2026-10-19 |
|---|---|
| Area amministrativa | Pagine, notizie, media, menu, SEO e redirect, impostazioni; editor dei blocchi con trascinamento; commutatore di ruolo. Inventario completo in `DECISIONI-1G.md` §5 |
| Voci che danno 404 | `/impostazioni/registro`, `/impostazioni/persone` (`apps/admin/src/lib/areas.ts`) |
| Permessi | 5: `content.read`, `content.write`, `content.publish`, `media.write`, `settings.write` (`apps/api/src/auth/permissions.ts`) |
| Account | Solo da comando `account:create`, accettato solo su database locale |
| Registro delle operazioni | Scritto (`auth/audit.ts`, `plugins/audit.ts`), mai letto |
| Dimensioni derivate dei media | Importate dai file generati da WordPress; **nessuna libreria di elaborazione delle immagini** nel progetto |
| Area amministrativa → API | Indirizzo dell'API fissato alla compilazione (`NEXT_PUBLIC_API_URL`, `apps/admin/src/lib/api.ts:15`) |
| Archivio dei media | Nome del bucket da configurazione (`S3_BUCKET_PUBLIC`, `apps/api/src/config.ts:89`) |
| Porte in uso | sviluppo: sito 3000 (3200 con `next start` nella 1E), area amministrativa 3001, API 3002; e2e: 3100, 3101, 3102 con `amoris_e2e` |
| Prove | 24 e2e dell'area amministrativa in `tests/e2e/cms/`; CI `39201139144` verde su `ca9e39b` |
| Database di sviluppo | Import reale, base della parità approvata (DR-210); 425 compilazioni importate |
| Istanza di riferimento | Ancora presente; distruzione rinviata a dopo la 1G (DR-212) |
| HO-006 | Ancora aperto dalla 1D (prova a mano delle schermate della `1D-W9`) |

## 3. Fatti che vincolano questa fase

| Fatto | Fonte |
|---|---|
| Un compito che richiede l'intervento dell'agente lascia la condizione 7 non soddisfatta | `acceptance-criteria.md` §5 |
| Un contenuto importato ma non modificabile dal redattore è un contenuto non migrato | skill `cms-editability-qa` |
| Collaudo dall'interfaccia, mai da SQL o API; nessuna correzione via SQL per far passare un compito | skill `cms-editability-qa` |
| Un solo ruolo attivo per volta, sessione vincolata al ruolo attivo | DR-050, DR-067 |
| Accesso a sessioni opache proprie, 12 controlli obbligatori, riesame obbligatorio | ADR-007 §3.1, §3.3 |
| Resa sul server a ogni richiesta, senza cache intermedia | DR-105 |
| L'anteprima dell'editor usa gli stessi componenti del sito | ADR-006 §3.3 |
| Aprire e salvare senza modifiche non cambia la pagina pubblica | ADR-005 §7, criterio 1E-19 |
| Redirect serviti dall'applicazione, mai dal proxy | ADR-003 §3 |
| Bucket pubblico letto attraverso l'applicazione; riservato non raggiungibile | ADR-004 §3.6 |
| Parità approvata con le difformità elencate; una modifica che la peggiora è una regressione | DR-210, `visual-parity-report.md` §12 |

## 4. Vincoli non negoziabili

- **Privacy.** Nel database di collaudo le compilazioni dei form sono svuotate (DR-215).
  Account di prova solo sintetici (`*@example.invalid`). Nessuna password, token o dato
  personale in log, rapporti, catture o Git. I contenuti di prova si rimuovono a fine fase
  e la rimozione si dichiara.
- **Il database di sviluppo non si tocca durante il collaudo.** Le scritture del collaudo
  avvengono solo nell'ambiente dedicato; il ripristino e lo svuotamento si fanno su
  conferma, con handoff.
- **Il collaudo è dell'utente.** L'agente prepara, osserva il sito e registra; non esegue
  i compiti al posto suo e non dichiara superato un compito che non ha visto riuscire.
- **La parità non peggiora.** Prove di andata e ritorno, 1E-19 e confronto visivo prima
  del collaudo; una vista peggiorata rispetto agli esiti accettati blocca la fase.
- **Sicurezza dell'accesso.** Le nuove rotte degli account passano la revisione di
  sicurezza e le prove negative per ruolo via interfaccia, indirizzo e API prima del
  collaudo.
- **Conferme obbligatorie.** Commit e push, migrazioni sul database di sviluppo,
  ripristino del database di collaudo, cancellazioni: ognuna con la sua conferma.

## 5. Rischi noti in ingresso

| id | Rischio | Mitigazione |
|---|---|---|
| RG-01 | Slug e genitore modificabili rompono indirizzi indicizzati, creano catene o cicli di redirect | Prove automatiche sui 181 redirect e sui 293 indirizzi della matrice; regola esplicita contro catene e cicli; percorso delle figlie ricalcolato nella stessa transazione |
| RG-02 | Creazione di account e reimpostazione delle password aumentano la superficie d'attacco | Revisione di sicurezza dedicata; `users.manage` solo all'amministrazione; prova negativa via URL e API; nessuna password nei log; i 12 controlli di ADR-007 rieseguiti |
| RG-03 | Le modifiche al codice degradano la parità approvata | Confronto visivo integrale e 1E-19 nella wave di non regressione, prima del collaudo |
| RG-04 | Rigenerare le dimensioni derivate cambia la resa delle immagini esistenti | Rigenerazione solo alla sostituzione, mai in blocco; stesse dimensioni e ritagli registrati dall'import |
| RG-05 | Il collaudo scrive su media condivisi con lo sviluppo | Bucket dedicato al collaudo (DR-223) |
| RG-06 | L'anteprima della bozza espone contenuti non pubblicati | Indirizzo con autorizzazione, `noindex`, nessuna cache; prova negativa da anonimo |
| RG-07 | Memoria della macchina insufficiente per confronto integrale e collaudo insieme (già visto nella 1E-W7) | Wave piccole, ripartibili da `PROGRESS.md`; ambiente di collaudo acceso solo durante il collaudo |
| RG-08 | Un compito fallisce per un difetto che richiede codice: il ricollaudo allunga la fase | Wave di correzione dedicata; si ricollaudano solo i compiti interessati |

## 6. Output attesi

Elencati in [`PLAN.md`](PLAN.md), wave per wave.

## 7. Criteri di uscita

Ognuno di questi criteri viene **eseguito** nell'audit della fase e il suo esito
registrato in `AUDIT.md`.

**Collaudo redazionale — `acceptance-criteria.md` §5, eseguiti dall'utente**

| # | Compito | Criterio |
|---|---|---|
| 1G-1 | Creare una pagina nuova, scriverla, pubblicarla, metterla a menu | riesce senza assistenza |
| 1G-2 | Modificare testo e immagine di una pagina Gutenberg | riesce |
| 1G-3 | Modificare testo e immagine di una pagina Divi convertita | riesce |
| 1G-4 | Modificare un contenuto con un blocco di riserva | riesce, e l'avviso è comprensibile |
| 1G-5 | Sostituire un'immagine e aggiornare il testo alternativo | riesce, e il sito mostra la nuova immagine in ogni dimensione |
| 1G-6 | Cambiare l'ordine di due voci di menu | riesce |
| 1G-7 | Cambiare il titolo SEO di una pagina e vederne l'effetto | riesce |
| 1G-8 | Creare un redirect da un vecchio indirizzo | riesce |
| 1G-9 | Trovare chi ha modificato un contenuto e quando | riesce |
| 1G-10 | Dopo ogni modifica, la pagina pubblica corrisponde all'anteprima | verificato per ognuna |

Per ogni compito si registra il **tempo**; non è vincolante. Oltre 10 minuti il compito
apre un difetto di usabilità da esaminare, non un fallimento (DR-221).

**Criteri della 1D collaudati in 1G — `acceptance-criteria.md` §3.4**

| # | Criterio |
|---|---|
| 1D-28…1D-37 | Ognuno eseguito dall'interfaccia almeno una volta durante il collaudo, con esito nella matrice |

**Criteri aggiunti dalle decisioni della fase**

| # | Criterio | Fonte |
|---|---|---|
| 1G-11 | Cambiare slug o genitore crea il redirect dal vecchio indirizzo, aggiorna i percorsi delle figlie; nessuna catena né ciclo; i 181 redirect esistenti invariati | DR-216 D |
| 1G-12 | Estratto, immagine in evidenza e categorie di una notizia modificabili; il sito li mostra negli elenchi e negli archivi | DR-217 A, B |
| 1G-13 | Eliminare un contenuto dall'interfaccia, con conferma; rifiuto spiegato se ha figlie | DR-217 C |
| 1G-14 | Un file di tipo non ammesso o troppo grande è rifiutato con un messaggio in italiano | DR-217 D |
| 1G-15 | Un documento scaricabile e un carosello modificabili dall'interfaccia, con effetto sul sito | DR-218 |
| 1G-16 | L'amministrazione crea, disattiva un account e ne reimposta la password; l'account disattivato non entra | DR-219 |
| 1G-17 | La redazione non raggiunge «Persone e permessi» né il registro: né dal menu, né dall'indirizzo, né dall'API | DR-220 |
| 1G-18 | Revisione di sicurezza delle rotte nuove senza esiti critici o alti aperti; i 12 controlli di ADR-007 superati | DR-219, ADR-007 |
| 1G-19 | L'anteprima della bozza non è raggiungibile da un anonimo, è `noindex` e non finisce nella sitemap | DR-216 B |
| 1G-20 | Nessuna voce dell'area amministrativa risponde 404 | DR-218 |

**Non regressione**

| # | Criterio | Fonte |
|---|---|---|
| 1G-21 | Confronto visivo integrale: nessuna vista peggiorata rispetto agli esiti accettati (DR-162, DR-203) | DR-210 |
| 1G-22 | 1E-19 4/4; menu 41/41; metadati 0 difformi; redirect 181/181; stati 292/292 | `AUDIT.md` della 1E |
| 1G-23 | `lint`, Prettier, `typecheck`, `build`, `test`, `db:verify`, copertura, e2e verdi in locale e in CI | condizione 12 del gate |
| 1G-24 | Zero errori in console durante i cicli di modifica del collaudo | skill `cms-editability-qa` |

**Esiti del collaudo — skill `cms-editability-qa`**

| # | Criterio |
|---|---|
| 1G-25 | `docs/qa/editability-matrix.csv` con ogni tipo di contenuto dell'inventario e i campi volutamente non modificabili di DR-218 |
| 1G-26 | Caccia al contenuto scritto nel codice del sito, con esito elencato per file e riga |
| 1G-27 | Contenuti e account di prova rimossi dall'ambiente di collaudo; rimozione dichiarata |
| 1G-28 | Ogni difetto chiuso o approvato dall'utente, voce per voce |

La fase **non** si chiude con l'audit: si chiude con l'approvazione dell'utente del
collaudo redazionale, registrata in `docs/qa/cms-editability-report.md` (condizione 7 del
gate).

## 8. Assunzioni vietate e decisioni richieste

Le decisioni sono in [`PLAN.md`](PLAN.md) §8. D110…D118 sono chiuse da DR-213…DR-221;
D119…D122 sono chiuse da DR-223…DR-226; il piano è approvato da DR-222.
