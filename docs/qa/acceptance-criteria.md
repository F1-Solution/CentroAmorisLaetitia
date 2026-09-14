# Criteri di accettazione — Fase 1B, wave `1B-W6`

Che cosa deve essere vero, e come si dimostra, perché ogni fase della Fase 1 possa
dirsi conclusa e il gate possa dirsi superato.

| | |
|---|---|
| **Stato** | **proposta** |
| **Principio** | ogni criterio è **misurabile** o **osservabile**. Nessun criterio si soddisfa per dichiarazione |
| **Correlati** | [`visual-regression-plan.md`](visual-regression-plan.md), `docs/discovery/phase-plan.md` §3 |

---

## 1. Regola generale

> Un criterio soddisfatto senza prova registrata è un criterio **non** soddisfatto.

Per ciascuno: che cosa si misura, con quale strumento, dove finisce la prova. Un
esito negativo registrato vale più di un esito positivo affermato.

## 2. Fase 1C — Fondazione locale

| # | Criterio | Prova |
|---|---|---|
| 1C-1 | Il monorepo si installa da zero con un solo comando, su una macchina pulita | comando e output nel rapporto di fase |
| 1C-2 | `docker compose up` avvia PostgreSQL, storage a oggetti e le quattro applicazioni | tutti gli health check rispondono |
| 1C-3 | La migrazione iniziale si applica su database vuoto e **si riesegue senza errori** | esecuzione doppia registrata |
| 1C-4 | Lo schema generato corrisponde a `docs/architecture/schema.sql` | confronto automatico, differenza vuota |
| 1C-5 | Le colonne del database sono in `snake_case` senza annotazioni per campo | ispezione dello schema (DR-036, ADR-002 §7) |
| 1C-6 | I 12 controlli di sicurezza di ADR-007 §3.1 sono attuati, ciascuno con un test | elenco spuntato, test verdi |
| 1C-7 | La logica di autenticazione propria **sta sotto le 300 righe** | conteggio. Sopra quella soglia, ADR-007 §5.3 impone di adottare una libreria |
| 1C-8 | Regola di lint che vieta al sito pubblico di importare i componenti dell'area amministrativa | la regola esiste e fallisce quando deve (ADR-008 §3.3) |
| 1C-9 | `.env.example` completo; nessun segreto nel repository | scansione automatica |
| 1C-10 | Build, test, lint e controllo dei tipi verdi in CI | **condizione 12 del gate** |

## 3. Fase 1D — Importazione e CMS minimo

### 3.1 Importer — condizione 4 del gate

| # | Criterio | Prova |
|---|---|---|
| 1D-1 | `plan` non scrive nulla | confronto del database prima e dopo |
| 1D-2 | **Due `apply` di fila producono lo stesso stato** | confronto strutturale, escluse le marche temporali |
| 1D-3 | Ogni fase è una transazione; l'errore su un elemento non ferma la fase | prova con un elemento volutamente corrotto **sintetico** |
| 1D-4 | Ogni entità importata ha una riga in `import_id_map` | conteggio |
| 1D-5 | `rollback` riporta allo stato precedente | prova eseguita |
| 1D-6 | Il rapporto non contiene alcun dato personale | ispezione del rapporto |

### 3.2 Completezza dell'import — condizione 5 del gate

Conteggi attesi da `database-schema.md` §6. **Se uno non coincide, l'import non è
riuscito**, anche senza errori.

| # | Criterio | Atteso |
|---|---|---|
| 1D-7 | Contenuti | **108** |
| 1D-8 | Media | **170**, più circa 1.376 dimensioni derivate |
| 1D-9 | Checksum dei file coincidenti | **100%** |
| 1D-10 | Voci di menu | **64**, di cui 41 pubbliche |
| 1D-11 | Redirect | **180** |
| 1D-12 | Form e notifiche | **25** e **39** |
| 1D-13 | Compilazioni dei form | **425** |
| 1D-14 | Documenti | **8** (4 pubblici, 4 riservati) |
| 1D-15 | Slide del carosello | **12** |
| 1D-16 | Termini | **3** |
| 1D-17 | Righe `error` in `import_issues` | **0** |
| 1D-18 | Chiavi meta non classificate | **0** |
| 1D-19 | Riferimenti residui a `wp-content/uploads` | **0** |
| 1D-20 | Shortcode residui nel testo convertito | **0** |
| 1D-21 | Blocchi di riserva | ≤ 10% dei blocchi non contenitori, ≤ 15 contenuti |

### 3.3 Copertura dei casi limite — condizione 3 del gate

