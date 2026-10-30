'use client';

import { MediaLibrary } from '../../../components/media/MediaLibrary';
import { AreaGate } from '../../../components/AreaShell';

/** Archivio dei media del sito pubblico. */
export default function MediaPage(): React.JSX.Element {
  return (
    <AreaGate area="redazione">
      <MediaLibrary />
    </AreaGate>
  );
}
