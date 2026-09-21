import type { VideoBlock } from '../schema/block';
import { blockClassName } from './class-name';

export interface VideoComponentProps {
  readonly block: VideoBlock;
}

/** Nessuna animazione, nessuna resa reale del player: è lavoro della Fase 1E. */
export function Video({ block }: VideoComponentProps) {
  return (
    <div
      className={blockClassName('video', block.props.classes)}
      id={block.id}
      data-src={block.props.src}
      data-provider={block.props.provider}
    />
  );
}
