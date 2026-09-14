# Rischi di migrazione — Fase 1A, wave 1A-W5

Aggiornato il 2026-09-13 sui dati reali della sorgente. Sostituisce le valutazioni
di Fase 0, che erano basate sui documenti storici.

Scala: probabilità e impatto in bassa / media / alta.

---

## 1. Variazioni rispetto alla valutazione di Fase 0

| # | Rischio di Fase 0 | Stato oggi |
|---|---|---|
| R-01 | Markup Divi non semantico, fedeltà difficile | **ridotto** da alto a medio |
| R-02 | Media post-2021 assenti | **chiuso** |
| R-03 | Nessun riferimento per gli screenshot | **chiuso** |
| R-04 | Dati personali nel dump | **ridimensionato ma aperto**, e ora accettato per decisione |
| R-05 | Conteggi errati nei documenti storici | **confermato**, 11 correzioni |
| R-06 | Tensione fedeltà visiva ↔ editabilità CMS | **aperto**, resta il rischio principale |
| R-07 | Interruzioni con team di una persona | aperto, mitigato dal protocollo |
| R-08 | Backup annidati in `uploads/` | **chiuso** |

---

## 2. Rischi attivi

### R-06 — Fedeltà visiva contro editabilità del CMS
**Probabilità alta · Impatto alto · È il rischio principale della Fase 1**

L'HTML fedele al sito attuale è quasi ingestibile da un redattore; i blocchi React
sono editabili ma possono divergere dal pixel. Le due condizioni del gate — parità
provata (punto 6) e CMS realmente usabile (punto 7) — tirano in direzioni opposte.

*Mitigazione:* strategia di conversione progressiva definita in 1B-W5 — HTML
sanitizzato dove serve la fedeltà, blocchi strutturati dove serve l'editabilità,
scelta dichiarata **per tipo di contenuto** e non improvvisata per pagina. I 5
shortcode strutturali coprono il 97% delle occorrenze e si mappano bene su blocchi.
La Fase 1G collauda l'editabilità reale, non presunta.

*Rientro:* se su una pagina le due cose non convivono, la decisione è dell'utente,
non dell'agente, e va registrata come difformità approvata.

### R-01 — Rendering Divi
**Probabilità media · Impatto medio** *(era alta/alto)*

Solo 10 shortcode distinti; 60 contenuti su 107 non usano affatto il page builder.
Resta la coda difficile: `et_pb_video` (7), `et_pb_map` e `et_pb_map_pin` (2+2),
`et_pb_contact_form` e `et_pb_contact_field` (1+4).

Divi genera inoltre CSS dinamico per pagina in `wp-content/et-cache/`: due
installazioni possono produrre CSS diverso a parità di contenuto.

*Mitigazione:* affrontare per prime le 29 pagine e i 18 articoli con Divi; congelare
l'istanza di riferimento con la sua `et-cache` così com'è, senza rigenerarla.

### R-04 — Dati personali importati senza bonifica
**Probabilità certa · Impatto alto**

Per decisione esplicita dell'utente (DR-025, opzione C) si importa tutto: **425
compilazioni di form** con 3.710 valori di campo, 187 log di invio email con
destinatari, 1 account amministratore.

Sono dati di persone che hanno richiesto consulenze familiari o si sono iscritte a
corsi: rientrano nella categoria che `prompt_iniziale.md` equipara alla privacy
medica (RN-02). Finiranno in un database che, in Fase 1, non ha ancora ruoli, audit
log, cifratura a riposo né policy di conservazione.

*Mitigazione applicabile subito, senza modificare i dati:* il database di sviluppo
resta locale e non esposto; nessun dato reale entra in Git, screenshot, log,
documentazione o fixture; nessun ambiente condiviso riceve questi dati prima che
esistano i controlli.

*Rientro:* prima del passaggio in produzione (Fase 1F) servono, e vanno verificati
da un professionista: base giuridica del trattamento, informativa, tempi di
conservazione, procedura di cancellazione, cifratura a riposo, audit log.
**Non è possibile dichiarare qui alcuna conformità GDPR.**

### R-09 — Redirect nativi delle pagine allegato *(nuovo)*
**Probabilità alta · Impatto medio**

169 URL di pagina allegato rispondono oggi **301** verso il file. È comportamento
nativo di WordPress, quindi facile da non replicare per distrazione. Se il nuovo
sito rispondesse 200 o 404 su quegli URL, 169 indirizzi indicizzati cambierebbero
comportamento.

*Mitigazione:* i 301 sono già misurati e registrati in `url-matrix.csv`, colonna
`destinazione_redirect`. Vanno importati come regole di redirect, non riprodotti a
mano. Lo stesso per i 4 `wpdmpro` verso `/download/`.

