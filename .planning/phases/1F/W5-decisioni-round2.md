# 1F-W5 — Decisioni D300…D305 del secondo round

Round del 2026-11-13. È stato aperto con `grill-with-ui`, ma la pagina non ha ricevuto invii;
le risposte sono arrivate in chat con `grill-me`. Cinque decisioni del [`W5-PLAN.md`](W5-PLAN.md) §4
sono prese e registrate come DR-437…DR-441 in `docs/decisions/decision-register.md`, tutte uguali
alla raccomandazione. D303, chiesta a parte lo stesso giorno, è registrata come DR-442, anch'essa
uguale alla raccomandazione.

## Termini

| Termine | Definizione | Da evitare |
|---|---|---|
| ingresso | il Caddy comune che, unico, pubblica 80 e 443 e inoltra per nome ai Caddy dei due ambienti (DR-409) | reverse proxy generico, edge |
| sotto-account | utente secondario della Storage Box Hetzner che vede solo la propria cartella | utente secondario |
| istantanea | copia della Storage Box fatta dal fornitore, fuori dalla portata del server | snapshot restic, backup |

## Perché

Chiudere le decisioni che bloccano la T6: indurimento del server (HO-062), DNS dello staging
(HO-063), accessi e istantanee della Storage Box (HO-058, HO-059), separazione dello staging.

## Decisioni durature

| id | DR | Decisione | Scartate e perché |
|---|---|---|---|
| D301 | DR-438 | **A** — sotto-account limitato alla cartella del repository per il server; utente principale solo nel gestore di password; istantanee giornaliere, 10 tenute | B (settimanali, 5 tenute): granularità di una settimana e copie fino a 35 giorni; C (nessuna istantanea): R12 resta aperto |
| D303 | DR-442 | **A** — HSTS lungo dopo la verifica di HTTPS della produzione nella W8; violazioni della CSP raccolte sullo staging con i contenuti veri nella W7; CSP applicata solo con zero violazioni | B (tutto come oggi per la Fase 1): R20 e R21 restano aperti; C (raccolta delle segnalazioni): codice nuovo |
| D305 | DR-441 | **A** — solo record A nella W5; IPv6 rivalutato nella W8 con una prova sul server | B (IPv6 sulla rete `edge` subito): lavoro non provabile in locale; C (AAAA con conteggio comune): riapre N1 |

## Scelte ordinarie

- D300 → DR-437: **A** — aggiornamenti di sicurezza automatici e riavvio automatico di notte quando
  richiesto, dopo il backup, con verifica del ritorno di servizi, firewall e timer.
- D302 → DR-439: **A** — staging acceso solo per prove e rilasci, limiti di memoria dichiarati al
  Centro, scelta rivista dopo la misura della T9.
- D304 → DR-440: **A** — `staging.centroamorislaetitia.it`.

## Fatti verificati

Il 2026-11-13, in sola lettura:

- DNS pubblico del dominio: nameserver di Aruba (`dns.technorail.com`, `dns2.technorail.com`,
  `dns3.arubadns.net`, `dns4.arubadns.cz`); `staging` non esiste; nessun record jolly; nessun
  record CAA, quindi Let's Encrypt è ammesso; `www` ha oggi A e AAAA, con TTL 3600.
- Ubuntu 24.04 ha `unattended-upgrades` preinstallato; il riavvio automatico si attiva con
  `Unattended-Upgrade::Automatic-Reboot`.
- README §7: con l'ingresso la memoria arriva esattamente a 7168 MiB; DR-439 la alleggerisce
  quando lo staging è spento.

## Rischi

- **DR-437:** pochi minuti di fermo notturno; un servizio che non torna dopo il riavvio resta
  fermo fino al controllo. Mitigazione: verifica del ritorno (HO-062 §8) e prova di riavvio nella
  T9; il timer del backup (T8) deve finire prima della finestra di riavvio.
- **DR-438:** la password dell'utente principale è l'unica via per cancellare le istantanee: se si
  perde, si recupera solo dal pannello di Hetzner.
- **DR-441:** lo staging non risponde ai client solo IPv6.

## Rinviate

- Revisione di HO-059 e HO-058 per DR-438: nella T8, prima delle chiavi del backup.

## Discussioni aperte

Nessuna.
