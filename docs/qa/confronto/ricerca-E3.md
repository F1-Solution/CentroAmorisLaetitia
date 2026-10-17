# Ricerca (E3) — confronto con la sorgente dopo HO-020

Fase 1E, wave `1E-W6`. Scritto il 2026-10-14, dopo migrazione `0004` e import
eseguiti su conferma (HO-020).

## 1. Esecuzione di HO-020

| Controllo | Atteso | Osservato |
|---|---|---|
| Copia di salvataggio | 34 tabelle con dati | 34, `~\amoris-backup\amoris-prima-HO-020-2026-10-14.dump` (455 kB) |
| Migrazione | `0004` applicata | applicata in 115 ms; `documents.published_at` `timestamptz`, nullable |
| Import | `success`, 57/47/4 | `success`, 57/47/4, 0 errori, 425 compilazioni saltate, verifiche a zero |
| Date dei documenti | 4 pubblici al 5 aprile 2022 | 4 pubblici al 2022-04-05, 4 riservati al 2022-04-04 |
| `stati-matrice.py` | 292 conformi | 292 conformi, 0 difformi |

API e sito ricompilati e riavviati su `127.0.0.1:3002` e `127.0.0.1:3200`.

## 2. Risultati della ricerca, frase per frase

Tutte le pagine dei risultati percorse su entrambi i siti (`/?s=…`, poi
`/page/N/?s=…`), indirizzi confrontati per insieme e per ordine.

| Frase | Sorgente | Sito | Insieme | Ordine dei comuni |
|---|---|---|---|---|
| `corso` | 65 (1 doppio) | 63 | −1 | identico |
| *(vuota)* | 111 (1 doppio) | 110 | uguale | identico |
| `famiglia` | 42 | 41 | −1 | identico |
| `corso consulenti` | 15 | 15 | uguale | identico |
| `Corso Per` | 65 (1 doppio) | 63 | −1 | **30 posizioni diverse** |
| `perché` | 5 | 5 | uguale | identico |
| `-corso` | 46 | 47 | +1 | identico |
| `consulente familiare` | 17 | 17 | uguale | identico |
| `modulo` | 26 | 25 | −1 | identico |

**I doppi della sorgente** sono l'instabilità già nota: con date uguali MySQL non
garantisce l'ordine fra una pagina e l'altra, e un risultato compare su due pagine.

**Le cinque differenze d'insieme** sono tutte la differenza nota (WordPress cerca nel
contenuto grezzo): la parola compare solo in un attributo.

| Frase | Contenuto | Dove sta la parola nella sorgente |
|---|---|---|
| `corso`, `Corso Per` | `/corsi-2022-2023/` | in un `href` (`/corso-caritas-fare-bene-il-bene/`) |
| `-corso` | `/corsi-2022-2023/` | stesso `href`: la sorgente lo esclude, il sito no |
| `famiglia` | `/seminario-estivo/` | nel nome di un'immagine (`famiglia_picnic_530_400.jpg`) |
| `modulo` | `/contatti/` | in `admin_label="Modulo di Contatto"` di Divi |

**L'ordine di `Corso Per`** è l'unica differenza nuova. "per" è una parola vuota, quindi
si cerca solo "Corso", ma l'ordine per pertinenza usa la frase intera anche sul testo
(grado 5 di `parse_search_order()`). Quattro articoli (`attraversare-le-emozioni`,
`il-corpo-racconta`, `il-litigio-di-coppia`, `reinventa-la-tua-vita`) chiudono un
paragrafo con «…del corso» e aprono il successivo con «Per le iscrizioni…». Nel grezzo
di WordPress c'è `</p><p>` fra le due parole; nel nostro testo visibile i paragrafi sono
uniti da uno spazio, così diventa «corso Per» e i quattro salgono di grado. Decisione
**D66**.

## 3. Verifica a vista della testata con la ricerca aperta

