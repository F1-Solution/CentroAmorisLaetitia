# Matrice di tracciabilità — documenti storici → target React + Node.js + PostgreSQL

Regola applicata: **il requisito business si conserva, la scelta tecnologica
incompatibile si sostituisce**. Nessuna sostituzione qui è implementabile finché
non è approvata come ADR (Fase 1B).

---

## 1. Sostituzioni tecnologiche richieste

| # | Documento e punto | Scelta storica | Requisito business conservato | Sostituzione proposta | Stato |
|---|---|---|---|---|---|
| M-01 | `01_decisioni_architetturali.md` ADR-002; `00_piano_generale.md` §Frontend Web | **Blazor United (.NET 10)** + MudBlazor | Sito pubblico SSR per SEO + area admin interattiva | **Next.js App Router + React**, SSR/SSG per il pubblico, area admin in route protette | Proposta — ADR in 1B |
| M-02 | `CLAUDE.md`, `docs/04_architettura.md` | **ASP.NET Core** controllers + MediatR | API REST documentata, casi d'uso separati dal trasporto | **Node.js + TypeScript** (Fastify o NestJS), OpenAPI generata e testata | Proposta — ADR in 1B (vedi D5) |
| M-03 | `docs/04_architettura.md` | **EF Core** + migrations | Schema versionato, migrazioni riproducibili | **Prisma** o **Drizzle** con migrazioni versionate | Proposta — ADR in 1B (vedi D5) |
| M-04 | ADR-003, `Azure-Blob-Storage-Implementation.md` | **Azure Blob Storage** | Storage media e documenti, URL pubblici per il sito | **S3-compatible**, MinIO in locale | Proposta — ADR in 1B |
| M-05 | ADR-001, `docs/ADRs/001-database-choice.md` | PostgreSQL su **Azure Flexible Server** | PostgreSQL come motore | PostgreSQL in **container Docker**, su VPS Linux | Proposta — ADR in 1B (vedi D6) |
| M-06 | `docs/09_cicd_azure_deployment.md`, `docs/10_azure_deployment.md` | Azure App Service, Key Vault, Application Insights | Deploy riproducibile, segreti fuori dal codice, osservabilità | **Docker Compose** su VPS, reverse proxy **Caddy o Nginx**, Cloudflare davanti; segreti da variabili d'ambiente o secret manager; log strutturati + error tracking configurabile | Proposta — ADR in 1B/1F |
| M-07 | ADR-003 (`prompt_iniziale.md` §Dominio app) | **.NET MAUI** per desktop e mobile | App desktop e mobile con le stesse funzioni | Da ridecidere dopo il gate; nessuna proposta ora | Rinviata |
| M-08 | `docs/TESTING.md` | xUnit, FluentAssertions, Moq, bUnit | Copertura unit/integrazione/E2E | **Vitest**, React Testing Library, **Playwright**, test di integrazione su PostgreSQL reale | Proposta — ADR in 1B |
| M-09 | ADR-002 | JWT + cookie, 2FA TOTP (già implementato in .NET) | Autenticazione con 2FA e sessioni sicure | Da riprogettare per Node.js; nessuna implementazione nella Fase 1 salvo il login del CMS | Rinviata |
| M-10 | `CLAUDE.md`, `docs/03_domain_model.md` | Clean Architecture 4 layer + DDD + CQRS in C# | Separazione dominio/applicazione/infrastruttura, 8 bounded context | Il **modello di dominio si conserva**; la forma architetturale va ridecisa per Node.js — CQRS+MediatR non ha equivalente obbligato | Proposta — ADR in 1B |
| M-11 | `docs/SETUP_INSTRUCTIONS.md`, `README.md` | Azurite, `dotnet user-secrets`, pgAdmin | Ambiente locale riproducibile | **Docker Compose** con PostgreSQL + MinIO, `.env.example` | Proposta — 1C |
| M-12 | ADR-006 | Naming tabelle e colonne in **italiano snake_case** | Leggibilità per il manutentore italiano | Da riconfermare con l'ORM scelto | Aperta — vedi D7 |
| M-13 | `docs/07_analisi_wordpress.md` §Raccomandazioni | Importer **CLI in C#** (`CentroAmorisLaetitia.WordPressMigration`) | Importer idempotente con dry-run e report | Importer **Node.js + TypeScript** nel monorepo | Proposta — ADR in 1B |
| M-14 | `docs/07_analisi_wordpress.md` §Performance | **Redis** per cache pagine | Tempi di risposta accettabili | Caching nativo Next.js; Redis solo se misurato necessario | Proposta — 1E |

