# @amoris/api

Servizio API. Framework scelto da
[ADR-001](../../docs/decisions/adr/ADR-001-framework-api.md): **Fastify**, con Zod
come unica fonte di verità per validazione, tipi TypeScript e specifica OpenAPI.

## Che cosa c'è, in Fase 1C

Solo l'impalcatura. Le rotte di dominio — contenuti, media, menu, SEO, redirect,
impostazioni, autenticazione — nascono in Fase 1D, **un modulo per dominio** come
impone ADR-001 §3.

| Endpoint | Che cosa risponde |
|---|---|
| `GET /health/live` | Il processo è vivo. Non interroga nulla. Risponde sempre `200` |
| `GET /health/ready` | Il servizio può lavorare. Interroga il database. `503` quando non è raggiungibile |
| `GET /openapi.json` | La specifica, generata dagli schemi delle rotte |

Due endpoint distinti e non uno perché rispondono a due domande diverse: `live`
serve a chi decide se **riavviare** il processo, `ready` a chi decide se mandargli
**traffico**. Confonderli significa riavviare un servizio sano perché il database
è lento.

## Configurazione

Tutte le variabili sono validate all'avvio (ADR-009 §4.3). L'unica senza valore
predefinito è `DATABASE_URL`: senza database non c'è servizio. Se manca, il
processo **non parte**, dice quale variabile manca ed esce con codice `78`.

## Regole che valgono anche quando arriveranno le rotte vere

1. **Un modulo per dominio**, ciascuno con rotte, schemi e servizi propri.
2. **Nessun accesso al database dalle rotte**: solo attraverso i servizi del
   dominio. In questa fase la regola è già rispettata: la verifica di raggiungibilità
   sta in `@amoris/db`, non qui.
3. **Un hook unico** scriverà il registro delle operazioni per ogni richiesta che
   modifica dati (RU-05, RN-03).
4. La specifica OpenAPI **nasce dagli schemi**: non è scritta a mano e non può
   divergere dal codice.

## Cosa non fa, di proposito

- **Non esegue migrazioni all'avvio.** Sono un passo esplicito del rilascio
  (ADR-009 §4.4): un servizio che migra all'avvio, riavviato più volte, migra in
  parallelo.
- **Non imposta le intestazioni di sicurezza**: sono compito del reverse proxy
  (ADR-003 §3 punto 3), e la Content-Security-Policy si definisce in Fase 1F,
  quando si sa quali domini esterni sopravvivono alla parità.
- **Non fa uscire dettagli interni negli errori**: sopra il `500` il messaggio è
  generico e il dettaglio resta nei log, insieme all'identificativo della
  richiesta che il chiamante può citare.
