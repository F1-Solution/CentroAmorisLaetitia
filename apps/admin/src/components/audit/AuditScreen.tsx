'use client';

import { Alert, Button, DataTable, PageHeader, SelectField, TextField } from '@amoris/ui';
import type { DataTableColumn } from '@amoris/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { AREA_DEFINITIONS, isAreaId } from '../../lib/areas';
import { FILTERABLE_ACTION_OPTIONS, actionLabel } from '../../lib/auditLabels';
import { useSession, vestmentsOf } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import { isConfirmationRequired } from '../accounts/ConfirmIdentityDialog';
import { ContentPicker } from './ContentPicker';
import { actorText, auditErrorMessage, buildQuery, dateTime, objectText } from './auditFormat';
import { NO_FILTERS } from './types';
import type { AuditFilters, AuditItem, AuditList, AuditView, ContentOption } from './types';
import './Audit.css';

interface PersonOption {
  readonly id: string;
  readonly fullName: string;
}

const PEOPLE_FAILED =
  'L’elenco delle persone non si è caricato: il filtro per persona non è disponibile.';
/** DR-396: l'elenco delle persone chiede una conferma recente, che si dà in «Persone e permessi». */
const PEOPLE_NEED_CONFIRMATION =
  'Il filtro per persona chiede una conferma recente: confermala in «Persone e permessi», poi torna qui.';

const VIEWS: readonly { id: AuditView; label: string }[] = [
  { id: 'changes', label: 'Modifiche al sito' },
  { id: 'all', label: 'Tutte le operazioni' },
];

function roleText(item: AuditItem): string {
  if (!item.actorRoleLabel && !item.actorArea) return '—';
  const area =
    item.actorArea && isAreaId(item.actorArea)
      ? AREA_DEFINITIONS[item.actorArea].label
      : item.actorArea;
  return [item.actorRoleLabel, area ? `area ${area}` : null].filter(Boolean).join(', ');
}

/** Il collegamento all'editor: solo per un contenuto presente e a chi ha una veste di redazione. */
function objectCell(item: AuditItem, canOpenEditor: boolean): React.ReactNode {
  const text = objectText(item);
  const isContent = item.entityType === 'content' || item.entityType === 'content_seo';
  if (!canOpenEditor || !isContent || !item.contentType || !item.entityId) return text;
  const section = item.contentType === 'post' ? 'notizie' : 'pagine';
  return <Link href={`/redazione/${section}/${encodeURIComponent(item.entityId)}`}>{text}</Link>;
}

function buildColumns(canOpenEditor: boolean): DataTableColumn<AuditItem>[] {
  return [
    { key: 'when', header: 'Data e ora', render: (row) => dateTime(row.occurredAt) },
    { key: 'who', header: 'Chi', render: (row) => actorText(row) },
    { key: 'role', header: 'Veste e area', render: (row) => roleText(row) },
    { key: 'action', header: 'Operazione', render: (row) => actionLabel(row.action) },
    { key: 'object', header: 'Oggetto', render: (row) => objectCell(row, canOpenEditor) },
    {
      key: 'outcome',
      header: 'Esito',
      render: (row) => (row.outcome === 'success' ? 'Riuscita' : 'Non riuscita'),
    },
  ];
}

/**
 * «Registro delle operazioni»: sola lettura, dalla più recente. La vista per
 * difetto è «Modifiche al sito» (DR-230); i filtri si applicano col pulsante,
 * le pagine si accodano col cursore dell'API.
 */
