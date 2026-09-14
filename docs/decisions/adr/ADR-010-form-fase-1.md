# ADR-010 — Funzionamento dei form in Fase 1

| | |
|---|---|
| **Stato** | **proposta, con un conflitto da risolvere** — vedi §6 |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | come si comportano i form del sito pubblico nel primo rilascio |
| **Origine** | DR-032 (form minimale che recapita per email); R-11; MI-01 |

---

## 1. Contesto

L'utente ha deciso (DR-032): **form minimale che recapita per email**, da sostituire
nella fase gestionale con form generati dinamicamente dal backend.

La wave `1B-W0` ha misurato com'è fatto davvero ciò che va sostituito, e il quadro è
più impegnativo di quanto MI-01 lasciasse intendere.

### 1.1 Quanti sono e dove stanno

| Dato | Valore |
|---|---|
| Form pubblicati | **25** (più 3 nel cestino, che decadono) |
| Incorporati in pagine come blocco `wpforms/form-selector` | **23** |
| Compilazioni storiche | 425, su 24 form |
| Campi per form | da 3 a 22, in media **12** |
| Campi obbligatori in totale | 130 |
| Notifiche email configurate | **39** su 25 form |
| Conferma dopo l'invio | messaggio nella pagina, mai un redirect, su tutti e 25 |

Ventiquattro form sono iscrizioni a corsi o seminari; uno è l'adesione
all'associazione.

### 1.2 Tipi di campo usati

| Tipo | Occorrenze |
|---|---|
| `html` (testo fisso dentro il form) | 45 |
| `text` | 40 |
| `name` (composito) | 33 |
| `date-time` | 32 |
| `email` | 31 |
| `phone` | 30 |
| `radio` | 30 |
| `address` (composito) | 29 |
| **`payment-single`** | **27** |
| `checkbox` | 5 |
| `number` | 1 |

Le etichette ricorrenti sono nome, luogo e data di nascita, indirizzo, telefono,
email — e, sui percorsi di coppia, la stessa serie ripetuta per due persone.

### 1.3 Il fatto che cambia la natura del problema

**Tutti e 25 i form hanno i pagamenti attivi.** Il campo `payment-single` compare
27 volte con importi reali — da 35 a 240 euro — e il provider PayPal Standard
risulta **abilitato su tutti e 25** (`enable = 1`).

Non sono quindi form di contatto: sono **moduli di iscrizione con pagamento**.

Questo non era noto quando MI-01 è stata posta, e non era noto quando DR-032 è stata
decisa. Va portato all'utente prima di attuarla, perché DR-032 così com'è non copre
il caso.

## 2. Opzioni — cosa è possibile fare in Fase 1 senza violare il gate

I pagamenti sono requisiti **RG-01…RG-04**, esplicitamente fuori perimetro fino al
superamento del gate. Non si costruiscono in Fase 1, e non è in discussione.

Ne segue che «form minimale che recapita per email» può riprodurre **la raccolta
dei dati**, ma non il pagamento. Le strade praticabili sono tre, e la scelta è
dell'utente.

| Strada | Cosa vede la persona | Costo | Rischio |
|---|---|---|---|
| **1 — Raccolta senza pagamento** | Il form identico, senza la parte di pagamento. All'invio: «la richiesta è arrivata, sarai ricontattato per il pagamento» | basso | la segreteria gestisce a mano l'incasso di ogni iscrizione |
| **2 — Raccolta più rimando a PayPal esistente** | Il form identico; dopo l'invio, un collegamento al pagamento PayPal del Centro con l'importo indicato | medio | nessuna riconciliazione automatica fra iscrizione e pagamento: va fatta a mano |
| **3 — Parità piena del pagamento** | Come oggi | **alto** | costruisce una funzione della fase gestionale prima del gate. **Contrario a DR-009 e al gate** |

La strada 3 non è raccomandata e non è, a rigore, ammissibile senza una deroga
esplicita al gate.

## 3. Scelta proposta e alternativa scartata

**La strada 3 — parità piena del pagamento — è scartata**, e lo è per una ragione di
governo del progetto, non di difficoltà tecnica: costruirebbe in Fase 1 una funzione
esplicitamente collocata dopo il gate (RG-01…RG-04). Il gate di DR-009 vieta di
**pianificare**, non solo di realizzare, le funzioni gestionali: farle rientrare
dalla finestra dei form sarebbe un aggiramento, non una soluzione.

**Fra la strada 1 e la strada 2 non scelgo io.** Non è una scelta tecnica: cambia che
cosa accade a una persona che si iscrive a un corso e si aspetta di pagare. È la
decisione **D14**, §6.

Tutto ciò che segue è **comune alle strade 1 e 2** e si può progettare e importare
adesso, senza pregiudicare la risposta.

## 4. Proposta tecnica, valida per le strade 1 e 2

### 4.1 I form sono **dati**, non codice