| # | Criterio | Dato della sorgente |
|---|---|---|
| 1D-22 | La bozza è importata come bozza | 1 articolo in bozza |
| 1D-23 | L'`auto-draft` è scartato | 1, deliberatamente escluso |
| 1D-24 | Nessun contenuto privato o protetto da password da gestire | verificato: **0** (1A §4.1) |
| 1D-25 | La gerarchia delle pagine è preservata | confronto dei percorsi con `url-matrix.csv` |
| 1D-26 | I contenuti non presenti a menu sono comunque raggiungibili al loro URL | 107 percorsi contro 41 voci di menu |
| 1D-27 | I 4 documenti riservati esistono e **non sono raggiungibili** da un anonimo | prova negativa, anche indovinando il nome del file |

### 3.4 CMS — condizione 7 del gate, collaudata in 1G

| # | Criterio |
|---|---|
| 1D-28 | Creare, modificare, pubblicare e ritirare una pagina e un articolo |
| 1D-29 | Modificare testo e immagini dentro i blocchi |
| 1D-30 | Aggiungere, spostare, eliminare blocchi dentro una colonna |
| 1D-31 | Caricare, sostituire ed eliminare un media, con testo alternativo e didascalia |
| 1D-32 | Modificare il menu: aggiungere, spostare, annidare, cambiare visibilità |
| 1D-33 | Modificare i metadati SEO di un contenuto e i template globali |
| 1D-34 | Creare, modificare e disattivare un redirect |
| 1D-35 | Modificare le impostazioni globali |
| 1D-36 | **Andata e ritorno**: aprire un contenuto e salvarlo senza modifiche non cambia nulla |
| 1D-37 | Ogni operazione produce una riga di audit log |

Il criterio 1D-36 è quello che protegge la parità dal degrado silenzioso: senza,
un'approvazione può decadere al primo salvataggio.

## 4. Fase 1E — Parità visiva — condizioni 6, 9, 10 del gate

Piano completo in [`visual-regression-plan.md`](visual-regression-plan.md).

| # | Criterio | Soglia |
|---|---|---|
| 1E-1 | Rumore di fondo della catena di cattura misurato e registrato | deve risultare **sotto lo 0,10%** |
| 1E-2 | 594 confronti eseguiti | 81 URL × 6 viewport + 36 × 3 |
| 1E-3 | Differenza per confronto | ≤ **0,10%** automatico; 0,10–0,50% esaminato; > 0,50% fallito |
| 1E-4 | Nessuna area contigua di differenza | > **32 × 32 px** |
| 1E-5 | Ogni maschera dichiarata, motivata e con coordinate | elenco nel rapporto |
| 1E-6 | Verifiche manuali su tutti gli 81 URL ad alta priorità | §8 del piano |
| 1E-7 | Menu reso a un anonimo | **41 voci**, gerarchia ed etichette identiche |
| 1E-8 | Confronto dei metadati contro `seo-rendered-baseline.csv` | 117 URL, esito per URL |
| 1E-9 | Redirect verificati nei due sensi | 180 regole |
| 1E-10 | Controprova a campione contro il sito online | 10 URL, nessuna divergenza dell'istanza di riferimento |
| 1E-11 | Difformità residue elencate e **approvate dall'utente** | condizione 10 del gate |
| 1E-12 | Nessun service worker registrato sul sito pubblico | ADR-008 §3.3 |

## 5. Fase 1G — Collaudo redazionale — condizione 7 del gate

Si svolge **con l'utente**, non per lui. Ogni compito è eseguito da una persona
senza assistenza, entro un tempo ragionevole, e l'esito si registra.

| # | Compito | Criterio |
|---|---|---|
| 1G-1 | Creare una pagina nuova, scriverla, pubblicarla, metterla a menu | riesce senza assistenza |
| 1G-2 | Modificare testo e immagine di una pagina **Gutenberg** | riesce |
| 1G-3 | Modificare testo e immagine di una pagina **Divi convertita** | riesce |
| 1G-4 | Modificare un contenuto che contiene un **blocco di riserva** | riesce, e l'avviso è comprensibile |
| 1G-5 | Sostituire un'immagine e aggiornare il testo alternativo | riesce |
| 1G-6 | Cambiare l'ordine di due voci di menu | riesce |
| 1G-7 | Cambiare il titolo SEO di una pagina e vederne l'effetto | riesce |
| 1G-8 | Creare un redirect da un vecchio indirizzo | riesce |
| 1G-9 | Trovare chi ha modificato un contenuto e quando | riesce |
| 1G-10 | Dopo ogni modifica, la pagina pubblica corrisponde all'anteprima | verificato per ognuna |

