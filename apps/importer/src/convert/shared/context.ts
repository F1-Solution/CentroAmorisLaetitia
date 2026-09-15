/**
 * Il contesto condiviso da tutti i convertitori: l'allocatore di identificatori
 * (`@amoris/blocks`, `BLOCK-MODEL.md` §4), il pozzo delle anomalie, e i
 * risolutori opzionali verso le entità che l'importer scrive in altre fasi
 * (`media`, `forms`, `documents`, `sliders` — tutte dopo o indipendenti da
 * `contents` in `STAGE_DEPENDS_ON`). Il convertitore non tocca mai il database:
 * riceve funzioni pure che, dato un riferimento della sorgente, restituiscono
 * l'`EntityRef` già creato, o `null` se non ancora risolvibile.
 */
import { createBlockIdAllocator, type StableIdSourceInput } from './blocks.js';
import { createIssueSink, type ConvertIssue } from './issue.js';

export type MediaResolver = (legacyRef: string) => string | null;
export type FormResolver = (legacyRef: string) => string | null;
export type DocumentResolver = (legacyRef: string) => string | null;
export type SliderResolver = (legacyRef: string) => string | null;

export interface ConvertResolvers {
  readonly resolveMedia?: MediaResolver;
  readonly resolveForm?: FormResolver;
  readonly resolveDocument?: DocumentResolver;
  readonly resolveSlider?: SliderResolver;
}

export interface ConvertContext {
  readonly legacyContentId: string | number;
  /** Il testo intero di `post_content`, per calcolare gli offset in byte (§4.1). */
  readonly fullText: string;
  readonly issues: ConvertIssue[];
  push(issue: ConvertIssue): void;
  /** Alloca un identificatore stabile per un costrutto che occupa `[start, end)` caratteri di `fullText`. */
  allocateId(type: string, start: number, end: number): string;
  readonly resolvers: ConvertResolvers;
}

/**
 * Converte un offset in caratteri (indice di stringa JavaScript) nell'offset in
 * byte UTF-8 richiesto da `BLOCK-MODEL.md` §4.1. Non ottimizzato: i contenuti
 * della sorgente sono di poche decine di migliaia di caratteri, e l'operazione
 * avviene una volta per costrutto, non nel percorso critico.
 */
export function charIndexToByteOffset(fullText: string, charIndex: number): number {
  return Buffer.byteLength(fullText.slice(0, charIndex), 'utf8');
}

export function createConvertContext(
  legacyContentId: string | number,
  fullText: string,
  resolvers: ConvertResolvers = {},
): ConvertContext {
  const sink = createIssueSink();
  const allocator = createBlockIdAllocator();

  return {
    legacyContentId,
    fullText,
    issues: sink.issues,
    push: sink.push,
    allocateId(type: string, start: number, end: number): string {
      const input: StableIdSourceInput = {
        legacyContentId,
        startOffset: charIndexToByteOffset(fullText, start),
        endOffset: charIndexToByteOffset(fullText, end),
        type,
      };
      return allocator.allocate(input);
    },
    resolvers,
  };
}