---

## 2. Requisiti business conservati integralmente

Non sono toccati dal cambio di stack e restano vincolanti come da
[`requirements-consolidated.md`](requirements-consolidated.md):

RB-01…06 · RU-01…05 · RC-01…11 · RA-01…05 · RP-01…09 · RF-01…11 · RD-01…07 ·
RM-01…13 · RG-01…04 · RT-01…07 · RS-01…06 · RN-01…07 · RQ-01…04.

Il modello di dominio in `docs/03_domain_model.md` e `docs/08_cms_bounded_context.md`
è **riusabile così com'è** come modello concettuale: è espresso in termini di
entità, aggregati e regole, non di tecnologia.

---

## 3. Contraddizioni fra i documenti storici

| # | Contraddizione | Documenti | Effetto |
|---|---|---|---|
| C-01 | **Il codice descritto non esiste in questo repository.** I documenti descrivono una soluzione .NET completa (`src/`, `frontend/`, `tests/`), ma Git traccia un solo file (`.gitignore`) e non esiste alcun sorgente. | tutti i report di fase vs `git ls-files` | Tutti i claim di completamento sono **non verificabili qui**. Vedi D1. |
| C-02 | Avanzamento dichiarato **~92%** contro audit interno **~55%**, con build in fallimento e 74 errori nei test. | `KNOWN_ISSUES.md`, `PROJECT_COMPLETION_SUMMARY.md` vs `02_stato_attuale_reale.md` | I report di fase non sono utilizzabili come stato di fatto. |
| C-03 | `prompt_iniziale.md` §Comunicazioni chiede **WhatsApp**; la ADR-005 storica lo esclude; la direttiva attuale lo ricolloca fra le fasi successive. | `prompt_iniziale.md` vs `01_decisioni_architetturali.md` | Decisione da riaprire dopo il gate. Vedi D8. |
| C-04 | `prompt_iniziale.md` §Sito attuale dice "l'aspetto grafico finale dovrebbe essere **simile**"; la direttiva attuale impone **pixel-perfect provato**. | `prompt_iniziale.md` vs direttiva di progetto | Cambia radicalmente i criteri di accettazione della Fase 1E. Vedi D2. |
| C-05 | `contenuti-non-importabili.md` dichiara homepage, CSS Divi e immagini hero "già ricostruiti in Blazor". | `contenuti-non-importabili.md` | Lavoro non presente nel repository: **da rifare integralmente** in React. |
| C-06 | Voci di menu: l'export contiene **61** `nav_menu_item`, il documento ne dichiara "~30". | export WXR vs `contenuti-non-importabili.md` | Il conteggio va rifatto sulla sorgente in Fase 1A. |
| C-07 | `contenuti-non-importabili.md` attribuisce i form a "Contact Form 7 o Gravity Forms"; `wordpress_info.txt` e il dump elencano **WPForms**. | `contenuti-non-importabili.md` vs dump e info sito | Il documento è impreciso: fa fede la sorgente. |
| C-08 | `07_analisi_wordpress.md` mappa il SEO su meta **Yoast** (`_yoast_wpseo_*`); i plugin attivi e le tabelle indicano **All in One SEO** (`wp_aioseo_posts`). | `07_analisi_wordpress.md` vs dump | Il mapping SEO va rifatto su AIOSEO in Fase 1B. |
| C-09 | `07_analisi_wordpress.md` dichiara **54 tabelle**; il dump ne contiene **53**. | documento vs `database_backup.sql` | Scostamento minore; fa fede il dump. |
| C-10 | `plan.md` marca "Fase 8 Testing ✅ COMPLETATA (100%)" mentre `KNOWN_ISSUES.md` riporta che `dotnet test` non compila. | `plan.md` vs `KNOWN_ISSUES.md` | Conferma che le spunte di completamento non sono affidabili. |
| C-11 | La ADR storica sul frontend abbandona React per Blazor; la direttiva attuale torna a React. | `01_decisioni_architetturali.md` vs direttiva di progetto | La ADR-002 storica è **superata**; `docs/10_frontend_react_architecture.md` torna materiale utile. |

---

## 4. Valore residuo dei documenti storici

