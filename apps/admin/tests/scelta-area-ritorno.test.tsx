import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W2, giro 1: chi arriva a un indirizzo di un'altra area passa dalla scelta
 * e, scelta la veste giusta, ritrova l'indirizzo; mai verso mete non sicure.
 */

const replace = vi.fn();
const chooseVestment = vi.fn();
let activeArea: 'redazione' | 'impostazioni' | null = 'impostazioni';
let areas: string[] = ['redazione', 'impostazioni'];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../src/lib/session', async () => {
  const actual = await vi.importActual<typeof SessionModule>('../src/lib/session');
  return {
    ...actual,
    useSession: () => ({
      user: {
        userId: 'u1',
        email: 'redazione@esempio.invalid',
        fullName: 'Persona di prova',
        mustChangePassword: false,
        permissions: [],
        activeRoleId: 'r1',
        activeArea,
        rolesHeld: [{ roleId: 'r1', key: 'editor', label: 'Redazione', areas }],
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment,
      refresh: vi.fn(),
    }),
  };
});

const { AreaShell } = await import('../src/components/AreaShell');
const { default: SceltaAreaPage } = await import('../src/app/scelta-area/page');
const { choiceUrlFor, safeReturnPath } = await import('../src/lib/returnPath');

function at(path: string): void {
  window.history.replaceState({}, '', path);
}

beforeEach(() => {
  replace.mockReset();
  chooseVestment.mockReset();
  activeArea = 'impostazioni';
  areas = ['redazione', 'impostazioni'];
  at('/');
});

describe('safeReturnPath', () => {
  it('accetta un percorso interno dell’area scelta, con ricerca e frammento', () => {
    expect(safeReturnPath('/redazione/pagine/abc', 'redazione')).toBe('/redazione/pagine/abc');
    expect(safeReturnPath('/redazione/pagine?x=1#a', 'redazione')).toBe('/redazione/pagine?x=1#a');
    expect(safeReturnPath('/impostazioni/registro', 'impostazioni')).toBe('/impostazioni/registro');
    expect(safeReturnPath('/impostazioni', 'impostazioni')).toBe('/impostazioni');
  });

  it('scarta i percorsi di un’altra area', () => {
    expect(safeReturnPath('/impostazioni/registro', 'redazione')).toBeNull();
    expect(safeReturnPath('/redazione/pagine', 'impostazioni')).toBeNull();
    expect(safeReturnPath('/redazionefalsa/x', 'redazione')).toBeNull();
  });

  it.each([
    'https://evil.example/redazione/x',
    '//evil.example/redazione/x',
    '/\\evil.example',
    '/redazione/\\x',
    'redazione/pagine',
    'javascript:alert(1)',
    '/redazione/../impostazioni',
    '/redazione/%2e%2e/impostazioni',
    '/redazione/x\n',
    '',
  ])('scarta la meta non sicura %j', (raw) => {
    expect(safeReturnPath(raw, 'redazione')).toBeNull();
  });

  it('senza meta dà null', () => {
    expect(safeReturnPath(null, 'redazione')).toBeNull();
  });
});

describe('choiceUrlFor', () => {
  it('toglie il prefisso /admin e codifica la meta', () => {
    expect(choiceUrlFor('/admin/redazione/pagine/abc', '')).toBe(
      '/scelta-area?dopo=%2Fredazione%2Fpagine%2Fabc',
    );
    expect(choiceUrlFor('/redazione/pagine', '?q=1')).toBe(
      '/scelta-area?dopo=%2Fredazione%2Fpagine%3Fq%3D1',
    );
  });
});

describe('AreaShell in un’area diversa da quella indossata', () => {
  it('manda alla scelta portando con sé il percorso di arrivo', async () => {
    at('/admin/redazione/pagine/abc');
    render(
      <AreaShell area="redazione" sectionId="pagine" breadcrumbs={[]}>
        contenuto
      </AreaShell>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/scelta-area?dopo=%2Fredazione%2Fpagine%2Fabc'),
    );
  });
});

describe('AreaShell senza veste indossata', () => {
  it('manda alla scelta portando con sé il percorso di arrivo', async () => {
    activeArea = null;
    at('/admin/redazione/pagine/abc');
    render(
      <AreaShell area="redazione" sectionId="pagine" breadcrumbs={[]}>
        contenuto
      </AreaShell>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/scelta-area?dopo=%2Fredazione%2Fpagine%2Fabc'),
    );
  });
});

describe('scelta dell’area con meta di ritorno', () => {
  it('dopo la scelta apre la meta se appartiene all’area scelta', async () => {
    at('/admin/scelta-area?dopo=%2Fredazione%2Fpagine%2Fabc');
    chooseVestment.mockResolvedValue({});
    render(<SceltaAreaPage />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /Redazione/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/redazione/pagine/abc'));
  });

  it('se la meta è di un’altra area apre la home dell’area scelta', async () => {
    at('/admin/scelta-area?dopo=%2Fimpostazioni%2Fregistro');
    chooseVestment.mockResolvedValue({});
    render(<SceltaAreaPage />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /Redazione/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/redazione/pagine'));
  });

  it('ignora una meta esterna o malformata', async () => {
    at('/admin/scelta-area?dopo=%2F%2Fevil.example%2Fredazione');
    chooseVestment.mockResolvedValue({});
    render(<SceltaAreaPage />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /Redazione/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/redazione/pagine'));
  });

  it('con una sola veste, la scelta automatica apre la meta valida', async () => {
    areas = ['redazione'];
    activeArea = null;
    at('/admin/scelta-area?dopo=%2Fredazione%2Fnotizie%2Fxyz');
    chooseVestment.mockResolvedValue({});
    render(<SceltaAreaPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/redazione/notizie/xyz'));
  });

  it('con una sola veste già attiva apre la meta valida', async () => {
    areas = ['redazione'];
    activeArea = 'redazione';
    at('/admin/scelta-area?dopo=%2Fredazione%2Fnotizie%2Fxyz');
    render(<SceltaAreaPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/redazione/notizie/xyz'));
  });
});
