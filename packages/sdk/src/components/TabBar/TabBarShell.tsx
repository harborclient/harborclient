import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import { TabCloseButton } from '../TabCloseButton/index.js';
import { tabItem } from '../classes.js';
import { cn } from '../utils.js';
import type { TabBarItem, TabBarSortableCursor } from './types.js';
import { useSortableTabItem } from './useSortableTabItem.js';

interface Props<TId extends string | number> {
  /**
   * Tab row data to render.
   */
  item: TabBarItem<TId>;

  /**
   * Tab order index for the tab label; all tabs stay in sequential Tab order.
   */
  tabIndex: number;

  /**
   * Stable dnd-kit sortable id for this tab row.
   */
  sortableId: string;

  /**
   * When true, drag reordering is disabled for this tab.
   */
  sortableDisabled?: boolean;

  /**
   * When true, renders a non-interactive snapshot for the close animation.
   */
  exiting?: boolean;

  /**
   * Prefix for tab element ids (for example `request-tab-`).
   */
  tabIdPrefix: string;

  /**
   * Prefix for linked tab panel ids (for example `request-tabpanel-`).
   */
  panelIdPrefix: string;

  /**
   * Maximum width class for the tab shell.
   */
  maxTabWidthClass?: string;

  /**
   * Cursor style when sortable drag is enabled.
   */
  sortableCursor?: TabBarSortableCursor;

  /**
   * Called when the user selects this tab.
   */
  onSelect: (id: TId) => void;

  /**
   * Called when the user closes this tab.
   */
  onClose: (id: TId) => void;

  /**
   * Called when the user opens the tab context menu.
   */
  onContextMenu?: (id: TId, event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Single document-style tab row with close button and optional drag reordering.
 */
export function TabBarShell<TId extends string | number>({
  item,
  tabIndex,
  sortableId,
  sortableDisabled = false,
  exiting = false,
  tabIdPrefix,
  panelIdPrefix,
  maxTabWidthClass = 'max-w-[220px]',
  sortableCursor = 'pointer',
  onSelect,
  onClose,
  onContextMenu
}: Props<TId>): JSX.Element {
  /**
   * Activates this tab when the user presses Enter or Space on the tab control.
   *
   * @param event - Keyboard event from the tab element.
   */
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(item.id);
    }
  };

  const { setNodeRef, listeners, style } = useSortableTabItem(
    sortableId,
    sortableDisabled || exiting
  );
  const showActive = exiting ? false : item.active || Boolean(item.highlighted);

  const cursorClass =
    exiting || sortableDisabled
      ? 'cursor-pointer'
      : sortableCursor === 'grab'
        ? 'cursor-grab active:cursor-grabbing'
        : 'cursor-pointer';

  return (
    <div
      ref={exiting ? undefined : setNodeRef}
      style={exiting ? undefined : style}
      role="tab"
      id={exiting ? undefined : `${tabIdPrefix}${String(item.id)}`}
      aria-controls={exiting ? undefined : `${panelIdPrefix}${String(item.id)}`}
      aria-selected={item.active}
      aria-label={item.accessibleName}
      title={item.title}
      tabIndex={exiting ? -1 : tabIndex}
      className={cn(
        'group -mb-1 flex min-h-12 shrink-0 items-stretch gap-2.5 self-stretch rounded-t-lg border border-b-2 px-4',
        maxTabWidthClass,
        exiting ? 'pointer-events-none' : cursorClass,
        tabItem(showActive)
      )}
      onClick={exiting ? undefined : () => onSelect(item.id)}
      onContextMenu={
        exiting
          ? undefined
          : (event) => {
              event.preventDefault();
              onContextMenu?.(item.id, event);
            }
      }
      onKeyDown={exiting ? undefined : handleTabKeyDown}
      {...(sortableDisabled || exiting ? {} : listeners)}
    >
      <span className="app-no-drag flex min-w-0 flex-1 items-center gap-1.5 py-2 text-inherit">
        {item.content}
      </span>
      {!exiting && (
        <span
          className="app-no-drag flex shrink-0 items-center self-center"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <TabCloseButton
            ariaLabel={item.closeAccessibleName}
            title={item.closeAccessibleName}
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onClose(item.id);
            }}
          />
        </span>
      )}
    </div>
  );
}
