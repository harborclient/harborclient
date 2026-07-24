import { useCallback, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectOpenDocumentIds,
  selectOpenRequestIds,
  selectSelectedCollectionId,
  selectSelectedFolderId
} from '#/renderer/src/store/selectors';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { closeSidebarContentTabs } from '#/renderer/src/store/thunks/sidebarDeselect';
import { sidebarHasDeselectableSelection } from './sidebarDeselectAll';
import {
  SidebarSelectionContext,
  type SidebarSelectionContextValue
} from './sidebarSelectionContext';

interface Props {
  /**
   * Sidebar sections that register local multi-selection handlers.
   */
  children: ReactNode;
}

/**
 * Coordinates collections sidebar selection clearing across Redux and local section state.
 */
export function SidebarSelectionProvider({ children }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const selectedFolderId = useAppSelector(selectSelectedFolderId);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const openRequestIds = useAppSelector(selectOpenRequestIds);
  const openDocumentIds = useAppSelector(selectOpenDocumentIds);
  const clearHandlersRef = useRef(new Map<string, () => void>());
  const [sectionSelectionCounts, setSectionSelectionCounts] = useState<Record<string, number>>({});

  /**
   * Registers a section clear handler for Edit → Deselect all.
   */
  const registerClearHandler = useCallback(
    (key: string, clearSelection: () => void): (() => void) => {
      clearHandlersRef.current.set(key, clearSelection);
      return () => {
        clearHandlersRef.current.delete(key);
      };
    },
    []
  );

  /**
   * Stores the latest multi-selection count reported by a sidebar section.
   */
  const reportSelectionCount = useCallback((key: string, count: number): void => {
    setSectionSelectionCounts((previous) => {
      if ((previous[key] ?? 0) === count) {
        return previous;
      }
      return { ...previous, [key]: count };
    });
  }, []);

  /**
   * Clears Redux highlights and every registered section multi-selection.
   */
  const clearAllSelections = useCallback((): void => {
    for (const clearSelection of clearHandlersRef.current.values()) {
      clearSelection();
    }
    dispatch(setSelectedCollectionId(null));
    dispatch(setActiveEnvironmentId(null));
    void dispatch(closeSidebarContentTabs());
  }, [dispatch]);

  /**
   * Whether Edit → Deselect all should be enabled for the current sidebar state.
   */
  const hasAnySelection = useMemo(
    () =>
      sidebarHasDeselectableSelection({
        selectedCollectionId,
        selectedFolderId,
        activeEnvironmentId,
        sectionSelectionCounts,
        openRequestTabCount: openRequestIds.size,
        openMarkdownTabCount: openDocumentIds.size
      }),
    [
      activeEnvironmentId,
      openDocumentIds.size,
      openRequestIds.size,
      sectionSelectionCounts,
      selectedCollectionId,
      selectedFolderId
    ]
  );

  const value = useMemo<SidebarSelectionContextValue>(
    () => ({
      registerClearHandler,
      reportSelectionCount,
      clearAllSelections,
      hasAnySelection
    }),
    [clearAllSelections, hasAnySelection, registerClearHandler, reportSelectionCount]
  );

  return (
    <SidebarSelectionContext.Provider value={value}>{children}</SidebarSelectionContext.Provider>
  );
}
