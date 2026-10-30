'use client';

import { use } from 'react';
import { SliderEditor } from '../../../../components/sliders/SliderEditor';
import { AreaGate } from '../../../../components/AreaShell';

/** Scheda di un carosello: immagini, ordine e testi delle slide. */
export default function CaroselloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = use(params);
  return (
    <AreaGate area="redazione">
      <SliderEditor sliderId={id} />
    </AreaGate>
  );
}
