import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { selectCollections } from '#/renderer/src/store/selectors';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import {
  focusSidebarCollectionRowById,
  SIDEBAR_COLLECTION_ID_ATTR,
  sidebarCollectionRowSelector
} from '#/renderer/src/ui/Sidebar/sidebarListNavigation';

export { SIDEBAR_COLLECTION_ID_ATTR, sidebarCollectionRowSelector };

interface SidebarExpansionControls {
  /** Shows the Collections section in the sidebar. */
  setCollectionsSectionVisible: (visible: boolean) => void;
  /** Expands the Collections section accordion panel. */
  setCollectionsSectionExpanded: (expanded: boolean) => void;
}

/**
 * Focuses the first collection in the sidebar and selects it for keyboard navigation.
 *
 * Reveals the sidebar and Collections section when hidden. No-ops when there are
 * no collections or the row is not mounted yet.
 *
 * @param dispatch - Redux dispatch for navigation and selection updates.
 * @param getState - Reads the ordered collections list.
 * @param expansion - Sidebar section visibility and expansion setters.
 */
export function focusFirstCollectionSidebar(
  dispatch: AppDispatch,
  getState: () => RootState,
  expansion: SidebarExpansionControls
): void {
  dispatch(setShowSidebar(true));
  dispatch(setActiveSidebarPanel(null));
  expansion.setCollectionsSectionVisible(true);
  expansion.setCollectionsSectionExpanded(true);

  const firstCollection = selectCollections(getState())[0];
  if (firstCollection == null) {
    return;
  }

  dispatch(setSelectedCollectionId(firstCollection.id));
  focusSidebarCollectionRowById(firstCollection.id, true);
}
