import { faAnglesLeft, faAnglesRight } from '@fortawesome/free-solid-svg-icons';
import {
  type ComponentPropsWithoutRef,
  type JSX,
  type KeyboardEvent,
  useCallback,
  useRef
} from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';
import { SidebarRailItem, type SidebarRailItemData } from './SidebarRailItem.js';
import { SidebarRailSeparator } from './SidebarRailSeparator.js';

export type { SidebarRailItemData };

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
   * Accessible name for the vertical toolbar landmark.
   */
  ariaLabel?: string;
}

/**
 * Vertical activity rail for switching sidebar modes.
 *
 * Collapsed shows icons only; expanded shows icons with labels. Each item is a
 * full-width section with edge-to-edge separators between them; selection chrome
 * fills the active section. The footer expand control is divided by a top
 * border. Arrow keys move focus between items; Home/End jump to the first/last
 * item.
 */
export function SidebarRail({
  items,
  activeId,
  onSelect,
  expanded,
  onExpandedChange,
  ariaLabel = 'Sidebar',
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
   * Handles toolbar keyboard navigation for a rail item button.
   *
   * @param event - Keyboard event from the focused item.
   * @param index - Index of the item that received the event.
   */
  const handleItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = items.length - 1;
      if (lastIndex < 0) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusItemAt(index === lastIndex ? 0 : index + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusItemAt(index === 0 ? lastIndex : index - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusItemAt(0);
          break;
        case 'End':
          event.preventDefault();
          focusItemAt(lastIndex);
          break;
        default:
          break;
      }
    },
    [focusItemAt, items.length]
  );

  /**
   * Toggles the rail between collapsed and expanded density.
   */
  const handleToggleExpanded = useCallback(() => {
    onExpandedChange(!expanded);
  }, [expanded, onExpandedChange]);

  return (
    <div
      {...props}
      role="toolbar"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      className={cn(
        'hc-sidebar-rail app-no-drag flex h-full shrink-0 flex-col border-r border-separator bg-sidebar-toolbar',
        expanded ? 'w-[168px]' : 'w-18',
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        className
      )}
    >
      <div className="hc-sidebar-rail-items flex min-h-0 flex-1 flex-col items-stretch overflow-x-hidden overflow-y-auto">
        {items.flatMap((item, index) => {
          const nodes: JSX.Element[] = [
            <SidebarRailItem
              key={item.id}
              item={item}
              active={item.id === activeId}
              expanded={expanded}
              onSelect={() => onSelect(item.id)}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
              buttonRef={(node) => {
                itemRefs.current[index] = node;
              }}
            />
          ];
          if (index < items.length - 1) {
            nodes.push(<SidebarRailSeparator key={`${item.id}-separator`} />);
          }
          return nodes;
        })}
      </div>
      <div className="hc-sidebar-rail-footer shrink-0 border-t border-separator">
        <button
          type="button"
          className={cn(
            'hc-sidebar-rail-expand app-no-drag inline-flex h-10 w-full cursor-pointer items-center rounded-none border-none bg-transparent text-text',
            expanded ? 'gap-2 px-3' : 'justify-center',
            'hover:bg-selection focus-visible:bg-selection'
          )}
          aria-label={expanded ? 'Collapse sidebar rail' : 'Expand sidebar rail'}
          aria-expanded={expanded}
          title={expanded ? 'Collapse' : 'Expand'}
          onClick={handleToggleExpanded}
        >
          <FaIcon
            icon={expanded ? faAnglesLeft : faAnglesRight}
            className="h-[18px]! w-[18px]! opacity-50"
            aria-hidden
          />
          {expanded ? <span className="min-w-0 truncate text-left">Collapse</span> : null}
        </button>
      </div>
    </div>
  );
}
