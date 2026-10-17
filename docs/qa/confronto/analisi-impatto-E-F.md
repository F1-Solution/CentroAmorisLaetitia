# Analisi d'impatto — famiglie E (testata) e F (piè di pagina) della `1E-W6`

Scritta il 2026-10-14. **Nessuna modifica al codice**: elenco dei punti da toccare,
in attesa di approvazione e delle decisioni D63–D65.

Metodo: stessa pagina (`/chi-siamo/`) sull'istanza di riferimento
(`http://localhost:8088`) e sul sito nuovo (`http://127.0.0.1:3200`), alle viewport
1440, 1024, 768 e 390, con le condizioni di cattura di `tests/visual/condizioni.ts` (script `tests/visual/misura-testata-piede.ts`);
misure di posizione e stili calcolati di testata e piè di pagina. Regole della
sorgente lette da `wp-content/themes/Divi/style-static.min.css`. E ed F compaiono
su tutte le 585 coppie.

---

## E — Testata

### Misure

| Elemento | Viewport | Sorgente | Sito nuovo |
|---|---|---|---|
| Altezza della testata | 1440 | 137 px | 144 px |
| Prima voce del menu (sinistra, alto) | 1440 | 256,6 · 105 | 293,2 · 112 |
| Larghezza del menu centrato | 1440 | 882,7 px (con l'icona di ricerca) | 853,6 px |
| Freccia dei sottomenu | tutte | glifo `3` del font `ETmodules`, 16 px, `top: 0; right: 0` | triangolo in CSS, `top: 50%` |
| Icona di ricerca | ≥ 981 | glifo `U` di `ETmodules`, 17 px, `#666` | assente |
| Testata a 1024 (menu su due righe) | 1024 | 187 px, contenuto spostato di 187 px | 183 px, contenuto spostato di 137 px: **la testata copre 46 px di contenuto** |
| Posizione della testata | ≤ 980 | `absolute`, `padding: 20px 0`, logo a 20 px | `fixed`, nessun padding, logo a 5 px |
| Barra «Seleziona una pagina» | ≤ 980 | alto 100, alta 33, `padding: 5px 10px` | alto 88, alta 45,2, `padding: 9px 10px` |

### Cause

| # | Causa | Effetto |
|---|---|---|
| E1 | Manca `#top-menu, #top-menu-nav { line-height: 0 }` della sorgente: la riga del testo aggiunge 7 px sopra le voci | testata 144 px invece di 137; tutto il resto della pagina scende di 7 px |
| E2 | Frecce e icona di ricerca della sorgente sono glifi del font `ETmodules`; il sito disegna la freccia in CSS e non ha l'icona | frecce in altra posizione e forma; menu spostato di 36,6 px verso destra a 1440, perché la sorgente centra menu **più** icona |
| E3 | Manca la ricerca: icona `#et_top_search` e modulo `.et_search_outer` (campo «Cerca …», parametro `s`). Oggi `/?s=corso` risponde 200 con la home; nella sorgente con la pagina dei risultati | differenza visiva su tutte le pagine; funzione pubblica assente |
| E4 | `#page-container` ha `padding-top: 137px` fisso; nella sorgente lo script di Divi lo pone uguale all'altezza reale della testata, che cresce quando il menu va a capo (981–~1100 px) | a 1024 la testata copre l'inizio del contenuto |
| E5 | Sotto i 981 px mancano le regole `et_header_style_centered`: testata `absolute` con `padding: 20px 0`, barra mobile con `padding: 5px 10px` e `margin-top: 20px`; icona dell'hamburger è il glifo `a` di `ETmodules` | logo 15 px più in alto, barra mobile più alta di 12 px |

### Punti da toccare

| # | File e righe | Modifica |
|---|---|---|
| E1 | `apps/web/src/styles/layout.css:66-69` | `line-height: 0` su `#top-menu` e `#top-menu-nav`, togliere `margin-top: 5px` se la misura lo conferma |
| E2 | `apps/web/src/styles/layout.css:95-113` (freccia), `:193-203` (hamburger); nuovo `@font-face` accanto a `apps/web/src/styles/open-sans.css`; file del font in `apps/web/public/fonts/` | secondo **D63** |
| E3 | `apps/web/src/components/SiteHeader.tsx:84-98` (icona e modulo); `apps/web/src/styles/layout.css` (regole `#et_top_search`, `.et_search_outer`); se D64 = A anche: `apps/api/src/modules/public/routes.ts`, `service.ts`, `schemas.ts` (ricerca sui contenuti pubblicati, colonna `search_vector` già presente), `apps/api/tests/openapi.snapshot.json`, `apps/web/src/app/[[...percorso]]/page.tsx` e `apps/web/src/components/Views.tsx` (pagina dei risultati), `docs/qa/url-matrix.csv` e una cattura di riferimento in più | secondo **D64** |
| E4 | `apps/web/src/styles/layout.css:22-34` e `:158-161` | secondo **D65** |
| E5 | `apps/web/src/styles/layout.css:158-225` | `#main-header` `absolute` con `padding: 20px 0`; `#et_mobile_nav_menu` `margin-top: 20px`; `.mobile_nav` `padding: 5px 10px`; misure prese dalla sorgente |
| E-prova | `tests/visual/verifica-sito.ts:42` (legge `#top-menu`) | nessuna modifica attesa; si riesegue |

---

## F — Piè di pagina

### Misure

| Elemento | Viewport | Sorgente | Sito nuovo |
|---|---|---|---|
| Altezza del piè di pagina | 1440 | 225,8 px | 269 px |
| | 768 | 227,1 px | 224 px |
| | 390 | 321,2 px | 258,7 px |
| Larghezza della colonna del testo | 1440 e 1024 | 636,9 px (centrata in sé, allineata a sinistra) | tutta la riga: 1080 / 819,2 px |
| Spazio sotto la colonna | 1440 | 59,4 px (5,5 %) | 102,6 px (9,5 %) |
| `#footer-widgets` padding sopra / sotto | 768 | 49,1 / 49,1 px (8 %) | 36,9 / 0 px |
| | 390 | 37,4 / 37,4 px | 18,7 / 0 px |
| `#footer-bottom` | tutte | 20 px | 20 px — uguale |

### Cause

| # | Causa | Effetto |
|---|---|---|
| F1 | Nella sorgente il testo sta dentro `div.fwidget.et_pb_widget` (`float: left`) e `div.textwidget`: la colonna è larga quanto la riga più lunga del testo e il `align="center"` centra dentro quella. Il sito mette il testo direttamente in `.footer-widget`, senza flottante | testo centrato su tutta la larghezza invece che a sinistra |
| F2 | Il sito ha le sole regole generiche (`padding: 6% 0 0`, `margin-bottom: 9.5%`); mancano quelle di una colonna con `et_pb_gutters3` (5,5 %) e quelle sotto i 981, 768 e 480 px (`padding: 8% 0`, margini 7,5 %, 9,5 %, 11,5 %, ultimo widget senza margine) | piè di pagina più alto a 1440, più basso a 768 e 390 |

### Punti da toccare

| # | File e righe | Modifica |
|---|---|---|
| F1 | `apps/web/src/components/SiteFooter.tsx:19-23` | avvolgere l'HTML in `div.widget_text.fwidget.et_pb_widget.widget_custom_html > div.textwidget.custom-html-widget`. Il contenuto di `site.footer_html` (DR-117) non cambia: nessun import |
| F1-css | `apps/web/src/styles/layout.css:342-344` | `.footer-widget` e `.et_pb_widget` `float: left`; `.fwidget:last-child { margin-bottom: 0 }` |
| F2 | `apps/web/src/styles/layout.css:338-353` | margini della colonna singola e regole per ≤ 980, ≤ 767, ≤ 479 px, copiate dalla sorgente e verificate con le misure sopra |
| F-prova | `apps/web/tests/siteFooter.test.tsx:10-18` | aggiornare l'attesa sul markup con gli involucri; la prova sul testo pericoloso resta |
| F-verifica | `tests/visual/verifica-sito.ts:86` (`.footer-widget` per le dichiarazioni copiate) | nessuna modifica attesa; il conteggio di 115 deve restare |

---

## Fuori da E ed F, da annotare

- La sorgente, scorrendo, rimpicciolisce la testata fissa (`et-fixed-header`); il
  sito no. Non si vede nelle catture (pagina in cima): è un'interazione, da
  verificare nella `1E-W7`.
- Su `/chi-siamo/` a 1440 il piè di pagina comincia 60 px più in basso che nella
  sorgente: è contenuto (famiglie B/H), non testata né piè di pagina.

## Ordine proposto

E1 ed F1–F2 (solo CSS e markup, nessuna decisione), poi E5, poi E2–E4 secondo
D63–D65. Prove: test di `apps/web`, `verifica-sito.ts`, `stati-matrice.py`, misure
di questo documento rieseguite, ricattura e confronto.

## Decisioni richieste

### D63 — Font delle icone (frecce, ricerca, hamburger)
- **A (consigliata):** usare il font `ETmodules` della sorgente, ridotto ai soli 3
  glifi usati (`3`, `U`, `a`). Resa identica. Il tema dichiara licenza GPL v2
  (`style.css`, riga 8), ma la licenza dei font di Elegant Themes **va verificata
  da una persona** prima del rilascio: non la dichiaro conforme.
- B: ridisegnare i 3 glifi in SVG nel codice del sito. Nessun file della
  sorgente, ma differenze di qualche pixel attorno a ogni freccia.
- Impatto: frecce e icone su tutte le 585 coppie.
- Default vietato: copiare il font senza la tua risposta.

### D64 — Ricerca del sito pubblico
- **A (consigliata):** icona, modulo e pagina dei risultati come nella sorgente,
  con una lettura pubblica nuova nell'API sulla colonna `search_vector` già
  esistente. È una funzione pubblica della sorgente; aggiunge un indirizzo alla
  matrice con la sua cattura di riferimento.
- B: solo icona e modulo, con la pagina dei risultati rimandata a una wave
  successiva. Il modulo porterebbe a una pagina che non cerca: sconsigliato.
- C: nessuna ricerca, differenza registrata come difformità da approvare.
- Impatto: testata su tutte le pagine; API, sito, matrice.
- Default vietato: aggiungere l'icona senza decidere cosa fa.

### D65 — Spazio sotto la testata quando il menu va a capo
- **A (consigliata):** testata `position: sticky` invece di `fixed` sopra i 980 px.
  Lo spazio segue da solo l'altezza reale, anche se dal CMS cambiano le voci del
  menu, senza script. In cima alla pagina la resa è identica alla sorgente.
- B: piccolo script che misura la testata e imposta lo spazio, come Divi.
- C: valori fissi per intervallo di larghezza. Si rompe quando cambia il menu.
- Impatto: 981–~1100 px, oggi la testata copre 46 px di contenuto a 1024.
- Default vietato: scegliere senza la tua risposta.
