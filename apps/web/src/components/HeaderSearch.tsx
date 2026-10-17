'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/**
 * Ricerca della testata come nella sorgente (DR-144): l'icona apre il campo al
 * posto del menu, la croce lo richiude, l'invio porta a `/?s=…`. Senza script
 * la pagina resta navigabile, solo il campo non si apre.
 */

interface SearchState {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

const SearchContext = createContext<SearchState>({ open: false, setOpen: () => undefined });

export function HeaderSearchState({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <SearchContext.Provider value={{ open, setOpen }}>{children}</SearchContext.Provider>;
}

function onActivate(action: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
}

export function HeaderSearchIcon() {
  const { open, setOpen } = useContext(SearchContext);
  return (
    <div id="et_top_search">
      <span
        id="et_search_icon"
        role="button"
        tabIndex={0}
        aria-label="Cerca"
        aria-expanded={open}
        aria-controls="et-search-form"
        onClick={() => setOpen(true)}
        onKeyDown={onActivate(() => setOpen(true))}
      />
    </div>
  );
}

export function HeaderSearchForm() {
  const { open, setOpen } = useContext(SearchContext);
  const container = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const close = () => {
    setOpen(false);
    document.getElementById('et_search_icon')?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // Come `et_set_search_form_css()` di Divi: larga quanto il menu più 60 px.
    const menu = document.getElementById('top-menu');
    if (menu && container.current) container.current.style.maxWidth = `${menu.offsetWidth + 60}px`;
    field.current?.focus();
  }, [open]);

  return (
    <div className="et_search_outer">
      <div
        ref={container}
        className={`container et_search_form_container${open ? ' et_pb_search_visible' : ''}`}
        inert={!open}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
      >
        <form role="search" method="get" className="et-search-form" action="/" id="et-search-form">
          <input
            ref={field}
            type="search"
            className="et-search-field"
            placeholder="Cerca …"
            defaultValue=""
            name="s"
            title="Cerca:"
          />
        </form>
        <span
          className="et_close_search_field"
          role="button"
          tabIndex={0}
          aria-label="Chiudi la ricerca"
          onClick={close}
          onKeyDown={onActivate(close)}
        />
      </div>
    </div>
  );
}
