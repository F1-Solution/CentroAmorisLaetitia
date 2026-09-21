import type { FormBlock } from '../schema/block';
import { blockClassName } from './class-name';

export interface FormComponentProps {
  readonly block: FormBlock;
}

/**
 * Riferimento soltanto: la resa pubblica del form e l'invio sono fuori dal
 * perimetro della Fase 1D (`CONTEXT.md` §1).
 */
export function Form({ block }: FormComponentProps) {
  return (
    <div
      className={blockClassName('form', block.props.classes)}
      id={block.id}
      data-form-id={block.props.formId}
      data-origin={block.props.origin}
    />
  );
}
