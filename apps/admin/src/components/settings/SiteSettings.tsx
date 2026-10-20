'use client';

import { Alert, Button, CheckboxField, PageHeader, TextArea, TextField } from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import './SiteSettings.css';

/**
 * Impostazioni globali del sito: il criterio 1D-35.
 *
 * Il valore è `jsonb`, quindi il campo con cui si modifica **si deduce dal
 * valore**, non da una tabella scritta a mano: una spunta per un booleano, un
 * campo numerico per un numero, un'area di testo per il resto. Una tabella di
 * tipi andrebbe aggiornata a ogni impostazione nuova, e la prima dimenticata
 * darebbe alla persona una casella di testo dove serviva una spunta.
 *
 * Le impostazioni marcate come riservate non mostrano il valore e non si
 * modificano da qui: il servizio non lo fa neppure uscire.
 */

export interface Setting {
  readonly key: string;
  readonly value: unknown;
  readonly label: string;
  readonly description: string | null;
  readonly isSecret: boolean;
  readonly updatedAt: string;
}

/** Impostazioni conservate ma nascoste da questa schermata, perché il sito non le legge (DR-192, DR-176). */
export const HIDDEN_SETTING_KEYS: ReadonlySet<string> = new Set([
  'seo.robots_txt',
  'seo.sitemap_enabled',
]);

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.fullMessage
    : 'Non è stato possibile contattare il servizio.';
}

/** Testo da mostrare in un campo, per un valore che non è né booleano né numero. */
export function textOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

/**
 * Riporta il testo al tipo di partenza. Un'impostazione nata stringa resta
 * stringa: se il testo non è JSON valido dove JSON serviva, si risale con un
 * errore invece di scrivere una stringa dove c'era un oggetto.
 */
export function valueFrom(original: unknown, text: string): unknown {
  if (typeof original === 'string' || original === null) return text;
  return JSON.parse(text);
}

interface RowProps {
  readonly setting: Setting;
  readonly canWrite: boolean;
  readonly onSaved: () => void;
}

function SettingRow({ setting, canWrite, onSaved }: RowProps): React.JSX.Element {
  const [text, setText] = useState(textOf(setting.value));
  const [flag, setFlag] = useState(setting.value === true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isBoolean = typeof setting.value === 'boolean';
  const isNumber = typeof setting.value === 'number';
  const isLong = typeof setting.value === 'string' && setting.value.includes('\n');

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const value = isBoolean ? flag : isNumber ? Number(text) : valueFrom(setting.value, text);
      if (isNumber && Number.isNaN(value)) throw new Error('Il valore deve essere un numero.');
      await api(`/settings/${encodeURIComponent(setting.key)}`, { method: 'PUT', body: { value } });
      setSaved(true);
      onSaved();
    } catch (caught) {
      setError(caught instanceof SyntaxError ? 'Il valore non è JSON valido.' : messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  if (setting.isSecret) {
    return (
      <li className="amoris-settings__row">
        <h3 className="amoris-settings__label">{setting.label}</h3>
        {setting.description ? (
          <p className="amoris-settings__description">{setting.description}</p>
        ) : null}
        <p className="amoris-settings__secret">
          Il valore è riservato: non esce dal servizio e non si modifica da questa schermata.
        </p>
      </li>
    );
  }

  return (
    <li className="amoris-settings__row">
      {isBoolean ? (
        <CheckboxField
          label={setting.label}
          checked={flag}
          disabled={!canWrite || busy}
          onChange={(event) => setFlag(event.target.checked)}
        />
      ) : isLong ? (
        <TextArea
          label={setting.label}
          value={text}
          rows={6}
          disabled={!canWrite || busy}
          onChange={(event) => setText(event.target.value)}
        />
      ) : (
        <TextField
          label={setting.label}
          value={text}
          inputMode={isNumber ? 'numeric' : undefined}
          disabled={!canWrite || busy}
          onChange={(event) => setText(event.target.value)}
        />
      )}

      {setting.description ? (
        <p className="amoris-settings__description">{setting.description}</p>
      ) : null}

      {error ? (
        <Alert variant="error" title="Non è stata salvata">
          {error}
        </Alert>
      ) : null}
      {saved ? (
        <p className="amoris-settings__saved" role="status">
          Salvata.
        </p>
      ) : null}

      <Button variant="secondary" permitted={canWrite} loading={busy} onClick={() => void save()}>
        Salva «{setting.label}»
      </Button>
    </li>
  );
}

export function SiteSettings(): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('site.settings.write') ?? false;

  const [rows, setRows] = useState<readonly Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api<Setting[]>('/settings');
      setRows(all.filter((setting) => !HIDDEN_SETTING_KEYS.has(setting.key)));
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AreaShell
      area="impostazioni"
      sectionId="sito"
      breadcrumbs={[{ label: 'Impostazioni', href: '/impostazioni' }, { label: 'Sito' }]}
    >
      <PageHeader
        title="Impostazioni del sito"
        summary="I valori globali che il sito pubblico legge."
        loading={loading}
      />

      {error ? (
        <Alert variant="error" title="Non è stato possibile">
          {error}
        </Alert>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <Alert variant="info" title="Nessuna impostazione">
          Le impostazioni globali nascono con l&apos;importazione del sito.
        </Alert>
      ) : null}

      <ul className="amoris-settings__list">
        {rows.map((setting) => (
          <SettingRow
            key={setting.key}
            setting={setting}
            canWrite={canWrite}
            onSaved={() => void load()}
          />
        ))}
      </ul>
    </AreaShell>
  );
}
