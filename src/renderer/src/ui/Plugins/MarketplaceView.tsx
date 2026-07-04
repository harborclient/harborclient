import { FormGroup, Input, Page, Select } from '@harborclient/sdk/components';
import { useMemo, type JSX } from 'react';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import {
  PLUGIN_CATALOG_CATEGORIES,
  PLUGIN_CATALOG_CATEGORY_LABELS,
  type PluginCatalogCategory
} from '#/shared/plugin/catalogCategories';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import { THEME_APPEARANCE_CATEGORIES, THEME_CATEGORY } from '#/shared/plugin/themeCategory';
import { faPalette, faStore } from '#/renderer/src/fontawesome';
import type { PluginManagementKind } from '#/renderer/src/ui/Plugins/constants';
import { CatalogCard } from './CatalogCard';

interface Props {
  /**
   * Whether this marketplace shows plugins or themes.
   */
  kind: PluginManagementKind;

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
  kind,
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
  const isThemes = kind === 'themes';
  const searchId = isThemes ? 'theme-catalog-search' : 'plugin-catalog-search';
  const categoryId = isThemes ? 'theme-catalog-appearance' : 'plugin-catalog-category';
  const searchLabel = isThemes ? 'Search themes' : 'Search plugins';
  const searchPlaceholder = isThemes ? 'Search themes' : 'Search plugins';
  const categoryLabel = isThemes ? 'Filter themes by appearance' : 'Filter plugins by category';

  /**
   * Shared height for marketplace filter controls so Input and Select align in a row.
   */
  const filterControlClass = 'h-9';

  /**
   * Category slugs excluded from the plugins marketplace filter dropdown.
   */
  const excludedPluginCategorySlugs = useMemo(
    () => new Set<string>([THEME_CATEGORY, ...THEME_APPEARANCE_CATEGORIES]),
    []
  );

  /**
   * Category options for the plugins marketplace, excluding theme-specific slugs.
   */
  const pluginCategoryOptions = useMemo(
    () =>
      PLUGIN_CATALOG_CATEGORIES.filter((category) => !excludedPluginCategorySlugs.has(category)),
    [excludedPluginCategorySlugs]
  );

  return (
    <Page
      embedded
      title={isThemes ? 'Themes' : 'Marketplace'}
      icon={isThemes ? faPalette : faStore}
      description={
        isThemes
          ? 'Browse and install themes from configured marketplace catalogs.'
          : 'Browse and install plugins from configured marketplace catalogs.'
      }
    >
      <div className="mb-4 flex items-center gap-3 w-full">
        <FormGroup className="border-none! p-0!" label={searchLabel} htmlFor={searchId} srOnly>
          <Input
            id={searchId}
            type="search"
            placeholder={searchPlaceholder}
            value={catalogSearchQuery}
            disabled={catalogLoading}
            className={`w-full max-w-lg ${filterControlClass}`}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </FormGroup>
        {!isThemes ? (
          <FormGroup
            className="border-none! p-0!"
            label={categoryLabel}
            htmlFor={categoryId}
            srOnly
          >
            <Select
              id={categoryId}
              value={catalogCategoryFilter}
              disabled={catalogLoading}
              className={`w-full max-w-xs ${filterControlClass}`}
              onChange={(event) =>
                onCategoryFilterChange(event.target.value as PluginCatalogCategory | '')
              }
            >
              <option value="">All categories</option>
              {pluginCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </FormGroup>
        ) : (
          <FormGroup
            className="border-none! p-0!"
            label={categoryLabel}
            htmlFor={categoryId}
            srOnly
          >
            <Select
              id={categoryId}
              value={catalogCategoryFilter}
              disabled={catalogLoading}
              className={`w-full max-w-xs ${filterControlClass}`}
              onChange={(event) =>
                onCategoryFilterChange(event.target.value as PluginCatalogCategory | '')
              }
            >
              <option value="">All appearances</option>
              {THEME_APPEARANCE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}
      </div>

      {catalogError ? (
        <p className="text-danger" role="alert">
          {catalogError}
        </p>
      ) : null}
      {catalogLoading ? (
        <p className="text-muted" role="status">
          {isThemes ? 'Loading theme catalog…' : 'Loading plugin catalog…'}
        </p>
      ) : null}

      {!catalogLoading && catalog?.plugins.length === 0 ? (
        <p className="text-muted">
          {isThemes ? 'No themes are listed yet.' : 'No plugins are listed yet.'} See the{' '}
          <a
            href="https://harborclient.com/plugins"
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            {isThemes ? 'theme marketplace' : 'plugin marketplace'}
          </a>{' '}
          for submission instructions.
        </p>
      ) : null}

      {!catalogLoading &&
      catalog &&
      catalog.plugins.length > 0 &&
      filteredCatalogPlugins.length === 0 ? (
        <p className="text-muted" role="status">
          {isThemes ? 'No themes match your filters.' : 'No plugins match your filters.'}
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
