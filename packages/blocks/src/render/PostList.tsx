import type { PostListBlock } from '../schema/block';
import { blockClassName } from './class-name';

export interface PostListComponentProps {
  readonly block: PostListBlock;
}

/** L'elenco reale degli articoli è dati a runtime: fuori dal perimetro di 1D-W1. */
export function PostList({ block }: PostListComponentProps) {
  return <div className={blockClassName('post-list', block.props.classes)} id={block.id} />;
}
