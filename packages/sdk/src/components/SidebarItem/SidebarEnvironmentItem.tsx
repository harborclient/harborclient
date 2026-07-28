import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { SidebarItem, type SidebarItemSortableConfig } from './SidebarItem.js';
import { SidebarMarkerDot } from './SidebarMarkerDot.js';
import {
  SIDEBAR_CHEVRON_BUTTON_CLASS,
  SIDEBAR_CHEVRON_ICON_CLASS,
  SIDEBAR_CHEVRON_LABEL_OFFSET_CLASS,
  SIDEBAR_ITEM_BUTTON_CLASS
} from './sidebarItemClasses.js';
import { stopSortableDragPointerDown } from './stopSortableDragPointerDown.js';

interface Props {
  /**
   * Environment display name.
   */
  name: string;

  /**
   * Summary text for environment variables (e.g. "3 variables").
   */
  variableSummary: string;

  /**
   * Optional marker dot beside the environment name.
   */
  markerDot?: {
    marker: string | null | undefined;
    visible?: boolean;
    label?: string;
  };

  /**
   * Whether this row should use selected/highlighted row styling.
   */
  selected?: boolean;

  /**
   * Whether this environment has nested child environments.
   */
  hasChildren?: boolean;

  /**
   * Whether the child environment list is expanded.
   */
  expanded?: boolean;

  /**
   * Id of the child region controlled by this row (`SidebarTreeGroup` id).
   */
  childrenId?: string;

  /**
   * Nesting depth for indentation (`0` = root, no extra indent).
   */
  level?: number;

  /**
   * Total siblings at this level (tree a11y).
   */
  setSize?: number;

  /**
   * 1-based position among siblings at this level (tree a11y).
   */
  posInSet?: number;

  /**
   * Toggles child environment expand/collapse when {@link hasChildren} is true.
   */
  onToggleExpand?: () => void;

  /**
   * Icons for expand/collapse chevrons when {@link hasChildren} is true.
   */
  expandIcon?: IconDefinition;
  collapseIcon?: IconDefinition;

  /**
   * dnd-kit sortable configuration for environment reordering.
   */
  sortable?: SidebarItemSortableConfig;

  /**
   * Accessible label for the listbox option or tree item. When omitted, the name
   * is derived from visible row content (name, variable summary).
   */
  ariaLabel?: string;

  /**
   * Overrides the `aria-selected` state. When omitted, falls back to `selected`.
   * Use to decouple selection semantics from highlight styling.
   */
  ariaSelected?: boolean;

  /**
   * When true, marks the row as the current item with `aria-current="true"`.
   */
  ariaCurrent?: boolean;

  /**
   * Called when the user right-clicks the row container.
   */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the primary label area is activated.
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when the primary label area is double-clicked.
   */
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Called when Enter is pressed on the primary label area.
   */
  onEnter?: () => void;

  /**
   * Trailing actions slot, typically a row actions menu.
   */
  actions?: ReactNode;

  /**
   * Optional data attribute value for keyboard navigation focus targets.
   */
  dataSidebarEnvironmentId?: string | number;

  /**
   * HTML element for the row container. Use `li` inside {@link SidebarListbox}
   * or {@link SidebarTree}.
   */
  as?: 'div' | 'li';
}

/**
 * Nesting indent step matching Tailwind `ml-4` (1rem) per depth level.
 */
const ENVIRONMENT_LEVEL_INDENT_PX = 16;

/**
 * Renders an environment row in the Collections sidebar Environments section.
 *
 * Flat list rows use listbox option semantics. Nested tree rows (when `level` is
 * set) use treeitem semantics with optional expand/collapse chevrons.
 *
 * The accessible name is derived from visible row content (name, variable summary).
 */
export function SidebarEnvironmentItem({
  name,
  variableSummary,
  markerDot,
  selected = false,
  hasChildren = false,
  expanded = false,
  childrenId,
  level,
  setSize,
  posInSet,
  onToggleExpand,
  expandIcon,
  collapseIcon,
  sortable,
  ariaLabel,
  ariaSelected,
  ariaCurrent,
  onContextMenu,
  onClick,
  onDoubleClick,
  onEnter,
  actions,
  dataSidebarEnvironmentId,
  as = 'li'
}: Props): JSX.Element {
  const useTreeItem = as === 'li' && level != null;
  const useListboxOption = as === 'li' && !useTreeItem;
  const showChevron =
    hasChildren && expandIcon != null && collapseIcon != null && onToggleExpand != null;
  const indentPx = (level ?? 0) * ENVIRONMENT_LEVEL_INDENT_PX;

  /**
   * Opens environment settings when Enter is pressed on the name area.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' || onEnter == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onEnter();
  };

  const chevronLabel = expanded ? `Collapse environment "${name}"` : `Expand environment "${name}"`;
  const labelOffsetClass = useTreeItem ? SIDEBAR_CHEVRON_LABEL_OFFSET_CLASS : '';

  return (
    <SidebarItem
      selected={selected}
      sortable={sortable}
      onContextMenu={onContextMenu}
      actions={actions}
      as={as}
      listboxOption={
        useListboxOption
          ? {
              ariaLabel,
              ariaSelected,
              ariaCurrent,
              onClick,
              onDoubleClick,
              onKeyDown: onEnter != null ? handleKeyDown : undefined
            }
          : undefined
      }
      treeItem={
        useTreeItem
          ? {
              ariaLabel,
              expanded: hasChildren ? expanded : undefined,
              controlsId: hasChildren ? childrenId : undefined,
              level: (level ?? 0) + 1,
              setSize,
              posInSet,
              onClick,
              onDoubleClick,
              onKeyDown: onEnter != null ? handleKeyDown : undefined
            }
          : undefined
      }
    >
      <span
        className={SIDEBAR_ITEM_BUTTON_CLASS}
        style={indentPx > 0 ? { paddingLeft: indentPx } : undefined}
        {...(dataSidebarEnvironmentId != null
          ? { 'data-sidebar-environment-id': String(dataSidebarEnvironmentId) }
          : {})}
      >
        {showChevron ? (
          <button
            type="button"
            className={SIDEBAR_CHEVRON_BUTTON_CLASS}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand();
            }}
            onPointerDown={stopSortableDragPointerDown}
            tabIndex={-1}
            aria-label={chevronLabel}
          >
            <FaIcon
              icon={expanded ? collapseIcon : expandIcon}
              className={SIDEBAR_CHEVRON_ICON_CLASS}
            />
          </button>
        ) : useTreeItem ? (
          <span className="inline-flex h-4 w-4 shrink-0" aria-hidden />
        ) : null}
        <span className={`inline-flex min-w-0 flex-1 items-center gap-1.5 ${labelOffsetClass}`}>
          <span className="min-w-0 truncate">{name}</span>
          {markerDot != null ? (
            <SidebarMarkerDot
              marker={markerDot.marker}
              visible={markerDot.visible}
              label={markerDot.label}
            />
          ) : null}
        </span>
        <span className="shrink-0 text-muted">{variableSummary}</span>
      </span>
    </SidebarItem>
  );
}
