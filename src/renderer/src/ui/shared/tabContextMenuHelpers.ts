import type { MenuItem } from '@harborclient/sdk/components';

interface TabCloseMenuActions<T extends string | number> {
  /**
   * Closes a single tab.
   */
  onClose: (id: T) => void;

  /**
   * Closes every tab in `ids`.
   */
  onCloseMany: (ids: T[]) => void;

  /**
   * Closes tabs that are considered saved (non-dirty for requests, with messages for AI).
   */
  onCloseSaved: () => void;
}

/**
 * Builds grouped context menu items shared by request and AI tab bars.
 *
 * @param orderedIds - Tab ids in display order.
 * @param targetId - Tab that was right-clicked.
 * @param actions - Close handlers for single, bulk, and saved-only operations.
 */
export function buildTabCloseMenuGroups<T extends string | number>(
  orderedIds: readonly T[],
  targetId: T,
  actions: TabCloseMenuActions<T>
): MenuItem[][] {
  const targetIndex = orderedIds.indexOf(targetId);
  const others = tabIdsToCloseOthers(orderedIds, targetId);
  const toTheRight = tabIdsToCloseToTheRight(orderedIds, targetId);
  const items: MenuItem[] = [{ label: 'Close', onSelect: () => actions.onClose(targetId) }];

  if (orderedIds.length > 1) {
    items.push({ label: 'Close others', onSelect: () => actions.onCloseMany(others) });
  }

  if (targetIndex >= 0 && targetIndex < orderedIds.length - 1) {
    items.push({
      label: 'Close to the right',
      onSelect: () => actions.onCloseMany(toTheRight)
    });
  }

  items.push(
    { label: 'Close saved', onSelect: () => actions.onCloseSaved() },
    { label: 'Close all', onSelect: () => actions.onCloseMany([...orderedIds]) }
  );

  return [items];
}

/**
 * Returns tab ids for every tab except the one at `targetId`.
 *
 * @param orderedIds - Tab ids in display order.
 * @param targetId - Tab that should remain open.
 * @returns Ids of all other tabs.
 */
export function tabIdsToCloseOthers<T extends string | number>(
  orderedIds: readonly T[],
  targetId: T
): T[] {
  return orderedIds.filter((id) => id !== targetId);
}

/**
 * Returns tab ids positioned to the right of `targetId` in display order.
 *
 * @param orderedIds - Tab ids in display order.
 * @param targetId - Tab whose right-hand neighbors should be closed.
 * @returns Ids of tabs after `targetId`, or an empty array when not found.
 */
export function tabIdsToCloseToTheRight<T extends string | number>(
  orderedIds: readonly T[],
  targetId: T
): T[] {
  const index = orderedIds.indexOf(targetId);
  if (index < 0) {
    return [];
  }
  return orderedIds.slice(index + 1);
}

/**
 * Returns chat ids that have at least one persisted message.
 *
 * Empty or newly created chats are treated as unsaved and excluded so
 * "Close saved" keeps them open.
 *
 * @param orderedIds - Open chat ids in display order.
 * @param messagesByChat - Message lists keyed by chat id.
 * @returns Chat ids with one or more messages.
 */
export function chatIdsWithMessages(
  orderedIds: readonly number[],
  messagesByChat: Readonly<Record<number, readonly unknown[]>>
): number[] {
  return orderedIds.filter((id) => (messagesByChat[id] ?? []).length > 0);
}
