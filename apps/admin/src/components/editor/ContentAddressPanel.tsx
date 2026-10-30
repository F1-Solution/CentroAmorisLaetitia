'use client';

import { Alert, Button, Dialog, SelectField, TextField } from '@amoris/ui';
import { useEffect, useId, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { ContentDetail } from '../../lib/editor/roundtrip';
import { useSession } from '../../lib/session';

/**
 * Slug e, per una pagina, genitore (wave 1G-W3): si salvano da soli, come il layout, e
 * chiedono conferma se cambia indirizzo un contenuto pubblicato o cambiano regole esistenti (S6 esteso).
 */

/** Rispecchia `AddressPlan` di packages/contracts/src/contentAddress.ts. */
export interface AddressPlan {
  readonly path: string;
  readonly moves: readonly {
    readonly id: string;
    readonly title: string;
    readonly from: string;
    readonly to: string;
    readonly published: boolean;
  }[];
  readonly redirectsCreated: readonly { readonly from: string; readonly to: string }[];
  readonly redirectsRetargeted: readonly {
    readonly source: string;
    readonly from: string;
    readonly to: string;
    readonly origin: string;
  }[];
  readonly redirectsRemoved: readonly { readonly source: string; readonly target: string }[];
  readonly warnings: readonly {
    readonly kind: 'canonical' | 'menu';
    readonly id: string;
    readonly value: string;
  }[];
}

/** Rispecchia `AddressOption` di packages/contracts/src/contentAddress.ts. */
interface AddressOption {
  readonly id: string;
  readonly title: string;
  readonly path: string;
}

interface AddressTarget {
  readonly slug: string;
  readonly parentId: string | null;
}

interface AddressChange {
  readonly content: ContentDetail;
  readonly plan: AddressPlan;
}

interface FieldErrors {
  readonly slug?: string;
  readonly parent?: string;
  readonly general?: string;
}

interface PlanItem {
  readonly key: string;
  readonly text: string;
}

const NO_PARENT = '';

/** I codici del W3-PLAN §5 che riguardano un campo; gli altri si leggono nell'avviso della scheda. */
const FIELD_OF_CODE: Readonly<Record<string, 'slug' | 'parent'>> = {
  VALIDATION_FAILED: 'slug',
  CONTENT_SLUG_RESERVED: 'slug',
  CONTENT_PATH_TAKEN: 'slug',
  CONTENT_PARENT_INVALID: 'parent',
};

const WARNINGS_TITLE = 'Riferimenti scritti a mano che non cambiano';

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.fullMessage
    : 'Non è stato possibile contattare il servizio.';
}

/** Il messaggio dell'API, già in italiano, accanto al campo a cui si riferisce. */
function errorsOf(caught: unknown, hasParentField: boolean): FieldErrors {
  if (!(caught instanceof ApiError)) return { general: messageOf(caught) };
  const field = FIELD_OF_CODE[caught.code];
  if (field === 'slug') {
    const reasons = caught.details.map((detail) => detail.message);
    return { slug: reasons.length > 0 ? reasons.join('; ') : caught.message };
  }
  if (field === 'parent' && hasParentField) return { parent: caught.message };
  return { general: messageOf(caught) };
}

function movesPublished(plan: AddressPlan): boolean {
  return plan.moves.some((move) => move.published && move.from !== move.to);
}

function touchesRules(plan: AddressPlan): boolean {
  return plan.redirectsRetargeted.length > 0 || plan.redirectsRemoved.length > 0;
}

/** S6 esteso (D135-A): conferma se cambia indirizzo un contenuto pubblicato o cambiano regole esistenti. */
function needsConfirmation(plan: AddressPlan): boolean {
  return movesPublished(plan) || touchesRules(plan);
}

/** Che cosa il piano chiede oltre a `content.write` e il ruolo attivo non ha (D138-A). */
function missingPermissions(plan: AddressPlan, permissions: readonly string[]): string[] {
  const missing: string[] = [];
  if (touchesRules(plan) && !permissions.includes('settings.write')) {
    missing.push(
      'Il cambio riscrive o toglie redirect già presenti: serve il permesso di gestire SEO e redirect.',
    );
  }
  if (movesPublished(plan) && !permissions.includes('content.publish')) {
    missing.push('Il cambio sposta un contenuto pubblicato: serve il permesso di pubblicare.');
  }
  return missing;
}

/** L'esito in parole: una bozza non ha ancora un indirizzo pubblico, la pagina iniziale resta a `/` (S3). */
function savedText(content: ContentDetail, isHome: boolean): string {
  if (content.status !== 'published') {
    return `L'indirizzo ora è ${content.path}; sarà pubblico quando il contenuto verrà pubblicato.`;
  }
  if (isHome) {
    return `È la pagina iniziale: l'indirizzo pubblico resta /, e ${content.path} porta lì.`;
  }
  return `L'indirizzo pubblico ora è ${content.path}.`;
}

const retargetedItems = (plan: AddressPlan): PlanItem[] =>
  plan.redirectsRetargeted.map((rule) => ({
    key: rule.source,
    text: `${rule.source}: ora porta a ${rule.to} invece che a ${rule.from}`,
  }));

