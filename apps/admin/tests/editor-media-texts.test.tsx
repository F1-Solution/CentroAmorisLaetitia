import { blockNodeSchema, type BlockNode } from '@amoris/blocks';
import { DensityProvider } from '@amoris/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockInspector } from '../src/components/editor/BlockInspector';
import { RichTextEditor } from '../src/components/editor/RichTextEditor';

/*
 * DR-269: la schermata dei media esiste («Media», sotto «Corredo» nella
 * navigazione, con «Sostituisci il file»). I due testi dell'editor che dicevano
 * il contrario ora dicono dove si cambia il file di un'immagine e perché il
 * comando «Immagine» del testo resta spento: le immagini sono blocchi propri.
 * Dati sintetici.
 */

const immagine = blockNodeSchema.parse({
  type: 'image',
  id: 'b_000000000a01',
  props: { mediaId: '11111111-1111-4111-8111-111111111111', alt: 'Immagine sintetica' },
  children: [],
}) as BlockNode;

describe('testi dell’editor sui media (DR-269)', () => {
  it('l’ispettore dell’immagine rimanda alla schermata «Media» e al suo «Sostituisci il file»', () => {
    render(
      <DensityProvider>
        <BlockInspector block={immagine} onChange={vi.fn()} onColumnStructureChange={vi.fn()} />
      </DensityProvider>,
    );
    expect(screen.getByText('Il file dell’immagine si cambia da «Media»')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Qui si modifica ciò che accompagna l’immagine; il file si sostituisce da Corredo › Media, con «Sostituisci il file».',
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('non esiste ancora');
  });

  it('il suggerimento del testo dice perché il comando «Immagine» è spento', () => {
    render(
      <DensityProvider>
        <RichTextEditor value="<p>Testo sintetico.</p>" onChange={vi.fn()} />
      </DensityProvider>,
    );
    expect(
      screen.getByText(
        'Il comando «Immagine» è spento: le immagini non stanno dentro il testo. Per metterne una nel contenuto si aggiunge un blocco «Immagine» con «Aggiungi blocco».',
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('non esiste ancora');
  });
});
