'use client';

import { Alert, Button, MediaPicker, PageHeader, type MediaPickerItem } from '@amoris/ui';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import { messageOf, type EditorialSlider } from './sliderModel';
import { SliderSlideRow, type SlideDraft, type SlideFieldErrors } from './SliderSlideRow';
import './SliderEditor.css';

const NOT_FOUND = 'Il carosello non esiste.';

interface MediaItem {
  readonly id: string;
  readonly publicPath: string;
  readonly fileName: string;
  readonly title: string | null;
  readonly isPrivate: boolean;
}

interface Errors {
  readonly byIndex: Readonly<Record<number, SlideFieldErrors>>;
  readonly general?: string;
}

/** Che cosa sceglie il selettore: una slide nuova in coda, o l'immagine di una slide esistente. */
type PickTarget = { readonly kind: 'add' } | { readonly kind: 'change'; readonly key: string };

/** Dove torna il focus: lo stesso spostamento della slide, o il suo primo comando attivo. */
interface FocusRequest {
  readonly key: string;
  readonly command: 'up' | 'down' | 'first';
}

/** Il comando della riga da mettere a fuoco; se si è spento al bordo, quello opposto (A2). */
function commandToFocus(row: HTMLElement, command: FocusRequest['command']): HTMLElement | null {
  const enabled = (name: string): HTMLElement | null =>
    row.querySelector<HTMLElement>(`button[data-command="${name}"]:not(:disabled)`);
  if (command === 'first') {
    return row.querySelector<HTMLElement>('button[data-command]:not(:disabled)');
  }
  return enabled(command) ?? enabled(command === 'up' ? 'down' : 'up');
}

function payloadOf(slides: readonly SlideDraft[]): {
  id?: string;
  mediaId: string;
  heading: string | null;
  body: string | null;
}[] {
  return slides.map((slide) => ({
    ...(slide.id ? { id: slide.id } : {}),
    mediaId: slide.mediaId ?? '',
    heading: slide.heading.trim() === '' ? null : slide.heading.trim(),
    body: slide.body.trim() === '' ? null : slide.body.trim(),
  }));
}

/** Smista i campi rifiutati dall'API sulla slide e sul campo che li riguardano; il resto è un messaggio generale. */
function errorsFrom(caught: unknown): Errors {
  if (!(caught instanceof ApiError) || caught.details.length === 0) {
    return { byIndex: {}, general: messageOf(caught) };
  }
  const byIndex: Record<number, { heading?: string; body?: string }> = {};
  let general: string | undefined;
  for (const detail of caught.details) {
    const [root, position, field] = detail.path.split(/[./]/).filter(Boolean);
    const index = Number(position);
    if (root === 'slides' && Number.isInteger(index) && (field === 'heading' || field === 'body')) {
      const slot = (byIndex[index] ??= {});
      slot[field] ??= detail.message;
    } else {
      general = general ? `${general} ${detail.message}` : detail.message;
    }
  }
  return { byIndex, ...(general ? { general } : {}) };
}

