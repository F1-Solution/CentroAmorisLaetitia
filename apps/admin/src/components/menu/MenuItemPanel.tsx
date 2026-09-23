'use client';

import {
  Alert,
  Button,
  CheckboxField,
  FieldGroup,
  RadioGroup,
  SidePanel,
  TextField,
} from '@amoris/ui';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import type { MenuItem, MenuVisibility, RoleOption } from './types';

/**
 * Scheda di una voce di menu: etichetta, bersaglio, visibilità.
 *
 * I **quattro** casi di `menu_items.visibility` stanno tutti qui, ognuno con la
 * frase che dice chi vede la voce. L'elenco dei ruoli compare **solo** nel caso
 * `roles`, e non è una comodità: il vincolo `menu_items_roles_only_when_needed`
 * vieta ruoli su una voce che non li usa, e un elenco sempre visibile
 * inviterebbe a scrivere una regola che il database rifiuta.
 */

const VISIBILITY_OPTIONS: readonly { value: MenuVisibility; label: string; note: string }[] = [
  { value: 'public', label: 'Visibile a tutti', note: 'La voce compare a chiunque apra il sito.' },
  {
    value: 'authenticated',
    label: 'Solo a chi ha fatto accesso',
    note: 'La voce compare a chi è entrato, quale che sia il suo ruolo.',
  },
  {
    value: 'roles',
    label: 'Solo ad alcuni ruoli',
    note: 'La voce compare soltanto a chi ha uno dei ruoli indicati qui sotto.',
  },
  { value: 'hidden', label: 'Nascosta', note: 'La voce non compare a nessuno, e resta scritta.' },
];

export interface MenuItemPanelProps {
  readonly item: MenuItem;
  readonly roles: readonly RoleOption[];
  readonly canWrite: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: Partial<MenuItem>) => Promise<void>;
}

export function MenuItemPanel({
  item,
  roles,
  canWrite,
  onClose,
  onSave,
}: MenuItemPanelProps): React.JSX.Element {
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url ?? '');
  const [cssClasses, setCssClasses] = useState(item.cssClasses ?? '');
  const [newTab, setNewTab] = useState(item.linkTarget === '_blank');
  const [visibility, setVisibility] = useState<MenuVisibility>(item.visibility);
  const [visibleToRoles, setVisibleToRoles] = useState<readonly string[]>(item.visibleToRoles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLabel(item.label);
    setUrl(item.url ?? '');
    setCssClasses(item.cssClasses ?? '');
    setNewTab(item.linkTarget === '_blank');
    setVisibility(item.visibility);
    setVisibleToRoles(item.visibleToRoles);
    setError(null);
    setSaved(false);
  }, [item]);

  const chosen = VISIBILITY_OPTIONS.find((option) => option.value === visibility);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await onSave({
        label,
        ...(item.kind === 'custom' ? { url } : {}),
        cssClasses: cssClasses.trim() || null,
        linkTarget: newTab ? '_blank' : null,
        visibility,
        // Fuori dal caso `roles` l'elenco si azzera: è ciò che il vincolo del
        // database pretende, e mandarlo pieno farebbe fallire la richiesta.
        visibleToRoles: visibility === 'roles' ? [...visibleToRoles] : [],
      });
      setSaved(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.fullMessage
          : caught instanceof Error
            ? caught.message
            : 'Operazione non riuscita.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanel open onClose={onClose} title={item.label}>
      {saved ? (
        <Alert variant="success" title="Fatto">
          Modifiche salvate.
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="error" title="Non è stato possibile">
          {error}
        </Alert>
      ) : null}

      <TextField
        label="Etichetta"
        value={label}
        disabled={!canWrite || busy}
        helpText="Il testo che si legge nel menu."
        onChange={(event) => setLabel(event.target.value)}
      />

      {item.kind === 'custom' ? (
        <TextField
          label="Indirizzo"
          value={url}
          disabled={!canWrite || busy}
          onChange={(event) => setUrl(event.target.value)}
        />
      ) : null}

      <CheckboxField
        label="Apri in una scheda nuova"
        checked={newTab}
        disabled={!canWrite || busy}
        onChange={(event) => setNewTab(event.target.checked)}
      />

      <TextField
        label="Classi CSS"
        value={cssClasses}
        disabled={!canWrite || busy}
        helpText="Facoltative, separate da uno spazio."
        onChange={(event) => setCssClasses(event.target.value)}
      />

      <FieldGroup
        title="Visibilità"
        description={chosen?.note ?? ''}
        disabled={!canWrite || busy}
      >
        <RadioGroup
          legend="Chi vede questa voce"
          value={visibility}
          onChange={(value) => {
            if (!canWrite || busy) return;
            setVisibility(value as MenuVisibility);
          }}
          options={VISIBILITY_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            disabled: !canWrite || busy,
          }))}
        />

        {visibility === 'roles' ? (
          <fieldset className="amoris-menu-manager__roles">
            <legend>Ruoli che vedono la voce</legend>
            {roles.length === 0 ? (
              <p>Nessun ruolo disponibile.</p>
            ) : (
              roles.map((role) => (
                <CheckboxField
                  key={role.key}
                  label={role.label}
                  checked={visibleToRoles.includes(role.key)}
                  disabled={!canWrite || busy}
                  onChange={(event) =>
                    setVisibleToRoles(
                      event.target.checked
                        ? [...visibleToRoles, role.key]
                        : visibleToRoles.filter((entry) => entry !== role.key),
                    )
                  }
                />
              ))
            )}
          </fieldset>
        ) : null}
      </FieldGroup>

      <div className="amoris-menu-manager__panel-actions">
        <Button variant="primary" permitted={canWrite} loading={busy} onClick={() => void submit()}>
          Salva la voce
        </Button>
      </div>
    </SidePanel>
  );
}
