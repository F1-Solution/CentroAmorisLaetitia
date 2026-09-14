# Ambiente locale in container

Forma da [ADR-009](../../docs/decisions/adr/ADR-009-hosting-e-deployment.md) §4.1,
storage da DR-005, instradamento da
[ADR-003](../../docs/decisions/adr/ADR-003-reverse-proxy.md).

## Cosa gira qui dentro

| Servizio | Ruolo | Dati |
|---|---|---|
| `db` | PostgreSQL 17, collazione italiana | volume `db-data` |
| `objects` | MinIO, storage S3-compatible | volume `objects-data` |
| `objects-init` | crea i due bucket e termina | — |
| `caddy` | reverse proxy, **solo con il profilo `proxy`** | volumi dei certificati |

Le tre applicazioni **non** stanno qui: in sviluppo girano sulla macchina con
`pnpm dev`, perché il ricaricamento a caldo vale più della somiglianza con la
produzione. In Fase 1F ci entreranno anche loro.

## Comandi

```bash
pnpm compose:up      # avvia db e objects
pnpm compose:down    # ferma tutto, i dati restano
pnpm compose:reset   # ferma tutto e DISTRUGGE i dati locali
```

Per provare l'instradamento del proxy:

```bash
docker compose -f infra/compose/docker-compose.yml --env-file .env --profile proxy up -d
```

e poi `http://localhost:8080`, che serve il sito, `/admin` e `/api` dalle tre
applicazioni in esecuzione sulla macchina.

## I due bucket

`media-public` e `media-private` nascono entrambi **senza accesso anonimo**, anche
quello che si chiama «public». Non è una svista: ADR-004 §3.6 stabilisce che i file
li serve l'applicazione con uno stream, così che il controllo di accesso resti in un
punto solo e valga anche quando arriveranno i permessi per documento. Il nome
distingue il contenuto, non il modo di accedervi.

## Le credenziali

Quelle di `.env.example` sono di un ambiente usa e getta sulla tua macchina. In
produzione non se ne riusa nessuna, e `.env` non entra mai in Git.
