# DECISIONI — Fase 1G · Collaudo redazionale del CMS

Esito della sessione di decisioni del 2026-10-19, condotta sulla pagina di grill dopo la
chiusura della Fase 1E (DR-211). Le risposte dell'utente sono registrate in
`docs/decisions/decision-register.md`, round 65, **DR-213…DR-221** (D110–D118). Questo
documento è la base di `CONTEXT.md` e `PLAN.md` della fase, che non sono ancora scritti.
Schema del flusso: [`DECISIONI-1G-visual.html`](DECISIONI-1G-visual.html).

In sintesi: la 1G **prima colma le lacune** dell'area amministrativa che impediscono i
compiti del collaudo, **poi** l'utente esegue i compiti come redattore su un database di
collaudo separato, **poi** si correggono i difetti e si ricollauda. Si costruisce anche una
gestione minima degli account, con due ruoli e revisione di sicurezza. Restano
dichiaratamente non modificabili in Fase 1 revisioni, programmazione, contenuti privati,
form e compilazioni, widget della barra laterale.

---

## 1. Termini

| Termine | Definizione | Da non usare |
|---|---|---|
| collaudo redazionale | Esecuzione dei compiti 1G-1…1G-10 e dei criteri 1D-28…1D-37 dall'interfaccia, da una persona, con esito registrato | «test del CMS», «prova automatica» |
| lacuna | Funzione che un criterio della 1G richiede e che l'interfaccia oggi non offre (può esistere nell'API) | «bug», «difetto» |
| difetto | Funzione presente nell'interfaccia che durante il collaudo non si comporta come atteso | «lacuna» |
| senza assistenza | Il redattore porta a termine il compito senza che l'agente intervenga, suggerisca o corregga via SQL o API | «autonomamente» |

## 2. Perché

La condizione 7 del gate chiede un CMS che consenta **davvero** di modificare contenuti,
media, menu, SEO, redirect e impostazioni. `acceptance-criteria.md` §5 traduce la
condizione in dieci compiti eseguiti da una persona senza assistenza: se anche uno
richiede l'intervento dell'agente, la condizione non è soddisfatta. L'inventario del codice
(§5 di questo documento) mostra che alcuni compiti oggi sono impossibili o parziali: la
fase deve quindi costruire prima di collaudare.

## 3. Decisioni bloccate (difficili da invertire)

### D110 — Perimetro: colmare le lacune, poi collaudare (DR-213)

**Scelta B.** Prima si colmano le lacune necessarie ai criteri 1G e 1D-28…1D-37 (elenco in
D113, D114, D115, D116), poi collaudo con l'utente, poi correzione dei difetti e
ricollaudo.

- Scartata **A** (solo collaudo): portava a un esito negativo già noto (1G-9 impossibile) e
  a una fase in più.
- Scartata **C** (tutte le lacune, comprese revisioni, programmazione, form, documenti,
  caroselli): allargava la fase verso funzioni che la sorgente non usava o che appartengono
  al gestionale, contro il divieto di pianificarlo prima del gate.

### D111 — Chi esegue i compiti: l'utente come redattore (DR-214)

**Scelta A.** L'utente, nel ruolo di redattore, con **un handoff per compito**; l'agente
prepara l'ambiente, osserva l'esito sul sito e registra.

- Scartata **B** (una persona del Centro): prova più forte, ma dipende da disponibilità
  esterne e richiede un account per una persona reale.
