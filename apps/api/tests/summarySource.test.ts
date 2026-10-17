import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Forma del testo contata dalla sorgente per l'estratto (D71, DR-155): l'import
 * la scrive, un salvataggio dal CMS che cambia il testo la azzera, così i
 * contenuti scritti dal CMS contano i caratteri come sono. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let contentId: string;

beforeAll(async () => {
  harness = await createHarness('api_forma_estratto');
  signed = await signIn(harness, { area: 'redazione' });
  const creata = await harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'post', slug: 'articolo-con-estratto', title: 'Articolo con estratto' },
  });
  contentId = creata.json().id;
  await harness.db
    .update(schema.contents)
    .set({ contentText: 'Testo importato', summarySource: 'Testo importato &#8217;' })
    .where(eq(schema.contents.id, contentId));
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const summarySource = async () => {
  const [row] = await harness.db
    .select({ value: schema.contents.summarySource })
    .from(schema.contents)
    .where(eq(schema.contents.id, contentId));
  return row?.value;
};

const patch = (payload: Record<string, unknown>) =>
  harness.app.inject({
    method: 'PATCH',
    url: `/contents/${contentId}`,
    headers: signed.writeHeaders,
    payload,
  });

describe('forma del testo per l’estratto (D71)', () => {
  it('un salvataggio con lo stesso testo la conserva', async () => {
    expect(
      (await patch({ title: 'Nuovo titolo', contentText: 'Testo importato' })).statusCode,
    ).toBe(200);
    expect(await summarySource()).toBe('Testo importato &#8217;');
  });

  it('un testo uguale salvo gli spazi la conserva', async () => {
    expect((await patch({ contentText: 'Testo\n  importato' })).statusCode).toBe(200);
    expect(await summarySource()).toBe('Testo importato &#8217;');
  });

  it('un salvataggio che cambia il testo la azzera', async () => {
    expect((await patch({ contentText: 'Testo riscritto dal CMS' })).statusCode).toBe(200);
    expect(await summarySource()).toBeNull();
  });
});
