import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import './Tabs.css';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  children: ReactNode;
}

/**
 * Componente 50: schede dentro una sezione, quando le sottosezioni sono poche
 * e paritetiche. Frecce sinistra/destra spostano il fuoco fra le schede
 * (indice a rotazione, pattern WAI-ARIA «tabs»).
 */
export function Tabs({ tabs, activeKey, onChange, children }: TabsProps): React.JSX.Element {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    const button = tabRefs.current[index];
    button?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = (index + 1) % tabs.length;
      const nextTab = tabs[next];
      if (nextTab) {
        onChange(nextTab.key);
        focusTab(next);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const previous = (index - 1 + tabs.length) % tabs.length;
      const previousTab = tabs[previous];
      if (previousTab) {
        onChange(previousTab.key);
        focusTab(previous);
      }
    }
  }

  return (
    <div>
      <div className="amoris-tabs__list" role="tablist">
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.key}`}
              aria-controls={`${baseId}-panel-${tab.key}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className="amoris-focusable amoris-tabs__tab"
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="amoris-tabs__panel" role="tabpanel" id={`${baseId}-panel-${activeKey}`} aria-labelledby={`${baseId}-tab-${activeKey}`}>
        {children}
      </div>
    </div>
  );
}
