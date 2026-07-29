import type { SidebarMode } from '@harborclient/core/types';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { getRegisteredSidebarPanels } from '#/renderer/src/plugins/registry';
import { selectEnvironments } from '#/renderer/src/store/selectors';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { selectCollectionsReplacementPanel } from '../shell/sidebarPanelResolution';
import {
  focusSidebarEnvironmentRowById,
  SIDEBAR_ENVIRONMENT_ID_ATTR,
  sidebarEnvironmentRowSelector
} from './sidebarListNavigation';

export { SIDEBAR_ENVIRONMENT_ID_ATTR, sidebarEnvironmentRowSelector };

interface SidebarExpansionControls {
  /** Selects the Environments activity-rail mode. */
  setActiveSidebarMode: (mode: SidebarMode) => void;
  /** Expands the Environments section accordion panel. */
  setEnvironmentsSectionExpanded: (expanded: boolean) => void;
}

/**
 * Reveals the sidebar, selects Environments mode, expands the Environments
 * section, selects the given environment, and focuses its row for keyboard navigation.
 *
 * No-ops when a plugin panel replaces the built-in Collections sidebar, because
 * Environments live in the built-in sections that are hidden in that mode
 * (Environments parity inside a replacement is out of scope for Step 1).
 *
 * @param dispatch - Redux dispatch for navigation and selection updates.
 * @param environmentId - Environment database id to highlight in the sidebar.
 * @param expansion - Sidebar mode and expansion setters.
 */
export function focusEnvironmentSidebarById(
  dispatch: AppDispatch,
  environmentId: number,
  expansion: SidebarExpansionControls
): void {
  if (selectCollectionsReplacementPanel(getRegisteredSidebarPanels()) != null) {
    return;
  }

  dispatch(setShowSidebar(true));
  dispatch(setActiveSidebarPanel(null));
  expansion.setActiveSidebarMode('environments');
  expansion.setEnvironmentsSectionExpanded(true);
  dispatch(setActiveEnvironmentId(environmentId));
  focusSidebarEnvironmentRowById(environmentId, true);
}

/**
 * Focuses the first environment in the sidebar and selects it for keyboard navigation.
 *
 * Reveals the sidebar and Environments mode when hidden. No-ops when there are
 * no environments, the row is not mounted yet, or a collections replacement panel
 * is active (built-in Environments are not mounted).
 *
 * @param dispatch - Redux dispatch for navigation and selection updates.
 * @param getState - Reads the ordered environments list.
 * @param expansion - Sidebar mode and expansion setters.
 */
export function focusFirstEnvironmentSidebar(
  dispatch: AppDispatch,
  getState: () => RootState,
  expansion: SidebarExpansionControls
): void {
  if (selectCollectionsReplacementPanel(getRegisteredSidebarPanels()) != null) {
    return;
  }

  const firstEnvironment = selectEnvironments(getState())[0];
  if (firstEnvironment == null) {
    return;
  }

  focusEnvironmentSidebarById(dispatch, firstEnvironment.id, expansion);
}
