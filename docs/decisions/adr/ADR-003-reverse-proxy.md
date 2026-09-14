# ADR-003 — Reverse proxy e terminazione TLS

| | |
|---|---|
| **Stato** | **proposta** — in attesa di approvazione dell'utente |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | quale reverse proxy sta davanti alle applicazioni |
| **Origine** | D5, confermata da DR-035; direttiva DR-006 |

---

## 1. Contesto

DR-006 fissa Docker Compose per sviluppo e per il primo rilascio. Davanti ai
container servono: terminazione TLS, instradamento per percorso verso le
applicazioni, **redirect permanenti in volume elevato**, intestazioni di sicurezza,
compressione, cache degli asset statici.

Il volume di redirect non è un dettaglio di questo progetto:

| Regola | Numero | Fonte |
|---|---|---|
| Pagine allegato → file | 169 | `url-matrix.csv`, DR-034 |
| `wpdmpro` → `/download/…` | 4 | 1A §8 |
| Percorsi storici dei media | da ADR-004 | ADR-004 |

Su queste regole la decisione è già presa e va rispettata: **i redirect sono dati,
non configurazione del proxy** — stanno in una tabella e li serve l'applicazione.
Al proxy resta il trasporto. Questo riduce molto il peso della scelta.

Contano invece: TLS automatico, perché il rinnovo dimenticato di un certificato è
il modo più banale di mettere offline un sito sorvegliato da una persona sola; e la
semplicità della configurazione, per lo stesso motivo.

## 2. Opzioni

### Opzione A — Caddy

- **A favore:** HTTPS automatico con Let's Encrypt, rinnovo compreso, senza
  configurazione né cron. `Caddyfile` di poche righe leggibile a distanza di mesi.
  HTTP/2 e HTTP/3 attivi di default. Intestazioni di sicurezza e compressione in
  una direttiva ciascuna.
- **Contro:** ecosistema più piccolo; meno risposte pronte quando qualcosa non
  funziona; la cache è meno configurabile di quella di Nginx.

### Opzione B — Nginx

- **A favore:** onnipresente, documentato ovunque, controllo fine su cache,
  buffer e limiti. Chi mantiene server lo conosce già.
- **Contro:** il TLS richiede Certbot, un montaggio condiviso e un rinnovo
  schedulato: tre pezzi in più da ricordare. La configurazione è più lunga e più
  facile da sbagliare in silenzio.

### Opzione C — Traefik

- **A favore:** si configura dalle etichette dei container, TLS automatico,
  pensato per ambienti dinamici.
- **Contro:** il suo vantaggio è l'orchestrazione dinamica, che qui non esiste: due
  o tre servizi fissi. Introduce concetti — router, middleware, provider — che non
  servono a questo progetto. Configurazione più opaca da leggere a distanza di
  tempo.

## 3. Scelta proposta

**Opzione A — Caddy**, con `Caddyfile` versionato nel repository e certificati su
volume persistente.

Perimetro di competenza del proxy, dichiarato per evitare che cresca:

1. TLS, HTTP/2, HTTP/3, redirect da HTTP a HTTPS.
2. Instradamento: `/` e il sito pubblico verso `apps/web`, `/admin` verso
   `apps/admin`, `/api` verso `apps/api`.
3. Intestazioni di sicurezza comuni: HSTS, `X-Content-Type-Options`,
   `Referrer-Policy`, `X-Frame-Options`, e una **Content-Security-Policy definita in
   Fase 1F**, non prima, perché dipende dai domini esterni che sopravvivranno alla
   parità.
4. Compressione e cache dei soli asset con impronta nel nome.
5. **Nessuna regola di redirect di contenuto**: quelle stanno nel database e le
   serve l'applicazione, così restano modificabili dal CMS (requisito RC-07).

## 4. Alternativa scartata e motivo

**Nginx** è scartato perché il suo vantaggio principale — il controllo fine — qui
non serve, mentre il suo costo principale — la gestione manuale dei certificati —
colpisce esattamente il punto debole del progetto, che è la sorveglianza da parte di
una sola persona. Resta l'alternativa di riferimento se in Fase 1F emergessero
esigenze di cache o di limitazione che Caddy non copre.

**Traefik** è scartato perché risolve un problema di dinamicità che questo
deployment non ha.

## 5. Conseguenze

**Più facile:** mettere in produzione senza procedura di rinnovo dei certificati;
rileggere la configurazione a distanza di mesi.

**Più difficile:** trovare risposte pronte a problemi rari; ottenere politiche di
cache molto articolate.

## 6. Reversibilità

**Alta.** Il proxy non conosce il dominio applicativo. Sostituirlo è riscrivere un
file di configurazione: ore, non giorni. È la meno vincolante delle tre ADR chieste
dall'utente.

## 7. Verifica

In Fase 1F: certificato valido e rinnovo automatico dimostrato; tutte le
intestazioni di sicurezza presenti nella risposta; **nessuna** regola di redirect di
contenuto nel `Caddyfile`; il sito risponde correttamente dopo un riavvio completo
dello stack.
