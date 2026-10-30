'use client';

import { SliderList } from '../../../components/sliders/SliderList';
import { AreaGate } from '../../../components/AreaShell';

/** Caroselli del sito pubblico. */
export default function CarosellaPage(): React.JSX.Element {
  return (
    <AreaGate area="redazione">
      <SliderList />
    </AreaGate>
  );
}
