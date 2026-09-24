/**
 * Interpreta `wp_capabilities` (`wp-to-postgres-mapping.md` §4.5): valutata
 * solo per assegnare il ruolo. In Fase 1 esiste un solo ruolo, `editor`
 * (ADR-007 §3.2): qualunque capacità WordPress con diritti di redazione —
 * `administrator` in questa sorgente — si traduce in quel ruolo.
 */
import { phpUnserialize, type PhpValue } from '../../source/php/unserialize.js';

const KNOWN_EDITOR_CAPABILITIES: readonly string[] = ['administrator', 'editor'];

export interface CapabilitiesResult {
  readonly mapsToEditor: boolean;
  readonly capabilityNames: readonly string[];
}

export function interpretCapabilities(serialized: string): CapabilitiesResult {
  const value: PhpValue = phpUnserialize(serialized);
  if (!(value instanceof Map)) {
    return { mapsToEditor: false, capabilityNames: [] };
  }
  const names = [...value.entries()].filter(([, v]) => v === true).map(([k]) => String(k));
  return {
    mapsToEditor: names.some((name) => KNOWN_EDITOR_CAPABILITIES.includes(name)),
    capabilityNames: names,
  };
}
