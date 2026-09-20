'use client';

import { Alert, PageHeader } from '@amoris/ui';
import { AreaShell } from '../../components/AreaShell';

/**
 * Approdo dell'area Impostazioni. Le sue tre sezioni — persone e permessi,
 * registro delle operazioni, impostazioni del sito — si costruiscono nella
 * `1D-W9`: questa schermata esiste perché l'area sia **raggiungibile**, che è
 * ciò che rende osservabile il vincolo d'ambiente di DR-067.
 */
export default function ImpostazioniPage(): React.JSX.Element {
  return (
    <AreaShell
      area="impostazioni"
      sectionId="sito"
      breadcrumbs={[{ label: 'Impostazioni', href: '/impostazioni' }, { label: 'Sito' }]}
    >
      <PageHeader title="Impostazioni del sito" />
      <Alert variant="info" title="Area raggiungibile, schermate in arrivo">
        Le impostazioni, le persone e il registro delle operazioni si modificano dalla prossima
        wave. L&apos;area esiste già perché è qui che il sistema verifica di essere nell&apos;ambiente
        giusto.
      </Alert>
    </AreaShell>
  );
}
