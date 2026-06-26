import type { JSX, KeyboardEvent } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';

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
      className="flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-md border border-separator bg-control hover:bg-selection/40"
      aria-label={`View details for ${entry.name}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      {entry.screenshot ? (
        <img
          src={entry.screenshot}
          alt=""
          className="aspect-video w-full border-b border-separator object-cover object-top"
        />
      ) : (
        <div
          className="flex aspect-video w-full items-center justify-center border-b border-separator bg-panel text-[14px] text-muted"
          aria-hidden
        >
          No preview
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="m-0 truncate text-[14px] font-semibold text-text">{entry.name}</h3>
        <p className="m-0 line-clamp-3 text-[14px] text-text">{entry.summary}</p>
        <p className="m-0 text-[14px] text-muted">{entry.version}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
          {entry.categories.map((category) => (
            <span key={category} className="rounded bg-accent/15 px-2 py-0.5 text-[14px] text-text">
              {category}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}