export function AuditScreen(): React.JSX.Element {
  const [view, setView] = useState<AuditView>('changes');
  const [draft, setDraft] = useState<AuditFilters>(NO_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(NO_FILTERS);
  const [people, setPeople] = useState<readonly PersonOption[]>([]);
  const [peopleFailed, setPeopleFailed] = useState<string | null>(null);
  const [chosenContent, setChosenContent] = useState<ContentOption | null>(null);
  const { user } = useSession();
  const canOpenEditor = vestmentsOf(user).some((vestment) => vestment.area === 'redazione');

  const [items, setItems] = useState<readonly AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Scarta le risposte di una richiesta superata da una più recente.
  const requestId = useRef(0);

  useEffect(() => {
    api<{ items: PersonOption[] }>('/accounts')
      .then((result) => setPeople(result.items))
      .catch((caught: unknown) =>
        setPeopleFailed(isConfirmationRequired(caught) ? PEOPLE_NEED_CONFIRMATION : PEOPLE_FAILED),
      );
  }, []);

  const loadFirst = useCallback(async (nextView: AuditView, filters: AuditFilters) => {
    const mine = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api<AuditList>(buildQuery(nextView, filters));
      if (mine !== requestId.current) return;
      setItems(result.items);
      setNextCursor(result.nextCursor);
    } catch (caught) {
      if (mine !== requestId.current) return;
      setItems([]);
      setNextCursor(null);
      setError(auditErrorMessage(caught));
    } finally {
      if (mine === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirst(view, applied);
  }, [view, applied, loadFirst]);

  async function loadMore(): Promise<void> {
    if (!nextCursor) return;
    const mine = requestId.current;
    setLoadingMore(true);
    try {
      const result = await api<AuditList>(buildQuery(view, applied, nextCursor));
      if (mine !== requestId.current) return;
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
      setError(null);
    } catch (caught) {
      if (mine === requestId.current) setError(auditErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  const set = (patch: Partial<AuditFilters>): void =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <AreaShell
      area="impostazioni"
      sectionId="registro"
      breadcrumbs={[
        { label: 'Impostazioni', href: '/impostazioni' },
        { label: 'Registro delle operazioni' },
      ]}
    >
      <PageHeader
        title="Registro delle operazioni"
        summary="Chi ha fatto che cosa nell’area amministrativa e sul sito, dalla più recente."
        loading={loading}
      />

      <div className="amoris-audit__views" role="group" aria-label="Che cosa mostrare">
        {VIEWS.map((entry) => (
          <Button
            key={entry.id}
            variant={view === entry.id ? 'primary' : 'secondary'}
            aria-pressed={view === entry.id}
            onClick={() => setView(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      <form
        className="amoris-audit__filters"
        aria-label="Filtri del registro"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(draft);
        }}
      >
        <SelectField
          label="Persona"
          {...(peopleFailed ? { helpText: peopleFailed } : {})}
          value={draft.actorUserId}
          onChange={(event) => set({ actorUserId: event.target.value })}
          options={[
            { value: '', label: 'Tutte le persone' },
            ...people.map((person) => ({ value: person.id, label: person.fullName })),
          ]}
        />
        <SelectField
          label="Operazione"
          value={draft.action}
          onChange={(event) => set({ action: event.target.value })}
          options={[{ value: '', label: 'Qualsiasi operazione' }, ...FILTERABLE_ACTION_OPTIONS]}
        />
        <SelectField
          label="Esito"
          value={draft.outcome}
          onChange={(event) => set({ outcome: event.target.value })}
          options={[
            { value: '', label: 'Tutti gli esiti' },
            { value: 'success', label: 'Riuscita' },
            { value: 'failure', label: 'Non riuscita' },
          ]}
        />
        <ContentPicker
          chosen={chosenContent}
          onChange={(option) => {
            setChosenContent(option);
            set({ contentId: option?.id ?? '' });
          }}
        />
        <TextField
          label="Dal giorno"
          type="date"
          value={draft.fromDay}
          onChange={(event) => set({ fromDay: event.target.value })}
        />
        <TextField
          label="Al giorno"
          type="date"
          value={draft.toDay}
          onChange={(event) => set({ toDay: event.target.value })}
        />
        <div className="amoris-audit__filter-actions">
          <Button type="submit">Applica i filtri</Button>
          <Button
            variant="tertiary"
            onClick={() => {
              setDraft(NO_FILTERS);
              setChosenContent(null);
              setApplied(NO_FILTERS);
            }}
          >
            Azzera i filtri
          </Button>
        </div>
      </form>

      {error ? (
        <div className="amoris-audit__error">
          <Alert variant="error" title="Non è stato possibile">
            {error}
          </Alert>
        </div>
      ) : null}

      {!error || items.length > 0 ? (
        <DataTable
          caption="Operazioni registrate, dalla più recente"
          columns={buildColumns(canOpenEditor)}
          rows={[...items]}
          getRowId={(row) => row.id}
          loading={loading}
          emptyText="Nessuna operazione corrisponde ai filtri."
        />
      ) : null}

      {nextCursor ? (
        <div className="amoris-audit__more">
          <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
            Carica altre
          </Button>
        </div>
      ) : null}
    </AreaShell>
  );
}
