import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './_support/harness.js';

/**
 * Invio di un form pubblico (ADR-010 §4.3–§4.5, DR-108): scritto nel database,
 * mai per email in questa fase. Solo dati sintetici.
 */

let h: Harness;
let formId: string;

const past = () => Date.now() - 10_000;

beforeAll(async () => {
  h = await createHarness('amoris_api_form_submissions');
  const [form] = await h.db
    .insert(schema.forms)
    .values({
      slug: 'iscrizione-sintetica',
      title: 'Iscrizione',
      definition: {
        fields: [
          { id: 'nome', type: 'text', label: 'Nome', required: true, order: 0, options: {} },
          { id: 'email', type: 'email', label: 'Email', required: true, order: 1, options: {} },
          {
            id: 'quota',
            type: 'payment-single',
            label: 'Quota',
            required: true,
            order: 2,
            options: { amount: '50' },
          },
        ],
      },
      confirmationMessage: 'Grazie, la tua richiesta è arrivata.',
      requiresPayment: true,
    })
    .returning({ id: schema.forms.id });
  formId = form?.id ?? '';
  await h.db
    .insert(schema.forms)
    .values({ slug: 'disattivo', title: 'Disattivo', definition: {}, isActive: false });
});

afterAll(async () => {
  await h?.teardown();
});

const post = (slug: string, body: unknown) =>
  h.app.inject({ method: 'POST', url: `/forms/${slug}/submissions`, payload: body });

describe('invio di un form pubblico', () => {
  it('scrive la compilazione e risponde con conferma e rimando al pagamento (DR-039)', async () => {
    const response = await post('iscrizione-sintetica', {
      values: { nome: 'Mario Sintetico', email: 'mario@esempio.invalid' },
      honeypot: '',
      startedAt: past(),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.confirmationMessage).toBe('Grazie, la tua richiesta è arrivata.');
    expect(body.payment).toEqual({ required: true, amount: 50, url: null });

    const rows = await h.db
      .select()
      .from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.formId, formId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toEqual({ nome: 'Mario Sintetico', email: 'mario@esempio.invalid' });
    expect(rows[0]?.origin).toBe('live');
    expect(rows[0]?.notifiedAt).toBeNull();

    // Nettezza: rimuove la sola compilazione sintetica appena creata.
    await h.db.delete(schema.formSubmissions).where(eq(schema.formSubmissions.id, rows[0]!.id));
  });

  it('rifiuta un campo obbligatorio mancante, senza scrivere nulla', async () => {
    const response = await post('iscrizione-sintetica', {
      values: { nome: '' },
      honeypot: '',
      startedAt: past(),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('rifiuta un campo esca compilato (ADR-010 §4.4)', async () => {
    const response = await post('iscrizione-sintetica', {
      values: { nome: 'Mario', email: 'mario@esempio.invalid' },
      honeypot: 'sono un robot',
      startedAt: past(),
    });
    expect(response.statusCode).toBe(400);
  });

  it('rifiuta un invio più veloce della marca temporale minima', async () => {
    const response = await post('iscrizione-sintetica', {
      values: { nome: 'Mario', email: 'mario@esempio.invalid' },
      honeypot: '',
      startedAt: Date.now(),
    });
    expect(response.statusCode).toBe(400);
  });

  it('limita i tentativi per indirizzo IP e per form (ADR-010 §4.4)', async () => {
    for (let i = 0; i < 5; i += 1) {
      await post('iscrizione-sintetica', {
        values: { nome: `Mario ${i}`, email: 'mario@esempio.invalid' },
        honeypot: '',
        startedAt: past(),
      });
    }
    const response = await post('iscrizione-sintetica', {
      values: { nome: 'Mario', email: 'mario@esempio.invalid' },
      honeypot: '',
      startedAt: past(),
    });
    expect(response.statusCode).toBe(429);
    await h.db.delete(schema.formSubmissions).where(eq(schema.formSubmissions.formId, formId));
  });

  it('prova negativa: un form inesistente o disattivato risponde 404', async () => {
    expect((await post('non-esiste', { values: {} })).statusCode).toBe(404);
    expect((await post('disattivo', { values: {} })).statusCode).toBe(404);
  });
});
