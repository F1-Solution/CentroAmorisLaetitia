'use client';

import { CategoryManager } from '../../../components/terms/CategoryManager';
import { AreaGate } from '../../../components/AreaShell';

/** Categorie delle notizie: creazione e rinomina. */
export default function CategoriePage(): React.JSX.Element {
  return (
    <AreaGate area="redazione">
      <CategoryManager />
    </AreaGate>
  );
}
