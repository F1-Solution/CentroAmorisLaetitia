# Indice dei documenti — Fase 0 (Discovery, sola lettura)

Rilevato il 2026-09-13. Nessun file è stato modificato. `source-private/` è stato
solo letto, mai scritto.

## 1. Stato del repository

| Elemento | Valore |
|---|---|
| Branch | `main` |
| Commit | 1 (`94c6106 First commit`) |
| File tracciati da Git | **1** (`.gitignore`, 451 righe) |
| Directory non tracciate | `.claude/`, `source-private/` |
| Codice applicativo presente | **nessuno** |

`source-private/` è escluso da Git (riga 451 di `.gitignore`: `/source-private`).
Verificato con `git check-ignore` su credenziali, dump e modelli: tutti ignorati.

## 2. File di progetto attesi dal prompt — stato reale

| File atteso | Path | Presente |
|---|---|---|
| `prompt_iniziale.md` | `source-private/planning/docs/prompt_iniziale.md` | sì (21 KB) |
| `REQUIREMENTS.md` | — | **no** (esiste `docs/01_requisiti.md`) |
| `ROADMAP.md` | `source-private/planning/ROADMAP.md` | sì, ma **non** nella radice |
| `README.md` | `source-private/planning/README.md` | sì, ma **non** nella radice |
| `CLAUDE.md` | `source-private/planning/CLAUDE.md` | sì, ma **non** nella radice |
| `FUTURE_IMPLEMENTATIONS.md` | `source-private/planning/FUTURE_IMPLEMENTATIONS.md` | sì |
| `KNOWN_ISSUES.md` | `source-private/planning/KNOWN_ISSUES.md` | sì |
| `PROGRESS.md` | — | **no** |
| `docs/` (target) | — | **no**, creato ora solo `docs/discovery/` |

## 3. Documentazione storica — `source-private/planning/` (56 file, 2,0 MB)

### 3.1 Pianificazione di alto livello
| File | Contenuto | Valore residuo |
|---|---|---|
| `docs/prompt_iniziale.md` | Requisiti business originali del committente | **Alto** — fonte primaria |
| `00_piano_generale.md` | Piano in 8 fasi, stack .NET | Medio — business sì, stack no |
| `ROADMAP.md` | Fasi 0–15, stato dichiarato | Medio |
| `docs/plan.md` | Piano per fasi con spunte di completamento | Basso — claim non verificabili |
| `README.md` | Panoramica e quick start .NET | Basso |
| `CLAUDE.md` | Istruzioni agente per la soluzione .NET | Basso — stack superato |

### 3.2 Requisiti e dominio
| File | Contenuto | Valore residuo |
|---|---|---|
| `docs/01_requisiti.md` | Requisiti funzionali/non funzionali | **Alto** |
| `docs/02_user_stories.md` | User stories | **Alto** |
| `docs/03_domain_model.md` | Modello di dominio, 8 bounded context | **Alto** — indipendente dallo stack |
| `docs/08_cms_bounded_context.md` | Modello del CMS | **Alto** — rilevante per Fase 1 |

### 3.3 Architettura e decisioni
| File | Contenuto | Valore residuo |
|---|---|---|
| `01_decisioni_architetturali.md` | ADR-001…008 consolidate | **Alto** come storia, da rifare per stack |
| `docs/ADRs/001-database-choice.md` | PostgreSQL vs Supabase | Medio |
| `docs/ADRs/002-authentication.md` | JWT | Medio |
| `docs/ADRs/003-file-storage.md` | Azure Blob | Basso — target è S3/MinIO |
| `docs/04_architettura.md`, `06_diagrammi_architettura.md` | Clean Architecture .NET | Basso |
| `docs/10_frontend_react_architecture.md` | Architettura React (pre-Blazor) | **Medio-alto** — torna pertinente |

### 3.4 Migrazione WordPress
| File | Contenuto | Valore residuo |
|---|---|---|
| `docs/07_analisi_wordpress.md` | Plugin, 54 tabelle, mapping WP→CMS | **Alto** |
| `docs/11_wordpress_migration_guide.md` | Guida importer | **Alto** |
| `docs/contenuti-non-importabili.md` | 12 categorie non importabili + statistiche | **Alto** |