Strumento: `tests/visual/ricerca-aperta.ts`, pagina `/chi-siamo/`, viewport 1440,
1024, 768 e 390.

| Controllo | Sorgente | Sito | Esito |
|---|---|---|---|
| Icona presente | ≥ 981 px | ≥ 981 px | ✅ |
| Contenitore aperto, 1440 | 249,0 943×137 | 249,0 943×137 | ✅ |
| Contenitore aperto, 1024 | 102,0 819×187 | 102,0 819×187 | ✅ |
| Chiusura, posizione | 1161,95 30×30 | 1162,95 30×30 | ✅ (1 px) |
| Fuoco sul campo all'apertura | sì | sì | ✅ |
| Invio di «corso» | `/?s=corso` | `/?s=corso` | ✅ |
| Campo, altezza (1440 / 1024) | 55 / 75 px, dal 60% al fondo | 24 / 24 px | ❌ |
| Campo, carattere | Open Sans | Arial | ❌ |
| Campo, spaziatura | 2 px | 0 | ❌ |
| Contorno a fuoco | nessuno | contorno del browser | da decidere, **D67** |

Le tre differenze del campo vengono dal CSS del sito, non dalla sorgente:

| Punto | Oggi | Sorgente |
|---|---|---|
| `apps/web/src/styles/layout.css:233-245`, `.et-search-form input` | `height: 1.7em` | nessuna altezza: `top: 60%; bottom: 0` lo estendono |
| stessa regola | carattere non ereditato | `button,input,select,textarea{font-family:inherit}` (Divi) |
| stessa regola e il suo `::placeholder` | nessuna spaziatura | `.et_search_form_container input{letter-spacing:2px}` (customizer) |

Correzione proposta, **solo** nella regola `.et-search-form input` (nessuna regola
globale, per non toccare i form dei contenuti): togliere `height`, aggiungere
`font-family: inherit` e `letter-spacing: 2px`, e la stessa spaziatura sul
`::placeholder`. A ricerca chiusa il campo è invisibile, quindi la ricattura non cambia.

**Divergenza dell'istanza, senza azione.** Nella sorgente locale la chiusura appare come
la lettera «M»: il carattere `ETmodules` lì risulta in `error`. Sul sito online si carica
e mostra «×», come il sito nuovo. Frecce e lente delle catture di riferimento sono
corrette.

## 4. Ricattura e confronto

Ricattura integrale: 588 su 588 (le 585 più `/?s=corso` a 1440, 768 e 390), nessun
errore, log in `docs/qa/screenshots/cattura-sito-HO-020.log`. Catture e differenze
precedenti archiviate in `sito-2026-10-14-prima-HO-020` e `diff-2026-10-14-prima-HO-020`.
Confronto: **0 superati, 588 falliti**, 23 aree oltre 32×32.

| Misura (sulle 585 comuni) | Prima (HO-019) | Dopo (HO-020) |
|---|---|---|
| Coppie alla stessa altezza | 47 | 24 |
| Differenza d'altezza mediana | 72 px | 68 px |
| Coppie oltre 500 px | 36 | 39 |

Differenza d'altezza sito − sorgente, mediana per viewport:

| Viewport | Prima | Dopo | Lettura |
|---|---|---|---|
| 1440 | +108 | +64 | testata corretta (E1, E4) |
| 1280 | +118 | +87 | idem |
| 1024 | +55 | +83 | peggiora: cause (a) e (b) |
| 768 | +47 | +49 | invariata |
| 390 | −8 | +48 | testata corretta: si vede la causa (c) |
| 360 | +5 | +62 | idem |

La testata ora coincide con la sorgente a tutte le viewport (verificata a vista a 390 e
misurata a 390, 1024, 1280). Le coppie «alla stessa altezza» di prima erano in buona
parte una coincidenza: la testata sbagliata compensava differenze del contenuto. Tre
cause spiegano il resto.

