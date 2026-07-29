import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, KeyboardEvent, Ref } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

/**
 * Shared focus-visible outline for rail tabs (matches TabBar / segment chrome).
 */
const railItemFocusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent';

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
   * Roving tabindex value: `0` for the selected tab, `-1` for others.
   */
  tabIndex: number;

  /**
   * Optional id of the sidebar panel this tab controls.
   */
  panelId?: string;

  /**
   * Called when the user activates this item.
   */
  onSelect: () => void;

  /**
   * Keyboard handler for tablist arrow-key navigation.
   */
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;

  /**
   * Ref attached to the item button for focus management.
   */
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * Builds the accessible name for a rail tab, including badge status when present.
 *
 * @param label - Visible item label.
 * @param badge - Whether the item shows a notification badge.
 * @returns Accessible name string for `aria-label` or visually hidden text.
 */
function railItemAccessibleName(label: string, badge: boolean | undefined): string {
  return badge === true ? `${label}, notification` : label;
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
    'hc-sidebar-rail-item-section w-full shrink-0 text-sidebar-rail-text',
    active ? 'bg-sidebar-rail-active' : 'bg-transparent'
  );
}

/**
 * Tailwind classes for the interactive control inside a rail section.
 *
 * Kept visually flat so selection chrome lives on the section, not the button.
 * Focus outline always applies (including when active) so keyboard users can
 * see focus on the current mode.
 *
 * @param active - Whether this item is the current selection.
 * @param expanded - Whether the rail shows labels.
 * @returns Class string for the item button.
 */
function railItemButtonClasses(active: boolean, expanded: boolean): string {
  return cn(
    'hc-sidebar-rail-item app-no-drag relative inline-flex min-h-12 w-full shrink-0 cursor-pointer items-center rounded-none border-none bg-transparent py-5',
    expanded ? 'gap-2 px-3' : 'justify-center',
    !active && 'hover:bg-sidebar-rail-active',
    railItemFocusVisible
  );
}

/**
 * Single rail navigation tab: full-width active chrome with an icon button.
 *
 * @param props - Item identity, active/expanded chrome, and activation handlers.
 * @returns Rail section with decorative icon and optional badge.
 */
export function SidebarRailItem({
  item,
  active,
  expanded,
  tabIndex,
  panelId,
  onSelect,
  onKeyDown,
  buttonRef
}: Props): JSX.Element {
  const accessibleName = railItemAccessibleName(item.label, item.badge);
  /**
   * Icon-only (collapsed) uses aria-label. Expanded uses visible text (plus
   * optional visually hidden badge status) as the accessible name so AT is not
   * left with a color-only cue and is not announced twice via aria-label.
   */
  const ariaLabel = expanded ? undefined : accessibleName;

  return (
    <div className={railItemSectionClasses(active)}>
      <button
        type="button"
        role="tab"
        ref={buttonRef}
        className={railItemButtonClasses(active, expanded)}
        title={item.label}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        aria-selected={active}
        aria-controls={panelId}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <span className="relative inline-flex shrink-0 items-center justify-center">
          <FaIcon
            icon={item.icon}
            className="hc-sidebar-rail-item-icon h-[22.5px]! w-[22.5px]!"
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
          <span className="hc-sidebar-rail-item-label min-w-0 truncate text-left">
            {item.label}
          </span>
        ) : null}
        {expanded && item.badge === true ? <span className="sr-only">, notification</span> : null}
      </button>
    </div>
  );
}
