import { DensityProvider } from '@amoris/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MenuItemPanel } from '../src/components/menu/MenuItemPanel';
import type { MenuItem } from '../src/components/menu/types';

/**
 * W8-14 (DR-306): il sito non ha un accesso per i visitatori, quindi le due voci
 * riservate non le vede nessuno; il testo d'aiuto lo dice. Dati inventati.
 */

const item: MenuItem = {
  id: 'i1',
  menuId: 'm1',
  parentId: null,
  position: 0,
  kind: 'custom',
  label: 'Voce di prova',
  contentId: null,
  termId: null,
  url: '/prova/',
  linkTarget: null,
  cssClasses: null,
  visibility: 'public',
  visibleToRoles: [],
};

async function open(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(
    <DensityProvider>
      <MenuItemPanel
        item={item}
        roles={[{ key: 'segreteria', label: 'Segreteria' }]}
        canWrite
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    </DensityProvider>,
  );
  return user;
}

describe('«Chi vede questa voce»: aiuto sulle voci riservate (W8-14)', () => {
  it.each(['Solo a chi ha fatto accesso', 'Solo ad alcuni ruoli'])(
    '«%s» dice che oggi nessun visitatore la vede',
    async (label) => {
      const user = await open();
      await user.click(screen.getByRole('radio', { name: label }));
      expect(
        screen.getByText(/il sito non ha un accesso per i visitatori.*nessuno vede questa voce/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/compare a chi è entrato|compare soltanto a chi ha/)).toBeNull();
    },
  );
});
