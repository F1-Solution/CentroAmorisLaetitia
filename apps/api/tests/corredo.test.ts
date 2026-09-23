import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Le tre estensioni del servizio decise nel Round 14: sostituzione del file di
 * un media (DR-074), elenco dei ruoli (DR-075), rifiuto dell'eliminazione di un
 * media citato dentro i blocchi (DR-077).
 *
 * Più il vincolo che la `1D-W9` deve mostrare **fallire**: i ruoli su una voce
 * di menu che non li usa. Il servizio li azzera da sé, quindi il vincolo non si
 * vede mai passando dalle rotte — si verifica scrivendo a database, che è
 * l'unico modo di provare che esiste davvero.
 *
 * Nessun dato reale: file inventati di pochi byte, nomi inventati.
 */

let harness: Harness;
let signed: Signed;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

beforeAll(async () => {
  harness = await createHarness('api_corredo');
  signed = await signIn(harness, { area: 'redazione' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

/** Corpo multipart scritto a mano: il banco di prova non passa da un browser. */
function multipart(fileName: string, mimeType: string, body: Buffer) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `content-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, body, tail]),
    headers: {
      ...signed.writeHeaders,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

async function uploadMedia(fileName: string): Promise<Record<string, string>> {
  const { payload, headers } = multipart(fileName, 'image/png', PNG);
  const response = await harness.app.inject({ method: 'POST', url: '/media', headers, payload });
  expect(response.statusCode).toBe(201);
  return response.json();
}

describe('sostituzione del file di un media (DR-074)', () => {
  it('riscrive sulla stessa chiave: indirizzo e nome non cambiano', async () => {
    const media = await uploadMedia('da-sostituire.png');
    const bigger = Buffer.concat([PNG, PNG]);

    const { payload, headers } = multipart('tutt-altro-nome.png', 'image/png', bigger);
    const response = await harness.app.inject({
      method: 'PUT',
      url: `/media/${media.id}/file`,
      headers,
      payload,
    });

    expect(response.statusCode).toBe(200);
    const updated = response.json();
    expect(updated.publicPath).toBe(media.publicPath);
    expect(updated.fileName).toBe(media.fileName);
    expect(updated.byteSize).toBe(bigger.byteLength);
    // Il file è finito nel bucket sulla chiave di partenza, non su una nuova.
    expect(harness.store.puts.filter((key) => key.endsWith('da-sostituire.png'))).toHaveLength(2);
    expect(harness.store.puts.some((key) => key.includes('tutt-altro-nome.png'))).toBe(false);
  });

  it('rifiuta un file di tipo diverso, perché il nome resta quello', async () => {
    const media = await uploadMedia('resta-png.png');
    const { payload, headers } = multipart('qualunque.pdf', 'application/pdf', PNG);
    const response = await harness.app.inject({
      method: 'PUT',
      url: `/media/${media.id}/file`,
      headers,
      payload,
    });
    expect(response.statusCode).toBe(409);
  });

  it('su un media inesistente risponde 404', async () => {
    const { payload, headers } = multipart('nessuno.png', 'image/png', PNG);
    const response = await harness.app.inject({
      method: 'PUT',
      url: '/media/00000000-0000-4000-8000-000000000000/file',
      headers,
      payload,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('eliminazione di un media citato (DR-077)', () => {
  it('un media citato dentro i blocchi non si elimina, e il messaggio dice da chi', async () => {
    const media = await uploadMedia('citata-nei-blocchi.png');

    const creata = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: {
        type: 'page',
        slug: 'cita-un-media',
        title: 'Pagina che cita un media',
        blocks: {
          schema: 1,
          blocks: [
            {
              type: 'image',
              id: 'b_c17a70000001',
              props: { mediaId: media.id, alt: 'Immagine inventata.' },
              children: [],
            },
          ],
        },
      },
    });
    expect(creata.statusCode).toBe(201);

    const response = await harness.app.inject({
      method: 'DELETE',
      url: `/media/${media.id}`,
      headers: signed.writeHeaders,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.message).toContain('Pagina che cita un media');
  });

  it('un media che nessuno cita si elimina', async () => {
    const media = await uploadMedia('nessuno-la-cita.png');
    const response = await harness.app.inject({
      method: 'DELETE',
      url: `/media/${media.id}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(204);
  });
});

describe('elenco dei ruoli (DR-075)', () => {
  it('restituisce chiave ed etichetta, e nient’altro', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/roles',
      headers: { cookie: signed.cookie },
    });
    expect(response.statusCode).toBe(200);
    const rows = response.json() as Record<string, string>[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['key', 'label']);
  });

  it('senza sessione non risponde', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/roles' });
    expect(response.statusCode).toBe(401);
  });
});