/** Scheda di un carosello: l'elenco delle slide si modifica tutto insieme e si salva con un solo «Salva». */
export function SliderEditor({ sliderId }: { readonly sliderId: string }): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('content.write') ?? false;

  const [slider, setSlider] = useState<EditorialSlider | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slides, setSlides] = useState<readonly SlideDraft[]>([]);
  const [baseline, setBaseline] = useState('[]');
  const [errors, setErrors] = useState<Errors>({ byIndex: {} });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const [media, setMedia] = useState<readonly MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSearch, setMediaSearch] = useState('');
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const keyCounter = useRef(0);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const focusRequest = useRef<FocusRequest | null>(null);

  // React sposta o smonta il nodo che ha il focus: lo si rimette sul comando giusto prima del disegno.
  useLayoutEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    const row = rows.current.get(request.key);
    if (row) commandToFocus(row, request.command)?.focus();
  }, [slides]);

  const nextKey = useCallback((): string => {
    keyCounter.current += 1;
    return `s${keyCounter.current}`;
  }, []);

  const fill = useCallback(
    (loaded: EditorialSlider): void => {
      const drafts = loaded.slides.map<SlideDraft>((slide) => ({
        key: nextKey(),
        id: slide.id,
        mediaId: slide.mediaId,
        heading: slide.heading ?? '',
        body: slide.body ?? '',
        imageUrl: slide.image?.publicPath ?? null,
        fileName: slide.image?.fileName ?? null,
      }));
      setSlider(loaded);
      setSlides(drafts);
      setBaseline(JSON.stringify(payloadOf(drafts)));
    },
    [nextKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        fill(await api<EditorialSlider>(`/sliders/${sliderId}`, { signal: controller.signal }));
        setLoadError(null);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof ApiError && caught.status === 404 ? NOT_FOUND : messageOf(caught),
        );
      }
    })();
    return () => controller.abort();
  }, [sliderId, fill]);

  useEffect(() => {
    if (!picking) return undefined;
    const controller = new AbortController();
    setMediaLoading(true);
    setMediaError(null);
    const timer = setTimeout(() => {
      void (async () => {
        const query = new URLSearchParams({ mimePrefix: 'image/', perPage: '100' });
        if (mediaSearch.trim()) query.set('search', mediaSearch.trim());
        try {
          const list = await api<{ items: readonly MediaItem[] }>(`/media?${query.toString()}`, {
            signal: controller.signal,
          });
          // Solo immagini pubbliche: una privata non comparirebbe sul sito.
          setMedia(list.items.filter((item) => !item.isPrivate));
        } catch (caught) {
          if (!controller.signal.aborted) {
            setMedia([]);
            setMediaError(messageOf(caught));
          }
        } finally {
          if (!controller.signal.aborted) setMediaLoading(false);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [picking, mediaSearch]);

  const dirty = JSON.stringify(payloadOf(slides)) !== baseline;
  const missingImage = slides.some((slide) => slide.mediaId === null);

  function edit(next: readonly SlideDraft[]): void {
    setSlides(next);
    setNotice(null);
    setErrors({ byIndex: {} });
  }

  function patch(key: string, change: Partial<Pick<SlideDraft, 'heading' | 'body'>>): void {
    edit(slides.map((slide) => (slide.key === key ? { ...slide, ...change } : slide)));
  }

  /** Un annuncio nuovo anche se il testo si ripete: la chiave cambia e il lettore di schermo lo rilegge. */
  function announce(text: string): void {
    setAnnouncement((previous) => ({ id: previous.id + 1, text }));
  }

  function move(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    focusRequest.current = { key: item.key, command: delta < 0 ? 'up' : 'down' };
    edit(next);
    announce(`Slide spostata in posizione ${target + 1} di ${next.length}.`);
  }

  /** Toglie la slide; il focus va alla slide che ne prende il posto, o alla precedente se era l'ultima. */
  function remove(key: string): void {
    const index = slides.findIndex((slide) => slide.key === key);
    const heir = slides[index + 1] ?? slides[index - 1];
    if (heir) focusRequest.current = { key: heir.key, command: 'first' };
    edit(slides.filter((slide) => slide.key !== key));
    announce('Slide tolta.');
  }

  /** Riferimento alla riga di una slide, tenuto per chiave. */
  const rowRefFor =
    (key: string) =>
    (element: HTMLDivElement | null): void => {
      if (element) rows.current.set(key, element);
      else rows.current.delete(key);
    };

  function onImageChosen(item: MediaPickerItem): void {
    const target = picking;
    setPicking(null);
    setMediaSearch('');
    if (!target) return;
    const image = { mediaId: item.id, imageUrl: item.thumbnailUrl, fileName: item.title };
    if (target.kind === 'add') {
      edit([...slides, { key: nextKey(), heading: '', body: '', ...image }]);
    } else {
      edit(slides.map((slide) => (slide.key === target.key ? { ...slide, ...image } : slide)));
    }
  }

  async function onSave(): Promise<void> {
    if (!slider) return;
    setBusy(true);
    setErrors({ byIndex: {} });
    setNotice(null);
    try {
      fill(
        await api<EditorialSlider>(`/sliders/${slider.id}/slides`, {
          method: 'PUT',
          body: { slides: payloadOf(slides) },
        }),
      );
      setNotice('Modifiche salvate.');
    } catch (caught) {
      setErrors(errorsFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AreaShell
      area="redazione"
      sectionId="caroselli"
      breadcrumbs={[
        { label: 'Redazione', href: '/redazione/pagine' },
        { label: 'Caroselli', href: '/redazione/caroselli' },
        { label: slider?.title ?? 'Carosello' },
      ]}
    >
      {loadError ? (
        <Alert variant="error" title="Non è stato possibile">
          {loadError}
        </Alert>
      ) : null}

      {slider ? (
        <>
          <PageHeader
            title={slider.title}
            summary="Le immagini del carosello, nell’ordine in cui compaiono sul sito."
          />

          {notice ? (
            <Alert variant="success" title="Fatto">
              {notice}
            </Alert>
          ) : null}
          {errors.general ? (
            <Alert variant="error" title="Non è stato salvato">
              {errors.general}
            </Alert>
          ) : null}

          <div className="amoris-slider__list">
            {slides.map((slide, index) => (
              <SliderSlideRow
                key={slide.key}
                slide={slide}
                index={index}
                total={slides.length}
                canWrite={canWrite}
                busy={busy}
                errors={errors.byIndex[index] ?? {}}
                onChange={(change) => patch(slide.key, change)}
                onMove={(delta) => move(index, delta)}
                onPickImage={() => setPicking({ kind: 'change', key: slide.key })}
                onRemove={() => remove(slide.key)}
                rowRef={rowRefFor(slide.key)}
              />
            ))}
          </div>
          <p className="amoris-visually-hidden" role="status" aria-live="polite">
            <span key={announcement.id}>{announcement.text}</span>
          </p>

          {slides.length === 1 ? (
            <p className="amoris-slider__note">Un carosello ha almeno un’immagine.</p>
          ) : null}

          {canWrite ? (
            <div className="amoris-slider__actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setPicking({ kind: 'add' })}
              >
                Aggiungi un’immagine
              </Button>
              <Button
                variant="primary"
                loading={busy}
                disabled={!dirty || missingImage}
                onClick={() => void onSave()}
              >
                Salva
              </Button>
            </div>
          ) : null}

          <section className="amoris-slider__used" aria-labelledby="amoris-slider-used">
            <h2 id="amoris-slider-used">Pagine che lo mostrano</h2>
            {slider.usedIn.length === 0 ? (
              <p>
                Nessuna pagina lo mostra. Per farlo vedere sul sito, inserisci il blocco
                «Presentazione a scorrimento» in una pagina.
              </p>
            ) : (
              <ul>
                {slider.usedIn.map((content) => (
                  <li key={content.id}>
                    <Link
                      href={`/redazione/${content.type === 'post' ? 'notizie' : 'pagine'}/${content.id}`}
                    >
                      {content.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <MediaPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        requireAlt={false}
        loading={mediaLoading}
        items={media.map<MediaPickerItem>((item) => ({
          id: item.id,
          thumbnailUrl: item.publicPath,
          title: item.title ?? item.fileName,
        }))}
        {...(mediaError !== null ? { errorText: mediaError } : {})}
        searchValue={mediaSearch}
        onSearchChange={setMediaSearch}
        onSelect={onImageChosen}
      />
    </AreaShell>
  );
}
