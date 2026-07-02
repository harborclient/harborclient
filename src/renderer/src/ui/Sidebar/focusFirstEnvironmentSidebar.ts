import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { selectEnvironments } from '#/renderer/src/store/selectors';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import {
  focusSidebarEnvironmentRowById,
  SIDEBAR_ENVIRONMENT_ID_ATTR,
  sidebarEnvironmentRowSelector
} from '#/renderer/src/ui/Sidebar/sidebarListNavigation';

export { SIDEBAR_ENVIRONMENT_ID_ATTR, sidebarEnvironmentRowSelector };

interface SidebarExpansionControls {
  /** Shows the Environments section in the sidebar. */
  setEnvironmentsSectionVisible: (visible: boolean) => void;
  /** Expands the Environments section accordion panel. */
  setEnvironmentsSectionExpanded: (expanded: boolean) => void;
}

/**
 * Focuses the first environment in the sidebar and selects it for keyboard navigation.
 *
 * Reveals the sidebar and Environments section when hidden. No-ops when there are
 * no environments or the row is not mounted yet.
 *
 * @param dispatch - Redux dispatch for navigation and selection updates.
 * @param getState - Reads the ordered environments list.
 * @param expansion - Sidebar section visibility and expansion setters.
 */
export function focusFirstEnvironmentSidebar(
  dispatch: AppDispatch,
  getState: () => RootState,
  expansion: SidebarExpansionControls
): void {
  dispatch(setShowSidebar(true));
  dispatch(setActiveSidebarPanel(null));
  expansion.setEnvironmentsSectionVisible(true);
  expansion.setEnvironmentsSectionExpanded(true);

  const firstEnvironment = selectEnvironments(getState())[0];
  if (firstEnvironment == null) {
    return;
  }

  dispatch(setActiveEnvironmentId(firstEnvironment.id));
  focusSidebarEnvironmentRowById(firstEnvironment.id, true);
}