**(a) Sottomenu nascosti che allungano la pagina (E4, DR-145).** Sulle pagine più corte
della finestra il documento arriva a 904 px a 1440 e 1280 e a 899 px a 1024, mentre il
piè di pagina finisce a 565–618 px. L'elemento più basso, in entrambi i siti, è un
`ul.sub-menu` nascosto. Nella sorgente la testata è `fixed` e i suoi discendenti non
allungano il documento; da noi la testata è `sticky`, nel flusso, e i sottomenu
nascosti sì. Coppie colpite: 23 (`/bacheca/`, `/bacheca-degli-eventi/`, `/404…`, gli
articoli brevi, i download), a 1440 di 4 px, a 1280 e 1024 di 104–131 px.

**(b) Margine del piè di pagina preso dall'unica eccezione (F2).** Sopra i 980 px il
widget del piè ha `margin-bottom: 5.5%` (regola di `et_pb_gutters3`), cioè 56 px a 1280
contro 31 px della sorgente. Nella sorgente 114 indirizzi su 115 hanno
`et_pb_gutters2` (valore del tema, `gutter_width = 2`, regola `margin-bottom: 3%`):
solo `/chi-siamo/` ha `gutters3`, perché la pagina imposta `_et_pb_gutter_width = 3`.
La misura di F2 era stata fatta proprio su `/chi-siamo/`. Effetto: +21 px a 1024, +25 px
a 1280 e 1440, su tutte le pagine tranne `/chi-siamo/`.

**(c) Spaziature dell'articolo nelle pagine con titolo, non Divi (preesistente).**
Esempio `/io-e-laltro-imparare-a-stare-insieme/`: nella sorgente l'articolo di una
pagina non ha la classe `et_pb_post`, il titolo ha `margin-bottom: 20px` e la colonna
`padding-bottom: 0`; da noi l'articolo ha `et_pb_post` (60 px sotto), il titolo 0 e la
colonna 23 px. Saldo +63 px a tutte le viewport. Non introdotta oggi: prima era
nascosta dalla testata.

**Pagina dei risultati `/?s=corso`.** 1440: 2026 contro 2017 px. 768: 2011 contro 2396.
390: 2673 contro 2289. Differenze viste a occhio, da analizzare:

| Elemento | Sorgente | Sito |
|---|---|---|
| Titolo dei risultati | scuro, a 390 piccolo | azzurro (colore dei link), a 390 grande |
| Estratto | più corto («…Il consulente…») | più lungo («…Il consulente familiare è il…») |
| Immagine in evidenza | intera, in proporzione | ritagliata ad altezza fissa |
| Virgolette | tipografiche («“…”») | dritte (`"…"`) |

Le stesse regole servono l'archivio `/category/news/` (stesso modello): da verificare
se lì le differenze ci sono già.

## 5. Punti da toccare (da approvare, nessuna modifica fatta)

| Causa | Punto | Proposta |
|---|---|---|
| Campo di ricerca (§3) | `apps/web/src/styles/layout.css:233-245` | togliere `height`, aggiungere `font-family: inherit` e `letter-spacing: 2px`, anche sul `::placeholder` |
| (a) | `apps/web/src/styles/layout.css`, regole dei sottomenu e della testata `sticky` | i sottomenu chiusi non devono contare nell'altezza della pagina; soluzione da scegliere nell'analisi (D68) |
| (b) | `apps/web/src/styles/layout.css:521-537` (`.footer-widget`) | `margin-bottom: 3%` come `et_pb_gutters2`; per `/chi-siamo/` vedi D69 |
| (c) | `apps/web/src/components/Views.tsx:73-79` e `layout.css:413-415`, `:483-485` | classe e spaziature dell'articolo di pagina come `page.php` di Divi; da misurare su tutte le pagine con titolo prima di cambiare |
| Risultati | `Views.tsx` (`PostListing`), `layout.css`, `routes.ts:198-199` | da analizzare insieme all'archivio |
| D66 | `packages/blocks/src/serialize/text-extract.ts` | solo se D66 = A, poi import su conferma |

