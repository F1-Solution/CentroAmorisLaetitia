# HO-004 — Scegliere il design dell'area amministrativa

| | |
|---|---|
| **Fase** | 1B, wave `1B-W7` |
| **Origine** | DR-019 (4 proposte di UI e 4 di UX), DR-028 (perimetro completo), DR-018 (non deve assomigliare a WordPress) |
| **Cosa ti chiedo** | di leggere due documenti e rispondere a **cinque domande**. Nient'altro: nessun comando da eseguire |
| **Tempo stimato** | 40–60 minuti di lettura, più il tempo per decidere |
| **Blocca** | la progettazione dell'interfaccia del CMS in Fase 1D |

---

---

> **Aggiornamento del 2026-09-14.** Hai chiesto di poter scegliere guardando, non
> leggendo. Le otto proposte sono ora rese a schermo in
> [`../design/chooser/index.html`](../design/chooser/index.html): palette vere,
> caratteri veri, densità vere, con interruttore chiaro/scuro e schermo/telefono,
> la matrice di compatibilità che si accende sulla coppia scelta, e le cinque
> domande in fondo con la riga da copiare. Apri il file con un doppio clic, oppure
> usa la copia pubblicata come Artifact privato di cui ti ho dato il collegamento.
> Questa pagina **non aggiunge scelte di design**: mostra quelle dei due documenti.


## 1. Che cosa ho prodotto

Due documenti, scritti da due agenti di design distinti che hanno lavorato in
parallelo sullo stesso contesto:

| Documento | Contenuto |
|---|---|
| [`../design/ui-proposals.md`](../design/ui-proposals.md) | **4 proposte di UI**: colore, tipografia, griglia, densità, componenti, con mockup e palette complete per tema chiaro e scuro |
| [`../design/ux-proposals.md`](../design/ux-proposals.md) | **4 proposte di UX**: architettura dell'informazione, navigazione, modello dei ruoli, flussi, riservatezza |

Sono documenti separati di proposito: il colore e la struttura si scelgono con
criteri diversi, e mescolarli porta a scegliere una struttura perché il colore
piaceva.

**Nessuna delle otto proposte assomiglia a wp-admin.** Era il vincolo di DR-018 e
l'ho fatto verificare esplicitamente.

## 2. Quello che ho verificato io, prima di portartele

| Verifica | Esito |
|---|---|
| Nessun dato reale del Centro nei mockup: nomi, date, importi, contenuti sono tutti inventati | ✅ controllato |
| I rapporti di contrasto dichiarati nelle palette sono veri, non stimati | ✅ **32 coppie ricalcolate una per una**: tutte corrette |
| Nessuna delle proposte riproduce l'architettura o l'aspetto di WordPress | ✅ |
| Nessun codice, nessuno scaffold, nessuna dipendenza creata | ✅ |

Una sola correzione applicata: un rapporto di contrasto citato nel testo era
`2.3:1` mentre il valore reale è `2.75:1`. Riguardava il blu del sito pubblico e
non cambia la conclusione — resta sotto la soglia utilizzabile per il testo — ma il
numero ora è quello giusto.

## 3. Le quattro proposte di UI, in una riga ciascuna

| | Nome | Carattere | Per chi |
|---|---|---|---|
| 1 | **Scrivania** | banco di lavoro denso, due colonne di navigazione permanenti, blu istituzionale su grigi freddi | chi entra ogni giorno |
| 2 | **Accoglienza** | nessuna colonna laterale, schede grandi, percorsi a passi numerati, palette calda, testo a 17 px | chi entra poche volte l'anno |
| 3 | **Comando** | nessun menu permanente, si naviga da tastiera, quasi monocromatica e densissima | chi lavora di tastiera |
| 4 | **Quaderno** | il documento al centro su colonna di lettura, struttura ad albero a sinistra, carta avorio e carattere con grazie | carattere editoriale |

Raccomandazione dell'agente di UI: **la 1**, con tre prestiti dalle altre. Motivo
principale: è l'unica in cui un modulo nuovo si compone con pezzi già esistenti, e
i moduli nuovi in arrivo sono otto.

## 4. Le quattro proposte di UX, in una riga ciascuna

| | Nome | Principio |
|---|---|---|
| A | **La scrivania dei compiti** | la navigazione è fatta di verbi: si entra in una coda personale di cose da fare |
| B | **Le aree di responsabilità** | si sceglie in che veste si lavora, e l'applicazione si riconfigura su quell'ambiente |
| C | **Il registro degli oggetti** | tutto è un oggetto schedato: si lavora cercando e filtrando, con viste salvate |
| D | **L'anno associativo** | la navigazione è il tempo: si entra in «Oggi» e i moduli si raggiungono dal momento che li richiede |

Raccomandazione dell'agente di UX: **la B**, con due innesti dalla D. Motivo
principale: rende la riservatezza una separazione di **ambiente** e non solo di
permesso, il che conta molto in un consultorio.

## 5. Le due raccomandazioni sono compatibili?

Sì. `ux-proposals.md` §8 contiene una matrice di compatibilità fra le quattro
proposte di UX e le direzioni di UI: l'accoppiata **UI 1 + UX B** è indicata come
funzionante. Non sei però vincolato a seguire entrambe le raccomandazioni: puoi
scegliere una UI e una UX diverse, purché la matrice non le dichiari incompatibili.