const removedItems = (plan: AddressPlan): PlanItem[] =>
  plan.redirectsRemoved.map((rule) => ({
    key: rule.source,
    text: `${rule.source} → ${rule.target}`,
  }));

function warningItems(plan: AddressPlan): PlanItem[] {
  return plan.warnings.map((warning) => ({
    key: `${warning.kind}-${warning.id}`,
    text:
      warning.kind === 'canonical'
        ? `L'indirizzo canonico di un contenuto indica ancora ${warning.value}.`
        : `Una voce di menu personalizzata indica ancora ${warning.value}.`,
  }));
}

/** Un elenco con il suo titolo, che gli dà il nome; nulla se è vuoto. */
function PlanList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly PlanItem[];
}): React.JSX.Element | null {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <>
      <h3 id={id} className="amoris-editor__address-heading">
        {title}
      </h3>
      <ul aria-labelledby={id} className="amoris-editor__address-list">
        {items.map((item) => (
          <li key={item.key}>{item.text}</li>
        ))}
      </ul>
    </>
  );
}

interface ConfirmAddressDialogProps {
  readonly plan: AddressPlan;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Che cosa cambia sul sito pubblico, prima di scriverlo. */
function ConfirmAddressDialog({
  plan,
  busy,
  onCancel,
  onConfirm,
}: ConfirmAddressDialogProps): React.JSX.Element {
  const warnings = warningItems(plan);
  return (
    <Dialog
      open
      onClose={() => !busy && onCancel()}
      title="Cambia l'indirizzo pubblico"
      loading={busy}
    >
      <p>
        {movesPublished(plan)
          ? 'Un contenuto pubblicato cambia indirizzo: chi apre il vecchio indirizzo viene portato al nuovo.'
          : 'Nessun contenuto pubblicato cambia indirizzo, ma cambiano dei redirect già presenti sul sito.'}
      </p>
      <PlanList
        title="Indirizzi che cambiano"
        items={plan.moves
          .filter((move) => move.from !== move.to)
          .map((move) => ({
            key: move.id,
            text: `${move.title}: ${move.from} → ${move.to}${move.published ? '' : ' (non pubblicato, nessun redirect)'}`,
          }))}
      />
      <PlanList
        title="Redirect che nascono"
        items={plan.redirectsCreated.map((rule) => ({
          key: rule.from,
          text: `${rule.from} → ${rule.to}`,
        }))}
      />
      <PlanList title="Redirect che cambiano destinazione" items={retargetedItems(plan)} />
      <PlanList title="Redirect che si tolgono" items={removedItems(plan)} />
      {warnings.length > 0 ? (
        <>
          <PlanList title={WARNINGS_TITLE} items={warnings} />
          <p>Non si riscrivono da soli: il redirect porta comunque al nuovo indirizzo.</p>
        </>
      ) : null}
      <div className="amoris-editor__address-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Annulla
        </Button>
        <Button onClick={onConfirm} loading={busy}>
          Cambia l&apos;indirizzo
        </Button>
      </div>
    </Dialog>
  );
}

export interface ContentAddressPanelProps {
  readonly contentId: string;
  readonly type: ContentDetail['type'];
  /** Slug e genitore salvati. */
  readonly slug: string;
  readonly parentId: string | null;
  /** Pagina iniziale: il sito la serve a `/` (S3). */
  readonly isHome: boolean;
  readonly disabled: boolean;
  /** L'editor salva o ricarica il contenuto: una lettura vecchia riporterebbe l'indirizzo di prima. */
  readonly paused: boolean;
  /** Il contenuto dopo lo spostamento, come lo restituisce l'API. */
  readonly onSaved: (content: ContentDetail) => void;
}

export function ContentAddressPanel({
  contentId,
  type,
  slug: savedSlug,
  parentId: savedParentId,
  isHome,
  disabled,
  paused,
  onSaved,
}: ContentAddressPanelProps): React.JSX.Element {
  const { user } = useSession();
  const permissions = user?.permissions ?? [];
  const isPage = type === 'page';
  const [slug, setSlug] = useState(savedSlug);
  const [parentId, setParentId] = useState(savedParentId ?? NO_PARENT);
  const [options, setOptions] = useState<readonly AddressOption[] | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState<{
    readonly plan: AddressPlan;
    readonly target: AddressTarget;
  } | null>(null);
  const [outcome, setOutcome] = useState<AddressChange | null>(null);
  const [missing, setMissing] = useState<readonly string[]>([]);

  useEffect(() => setSlug(savedSlug), [savedSlug]);
  useEffect(() => setParentId(savedParentId ?? NO_PARENT), [savedParentId]);

  useEffect(() => {
    if (!isPage) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const list = await api<{ readonly items: readonly AddressOption[] }>(
          `/contents/${contentId}/address/options`,
          { signal: controller.signal },
        );
        setOptions(list.items);
      } catch (caught) {
        if (!controller.signal.aborted) setOptionsError(messageOf(caught));
      }
    })();
    return () => controller.abort();
  }, [contentId, isPage]);

  const target: AddressTarget = {
    slug: slug.trim(),
    parentId: parentId === NO_PARENT ? null : parentId,
  };
  const changed = target.slug !== savedSlug || target.parentId !== savedParentId;
  // Solo un'indicazione: l'indirizzo vero lo calcola l'anteprima dell'API.
  const parentPath =
    target.parentId === null ? '/' : options?.find((option) => option.id === parentId)?.path;
  const ownPath = parentPath !== undefined && target.slug ? `${parentPath}${target.slug}/` : '—';
  const resulting = isHome ? '/' : ownPath;
  const locked = disabled || busy || paused;

  async function apply(next: AddressTarget): Promise<void> {
    setBusy(true);
    try {
      const result = await api<AddressChange>(`/contents/${contentId}/address`, {
        method: 'PUT',
        body: next,
      });
      setOutcome(result);
      onSaved(result.content);
    } catch (caught) {
      setErrors(errorsOf(caught, isPage));
    } finally {
      setConfirming(null);
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    setErrors({});
    setOutcome(null);
    setMissing([]);
    if (!target.slug) {
      setErrors({ slug: "Lo slug non può essere vuoto: è l'ultima parte dell'indirizzo." });
      return;
    }
    const next = target;
    setBusy(true);
    let plan: AddressPlan;
    try {
      const query = new URLSearchParams({ slug: next.slug });
      if (next.parentId) query.set('parentId', next.parentId);
      plan = await api<AddressPlan>(`/contents/${contentId}/address/preview?${query.toString()}`);
    } catch (caught) {
      setErrors(errorsOf(caught, isPage));
      setBusy(false);
      return;
    }
    const lacking = missingPermissions(plan, permissions);
    if (lacking.length > 0) {
      setMissing(lacking);
      setBusy(false);
      return;
    }
    if (needsConfirmation(plan)) {
      setConfirming({ plan, target: next });
      setBusy(false);
      return;
    }
    await apply(next);
  }

  const warnings = outcome ? warningItems(outcome.plan) : [];

  return (
    <section className="amoris-editor__address" aria-label="Indirizzo del contenuto">
      {optionsError ? (
        <Alert variant="error" title="Le pagine genitore non si caricano">
          {optionsError}
        </Alert>
      ) : null}
      {errors.general ? (
        <Alert variant="error" title="Indirizzo non salvato">
          {errors.general}
        </Alert>
      ) : null}
      {missing.length > 0 ? (
        <Alert variant="warning" title="Serve un permesso che il tuo ruolo non ha">
          <ul className="amoris-editor__address-list">
            {missing.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {outcome ? (
        <Alert variant="success" title="Indirizzo salvato">
          <p>{savedText(outcome.content, outcome.content.isHome ?? isHome)}</p>
          {/* Anche senza conferma si dice quali regole esistenti sono cambiate (D135-A). */}
          <PlanList
            title="Redirect che cambiano destinazione"
            items={retargetedItems(outcome.plan)}
          />
          <PlanList title="Redirect che si tolgono" items={removedItems(outcome.plan)} />
        </Alert>
      ) : null}
      {warnings.length > 0 ? (
        <Alert variant="warning" title="Da controllare a mano">
          <PlanList title={WARNINGS_TITLE} items={warnings} />
          <p>Non si riscrivono da soli: il redirect porta comunque al nuovo indirizzo.</p>
        </Alert>
      ) : null}

      <TextField
        label="Slug"
        value={slug}
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
        disabled={locked}
        helpText="L'ultima parte dell'indirizzo, di solito parole minuscole separate da trattini."
        {...(errors.slug ? { errorText: errors.slug } : {})}
        onChange={(event) => setSlug(event.target.value)}
      />
      {isPage && options ? (
        <SelectField
          label="Pagina genitore"
          options={[
            { value: NO_PARENT, label: 'Nessuna, primo livello' },
            ...options.map((option) => ({
              value: option.id,
              label: option.title ? `${option.title} — ${option.path}` : option.path,
            })),
          ]}
          value={parentId}
          disabled={locked}
          helpText="Le pagine che stanno sotto questa non compaiono: una pagina non può avere come genitore una sua discendente."
          {...(errors.parent ? { errorText: errors.parent } : {})}
          onChange={(event) => setParentId(event.target.value)}
        />
      ) : null}
      {isPage && !options && !optionsError ? <p>Caricamento delle pagine in corso…</p> : null}

      <p className="amoris-editor__address-result">
        Indirizzo risultante: <strong>{resulting}</strong>
      </p>
      {isHome ? <p>È la pagina iniziale: il sito la mostra sempre a /.</p> : null}

      <div className="amoris-editor__address-actions">
        <Button
          variant="primary"
          permitted={!disabled}
          loading={busy}
          disabled={!changed || paused}
          onClick={() => void save()}
        >
          Salva l&apos;indirizzo
        </Button>
      </div>

      {confirming ? (
        <ConfirmAddressDialog
          plan={confirming.plan}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void apply(confirming.target)}
        />
      ) : null}
    </section>
  );
}
