import type { JSX } from 'react';
import {
  apisIoCollectionFormatLabel,
  detectApisIoCollectionFormat,
  type ApisIoCollection
} from '@harborclient/core/apisio/catalog';

interface Props {
  /**
   * Catalog listing to render as a searchable result row.
   */
  item: ApisIoCollection;

  /**
   * Opens the detail modal for this listing.
   */
  onSelect: (item: ApisIoCollection) => void;
}

/**
 * Truncates description text for compact result rows.
 *
 * @param text - Full description from the catalog.
 * @param maxLength - Maximum characters before ellipsis.
 * @returns Truncated text.
 */
function truncateDescription(text: string, maxLength = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * One clickable apis.io collection result in the Public collections tab.
 */
export function ResultItem({ item, onSelect }: Props): JSX.Element {
  const format = detectApisIoCollectionFormat(item);
  const formatLabel = format ? apisIoCollectionFormatLabel(format) : item.type;
  const requestCount = item.meta?.item_count;
  const providerLabel = item.provider_name?.trim() || item.provider_slug;
  const description = item.description?.trim() ? truncateDescription(item.description) : null;
  const tags = (item.tags ?? []).filter(
    (tag) => tag !== 'Postman Collection' && tag !== 'Open Collection'
  );

  return (
    <li className="list-none">
      <button
        type="button"
        className="w-full rounded-md border border-separator bg-control px-3 py-3 text-left transition-colors hover:bg-selection focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => onSelect(item)}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium text-text">{item.name}</span>
          <span className="text-[14px] text-muted">{providerLabel}</span>
          <span className="rounded border border-separator px-1.5 py-0.5 text-[14px] text-text">
            {formatLabel}
          </span>
          {typeof requestCount === 'number' ? (
            <span className="text-[14px] text-muted">
              {requestCount} {requestCount === 1 ? 'request' : 'requests'}
            </span>
          ) : null}
        </div>
        {description ? <p className="mb-0 mt-2 text-[14px] text-muted">{description}</p> : null}
        {tags.length > 0 ? (
          <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
            {tags.slice(0, 6).map((tag) => (
              <li key={tag} className="rounded bg-surface px-1.5 py-0.5 text-[14px] text-muted">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </button>
    </li>
  );
}
