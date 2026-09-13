# Decisioni richieste (grill-me) — Round 1

> **Round 1 chiuso il 2026-09-13.** D1 e D4 risolte, D2 risolta in parte (prosegue
> come D2b), D3 riaperta per ambiguità. Il round successivo è in
> [`open-questions-round-2.md`](open-questions-round-2.md); le decisioni approvate
> sono in [`../decisions/decision-register.md`](../decisions/decision-register.md).

Aperto il 2026-09-13 al termine della Fase 0.

**Cosa è bloccato:** la chiusura della Fase 0 e l'avvio della Fase 1A (audit
WordPress read-only). Nessun file viene creato o modificato oltre ai sei documenti
di discovery finché queste decisioni non sono chiuse.

**Cosa ho già verificato da solo:** stato Git (1 solo file tracciato, nessun
sorgente applicativo), copertura di `.gitignore` su `source-private/`, inventario
completo di `source-private/planning/` (56 file) e `source-private/wordpress/`
(2.258 file, 326 MB), versione WordPress e tema, elenco plugin attivi, 53 tabelle
del dump, conteggi per tipo e stato di contenuto nell'export WXR, 320 URL distinti,
835 file in `uploads/` per anno ed estensione, presenza delle 8 skill di progetto.
Non chiedo nulla di quanto sopra.

---

## Bloccanti

### D1. Sorte della codebase .NET descritta nei documenti storici

- **Decisione da prendere:** se la soluzione .NET/Blazor descritta dai documenti
  storici debba essere recuperata come riferimento, oppure se il progetto riparte
  da zero trattandola come pura documentazione.
- **Perché è necessaria ora:** i documenti descrivono `src/`, `frontend/`, `tests/`
  e un importer WordPress già scritto, ma in questo repository non esiste alcun
  sorgente: Git traccia solo `.gitignore`. Se quel codice esiste altrove, contiene
  lavoro di analisi sul WordPress sorgente (parser, mapping, contenuti già estratti)
  che eviterebbe di rifare la Fase 1A da capo. Se non esiste più, tutti i claim di
  completamento vanno archiviati come non verificabili e la Fase 1A parte pulita.
- **Opzione A:** il codice non è disponibile o si sceglie di ignorarlo. Si riparte
  dalla sola sorgente WordPress. Tutti i report di fase storici vengono
  esplicitamente declassati a materiale non probante.
- **Opzione B:** il codice esiste e viene reso disponibile in sola lettura (es.
  `source-readonly/`). Viene usato solo come riferimento di analisi, mai portato nel
  nuovo stack.
- **Raccomandazione:** Opzione A se il recupero richiede più di mezza giornata,
  perché il valore residuo è quasi tutto già trascritto nei documenti; Opzione B se
  il repository è a portata di mano, perché i parser Divi già scritti sono il pezzo
  più costoso da rifare.
- **Impatto:**
  - tempi: A aggiunge circa 1–2 giorni alla Fase 1A per rianalizzare i contenuti
    Divi; B li risparmia in parte.
  - costi: nessuno.
  - rischi: con B il rischio è di farsi condizionare da un'architettura superata;
    va mitigato tenendo il codice in sola lettura.
  - privacy: con B, il vecchio repository potrebbe contenere dati reali o segreti:
    va ispezionato prima di collocarlo nel workspace.
  - manutenzione: nessuna in entrambi i casi.
- **Default vietato:** in assenza di risposta non dichiaro chiusa la Fase 0 e non
  assumo che il codice sia perduto.

---

### D2. Sorgente di verità per la parità pixel-perfect

- **Decisione da prendere:** quale sorgente usare come riferimento per i confronti
  visivi, e se il sito `https://www.centroamorislaetitia.it` sia ancora online e
  accessibile per acquisire screenshot.
- **Perché è necessaria ora:** la parità pixel-perfect va **provata**, non
  dichiarata. Il backup locale contiene il tema Divi e i file caricati, ma il
  rendering Divi avviene lato server e via JavaScript: senza un'istanza che renda
  le pagine non esistono screenshot sorgente contro cui fare la diff. Questa scelta
  determina l'intera Fase 1E e i criteri di accettazione del gate. In più,
  `prompt_iniziale.md` chiedeva un aspetto "simile", mentre la direttiva attuale
  impone pixel-perfect: serve sapere quale standard vale.
