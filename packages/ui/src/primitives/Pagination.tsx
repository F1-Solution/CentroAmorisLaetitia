import { IconButton } from './IconButton';
import { SelectField } from './SelectField';
import './Pagination.css';

export interface PaginationProps {
  /** Pagina corrente, a partire da 1. */
  page: number;
  /** Numero totale di elementi. Con `0` lo stato è V: nessun controllo di pagina. */
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  disabled?: boolean;
}

type PageToken = number | 'ellipsis-start' | 'ellipsis-end';

function buildPageTokens(current: number, pageCount: number): PageToken[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const tokens: PageToken[] = [1];
  if (current > 3) tokens.push('ellipsis-start');

  const start = Math.max(2, current - 1);
  const end = Math.min(pageCount - 1, current + 1);
  for (let n = start; n <= end; n += 1) tokens.push(n);

  if (current < pageCount - 2) tokens.push('ellipsis-end');
  tokens.push(pageCount);
  return tokens;
}

/**
 * Componente 19: impaginazione numerata con scelta degli elementi per pagina.
 * Verificata ai limiti: prima pagina, ultima, pagina unica, zero risultati.
 */
export function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
  disabled = false,
}: PaginationProps): React.JSX.Element {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const isEmpty = totalItems === 0;
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= pageCount;

  const tokens = buildPageTokens(currentPage, pageCount);

  return (
    <nav className="amoris-pagination" aria-label="Impaginazione">
      <p className="amoris-pagination__summary">
        {isEmpty
          ? 'Nessun elemento.'
          : `${totalItems} elementi, pagina ${currentPage} di ${pageCount}.`}
      </p>
      {!isEmpty ? (
        <div className="amoris-pagination__pages">
          <IconButton
            icon={<span aria-hidden="true">‹</span>}
            label="Pagina precedente"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || isFirst}
          />
          {tokens.map((token) =>
            typeof token === 'number' ? (
              <button
                key={token}
                type="button"
                className={[
                  'amoris-focusable',
                  'amoris-pagination__page',
                  token === currentPage ? 'amoris-pagination__page--current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={token === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(token)}
                disabled={disabled}
              >
                {token}
              </button>
            ) : (
              <span key={token} className="amoris-pagination__ellipsis" aria-hidden="true">
                …
              </span>
            ),
          )}
          <IconButton
            icon={<span aria-hidden="true">›</span>}
            label="Pagina successiva"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || isLast}
          />
        </div>
      ) : null}
      {onPageSizeChange ? (
        <div className="amoris-pagination__size">
          <SelectField
            label="Elementi per pagina"
            value={String(pageSize)}
            options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            disabled={disabled}
          />
        </div>
      ) : null}
    </nav>
  );
}
