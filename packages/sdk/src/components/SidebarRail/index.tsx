import { faAnglesLeft, faAnglesRight } from '@fortawesome/free-solid-svg-icons';
import {
  type ComponentPropsWithoutRef,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useRef
} from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn, resolveTabListKeyAction } from '../utils.js';
import { SidebarRailItem, type SidebarRailItemData } from './SidebarRailItem.js';
import { SidebarRailSeparator } from './SidebarRailSeparator.js';
import { focusSidebarRailPanel } from './focusSidebarRailPanel.js';

export type { SidebarRailItemData };
export {
  focusSidebarRailPanel,
  focusSidebarRailTabFromPanel,
  sidebarRailTabId
} from './focusSidebarRailPanel.js';

/**
 * Shared focus-visible outline for the expand/collapse control.
 */
const railExpandFocusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent';

/**
 * Which side of the rail the associated tab panel sits on in the reading order.
 *
 * `after` (default): panel is to the right of a left-placed rail — ArrowRight
 * enters the panel. `before`: panel is to the left of a right-placed rail —
 * ArrowLeft enters the panel.
 */
export type SidebarRailPanelSide = 'after' | 'before';

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

  /**
   * Where the tab panel sits relative to the rail. Controls which horizontal
   * arrow key moves focus into the panel.
   */
  panelSide?: SidebarRailPanelSide;

  /**
   * Optional content rendered in the rail footer above the expand/collapse
   * button (for example Team Hub connection avatars). Callers that need a
   * hairline above the expand control should include a separator in this
   * content. Kept outside the tablist so it does not join the roving tabindex.
   */
  footer?: ReactNode;
}

/**
 * Resolves the key that moves focus from a rail tab into its tab panel.
 *
 * @param panelSide - Panel placement relative to the rail.
 * @returns ArrowRight when the panel is after the rail; ArrowLeft otherwise.
 */
function panelEntryKey(panelSide: SidebarRailPanelSide): 'ArrowRight' | 'ArrowLeft' {
  return panelSide === 'before' ? 'ArrowLeft' : 'ArrowRight';
}

/**
 * Selects a rail mode if needed, then moves focus into the linked tab panel.
 *
 * Uses a double `requestAnimationFrame` when selection changes so remounted
 * panel content is present before querying focusable descendants.
 *
 * @param panelId - DOM id of the tab panel.
 * @param itemId - Rail item to select before focusing.
 * @param isAlreadyActive - Whether `itemId` is already the active selection.
 * @param onSelect - Selection callback for inactive tabs.
 */
function selectAndFocusPanel(
  panelId: string,
  itemId: string,
  isAlreadyActive: boolean,
  onSelect: (id: string) => void
): void {
  /**
   * Focuses the first interactive control (or the panel itself) inside the tabpanel.
   */
  const focusPanel = (): void => {
    const panel = document.getElementById(panelId);
    if (panel instanceof HTMLElement) {
      focusSidebarRailPanel(panel);
    }
  };

  if (!isAlreadyActive) {
    onSelect(itemId);
    requestAnimationFrame(() => {
      requestAnimationFrame(focusPanel);
    });
    return;
  }

  requestAnimationFrame(focusPanel);
}

/**
 * Vertical activity rail for switching sidebar modes.
 *
 * Collapsed shows icons only; expanded shows icons with labels. Each item is a
 * full-width tab section with an edge-to-edge separator after it (including the
 * last item, so the list has a bottom border before the footer); active chrome
 * uses the sidebar-rail-active token. Items form a vertical tablist with roving
 * tabindex (APG tabs): ArrowUp/Down and Home/End move focus and selection; Tab
 * leaves the tablist for the next page control (typically the tab panel). Enter,
 * Space, and the horizontal arrow toward the panel select the mode (if needed)
 * and move focus into the linked tabpanel. Optional footer content and
 * expand/collapse sit outside the tablist as their own Tab stops.
 */
export function SidebarRail({
  items,
  activeId,
  onSelect,
  expanded,
  onExpandedChange,
  ariaLabel = 'Sidebar modes',
  panelId,
  panelSide = 'after',
  footer,
  className,
  ...props
}: Props): JSX.Element {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const entryKey = panelEntryKey(panelSide);

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
   * Handles tablist keyboard navigation: arrows/Home/End move focus and select;
   * Enter/Space and the panel-entry arrow move focus into the linked tabpanel.
   *
   * @param event - Keyboard event from the focused item.
   * @param index - Index of the item that received the event.
   */
  const handleItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const item = items[index];
      if (item == null) {
        return;
      }

      if (
        panelId != null &&
        (event.key === 'Enter' || event.key === ' ' || event.key === entryKey)
      ) {
        event.preventDefault();
        selectAndFocusPanel(panelId, item.id, item.id === activeId, onSelect);
        return;
      }

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
    [activeId, entryKey, focusItemAt, items, onSelect, panelId]
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
        'hc-sidebar-rail flex h-full shrink-0 flex-col bg-sidebar-rail text-sidebar-rail-text',
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
        {footer != null ? <div className="hc-sidebar-rail-footer-content">{footer}</div> : null}
        <button
          type="button"
          className={cn(
            'hc-sidebar-rail-expand inline-flex min-h-12 w-full cursor-pointer items-center rounded-none border-none bg-transparent py-3 text-sidebar-rail-text',
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
