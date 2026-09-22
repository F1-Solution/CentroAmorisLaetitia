import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { roleSchema } from './schemas.js';
import { list } from './service.js';

/**
 * Modulo `roles`, di sola lettura (DR-075).
 *
 * Esiste per un uso solo: il caso `roles` della visibilità di una voce di menu
 * conserva **chiavi** di ruolo, e senza questo elenco l'interfaccia dovrebbe
 * farle digitare a mano — un'autorizzazione che dipende da una stringa scritta
 * giusta, dove l'errore di battitura non produce alcun errore ma una voce
 * invisibile a tutti.
 *
 * Nessun permesso nuovo: ADR-007 §3.2 ne fissa cinque e questa è una lettura
 * come le altre dei moduli di Redazione. Non escono né persone né permessi:
 * solo la chiave e l'etichetta del ruolo.
 */
export async function roleRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/roles',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['ruoli'],
        summary: 'Elenca chiave ed etichetta dei ruoli',
        response: { 200: z.array(roleSchema), ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send(await list(app.db)),
  );
}
