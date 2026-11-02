import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import {
  ALTRA,
  apiScript,
  draftPlan,
  FIGLIA,
  ID,
  itemsOf,
  MADRE,
  NEW_CHANGE,
  parentField,
  resultingAddress,
  saveButton,
  slugField,
  typeSlug,
  waitForEditor,
  type User,
} from './content-address-support';
import { syntheticContent } from './fixtures';

/**
 * Wave 1G-W3, T4: la scheda «Indirizzo» dell'editor. Si prova dentro l'editor
 * intero, non il pannello da solo, perché due criteri riguardano proprio il
 * rapporto fra i due: l'intestazione e «Ultima modifica» si aggiornano dopo lo
 * spostamento, e le modifiche non salvate della scheda «Contenuto» non si
 * perdono né si salvano di nascosto (W3-PLAN §6 caso 4).
 *
 * Titoli, indirizzi e identificativi sono inventati.
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

const { serve, callsTo, previewCalls, addressWrites } = apiScript(apiMock);

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

/** Apre l'editor sulla scheda «Indirizzo» e, per una pagina, aspetta le pagine genitore. */
async function openAddressTab(user: User, page = true): Promise<void> {
  renderEditor();
  await waitForEditor();
  await user.click(screen.getByRole('tab', { name: 'Indirizzo' }));
  if (page) await screen.findByRole('combobox', { name: 'Pagina genitore' });
}

