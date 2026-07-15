import { Button, FormGroup, Input, Page } from '@harborclient/sdk/components';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, ReactNode } from 'react';
import { Fragment } from 'react';

interface Props<T> {
  /**
   * Page title shown in the embedded marketplace header.
   */
  title: string;

  /**
   * Font Awesome icon for the page header.
   */
  icon: IconDefinition;

  /**
   * Short description below the page title.
   */
  description: string;

  /**
   * Programmatic label for the search input.
   */
  searchLabel: string;

  /**
   * Stable id linking the search label to the input.
   */
  searchId: string;

  /**
   * Placeholder text for the search input.
   */
  searchPlaceholder: string;

  /**
   * Current search query value.
   */
  searchValue: string;

  /**
   * Whether the search input should be disabled (e.g. while loading).
   */
  searchDisabled?: boolean;

  /**
   * Updates the search query when the user types.
   */
  onSearchChange: (query: string) => void;

  /**
   * Optional category or appearance filter controls rendered beside search.
   */
  filters?: ReactNode;

  /**
   * Whether the catalog is currently loading.
   */
  loading: boolean;

  /**
   * Accessible loading message announced while `loading` is true.
   */
  loadingMessage: string;

  /**
   * Catalog load error message, if any.
   */
  error: string | null;

  /**
   * When provided, renders a Retry button below the error message.
   */
  onRetry?: () => void;

  /**
   * Whether the loaded catalog has zero entries before filtering.
   */
  isCatalogEmpty: boolean;

  /**
   * Message shown when the catalog loaded successfully but has no listings.
   */
  emptyState: ReactNode;

  /**
   * Whether filters eliminated every entry from a non-empty catalog.
   */
  hasNoMatches: boolean;

  /**
   * Message shown when entries exist but none match the current filters.
   */
  noMatchMessage: ReactNode;

  /**
   * Filtered catalog entries to render in the grid.
   */
  entries: T[];

  /**
   * Stable React key for one grid entry.
   *
   * @param entry - One catalog listing.
   * @returns Unique key string for the grid item.
   */
  getKey: (entry: T) => string;

  /**
   * Renders the preview card for one catalog listing.
   *
   * @param entry - One catalog listing.
   * @returns Card element placed inside the responsive grid.
   */
  renderCard: (entry: T) => ReactNode;
}

/**
 * Shared marketplace browse shell: page header, search row, async states, and
 * responsive catalog card grid. Feature folders supply filter controls, copy,
 * and card rendering.
 */
export function MarketplaceBrowseView<T>({
  title,
  icon,
  description,
  searchLabel,
  searchId,
  searchPlaceholder,
  searchValue,
  searchDisabled = false,
  onSearchChange,
  filters,
  loading,
  loadingMessage,
  error,
  onRetry,
  isCatalogEmpty,
  emptyState,
  hasNoMatches,
  noMatchMessage,
  entries,
  getKey,
  renderCard
}: Props<T>): JSX.Element {
  /**
   * Shared height for marketplace filter controls so Input and Select align in a row.
   */
  const filterControlClass = 'h-9';

  return (
    <Page embedded title={title} icon={icon} description={description}>
      <div className="mb-4 flex w-full items-center gap-3">
        <FormGroup bordered={false} label={searchLabel} htmlFor={searchId} srOnly>
          <Input
            id={searchId}
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            disabled={searchDisabled}
            className={`w-full max-w-lg ${filterControlClass}`}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </FormGroup>
        {filters}
      </div>

      {error ? (
        onRetry ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-danger" role="alert">
              {error}
            </p>
            <Button type="button" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )
      ) : null}

      {loading ? (
        <p className="text-muted" role="status">
          {loadingMessage}
        </p>
      ) : null}

      {!loading && isCatalogEmpty ? <p className="text-muted">{emptyState}</p> : null}

      {!loading && !isCatalogEmpty && hasNoMatches ? (
        <p className="text-muted" role="status">
          {noMatchMessage}
        </p>
      ) : null}

      {!loading && entries.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry) => (
            <Fragment key={getKey(entry)}>{renderCard(entry)}</Fragment>
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