### 3.5 Stato e qualità
| File | Contenuto | Valore residuo |
|---|---|---|
| `02_stato_attuale_reale.md` | Audit critico: ~55% reale vs ~92% dichiarato | **Alto** — prova del disallineamento |
| `KNOWN_ISSUES.md` | 6 issue, build test rotta | Medio |
| `docs/PROJECT_COMPLETION_SUMMARY.md`, `PHASE_*_*.md` (7 file) | Report di completamento fasi | **Basso** — claim non verificabili |
| `docs/TESTING.md`, `TEST_AND_COMPLETE.md` | Strategia di test | Medio |
| `docs/SECURITY_CHECKLIST.md` | Checklist sicurezza | Medio |

### 3.6 Deploy e setup
| File | Valore residuo |
|---|---|
| `docs/09_cicd_azure_deployment.md`, `docs/10_azure_deployment.md`, `docs/Azure-Blob-Storage-Implementation.md` | Basso — Azure non è il target dichiarato |
| `docs/12_go_live_checklist.md` | **Medio-alto** — riusabile come base UAT/go-live |
| `03_setup_ambiente.md`, `04_configurazione_servizi.md`, `docs/05_setup.md`, `SETUP_INSTRUCTIONS.md` | Basso |

### 3.7 Materiale operativo — **contiene dati reali**
| File | Natura | Trattamento |
|---|---|---|
| `credenziali.txt` | Credenziali | **Non letto e mai da leggere/stampare** |
| `modelli/Estratto conto corrente_31-03-2025.pdf` | Estratto conto bancario reale | Solo come modello di formato |
| `modelli/MovimentiCC_OnLine_*.csv` | Movimenti bancari reali | Solo come modello di formato |
| `modelli/Prima nota 2023.xlsx` | Prima nota reale | Solo come modello di formato |
| `modelli/ElencoEntrateUsciteAndamento_*.xlsx` | Contabilità reale | Solo come modello di formato |
| `modelli/Rate corso consulenti 2023-2026.xlsx` | Rate corsisti — dati personali | Solo come modello di formato |
| `modelli/Supervisione 2022-2023.xlsx` | Supervisioni — dati particolari | Solo come modello di formato |
| `modelli/mod.d_-_rendiconto_per_cassa-24.03.23.xlsx` | Modello RUNTS ufficiale (vuoto) | Riutilizzabile |
| `modelli/modelli.md`, `ISTRUZIONI_BACKUP.md` | Note | Riutilizzabile |

> Nessuno di questi file è stato aperto nel contenuto, salvo i due `.md` di nota.

## 4. Sorgente WordPress — `source-private/wordpress/` (2.258 file, 326 MB)

| Elemento | Dettaglio |
|---|---|
| `database_backup.sql` | 9,7 MB — **53 tabelle**, prefisso `wp_` |
| `centroamorislaetitia.WordPress.2026-03-04.xml` | 1,9 MB — export WXR ufficiale |
| `wp_export.json` / `wp_export_full.json` / `wp_final_compact.json` | Estrazioni intermedie (378 / 399 / 285 KB) |
| `*.ps1` (7 script) | Script PowerShell di estrazione usati in precedenza |
| `theme/Divi/` | Tema Divi **4.18.0** — nessun child theme |
| `uploads/` | **835 file**, anni 2017–2021 |
| `wordpress_info.txt` | WordPress 6.9, tema Divi, 18 plugin attivi |

## 5. Skill di progetto — `.claude/skills/` (8 skill, già presenti)

`cms-editability-qa`, `deployment-gate`, `grill-me`, `privacy-safe-development`,
`superpowers-phase-planning`, `wordpress-postgres-import`, `wordpress-source-audit`,
`wordpress-visual-parity`.

Tutte allineate al nuovo stack React/Next.js + Node.js + PostgreSQL e al gate di
Fase 1. `grill-me` risulta **installata** come skill locale di progetto.

## 6. Documenti generati in Fase 0

| File | Scopo |
|---|---|
| `docs/discovery/document-index.md` | questo file |
| `docs/discovery/requirements-consolidated.md` | requisiti business consolidati |
| `docs/discovery/decision-register.md` | registro decisioni |
| `docs/discovery/legacy-to-target-mapping.md` | tracciabilità storico → target |
| `docs/discovery/open-questions.md` | decisioni aperte |
| `docs/discovery/phase-plan.md` | piano di fase incrementale |