describe('scheda «Indirizzo» dell’editor', () => {
  beforeEach(() => {
    // I permessi della Redazione: il piano di prova tocca regole (D138-A chiede `settings.write`).
    permissions = ['content.read', 'content.write', 'content.publish', 'settings.write'];
    apiMock.mockReset();
    serve();
  });

  it('mostra lo slug e, per una pagina, «Pagina genitore» con «Nessuna, primo livello» e le opzioni dell’API', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    expect(slugField()).toHaveValue('pagina-di-prova');
    expect(parentField()).toHaveValue('');
    expect(
      within(parentField())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Nessuna, primo livello',
      'Madre di prova — /madre-di-prova/',
      'Altra pagina di prova — /altra-pagina/',
    ]);
    expect(resultingAddress()).toHaveTextContent('/pagina-di-prova/');
  });

  it('W8-22: «Pagina genitore» spiega che le pagine che stanno sotto questa non compaiono', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);
    expect(parentField()).toHaveAccessibleDescription(
      'Le pagine che stanno sotto questa non compaiono: una pagina non può avere come genitore una sua discendente.',
    );
  });

  it('una pagina con genitore lo mostra scelto, e l’indirizzo risultante parte dal suo percorso', async () => {
    serve({
      content: {
        ...syntheticContent,
        parentId: MADRE.id,
        path: '/madre-di-prova/pagina-di-prova/',
      },
    });
    const user = userEvent.setup();
    await openAddressTab(user);

    expect(parentField()).toHaveValue(MADRE.id);
    expect(resultingAddress()).toHaveTextContent('/madre-di-prova/pagina-di-prova/');
  });

  it('una notizia non mostra il genitore e non chiede le pagine', async () => {
    serve({
      content: {
        ...syntheticContent,
        type: 'post',
        slug: 'notizia-di-prova',
        path: '/notizia-di-prova/',
      },
    });
    const user = userEvent.setup();
    await openAddressTab(user, false);

    expect(slugField()).toHaveValue('notizia-di-prova');
    expect(screen.queryByLabelText('Pagina genitore')).not.toBeInTheDocument();
    expect(callsTo(`/contents/${ID}/address/options`)).toEqual([]);
  });

  it.each([
    ['con lo slug di un’altra pagina', 'notizia-di-prova', '/notizia-di-prova-332/'],
    ['senza slug', '', '/senza-slug-1781/'],
  ])(
    'W10-N2: una bozza importata a percorso provvisorio %s mostra il percorso che ha',
    async (_, slug, path) => {
      serve({ content: { ...syntheticContent, type: 'post', status: 'draft', slug, path } });
      const user = userEvent.setup();
      await openAddressTab(user, false);
      expect(resultingAddress()).toHaveTextContent(path);
      // Appena si cambia lo slug l'indicazione torna a quella calcolata.
      await typeSlug(user, 'nuovo-indirizzo');
      expect(resultingAddress()).toHaveTextContent('/nuovo-indirizzo/');
    },
  );

  it('l’indirizzo risultante si aggiorna mentre si scrive lo slug e si sceglie il genitore', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    expect(resultingAddress()).toHaveTextContent('/nuovo-indirizzo/');
    await user.selectOptions(parentField(), MADRE.id);
    expect(resultingAddress()).toHaveTextContent('/madre-di-prova/nuovo-indirizzo/');
    await user.selectOptions(parentField(), '');
    expect(resultingAddress()).toHaveTextContent('/nuovo-indirizzo/');
    // È solo un'indicazione: nessuna anteprima parte finché non si salva.
    expect(previewCalls()).toEqual([]);
  });

  it('se slug e genitore sono quelli salvati non parte nessuna richiesta', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    expect(saveButton()).toBeDisabled();
    await user.click(saveButton());
    // Scritto e poi riportato al valore salvato: ancora nulla da salvare.
    await typeSlug(user, 'altro');
    expect(saveButton()).toBeEnabled();
    await typeSlug(user, 'pagina-di-prova');
    expect(saveButton()).toBeDisabled();
    await user.click(saveButton());

    expect(previewCalls()).toEqual([]);
    expect(addressWrites()).toEqual([]);
  });

  it('S6: se un contenuto pubblicato cambia indirizzo, «Salva l’indirizzo» chiede l’anteprima e apre la conferma con spostamenti, redirect e avvisi', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());

    const dialog = await screen.findByRole('dialog', { name: "Cambia l'indirizzo pubblico" });
    expect(previewCalls()).toEqual([`/contents/${ID}/address/preview?slug=nuovo-indirizzo`]);
    expect(itemsOf('Indirizzi che cambiano')).toEqual([
      'Pagina di prova: /pagina-di-prova/ → /nuovo-indirizzo/',
      'Figlia in bozza: /pagina-di-prova/figlia/ → /nuovo-indirizzo/figlia/ (non pubblicato, nessun redirect)',
    ]);
    expect(itemsOf('Redirect che nascono')).toEqual(['/pagina-di-prova/ → /nuovo-indirizzo/']);
    expect(itemsOf('Redirect che cambiano destinazione')).toEqual([
      '/vecchio-articolo/: ora porta a /nuovo-indirizzo/ invece che a /pagina-di-prova/',
    ]);
    expect(itemsOf('Redirect che si tolgono')).toEqual(['/nuovo-indirizzo/ → /altrove/']);
    // D132-A: i riferimenti scritti a mano si elencano, non si riscrivono.
    expect(itemsOf('Riferimenti scritti a mano che non cambiano')).toEqual([
      "L'indirizzo canonico di un contenuto indica ancora /pagina-di-prova/.",
      'Una voce di menu personalizzata indica ancora /pagina-di-prova/.',
    ]);
    expect(within(dialog).getByRole('button', { name: "Cambia l'indirizzo" })).toBeInTheDocument();
    // Fino alla conferma non si scrive nulla.
    expect(addressWrites()).toEqual([]);
  });

  it('il genitore scelto viaggia nell’anteprima e nella scrittura', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    await user.selectOptions(parentField(), MADRE.id);
    await user.click(saveButton());
    await screen.findByRole('dialog');
    expect(previewCalls()).toEqual([
      `/contents/${ID}/address/preview?slug=pagina-di-prova&parentId=${MADRE.id}`,
    ]);
    await user.click(screen.getByRole('button', { name: "Cambia l'indirizzo" }));

    await waitFor(() =>
      expect(addressWrites()).toEqual([
        [
          `/contents/${ID}/address`,
          { method: 'PUT', body: { slug: 'pagina-di-prova', parentId: MADRE.id } },
        ],
      ]),
    );
    expect(await screen.findByText('/madre-di-prova/pagina-di-prova/ — pubblicato')).toBeVisible();
  });

  it('annullare la conferma non scrive e lascia i campi come li si è scritti', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(addressWrites()).toEqual([]);
    expect(slugField()).toHaveValue('nuovo-indirizzo');
    expect(screen.getByText('/pagina-di-prova/ — pubblicato')).toBeInTheDocument();
  });

  it('da tastiera: si arriva al salvataggio con Tab, la conferma prende il fuoco ed Esc la chiude senza scrivere', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    await user.clear(slugField());
    await user.keyboard('nuovo-indirizzo');
    await user.tab();
    expect(parentField()).toHaveFocus();
    await user.tab();
    expect(saveButton()).toHaveFocus();
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(addressWrites()).toEqual([]);
  });

  it('confermare chiama PUT e aggiorna intestazione e «Ultima modifica» senza ricaricare l’editor', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: "Cambia l'indirizzo" }));

    expect(await screen.findByText('/nuovo-indirizzo/ — pubblicato')).toBeInTheDocument();
    expect(addressWrites()).toEqual([
      [
        `/contents/${ID}/address`,
        { method: 'PUT', body: { slug: 'nuovo-indirizzo', parentId: null } },
      ],
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByText(/^Ultima modifica di Redattrice di prova il 21\/10\/2026/),
    ).toBeVisible();
    expect(screen.getByText("L'indirizzo pubblico ora è /nuovo-indirizzo/.")).toBeInTheDocument();
    // Lo slug salvato è quello nuovo: un altro clic non avrebbe nulla da scrivere.
    expect(slugField()).toHaveValue('nuovo-indirizzo');
    expect(saveButton()).toBeDisabled();
    // W10-N2: dopo il salvataggio l'indicazione è il percorso salvato dall'API.
    expect(resultingAddress()).toHaveTextContent('/nuovo-indirizzo/');
    // Nessuna rilettura: il contenuto si è letto una volta sola, all'apertura.
    expect(callsTo(`/contents/${ID}`).filter((call) => call[0] === `/contents/${ID}`)).toHaveLength(
      1,
    );
  });

  it('§6 caso 4: le modifiche non salvate della scheda «Contenuto» restano e non si salvano nel contenuto', async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();

    await user.type(screen.getByRole('textbox', { name: 'Titolo' }), ' ritoccata');
    await user.click(screen.getByRole('tab', { name: 'Indirizzo' }));
    await screen.findByRole('combobox', { name: 'Pagina genitore' });
    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());
    await user.click(await screen.findByRole('button', { name: "Cambia l'indirizzo" }));
    await screen.findByText('/nuovo-indirizzo/ — pubblicato');

    await user.click(screen.getByRole('tab', { name: 'Contenuto' }));
    expect(screen.getByRole('textbox', { name: 'Titolo' })).toHaveValue(
      'Pagina di prova ritoccata',
    );
    // Lo spostamento manda solo slug e genitore, e il contenuto non è stato riscritto.
    expect(addressWrites()).toEqual([
      [
        `/contents/${ID}/address`,
        { method: 'PUT', body: { slug: 'nuovo-indirizzo', parentId: null } },
      ],
    ]);
    expect(callsTo(`/contents/${ID}`, 'PATCH')).toEqual([]);
    expect(callsTo(`/contents/${ID}`).filter((call) => call[0] === `/contents/${ID}`)).toHaveLength(
      1,
    );
  });

  it('S6: se nessun contenuto pubblicato cambia indirizzo si scrive subito, senza conferma', async () => {
    serve({
      content: { ...syntheticContent, status: 'draft' },
      preview: () => Promise.resolve(draftPlan),
    });
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());

    expect(await screen.findByText('/nuovo-indirizzo/ — bozza')).toBeInTheDocument();
    expect(previewCalls()).toHaveLength(1);
    expect(addressWrites()).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('S6: una bozza con una figlia pubblicata chiede comunque la conferma', async () => {
    serve({
      content: { ...syntheticContent, status: 'draft' },
      preview: () =>
        Promise.resolve({
          ...draftPlan,
          moves: [
            ...draftPlan.moves,
            {
              id: FIGLIA,
              title: 'Figlia pubblicata',
              from: '/pagina-di-prova/figlia/',
              to: '/nuovo-indirizzo/figlia/',
              published: true,
            },
          ],
          redirectsCreated: [{ from: '/pagina-di-prova/figlia/', to: '/nuovo-indirizzo/figlia/' }],
        }),
    });
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());

    await screen.findByRole('dialog');
    expect(itemsOf('Redirect che nascono')).toEqual([
      '/pagina-di-prova/figlia/ → /nuovo-indirizzo/figlia/',
    ]);
    expect(addressWrites()).toEqual([]);
  });

  it('D132-A: dopo una scrittura senza conferma gli avvisi restano elencati', async () => {
    serve({
      content: { ...syntheticContent, status: 'draft' },
      preview: () => Promise.resolve(draftPlan),
      put: (body) =>
        Promise.resolve({
          content: {
            ...syntheticContent,
            status: 'draft',
            slug: body.slug,
            path: `/${body.slug}/`,
            lastChange: NEW_CHANGE,
          },
          plan: {
            ...draftPlan,
            warnings: [{ kind: 'menu', id: 'm-1', value: '/pagina-di-prova/' }],
          },
        }),
    });
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());

    await screen.findByText('/nuovo-indirizzo/ — bozza');
    expect(itemsOf('Riferimenti scritti a mano che non cambiano')).toEqual([
      'Una voce di menu personalizzata indica ancora /pagina-di-prova/.',
    ]);
  });

  it('uno slug vuoto si ferma prima dell’anteprima, con il motivo accanto al campo', async () => {
    const user = userEvent.setup();
    await openAddressTab(user);

    await user.clear(slugField());
    await user.click(saveButton());

    expect(slugField()).toHaveAttribute('aria-invalid', 'true');
    expect(slugField()).toHaveAccessibleDescription(/Lo slug non può essere vuoto/);
    expect(previewCalls()).toEqual([]);
  });

  it.each([
    {
      code: 'VALIDATION_FAILED',
      status: 400,
      message: 'La richiesta non è valida.',
      details: [{ path: '/slug', message: 'lo slug contiene caratteri non ammessi nel percorso' }],
      typed: 'Slug Non Valido',
      expected: 'lo slug contiene caratteri non ammessi nel percorso',
    },
    {
      code: 'CONTENT_SLUG_RESERVED',
      status: 400,
      message:
        "L'indirizzo /media/ è usato dal sito stesso: al primo livello non si può dare a un contenuto.",
      details: [],
      typed: 'media',
      expected: "L'indirizzo /media/ è usato dal sito stesso",
    },
    {
      code: 'CONTENT_PATH_TAKEN',
      status: 409,
      message: "L'indirizzo /altra-pagina/ è già usato da un altro contenuto.",
      details: [],
      typed: 'altra-pagina',
      expected: "L'indirizzo /altra-pagina/ è già usato da un altro contenuto.",
    },
  ])(
    '$code dell’anteprima si legge accanto allo slug e ferma il salvataggio',
    async ({ code, status, message, details, typed, expected }) => {
      serve({ preview: () => Promise.reject(new ApiError(status, code, message, details)) });
      const user = userEvent.setup();
      await openAddressTab(user);

      await typeSlug(user, typed);
      await user.click(saveButton());

      await waitFor(() => expect(slugField()).toHaveAttribute('aria-invalid', 'true'));
      expect(slugField()).toHaveAccessibleDescription(expect.stringContaining(expected));
      expect(parentField()).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(addressWrites()).toEqual([]);
    },
  );

  it('CONTENT_PARENT_INVALID dell’anteprima si legge accanto a «Pagina genitore»', async () => {
    const message = 'La pagina scelta come genitore sta sotto questo contenuto.';
    serve({
      preview: () => Promise.reject(new ApiError(400, 'CONTENT_PARENT_INVALID', message)),
    });
    const user = userEvent.setup();
    await openAddressTab(user);

    await user.selectOptions(parentField(), ALTRA.id);
    await user.click(saveButton());

    await waitFor(() => expect(parentField()).toHaveAttribute('aria-invalid', 'true'));
    expect(parentField()).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(slugField()).not.toHaveAttribute('aria-invalid');
    expect(addressWrites()).toEqual([]);
  });

  it('REDIRECT_AT_DESTINATION dell’anteprima si legge nell’avviso della scheda', async () => {
    const message =
      "L'indirizzo /nuovo-indirizzo/ è l'origine di un redirect manuale verso /altrove/: va tolto o cambiato dalla pagina dei redirect prima dello spostamento.";
    serve({
      preview: () => Promise.reject(new ApiError(409, 'REDIRECT_AT_DESTINATION', message)),
    });
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Indirizzo non salvato');
    expect(alert).toHaveTextContent(message);
    expect(slugField()).not.toHaveAttribute('aria-invalid');
    expect(addressWrites()).toEqual([]);
  });

  it('REDIRECT_CYCLE della scrittura chiude la conferma e si legge nell’avviso della scheda', async () => {
    const message =
      'Il redirect da /a/ verso /b/ porterebbe a un altro redirect: lo spostamento è stato annullato.';
    serve({ put: () => Promise.reject(new ApiError(409, 'REDIRECT_CYCLE', message)) });
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());
    await user.click(await screen.findByRole('button', { name: "Cambia l'indirizzo" }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // L'indirizzo mostrato resta quello di prima: lo spostamento non c'è stato.
    expect(screen.getByText('/pagina-di-prova/ — pubblicato')).toBeInTheDocument();
  });

  it('CONTENT_PATH_TAKEN della scrittura (indirizzo preso nel frattempo) si legge accanto allo slug', async () => {
    const message = "L'indirizzo /nuovo-indirizzo/ è già usato da un altro contenuto.";
    serve({ put: () => Promise.reject(new ApiError(409, 'CONTENT_PATH_TAKEN', message)) });
    const user = userEvent.setup();
    await openAddressTab(user);

    await typeSlug(user, 'nuovo-indirizzo');
    await user.click(saveButton());
    await user.click(await screen.findByRole('button', { name: "Cambia l'indirizzo" }));

    await waitFor(() => expect(slugField()).toHaveAttribute('aria-invalid', 'true'));
    expect(slugField()).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('senza permesso di scrittura i campi sono spenti e il salvataggio non si mostra (DR-057)', async () => {
    permissions = ['content.read'];
    const user = userEvent.setup();
    await openAddressTab(user);

    expect(slugField()).toBeDisabled();
    expect(parentField()).toBeDisabled();
    expect(screen.queryByRole('button', { name: "Salva l'indirizzo" })).not.toBeInTheDocument();
  });
});
