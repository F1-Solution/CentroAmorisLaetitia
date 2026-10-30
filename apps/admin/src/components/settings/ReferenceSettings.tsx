'use client';

import { Alert, Button, MediaPicker, SelectField, type MediaPickerItem } from '@amoris/ui';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { siteUrl } from '../../lib/siteUrl';
import type { Setting } from './SiteSettings';

/**
 * «Logo del sito» e «Pagina iniziale» indicano un media e un contenuto (W8-38): si scelgono da
 * elenchi che il servizio offre dentro Impostazioni, invece di scrivere un identificativo interno.
 */

export const LOGO_SETTING_KEY = 'site.logo_media_id';
export const HOME_SETTING_KEY = 'site.home_content_id';

interface LogoChoice {
  readonly id: string;
  readonly title: string | null;
  readonly fileName: string;
  readonly publicPath: string;
}

interface HomeChoice {
  readonly id: string;
  readonly title: string;
  readonly path: string;
}

interface RowProps {
  readonly setting: Setting;
  readonly canWrite: boolean;
  readonly onSaved: () => void;
}

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.fullMessage
    : 'Non è stato possibile contattare il servizio.';
}

/** Salvataggio di un valore, con errore e conferma come le altre impostazioni. */
function useSave(setting: Setting, onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(value: string | null): Promise<void> {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/settings/${encodeURIComponent(setting.key)}`, { method: 'PUT', body: { value } });
      setSaved(true);
      onSaved();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, saved, save };
}

function Outcome({ error, saved }: { error: string | null; saved: boolean }): React.JSX.Element {
  return (
    <>
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
    </>
  );
}

const nameOf = (item: LogoChoice): string => item.title ?? item.fileName;

/** «Logo del sito»: un'immagine pubblica scelta dal selettore dei media, oppure nessun logo. */
export function LogoSettingRow({ setting, canWrite, onSaved }: RowProps): React.JSX.Element {
  const [chosen, setChosen] = useState<LogoChoice | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(
    typeof setting.value === 'string' && setting.value !== '' ? setting.value : null,
  );
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<readonly LogoChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const { busy, error, saved, save } = useSave(setting, onSaved);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        void (async () => {
          setLoading(true);
          const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
          try {
            const result = await api<{ items: LogoChoice[]; current: LogoChoice | null }>(
              `/settings/choices/logo${query}`,
              { signal: controller.signal },
            );
            if (controller.signal.aborted) return;
            setItems(result.items);
            setLoadError(undefined);
            // Il nome del logo attuale arriva con il primo elenco.
            setChosen((previous) => previous ?? result.current);
          } catch (caught) {
            if (!controller.signal.aborted) setLoadError(messageOf(caught));
          } finally {
            if (!controller.signal.aborted) setLoading(false);
          }
        })();
      },
      search ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const shown = chosen && chosen.id === chosenId ? chosen : null;

  return (
    <li className="amoris-settings__row">
      <h3 className="amoris-settings__label">{setting.label}</h3>
      {setting.description ? (
        <p className="amoris-settings__description">{setting.description}</p>
      ) : null}
      {shown ? (
        <div className="amoris-settings__media">
          <img className="amoris-settings__thumb" src={siteUrl(shown.publicPath)} alt="" />
          <span>{nameOf(shown)}</span>
        </div>
      ) : chosenId && loading ? null : (
        <p className="amoris-settings__description">
          {chosenId ? 'Immagine attuale non disponibile.' : 'Nessun logo.'}
        </p>
      )}
      <div className="amoris-settings__actions">
        <Button
          variant="tertiary"
          permitted={canWrite}
          disabled={busy}
          onClick={() => setPicking(true)}
        >
          Scegli il logo
        </Button>
        {chosenId ? (
          <Button
            variant="tertiary"
            permitted={canWrite}
            disabled={busy}
            onClick={() => setChosenId(null)}
          >
            Togli il logo
          </Button>
        ) : null}
      </div>

      <Outcome error={error} saved={saved} />

      <Button
        variant="secondary"
        permitted={canWrite}
        loading={busy}
        onClick={() => void save(chosenId)}
      >
        Salva «{setting.label}»
      </Button>

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        requireAlt={false}
        loading={loading}
        {...(loadError !== undefined ? { errorText: loadError } : {})}
        emptyText="Nessuna immagine pubblica trovata."
        items={items.map<MediaPickerItem>((item) => ({
          id: item.id,
          thumbnailUrl: siteUrl(item.publicPath),
          title: nameOf(item),
        }))}
        searchValue={search}
        onSearchChange={setSearch}
        onSelect={(item) => {
          const found = items.find((entry) => entry.id === item.id) ?? null;
          setChosen(found);
          setChosenId(item.id);
          setPicking(false);
        }}
      />
    </li>
  );
}

/** «Pagina iniziale»: una delle pagine pubblicate. */
export function HomeSettingRow({ setting, canWrite, onSaved }: RowProps): React.JSX.Element {
  const [value, setValue] = useState(typeof setting.value === 'string' ? setting.value : '');
  const [pages, setPages] = useState<readonly HomeChoice[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, saved, save } = useSave(setting, onSaved);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await api<{ items: HomeChoice[]; current: HomeChoice | null }>(
          '/settings/choices/home',
          { signal: controller.signal },
        );
        // L'elenco ha un tetto: la pagina attuale arriva a parte e si mostra per prima se manca.
        const { items, current } = result;
        const missing = current && !items.some((page) => page.id === current.id);
        if (!controller.signal.aborted) setPages(missing ? [current, ...items] : items);
      } catch (caught) {
        if (!controller.signal.aborted) setLoadError(messageOf(caught));
      }
    })();
    return () => controller.abort();
  }, []);

  const known = pages.some((page) => page.id === value);
  const options = [
    // Un valore che non è fra le pagine pubblicate non si mostra come se lo fosse.
    ...(known ? [] : [{ value, label: 'Scegli una pagina pubblicata' }]),
    ...pages.map((page) => ({ value: page.id, label: `${page.title} (${page.path})` })),
  ];

  return (
    <li className="amoris-settings__row">
      <SelectField
        label={setting.label}
        options={options}
        value={value}
        disabled={!canWrite || busy}
        {...(loadError ? { errorText: loadError } : {})}
        onChange={(event) => setValue(event.target.value)}
      />
      {setting.description ? (
        <p className="amoris-settings__description">{setting.description}</p>
      ) : null}

      <Outcome error={error} saved={saved} />

      <Button
        variant="secondary"
        permitted={canWrite}
        loading={busy}
        onClick={() => void save(value)}
      >
        Salva «{setting.label}»
      </Button>
    </li>
  );
}