- Scartata **C** (l'agente con Playwright): vietata dal criterio stesso. Le prove
  automatiche restano come rete di sicurezza, non come esito.

### D112 — Database di collaudo separato (DR-215)

**Scelta A.** Database separato ripristinato da una copia del database di sviluppo, con
**le compilazioni dei form svuotate nella copia**, e API e sito dedicati.

- Scartata **B** (database di sviluppo con copia e ripristino): ogni ripristino tocca la
  base della parità approvata con DR-210.
- Scartata **C** (database sintetico degli e2e): non contiene pagine Gutenberg, Divi
  convertite e blocchi di riserva reali, necessari a 1G-2, 1G-3, 1G-4.

Il ripristino e lo svuotamento sono scritture su un database: si eseguono solo su conferma
puntuale, con handoff.

### D115 — Che cosa resta non modificabile in Fase 1 (DR-218)

**Scelta B.** Rinviati a dopo il gate e dichiarati nel rapporto di collaudo come
**volutamente non modificabili**:

- revisioni e ripristino;
- programmazione della pubblicazione;
- contenuti privati o protetti da password;
- configurazione dei form e lettura delle compilazioni;
- widget della barra laterale;
- ruoli oltre i due di D117.

Diventano **modificabili nella 1G** i 4 documenti scaricabili pubblici e i caroselli
(sostituire file, titolo, ordine delle immagini).

- Scartata **A** (tutto rinviato): documenti e caroselli sono contenuto pubblico che il
  Centro aggiorna; bloccati, richiederebbero l'agente dopo il rilascio.
- Scartata **C** (anche revisioni): allargava la fase con una funzione che la sorgente non
  offriva in modo usato.

L'utente ha chiesto l'elenco delle voci che danno 404 prima di decidere se nasconderle o
risolverle: sono due (§6), e la loro sorte è decisa in D113-A e D116.

### D116 — «Persone e permessi»: schermata minima (DR-219)

**Scelta B**, contro la raccomandazione A. Si costruisce una schermata minima: elenco degli
account, crea, disattiva, reimposta password. È sottoposta a **revisione di sicurezza**
prima del collaudo.

- Scartata **A** (nasconderla fino a dopo il gate, account da comando): era la
  raccomandazione; l'utente ha preferito che l'area amministrativa sia autosufficiente.
- Scartata **C** (sola lettura): non risolveva il bisogno reale, creare un account.

Conseguenza: la superficie d'attacco cresce (creazione di account, reimpostazione delle
password). ADR-007 prevedeva l'accesso minimo; la deroga si dichiara nel `CONTEXT.md` e,
se l'utente lo ritiene, con un aggiornamento della ADR.

### D117 — Due ruoli, gestione degli account solo all'amministrazione (DR-220)

**Scelta B.** Due ruoli:

| Ruolo | Può | Non può |
|---|---|---|
| `redazione` | contenuti, media, menu, SEO, redirect, documenti, caroselli | impostazioni del sito, persone e permessi, registro |
| `amministrazione` | impostazioni del sito, persone e permessi (nuovo permesso `users.manage`), registro delle operazioni | — |

Una persona con entrambi i ruoli usa il commutatore già esistente (DR-050, DR-067). Il
collaudo prova il **caso negativo**: la redazione non entra in «Persone e permessi», né dal
menu, né scrivendo l'indirizzo, né chiamando l'API.

- Scartata **A** (un solo ruolo con tutti i permessi): ogni redattore potrebbe creare
  account.
- Scartata **C** (tre ruoli con approvazione): flusso che la sorgente non aveva e che il
  Centro non ha chiesto.

## 4. Scelte di routine

- **D113 — Lacune per i compiti 1G (DR-216): A, B, C, D.**
  - A: schermata «Registro delle operazioni», filtrabile per contenuto, e «ultima modifica
    di X il Y» nell'editor (1G-9).
  - B: anteprima della bozza sul sito pubblico, con indirizzo riservato e `noindex`,
    identica alla resa pubblicata (1G-10).
  - C: rigenerazione delle dimensioni derivate quando si sostituisce un media (1G-5).
  - D: slug e genitore modificabili nell'editor, con redirect automatico dal vecchio
    indirizzo e ricalcolo dei percorsi delle pagine figlie; da provare contro i 181
    redirect esistenti.
- **D114 — Altre lacune (DR-217): A, B, C, D.**
  - A: estratto e immagine in evidenza nell'editor.
  - B: assegnare e togliere categorie a una notizia (API e interfaccia); creare e
    rinominare categorie.
  - C: eliminare un contenuto dall'interfaccia, con conferma e rifiuto spiegato se ha
    pagine figlie.
  - D: elenco dei tipi di file ammessi per i media; messaggi in italiano per tipo rifiutato
    e file troppo grande.
- **D118 — «Entro un tempo ragionevole» (DR-221): C.** Per ogni compito si registra il
  tempo; non è vincolante. Oltre 10 minuti il compito apre un **difetto di usabilità** da
  esaminare, non un fallimento. L'esito resta: riuscito senza assistenza sì o no.

## 5. Fatti verificati nel codice (2026-10-19)

Inventario dell'area amministrativa (`apps/admin`) e dell'API (`apps/api`), prima delle
decisioni.