- **Opzione A:** il sito è online e si acquisiscono gli screenshot sorgente
  direttamente dalla produzione, con Playwright, su viewport e browser versionati.
  Richiede una sua conferma esplicita: è un accesso a un sistema esterno.
- **Opzione B:** si ricostruisce in locale un'istanza WordPress usa-e-getta dal
  dump e dal tema, in container isolato, e si acquisiscono da lì gli screenshot.
  Il container è temporaneo e non fa parte del runtime finale.
- **Opzione C:** nessuna diff automatica; la parità viene approvata solo con
  ispezione visiva manuale su un elenco concordato di pagine.
- **Raccomandazione:** Opzione B. È riproducibile, non dipende dalla disponibilità
  del sito, congela il riferimento in modo che non cambi durante lo sviluppo, e non
  viola il divieto di dipendenze WordPress a runtime perché il container è solo uno
  strumento di test. L'Opzione A resta utile come controprova su poche pagine.
- **Impatto:**
  - tempi: B costa 1–2 giorni di setup; A è immediato ma fragile; C rende la Fase
    1E più lunga e il gate meno oggettivo.
  - costi: nessuno in tutte e tre.
  - rischi: con A il sito può cambiare sotto i piedi e invalidare i confronti; con
    B l'istanza locale può rendere diversamente dalla produzione (font, cache, CDN)
    e va validata su qualche pagina campione; con C la parità resta opinabile.
  - privacy: con B il container va alimentato con il dump reale, che contiene dati
    personali: deve restare locale, mai pubblicato, mai committato, e va distrutto
    a fine fase.
  - manutenzione: B aggiunge uno strumento di test da mantenere per la durata della
    Fase 1.
- **Default vietato:** in assenza di risposta non acquisisco screenshot dal sito
  in produzione, non avvio alcun container WordPress e non definisco i criteri di
  accettazione visivi.

---

### D3. Ambito dell'importazione dei dati dalla sorgente WordPress

- **Decisione da prendere:** quali classi di contenuto vanno importate in
  PostgreSQL, e in particolare se importare dati personali reali.
- **Perché è necessaria ora:** determina lo schema del database, il perimetro
  dell'importer e gli obblighi privacy. Il dump contiene compilazioni reali di form
  (`wp_wpforms_entries`), utenti con email e hash password (`wp_users`), commenti,
  statistiche di download per utente e log di invio email. La Fase 1 riguarda il
  sito pubblico: nulla di tutto ciò serve alla parità visiva.
- **Opzione A — minimale:** si importano solo pagine, articoli, tassonomie, menu,
  metadati SEO, media e redirect. Nessun dato personale. Gli utenti del CMS si
  creano nuovi, a mano.
- **Opzione B — minimale più utenze redazionali:** come A, più i soli account con
  ruolo editoriale, importati senza password (reset obbligatorio al primo accesso).
- **Opzione C — estesa:** come B, più le compilazioni storiche dei form e le
  statistiche di download, per conservare lo storico delle iscrizioni ai corsi.
- **Raccomandazione:** Opzione A per la Fase 1. È l'unica che soddisfa la
  minimizzazione dei dati e copre integralmente ciò che serve al sito pubblico.
  L'eventuale recupero dello storico iscrizioni è una decisione della fase
  gestionale, che ha senso valutare quando esisterà il modello dati che lo accoglie.
- **Impatto:**
  - tempi: A è la più rapida; C aggiunge diversi giorni di mapping e bonifica.
  - costi: nessuno.
  - rischi: C importa dati personali in un sistema nuovo prima che esistano ruoli,
    audit log e policy di conservazione — cioè prima che ci siano i controlli che
    li proteggono.
  - privacy: A non tratta dati personali; B ne tratta una quantità minima e
    circoscritta; C richiede base giuridica, informativa e tempi di conservazione
    definiti, con verifica legale.
  - manutenzione: C lascia nel database dati di cui nessuna funzione ha bisogno.
- **Default vietato:** in assenza di risposta non importo alcun dato personale e
  non progetto tabelle destinate a contenerne.

---

### D4. Creazione dei file di governo del progetto nella radice

- **Decisione da prendere:** se posso creare `ROADMAP.md`, `CLAUDE.md` e
  `PROGRESS.md` nella radice del repository.