## 6. Le cinque domande a cui devo rispondere

Ho unito le domande dei due documenti e ho tolto quelle che si possono decidere
dopo. Restano queste cinque. Per ciascuna, rispondere con la lettera basta.

### D-UI-1 — Quale proposta di **UI** si adotta come base?

(a) Scrivania · (b) Accoglienza · (c) Comando · (d) Quaderno · (e) nessuna,
rifare le proposte.

*Raccomandazione:* **(a)**. *Impatto:* determina il sistema di design e i
componenti di tutte le fasi successive.

### D-UX-1 — Quale proposta di **UX** si adotta come base?

(a) La scrivania dei compiti · (b) Le aree di responsabilità · (c) Il registro
degli oggetti · (d) L'anno associativo · (e) nessuna.

*Raccomandazione:* **(b)**. *Impatto:* determina la navigazione, oggi e quando ci
saranno nove moduli.

### D-UX-2 — Il Centro si organizza per aree, o «fanno tutti tutto»?

La proposta B presuppone sei aree: Redazione, Segreteria, Tesoreria, Formazione,
Consulenza, Direzione. È una descrizione realistica?

(a) sì, le persone hanno ruoli abbastanza distinti · (b) no, in pratica poche
persone fanno di tutto · (c) via di mezzo: alcune aree sono distinte, altre no.

*Impatto:* se la risposta è (b), la proposta B perde gran parte del suo vantaggio e
sale la A. **È la domanda che può ribaltare la raccomandazione**, quindi conta più
delle altre.

### D-UX-3 — Come funziona il cambio di ruolo?

Una persona può essere amministratore, tesoriere e socio insieme (RU-02).

(a) **un solo ruolo attivo per volta**, scelto esplicitamente: l'interfaccia mostra
solo ciò che quel ruolo può fare · (b) **tutti i ruoli insieme**, con l'unione dei
permessi e nessuna commutazione · (c) tutti attivi, con un filtro visivo
commutabile.

*Raccomandazione:* **(a)**, perché rende leggibile il registro delle operazioni e
riduce il rischio di operare per errore con poteri estesi su dati riservati.

*Impatto:* è **la scelta più costosa da cambiare dopo**. Tocca permessi, registro
delle operazioni e intestazione di ogni schermata. Lo schema del database è
compatibile con tutte e tre, ma l'interfaccia no.

### D-UI-2 — Si mantiene il carattere del sito pubblico anche nell'amministrazione?

(a) sì, Open Sans ovunque, per continuità · (b) no, un carattere d'interfaccia
distinto.

*Raccomandazione:* **(b)**, perché l'area amministrativa deve essere
riconoscibilmente un'altra cosa, e i caratteri d'interfaccia sono disegnati per
funzionare a dimensioni piccole. È però una scelta di identità, non tecnica: decidi
tu.

## 7. Domande che ho volutamente rimandato

Non servono adesso e ti farebbero decidere al buio. Le riporterò quando la fase che
le riguarda sarà attuale:

| Domanda | Quando la riporto |
|---|---|
| Tema scuro nel primo rilascio o solo predisposto | prima della Fase 1D |
| Quanti compiti devono funzionare da telefono | con la PWA, dopo il gate |
| Se il registro delle attività serve consultabile o solo estraibile | con la fase gestionale |
| Quante persone avranno più ruoli, e quali combinazioni | con la fase soci e ruoli |
| Chi dichiara «fatta» una scadenza e cosa succede se nessuno lo fa | con la fase corsi e contabilità |
| **Per quanto conservare le righe di registro sull'ambito riservato** | dopo la **validazione legale** (MI-06). Non è decidibile né da te né da me senza un professionista |

## 8. Se nessuna delle proposte ti convince

È una risposta legittima e va detta. In quel caso mi servono due cose: **quale ti
si avvicina di più**, e **che cosa non va**. Con quelle due informazioni un secondo
giro di proposte è rapido; senza, sarebbe un altro tiro al buio.

Puoi anche rispondere «mi piace la 1 ma con i colori della 2»: le proposte sono
combinabili e la §5 di `ui-proposals.md` elenca quali parti si prestano al prestito.

## 9. Come rispondere

Nel prompt successivo, in qualunque forma. Per esempio:

```
HO-004: D-UI-1 = a · D-UX-1 = b · D-UX-2 = c · D-UX-3 = a · D-UI-2 = b
```

Oppure a parole, se preferisci spiegare il perché — che per il registro delle
decisioni vale più della lettera, perché è il motivo che si dimentica, non la scelta.

## 10. Cosa succede dopo la tua risposta

1. Registro le cinque decisioni in `docs/decisions/decision-register.md`.
2. Le proposte scartate **restano nel repository**: sono la traccia di che cosa è
   stato considerato, e serviranno il giorno in cui qualcuno chiederà perché si è
   scelto così.
3. La UI e la UX scelte diventano un documento unico di sistema di design, prodotto
   **in Fase 1D**, quando servirà davvero.
4. **Nessuno scaffold parte comunque prima** che le ADR di `docs/decisions/adr/`
   siano approvate: è il vincolo di D5, confermato da DR-035.
