/**
 * Seme **sintetico** per provare l'area amministrativa su una macchina locale.
 *
 * Esiste per una ragione dichiarata: i criteri 1D-31…1D-35 si eseguono
 * nell'applicazione avviata, e un database vuoto non ha nulla da modificare —
 * niente media da sostituire, nessuna voce di menu da annidare, nessun redirect
 * da spegnere. Questo comando mette a terra il minimo che serve per provarli
 * davvero.
 *
 * **Nessun dato reale, per nulla.** Persone, contenuti, indirizzi e file sono
 * inventati; gli indirizzi di posta usano il dominio riservato `.invalid`, che
 * per definizione non esiste. `CLAUDE.md` lo impone e qui non ci sono
 * eccezioni.
 *
 * **Non scrive dove c'è il sito vero.** Se il database porta i segni di
 * un'importazione — una esecuzione registrata, o un contenuto con il suo
 * identificativo di origine — il comando si ferma senza toccare nulla: un seme
 * di prova sopra i contenuti importati sarebbe un danno silenzioso.
 *
 * La password non si inventa qui e non si stampa: arriva da `SEED_PASSWORD` e
 * resta fuori dal registro e da questo file.
 *
 *     SEED_PASSWORD=... pnpm db:seed
 */
import { createDatabase, schema } from '@amoris/db';
import { count, isNotNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { ALL_PERMISSIONS } from '../src/auth/permissions.js';
import { hashPassword } from '../src/lib/password.js';

const SYNTHETIC_EMAIL = 'redazione@esempio.invalid';

/** Un PNG di un pixel: basta a esistere come file, e non raffigura nulla. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) {
  fail(
    'SEED_PASSWORD non è impostata, o è più corta di 12 caratteri.\n' +
      'Scegline una a piacere: vale solo per questo database locale, e non viene stampata.',
  );
}

const config = loadConfig(process.env as Record<string, string | undefined>);
if (config.NODE_ENV === 'production') {
  fail('Il seme sintetico non si esegue con NODE_ENV=production.');
}

const { db, close } = createDatabase({ url: config.DATABASE_URL, maxConnections: 1 });

try {
  const [runs] = await db.select({ value: count() }).from(schema.importRuns);
  const [imported] = await db
    .select({ value: count() })
    .from(schema.contents)
    .where(isNotNull(schema.contents.legacyId));
  if ((runs?.value ?? 0) > 0 || (imported?.value ?? 0) > 0) {
    fail(
      'Questo database porta i segni di un’importazione: il seme sintetico non ci scrive sopra.\n' +
        'Usa un database vuoto, oppure ricrealo con `pnpm compose:reset` e `pnpm db:migrate`.',
    );
  }

  const [existing] = await db.select({ value: count() }).from(schema.users);
  if ((existing?.value ?? 0) > 0) {
    fail('Ci sono già delle persone a database: il seme sintetico si esegue una volta sola.');
  }

  /**
   * Tutto in una transazione: un seme che fallisce a metà lascerebbe righe
   * scritte e il controllo «si esegue una volta sola» mentirebbe alla prova
   * successiva. È la stessa regola che l'importer applica a ogni fase.
   */
  await db.transaction(async (tx) => {
    // --- Ruoli, permessi, persona -------------------------------------------
    const roles = await tx
      .insert(schema.roles)
      .values([
        { key: 'redazione', label: 'Redazione', isSystem: true },
        { key: 'segreteria', label: 'Segreteria', isSystem: false },
      ])
      .returning({ id: schema.roles.id, key: schema.roles.key });
    const redazione = roles.find((role) => role.key === 'redazione');
    if (!redazione) throw new Error('ruolo di redazione non creato');

    await tx.insert(schema.permissions).values(ALL_PERMISSIONS.map((key) => ({ key, label: key })));
    await tx
      .insert(schema.rolePermissions)
      .values(ALL_PERMISSIONS.map((key) => ({ roleId: redazione.id, permissionKey: key })));

    const [person] = await tx
      .insert(schema.users)
      .values({
        email: SYNTHETIC_EMAIL,
        fullName: 'Redazione di prova',
        passwordHash: await hashPassword(password, config),
      })
      .returning({ id: schema.users.id });
    if (!person) throw new Error('persona di prova non creata');
    await tx.insert(schema.userRoles).values({ userId: person.id, roleId: redazione.id });

    // --- Impostazioni globali (criterio 1D-35) --------------------------------
    await tx.insert(schema.settings).values([
      { key: 'site.title', value: 'Sito di prova', label: 'Titolo del sito' },
      {
        key: 'site.description',
        value: 'Un sito inventato per provare l’area amministrativa.',
        label: 'Descrizione del sito',
      },
      { key: 'content.posts_per_page', value: 10, label: 'Articoli per pagina' },
      { key: 'seo.sitemap_enabled', value: true, label: 'Sitemap attiva' },
      {
        key: 'seo.robots_txt',
        value: 'User-agent: *\nDisallow:\n',
        label: 'Contenuto di robots.txt',
      },
      {
        key: 'analytics.ga4_measurement_id',
        // `settings.value` è `jsonb NOT NULL`: il `null` da scrivere è il **valore
        // JSON** `null`, non l'assenza di valore, e va detto in SQL.
        value: sql`'null'::jsonb`,
        label: 'Identificativo di misurazione GA4',
        isSecret: true,
      },
    ]);

    // --- Template SEO globali (criterio 1D-33) --------------------------------
    await tx.insert(schema.seoTemplates).values([
      { scope: 'home', titleTemplate: '{site_title}' },
      { scope: 'page', titleTemplate: '{title} - {site_title}' },
      { scope: 'post', titleTemplate: '{title} - {site_title}' },
      { scope: 'category', titleTemplate: '{term_title} - {site_title}' },
    ]);

    // --- Media (criterio 1D-31) ----------------------------------------------
    const mediaRows = await tx
      .insert(schema.media)
      .values(
        ['immagine-di-prova.png', 'seconda-immagine-di-prova.png'].map((fileName) => ({
          storageKey: `2026/01/${fileName}`,
          publicPath: `/media/2026/01/${fileName}`,
          fileName,
          mimeType: 'image/png',
          byteSize: ONE_PIXEL_PNG.byteLength,
          checksum: createHash('sha256').update(ONE_PIXEL_PNG).digest(),
          title: fileName === 'immagine-di-prova.png' ? 'Immagine di prova' : 'Seconda immagine',
          altText: 'Un quadrato di un solo pixel, senza soggetto.',
          uploadedAt: new Date(),
          uploadedBy: person.id,
        })),
      )
      .returning({ id: schema.media.id, fileName: schema.media.fileName });
    const citedMedia = mediaRows[0];
    if (!citedMedia) throw new Error('media di prova non creati');

    // --- Tassonomia ------------------------------------------------------------
    const [term] = await tx
      .insert(schema.terms)
      .values({
        taxonomy: 'category',
        slug: 'avvisi',
        name: 'Avvisi',
        path: '/categoria/avvisi/',
      })
      .returning({ id: schema.terms.id });
    if (!term) throw new Error('categoria di prova non creata');

    // --- Contenuti -------------------------------------------------------------
    // La pagina cita il primo media dentro i blocchi: è ciò che rende osservabile
    // il rifiuto di eliminazione di DR-077, che altrimenti non si proverebbe.
    const pageBlocks = {
      schema: 1,
      blocks: [
        {
          type: 'image',
          id: 'b_5e6d00000001',
          /**
           * Le proprietà sono **quelle che lo schema di `packages/blocks`
           * dichiara**, e solo quelle: lo schema è `strict`. Al primo tentativo
           * qui c'erano `linkHref`, `linkTarget` e `variant: 'full'` — due nomi
           * inesistenti e un valore fuori formato — e il documento entrava lo
           * stesso a database, perché il servizio non guarda dentro. L'editor
           * poi si rifiutava di aprirlo, ed era l'unico a dirlo.
           */
          props: {
            mediaId: citedMedia.id,
            src: null,
            alt: 'Un quadrato di un solo pixel, senza soggetto.',
            caption: null,
            linkUrl: null,
            linkNewWindow: false,
            variant: null,
            classes: [],
          },
          children: [],
        },
      ],
    };

    const contents = await tx
      .insert(schema.contents)
      .values([
        {
          type: 'page' as const,
          status: 'published' as const,
          slug: 'pagina-di-prova',
          path: '/pagina-di-prova/',
          title: 'Pagina di prova',
          blocks: pageBlocks,
          publishedAt: new Date(),
          authorId: person.id,
        },
        {
          type: 'post' as const,
          status: 'draft' as const,
          slug: 'notizia-di-prova',
          path: '/notizia-di-prova/',
          title: 'Notizia di prova',
          authorId: person.id,
        },
      ])
      .returning({ id: schema.contents.id, slug: schema.contents.slug });
    const page = contents.find((row) => row.slug === 'pagina-di-prova');
    if (!page) throw new Error('pagina di prova non creata');

    // --- Menu con i quattro casi di visibilità (criterio 1D-32) ----------------
    const [menu] = await tx
      .insert(schema.menus)
      .values({ key: 'principale', label: 'Menu principale' })
      .returning({ id: schema.menus.id });
    if (!menu) throw new Error('menu di prova non creato');

    const [rootItem] = await tx
      .insert(schema.menuItems)
      .values({
        menuId: menu.id,
        position: 0,
        kind: 'content' as const,
        label: 'Pagina di prova',
        contentId: page.id,
        visibility: 'public' as const,
      })
      .returning({ id: schema.menuItems.id });
    if (!rootItem) throw new Error('voce di menu non creata');

    await tx.insert(schema.menuItems).values([
      {
        menuId: menu.id,
        parentId: rootItem.id,
        position: 0,
        kind: 'custom' as const,
        label: 'Riservata a chi è entrato',
        url: '/area-riservata/',
        visibility: 'authenticated' as const,
      },
      {
        menuId: menu.id,
        position: 1,
        kind: 'term' as const,
        label: 'Avvisi',
        termId: term.id,
        visibility: 'roles' as const,
        visibleToRoles: ['redazione'],
      },
      {
        menuId: menu.id,
        position: 2,
        kind: 'custom' as const,
        label: 'Voce nascosta',
        url: '/nascosta/',
        visibility: 'hidden' as const,
      },
    ]);

    // --- Redirect (criterio 1D-34) --------------------------------------------
    await tx.insert(schema.redirects).values([
      {
        sourcePath: '/vecchia-pagina/',
        targetPath: '/pagina-di-prova/',
        statusCode: 301,
        origin: 'migration' as const,
        note: 'Indirizzo storico inventato, per provare la schermata.',
      },
      {
        sourcePath: '/vecchia-sezione/',
        targetPath: '/pagina-di-prova/',
        statusCode: 302,
        kind: 'prefix' as const,
        origin: 'manual' as const,
        isActive: false,
      },
    ]);

  });

  console.error(
    [
      'Seme sintetico scritto.',
      `Persona: ${SYNTHETIC_EMAIL} — la password è quella che hai passato in SEED_PASSWORD.`,
      'Ruolo: Redazione, con tutti e cinque i permessi.',
      'Dentro: 2 media, 2 contenuti, 1 categoria, 1 menu con i quattro casi di visibilità,',
      '2 redirect, 6 impostazioni, 4 template SEO.',
      'I file dei media non sono nell’archivio a oggetti: le righe sì, i byte no.',
    ].join('\n'),
  );
} catch (error) {
  console.error('Seme non scritto:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await close();
}
