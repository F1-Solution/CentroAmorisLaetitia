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
import { useEffect, useRef, useState } from 'react';
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
    note: 'Oggi il sito non ha un accesso per i visitatori, quindi nessuno vede questa voce.',
  },
  {
    value: 'roles',
    label: 'Solo ad alcuni ruoli',
    note: 'Oggi il sito non ha un accesso per i visitatori, quindi nessuno vede questa voce, qualunque ruolo si indichi.',
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

  // Una nuova lettura della stessa voce aggiorna solo i campi non toccati;
  // un'altra voce riparte da zero (DR-102).
  const touched = useRef(new Set<string>());
  const shownId = useRef(item.id);

  useEffect(() => {
    const sameItem = shownId.current === item.id;
    shownId.current = item.id;
    if (!sameItem) {
      touched.current.clear();
      setError(null);
      setSaved(false);
    }
    const keep = (field: string) => sameItem && touched.current.has(field);
    if (!keep('label')) setLabel(item.label);
    if (!keep('url')) setUrl(item.url ?? '');
    if (!keep('cssClasses')) setCssClasses(item.cssClasses ?? '');
    if (!keep('newTab')) setNewTab(item.linkTarget === '_blank');
    if (!keep('visibility')) setVisibility(item.visibility);
    if (!keep('visibleToRoles')) setVisibleToRoles(item.visibleToRoles);
  }, [item]);

  function touch(field: string): void {
    touched.current.add(field);
  }

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
      touched.current.clear();
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
        onChange={(event) => {
          touch('label');
          setLabel(event.target.value);
        }}
      />

      {item.kind === 'custom' ? (
        <TextField
          label="Indirizzo"
          value={url}
          disabled={!canWrite || busy}
          onChange={(event) => {
            touch('url');
            setUrl(event.target.value);
          }}
        />
      ) : null}

      <CheckboxField
        label="Apri in una scheda nuova"
        checked={newTab}
        disabled={!canWrite || busy}
        onChange={(event) => {
          touch('newTab');
          setNewTab(event.target.checked);
        }}
      />

      <TextField
        label="Classi CSS"
        value={cssClasses}
        disabled={!canWrite || busy}
        helpText="Facoltative, separate da uno spazio."
        onChange={(event) => {
          touch('cssClasses');
          setCssClasses(event.target.value);
        }}
      />

      <FieldGroup title="Visibilità" description={chosen?.note ?? ''} disabled={!canWrite || busy}>
        <RadioGroup
          legend="Chi vede questa voce"
          value={visibility}
          onChange={(value) => {
            if (!canWrite || busy) return;
            touch('visibility');
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
                  onChange={(event) => {
                    touch('visibleToRoles');
                    setVisibleToRoles(
                      event.target.checked
                        ? [...visibleToRoles, role.key]
                        : visibleToRoles.filter((entry) => entry !== role.key),
                    );
                  }}
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