### R-10 — Metadati SEO praticamente assenti *(nuovo)*
**Probabilità certa · Impatto medio**

Su 282 record: 2 title personalizzati, 0 description, 0 og_image. Copiare i record
darebbe un sito **senza** description, mentre oggi le description esistono, generate
dai template di AIOSEO.

*Mitigazione:* in Fase 1B estrarre i template da `wp_options.aioseo_options` e
riprodurre le regole di generazione, non i record. Verificare in Fase 1E
confrontando i `<title>` e le description **renderizzati**, non quelli a database.

### R-11 — Funzione dei form in Fase 1 non decisa *(nuovo)*
**Probabilità alta · Impatto medio**

25 form WPForms compaiono nelle pagine pubbliche. Il form builder è funzione della
fase gestionale, ma le pagine che li contengono devono superare la parità **ora**.
Un form visivamente identico che non recapita nulla è peggio di un form assente:
l'utente finale non se ne accorge e la richiesta va persa.

*Mitigazione:* decidere in Fase 1B fra tre strade — form resi ma disabilitati con
messaggio esplicito; form minimale che recapita via email; pagina che rimanda a un
contatto. È una decisione dell'utente, non tecnica.

### R-12 — Voci di menu condizionate al ruolo *(nuovo)*
**Probabilità bassa · Impatto medio**

`nav-menu-roles` è attivo e il menu ha 64 voci. Se qualcuna è nascosta agli utenti
anonimi, il menu confrontato da autenticati e da anonimi è diverso, e la parità
misurata su uno dei due casi è falsa.

*Mitigazione:* rilevare in Fase 1B quali voci hanno restrizioni; eseguire i
confronti visivi **da utente anonimo**, che è la condizione del sito pubblico.

### R-13 — OptinMonster non verificato *(nuovo)*
**Probabilità bassa · Impatto medio**

Plugin attivo, nessun popup rilevato nelle pagine campione. Se esistesse su altre
pagine o dopo un ritardo, sarebbe un elemento visibile non censito.

*Mitigazione:* verifica esplicita in Fase 1B su tutte le pagine ad alta priorità,
con attesa sufficiente a far comparire eventuali popup differiti.

### R-14 — Chiave API Google Maps esposta *(nuovo)*
**Probabilità certa · Impatto medio**

La chiave è in chiaro nell'HTML pubblico. È una chiave client-side, quindi
l'esposizione è per progetto, ma senza restrizioni per referrer è utilizzabile da
terzi a spese del Centro.

*Mitigazione:* limitarla per referrer e ruotarla prima del passaggio al nuovo
dominio. È un'azione sull'account Google del Centro: spetta all'utente.

### R-16 — Difformità di ambiente fra produzione e istanza di riferimento *(nuovo, 1B-W0)*
**Probabilità certa · Impatto basso**

La produzione gira su **PHP 7.4.33** e **MySQL 5.6.51**; l'istanza di riferimento su
PHP 8.2 e MariaDB 10.11 (DR-037). I limiti di runtime coincidono, perché derivano
dallo stesso `.user.ini`, e le pagine campione rendono in modo identico. Resta
l'ipotesi che Divi o un plugin producano differenze di resa fra le due versioni di
PHP su pagine non campionate.

*Mitigazione:* il confronto a campione fra istanza di riferimento e sito online, già
previsto dalla Fase 1E, si estende alle pagine che usano Divi. Se emergesse una
differenza, fa fede **il sito online**, non l'istanza.

*Rientro:* ricostruire l'istanza su PHP 7.4 sarebbe possibile ma costoso e con
un'immagine non più manutenuta; si adotta solo se la differenza è reale e diffusa.

### R-17 — `phpinfo()` pubblicamente esposto in produzione *(nuovo, 1B-W0)*
**Probabilità certa · Impatto medio**

Sul sito in produzione esiste un URL, senza autenticazione, che restituisce un
`phpinfo()` completo: percorsi assoluti, opzioni di compilazione, elenco e versione
di tutte le estensioni, configurazione di sessione, variabili di ambiente del
processo web. È materiale di ricognizione per un attaccante e non ha ragione di
restare pubblico.

*Mitigazione:* rimozione del file. È un'operazione sull'hosting del Centro e spetta
all'utente: handoff `HO-003`.

*Nota:* il contenuto della pagina non è stato copiato nella documentazione oltre ai
valori di ambiente necessari a chiudere MI-03.

### R-18 — Difetti di qualità della sorgente che la parità imporrebbe di riprodurre *(nuovo, 1B-W0)*
**Probabilità certa · Impatto medio**

