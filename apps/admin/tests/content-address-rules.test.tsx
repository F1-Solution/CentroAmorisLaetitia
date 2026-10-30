import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { ContentDetail } from '../src/lib/editor/roundtrip';
import {
  apiScript,
  draftPlan,
  ID,
  itemsOf,
  NEW_CHANGE,
  parentField,
  publishedPlan,
  resultingAddress,
  saveButton,
  slugField,
  typeSlug,
  waitForEditor,
  type User,
} from './content-address-support';
import { syntheticContent } from './fixtures';

/**
 * Ondata finale della 1G-W3 sulla scheda «Indirizzo»: la conferma si apre anche
 * quando cambiano regole esistenti (S6 esteso, D135-A), la scheda dice quale
 * permesso manca (D138-A), si spegne mentre l'editor salva o ricarica, e l'esito
 * è corretto per una bozza e per la pagina iniziale (S3). Dati inventati.
 */

const apiMock = vi.fn();
let permissions: string[] = [];

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('../src/lib/session', async () => {
  const actual = await vi.importActual<typeof SessionModule>('../src/lib/session');
  return {
    ...actual,
    useSession: () => ({
      user: {
        userId: 'u1',
        email: 'redazione@esempio.invalid',
        fullName: 'Redattrice di prova',
        mustChangePassword: false,
        permissions,
        activeRoleId: 'r1',
        activeArea: 'redazione',
        rolesHeld: [{ roleId: 'r1', key: 'redazione', label: 'Redazione', areas: ['redazione'] }],
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

const { ContentEditor } = await import('../src/components/editor/ContentEditor');

const { serve, addressWrites } = apiScript(apiMock);

const DRAFT: ContentDetail = { ...syntheticContent, status: 'draft' };
const RETARGETED = {
  source: '/scorciatoia-di-prova/',
  from: '/pagina-di-prova/',
  to: '/nuovo-indirizzo/',
  origin: 'manual',
};
const REMOVED = { source: '/nuovo-indirizzo/', target: '/altrove/' };
const NEEDS_REDIRECTS =
  'Il cambio riscrive o toglie redirect già presenti: serve il permesso di gestire SEO e redirect.';
const NEEDS_PUBLISH = 'Il cambio sposta un contenuto pubblicato: serve il permesso di pubblicare.';

function renderEditor() {
  return render(
    <DensityProvider>
      <ContentEditor
        contentId={ID}
        sectionId="pagine"
        listHref="/redazione/pagine"
        listLabel="Pagine"
      />
    </DensityProvider>,
  );
}

async function openAddressTab(user: User): Promise<void> {
  renderEditor();
  await waitForEditor();
  await user.click(screen.getByRole('tab', { name: 'Indirizzo' }));
  await screen.findByRole('combobox', { name: 'Pagina genitore' });
}

async function saveSlug(user: User, slug: string): Promise<void> {
  await typeSlug(user, slug);
  await user.click(saveButton());
}

describe('scheda «Indirizzo»: conferma, permessi ed esiti', () => {
  beforeEach(() => {
    permissions = ['content.read', 'content.write', 'content.publish', 'settings.write'];
    apiMock.mockReset();
    serve();
  });

  it('S6 esteso (D135-A): una bozza il cui piano riscrive una regola chiede la conferma', async () => {
    serve({
      content: DRAFT,
      preview: () => Promise.resolve({ ...draftPlan, redirectsRetargeted: [RETARGETED] }),
    });
    const user = userEvent.setup();
    await openAddressTab(user);
    await saveSlug(user, 'nuovo-indirizzo');

    const dialog = await screen.findByRole('dialog', { name: "Cambia l'indirizzo pubblico" });
    expect(dialog).toHaveTextContent(
      'Nessun contenuto pubblicato cambia indirizzo, ma cambiano dei redirect già presenti sul sito.',
    );
    expect(itemsOf('Redirect che cambiano destinazione')).toEqual([
      '/scorciatoia-di-prova/: ora porta a /nuovo-indirizzo/ invece che a /pagina-di-prova/',
    ]);
    expect(addressWrites()).toEqual([]);
  });

  it('S6 esteso: anche un piano che toglie soltanto una regola chiede la conferma', async () => {
    serve({
      content: DRAFT,
      preview: () => Promise.resolve({ ...draftPlan, redirectsRemoved: [REMOVED] }),
    });
    const user = userEvent.setup();
    await openAddressTab(user);
    await saveSlug(user, 'nuovo-indirizzo');

    await screen.findByRole('dialog', { name: "Cambia l'indirizzo pubblico" });
    expect(itemsOf('Redirect che si tolgono')).toEqual(['/nuovo-indirizzo/ → /altrove/']);
    expect(addressWrites()).toEqual([]);
  });

  it('dopo un salvataggio senza conferma l’esito elenca comunque le regole riscritte e tolte', async () => {
    // L'anteprima non toccava regole, la scrittura (piano ricalcolato) sì.
    serve({
      content: DRAFT,
      preview: () => Promise.resolve(draftPlan),
      put: (body) =>
        Promise.resolve({
          content: { ...DRAFT, slug: body.slug, path: `/${body.slug}/`, lastChange: NEW_CHANGE },
          plan: { ...draftPlan, redirectsRetargeted: [RETARGETED], redirectsRemoved: [REMOVED] },
        }),
    });
    const user = userEvent.setup();
    await openAddressTab(user);
    await saveSlug(user, 'nuovo-indirizzo');

    await screen.findByText('/nuovo-indirizzo/ — bozza');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(itemsOf('Redirect che cambiano destinazione')).toEqual([
      '/scorciatoia-di-prova/: ora porta a /nuovo-indirizzo/ invece che a /pagina-di-prova/',
    ]);
    expect(itemsOf('Redirect che si tolgono')).toEqual(['/nuovo-indirizzo/ → /altrove/']);
  });

  it.each([
    {
      missing: 'settings.write',
      held: ['content.read', 'content.write', 'content.publish'],
      expected: [NEEDS_REDIRECTS],
    },
    {
      missing: 'content.publish',
      held: ['content.read', 'content.write', 'settings.write'],
      expected: [NEEDS_PUBLISH],
    },
    {
      missing: 'entrambi',
      held: ['content.read', 'content.write'],
      expected: [NEEDS_REDIRECTS, NEEDS_PUBLISH],
    },
  ])(
    'D138-A, senza $missing: la scheda dice che cosa manca e non offre la conferma',
    async ({ held, expected }) => {
      permissions = held;
      const user = userEvent.setup();
      await openAddressTab(user);
      await saveSlug(user, 'nuovo-indirizzo');

      await screen.findByText('Serve un permesso che il tuo ruolo non ha');
      for (const text of [NEEDS_REDIRECTS, NEEDS_PUBLISH]) {
        if (expected.includes(text)) expect(screen.getByText(text)).toBeInTheDocument();
        else expect(screen.queryByText(text)).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(addressWrites()).toEqual([]);
    },
  );

  it('D138-A: una bozza che non tocca regole si salva anche senza quei due permessi', async () => {
    permissions = ['content.read', 'content.write'];
    serve({ content: DRAFT, preview: () => Promise.resolve(draftPlan) });
    const user = userEvent.setup();
    await openAddressTab(user);
    await saveSlug(user, 'nuovo-indirizzo');

    await screen.findByText('/nuovo-indirizzo/ — bozza');
    expect(screen.queryByText('Serve un permesso che il tuo ruolo non ha')).not.toBeInTheDocument();
    expect(addressWrites()).toHaveLength(1);
  });

  it('mentre l’editor salva o ricarica il contenuto, la scheda «Indirizzo» è spenta', async () => {
    let finishPatch = (): void => undefined;
    let finishReload = (): void => undefined;
    let reads = 0;
    serve({
      override: (path, method) => {
        if (path !== `/contents/${ID}`) return undefined;
        if (method === 'PATCH') {
          return new Promise((resolve) => {
            finishPatch = () => resolve(syntheticContent);
          });
        }
        reads += 1;
        if (method !== 'GET' || reads !== 2) return undefined;
        return new Promise((resolve) => {
          finishReload = () => resolve(syntheticContent);
        });
      },
    });
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();
    await user.type(screen.getByRole('textbox', { name: 'Titolo' }), ' ritoccata');
    await user.click(screen.getByRole('button', { name: 'Salva e aggiorna il sito' }));
    await user.click(screen.getByRole('tab', { name: 'Indirizzo' }));
    await screen.findByRole('combobox', { name: 'Pagina genitore' });

    // Una lettura arrivata dopo uno spostamento riporterebbe slug e percorso di prima.
    expect(slugField()).toBeDisabled();
    expect(parentField()).toBeDisabled();
    finishPatch();
    await waitFor(() => expect(reads).toBe(2));
    expect(slugField()).toBeDisabled();
    finishReload();
    await waitFor(() => expect(slugField()).toBeEnabled());
    await typeSlug(user, 'nuovo-indirizzo');
    expect(saveButton()).toBeEnabled();
  });

  it('per una bozza l’esito non parla di indirizzo pubblico', async () => {
    serve({ content: DRAFT, preview: () => Promise.resolve(draftPlan) });
    const user = userEvent.setup();
    await openAddressTab(user);
    await saveSlug(user, 'nuovo-indirizzo');

    expect(
      await screen.findByText(
        "L'indirizzo ora è /nuovo-indirizzo/; sarà pubblico quando il contenuto verrà pubblicato.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/L'indirizzo pubblico ora è/)).not.toBeInTheDocument();
  });

  it('per la pagina iniziale indirizzo risultante ed esito dicono «/» (S3)', async () => {
    serve({
      content: { ...syntheticContent, isHome: true },
      preview: () =>
        Promise.resolve({
          ...publishedPlan,
          redirectsCreated: [{ from: '/pagina-di-prova/', to: '/' }],
        }),
    });
    const user = userEvent.setup();
    await openAddressTab(user);

    expect(resultingAddress()).toHaveTextContent(/^Indirizzo risultante: \/$/);
    await typeSlug(user, 'nuovo-indirizzo');
    expect(resultingAddress()).toHaveTextContent(/^Indirizzo risultante: \/$/);
    expect(screen.getByText('È la pagina iniziale: il sito la mostra sempre a /.')).toBeVisible();
    await user.click(saveButton());
    await user.click(await screen.findByRole('button', { name: "Cambia l'indirizzo" }));

    expect(
      await screen.findByText(
        "È la pagina iniziale: l'indirizzo pubblico resta /, e /nuovo-indirizzo/ porta lì.",
      ),
    ).toBeInTheDocument();
  });
});
