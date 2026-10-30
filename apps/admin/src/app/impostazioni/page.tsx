'use client';

import { SiteSettings } from '../../components/settings/SiteSettings';
import { AreaGate } from '../../components/AreaShell';

/** Impostazioni globali del sito. */
export default function ImpostazioniPage(): React.JSX.Element {
  return (
    <AreaGate area="impostazioni">
      <SiteSettings />
    </AreaGate>
  );
}
