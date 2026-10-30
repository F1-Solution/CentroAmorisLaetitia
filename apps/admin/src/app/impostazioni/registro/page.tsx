'use client';

import { AuditScreen } from '../../../components/audit/AuditScreen';
import { AreaGate } from '../../../components/AreaShell';

/** Registro delle operazioni: sola lettura, per l'amministrazione. */
export default function RegistroPage(): React.JSX.Element {
  return (
    <AreaGate area="impostazioni">
      <AuditScreen />
    </AreaGate>
  );
}
