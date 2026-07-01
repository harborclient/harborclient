import { FormGroup, Input, Page, Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import {
  PLUGIN_CATALOG_CATEGORIES,
  PLUGIN_CATALOG_CATEGORY_LABELS,
  type PluginCatalogCategory
} from '#/shared/plugin/catalogCategories';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import { faStore } from '#/renderer/src/fontawesome';
import { CatalogCard } from './CatalogCard';

interface Props {
  /**
   * Loaded marketplace catalog, if available.
   */
  catalog: PluginCatalog | null;

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
  catalogCategoryFilter: PluginCatalogCategory | '';

  /**
   * Catalog entries after category and search filtering.
   */
  filteredCatalogPlugins: PluginCatalogEntry[];

  /**
   * Updates the catalog search query.
   */
  onSearchQueryChange: (query: string) => void;

  /**
   * Updates the catalog category filter.
   */
  onCategoryFilterChange: (category: PluginCatalogCategory | '') => void;

  /**
   * Opens the detail view for one catalog listing.
   */
  onOpenCatalogDetail: (entry: PluginCatalogEntry) => void;
}

/**
 * Marketplace catalog browser with search and category filters.
 */
export function MarketplaceView({
  catalog,
  catalogLoading,
  catalogError,
  catalogSearchQuery,
  catalogCategoryFilter,
  filteredCatalogPlugins,
  onSearchQueryChange,
  onCategoryFilterChange,
  onOpenCatalogDetail
}: Props): JSX.Element {
  return (
    <Page
      embedded
      title="Marketplace"
      icon={faStore}
      description="Browse and install plugins from configured marketplace catalogs."
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormGroup label="Search plugins" htmlFor="plugin-catalog-search" srOnly>
          <Input
            id="plugin-catalog-search"
            type="search"
            placeholder="Search plugins"
            value={catalogSearchQuery}
            disabled={catalogLoading}
            className="w-full max-w-md"
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </FormGroup>
        <FormGroup label="" htmlFor="plugin-catalog-category">
          <Select
            id="plugin-catalog-category"
            value={catalogCategoryFilter}
            disabled={catalogLoading}
            className="w-full max-w-xs"
            onChange={(event) =>
              onCategoryFilterChange(event.target.value as PluginCatalogCategory | '')
            }
          >
            <option value="">All categories</option>
            {PLUGIN_CATALOG_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </FormGroup>
      </div>

      {catalogError ? (
        <p className="text-danger" role="alert">
          {catalogError}
        </p>
      ) : null}
      {catalogLoading ? (
        <p className="text-muted" role="status">
          Loading plugin catalog…
        </p>
      ) : null}

      {!catalogLoading && catalog?.plugins.length === 0 ? (
        <p className="text-muted">
          No plugins are listed yet. See the{' '}
          <a
            href="https://harborclient.com/plugins"
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            plugin marketplace
          </a>{' '}
          for submission instructions.
        </p>
      ) : null}

      {!catalogLoading &&
      catalog &&
      catalog.plugins.length > 0 &&
      filteredCatalogPlugins.length === 0 ? (
        <p className="text-muted" role="status">
          No plugins match your filters.
        </p>
      ) : null}

      {!catalogLoading && catalog && filteredCatalogPlugins.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {filteredCatalogPlugins.map((entry) => (
            <CatalogCard key={entry.id} entry={entry} onOpen={() => onOpenCatalogDetail(entry)} />
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
