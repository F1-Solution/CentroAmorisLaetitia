import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DensityName } from '../tokens/tokens.js';

export interface DensityContextValue {
  density: DensityName;
  setDensity: (next: DensityName) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

export interface DensityProviderProps {
  children: ReactNode;
  /** Valore iniziale. Predefinito: comoda (DR-054, §5.1). */
  initialDensity?: DensityName;
  /**
   * Chiamato a ogni cambio, con il nuovo valore. La persistenza vera è
   * un'API lato server che non esiste ancora in questa wave (§5.2 punto 3): chi
   * usa il componente collega qui la chiamata che salva la preferenza con
   * l'account. Senza questa prop la scelta resta solo in memoria per la sessione
   * corrente — di proposito, per non scivolare in un ripiego sul browser che la
   * decisione dell'utente ha escluso.
   */
  onDensityChange?: (next: DensityName) => void;
}

/**
 * Applica `data-density` all'elemento radice del documento, cosicché
 * `tokens.css` cambi le variabili di densità senza altro JavaScript nei
 * componenti (§2.3 punto 2, §5.1).
 */
function applyDensityAttribute(density: DensityName): void {
  if (typeof document === 'undefined') return;
  if (density === 'compact') {
    document.documentElement.setAttribute('data-density', 'compact');
  } else {
    document.documentElement.removeAttribute('data-density');
  }
}

export function DensityProvider({
  children,
  initialDensity = 'comfortable',
  onDensityChange,
}: DensityProviderProps): React.JSX.Element {
  const [density, setDensityState] = useState<DensityName>(() => {
    applyDensityAttribute(initialDensity);
    return initialDensity;
  });

  const setDensity = useCallback(
    (next: DensityName) => {
      // §5.2 punto 4: il cambio è immediato, senza ricaricare la pagina.
      applyDensityAttribute(next);
      setDensityState(next);
      onDensityChange?.(next);
    },
    [onDensityChange],
  );

  const value = useMemo(() => ({ density, setDensity }), [density, setDensity]);

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    throw new Error('useDensity va usato dentro <DensityProvider>.');
  }
  return ctx;
}
