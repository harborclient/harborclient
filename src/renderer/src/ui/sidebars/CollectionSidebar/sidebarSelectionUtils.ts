/**
 * Result of applying a click to a sidebar row selection model.
 */
export interface SidebarSelectionClickResult {
  /**
   * Updated set of selected row ids.
   */
  selectedIds: Set<number>;

  /**
   * Anchor id used for subsequent shift-click range selection.
   */
  anchorId: number;

  /**
   * When true, the caller should perform the row's primary action (open, activate, etc.).
   */
  shouldOpen: boolean;
}

/**
 * Toggles membership of a row id in the selection set.
 *
 * @param selectedIds - Current selection.
 * @param rowId - Row id to toggle.
 * @returns New selection with the id added or removed.
 */
export function toggleSidebarSelection(selectedIds: Set<number>, rowId: number): Set<number> {
  const next = new Set(selectedIds);
  if (next.has(rowId)) {
    next.delete(rowId);
  } else {
    next.add(rowId);
  }
  return next;
}

/**
 * Returns row ids between two anchors in visible sidebar order (inclusive).
 *
 * @param visibleOrder - Row ids in on-screen list order.
 * @param anchorId - Start of the range.
 * @param targetId - End of the range.
 * @returns Contiguous slice of ids between the anchors.
 */
export function rangeSelectIds(
  visibleOrder: number[],
  anchorId: number,
  targetId: number
): number[] {
  const anchorIndex = visibleOrder.indexOf(anchorId);
  const targetIndex = visibleOrder.indexOf(targetId);
  if (anchorIndex < 0 || targetIndex < 0) {
    return [targetId];
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return visibleOrder.slice(start, end + 1);
}

/**
 * Applies standard modifier-click semantics to a sidebar row selection.
 *
 * @param selectedIds - Current selection.
 * @param anchorId - Last non-shift anchor, or null when unset.
 * @param visibleOrder - Row ids in on-screen list order.
 * @param rowId - Clicked row id.
 * @param modifiers - Whether shift and ctrl/meta were held during the click.
 * @returns Updated selection, anchor, and whether the row's primary action should run.
 */
export function applySidebarSelectionClick(
  selectedIds: Set<number>,
  anchorId: number | null,
  visibleOrder: number[],
  rowId: number,
  modifiers: { shiftKey: boolean; ctrlOrMetaKey: boolean }
): SidebarSelectionClickResult {
  if (modifiers.ctrlOrMetaKey) {
    return {
      selectedIds: toggleSidebarSelection(selectedIds, rowId),
      anchorId: rowId,
      shouldOpen: false
    };
  }

  if (modifiers.shiftKey) {
    if (anchorId == null) {
      return {
        selectedIds: new Set([rowId]),
        anchorId: rowId,
        shouldOpen: false
      };
    }
    return {
      selectedIds: new Set(rangeSelectIds(visibleOrder, anchorId, rowId)),
      anchorId,
      shouldOpen: false
    };
  }

  return {
    selectedIds: new Set(),
    anchorId: rowId,
    shouldOpen: true
  };
}

/**
 * Orders selected row ids by their position in the visible sidebar list.
 *
 * @param selectedIds - Selected row ids.
 * @param visibleOrder - Row ids in on-screen list order.
 * @returns Selected ids sorted by visible order.
 */
export function orderSelectedIds(selectedIds: Set<number>, visibleOrder: number[]): number[] {
  return visibleOrder.filter((id) => selectedIds.has(id));
}