- **Perché è necessaria ora:** sia le regole di progetto sia la skill
  `superpowers-phase-planning` li richiedono esistenti e non vuoti **prima** di
  scrivere qualunque piano di fase. Nessuno dei tre esiste: gli omonimi stanno in
  `source-private/planning/`, sono scritti per lo stack .NET e quella cartella è
  in sola lettura. La Fase 0 mi autorizza a creare solo i sei documenti di
  discovery, quindi non posso crearli senza il suo assenso.
- **Opzione A:** li creo io come derivazione dei documenti di Fase 0 — `ROADMAP.md`
  dalla sequenza di fasi, `CLAUDE.md` dalle regole già vincolanti, `PROGRESS.md`
  vuoto con la sola intestazione — e lei li rivede prima che vengano usati.
- **Opzione B:** li scrive lei, e io resto fermo fino ad allora.
- **Raccomandazione:** Opzione A. Il contenuto è interamente derivabile da
  decisioni che lei ha già preso, e la revisione le costa pochi minuti contro le
  ore che costerebbe scriverli da zero.
- **Impatto:**
  - tempi: A sblocca subito la Fase 1A; B introduce un'attesa.
  - costi: nessuno.
  - rischi: con A il rischio è che io formalizzi come regola qualcosa che lei non
    intendeva; mitigato dalla sua revisione prima dell'uso.
  - privacy: nessuno — nessuno dei tre file contiene dati.
  - manutenzione: `PROGRESS.md` va aggiornato dopo ogni wave, in entrambi i casi.
- **Default vietato:** in assenza di risposta non creo nessuno dei tre file e non
  avvio la Fase 1A, perché i suoi prerequisiti non sarebbero soddisfatti.

---

## Differibili

### D5. ADR su framework API, ORM e reverse proxy

- **Termine:** entro la fine della Fase 1B, prima di qualunque scaffold.
- **Decisione da prendere:** Fastify o NestJS; Prisma o Drizzle; Caddy o Nginx.
- **Perché non è bloccante ora:** la Fase 1A è di solo audit e non tocca il codice.
- **Opzione A:** Fastify + Prisma + Caddy.
- **Opzione B:** NestJS + Drizzle + Nginx.
- **Opzione C:** combinazioni miste.
- **Raccomandazione:** la porto come tre ADR argomentate in Fase 1B, non come una
  scelta secca ora: ciascuna dipende da come sarà modellato il CMS, che in Fase 1A
  non è ancora noto.
- **Impatto:**
  - tempi: nessuno se decisa entro la 1B; rifare la scelta dopo lo scaffold costa
    giorni.
  - costi: nessuno — tutte le opzioni sono gratuite e self-hosted.
  - rischi: decidere ora, senza il modello dati, significa decidere alla cieca.
  - privacy: nessuno.
  - manutenzione: NestJS è più strutturato ma più verboso per un team di una
    persona; Prisma ha migrazioni più mature, Drizzle è più leggero.
- **Default vietato:** non scaffoldo nulla e non installo dipendenze prima che le
  tre ADR siano approvate.

---

### D6. Target di hosting e provider

- **Termine:** entro l'inizio della Fase 1F, prima di qualunque acquisto o modifica DNS.
- **Decisione da prendere:** quale VPS, quale registrar per il dominio, se e come
  usare Cloudflare, e chi sostiene i costi.
- **Perché non è bloccante ora:** le Fasi 1A–1E sono interamente locali.
- **Opzione A:** VPS Linux con Docker Compose e Cloudflare davanti, come indicato
  nella direttiva.
- **Opzione B:** mantenere l'hosting attuale del sito WordPress, se supporta Docker.
- **Raccomandazione:** presento in Fase 1F un confronto con costi reali aggiornati,
  invece di decidere ora su prezzi che a quel punto saranno vecchi di mesi.
- **Impatto:**
  - tempi: nessuno se decisa entro la 1F.
  - costi: è l'unica voce del progetto con un costo ricorrente reale.
  - rischi: decidere ora su listini che cambiano.
  - privacy: la collocazione geografica dei dati va verificata rispetto al GDPR.
  - manutenzione: un VPS autogestito comporta aggiornamenti e backup a suo carico.
- **Default vietato:** non acquisto nulla, non modifico DNS, non eseguo deploy.

---

### D7. Lingua dei nomi di tabelle e colonne

