'use client';

import { SeoAndRedirects } from '../../../components/seo/SeoAndRedirects';
import { AreaGate } from '../../../components/AreaShell';

/** Template SEO globali e redirect. */
export default function SeoPage(): React.JSX.Element {
  return (
    <AreaGate area="redazione">
      <SeoAndRedirects />
    </AreaGate>
  );
}