| Categoria | Uso nel nuovo progetto |
|---|---|
| **Fonte di requisiti** | `prompt_iniziale.md`, `01_requisiti.md`, `02_user_stories.md`, `03_domain_model.md`, `08_cms_bounded_context.md` |
| **Fonte di analisi sorgente** | `07_analisi_wordpress.md`, `11_wordpress_migration_guide.md`, `contenuti-non-importabili.md` — **da riverificare** sulla sorgente in Fase 1A |
| **Fonte di criteri di rilascio** | `12_go_live_checklist.md`, `SECURITY_CHECKLIST.md` |
| **Fonte di modelli di formato** | `modelli/` — struttura di Prima Nota, movimenti bancari, Mod. D. **Solo la forma, mai i dati** |
| **Materiale superato** | tutti i documenti Azure, i report di fase, `README.md`, `CLAUDE.md`, `SETUP_INSTRUCTIONS.md`, `plan.md` |

---

## 5. Sorgente WordPress — fatti rilevati

Rilevati direttamente su `source-private/wordpress/`, non dai documenti.

| Elemento | Valore |
|---|---|
| WordPress | 6.9 |
| Tema | **Divi 4.18.0**, nessun child theme |
| Prefisso tabelle | `wp_` — **53 tabelle** nel dump (9,7 MB) |
| Plugin attivi | 18, fra cui All in One SEO, WPForms (+MailChimp, +PayPal Standard), Slider Revolution, WP Download Manager, Members, Nav Menu Roles, WP Customer Area, WP Event Manager, OptinMonster, Cookie Notice, BackWPup, WP Mail SMTP, MonsterInsights |
| Export WXR | 2026-03-04 |
| `page` | **75** |
| `post` | **30** |
| `attachment` | **166** |
| `nav_menu_item` | **61** |
| `wpdmpro` (documenti scaricabili) | **4** |
| `et_pb_layout` (template Divi) | **4** |
| `wp_template` / `wp_global_styles` / `custom_css` | 1 ciascuno |
| Stati | 176 `publish`, 1 `draft`, 166 `inherit` |
| URL distinti nell'export | **320** |
| File in `uploads/` | **835** — 2017: 202, 2018: 274, 2019: 186, 2020: 149, 2021: 24 |
| Tipi in `uploads/` | 409 jpg, 282 png, 113 jpeg, **29 pdf**, 2 mp4 |
| Dominio sorgente | `https://www.centroamorislaetitia.it` |

Osservazioni rilevanti per la migrazione:

- **Nessun contenuto privato o protetto da password** nell'export (0 `private`,
  0 `pending`, 1 solo `draft`): l'inventario di Fase 1A deve verificarlo anche sul
  dump, perché l'export WXR può escludere contenuti.
- Il sito espone **URL numerici** (es. `/1020/`, `/46/`) accanto agli slug: la
  matrice URL dovrà coprirli entrambi.
- Esistono **URL annidati** (es. `/autostima-e-assertivita/autostima-assertivita-web/`)
  tipici delle pagine allegato Divi: vanno decisi caso per caso in Fase 1B.
- Divi 4.18.0 è un **page builder a shortcode** (`et_pb_*`) con rendering
  JavaScript: il contenuto delle pagine non è HTML semantico. È il rischio tecnico
  numero uno della parità visiva.
- I file in `uploads/` si fermano al **2021**, mentre esistono contenuti datati
  2022–2025: alcuni media referenziati potrebbero **non essere presenti** nel
  backup. Da verificare in Fase 1A.

---

## 6. Dati personali presenti nella sorgente — da non importare senza decisione

| Sorgente | Contenuto | Rischio |
|---|---|---|
| `wp_users`, `wp_usermeta` | Utenti reali: email, login, hash password | Dati personali |
| `wp_wpforms_entries`, `wp_wpforms_entry_fields`, `wp_wpforms_entry_meta` | **Compilazioni reali dei form** di iscrizione ai corsi e di richiesta consulenza | Dati personali, potenzialmente particolari |
| `wp_ahm_download_stats`, `wp_ahm_sessions`, `wp_ahm_user_download_counts` | Tracciamento download per utente | Dati personali |
| `wp_comments`, `wp_commentmeta` | Commenti con autore ed email | Dati personali |
| `wp_wpmailsmtp_debug_events` | Log di invio email, con destinatari | Dati personali |
| `uploads/**.pdf` (29 file) | Possibili moduli o documenti con nominativi | Da verificare uno a uno |

Nessuno di questi è in ambito per la parità visiva del sito pubblico.
L'importazione richiede una decisione esplicita: vedi **D3** in
[`open-questions.md`](open-questions.md).
