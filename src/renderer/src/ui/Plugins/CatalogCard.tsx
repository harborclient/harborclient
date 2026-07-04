import type { JSX, KeyboardEvent } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import { PLUGIN_CATALOG_CATEGORY_LABELS } from '#/shared/plugin/catalogCategories';
import { catalogEntryIsTheme } from '#/shared/plugin/themeCategory';
import { ScreenshotCarousel } from './ScreenshotCarousel';
import { Card } from '@harborclient/sdk/components';

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
 * Compact marketplace preview card; opens the detail modal on activation.
 */
export function CatalogCard({ entry, onOpen }: Props): JSX.Element {
  const images = entry.screenshots ?? (entry.screenshot ? [entry.screenshot] : []);
  const showCategories = !catalogEntryIsTheme(entry);

  /**
   * Opens the detail modal when the card is activated from the keyboard.
   *
   * @param event - Keyboard event on the card.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li
      tabIndex={0}
      aria-label={`View details for ${entry.name}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <Card className="h-full cursor-pointer flex-col overflow-hidden hover:bg-selection/40">
        {images.length > 0 ? (
          <ScreenshotCarousel variant="card" images={images} stopPropagation />
        ) : (
          <div
            className="flex aspect-video w-full items-center justify-center border-b border-separator bg-panel text-[14px] text-muted"
            aria-hidden
          >
            No preview
          </div>
        )}

        <Card.Body className="flex flex-1 flex-col gap-1.5 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 min-w-0 truncate text-[14px] font-semibold text-text">
              {entry.name}
            </h3>
            <span className="shrink-0 text-[14px] text-muted">{entry.version}</span>
          </div>
          <p className="m-0 line-clamp-3 text-[14px] text-text">{entry.summary}</p>
          {showCategories ? (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
              {entry.categories.map((category) => (
                <span
                  key={category}
                  className="rounded bg-accent/15 px-2 py-0.5 text-[14px] text-text"
                >
                  {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
                </span>
              ))}
            </div>
          ) : null}
        </Card.Body>
      </Card>
    </li>
  );
}
