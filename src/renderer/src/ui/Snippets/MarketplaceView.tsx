import { FormGroup, Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faStore } from '#/renderer/src/fontawesome';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import {
  PLUGIN_CATALOG_CATEGORIES,
  PLUGIN_CATALOG_CATEGORY_LABELS
} from '#/shared/plugin/catalogCategories';
import { MarketplaceBrowseView } from '#/renderer/src/ui/shared/MarketplaceBrowseView';
import { CatalogCard } from './CatalogCard';

interface Props {
  /**
   * Whether the catalog is loading.
   */
  catalogLoading: boolean;

  /**
   * Catalog load error message, if any.
   */
  catalogError: string | null;

  /**
   * Current search query for filtering catalog entries.
   */
  catalogSearchQuery: string;

  /**
   * Current category filter, or empty for all categories.
   */
  catalogCategoryFilter: string;

  /**
   * Catalog entries after category and search filtering.
   */
  filteredCatalogSnippets: SnippetCatalogEntry[];

  /**
   * Updates the catalog search query.
   */
  onSearchChange: (query: string) => void;

  /**
   * Updates the catalog category filter.
   */
  onCategoryChange: (category: string) => void;

  /**
   * Opens the detail view for one catalog listing.
   */
  onOpenCatalogDetail: (entry: SnippetCatalogEntry) => void;

  /**
   * Retries loading the marketplace catalog after an error.
   */
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
  /**
   * Shared height for marketplace filter controls so Input and Select align in a row.
   */
  const filterControlClass = 'h-9';

  return (
    <MarketplaceBrowseView
      title="Marketplace"
      description="Browse signed snippet bundles published to the HarborClient marketplace."
      icon={faStore}
      searchLabel="Search snippet marketplace"
      searchId="snippet-catalog-search"
      searchPlaceholder="Search snippets"
      searchValue={catalogSearchQuery}
      searchDisabled={catalogLoading}
      onSearchChange={onSearchChange}
      filters={
        <FormGroup
          bordered={false}
          label="Filter by category"
          htmlFor="snippet-catalog-category"
          srOnly
        >
          <Select
            id="snippet-catalog-category"
            value={catalogCategoryFilter}
            disabled={catalogLoading}
            className={`w-full max-w-xs ${filterControlClass}`}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">All categories</option>
            {PLUGIN_CATALOG_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </FormGroup>
      }
      loading={catalogLoading}
      loadingMessage="Loading marketplace…"
      error={catalogError}
      onRetry={onRetryLoad}
      isCatalogEmpty={false}
      emptyState={null}
      hasNoMatches={!catalogLoading && !catalogError && filteredCatalogSnippets.length === 0}
      noMatchMessage="No snippet bundles match your search."
      entries={!catalogLoading && !catalogError ? filteredCatalogSnippets : []}
      getKey={(entry) => entry.id}
      renderCard={(entry) => (
        <CatalogCard entry={entry} onOpen={() => onOpenCatalogDetail(entry)} />
      )}
    />
  );
}
