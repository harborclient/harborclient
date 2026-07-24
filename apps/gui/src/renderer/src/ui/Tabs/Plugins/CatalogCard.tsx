import type { JSX } from 'react';
import type { PluginCatalogEntry } from '@harborclient/core/plugin/catalog';
import { PLUGIN_CATALOG_CATEGORY_LABELS } from '@harborclient/core/plugin/catalogCategories';
import { resolveCatalogScreenshotUrls } from '@harborclient/core/plugin/githubRaw';
import {
  catalogEntryIsTheme,
  formatThemeDisplayName
} from '@harborclient/core/plugin/themeCategory';
import { CatalogCard as SdkCatalogCard, ScreenshotCarousel } from '@harborclient/sdk/components';

interface Props {
  /**
   * Marketplace listing rendered in the browse grid.
   */
  entry: PluginCatalogEntry;

  /**
   * Opens the catalog detail modal for this listing.
   */
  onOpen: () => void;
}

/**
 * Maps a plugin marketplace entry onto the shared SDK catalog card.
 */
export function CatalogCard({ entry, onOpen }: Props): JSX.Element {
  const images = resolveCatalogScreenshotUrls(
    entry.repoUrl,
    entry.ref,
    entry.screenshots,
    entry.screenshot
  );
  const categories = catalogEntryIsTheme(entry)
    ? undefined
    : entry.categories.map((category) => ({
        id: category,
        label: PLUGIN_CATALOG_CATEGORY_LABELS[category]
      }));

  const displayName = catalogEntryIsTheme(entry) ? formatThemeDisplayName(entry.name) : entry.name;

  return (
    <SdkCatalogCard
      name={displayName}
      version={entry.version}
      summary={entry.summary}
      onOpen={onOpen}
      preview={
        images.length > 0 ? (
          <ScreenshotCarousel
            variant="card"
            images={images}
            stopPropagation
            ariaLabel="Plugin screenshots"
          />
        ) : undefined
      }
      categories={categories}
    />
  );
}
