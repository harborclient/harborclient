import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, KeyboardEvent, Ref } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

/**
 * One entry in a {@link SidebarRail} navigation list.
 */
export interface SidebarRailItemData {
  /**
   * Stable identifier passed to `onSelect` when the item is activated.
   */
  id: string;

  /**
   * Font Awesome icon shown for this rail item.
   */
  icon: IconDefinition;

  /**
   * Accessible name; also shown as visible text when the rail is expanded.
   */
  label: string;

  /**
   * When true, shows a small notification badge on the icon.
   */
  badge?: boolean;
}

interface Props {
  /**
   * Declarative rail item to render.
   */
  item: SidebarRailItemData;

  /**
   * Whether this item is the active selection.
   */
  active: boolean;

  /**
   * Whether the rail shows labels beside icons.
   */
  expanded: boolean;

  /**
   * Called when the user activates this item.
   */
  onSelect: () => void;

  /**
   * Keyboard handler for toolbar arrow-key navigation.
   */
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;

  /**
   * Ref attached to the item button for focus management.
   */
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * Tailwind classes for the full-width rail section chrome.
 *
 * Active/hover fill the entire section between separators — not an inset
 * pill around the control.
 *
 * @param active - Whether this item is the current selection.
 * @returns Class string for the section wrapper.
 */
function railItemSectionClasses(active: boolean): string {
  return cn(
    'hc-sidebar-rail-item-section w-full shrink-0',
    active ? 'bg-sidebar-section text-toolbar-action-active' : 'bg-transparent text-text'
  );
}

/**
 * Tailwind classes for the interactive control inside a rail section.
 *
 * Kept visually flat so selection chrome lives on the section, not the button.
 *
 * @param active - Whether this item is the current selection.
 * @param expanded - Whether the rail shows labels.
 * @returns Class string for the item button.
 */
function railItemButtonClasses(active: boolean, expanded: boolean): string {
  return cn(
    'hc-sidebar-rail-item app-no-drag relative inline-flex h-10 w-full shrink-0 cursor-pointer items-center rounded-none border-none bg-transparent',
    expanded ? 'gap-2 px-3' : 'justify-center',
    !active && 'hover:bg-selection focus-visible:bg-selection'
  );
}

/**
 * Single rail navigation section: full-width active chrome with an icon button.
 *
 * @param props - Item identity, active/expanded chrome, and activation handlers.
 * @returns Rail section with decorative icon and optional badge.
 */
export function SidebarRailItem({
  item,
  active,
  expanded,
  onSelect,
  onKeyDown,
  buttonRef
}: Props): JSX.Element {
  return (
    <div className={railItemSectionClasses(active)}>
      <button
        type="button"
        ref={buttonRef}
        className={railItemButtonClasses(active, expanded)}
        title={item.label}
        aria-label={item.label}
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <span className="relative inline-flex shrink-0 items-center justify-center">
          <FaIcon
            icon={item.icon}
            className={cn(
              'hc-sidebar-rail-item-icon h-[22.5px]! w-[22.5px]!',
              active ? 'opacity-100' : 'opacity-50'
            )}
            aria-hidden
          />
          {item.badge ? (
            <span
              className="hc-sidebar-rail-item-badge absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent"
              aria-hidden
            />
          ) : null}
        </span>
        {expanded ? (
          <span className="hc-sidebar-rail-item-label min-w-0 truncate text-left">{item.label}</span>
        ) : null}
      </button>
    </div>
  );
}