Le 25 definizioni si importano in una tabella `forms`, con campi, etichette,
obbligatorietà, ordine e testi di conferma. Il sito rende il form **leggendo la
definizione**, non da un componente scritto a mano per ciascuno.

Questo per tre ragioni concrete: 25 componenti scritti a mano sarebbero 25 punti di
difformità; il form builder della fase gestionale scriverà **nella stessa tabella**,
quindi la sostituzione annunciata da DR-032 non sarà una riscrittura; e un form
sbagliato si corregge modificando un dato, non rilasciando codice.

### 4.2 Tipi di campo da rendere in Fase 1

`text`, `name`, `email`, `phone`, `date-time`, `address`, `radio`, `checkbox`,
`number`, `html`. Cioè tutti quelli misurati, **tranne** `payment-single`, il cui
trattamento dipende dalla strada scelta al §2.

### 4.3 Invio

Un solo endpoint dell'API, `POST /forms/{slug}/submissions`:

1. Convalida con Zod **generato dalla definizione del form**, non scritto a mano.
2. Scrive la compilazione nella tabella `form_submissions`, **prima** di tentare
   l'invio dell'email. Se l'email fallisce, la richiesta non è persa: è il punto che
   R-11 segnalava come il danno peggiore.
3. Invia le notifiche configurate, riproducendo oggetto e mittente della sorgente.
4. Risponde con il messaggio di conferma della definizione, reso nella pagina senza
   cambiare indirizzo, come fa oggi.

### 4.4 Protezione dagli invii automatici

Campo esca invisibile, marca temporale minima, limitazione per indirizzo IP e per
form. **Nessun captcha di terze parti**: introdurrebbe una dipendenza esterna che
osserva i visitatori, su un sito di un consultorio familiare, e cambierebbe anche
l'aspetto della pagina — quindi la parità.

### 4.5 Recapito delle email

L'invio richiede un mittente configurato. `CLAUDE.md` colloca la configurazione e
l'invio di email fra le azioni a **conferma obbligatoria**: si predispone in Fase
1D, si prova con destinatari interni in Fase 1F, si attiva verso destinatari reali
solo dopo conferma puntuale dell'utente.

Fino a quell'attivazione il form **scrive** ma non **invia**, e l'area
amministrativa mostra le compilazioni ricevute. Meglio una richiesta visibile solo
nel pannello che una richiesta persa.

### 4.6 Le 425 compilazioni storiche

Si importano per DR-026, in `form_submissions`, marcate come provenienti dalla
migrazione. Sono dati personali: valgono per intero il rischio R-04 e l'input
mancante MI-06, cioè verifica legale prima della produzione. **Non compaiono in
alcun documento, log, screenshot o fixture.**

In Fase 1 sono consultabili solo da chi ha il permesso `submissions.read`, che nel
primo rilascio ha il solo amministratore.

## 5. Cosa si rimanda esplicitamente

Costruzione dei form da interfaccia (RF-03…RF-06); pagamenti (RG-01…RG-04);
integrazione Mailchimp (RM-01, RM-02); esportazione strutturata delle risposte
(RF-06); collegamento fra form e corso (RF-01). Tutto dopo il gate.

## 6. Conflitto da risolvere prima di attuare questa ADR

> DR-032 dice «form minimale che recapita per email». La misura della sorgente dice
> che tutti e 25 i form incassano pagamenti.
>
> **Le due cose non coincidono, e la differenza non è tecnica: cambia ciò che
> succede a chi si iscrive a un corso.**

Va portata all'utente come decisione **D14**, con le tre strade del §2. Fino alla
risposta:

- si progetta e si importa tutto ciò che è comune alle strade 1 e 2 — definizioni,
  compilazioni, resa dei campi, endpoint di invio;
- **non** si costruisce alcun trattamento del campo `payment-single`;
- **non** si pubblica alcun form che appaia funzionante senza esserlo.

## 7. Conseguenze

**Più facile:** la sostituzione promessa da DR-032 sarà un'aggiunta al form builder,
non una riscrittura, perché i form sono già dati.

**Più difficile:** i form vanno resi **esattamente** come oggi. Ventitré pagine ne
contengono uno, e sono pagine di alta priorità nella matrice di parità.

## 8. Reversibilità

**Alta.** I form sono dati; la loro resa è un componente; l'endpoint di invio è uno.
Sostituire qualunque pezzo non tocca né lo schema né i contenuti.

## 9. Verifica

**Fase 1D:** le 25 definizioni sono importate e producono form validi; le 425
compilazioni sono importate e conteggiate; nessuna di esse compare fuori dal
database.

**Fase 1E:** le 23 pagine con form superano il confronto visivo.

**Fase 1F:** l'invio email è provato verso destinatari interni; l'attivazione verso
destinatari reali ha una conferma puntuale registrata; il campo esca e la
limitazione dei tentativi funzionano.
