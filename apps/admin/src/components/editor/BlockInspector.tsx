'use client';

import { Alert, ColumnRatioControl, HtmlFallbackEditor, RadioGroup, SelectField } from '@amoris/ui';
import type { BlockNode as ModelBlock } from '@amoris/blocks';
import Link from 'next/link';
import { useSliders } from '../sliders/useSliders';
import { DocumentBlockInspector } from './DocumentBlockInspector';
import { ImageInspector } from './ImageInspector';
import { MapInspector } from './MapInspector';
import { MediaTextInspector } from './MediaTextInspector';
import { PostListInspector } from './PostListInspector';
import { RichTextEditor } from './RichTextEditor';
import { VideoInspector } from './VideoInspector';
import './BlockInspector.css';

export interface BlockInspectorProps {
  readonly block: ModelBlock | null;
  readonly onChange: (next: ModelBlock) => void;
  /** Cambia la ripartizione delle colonne di una riga (ADR-006 §3.2). */
  readonly onColumnStructureChange: (rowId: string, structure: string) => void;
  readonly disabled?: boolean;
}

const RATIO_OPTIONS = [
  { value: '4_4', label: 'Una colonna' },
  { value: '2_4,2_4', label: 'Due colonne uguali' },
  { value: '1_3,2_3', label: 'Un terzo e due terzi' },
  { value: '2_3,1_3', label: 'Due terzi e un terzo' },
  { value: '1_3,1_3,1_3', label: 'Tre colonne' },
];

const SEPARATOR_OPTIONS = [
  { value: 'default', label: 'Normale' },
  { value: 'wide', label: 'Largo' },
  { value: 'dots', label: 'Puntini' },
];

/** Che cosa si può fare dei blocchi senza pannello, con il loro nome italiano (DR-320). */
const NOT_EDITABLE_HERE: Readonly<Record<'section' | 'column' | 'form', string>> = {
  section:
    'Il blocco «Sezione» contiene altri blocchi: per modificarli, sceglili nell’albero. La sezione si può spostare o eliminare.',
  column:
    'Il blocco «Colonna» contiene altri blocchi: per modificarli, sceglili nell’albero. La colonna si può spostare o eliminare.',
  form: 'I campi del modulo non si modificano in questa fase: il blocco «Modulo» si può spostare o eliminare.',
};

/** Scelta del carosello di un blocco «slider» e collegamento alla schermata delle sue immagini. */
function SliderInspector({
  sliderId,
  disabled,
  onChoose,
}: {
  readonly sliderId: string;
  readonly disabled: boolean;
  readonly onChoose: (sliderId: string) => void;
}): React.JSX.Element {
  const { sliders, error } = useSliders();
  const known = sliders?.some((slider) => slider.id === sliderId) ?? false;
  const options = [
    ...(sliders ?? []).map((slider) => ({ value: slider.id, label: slider.title })),
    ...(!known
      ? [{ value: sliderId, label: sliders ? 'Carosello non trovato' : 'Caricamento in corso…' }]
      : []),
  ];
  return (
    <div className="amoris-inspector">
      {error ? (
        <Alert variant="error" title="I caroselli non si sono caricati">
          {error}
        </Alert>
      ) : null}
      <SelectField
        label="Carosello"
        value={sliderId}
        options={options}
        disabled={disabled}
        onChange={(event) => onChoose(event.target.value)}
      />
      {/* In una scheda nuova, come «Anteprima sul sito»: un blocco appena inserito non si perde. */}
      <Link href={`/redazione/caroselli/${sliderId}`} target="_blank" rel="noopener noreferrer">
        Modifica le immagini del carosello
      </Link>
      <p className="amoris-inspector__note">
        L’anteprima qui accanto non mostra le immagini: si vedono con «Anteprima sul sito» e dopo la
        pubblicazione.
      </p>
    </div>
  );
}

/**
 * Che cosa si modifica del blocco selezionato.
 *
 * Il perimetro è quello di ADR-006 §3.2: **testo e immagini dentro i blocchi
 * esistenti**, non la modifica fine degli stili. Sezioni e colonne si modificano
 * nei blocchi che contengono; i campi di un modulo non si modificano in questa
 * fase, e il pannello lo **dice** con il nome italiano del blocco (DR-320).
 */
export function BlockInspector({
  block,
  onChange,
  onColumnStructureChange,
  disabled = false,
}: BlockInspectorProps): React.JSX.Element {
  if (!block) {
    return (
      <p className="amoris-inspector__empty">Scegliere un blocco nell’albero per modificarlo.</p>
    );
  }

  switch (block.type) {
    case 'rich_text':
      return (
        <div className="amoris-inspector">
          <RichTextEditor
            value={block.props.html}
            disabled={disabled}
            onChange={(html) => onChange({ ...block, props: { ...block.props, html } })}
          />
        </div>
      );

    case 'html':
      return (
        <div className="amoris-inspector">
          <HtmlFallbackEditor
            value={block.props.html}
            disabled={disabled}
            onChange={(html) => onChange({ ...block, props: { ...block.props, html } })}
          />
        </div>
      );

    case 'image':
      return (
        <ImageInspector key={block.id} block={block} onChange={onChange} disabled={disabled} />
      );

    case 'separator':
      return (
        <div className="amoris-inspector">
          <RadioGroup
            legend="Tipo di separatore"
            name={`separator-${block.id}`}
            value={block.props.style}
            options={SEPARATOR_OPTIONS.map((option) => ({ ...option, disabled }))}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, style: value as 'default' | 'wide' | 'dots' },
              })
            }
          />
        </div>
      );

    case 'row':
      return (
        <div className="amoris-inspector">
          <ColumnRatioControl
            value={block.props.columnStructure}
            options={RATIO_OPTIONS}
            disabled={disabled}
            onChange={(structure) => onColumnStructureChange(block.id, structure)}
          />
          <p className="amoris-inspector__note">
            Si possono scegliere solo le ripartizioni con lo stesso numero di colonne di questa
            riga: aggiungere o togliere una colonna è fuori dal perimetro di questa fase.
          </p>
        </div>
      );

    case 'slider':
      return (
        <SliderInspector
          sliderId={block.props.sliderId}
          disabled={disabled}
          onChoose={(sliderId) => onChange({ ...block, props: { ...block.props, sliderId } })}
        />
      );

    // Configurabili se già presenti, non inseribili (DR-279); `key` azzera i campi a ogni blocco.
    case 'video':
      return (
        <VideoInspector key={block.id} block={block} onChange={onChange} disabled={disabled} />
      );

    case 'map':
      return <MapInspector key={block.id} block={block} onChange={onChange} disabled={disabled} />;

    case 'document':
      return (
        <DocumentBlockInspector
          key={block.id}
          block={block}
          onChange={onChange}
          disabled={disabled}
        />
      );

    // Inseribili dall'editor e ora anche configurabili (DR-320).
    case 'media_text':
      return (
        <MediaTextInspector key={block.id} block={block} onChange={onChange} disabled={disabled} />
      );

    case 'post_list':
      return (
        <PostListInspector key={block.id} block={block} onChange={onChange} disabled={disabled} />
      );

    default:
      return (
        <div className="amoris-inspector">
          <Alert variant="info" title="Questo blocco non si modifica qui">
            {NOT_EDITABLE_HERE[block.type]}
          </Alert>
        </div>
      );
  }
}
