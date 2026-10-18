# Decisioni sulle difformità dei metadati M1-M8 e sull'accesso al CMS

Decise dall'utente il 2026-10-17 (wave `1E-W7`, dopo la T1), registrate come
**DR-170…178** in `docs/decisions/decision-register.md`. Tutte le raccomandazioni
sono state accettate. Le correzioni si attuano nella T7 con il metodo della
`1E-W6`: analisi d'impatto approvata, prove, `lint`/`typecheck`/`test` verdi.
Nessuna è attuata in questo documento.

## Termini

| Termine | Definizione | Da evitare |
|---|---|---|
| difformità | Differenza fra sito nuovo e sorgente non coperta da DR-040; va accettata o corretta | bug, errore |
| riferimento | Istanza WordPress congelata su `localhost:8088` e `seo-rendered-baseline.csv` | vecchio sito |

## Perché

La T1 ha trovato 114 URL su 117 con almeno un campo difforme, raggruppati in 8
famiglie (`riepilogo.md` §1.3). Le scelte servivano prima di eseguire T3-T6.
L'utente ha anche chiesto che l'accesso al CMS sia `/admin` e non `/wp-admin/`.

## Decisioni bloccate (difficili da invertire)

| DR | Voce | Decisione | Opzioni scartate e motivo |
|---|---|---|---|
| DR-170 | M1 dati strutturati | **A** — JSON-LD equivalente alla sorgente (WebSite, Organization, WebPage, BreadcrumbList, BlogPosting/Article, ImageObject secondo il tipo), dati dell'organizzazione dalle impostazioni del CMS | B (minimo, senza briciole): perde segnali SEO della sorgente; C (nessuno): perde tutto |
| DR-173 | M4 description diversa | **C** — description dei metadati ricavata dal testo come la sorgente, ignorando l'estratto manuale; negli elenchi l'estratto resta com'è; normalizzazione di spazi, entità ed emoji per i 7 casi minori | A (anche negli elenchi): romperebbe viste già accettate (DR-162); B (solo segnalazione al redattore): lascia pubblico il testo di un altro evento |
| DR-178 | Accesso al CMS | **A** — il CMS resta su `/admin` (login `/admin/accesso`); `/wp-admin/` e `/wp-login.php` rispondono 404 | B (301 al login): espone il login ai bot che sondano i percorsi WordPress; C (301 temporaneo): rimanda la stessa scelta |

## Scelte ordinarie

- **DR-171 · M2** — taglio a 160 caratteri con «…» mantenuto; difformità registrata come correzione voluta (estensione di DR-040).
- **DR-172 · M3** — nei metadati (title, description, `og:*`, titolo del feed) apici e lineette dritti come la sorgente; tipografici solo nel corpo.
- **DR-174 · M5** — variabili del plugin SEO (`#post_title`, `#separator_sa`, `#site_title`…) tradotte all'import; title corretto (DR-040). Richiede un import, solo su conferma.
- **DR-175 · M6** — pagine 2 e 3 dell'archivio: canonical autoreferenziale e indicizzabili, registrato come correzione DR-040.
- **DR-176 · M7** — `robots.txt`: `Disallow: /admin` più la riga `Sitemap:` con l'URL assoluto di `/sitemap.xml`; nessuna regola sui percorsi WordPress.
- **DR-177 · M8** — sitemap unica con i 5 percorsi mancanti (`/download/<slug>/` ×4, `/download-category/moduli-consulenze/`): 113/113.

## Fatti verificati

- `apps/admin/next.config.ts` ha `basePath: '/admin'`; Caddy instrada `/admin*`; `apps/web/src/app/robots.ts` esclude `/admin`.
- `/wp-admin/` risponde oggi 404 sul sito nuovo (T2).
- La description generata dal sito viene da `fallbackDescription` dell'API: estratto, altrimenti testo, taglio a 160 caratteri.
- Sui due URL di M4 il sito mostra il testo di un convegno del 2022. L'ipotesi è un estratto manuale copiato da un articolo precedente; si verifica nell'analisi d'impatto della T7.

## Rischi

- M5 richiede un import: va confermato a parte, con backup e ripristino.
- M4 cambia la regola dei metadati e non quella degli elenchi: le prove devono coprire entrambe le strade.
- M1 aggiunge `<script type="application/ld+json">` alle pagine: va controllato che non cambi la resa e che la verifica della console (T5) resti a zero.

## Rinviate · discussioni aperte

Nessuna.
