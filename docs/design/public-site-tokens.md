# Design token del sito pubblico — Fase 1E, wave `1E-W3`

Il sito pubblico non ha un design proprio: riproduce quello del sito WordPress
(DR-014). I token qui elencati sono quindi **misurati**, non scelti: valori calcolati dal
browser sull'istanza di riferimento, con la regola CSS da cui vengono
(`divi-shortcode-strategy.md` §6). L'area amministrativa ha il suo sistema, in
`design-system.md`, e non condivide nulla con questo (DR-048).

| | |
|---|---|
| **Misura** | `tests/visual/stile-riferimento.ts`, 2026-10-10: 8 pagine rappresentative × 6 viewport, 36 ruoli di elemento, 32 proprietà |
| **Esiti** | `docs/qa/stile/calcolati.json` (valori calcolati), `regole.json` (1952 regole distinte, con selettore e media query), `media-query.json` |
| **Attuazione** | `apps/web/src/styles/tokens.css`, `base.css`, `blocks.css`, `open-sans.css` |

## 1. Carattere

| Token | Valore | Regola sorgente |
|---|---|---|
| `--font-body` | `'Open Sans', Arial, sans-serif` | `body` |
| `--font-size-base` | 16px | `body` |
| `--line-height-base` | 1.7 (27,2px) | `body`: `1.7em` |
| `--font-weight-body` | **500** | `body`. Non è fra i pesi caricati (300, 400, 600, 700, 800): il browser usa il più vicino, come nella sorgente. Va lasciato 500 |
| `--font-weight-menu` | 600 | `#top-menu a` |
| `--font-size-h1…h6` | 30, 26, 22, 18, 16, 14px | `h1` … `h6` del tema |
| `--font-weight-heading` | 500 | titoli resi |
| `--line-height-heading` | 1em | titoli resi |

**File del carattere.** Open Sans v44, gli stessi 20 file che Google serve alla richiesta
della sorgente (pesi 300–800 con corsivi, `display=swap`), copiati in
`apps/web/public/fonts/open-sans/` con le loro 100 dichiarazioni `@font-face` e gli stessi
intervalli di caratteri. Licenza SIL OFL 1.1, nella stessa cartella. Nessuna chiamata a
Google (DR-107).

## 2. Colori

| Token | Valore | Regola sorgente |
|---|---|---|
| `--color-text` | `#666` | `body` |
| `--color-heading` | `#333` | `h1`…`h6` |
| `--color-accent` | `#2ea3f2` | `a`, `#top-menu a`, `.et_pb_button` |
| `--color-background` | `#fff` | `body` |
| `--color-submenu-link` | `rgba(0, 0, 0, 0.6)` | `#top-menu .sub-menu a` |
| `--color-field-background` | `#eee` | `.et_pb_contact_field input` |
| `--color-field-text` | `#999` | `.et_pb_contact_field input` |
| `--color-footer-background` | `#222` | `#main-footer` |
| `--color-footer-bottom-background` | `rgba(0, 0, 0, 0.32)` | `#footer-bottom` |

## 3. Griglia e spaziature

| Token | Valore | Regola sorgente |
|---|---|---|
| `--container-width` | 80% | `.container`, `.et_pb_row` |
| `--container-max-width` | 1080px | `.container`, `.et_pb_row` |
| `--section-padding-y` | 4% (54px a 1440) | `.et_pb_section` |
| `--section-padding-y-mobile` | 50px | `.et_pb_section`, fino a 980px |
| `--row-padding-y` | 2% (27px a 1440) | `.et_pb_row` |
| `--row-padding-y-mobile` | 30px | `.et_pb_row`, fino a 980px |

Le spaziature dichiarate dai blocchi (464 valori nei contenuti importati) arrivano come
proprietà personalizzate in linea, `--blk-pad-{top,right,bottom,left}` con suffisso `-t`
per il tablet e `-p` per il telefono: un elenco chiuso di 12 nomi (DR-071, ADR-005 §3.3
regola 2). Il tablet eredita il desktop e il telefono il tablet, come in Divi; senza alcun
valore vale il predefinito qui sopra. Il criterio 1E-15 è provato in
`packages/blocks/tests/render/spacing.test.tsx`.

Punti di rottura (`visual-regression-plan.md` §3): 980/981, 767/768, 479/480, 1100, 1405,
380. Le media query più frequenti nel reso: `max-width: 980px` (100 regole), `max-width:
767px` (70), `min-width: 981px` (69), `max-width: 479px` (40).

## 4. Intestazione, menu, bottoni, campi

| Token | Valore | Regola sorgente |
|---|---|---|
| `--header-shadow` | `0 1px 0 rgba(0,0,0,.1)` | `#main-header` |
| `--menu-font-size` | 14px | `#top-menu a` |
| `--menu-item-padding-bottom` | 18px | `#top-menu > li > a` |
| `--submenu-width` | 240px | `#top-menu .sub-menu` |
| `--submenu-padding` | `20px 0` | `#top-menu .sub-menu` |
| `--submenu-border-top` | `3px solid` accento | `#top-menu .sub-menu` |
| `--submenu-shadow` | `0 2px 5px rgba(0,0,0,.1)` | `#top-menu .sub-menu` |
| `--submenu-link-width` | 200px | `#top-menu .sub-menu a` |
| `--submenu-link-padding` | `6px 20px` | `#top-menu .sub-menu a` |
| `--submenu-link-line-height` | 28px | `#top-menu .sub-menu a` |
| `--logo-height-desktop` | 90px | `#logo`, sopra 980px |
| `--logo-height-mobile` | 60px | `#logo`, fino a 980px |
| `--button-font-size` | 20px | `.et_pb_button` |
| `--button-line-height` | 1.7em | `.et_pb_button` |
| `--button-border` | `2px solid` accento | `.et_pb_button` |
| `--button-radius` | 3px | `.et_pb_button` |
| `--button-padding` | `0.3em 1em` | `.et_pb_button` |
| `--field-font-size` | 14px | `.et_pb_contact_field input` |
| `--field-padding` | 16px | `.et_pb_contact_field input` |

Altezza resa dell'intestazione, per verifica nella `1E-W4`: 137px a 1440, 187px a 1024
(il menu va a capo), 153px a 768 e sotto.

## 5. Contrasto — criterio A-8

Misurato sui colori estratti, con la formula comune del rapporto di contrasto. Soglia
comune per il testo normale: 4,5; per il testo grande (da 24px, o 18,66px in grassetto): 3.

| Coppia | Rapporto | Esito |
|---|---|---|
| testo `#666` su bianco | 5,74 | supera |
| titoli `#333` su bianco | 12,63 | supera |
| sottovoci di menu `rgba(0,0,0,.6)` su bianco | 5,74 | supera |
| piè di pagina: bianco su `#222` | 15,91 | supera |
| fondo del piè di pagina: bianco sulla fascia scura | 17,93 | supera |
| **collegamenti, menu e bottoni `#2ea3f2` su bianco** | **2,75** | **non supera**, nemmeno la soglia del testo grande |
| **testo dei campi `#999` su `#eee`** | **2,46** | **non supera** |

Il sito sorgente non supera A-8 sul colore d'accento, che è ovunque. I token lo riproducono
com'è finché l'utente non decide (D44): correggerlo cambia l'aspetto di ogni pagina.
