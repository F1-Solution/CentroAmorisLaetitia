'use client';

import type { PostListBlock } from '@amoris/blocks';
import { Alert, CheckboxField, FieldGroup } from '@amoris/ui';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { CheckedTextField } from './embedInspectorParts';

export interface PostListInspectorProps {
  readonly block: PostListBlock;
  readonly onChange: (next: PostListBlock) => void;
  readonly disabled: boolean;
}

interface CategoryOption {
  readonly id: string;
  readonly name: string;
}

/** Un intero fra `min` e `max`, o vuoto: `undefined` se il testo non è ammesso. */
function optionalInteger(text: string, min: number, max: number): number | null | undefined {
  if (text.trim() === '') return null;
  if (!/^\d+$/.test(text.trim())) return undefined;
  const value = Number(text);
  return value >= min && value <= max ? value : undefined;
}

/** Categorie e numero di notizie di un blocco «Elenco di contenuti» (DR-320). */
export function PostListInspector({
  block,
  onChange,
  disabled,
}: PostListInspectorProps): React.JSX.Element {
  const [categories, setCategories] = useState<readonly CategoryOption[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const { termIds } = block.props;
  const setProps = (next: Partial<PostListBlock['props']>) =>
    onChange({ ...block, props: { ...block.props, ...next } });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const list = await api<readonly CategoryOption[]>('/terms?taxonomy=category', {
          signal: controller.signal,
        });
        setCategories(list);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setCategoriesError(
            caught instanceof ApiError ? caught.fullMessage : 'Le categorie non si sono caricate.',
          );
        }
      }
    })();
    return () => controller.abort();
  }, []);

  // Una categoria scelta che non esiste più resta visibile, per poterla togliere.
  const missing = categories
    ? termIds.filter((id) => !categories.some((category) => category.id === id))
    : [];

  function toggle(id: string, checked: boolean): void {
    setProps({
      termIds: checked ? [...termIds, id] : termIds.filter((termId) => termId !== id),
    });
  }

  return (
    <div className="amoris-inspector">
      <FieldGroup
        title="Categorie"
        description="Se non ne scegli nessuna, l’elenco mostra le notizie di tutte le categorie."
        disabled={disabled}
      >
        {categoriesError ? (
          <Alert variant="error" title="Categorie non disponibili">
            {categoriesError}
          </Alert>
        ) : null}
        {categories === null && !categoriesError ? (
          <p>Caricamento delle categorie in corso…</p>
        ) : null}
        {categories?.length === 0 ? (
          <p>Non ci sono ancora categorie: si creano dalla schermata «Categorie».</p>
        ) : null}
        {categories?.map((category) => (
          <CheckboxField
            key={category.id}
            label={category.name}
            checked={termIds.includes(category.id)}
            onChange={(event) => toggle(category.id, event.target.checked)}
          />
        ))}
        {missing.map((id) => (
          <CheckboxField
            key={id}
            label="Categoria non trovata"
            checked
            onChange={(event) => toggle(id, event.target.checked)}
          />
        ))}
      </FieldGroup>
      <CheckedTextField
        label="Numero di notizie"
        type="number"
        min={1}
        max={50}
        value={block.props.limit === null ? '' : String(block.props.limit)}
        disabled={disabled}
        helpText="Da 1 a 50. Se lo lasci vuoto, ne mostra quante una pagina dell’archivio."
        validate={(text) =>
          optionalInteger(text, 1, 50) === undefined
            ? 'Il numero di notizie è un intero da 1 a 50, o vuoto.'
            : null
        }
        onCommit={(text) => setProps({ limit: optionalInteger(text, 1, 50) ?? null })}
      />
    </div>
  );
}