Misurato in `source-supplementary-findings.md`: **29 pagine su 80 non emettono alcun
`<h1>`**, **45 pagine su 80 non hanno meta description**, **nessun URL ha
`og:image`**, il suffisso di paginazione è in inglese, `og:site_name` termina con un
separatore penzolante. Sono difetti della sorgente, concentrati sulle pagine
costruite con Divi.

La parità pixel-perfect riguarda la **resa visiva**; questi elementi non si vedono,
ma un confronto meccanico che includesse i metadati segnalerebbe difformità su
decine di URL, e riprodurli fedelmente significherebbe portare nel sito nuovo un
difetto di accessibilità e di SEO.

*Mitigazione:* la scelta è dell'utente e non dell'agente. Portata come decisione
**D13** alla chiusura della Fase 1B, con tre strade: riprodurre fedelmente;
correggere i soli metadati non visibili mantenendo identica la resa; correggere
anche la struttura dei titoli, accettando una difformità visiva minima.

*Fino alla decisione:* i criteri di accettazione della Fase 1E trattano i metadati
come **insieme separato** dal confronto visivo, così che la scelta non blocchi la
parità.

### R-19 — I form del sito incassano pagamenti *(nuovo, 1B-W1)*
**Probabilità certa · Impatto alto**

Misurato sulle 25 definizioni pubblicate: il campo `payment-single` compare **27
volte**, con importi reali da 35 a 240 euro, e il provider PayPal Standard risulta
**abilitato su tutti e 25 i form**. Non sono form di contatto: sono moduli di
iscrizione con pagamento.

La decisione DR-032 — «form minimale che recapita per email» — è stata presa quando
questo dato non era noto. I pagamenti sono requisiti RG-01…RG-04, esplicitamente
fuori perimetro fino al superamento del gate: un form minimale non può riprodurli.

*Mitigazione:* la scelta è dell'utente, portata come decisione **D14** con tre
strade in `docs/decisions/adr/ADR-010-form-fase-1.md` §2. Nel frattempo si progetta e
si importa tutto ciò che è comune alle strade praticabili, e non si costruisce alcun
trattamento del campo di pagamento.

*Vincolo assoluto:* non si pubblica alcun form che appaia funzionante senza esserlo.
Una persona che compila un'iscrizione credendo di essersi iscritta, e non lo è, è il
danno peggiore che questa fase possa produrre.

### R-07 — Interruzioni e team di una persona
**Probabilità alta · Impatto medio**

*Mitigazione:* protocollo `PROGRESS.md` dopo ogni wave; commit per wave; alla
ripresa si riporta ultima wave completata e wave rimanenti prima di proseguire.

### R-15 — Deriva della sorgente durante lo sviluppo *(nuovo)*
**Probabilità media · Impatto medio**

Il sito resta in produzione per tutta la durata della Fase 1. Se qualcuno pubblica o
modifica contenuti, l'inventario e gli screenshot di riferimento invecchiano.

*Mitigazione:* l'istanza di riferimento è congelata al 2026-09-13 ed è quella contro
cui si misura la parità. Prima del passaggio in produzione (1F) va eseguito un
**delta** fra la sorgente congelata e quella viva, e i contenuti nuovi vanno
importati.

*Rientro:* se le modifiche fossero molte, si rifà l'import, non la ricostruzione: lo
schema e i componenti non cambiano.

---

## 3. Riepilogo

| # | Rischio | Prob. | Impatto | Chiuso in |
|---|---|---|---|---|
| R-06 | Fedeltà visiva ↔ editabilità | alta | alto | 1B-W5, collaudo 1G |
| R-04 | Dati personali senza bonifica | certa | alto | prima della 1F, con verifica legale |
| R-01 | Rendering Divi | media | medio | 1E |
| R-09 | Redirect pagine allegato | alta | medio | 1D |
| R-10 | Metadati SEO assenti | certa | medio | 1B, verifica in 1E |
| R-11 | Funzione dei form in Fase 1 | alta | medio | 1B, decisione utente |
| R-12 | Menu condizionato al ruolo | bassa | medio | 1B |
| R-13 | OptinMonster non verificato | bassa | medio | 1B |
| R-14 | Chiave Google Maps esposta | certa | medio | azione dell'utente |
| R-15 | Deriva della sorgente | media | medio | delta prima della 1F |
| R-16 | Ambiente PHP/MySQL difforme | certa | basso | campione esteso in 1E |
| R-17 | `phpinfo()` esposto in produzione | certa | medio | azione dell'utente, HO-003 |
| R-18 | Difetti di qualità della sorgente | certa | medio | 1B, decisione D13 |
| R-19 | I form incassano pagamenti | certa | alto | 1B, decisione D14 |
| R-07 | Interruzioni | alta | medio | continuo |
