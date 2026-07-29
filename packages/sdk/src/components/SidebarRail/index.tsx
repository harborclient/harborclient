import { faAnglesLeft, faAnglesRight } from '@fortawesome/free-solid-svg-icons';
import {
  type ComponentPropsWithoutRef,
  type JSX,
  type KeyboardEvent,
  useCallback,
  useRef
} from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn, resolveTabListKeyAction } from '../utils.js';
import { SidebarRailItem, type SidebarRailItemData } from './SidebarRailItem.js';
import { SidebarRailSeparator } from './SidebarRailSeparator.js';

export type { SidebarRailItemData };

/**
 * Shared focus-visible outline for the expand/collapse control.
 */
const railExpandFocusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent';

interface Props extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'aria-label' | 'onSelect'
> {
  /**
   * Navigation entries rendered top-to-bottom in the rail.
   */
  items: SidebarRailItemData[];

  /**
   * Id of the currently selected rail item.
   */
  activeId: string;

  /**
   * Called when the user selects a different rail item.
   *
   * @param id - Selected item id from {@link SidebarRailItemData.id}.
   */
  onSelect: (id: string) => void;

  /**
   * When true, shows labels beside icons and uses the expanded width.
   */
  expanded: boolean;

  /**
   * Called when the user toggles the rail between collapsed and expanded.
   *
   * @param expanded - Next expanded state.
   */
  onExpandedChange: (expanded: boolean) => void;

  /**
   * Accessible name for the vertical tablist of sidebar modes.
   */
  ariaLabel?: string;

  /**
   * Id of the sidebar panel controlled by each rail tab (`aria-controls`).
   */
  panelId?: string;
}

/**
 * Vertical activity rail for switching sidebar modes.
 *
 * Collapsed shows icons only; expanded shows icons with labels. Each item is a
 * full-width tab section with an edge-to-edge separator after it (including the
 * last item, so the list has a bottom border before the footer); active chrome
 * uses the sidebar-rail-active token. Items form a vertical tablist with
 * roving tabindex; Arrow keys move focus and selection; Home/End jump to the
 * first/last item. Expand/collapse sits outside the tablist as its own Tab stop.
 */
export function SidebarRail({
  items,
  activeId,
  onSelect,
  expanded,
  onExpandedChange,
  ariaLabel = 'Sidebar modes',
  panelId,
  className,
  ...props
}: Props): JSX.Element {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /**
   * Focuses the item button at the given index when it exists.
   *
   * @param index - Zero-based item index to focus.
   */
  const focusItemAt = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, itemRefs.current.length - 1));
    itemRefs.current[clamped]?.focus();
  }, []);

  /**
   * Handles tablist keyboard navigation: arrows/Home/End move focus and select.
   *
   * @param event - Keyboard event from the focused item.
   * @param index - Index of the item that received the event.
   */
  const handleItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const nextIndex = resolveTabListKeyAction(event.key, index, items.length);
      if (nextIndex === null) {
        return;
      }

      event.preventDefault();
      const nextItem = items[nextIndex];
      if (nextItem == null) {
        return;
      }

      onSelect(nextItem.id);
      focusItemAt(nextIndex);
    },
    [focusItemAt, items, onSelect]
  );

  /**
   * Toggles the rail between collapsed and expanded density.
   */
  const handleToggleExpanded = useCallback(() => {
    onExpandedChange(!expanded);
  }, [expanded, onExpandedChange]);

  const expandLabel = expanded ? 'Collapse' : 'Expand';
  const expandAriaLabel = expanded ? 'Collapse sidebar rail' : 'Expand sidebar rail';

  return (
    <div
      {...props}
      className={cn(
        'hc-sidebar-rail app-no-drag flex h-full shrink-0 flex-col bg-sidebar-rail text-sidebar-rail-text',
        expanded ? 'w-[168px]' : 'w-18',
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        className
      )}
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label={ariaLabel}
        className="hc-sidebar-rail-items flex min-h-0 flex-1 flex-col items-stretch overflow-x-hidden overflow-y-auto"
      >
        {items.flatMap((item, index) => [
          <SidebarRailItem
            key={item.id}
            item={item}
            active={item.id === activeId}
            expanded={expanded}
            tabIndex={item.id === activeId ? 0 : -1}
            panelId={panelId}
            onSelect={() => onSelect(item.id)}
            onKeyDown={(event) => handleItemKeyDown(event, index)}
            buttonRef={(node) => {
              itemRefs.current[index] = node;
            }}
          />,
          <SidebarRailSeparator key={`${item.id}-separator`} />
        ])}
      </div>
      <div className="hc-sidebar-rail-footer shrink-0">
        <button
          type="button"
          className={cn(
            'hc-sidebar-rail-expand app-no-drag inline-flex min-h-12 w-full cursor-pointer items-center rounded-none border-none bg-transparent py-3 text-sidebar-rail-text',
            expanded ? 'gap-2 px-3' : 'justify-center',
            'hover:bg-sidebar-rail-active',
            railExpandFocusVisible
          )}
          aria-label={expanded ? undefined : expandAriaLabel}
          aria-expanded={expanded}
          title={expandLabel}
          onClick={handleToggleExpanded}
        >
          <FaIcon
            icon={expanded ? faAnglesLeft : faAnglesRight}
            className="h-[18px]! w-[18px]!"
            aria-hidden
          />
          {expanded ? <span className="min-w-0 truncate text-left">{expandLabel}</span> : null}
        </button>
      </div>
    </div>
  );
}
