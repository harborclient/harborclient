import {
  DEFAULT_RESPONSE_EDITOR_SPLIT_SIZE,
  type ResponseEditorSplitSide,
  type ResponseEditorSplitState
} from '@harborclient/core/types';

/**
 * Which response editor pane a context-menu action targets.
 */
export type ResponseEditorPaneKind = 'primary' | 'secondary';

/**
 * Context-menu action for splitting or unsplitting a response viewer tab.
 */
export type ResponseEditorSplitMenuAction =
  | { type: 'split'; side: ResponseEditorSplitSide }
  | { type: 'unsplit' };

/**
 * Partitions available tabs into primary and secondary strips.
 *
 * Secondary tabs keep the order of `secondaryTabIds`; primary keeps the order of
 * `tabs`. Tabs listed in `secondaryTabIds` but missing from `tabs` are omitted
 * from the secondary strip (still stored until unsplit).
 *
 * @param tabs - Currently available tab items.
 * @param secondaryTabIds - Persisted secondary pane tab ids, or null when unsplit.
 * @returns Primary and secondary tab arrays for the two strips.
 */
export function partitionResponseTabs<T extends { value: string }>(
  tabs: T[],
  secondaryTabIds: string[] | null | undefined
): { primary: T[]; secondary: T[] } {
  if (secondaryTabIds == null || secondaryTabIds.length === 0) {
    return { primary: tabs, secondary: [] };
  }

  const secondarySet = new Set(secondaryTabIds);
  const byValue = new Map(tabs.map((tab) => [tab.value, tab]));
  const primary = tabs.filter((tab) => !secondarySet.has(tab.value));
  const secondary = secondaryTabIds
    .map((id) => byValue.get(id))
    .filter((tab): tab is T => tab != null);

  return { primary, secondary };
}

/**
 * Builds the right-click menu actions for a response viewer tab.
 *
 * @param pane - Pane that owns the clicked tab.
 * @param split - Current split state, or null when unsplit.
 * @param canMoveToSecondary - False when moving would empty the primary pane.
 * @returns Ordered menu actions to show.
 */
export function buildResponseEditorSplitMenuActions(
  pane: ResponseEditorPaneKind,
  split: ResponseEditorSplitState | null,
  canMoveToSecondary: boolean
): ResponseEditorSplitMenuAction[] {
  if (pane === 'secondary') {
    return [{ type: 'unsplit' }];
  }

  if (!canMoveToSecondary) {
    return [];
  }

  if (split == null) {
    return [
      { type: 'split', side: 'left' },
      { type: 'split', side: 'right' },
      { type: 'split', side: 'down' },
      { type: 'split', side: 'up' }
    ];
  }

  return [{ type: 'split', side: split.side }];
}

/**
 * Human-readable label for a split menu action.
 *
 * @param action - Menu action to label.
 * @returns Display label for the context menu item.
 */
export function responseEditorSplitMenuLabel(action: ResponseEditorSplitMenuAction): string {
  if (action.type === 'unsplit') {
    return 'Unsplit';
  }
  switch (action.side) {
    case 'left':
      return 'Split left';
    case 'right':
      return 'Split right';
    case 'down':
      return 'Split down';
    case 'up':
      return 'Split up';
  }
}

/**
 * Moves a tab into the secondary pane, creating the split when needed.
 *
 * Returns the previous state unchanged when the move would empty the primary
 * pane (caller should gate via {@link buildResponseEditorSplitMenuActions}).
 *
 * @param current - Existing split, or null when creating one.
 * @param tabId - Tab to move into the secondary pane.
 * @param side - Split side (must match `current.side` when a split exists).
 * @param primaryTabCount - Number of tabs currently in the primary strip.
 * @param size - Secondary pane size to use when creating a new split.
 * @returns Updated split state, or null when the move is rejected.
 */
export function moveTabToSecondarySplit(
  current: ResponseEditorSplitState | null,
  tabId: string,
  side: ResponseEditorSplitSide,
  primaryTabCount: number,
  size: number = DEFAULT_RESPONSE_EDITOR_SPLIT_SIZE
): ResponseEditorSplitState | null {
  if (primaryTabCount <= 1) {
    return current;
  }

  if (current == null) {
    return {
      side,
      secondaryTabIds: [tabId],
      size,
      activeTab: tabId
    };
  }

  if (current.side !== side) {
    return current;
  }

  if (current.secondaryTabIds.includes(tabId)) {
    return {
      ...current,
      activeTab: tabId
    };
  }

  return {
    ...current,
    secondaryTabIds: [...current.secondaryTabIds, tabId],
    activeTab: tabId
  };
}

/**
 * Moves a secondary pane tab back to the primary pane.
 *
 * Clears the split entirely when no secondary tabs remain.
 *
 * @param current - Existing secondary pane state.
 * @param tabId - Tab to return to the primary pane.
 * @returns Updated split, or null when the secondary pane is empty.
 */
export function unsplitResponseTab(
  current: ResponseEditorSplitState,
  tabId: string
): ResponseEditorSplitState | null {
  const secondaryTabIds = current.secondaryTabIds.filter((id) => id !== tabId);
  if (secondaryTabIds.length === 0) {
    return null;
  }

  const activeTab =
    current.activeTab != null && secondaryTabIds.includes(current.activeTab)
      ? current.activeTab
      : (secondaryTabIds[0] ?? null);

  return {
    ...current,
    secondaryTabIds,
    activeTab
  };
}

/**
 * Picks an active tab for a pane from preferred/stored ids and available tabs.
 *
 * @param preferred - Preferred active tab id.
 * @param paneTabIds - Tab ids currently shown in the pane.
 * @param fallback - Fallback when preferred is missing or unavailable.
 * @returns Active tab id for the pane.
 */
export function resolvePaneActiveTab(
  preferred: string | null | undefined,
  paneTabIds: string[],
  fallback: string
): string {
  if (paneTabIds.length === 0) {
    return fallback;
  }
  if (preferred != null && paneTabIds.includes(preferred)) {
    return preferred;
  }
  return paneTabIds[0] ?? fallback;
}

/**
 * Whether a split side uses a horizontal (left/right) layout.
 *
 * @param side - Split side.
 * @returns True for left/right splits.
 */
export function isHorizontalResponseSplit(side: ResponseEditorSplitSide): boolean {
  return side === 'left' || side === 'right';
}

/**
 * Returns whether the active tab needs a fill-height layout container.
 *
 * @param activeTab - Currently selected tab in the pane.
 * @param pluginTabIds - Plugin contribution tab ids.
 * @returns True when the active tab needs fill layout.
 */
export function paneUsesFillLayout(activeTab: string, pluginTabIds: ReadonlySet<string>): boolean {
  return activeTab === 'preview' || pluginTabIds.has(activeTab);
}
