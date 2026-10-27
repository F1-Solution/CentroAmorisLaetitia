'use client';

import {
  Alert,
  Button,
  CheckboxField,
  SidePanel,
  FieldGroup,
  SelectField,
  TextArea,
  TextField,
} from '@amoris/ui';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';

/**
 * «Modifica» di una categoria (DR-280), nel pannello laterale perché il modulo è lungo: nome, descrizione, categoria genitrice con il
 * nuovo indirizzo dell'archivio, e la SEO dell'archivio. Si mandano solo i campi cambiati.
 */

export interface CategoryRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly path: string;
  readonly contentCount: number;
}

interface TermSeo {
  readonly title: string | null;
  readonly description: string | null;
  readonly robotsNoindex: boolean;
  readonly robotsNofollow: boolean;
}

interface SeoForm {
  readonly title: string;
  readonly description: string;
  readonly robotsNoindex: boolean;
  readonly robotsNofollow: boolean;
}

const EMPTY_SEO: SeoForm = {
  title: '',
  description: '',
  robotsNoindex: false,
  robotsNofollow: false,
};
const CONNECTION_ERROR = 'Non è stato possibile contattare il servizio.';
const errorText = (caught: unknown): string =>
  caught instanceof ApiError ? caught.fullMessage : CONNECTION_ERROR;
/** Un campo di testo vuoto si salva come assente. */
const orNull = (value: string): string | null => (value.trim() === '' ? null : value);

function seoFormOf(seo: TermSeo): SeoForm {
  return {
    title: seo.title ?? '',
    description: seo.description ?? '',
    robotsNoindex: seo.robotsNoindex,
    robotsNofollow: seo.robotsNofollow,
  };
}

/** I campi SEO cambiati rispetto a quelli letti. */
function seoChanges(before: SeoForm, after: SeoForm): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (after.title !== before.title) body['title'] = orNull(after.title);
  if (after.description !== before.description) body['description'] = orNull(after.description);
  if (after.robotsNoindex !== before.robotsNoindex) body['robotsNoindex'] = after.robotsNoindex;
  if (after.robotsNofollow !== before.robotsNofollow) body['robotsNofollow'] = after.robotsNofollow;
  return body;
}

/** Riferimento scritto a mano al vecchio indirizzo, che non si riscrive (D132-A). */
export interface CategoryWarning {
  readonly kind: 'canonical' | 'menu';
  readonly id: string;
  readonly value: string;
}

export interface CategoryEditDialogProps {
  readonly category: CategoryRow;
  readonly categories: readonly CategoryRow[];
  /** Spostare cambia un indirizzo pubblico: serve `content.publish` (DR-246). */
  readonly canMove: boolean;
  readonly onClose: () => void;
  readonly onSaved: (warnings: readonly CategoryWarning[]) => void;
}

export function CategoryEditDialog({
  category,
  categories,
  canMove,
  onClose,
  onSaved,
}: CategoryEditDialogProps): React.JSX.Element {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? '');
  const [parentId, setParentId] = useState(category.parentId ?? '');
  const [seoBefore, setSeoBefore] = useState<SeoForm | null>(null);
  const [seo, setSeo] = useState<SeoForm>(EMPTY_SEO);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<TermSeo>(`/terms/${category.id}/seo`)
      .then((read) => {
        if (!alive) return;
        setSeoBefore(seoFormOf(read));
        setSeo(seoFormOf(read));
      })
      .catch((caught: unknown) => {
        if (alive) setError(errorText(caught));
      });
    return () => {
      alive = false;
    };
  }, [category.id]);

  // Né sé stessa né una discendente: l'API rifiuterebbe il ciclo.
  const parents = categories.filter(
    (other) => other.id !== category.id && !other.path.startsWith(category.path),
  );
  const parent = parents.find((other) => other.id === parentId);
  const newPath = `${parent ? parent.path : '/category/'}${category.slug}/`;
  const moves = newPath !== category.path;

  function termChanges(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (name !== category.name) body['name'] = name;
    if (description !== (category.description ?? '')) body['description'] = orNull(description);
    if (parentId !== (category.parentId ?? ''))
      body['parentId'] = parentId === '' ? null : parentId;
    return body;
  }

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const term = termChanges();
      let warnings: readonly CategoryWarning[] = [];
      if (Object.keys(term).length > 0) {
        const saved = await api<{ warnings?: readonly CategoryWarning[] }>(
          `/terms/${category.id}`,
          { method: 'PATCH', body: term },
        );
        warnings = saved?.warnings ?? [];
      }
      const seoBody = seoBefore ? seoChanges(seoBefore, seo) : {};
      if (Object.keys(seoBody).length > 0) {
        await api(`/terms/${category.id}/seo`, { method: 'PUT', body: seoBody });
      }
      onSaved(warnings);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanel open onClose={onClose} title="Modifica categoria" loading={busy}>
      <TextField label="Nome" value={name} onChange={(event) => setName(event.target.value)} />
      <TextArea
        label="Descrizione"
        value={description}
        helpText="Sul sito diventa la descrizione dell'archivio per i motori di ricerca, se la SEO non ne ha una propria."
        onChange={(event) => setDescription(event.target.value)}
      />
      <SelectField
        label="Categoria genitrice"
        value={parentId}
        disabled={!canMove}
        {...(canMove
          ? {}
          : { helpText: 'Per spostare una categoria serve il permesso di pubblicare.' })}
        options={[
          { value: '', label: 'Nessuna: primo livello' },
          ...parents.map((other) => ({ value: other.id, label: other.name })),
        ]}
        onChange={(event) => setParentId(event.target.value)}
      />
      {moves ? (
        <p className="amoris-categories__address">
          L&apos;indirizzo dell&apos;archivio diventerà <strong>{newPath}</strong>; da{' '}
          {category.path} un redirect 301 porterà al nuovo, e così per le sottocategorie.
        </p>
      ) : (
        <p className="amoris-categories__address">
          L&apos;indirizzo dell&apos;archivio resta <strong>{category.path}</strong>.
        </p>
      )}

      <FieldGroup title="SEO dell'archivio">
        <TextField
          label="Titolo SEO"
          value={seo.title}
          helpText="Vuoto: quello del modello SEO delle categorie. Ammette {term_title} e {site_title}."
          disabled={!seoBefore}
          onChange={(event) => setSeo({ ...seo, title: event.target.value })}
        />
        <TextArea
          label="Descrizione SEO"
          value={seo.description}
          disabled={!seoBefore}
          onChange={(event) => setSeo({ ...seo, description: event.target.value })}
        />
        <CheckboxField
          label="Non indicizzare"
          checked={seo.robotsNoindex}
          disabled={!seoBefore}
          onChange={(event) => setSeo({ ...seo, robotsNoindex: event.target.checked })}
        />
        <CheckboxField
          label="Non seguire i collegamenti"
          checked={seo.robotsNofollow}
          disabled={!seoBefore}
          onChange={(event) => setSeo({ ...seo, robotsNofollow: event.target.checked })}
        />
      </FieldGroup>

      {error ? (
        <Alert variant="error" title="Non è stato salvato">
          {error}
        </Alert>
      ) : null}
      <div className="amoris-categories__dialog-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button variant="primary" loading={busy} onClick={() => void save()}>
          Salva
        </Button>
      </div>
    </SidePanel>
  );
}
