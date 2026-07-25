import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import type { CSSProperties, JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { SIDEBAR_DRAG_HANDLE_CLASS } from './sidebarItemClasses.js';

interface Props {
  /**
   * Stable dnd-kit sortable id for this row.
   */
  id: string;

  /**
   * Row container element.
   */
  as?: 'div' | 'li';

  /**
   * Row container class names.
   */
  className: string;

  /**
   * Accessible name for the drag handle (e.g. "Reorder collection \"API\"").
   */
  dragHandleLabel: string;

  /**
   * Row contents, typically label and action controls.
   */
  children: ReactNode;

  /**
   * When true, renders a static row without drag-and-drop behavior.
   */
  disabled?: boolean;

  /**
   * Called when the user right-clicks the row container.
   */
  onRowContextMenu?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Optional listbox option or treeitem attributes forwarded from {@link SidebarItem}.
   */
  role?: 'option' | 'treeitem';
  'aria-selected'?: 'true' | 'false';
  'aria-label'?: string;
  'aria-expanded'?: 'true' | 'false';
  'aria-controls'?: string;
  'aria-level'?: number;
  'aria-setsize'?: number;
  'aria-posinset'?: number;
  tabIndex?: number;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Wraps a sidebar row with dnd-kit sortable drag behavior. Reordering is activated
 * from a dedicated grip handle so keyboard users can focus it and use the keyboard
 * sensor; listbox option interaction and nested row controls stay on the row container.
 */
export function SortableSidebarItem({
  id,
  as: Container = 'div',
  className,
  dragHandleLabel,
  children,
  disabled = false,
  onRowContextMenu,
  role,
  'aria-selected': ariaSelected,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
  'aria-level': ariaLevel,
  'aria-setsize': ariaSetSize,
  'aria-posinset': ariaPosInSet,
  tabIndex,
  onClick,
  onDoubleClick,
  onKeyDown
}: Props): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled });

  const isInteractiveRow = role === 'option' || role === 'treeitem';
  const interactiveProps = isInteractiveRow
    ? {
        role,
        'aria-selected': ariaSelected,
        ...(ariaLabel != null ? { 'aria-label': ariaLabel } : {}),
        ...(ariaExpanded != null ? { 'aria-expanded': ariaExpanded } : {}),
        ...(ariaControls != null ? { 'aria-controls': ariaControls } : {}),
        ...(ariaLevel != null ? { 'aria-level': ariaLevel } : {}),
        ...(ariaSetSize != null ? { 'aria-setsize': ariaSetSize } : {}),
        ...(ariaPosInSet != null ? { 'aria-posinset': ariaPosInSet } : {}),
        tabIndex,
        ...(onClick != null ? { onClick } : {}),
        ...(onDoubleClick != null ? { onDoubleClick } : {}),
        ...(onKeyDown != null ? { onKeyDown } : {})
      }
    : {};

  if (disabled) {
    return (
      <Container className={className} onContextMenu={onRowContextMenu} {...interactiveProps}>
        {children}
      </Container>
    );
  }

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? transition : undefined,
    opacity: isDragging ? 0.45 : undefined
  };

  return (
    <Container
      ref={setNodeRef}
      style={style}
      className={className}
      onContextMenu={onRowContextMenu}
      {...interactiveProps}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={SIDEBAR_DRAG_HANDLE_CLASS}
        aria-label={dragHandleLabel}
        {...attributes}
        {...listeners}
      >
        <FaIcon icon={faGripVertical} className="h-2.5 w-2.5" aria-hidden />
      </button>
      {children}
    </Container>
  );
}
