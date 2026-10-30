'use client';

import { MenuManager } from '../../../components/menu/MenuManager';
import { AreaGate } from '../../../components/AreaShell';

/** Menu di navigazione del sito pubblico. */
export default function MenuPage(): React.JSX.Element {
  return (
    <AreaGate area="redazione">
      <MenuManager />
    </AreaGate>
  );
}
