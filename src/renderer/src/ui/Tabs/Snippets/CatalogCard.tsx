import type { JSX } from 'react';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import { PLUGIN_CATALOG_CATEGORY_LABELS } from '#/shared/plugin/catalogCategories';
import { CatalogCard as SdkCatalogCard, ScreenshotCarousel } from '@harborclient/sdk/components';

interface Props {
  /**
   * Marketplace listing rendered in the browse grid.
   */
  entry: SnippetCatalogEntry;

  /**
   * Opens the catalog detail modal for this listing.
   */
  onOpen: () => void;
}

/**
 * Maps a snippet marketplace entry onto the shared SDK catalog card.
 */
export function CatalogCard({ entry, onOpen }: Props): JSX.Element {
  const images = entry.screenshots ?? (entry.screenshot ? [entry.screenshot] : []);

  return (
    <SdkCatalogCard
      name={entry.name}
      version={entry.version}
      summary={entry.summary}
      onOpen={onOpen}
      preview={
        images.length > 0 ? (
          <ScreenshotCarousel
            variant="card"
            images={images}
            stopPropagation
            ariaLabel="Snippet screenshots"
          />
        ) : undefined
      }
      categories={entry.categories.map((category) => ({
        id: category,
        label: PLUGIN_CATALOG_CATEGORY_LABELS[category]
      }))}
    />
  );
}
