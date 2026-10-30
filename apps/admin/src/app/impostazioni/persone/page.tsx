'use client';

import { AccountsScreen } from '../../../components/accounts/AccountsScreen';
import { AreaGate } from '../../../components/AreaShell';

/** Persone e permessi: gli account e i loro ruoli. */
export default function PersonePage(): React.JSX.Element {
  return (
    <AreaGate area="impostazioni">
      <AccountsScreen />
    </AreaGate>
  );
}