describe('i quattro casi di visibilità di una voce di menu (criterio 1D-32)', () => {
  let menuKey: string;

  beforeAll(async () => {
    const [menu] = await harness.db
      .insert(schema.menus)
      .values({ key: 'prova-visibilita', label: 'Menu di prova' })
      .returning({ key: schema.menus.key });
    if (!menu) throw new Error('menu di prova non creato');
    menuKey = menu.key;
  });

  it('tutti e quattro si impostano dalle rotte', async () => {
    for (const visibility of ['public', 'authenticated', 'roles', 'hidden'] as const) {
      const created = await harness.app.inject({
        method: 'POST',
        url: `/menus/${menuKey}/items`,
        headers: signed.writeHeaders,
        payload: {
          kind: 'custom',
          label: `Voce ${visibility}`,
          url: `/${visibility}/`,
          visibility,
          ...(visibility === 'roles' ? { visibleToRoles: ['editor'] } : {}),
        },
      });
      expect(created.statusCode).toBe(201);
      const row = created.json();
      expect(row.visibility).toBe(visibility);
      expect(row.visibleToRoles).toEqual(visibility === 'roles' ? ['editor'] : []);
    }
  });

  it('cambiando visibilità da «roles» i ruoli si svuotano', async () => {
    const created = await harness.app.inject({
      method: 'POST',
      url: `/menus/${menuKey}/items`,
      headers: signed.writeHeaders,
      payload: {
        kind: 'custom',
        label: 'Da ruoli a pubblica',
        url: '/da-ruoli/',
        visibility: 'roles',
        visibleToRoles: ['editor'],
      },
    });
    const id = created.json().id as string;

    const updated = await harness.app.inject({
      method: 'PATCH',
      url: `/menu-items/${id}`,
      headers: signed.writeHeaders,
      payload: { visibility: 'public' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().visibleToRoles).toEqual([]);
  });

  it('il vincolo del database **fallisce** quando i ruoli non servono', async () => {
    const [menu] = await harness.db
      .select({ id: schema.menus.id })
      .from(schema.menus)
      .where(eq(schema.menus.key, menuKey))
      .limit(1);
    if (!menu) throw new Error('menu di prova non trovato');

    // Si scrive a database di proposito, saltando il servizio: è l'unico modo
    // di vedere il vincolo `menu_items_roles_only_when_needed` rifiutare.
    let refused: unknown = null;
    try {
      await harness.db.insert(schema.menuItems).values({
        menuId: menu.id,
        kind: 'custom',
        label: 'Ruoli dove non servono',
        url: '/vietata/',
        visibility: 'public',
        visibleToRoles: ['editor'],
      });
    } catch (caught) {
      refused = caught;
    }

    // Il nome del vincolo sta nell'errore di PostgreSQL, non nel messaggio che
    // l'ORM costruisce: si legge lì, altrimenti il test passerebbe per un
    // qualunque fallimento della scrittura.
    const cause = (refused as { cause?: { constraint_name?: string } } | null)?.cause;
    expect(cause?.constraint_name).toBe('menu_items_roles_only_when_needed');
  });
});

describe('creazione di un redirect (criterio 1D-34)', () => {
  /** Il corpo che la schermata manda quando si riempiono i due campi e basta. */
  function crea(sourcePath: string, targetPath: string) {
    return harness.app.inject({
      method: 'POST',
      url: '/redirects',
      headers: signed.writeHeaders,
      payload: { sourcePath, targetPath, statusCode: 301, kind: 'exact', note: null },
    });
  }

  it('il corpo che la schermata compone viene accettato', async () => {
    const response = await crea('/indirizzo-vecchio-inventato/', '/indirizzo-nuovo-inventato/');
    expect(response.statusCode).toBe(201);
  });

  it('un percorso senza barra iniziale viene rifiutato, e il rifiuto dice quale campo', async () => {
    const response = await crea('senza-barra', '/qualunque/');
    expect(response.statusCode).toBe(400);

    // È questo elenco che l'interfaccia buttava via fino al 2026-09-23,
    // mostrando «La richiesta non è valida» e nient'altro.
    const corpo = response.json() as { error: { details?: { path: string; message: string }[] } };
    expect(corpo.error.details?.length).toBeGreaterThan(0);
    expect(JSON.stringify(corpo.error.details)).toContain('sourcePath');
  });
});
