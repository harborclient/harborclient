import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { type JSX, type KeyboardEvent, type MouseEvent, type ReactNode, useState } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { SidebarBadge } from './SidebarBadge.js';
import { SidebarItem } from './SidebarItem.js';
import { SIDEBAR_ITEM_BUTTON_CLASS } from './sidebarItemClasses.js';

interface Props {
  /**
   * Website display name (last page title).
   */
  name: string;

  /**
   * Favicon data URL when available; globe fallback when missing or broken.
   */
  faviconDataUrl?: string | null;

  /**
   * Globe (or other) icon used when no favicon is available.
   */
  fallbackIcon: IconDefinition;

  /**
   * Optional connection badge text (e.g. storage location name).
   */
  connectionBadge?: string;

  /**
   * Whether this row is part of a multi-selection or is the active open website.
   */
  selected?: boolean;

  /**
   * Called when the user right-clicks the row container.
   */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the primary row area is activated.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the primary row area is double-clicked (e.g. open page settings).
   */
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when Enter is pressed on the primary row area.
   */
  onEnter?: () => void;

  /**
   * Trailing actions slot, typically a row actions menu.
   */
  actions?: ReactNode;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarListbox}.
   */
  as?: 'div' | 'li';
}

/**
 * Renders a website row in the Collections sidebar Websites section.
 *
 * Shows the site favicon when available, otherwise a globe fallback icon, plus
 * the last known page title and an optional storage-location badge inline with
 * the name.
 */
export function SidebarWebsiteItem({
  name,
  faviconDataUrl,
  fallbackIcon,
  connectionBadge,
  selected = false,
  onContextMenu,
  onClick,
  onDoubleClick,
  onEnter,
  actions,
  as = 'li'
}: Props): JSX.Element {
  const useListboxOption = as === 'li';
  const [brokenFaviconUrl, setBrokenFaviconUrl] = useState<string | null>(null);
  const showFavicon = Boolean(faviconDataUrl) && brokenFaviconUrl !== faviconDataUrl;

  /**
   * Opens the website when Enter is pressed on the row.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' || onEnter == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onEnter();
  };

  /**
   * Marks the current favicon as unloadable so the globe fallback is shown.
   */
  const handleFaviconError = (): void => {
    if (faviconDataUrl) {
      setBrokenFaviconUrl(faviconDataUrl);
    }
  };

  return (
    <SidebarItem
      selected={selected}
      onContextMenu={onContextMenu}
      actions={actions}
      as={as}
      listboxOption={
        useListboxOption
          ? {
              onClick,
              onDoubleClick,
              onKeyDown: onEnter != null ? handleKeyDown : undefined
            }
          : undefined
      }
    >
      <span className={`${SIDEBAR_ITEM_BUTTON_CLASS} gap-2 rounded-md px-2 py-1`}>
        {showFavicon && faviconDataUrl ? (
          <img
            src={faviconDataUrl}
            alt=""
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 object-contain"
            onError={handleFaviconError}
          />
        ) : (
          <FaIcon icon={fallbackIcon} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate">{name}</span>
          {connectionBadge != null ? (
            <SidebarBadge variant="info" title={`Stored in ${connectionBadge}`}>
              {connectionBadge}
            </SidebarBadge>
          ) : null}
        </span>
      </span>
    </SidebarItem>
  );
}
