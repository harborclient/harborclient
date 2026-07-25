import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { Badge } from '../Badge/index.js';
import { Card } from '../Card/index.js';
import { cn } from '../utils.js';

/**
 * One category chip shown on a marketplace catalog card.
 */
export interface CatalogCardCategory {
  /**
   * Stable category id used as the chip key.
   */
  id: string;

  /**
   * Human-readable label rendered inside the chip.
   */
  label: string;
}

export interface Props {
  /**
   * Marketplace listing display name.
   */
  name: string;

  /**
   * Published version string shown beside the name.
   */
  version: string;

  /**
   * Short summary text clamped to three lines.
   */
  summary: string;

  /**
   * Opens the catalog detail view for this listing.
   */
  onOpen: () => void;

  /**
   * Optional preview slot, typically a screenshot carousel.
   * When omitted, a "No preview" placeholder is rendered.
   */
  preview?: ReactNode;

  /**
   * Category chips rendered below the summary.
   * Omit or pass an empty array to hide the chip row.
   */
  categories?: CatalogCardCategory[];

  /**
   * Optional footer slot for action buttons or status rows.
   */
  footer?: ReactNode;
}

/**
 * Opens the detail view when the card is activated from the keyboard.
 *
 * @param event - Keyboard event on the card list item.
 * @param onOpen - Handler that opens the catalog detail view.
 */
function handleKeyDown(event: KeyboardEvent<HTMLLIElement>, onOpen: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onOpen();
  }
}

/**
 * Compact marketplace preview card; opens the detail view on activation.
 */
export function CatalogCard({
  name,
  version,
  summary,
  onOpen,
  preview,
  categories,
  footer
}: Props): JSX.Element {
  const showCategories = categories != null && categories.length > 0;

  return (
    <li
      tabIndex={0}
      aria-label={`View details for ${name}`}
      onClick={onOpen}
      onKeyDown={(event) => handleKeyDown(event, onOpen)}
    >
      <Card className="h-full cursor-pointer flex-col overflow-hidden hover:bg-selection/40">
        {preview ?? (
          <div
            className="bg-panel flex aspect-video w-full items-center justify-center border-b border-separator text-[14px] text-muted"
            aria-hidden
          >
            No preview
          </div>
        )}

        <Card.Body className="flex flex-1 flex-col gap-1.5 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 min-w-0 truncate text-[14px] font-semibold text-text">{name}</h3>
            <span className="shrink-0 text-[14px] text-muted">{version}</span>
          </div>
          <p className="m-0 line-clamp-3 text-[14px] text-text">{summary}</p>
          {showCategories ? (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
              {categories.map((category) => (
                <Badge key={category.id} variant="category" className="px-2">
                  {category.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </Card.Body>

        {footer != null ? <div className={cn('border-t border-separator')}>{footer}</div> : null}
      </Card>
    </li>
  );
}
