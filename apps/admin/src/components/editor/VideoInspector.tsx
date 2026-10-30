'use client';

import {
  YOUTUBE_URL_MESSAGE,
  deriveVideoProvider,
  normalizeYouTubeUrl,
  type VideoBlock,
} from '@amoris/blocks';
import {
  Alert,
  Button,
  MediaPicker,
  RadioGroup,
  SelectField,
  type MediaPickerItem,
} from '@amoris/ui';
import { useState } from 'react';
import { siteUrl } from '../../lib/siteUrl';
import { CheckedTextField, usePublicMedia } from './embedInspectorParts';

export interface VideoInspectorProps {
  readonly block: VideoBlock;
  readonly onChange: (next: VideoBlock) => void;
  readonly disabled: boolean;
}

type Source = 'file' | 'youtube';

const SOURCE_OPTIONS = [
  { value: 'file', label: 'Video della libreria (MP4)' },
  { value: 'youtube', label: 'Indirizzo YouTube' },
];

/** Sorgente e anteprima di un blocco «Video»: un MP4 pubblico della libreria o YouTube (DR-279). */
export function VideoInspector({
  block,
  onChange,
  disabled,
}: VideoInspectorProps): React.JSX.Element {
  const { src, provider, posterSrc, posterMediaId } = block.props;
  const [source, setSource] = useState<Source | null>(
    provider === 'file' || provider === 'youtube' ? provider : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const videos = usePublicMedia('video/mp4', source === 'file');
  const images = usePublicMedia('image/', pickerOpen, search);

  const setProps = (props: Partial<VideoBlock['props']>) =>
    onChange({ ...block, props: { ...block.props, ...props } });
  const chooseSource = (src: string) => setProps({ src, provider: deriveVideoProvider(src) });

  const mp4s = (videos.items ?? []).filter((item) => item.mimeType === 'video/mp4');
  const currentFile = provider === 'file' ? src : '';
  const known = mp4s.some((item) => item.publicPath === currentFile);
  const fileOptions = [
    ...(currentFile === ''
      ? [{ value: '', label: 'Scegliere un video' }]
      : !known
        ? [
            {
              value: currentFile,
              label: videos.items
                ? 'Video non disponibile nella libreria'
                : 'Caricamento in corso…',
            },
          ]
        : []),
    ...mp4s.map((item) => ({ value: item.publicPath, label: item.title ?? item.fileName })),
  ];
  const poster = posterSrc ?? (posterMediaId !== null ? 'immagine della libreria' : null);

  return (
    <div className="amoris-inspector">
      <RadioGroup
        legend="Sorgente del video"
        name={`video-source-${block.id}`}
        value={source}
        options={SOURCE_OPTIONS.map((option) => ({ ...option, disabled }))}
        onChange={(value) => setSource(value as Source)}
      />
      {source === null ? (
        <p className="amoris-inspector__note">
          Questo video viene da un fornitore che non si sceglie più: per cambiarlo, scegliere un
          video della libreria o un indirizzo YouTube.
        </p>
      ) : null}
      {source === 'file' ? (
        <>
          {videos.error ? (
            <Alert variant="error" title="I video della libreria non si sono caricati">
              {videos.error}
            </Alert>
          ) : null}
          <SelectField
            label="Video della libreria"
            value={currentFile}
            options={fileOptions}
            disabled={disabled}
            helpText="Solo i video MP4 pubblici della libreria dei media."
            onChange={(event) => {
              if (event.target.value !== '') chooseSource(event.target.value);
            }}
          />
        </>
      ) : null}
      {source === 'youtube' && provider !== 'youtube' ? (
        <Alert variant="warning" title="Il video non è ancora cambiato">
          Finché non si scrive un indirizzo YouTube valido, il blocco resta com’era.
        </Alert>
      ) : null}
      {source === 'youtube' ? (
        <CheckedTextField
          label="Indirizzo YouTube"
          value={provider === 'youtube' ? src : ''}
          disabled={disabled}
          inputMode="url"
          helpText="Per esempio https://www.youtube.com/watch?v=… oppure https://youtu.be/…"
          validate={(text) => (normalizeYouTubeUrl(text) === null ? YOUTUBE_URL_MESSAGE : null)}
          onCommit={(text) => {
            const canonical = normalizeYouTubeUrl(text);
            if (canonical !== null && (canonical !== src || provider !== 'youtube'))
              chooseSource(canonical);
          }}
        />
      ) : null}
      <p className="amoris-inspector__note">
        {poster
          ? `Anteprima: ${poster.split('/').pop() ?? poster}.`
          : 'Nessuna anteprima: il sito mostra un riquadro con il pulsante di riproduzione.'}
      </p>
      <div>
        <Button variant="secondary" disabled={disabled} onClick={() => setPickerOpen(true)}>
          Scegli l’anteprima
        </Button>{' '}
        {poster ? (
          <Button
            variant="tertiary"
            disabled={disabled}
            onClick={() => setProps({ posterSrc: null, posterMediaId: null })}
          >
            Togli l’anteprima
          </Button>
        ) : null}
      </div>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        requireAlt={false}
        loading={pickerOpen && images.items === null && images.error === null}
        items={(images.items ?? []).map<MediaPickerItem>((item) => ({
          id: item.id,
          thumbnailUrl: siteUrl(item.publicPath),
          title: item.title ?? item.fileName,
        }))}
        {...(images.error !== null ? { errorText: images.error } : {})}
        searchValue={search}
        onSearchChange={setSearch}
        onSelect={(item) => {
          // Nel blocco resta il percorso relativo: l'indirizzo del sito serve solo a mostrare la miniatura.
          const chosen = images.items?.find((candidate) => candidate.id === item.id);
          setProps({ posterSrc: chosen?.publicPath ?? item.thumbnailUrl, posterMediaId: null });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
