import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W2, T3: la schermata «Registro delle operazioni». Persone, contenuti
 * e identificativi sono inventati.
 */

const apiMock = vi.fn();
let areas: string[] = ['impostazioni'];

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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
        email: 'direzione@esempio.invalid',
        fullName: 'Direzione di prova',
        mustChangePassword: false,
        permissions: ['audit.read', 'users.manage'],
        activeRoleId: 'r1',
        activeArea: 'impostazioni',
        rolesHeld: [
          {
            roleId: 'r1',
            key: 'amministrazione',
            label: 'Amministrazione',
            areas,
          },
        ],
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

const { ApiError } = await import('../src/lib/api');
const { default: RegistroPage } = await import('../src/app/impostazioni/registro/page');
const { actionLabel } = await import('../src/lib/auditLabels');

const base = {
  actorUserId: 'a1',
  actorLabel: 'Ada Inventata',
  actorRoleLabel: 'Redazione',
  actorArea: 'redazione',
  entityType: 'content',
  entityId: 'c-1',
  entityLabel: 'Pagina di prova',
  contentType: 'page' as const,
  outcome: 'success' as const,
};

const modifica = {
  ...base,
  id: '30',
  occurredAt: '2026-10-01T12:30:00.000Z',
  action: 'content.update',
};
const eliminato = {
  ...base,
  id: '29',
  occurredAt: '2026-10-01T11:30:00.000Z',
  action: 'content.delete',
  entityId: 'c-2',
  entityLabel: null,
  contentType: null,
};
const invio = {
  id: '28',
  occurredAt: '2026-10-01T10:30:00.000Z',
  actorUserId: null,
  actorLabel: null,
  actorRoleLabel: null,
  actorArea: null,
  action: 'POST /forms/:slug/submissions',
  entityType: null,
  entityId: null,
  entityLabel: null,
  contentType: null,
  outcome: 'failure' as const,
};
const accessoFallito = { ...invio, id: '27', action: 'auth.login' };
const sessioneScaduta = {
  ...modifica,
  id: '25',
  action: 'content.draft.save',
  actorUserId: null,
  actorLabel: null,
  actorRoleLabel: null,
  actorArea: null,
  outcome: 'failure' as const,
};
const seoEliminato = {
  ...modifica,
  id: '24',
  action: 'seo.content.update',
  entityType: 'content_seo',
  entityId: 'c-9',
  entityLabel: null,
  contentType: null,
};
const homeSenzaTitolo = { ...modifica, id: '23', entityId: 'c-home', entityLabel: '/home/' };
const sconosciuta = { ...modifica, id: '26', action: 'nuova.azione', entityLabel: 'Altro' };

const persone = [
  { id: 'a1', fullName: 'Ada Inventata', email: 'ada@esempio.invalid' },
  { id: 'b2', fullName: 'Bruno Inventato', email: 'bruno@esempio.invalid' },
];

function auditCalls(): string[] {
  return apiMock.mock.calls.map((call) => call[0] as string).filter((p) => p.startsWith('/audit?'));
}

function renderPage() {
  return render(
    <DensityProvider>
      <RegistroPage />
    </DensityProvider>,
  );
}