| Area | Presente nell'interfaccia | Solo API o assente |
|---|---|---|
| Contenuti | crea (titolo e slug), titolo, blocchi, layout, bozza/pubblica/ritira, copia di lavoro, anteprima nell'editor | slug dopo la creazione, estratto, immagine in evidenza, genitore, elimina: solo API. Programmazione, anteprima sul sito: assenti |
| Gerarchia | — | cambiare genitore non ricalcola i percorsi delle figlie né crea redirect |
| Categorie | lette nel menu | CRUD dei termini solo API; assegnazione a un contenuto assente anche nell'API |
| Blocchi | aggiungi (testo, separatore, html, media e testo, elenco articoli), su/giù, trascinamento e tastiera, elimina; avviso del blocco di riserva «Blocco non convertito» | immagine, video, mappa, modulo, documento, presentazione non creabili (modificabili se già presenti) |
| Media | carica, sostituisci (stesso indirizzo; tipo diverso rifiutato), elimina (rifiutato se citato), titolo, alt, didascalia, descrizione | dimensioni derivate non rigenerate; nessun elenco di tipi ammessi; limite 64 MB con errore generico |
| Menu | aggiungi, riordina, annida, rinomina, visibilità, rimuovi | creare un menu nuovo: assente |
| SEO | title, description, canonical, noindex, nofollow, OG; template globali | `schemaType` solo API |
| Redirect | crea, modifica, attiva/disattiva | elimina solo API, per scelta |
| Impostazioni | valore di ogni chiave esistente non segreta | creare chiavi: assente |
| Registro | — | scritto, mai letto; nessuna rotta né schermata |
| Revisioni, privati | — | tabella delle revisioni mai usata; nessuna colonna di visibilità o password |
| Account e ruoli | commutatore di ruolo | nessuna rotta per gli utenti; account solo da comando su database locale; permessi: 5 |
| Form, documenti, caroselli | — | solo import e invio pubblico; nessuna gestione |
| E2E dell'area amministrativa | 24 test in `tests/e2e/cms/` | non coperti: trascinamento dei blocchi da tastiera, blocco html, eliminazione dei contenuti |

Testi scritti nel codice del sito pubblico: etichette del tema (ricerca, paginazione, 404,
«Nessun risultato»), riprese dalla sorgente; recapiti, orari, logo e piè di pagina vengono
dalle impostazioni. La barra laterale è sempre vuota (widget fuori perimetro per D115).

## 6. Le voci dell'area amministrativa che danno 404

Da `apps/admin/src/lib/areas.ts`, area Impostazioni:

| Voce | Indirizzo | Sorte |
|---|---|---|
| Registro delle operazioni | `/impostazioni/registro` | costruita con D113-A |
| Persone e permessi | `/impostazioni/persone` | costruita con D116-B |

Tutte le voci dell'area Redazione hanno la loro pagina.

## 7. Rischi

| Rischio | Mitigazione |
|---|---|
| D113-D (slug e genitore con redirect automatico) tocca routing e redirect: può rompere indirizzi indicizzati o creare catene | prove automatiche sui 181 redirect e sui 293 indirizzi della matrice prima e dopo; nessuna catena, nessun ciclo |
| D116 aggiunge creazione di account e reimpostazione delle password | revisione di sicurezza dedicata, prova negativa per ruolo via interfaccia, URL e API; nessuna password nei log |
| Le modifiche di codice possono degradare la parità approvata (DR-210) | prove di andata e ritorno e 1E-19 rieseguite; confronto visivo a campione prima del collaudo |
| Il collaudo usa contenuti reali del sito pubblico | database separato (D112); compilazioni svuotate; nessun contenuto di prova lasciato al termine |
| Dimensioni derivate rigenerate per tutti i media esistenti cambierebbero la resa | rigenerare solo alla sostituzione, non in blocco |
| Memoria della macchina (interruzioni già viste in 1E-W7) | wave piccole, ripartibili da `PROGRESS.md` |

## 8. Rinviato

Nessuna domanda rinviata. Fuori perimetro per decisione (D115): revisioni, programmazione,
contenuti privati, form e compilazioni, widget, ruoli ulteriori. Si riaprono dopo il gate,
o prima con una nuova decisione dell'utente. HO-017 (distruzione dell'istanza di
riferimento) è rinviato a dopo la 1G (DR-212).

## 9. Punti da chiarire nella stesura del piano

- Se la deroga di D116 ad ADR-007 richiede un aggiornamento della ADR o basta la
  dichiarazione nel `CONTEXT.md` (da proporre all'utente).
- Porte e avvio del sito e dell'API di collaudo, e collegamento dell'area amministrativa
  all'API di collaudo: da verificare nella configurazione prima di scrivere l'handoff.
- HO-006 (prova a mano delle schermate della 1D-W9) è ancora aperto: proporre di assorbirlo
  nel collaudo.
