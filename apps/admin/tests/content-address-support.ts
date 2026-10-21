import { screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect, type Mock } from 'vitest';
import { ApiError } from '../src/lib/api';
import type { ContentDetail } from '../src/lib/editor/roundtrip';
import type { AddressPlan } from '../src/components/editor/ContentAddressPanel';
import { syntheticContent } from './fixtures';

/**
 * Aiuti comuni alle prove della scheda «Indirizzo» (wave 1G-W3): piani sintetici,
 * risposte simulate dell'API e i campi della scheda. Titoli, indirizzi e
 * identificativi sono inventati.
 */

export const ID = syntheticContent.id;
export const FIGLIA = '44444444-4444-4444-8444-444444444444';
export const MADRE = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Madre di prova',
  path: '/madre-di-prova/',
};
export const ALTRA = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Altra pagina di prova',
  path: '/altra-pagina/',
};

/** Il piano di un contenuto pubblicato che cambia slug, con tutte le voci che la conferma elenca. */
export const publishedPlan: AddressPlan = {
  path: '/nuovo-indirizzo/',
  moves: [
    {
      id: ID,
      title: 'Pagina di prova',
      from: '/pagina-di-prova/',
      to: '/nuovo-indirizzo/',
      published: true,
    },
    {
      id: FIGLIA,
      title: 'Figlia in bozza',
      from: '/pagina-di-prova/figlia/',
      to: '/nuovo-indirizzo/figlia/',
      published: false,
    },
  ],
  redirectsCreated: [{ from: '/pagina-di-prova/', to: '/nuovo-indirizzo/' }],
  redirectsRetargeted: [
    {
      source: '/vecchio-articolo/',
      from: '/pagina-di-prova/',
      to: '/nuovo-indirizzo/',
      origin: 'migration',
    },
  ],
  redirectsRemoved: [{ source: '/nuovo-indirizzo/', target: '/altrove/' }],
  warnings: [
    { kind: 'canonical', id: 'c-9', value: '/pagina-di-prova/' },
    { kind: 'menu', id: 'm-1', value: '/pagina-di-prova/' },
  ],
};

/** Lo stesso spostamento per un contenuto in bozza: nessun redirect, nessuna conferma (S6). */
export const draftPlan: AddressPlan = {
  path: '/nuovo-indirizzo/',
  moves: [
    {
      id: ID,
      title: 'Pagina di prova',
      from: '/pagina-di-prova/',
      to: '/nuovo-indirizzo/',
      published: false,
    },
  ],
  redirectsCreated: [],
  redirectsRetargeted: [],
  redirectsRemoved: [],
  warnings: [],
};

export const NEW_CHANGE = {
  actorLabel: 'Redattrice di prova',
  occurredAt: '2026-10-21T08:15:00.000Z',
};

type Body = { slug: string; parentId: string | null };

export interface Scenario {
  readonly content?: ContentDetail;
  readonly preview?: (path: string) => Promise<AddressPlan>;
  readonly put?: (body: Body) => Promise<unknown>;
  /** Una risposta su misura per una richiesta; `undefined` lascia rispondere lo scenario. */
  readonly override?: (path: string, method: string) => Promise<unknown> | undefined;
}

/** Le risposte simulate dell'API e la lettura delle chiamate, su un `api` finto. */
export function apiScript(apiMock: Mock) {
  /** Il contenuto, nessuna copia di lavoro, le opzioni, anteprima e scrittura. */
  function serve({
    content = syntheticContent,
    preview = () => Promise.resolve(publishedPlan),
    put,
    override,
  }: Scenario = {}): void {
    const write =
      put ??
      ((body: Body) => {
        const parentPath = body.parentId === MADRE.id ? MADRE.path : '/';
        return Promise.resolve({
          content: {
            ...content,
            slug: body.slug,
            parentId: body.parentId,
            path: `${parentPath}${body.slug}/`,
            lastChange: NEW_CHANGE,
          },
          plan: publishedPlan,
        });
      });
    apiMock.mockImplementation(
      (path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }) => {
        const method = options?.method ?? 'GET';
        const custom = override?.(path, method);
        if (custom) return custom;
        if (path === `/contents/${ID}` && method === 'GET') return Promise.resolve(content);
        if (path === `/contents/${ID}/draft` && method === 'GET') {
          return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
        }
        if (path === `/contents/${ID}/draft` && method === 'PUT') {
          return Promise.resolve({ updatedAt: '2026-10-21T08:10:00.000Z' });
        }
        if (path === `/contents/${ID}/address/options`) {
          return Promise.resolve({ items: [MADRE, ALTRA] });
        }
        if (path.startsWith(`/contents/${ID}/address/preview?`)) return preview(path);
        if (path === `/contents/${ID}/address` && method === 'PUT') {
          return write(options?.body as Body);
        }
        return Promise.resolve(undefined);
      },
    );
  }

  function callsTo(prefix: string, method = 'GET'): unknown[][] {
    return apiMock.mock.calls.filter(
      (call) =>
        (call[0] as string).startsWith(prefix) &&
        ((call[1] as { method?: string } | undefined)?.method ?? 'GET') === method,
    );
  }

  const previewCalls = () => callsTo(`/contents/${ID}/address/preview`).map((call) => call[0]);
  const addressWrites = () => callsTo(`/contents/${ID}/address`, 'PUT');

  return { serve, callsTo, previewCalls, addressWrites };
}

export async function waitForEditor(): Promise<void> {
  const tree = await screen.findByRole('region', { name: 'Struttura del contenuto' });
  await waitFor(() => {
    expect(within(tree).getByText(/Primo paragrafo di prova\./)).toBeInTheDocument();
  });
}

export type User = ReturnType<typeof userEvent.setup>;

export const slugField = () => screen.getByRole('textbox', { name: 'Slug' });
export const parentField = () => screen.getByRole('combobox', { name: 'Pagina genitore' });
export const saveButton = () => screen.getByRole('button', { name: "Salva l'indirizzo" });
export const resultingAddress = () => screen.getByText(/Indirizzo risultante/);

export async function typeSlug(user: User, value: string): Promise<void> {
  await user.clear(slugField());
  await user.type(slugField(), value);
}

export function itemsOf(name: string): (string | null)[] {
  return within(screen.getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}