Se anche un solo compito richiede l'intervento dell'agente, la condizione 7 **non è
soddisfatta**, indipendentemente dalla qualità della parità visiva.

## 6. Accessibilità di base — parte della condizione 6

Non è una certificazione WCAG: è il minimo osservabile che `CLAUDE.md` richiede
dentro la verifica di parità.

| # | Criterio |
|---|---|
| A-1 | Ogni pagina è percorribile interamente da tastiera |
| A-2 | Il fuoco è sempre visibile e l'ordine è quello visivo |
| A-3 | La navigazione mobile si apre e si chiude da tastiera |
| A-4 | Ogni immagine informativa ha un testo alternativo; quelle decorative lo hanno vuoto |
| A-5 | I campi dei form hanno etichette collegate |
| A-6 | La lingua della pagina è dichiarata come italiano |
| A-7 | Gerarchia dei titoli coerente — **dipende dalla decisione D13**, vedi §8 |
| A-8 | Contrasto del testo conforme alla soglia comune, misurato sui colori estratti |

## 7. Fase 1F — Produzione — condizioni 14 e 15 del gate

| # | Criterio |
|---|---|
| 1F-1 | Lo stack si ricostruisce da zero su macchina pulita seguendo la sola documentazione |
| 1F-2 | **Ripristino completo da backup provato**, non descritto |
| 1F-3 | Security review eseguita, con attenzione esplicita all'autenticazione (ADR-007 §5) e alle tre tabelle con dati personali |
| 1F-4 | Nessun segreto nel repository né nelle immagini |
| 1F-5 | Prestazioni misurate: PageSpeed > 80, risposta sotto i 3 secondi (RC-08, RB-04) |
| 1F-6 | Piano di rientro scritto e provato |
| 1F-7 | Smoke test post-rilascio eseguito e registrato in `docs/deploy/` |
| 1F-8 | Import del differenziale eseguito sulla sorgente aggiornata (MI-07) |
| 1F-9 | Chiave Google Maps limitata per referrer e ruotata (MI-05) |
| 1F-10 | `phpinfo()` rimosso dalla produzione (R-17, HO-003) |
| 1F-11 | **Verifica privacy e legale completata** (MI-06) — richiede un professionista, non si sostituisce con una dichiarazione tecnica |
| 1F-12 | Ogni azione irreversibile ha una conferma puntuale registrata |

## 8. Criteri sospesi in attesa di decisione

Tre criteri non si possono fissare ora, perché dipendono da decisioni aperte.

| # | Criterio | Dipende da |
|---|---|---|
| S-1 | Se le 29 pagine senza `<h1>` debbano riprodurre l'assenza o ricevere un titolo reso identico | **D13** |
| S-2 | Se le 45 pagine senza meta description debbano restarne prive | **D13** |
| S-3 | Come si comporta il campo di pagamento dei form | **D14** |

Fino alla risposta, i confronti relativi si eseguono e si **registrano** come
osservazioni, senza produrre un esito di superamento o fallimento.

## 9. Corrispondenza con le 15 condizioni del gate

| Condizione | Dove si soddisfa | Stato |
|---|---|---|
| 1 — audit in sola lettura | Fase 1A, approvata | ✅ |
| 2 — inventario completo | Fase 1A, più `1B-W0` | ✅ |
| 3 — copertura dei casi limite | 1D-22…1D-27 | da fare |
| 4 — importer idempotente | 1D-1…1D-6 | da fare |
| 5 — import completo | 1D-7…1D-21 | da fare |
| 6 — frontend fedele | 1E-1…1E-12, più §6 | da fare |
| 7 — CMS realmente usabile | 1D-28…1D-37, collaudo 1G | da fare |
| 8 — matrice URL | Fase 1A, `url-matrix.csv`, più i 6 slug storici di `1B-W3` §3.3 | ✅ |
| 9 — screenshot e visual regression | 1E-2…1E-4 | da fare |
| 10 — difformità approvate | 1E-11 | da fare |
| 11 — redirect, sitemap, robots, canonical, Open Graph, 404, form | 1E-8, 1E-9 | da fare |
| 12 — build, test, lint, tipi verdi | 1C-10 | da fare |
| 13 — UAT firmata | Fase 1E, `visual-parity-report.md` | da fare |
| 14 — piano di produzione approvato | Fase 1F | da fare |
| 15 — rilascio e rientro verificati | 1F-1…1F-12 | da fare |

**Il gate resta NON SUPERATO.** Due condizioni su quindici sono soddisfatte, ed
entrambe riguardano la conoscenza della sorgente, non il prodotto.