## Decisioni richieste

### D66 — Ordine per pertinenza quando una frase attraversa due paragrafi
- **A (consigliata):** nel testo visibile i blocchi si separano con un a capo e non con
  uno spazio, e la frase si cerca solo dentro un blocco. L'ordine torna quello della
  sorgente per «Corso Per». Tocca l'estrazione del testo (`packages/blocks`), quindi
  serve un nuovo import su conferma; riassunti e descrizioni non cambiano, perché
  riducono già gli spazi.
- B: lasciare così e registrare la differenza fra quelle note della ricerca. Colpisce
  solo frasi di più parole che attraversano un paragrafo.
- Impatto: ordine dei risultati; nessun effetto sulla resa delle pagine.
- Default vietato: cambiare l'estrazione del testo senza la tua risposta.

### D67 — Contorno di focus nel campo di ricerca
- **A (consigliata):** contorno come DR-141 (`2px solid #333`), coerente con i form e
  con l'accessibilità. Si vede a ogni apertura, perché nei campi di testo
  `:focus-visible` vale anche al clic.
- B: nessun contorno, come la sorgente; il fuoco si vede solo dal cursore nel campo.
- Impatto: testata con la ricerca aperta, su tutte le pagine.
- Default vietato: togliere il contorno senza la tua risposta.

### D68 — Sottomenu nascosti con la testata `sticky`
- **A (consigliata):** i sottomenu chiusi escono dal calcolo dell'altezza
  (`display: none` da chiusi, comparsa con la stessa dissolvenza tramite
  `@starting-style`). La testata resta `sticky` come da DR-145.
- B: tornare alla testata `fixed` con lo spazio misurato da uno script, come Divi
  (opzione B di D65).
- Impatto: 23 coppie oggi; ogni pagina più corta della finestra.
- Default vietato: tagliare la testata con `overflow`, che nasconderebbe i sottomenu.

### D69 — Spaziatura per pagina (`et_pb_gutters`)
- **A (consigliata):** importare `_et_pb_gutter_width` per contenuto (oggi il meta è
  scartato) e mettere la classe sul `body`, con 2 come valore del tema. `/chi-siamo/`
  torna esatta. Serve una migrazione e un import, su conferma.
- B: regola fissa `et_pb_gutters2` per tutto il sito; `/chi-siamo/` resta 25 px più
  bassa nel piè di pagina, da registrare come difformità.
- Impatto: piè di pagina sopra i 980 px su tutte le pagine.
- Default vietato: lasciare la regola di `gutters3` per tutte le pagine.

### Approvazione
- correzione del campo di ricerca (§3);
- analisi delle cause (a), (b), (c) e della pagina dei risultati, nell'ordine
  (b), (a), campo, (c), risultati.

## 6. Dopo le correzioni (DR-146…150) e HO-021

HO-021 eseguito il 2026-10-16: copia di salvataggio (34 tabelle), migrazione `0005`,
import `success` 57/47/4 con chiavi meta non classificate 0; `gutter_width` 2 in 27
contenuti, 3 in `/chi-siamo/`, vuota negli altri 80; 82 contenuti con il testo diviso
per paragrafi. API riavviata, 292/292 stati conformi.

**Ricerca.** Le 9 frasi: ordine dei risultati comuni identico alla sorgente in tutte,
compresa «Corso Per» (prima 30 posizioni diverse). Restano solo le 5 differenze
d'insieme da attributi grezzi (§2).

**Ricattura e confronto.** 588 su 588 confrontate, nessuna immagine mancante (la
cattura, fermata una volta dal sistema per memoria, è ripresa dal giornale).

