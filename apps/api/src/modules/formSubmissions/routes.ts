import { paymentUrl } from './payment.js';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { errorResponses } from '../../lib/openapiErrors.js';
import { hashAddress } from '../../lib/crypto.js';
import {
  evaluateSubmissionAttempts,
  numericOption,
  parseDefinitionFields,
  schemaForForm,
} from './service.js';

const submissionBody = z.object({
  /** Una coppia per campo della definizione: l'identificativo è quello della definizione. */
  values: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  /** Campo esca: un invio automatico lo compila, una persona non lo vede (ADR-010 §4.4). */
  honeypot: z.string().max(500).optional().default(''),
  /** Istante di caricamento del form, in millisecondi: la marca temporale minima. */
  startedAt: z.number().int().nullable().optional().default(null),
});

const submissionResponse = z.object({
  ok: z.literal(true),
  confirmationMessage: z.string(),
  payment: z.object({
    required: z.boolean(),
    amount: z.number().nullable(),
    url: z.string().nullable(),
  }),
});

/**
 * `POST /forms/{slug}/submissions` (ADR-010 §4.3): un solo endpoint, convalida
 * generata dalla definizione, scrittura **prima** di qualunque notifica — che
 * in Fase 1E non parte mai (DR-108).
 */
export async function formSubmissionRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/forms/:slug/submissions',
    {
      // Nessuna sessione da proteggere: è una rotta anonima, come l'accesso.
      config: { csrf: false as const },
      schema: {
        tags: ['pubblico'],
        summary: 'Invia una compilazione di un form pubblico, salvata senza email (DR-108)',
        params: z.object({ slug: z.string().min(1).max(200) }),
        body: submissionBody,
        response: { 200: submissionResponse, ...errorResponses(400, 404, 429) },
      },
    },
    async (request, reply) => {
      const [form] = await app.db
        .select({
          id: schema.forms.id,
          title: schema.forms.title,
          definition: schema.forms.definition,
          confirmationMessage: schema.forms.confirmationMessage,
          requiresPayment: schema.forms.requiresPayment,
        })
        .from(schema.forms)
        .where(and(eq(schema.forms.slug, request.params.slug), eq(schema.forms.isActive, true)))
        .limit(1);
      if (!form) return reply.callNotFound();

      // Campo esca compilato: risposta generica, nessuna scrittura (ADR-010 §4.4).
      if (request.body.honeypot.trim() !== '') {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Controlla i dati e riprova.',
            requestId: request.id,
          },
        });
      }
      const minMs = app.config.FORM_SUBMIT_MIN_SECONDS * 1000;
      if (request.body.startedAt === null || Date.now() - request.body.startedAt < minMs) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Controlla i dati e riprova.',
            requestId: request.id,
          },
        });
      }

      const ipHash = hashAddress(request.ip, app.config.IP_HASH_SALT);
      const blocked = await evaluateSubmissionAttempts(app.db, app.config, form.id, ipHash);
      if (blocked) {
        return reply.code(429).send({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Troppi tentativi: riprova più tardi.',
            requestId: request.id,
          },
        });
      }

      const fields = parseDefinitionFields(form.definition);
      const parsed = schemaForForm(fields).safeParse(request.body.values);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Controlla i dati e riprova.',
            requestId: request.id,
            details: parsed.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        });
      }

      await app.db.insert(schema.formSubmissions).values({
        formId: form.id,
        submittedAt: new Date(),
        origin: 'live',
        payload: parsed.data,
        ipHash,
        userAgent:
          typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      });

      const paymentField = fields.find((field) => field.type === 'payment-single');
      const amount = paymentField
        ? (numericOption(paymentField.options, 'amount') ??
          numericOption(paymentField.options, 'price'))
        : null;

      return reply.send({
        ok: true,
        confirmationMessage: form.confirmationMessage ?? 'Richiesta inviata.',
        payment: {
          required: form.requiresPayment,
          amount: form.requiresPayment ? amount : null,
          // Solo dopo l'invio, come nella sorgente: il conto non compare nella pagina.
          url: form.requiresPayment ? paymentUrl(form.definition, amount, form.title) : null,
        },
      });
    },
  );
}
