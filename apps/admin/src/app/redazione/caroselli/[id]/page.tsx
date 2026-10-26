'use client';

import { use } from 'react';
import { SliderEditor } from '../../../../components/sliders/SliderEditor';

/** Scheda di un carosello: immagini, ordine e testi delle slide. */
export default function CaroselloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = use(params);
  return <SliderEditor sliderId={id} />;
}
