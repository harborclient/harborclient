import { Button, Input, Page, Spinner } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faStore } from '#/renderer/src/fontawesome';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import {
  PLUGIN_CATALOG_CATEGORIES,
  PLUGIN_CATALOG_CATEGORY_LABELS
} from '#/shared/plugin/catalogCategories';
import { CatalogCard } from './CatalogCard';

interface Props {
  catalogLoading: boolean;
  catalogError: string | null;
  catalogSearchQuery: string;
  catalogCategoryFilter: string;
  filteredCatalogSnippets: SnippetCatalogEntry[];
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onOpenCatalogDetail: (entry: SnippetCatalogEntry) => void;
  onRetryLoad: () => void;
}

/**
 * Marketplace grid for browsing curated snippet bundle listings.
 */
export function MarketplaceView({
  catalogLoading,
  catalogError,
  catalogSearchQuery,
  catalogCategoryFilter,
  filteredCatalogSnippets,
  onSearchChange,
  onCategoryChange,
  onOpenCatalogDetail,
  onRetryLoad
}: Props): JSX.Element {
  return (
    <Page
      embedded
      title="Marketplace"
      description="Browse signed snippet bundles published to the HarborClient marketplace."
      icon={faStore}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          aria-label="Search snippet marketplace"
          placeholder="Search snippets"
          value={catalogSearchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full sm:max-w-sm"
        />
        <select
          aria-label="Filter by category"
          className="w-full rounded-md border border-separator bg-panel px-3 py-2 text-[14px] text-text sm:max-w-xs"
          value={catalogCategoryFilter}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">All categories</option>
          {PLUGIN_CATALOG_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </div>

      {catalogLoading ? (
        <div className="flex items-center gap-2 text-[14px] text-muted" role="status">
          <Spinner className="h-4 w-4" />
          Loading marketplace…
        </div>
      ) : null}

      {catalogError ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[14px] text-danger">{catalogError}</p>
          <Button type="button" variant="secondary" onClick={onRetryLoad}>
            Retry
          </Button>
        </div>
      ) : null}

      {!catalogLoading && !catalogError && filteredCatalogSnippets.length === 0 ? (
        <p className="m-0 text-[14px] text-muted">No snippet bundles match your search.</p>
      ) : null}

      {!catalogLoading && filteredCatalogSnippets.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {filteredCatalogSnippets.map((entry) => (
            <CatalogCard key={entry.id} entry={entry} onOpen={() => onOpenCatalogDetail(entry)} />
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
