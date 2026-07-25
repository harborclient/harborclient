import { useCallback, useEffect, useRef, useState } from '@harborclient/sdk/react';

/**
 * Snapshot of a tab row kept in the DOM while its close animation plays.
 */
export interface ExitingTabItem<T, TId> {
  /**
   * Tab data captured at removal time.
   */
  item: T;

  /**
   * Id of the live tab immediately to the right before removal, or null when
   * this tab was last in the row.
   */
  insertBeforeId: TId | null;

  /**
   * Stable React key for this exit animation instance.
   */
  exitKey: string;
}

/**
 * Resolves the anchor id for an exiting tab: the first still-open tab that was
 * to its right in the previous list, or null when none remain on the right.
 *
 * @param previousItems - Tab list before removal.
 * @param removedIndex - Index of the tab being removed.
 * @param currentIds - Ids that remain open after removal.
 * @param getId - Reads a stable id from a tab item.
 * @returns Anchor id for render placement, or null for end-of-row placement.
 */
export function resolveInsertBeforeId<T, TId>(
  previousItems: T[],
  removedIndex: number,
  currentIds: Set<TId>,
  getId: (item: T) => TId
): TId | null {
  for (let index = removedIndex + 1; index < previousItems.length; index += 1) {
    const id = getId(previousItems[index]);
    if (currentIds.has(id)) {
      return id;
    }
  }

  return null;
}

/**
 * Detects tabs removed between two list snapshots and their render anchors.
 *
 * @param previousItems - Tab list before removal.
 * @param currentItems - Tab list after removal.
 * @param getId - Reads a stable id from a tab item.
 * @returns Removed tabs with placement anchors for exit animation.
 */
export function detectRemovedTabItems<T, TId>(
  previousItems: T[],
  currentItems: T[],
  getId: (item: T) => TId
): Array<{ item: T; insertBeforeId: TId | null }> {
  const currentIds = new Set(currentItems.map(getId));
  const removed: Array<{ item: T; insertBeforeId: TId | null }> = [];

  for (let index = 0; index < previousItems.length; index += 1) {
    const item = previousItems[index];
    const id = getId(item);
    if (currentIds.has(id)) {
      continue;
    }

    removed.push({
      item,
      insertBeforeId: resolveInsertBeforeId(previousItems, index, currentIds, getId)
    });
  }

  return removed;
}

interface UseExitingTabItemsResult<T, TId> {
  /**
   * Tabs currently playing their close animation.
   */
  exiting: ExitingTabItem<T, TId>[];

  /**
   * Ids removed in the latest list update (cleared on the next stable render).
   */
  removedIds: TId[];

  /**
   * Drops a finished exit snapshot from local state.
   *
   * @param exitKey - Key returned with the exiting tab entry.
   */
  completeExit: (exitKey: string) => void;

  /**
   * Returns exit snapshots that should render immediately before an anchor tab.
   *
   * @param anchorId - Live tab id to the right of the snapshot, or null for end-of-row.
   */
  getExitingBefore: (anchorId: TId | null) => ExitingTabItem<T, TId>[];
}

/**
 * Tracks tab rows removed from a live list and keeps snapshots for exit animation.
 *
 * @param items - Current open tabs from Redux or parent state.
 * @param getId - Reads a stable id from a tab item.
 * @returns Exiting snapshots, placement helpers, and ids removed last update.
 */
export function useExitingTabItems<T, TId>(
  items: T[],
  getId: (item: T) => TId
): UseExitingTabItemsResult<T, TId> {
  const previousItemsRef = useRef(items);
  const getIdRef = useRef(getId);
  const exitCounterRef = useRef(0);
  const [exiting, setExiting] = useState<ExitingTabItem<T, TId>[]>([]);
  const [removedIds, setRemovedIds] = useState<TId[]>([]);

  /**
   * Keeps the latest id getter available to the removal effect without re-running it.
   */
  useEffect(() => {
    getIdRef.current = getId;
  }, [getId]);

  /**
   * Captures removed tabs whenever the live list shrinks.
   */
  useEffect(() => {
    const previousItems = previousItemsRef.current;
    const removed = detectRemovedTabItems(previousItems, items, getIdRef.current);

    if (removed.length > 0) {
      const nextExiting = removed.map(({ item, insertBeforeId }) => {
        exitCounterRef.current += 1;
        return {
          item,
          insertBeforeId,
          exitKey: `${String(getIdRef.current(item))}-exit-${exitCounterRef.current}`
        };
      });

      setExiting((current) => [...current, ...nextExiting]);
      setRemovedIds(removed.map((entry) => getIdRef.current(entry.item)));
    } else {
      setRemovedIds([]);
    }

    previousItemsRef.current = items;
  }, [items]);

  /**
   * Removes a finished exit snapshot after its width transition completes.
   */
  const completeExit = useCallback((exitKey: string): void => {
    setExiting((current) => current.filter((entry) => entry.exitKey !== exitKey));
  }, []);

  /**
   * Groups exit snapshots by the live tab they should render in front of.
   */
  const getExitingBefore = useCallback(
    (anchorId: TId | null): ExitingTabItem<T, TId>[] =>
      exiting.filter((entry) => entry.insertBeforeId === anchorId),
    [exiting]
  );

  return {
    exiting,
    removedIds,
    completeExit,
    getExitingBefore
  };
}
