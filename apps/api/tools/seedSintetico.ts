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
import {
  blockDocumentSchema,
  extractContentText,
  serializeBlockDocument,
} from '@amoris/blocks/model';
import { createDatabase, schema } from '@amoris/db';
import { count, eq, isNotNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { hashPassword } from '../src/lib/password.js';
import { createObjectStore } from '../src/lib/objectStore.js';
import { buildPdf } from '../tests/_support/syntheticFiles.js';

const SYNTHETIC_EMAIL = 'redazione@esempio.invalid';
const ADMINISTRATION_EMAIL = 'amministrazione@esempio.invalid';
const BOTH_ROLES_EMAIL = 'entrambi@esempio.invalid';

/** I cinque permessi storici del ruolo `editor`. */
const EDITOR_PERMISSIONS = [
  PERMISSIONS.contentRead,
  PERMISSIONS.contentWrite,
  PERMISSIONS.contentPublish,
  PERMISSIONS.mediaWrite,
  PERMISSIONS.settingsWrite,
] as const;

/** Un PNG di un pixel: basta a esistere come file, e non raffigura nulla. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** I due documenti sintetici: ognuno ha il suo PDF generato, e quello riservato ha il file nel bucket privato. */
const DOCUMENT_SEEDS = [
  {
    slug: 'documento-di-prova-pubblico',
    title: 'Documento di prova pubblico',
    description: 'Un documento inventato, per provare la schermata dei documenti.',
    fileName: 'documento-di-prova-pubblico.pdf',
    visibleText: 'documento sintetico pubblico',
    isPrivate: false,
  },
  {
    slug: 'documento-di-prova-riservato',
    title: 'Documento di prova riservato',
    description: null,
    fileName: 'documento-di-prova-riservato.pdf',
    visibleText: 'documento sintetico riservato',
    isPrivate: true,
  },
] as const;

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

const store = createObjectStore(config);
const documentFiles: { bucket: string; key: string; body: Buffer }[] = [];

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
    // --- Ruoli, permessi, persone ---------------------------------------------
    // Permessi e ruolo `amministrazione` arrivano dalla migrazione (DR-227).
    const roles = await tx
      .insert(schema.roles)
      .values([
        { key: 'editor', label: 'Redazione', isSystem: true },
        { key: 'segreteria', label: 'Segreteria', isSystem: false },
      ])
      .returning({ id: schema.roles.id, key: schema.roles.key });
    const editor = roles.find((role) => role.key === 'editor');
    if (!editor) throw new Error('ruolo di redazione non creato');
    const [administration] = await tx
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.key, 'amministrazione'));
    if (!administration) throw new Error('ruolo amministrazione assente: applica le migrazioni');

    await tx
      .insert(schema.rolePermissions)
      .values(EDITOR_PERMISSIONS.map((key) => ({ roleId: editor.id, permissionKey: key })));

    const passwordHash = await hashPassword(password, config);
    const people = await tx
      .insert(schema.users)
      .values([
        { email: SYNTHETIC_EMAIL, fullName: 'Redazione di prova', passwordHash },
        { email: ADMINISTRATION_EMAIL, fullName: 'Amministrazione di prova', passwordHash },
        { email: BOTH_ROLES_EMAIL, fullName: 'Persona con due ruoli di prova', passwordHash },
      ])
      .returning({ id: schema.users.id, email: schema.users.email });
    const person = people.find((entry) => entry.email === SYNTHETIC_EMAIL);
    const administrator = people.find((entry) => entry.email === ADMINISTRATION_EMAIL);
    const both = people.find((entry) => entry.email === BOTH_ROLES_EMAIL);
    if (!person || !administrator || !both) throw new Error('persone di prova non create');
    await tx.insert(schema.userRoles).values([
      { userId: person.id, roleId: editor.id },
      { userId: administrator.id, roleId: administration.id },
      { userId: both.id, roleId: editor.id },
      { userId: both.id, roleId: administration.id },
    ]);

    // --- Impostazioni globali (criterio 1D-35) --------------------------------
    await tx.insert(schema.settings).values([
      { key: 'site.title', value: 'Sito di prova', label: 'Titolo del sito' },
      {
        key: 'site.description',
        value: 'Un sito inventato per provare l’area amministrativa.',
        label: 'Descrizione del sito',
      },
      // DR-270: i valori generali di WordPress, che il sito legge.
      { key: 'site.locale', value: 'it_IT', label: 'Lingua del sito' },
      { key: 'site.timezone', value: 'Europe/Rome', label: 'Fuso orario' },
      { key: 'site.date_format', value: 'j F Y', label: 'Formato data' },
      { key: 'site.time_format', value: 'G:i', label: 'Formato ora' },
      { key: 'site.start_of_week', value: 1, label: 'Primo giorno della settimana' },
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

    // --- Documenti e carosello sintetici (1G-W6) ---------------------------------
    const documentMedia = await tx
      .insert(schema.media)
      .values(
        DOCUMENT_SEEDS.map((seed) => {
          const body = buildPdf({ pages: 1, visibleText: seed.visibleText });
          const storageKey = `prova-sintetica/${seed.fileName}`;
          documentFiles.push({
            bucket: seed.isPrivate ? store.privateBucket : store.publicBucket,
            key: storageKey,
            body,
          });
          return {
            storageKey,
            publicPath: `/media/${storageKey}`,
            fileName: seed.fileName,
            mimeType: 'application/pdf',
            byteSize: body.byteLength,
            checksum: createHash('sha256').update(body).digest(),
            title: seed.title,
            isPrivate: seed.isPrivate,
            uploadedAt: new Date(),
            uploadedBy: person.id,
          };
        }),
      )
      .returning({ id: schema.media.id, fileName: schema.media.fileName });

    const [downloadCategory] = await tx
      .insert(schema.terms)
      .values({
        taxonomy: 'wpdmcategory',
        slug: 'moduli-di-prova',
        name: 'Moduli di prova',
        path: '/download-category/moduli-di-prova/',
      })
      .returning({ id: schema.terms.id });
    if (!downloadCategory) throw new Error('categoria dei download non creata');

    const seededDocuments = await tx
      .insert(schema.documents)
      .values(
        DOCUMENT_SEEDS.map((seed) => {
          const file = documentMedia.find((row) => row.fileName === seed.fileName);
          if (!file) throw new Error('file del documento di prova non creato');
          return {
            slug: seed.slug,
            title: seed.title,
            description: seed.description,
            mediaId: file.id,
            isPrivate: seed.isPrivate,
            publishedAt: new Date('2026-01-05T10:00:00Z'),
          };
        }),
      )
      .returning({ id: schema.documents.id, slug: schema.documents.slug });
    const publicDocument = seededDocuments.find((row) => row.slug === DOCUMENT_SEEDS[0].slug);
    if (!publicDocument) throw new Error('documento pubblico di prova non creato');
    await tx
      .insert(schema.documentTerms)
      .values({ documentId: publicDocument.id, termId: downloadCategory.id });

    const [slider] = await tx
      .insert(schema.sliders)
      .values({ key: 'carosello-di-prova', title: 'Carosello di prova' })
      .returning({ id: schema.sliders.id });
    if (!slider) throw new Error('carosello di prova non creato');
    const [firstImage, secondImage] = mediaRows;
    if (!firstImage || !secondImage) throw new Error('media del carosello non creati');
    await tx.insert(schema.sliderSlides).values(
      [
        [firstImage.id, 'Prima slide di prova'],
        [secondImage.id, 'Seconda slide di prova'],
        [firstImage.id, 'Terza slide di prova'],
      ].map(([mediaId, heading], position) => ({
        sliderId: slider.id,
        position: position + 1,
        mediaId: mediaId ?? null,
        heading: heading ?? null,
      })),
    );

    // --- Tassonomia ------------------------------------------------------------
    const [term] = await tx
      .insert(schema.terms)
      .values({
        taxonomy: 'category',
        slug: 'avvisi',
        name: 'Avvisi',
        path: '/category/avvisi/',
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

    /**
     * Il documento passa dallo **schema** e l'HTML si **deriva dai blocchi**.
     * Due cose, un motivo solo: un contenuto a cui manchino le proprietà
     * predefinite, o il cui HTML non corrisponda ai propri blocchi, non è in
     * forma canonica. Aprirlo nell'editor e premere «Salva» lo riscriverebbe,
     * e il criterio 1D-36 risulterebbe violato da un difetto del seme invece
     * che da un difetto del prodotto. Trovato dalle prove end-to-end della
     * wave `1D-W10`.
     */
    const pageDocument = blockDocumentSchema.parse(pageBlocks);
    const pageHtml = serializeBlockDocument(pageDocument);

    const contents = await tx
      .insert(schema.contents)
      .values([
        {
          type: 'page' as const,
          status: 'published' as const,
          slug: 'pagina-di-prova',
          path: '/pagina-di-prova/',
          title: 'Pagina di prova',
          blocks: pageDocument,
          contentHtml: pageHtml,
          contentText: extractContentText(pageHtml),
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
        visibleToRoles: ['editor'],
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

  // I PDF dei documenti di prova entrano nell'archivio a oggetti; un errore fa fallire il seme.
  for (const file of documentFiles) {
    await store.put(file.bucket, file.key, file.body, 'application/pdf');
  }

  console.error(
    [
      'Seme sintetico scritto.',
      'Account, tutti con la password passata in SEED_PASSWORD:',
      `- ${SYNTHETIC_EMAIL}: Redazione, con i cinque permessi della redazione;`,
      `- ${ADMINISTRATION_EMAIL}: Amministrazione (persone e permessi, registro, impostazioni del sito);`,
      `- ${BOTH_ROLES_EMAIL}: entrambi i ruoli, sceglie l’area dopo l’accesso.`,
      'Dentro: 4 media, 2 contenuti, 2 documenti (uno riservato), 1 carosello di 3 slide, 2 categorie, 1 menu con i quattro casi di visibilità,',
      '2 redirect, 6 impostazioni, 4 template SEO.',
      'Nell’archivio a oggetti entrano solo i due PDF dei documenti: dei media immagine ci sono le righe, non i byte.',
    ].join('\n'),
  );
} catch (error) {
  console.error('Seme non scritto:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await close();
}