describe('registro delle operazioni', () => {
  const previousTz = process.env.TZ;
  beforeAll(() => {
    // Fuso fisso: il filtro per giorno parte dalla mezzanotte locale.
    process.env.TZ = 'Europe/Rome';
  });
  afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  beforeEach(() => {
    areas = ['impostazioni'];
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: persone });
      if (path.startsWith('/audit/contents')) {
        return Promise.resolve({
          items: [
            { id: 'c-1', title: 'Pagina di prova', type: 'page' },
            { id: 'c-3', title: 'Notizia di prova', type: 'post' },
          ],
        });
      }
      if (path.startsWith('/audit')) {
        return Promise.resolve({
          items: [modifica, eliminato, invio, accessoFallito, sconosciuta],
          nextCursor: null,
        });
      }
      return Promise.resolve({});
    });
  });

  it('per difetto chiede la vista «Modifiche al sito» e mostra le colonne in italiano', async () => {
    renderPage();
    const riga = (await screen.findByText('Ha modificato', { selector: 'td' })).closest(
      'tr',
    ) as HTMLElement;
    expect(auditCalls()[0]).toContain('view=changes');
    expect(within(riga).getByText('Ada Inventata')).toBeInTheDocument();
    expect(within(riga).getByText(/Redazione/)).toBeInTheDocument();
    expect(within(riga).getByText('Pagina di prova')).toBeInTheDocument();
    expect(within(riga).getByText('Riuscita')).toBeInTheDocument();
    expect(within(riga).getByText(/01\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifiche al sito' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('caso 2: un contenuto non più presente non va in errore', async () => {
    renderPage();
    const riga = (await screen.findByText('Ha eliminato', { selector: 'td' })).closest(
      'tr',
    ) as HTMLElement;
    expect(within(riga).getByText('contenuto non più presente')).toBeInTheDocument();
  });

  it('caso 4: senza persona si legge «Dal sito pubblico» o «Accesso non riuscito»', async () => {
    renderPage();
    const form = (
      await screen.findByText('Invio di un modulo dal sito', { selector: 'td' })
    ).closest('tr') as HTMLElement;
    expect(within(form).getByText('Dal sito pubblico')).toBeInTheDocument();
    expect(within(form).getByText('Non riuscita')).toBeInTheDocument();
    const login = screen.getByText('Accesso', { selector: 'td' }).closest('tr') as HTMLElement;
    expect(within(login).getByText('Accesso non riuscito')).toBeInTheDocument();
  });

  it('I2: senza persona, «Dal sito pubblico» solo per i form; altrimenti «Senza sessione valida»', async () => {
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/accounts'
          ? { items: persone }
          : { items: [invio, accessoFallito, sessioneScaduta], nextCursor: null },
      ),
    );
    renderPage();
    const scaduta = (
      await screen.findByText('Ha salvato la copia di lavoro', { selector: 'td' })
    ).closest('tr') as HTMLElement;
    expect(within(scaduta).getByText('Senza sessione valida')).toBeInTheDocument();
    expect(within(scaduta).queryByText('Dal sito pubblico')).not.toBeInTheDocument();
    const form = screen
      .getByText('Invio di un modulo dal sito', { selector: 'td' })
      .closest('tr') as HTMLElement;
    expect(within(form).getByText('Dal sito pubblico')).toBeInTheDocument();
    const login = screen.getByText('Accesso', { selector: 'td' }).closest('tr') as HTMLElement;
    expect(within(login).getByText('Accesso non riuscito')).toBeInTheDocument();
  });

  it('I1: la riga SEO di un contenuto eliminato dice «contenuto non più presente»; il percorso fa da etichetta', async () => {
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/accounts'
          ? { items: persone }
          : { items: [seoEliminato, homeSenzaTitolo], nextCursor: null },
      ),
    );
    renderPage();
    const seo = (
      await screen.findByText('Ha modificato il titolo SEO', { selector: 'td' })
    ).closest('tr') as HTMLElement;
    expect(within(seo).getByText('contenuto non più presente')).toBeInTheDocument();
    expect(screen.getByText('/home/')).toBeInTheDocument();
    expect(screen.getAllByText('contenuto non più presente')).toHaveLength(1);
  });

  it("W3-8: il cambio d'indirizzo si legge «Ha cambiato l'indirizzo» e si sceglie fra le operazioni", async () => {
    const indirizzo = { ...modifica, id: '31', action: 'content.address.update' };
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/accounts' ? { items: persone } : { items: [indirizzo], nextCursor: null },
      ),
    );
    renderPage();
    const riga = (await screen.findByText("Ha cambiato l'indirizzo", { selector: 'td' })).closest(
      'tr',
    ) as HTMLElement;
    expect(within(riga).getByText('Pagina di prova')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: "Ha cambiato l'indirizzo" })).toHaveValue(
      'content.address.update',
    );
  });

  it('W4: il cambio di categorie si legge «Ha cambiato le categorie» e si sceglie fra le operazioni', () => {
    expect(actionLabel('content.terms.update')).toBe('Ha cambiato le categorie');
  });

  it('un’azione senza etichetta mostra il codice grezzo', async () => {
    renderPage();
    expect(await screen.findByText('nuova.azione')).toBeInTheDocument();
    expect(actionLabel('nuova.azione')).toBe('nuova.azione');
  });

  it('«Tutte le operazioni» richiede la vista completa', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    await user.click(screen.getByRole('button', { name: 'Tutte le operazioni' }));
    await waitFor(() => expect(auditCalls().some((p) => p.includes('view=all'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Tutte le operazioni' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('i filtri scelgono persona, operazione, esito, contenuto e periodo', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    await screen.findByRole('option', { name: 'Bruno Inventato' });

    await user.selectOptions(screen.getByLabelText('Persona'), 'b2');
    await user.selectOptions(screen.getByLabelText('Operazione'), 'content.publish');
    await user.selectOptions(screen.getByLabelText('Esito'), 'failure');
    await user.type(screen.getByLabelText('Contenuto'), 'Pagina di');
    await user.click(await screen.findByRole('button', { name: 'Pagina di prova (Pagina)' }));
    await user.type(screen.getByLabelText('Dal giorno'), '2026-10-01');
    await user.type(screen.getByLabelText('Al giorno'), '2026-10-31');
    await user.click(screen.getByRole('button', { name: 'Applica i filtri' }));

    await waitFor(() => {
      const last = auditCalls().at(-1) ?? '';
      const query = new URLSearchParams(last.split('?')[1]);
      expect(query.get('actorUserId')).toBe('b2');
      expect(query.get('action')).toBe('content.publish');
      expect(query.get('outcome')).toBe('failure');
      expect(query.get('entityType')).toBe('content');
      expect(query.get('entityId')).toBe('c-1');
      // Mezzanotte locale (Europe/Rome, CEST) del primo giorno.
      expect(query.get('from')).toBe('2026-09-30T22:00:00.000Z');
      // Il giorno finale è incluso: si manda la mezzanotte locale del giorno dopo (CET).
      expect(query.get('to')).toBe('2026-10-31T23:00:00.000Z');
    });
  });

  it('«Carica altre» usa il cursore e accoda le righe', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: persone });
      if (path.includes('cursor=')) {
        return Promise.resolve({
          items: [{ ...modifica, id: '10', action: 'content.publish' }],
          nextCursor: null,
        });
      }
      return Promise.resolve({ items: [modifica], nextCursor: 'CURSORE-INVENTATO' });
    });
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    await user.click(screen.getByRole('button', { name: 'Carica altre' }));
    expect(await screen.findByText('Ha pubblicato', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('Ha modificato', { selector: 'td' })).toBeInTheDocument();
    expect(auditCalls().at(-1)).toContain('cursor=CURSORE-INVENTATO');
    expect(screen.queryByRole('button', { name: 'Carica altre' })).not.toBeInTheDocument();
  });

  it('m1: un «Carica altre» fallito mostra l’errore, che sparisce se il nuovo tentativo riesce', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: persone });
      if (path.includes('cursor=')) {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new ApiError(500, 'ERRORE_INTERNO', 'Errore di caricamento.'))
          : Promise.resolve({ items: [{ ...modifica, id: '10' }], nextCursor: null });
      }
      return Promise.resolve({ items: [modifica], nextCursor: 'CURSORE-INVENTATO' });
    });
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    await user.click(screen.getByRole('button', { name: 'Carica altre' }));
    expect(await screen.findByText('Errore di caricamento.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Carica altre' }));
    await waitFor(() =>
      expect(screen.queryByText('Errore di caricamento.')).not.toBeInTheDocument(),
    );
  });

  it('m7: Invio nel campo del contenuto non applica i filtri e l’elenco è annunciato', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    await user.selectOptions(screen.getByLabelText('Esito'), 'failure');
    const before = auditCalls().length;
    await user.type(screen.getByLabelText('Contenuto'), 'di prova{Enter}');
    expect(await screen.findByText('2 contenuti trovati')).toBeInTheDocument();
    expect(auditCalls()).toHaveLength(before);
    expect(auditCalls().some((p) => p.includes('outcome=failure'))).toBe(false);
  });

  it('m7: senza risultati si annuncia «Nessun contenuto trovato»', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: persone });
      if (path.startsWith('/audit/contents')) return Promise.resolve({ items: [] });
      return Promise.resolve({ items: [modifica], nextCursor: null });
    });
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    await user.type(screen.getByLabelText('Contenuto'), 'zzz');
    expect(await screen.findByText('Nessun contenuto trovato')).toBeInTheDocument();
  });

  it('la ricerca del contenuto propone «titolo (Pagina|Notizia)» e si può togliere', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    expect(screen.queryByLabelText(/identificativo/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Contenuto'), 'di prova');
    expect(await screen.findByRole('button', { name: 'Notizia di prova (Notizia)' })).toBeVisible();
    const searches = apiMock.mock.calls.filter((c) =>
      (c[0] as string).startsWith('/audit/contents'),
    );
    // Il ritardo evita una richiesta per ogni lettera.
    expect(searches.length).toBeLessThan(3);
    expect(searches.at(-1)?.[0]).toBe('/audit/contents?search=di+prova');
    await user.click(screen.getByRole('button', { name: 'Notizia di prova (Notizia)' }));
    expect(screen.getByText('Notizia di prova (Notizia)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Togli il contenuto scelto' }));
    expect(screen.getByLabelText('Contenuto')).toBeInTheDocument();
  });

  it('il collegamento all’editor c’è per un contenuto presente della redazione, non per uno eliminato', async () => {
    areas = ['impostazioni', 'redazione'];
    renderPage();
    const riga = (await screen.findByText('Ha modificato', { selector: 'td' })).closest(
      'tr',
    ) as HTMLElement;
    expect(within(riga).getByRole('link', { name: 'Pagina di prova' })).toHaveAttribute(
      'href',
      '/redazione/pagine/c-1',
    );
    const eliminata = screen
      .getByText('Ha eliminato', { selector: 'td' })
      .closest('tr') as HTMLElement;
    expect(within(eliminata).queryByRole('link')).not.toBeInTheDocument();
  });

  it('una notizia si collega all’elenco delle notizie', async () => {
    areas = ['impostazioni', 'redazione'];
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/accounts'
          ? { items: persone }
          : { items: [{ ...modifica, contentType: 'post' }], nextCursor: null },
      ),
    );
    renderPage();
    expect(await screen.findByRole('link', { name: 'Pagina di prova' })).toHaveAttribute(
      'href',
      '/redazione/notizie/c-1',
    );
  });

  it('senza una veste di redazione l’oggetto resta testo semplice', async () => {
    renderPage();
    await screen.findByText('Ha modificato', { selector: 'td' });
    expect(screen.queryByRole('link', { name: 'Pagina di prova' })).not.toBeInTheDocument();
  });

  it('se le persone non si caricano lo dice accanto al filtro', async () => {
    apiMock.mockImplementation((path: string) =>
      path === '/accounts'
        ? Promise.reject(new ApiError(500, 'ERRORE_INTERNO', 'Errore.'))
        : Promise.resolve({ items: [modifica], nextCursor: null }),
    );
    renderPage();
    expect(await screen.findByText(/elenco delle persone non si è caricato/)).toBeInTheDocument();
  });

  it('senza righe mostra lo stato vuoto', async () => {
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(path === '/accounts' ? { items: persone } : { items: [], nextCursor: null }),
    );
    renderPage();
    expect(
      await screen.findByText('Nessuna operazione corrisponde ai filtri.'),
    ).toBeInTheDocument();
  });

  it('se il registro non si legge mostra l’errore in italiano', async () => {
    apiMock.mockImplementation((path: string) =>
      path === '/accounts'
        ? Promise.resolve({ items: persone })
        : Promise.reject(new ApiError(500, 'ERRORE_INTERNO', 'Errore del servizio.')),
    );
    renderPage();
    expect(await screen.findByText('Errore del servizio.')).toBeInTheDocument();
  });
});
