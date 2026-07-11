import { useCallback, useMemo, useState } from 'react';
import {
  applySidebarSelectionClick,
  orderSelectedIds
} from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarSelectionUtils';

/**
 * Modifier keys captured from a sidebar row click.
 */
export interface SidebarRowClickModifiers {
  /**
   * Whether the shift key was held during the click.
   */
  shiftKey: boolean;

  /**
   * Whether ctrl (Windows/Linux) or meta (macOS) was held during the click.
   */
  ctrlOrMetaKey: boolean;
}

/**
 * Return value from {@link useSidebarRowSelection}.
 */
export interface SidebarRowSelectionState {
  /** Currently selected row ids. */
  selectedIds: Set<number>;
  /** Number of selected rows. */
  selectionCount: number;
  /** Selected row ids in visible list order. */
  selectedOrdered: number[];
  /** Clears the current multi-selection and range anchor. */
  clearSelection: () => void;
  /** Applies modifier-click semantics and optionally runs the row primary action. */
  handleRowClick: (
    rowId: number,
    modifiers: SidebarRowClickModifiers,
    onPrimaryAction?: () => void
  ) => void;
  /** Ensures the context-menu target row is included in the selection set. */
  handleBeforeContextMenu: (rowId: number) => void;
  /** Returns whether a row id is part of the current multi-selection. */
  isSelected: (rowId: number) => boolean;
}

/**
 * Manages multi-select state for a flat sidebar list section.
 *
 * @param visibleOrder - Row ids in on-screen list order (used for shift-click ranges and bulk ordering).
 * @returns Selection state and handlers shared across sidebar sections.
 */
export function useSidebarRowSelection(visibleOrder: number[]): SidebarRowSelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<number | null>(null);

  /**
   * Clears the current multi-selection and range anchor.
   */
  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
    setSelectionAnchorId(null);
  }, []);

  /**
   * Applies modifier-click semantics and optionally runs the row primary action.
   *
   * @param rowId - Clicked row id.
   * @param modifiers - Shift and ctrl/meta state from the click event.
   * @param onPrimaryAction - Called on plain click after clearing multi-selection.
   */
  const handleRowClick = useCallback(
    (rowId: number, modifiers: SidebarRowClickModifiers, onPrimaryAction?: () => void): void => {
      const result = applySidebarSelectionClick(
        selectedIds,
        selectionAnchorId,
        visibleOrder,
        rowId,
        modifiers
      );
      setSelectedIds(result.selectedIds);
      setSelectionAnchorId(result.anchorId);
      if (result.shouldOpen) {
        onPrimaryAction?.();
      }
    },
    [selectedIds, selectionAnchorId, visibleOrder]
  );

  /**
   * Ensures the context-menu target row is included in the selection set.
   *
   * @param rowId - Row id that received the context menu event.
   */
  const handleBeforeContextMenu = useCallback(
    (rowId: number): void => {
      if (selectedIds.has(rowId)) {
        return;
      }
      setSelectedIds(new Set([rowId]));
      setSelectionAnchorId(rowId);
    },
    [selectedIds]
  );

  /**
   * Selected row ids ordered by their position in the visible list.
   */
  const selectedOrdered = useMemo(
    () => orderSelectedIds(selectedIds, visibleOrder),
    [selectedIds, visibleOrder]
  );

  /**
   * Returns whether a row id is part of the current multi-selection.
   *
   * @param rowId - Row id to check.
   */
  const isSelected = useCallback((rowId: number): boolean => selectedIds.has(rowId), [selectedIds]);

  return {
    selectedIds,
    selectionCount: selectedIds.size,
    selectedOrdered,
    clearSelection,
    handleRowClick,
    handleBeforeContextMenu,
    isSelected
  };
}