| Misura | HO-020 | Dopo DR-146…150 e HO-021 |
|---|---|---|
| Superate | 0 | **4** |
| Da esaminare (sotto 0,5%) | 0 | **13** |
| Coppie alla stessa altezza | 24 | 76 |
| Differenza d'altezza mediana | 68 px | 27 px |
| Coppie oltre 500 px | 39 | 34 |
| Percentuale mediana delle confrontabili | 12,0% | 3,6% |

Superate: `/bacheca/` a 768, `/bacheca-degli-eventi/` a 768 e 390, `/404-url-inesistente/`
a 390. Da esaminare: `/bacheca/` e `/bacheca-degli-eventi/` a 1440, 1280, 1024, 360 e
`/bacheca/` a 390; `/dove-siamo/` a 390; `/404…` a 1024, 768, 360. Le aree residue
sono righe di 1 px a tutta larghezza e piccoli riquadri (7×4 px nella testata a 1440 e
1280).

`/chi-siamo/` (D69): stessa altezza della sorgente a 1440 e 1024, 1 px a 1280 (prima
+60 px); a 768, 390 e 360 resta +16 px di contenuto.

## 7. Esame delle 13 coppie da esaminare (2026-10-16)

Zone ricavate pixel per pixel fra riferimento e cattura; ogni ipotesi provata iniettando
la regola nella pagina e ricatturando con lo stesso `scatta()` del confronto.

| Zona | Coppie | Causa | Prova |
|---|---|---|---|
| Frecce dei sottomenu prima della voce invece che dopo | testata a 1440, 1280, 1024 | nella sorgente il link della voce è `position: relative` e la freccia si appoggia a lui; da noi è `static`, la freccia va in fondo alla voce, dopo i 22 px di spazio. Presente dalla correzione E2 | con `#top-menu a { position: relative }` la riga del menu coincide |
| Logo, 169 pixel con scarto massimo 12/255 | testata a 1440, 1280, 1024 | Divi mette `transform: translate3d(0,0,0)` e `transition: all .4s` sul logo: il livello di composizione cambia il ridimensionamento. Stesso file (sha256 identico) e stessa geometria | con la regola: 0 pixel diversi |
| Due righe a tutta larghezza, 20 px l'una dall'altra | 1024, 768, 390, 360 | il piè di pagina parte 0,06 px prima e il bordo del `#footer-bottom` cade sul pixel prima. Causa: interlinea `1.7` senza unità; Divi usa `1.7em`, che Chrome arrotonda a 27,203 px invece di 27,1875 | con `body { line-height: 1.7em }`: `/bacheca/` identica al pixel a 6 viewport su 6, la 404 a 360, 390 e 768 |
| Riga di testo del piè a 360 | 360 | stesso spostamento sotto il pixel, solo antialiasing | come sopra |
| Mappa | `/dove-siamo/` a 390 (anche 768 e 360 fallite) | maschera approvata (HO-015, selettore `.blk-map`) ma con l'altezza misurata prima: 87–115 px, la mappa ne occupa circa 200 | rimisura con `tests/visual/maschere.ts`, selettore e motivo invariati |

**Attenzione sull'interlinea.** `1.7em` si eredita come 27,2 px fissi in tutti i
discendenti, `1.7` si ricalcola per ogni carattere: è il comportamento di Divi, ma tocca
tutto il sito. Sul campione: meglio su `/bacheca/` e sulla 404; su `/chi-siamo/`
(percentuale grezza senza maschere) un poco peggio, su `/io-e-laltro…` 1 px in più a
qualche viewport. Va giudicata con la ricattura completa.

Punti da toccare (da approvare):

| Punto | Modifica |
|---|---|
| `apps/web/src/styles/layout.css`, `#top-menu a` | `position: relative` |
| `apps/web/src/styles/layout.css`, `#logo` | `transform: translate3d(0, 0, 0)`; `transition: all 0.4s ease-in-out` |
| `apps/web/src/styles/tokens.css:15` | `--line-height-base: 1.7em` |
| `docs/qa/confronto/maschere.json` | rimisura con `maschere.ts`: stessi selettori e motivi |