- **Termine:** entro la fine della Fase 1B, prima della prima migrazione.
- **Decisione da prendere:** se conservare la convenzione storica di nomi in
  italiano snake_case anche con un ORM TypeScript.
- **Perché non è bloccante ora:** non esiste ancora alcuno schema.
- **Opzione A:** tabelle e colonne in italiano snake_case, modelli TypeScript in
  inglese, con mappatura esplicita nell'ORM.
- **Opzione B:** tutto in inglese snake_case, allineato ai nomi dei modelli.
- **Raccomandazione:** Opzione B per il nuovo schema. La motivazione originale era
  la leggibilità per il manutentore, ma con Prisma o Drizzle il doppio nome va
  mantenuto a mano su ogni campo e diventa una fonte di errori; i commenti e la
  documentazione restano comunque in italiano come da DR-H04.
- **Impatto:**
  - tempi: A aggiunge attrito costante su ogni modello.
  - costi: nessuno.
  - rischi: A aumenta il rischio di disallineamento fra modello e schema.
  - privacy: nessuno.
  - manutenzione: B è più semplice; A resta più leggibile leggendo il DB a mano.
- **Default vietato:** non definisco alcuno schema prima di questa decisione.

---

### D8. WhatsApp nelle comunicazioni

- **Termine:** entro la pianificazione della fase Comunicazioni, dopo il gate.
- **Decisione da prendere:** se riaprire l'esclusione di WhatsApp decisa in DR-H06.
- **Perché non è bloccante ora:** è interamente fuori dal gate di Fase 1.
- **Opzione A:** confermare l'esclusione; email, SMS e push coprono i casi d'uso.
- **Opzione B:** includerlo, con approvazione Meta, numero dedicato e costi variabili.
- **Raccomandazione:** riportare la decisione a quando esisteranno i volumi reali di
  utenza, che oggi non sono noti.
- **Impatto:**
  - tempi: nessuno ora.
  - costi: l'Opzione B introduce un costo per messaggio e un onere di approvazione.
  - rischi: l'Opzione B introduce una dipendenza da policy Meta che possono cambiare.
  - privacy: WhatsApp richiede un consenso specifico e distinto.
  - manutenzione: l'Opzione B aggiunge un canale da presidiare.
- **Default vietato:** non implemento alcun canale WhatsApp.

---

### D9. Percorso del registro delle decisioni

- **Termine:** entro la prima registrazione di una decisione approvata.
- **Decisione da prendere:** se il registro resti in `docs/discovery/` o si sposti
  in `docs/decisions/` come previsto dalla skill `grill-me`.
- **Perché non è bloccante ora:** oggi esiste un solo file e nessuna decisione
  approvata è ancora stata registrata.
- **Opzione A:** lasciarlo in `docs/discovery/decision-register.md`, come indicato
  dalla Fase 0.
- **Opzione B:** spostarlo in `docs/decisions/decision-register.md` e lasciare in
  discovery un rimando.
- **Raccomandazione:** Opzione B, perché il registro non è un artefatto di
  discovery: vive per tutto il progetto e la skill lo cerca lì.
- **Impatto:**
  - tempi: pochi minuti.
  - costi: nessuno.
  - rischi: lasciare i due percorsi disallineati porta a due registri divergenti.
  - privacy: nessuno.
  - manutenzione: un solo percorso è più semplice.
- **Default vietato:** non sposto il file senza la sua conferma.

---

## Impatto se si rimanda

- **D1:** la Fase 1A parte assumendo che nulla sia riutilizzabile; se il codice
  esiste, rifaccio da capo analisi già fatte.
- **D2:** la Fase 1E non ha criteri di accettazione oggettivi, quindi il gate di
  Fase 1 non è superabile. È il rimando più costoso di tutti.
- **D3:** lo schema PostgreSQL non è progettabile e la Fase 1B resta ferma.
- **D4:** la Fase 1A non parte: i suoi prerequisiti non sono soddisfatti.
- **D5:** nessun impatto fino alla 1B; deciderla dopo lo scaffold costa giorni.
- **D6:** nessun impatto fino alla 1F.
- **D7:** nessun impatto fino alla prima migrazione; cambiarla dopo comporta una
  migrazione di rinomina su tutto lo schema.
- **D8:** nessuno prima del gate.
- **D9:** rischio di due registri divergenti alla prima decisione approvata.