## 8. Dopo HO-022 e DR-154 (2026-10-16)

HO-022: copia di salvataggio (34 tabelle), import `success` 57/47/4, verifiche a zero;
292/292 stati conformi. Correzioni del §7 attuate: freccia del menu, logo,
interlinea `1.7em`, maschere rimisurate (47, stessi selettori e motivi; la mappa ora
coperta per 440/350/200 px).

**Tipografia** (`tipografia.py`, 115 indirizzi): da 98 indirizzi e 1.258 scarti a
**26 indirizzi e 67 scarti**; titoli 0 (erano 166). I residui non sono tipografia:

| Residuo | Indirizzi | Causa |
|---|---|---|
| Descrizione del campo di pagamento dei form («L’iscrizione sarà perfezionata…», coordinate del bonifico) | 20 pagine di registrazione e `/diventa-socio/` | il testo manca nei nostri form: famiglia nuova, **D72** |
| Menu e testo della 404 | `/404-url-inesistente/` | da esaminare con la 404 |
| Testo della pagina dei cookie | `/informazioni-sui-cookie/` | 7 apostrofi in meno: parte di testo da verificare |
| Estratti con «“» in più o in meno | archivio | ordine fra articoli con la stessa data |

**Estratti.** Archivio pagina 1: 5 su 6 uguali alla sorgente (erano 1), ricerca pagina 2:
5 su 5. Divi conta 7 caratteri per una virgoletta prodotta da `wptexturize` e 1 per
una già scritta tipografica dall'autore; nel testo importato le due forme non si
distinguono, e il peso 7 è quello che dà il risultato migliore (provato anche 1: archivio
1 su 6). Il residuo è **D71**.

**Ricerca con l'apice.** «l'altro» e «l’altro» trovano gli stessi 8 contenuti; la sorgente
ne trova 3, perché dove il grezzo ha `&#8217;` WordPress non riconosce l'apice dritto.
Differenza nota, a favore di chi cerca.

**Confronto** (588 coppie):

| Misura | Prima di DR-154 | Dopo |
|---|---|---|
| Superate | 4 | **17** |
| Da esaminare | 13 | 1 (`/404…` a 1024, 0,17%) |
| Coppie alla stessa altezza | 76 | 94 |
| Differenza d'altezza mediana | 27 px | 25 px |
| Coppie oltre 500 px | 34 | 34 |

Superate: `/bacheca/` e `/bacheca-degli-eventi/` a tutte e 6 le viewport, la 404 a 360,
390 e 768, `/dove-siamo/` a 390 e 768. Nessun esito peggiorato. Le altezze cambiano in
entrambi i sensi (149 peggio, 118 meglio): D70 e interlinea sono entrate nello stesso
giro e vanno lette per famiglia nella prossima analisi.

## Decisioni nuove

### D71 — Peso delle virgolette negli estratti
- **A (consigliata):** l'importer conserva, per ogni contenuto, la forma del grezzo da cui
  si conta l'estratto (un campo calcolato all'import, per esempio la lunghezza in
  caratteri di ogni parola nel grezzo), e il sito la usa. Estratti identici; richiede
  migrazione e import. I contenuti scritti dal CMS contano i caratteri come sono.
- B: tenere il peso 7 per tutte e registrare il residuo come difformità (pochi caratteri
  in alcuni estratti).
- Impatto: estratti di archivio e ricerca.
- Default vietato: cambiare il peso senza la tua risposta.

### D72 — Descrizione del campo di pagamento nei form
- **A (consigliata):** importare e mostrare la descrizione dei campi di WPForms come la
  sorgente. Contiene le coordinate bancarie dell'associazione, già pubbliche sul sito:
  serve la tua conferma che restino pubbliche.
- B: lasciare il campo senza descrizione e registrarlo come difformità.
- Impatto: 21 pagine con form.
- Default vietato: pubblicare coordinate bancarie senza la tua conferma.
