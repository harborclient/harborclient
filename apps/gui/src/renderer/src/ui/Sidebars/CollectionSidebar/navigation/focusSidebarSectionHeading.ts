import type { SidebarMode } from '@harborclient/core/types';
import type { AppDispatch } from '#/renderer/src/store/redux';
import { getRegisteredSidebarPanels } from '#/renderer/src/plugins/registry';
import {
  setActiveSidebarPanel,
  setActiveSidebarRailItem,
  setShowSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import { selectCollectionsReplacementPanel } from '../shell/sidebarPanelResolution';
import { focusCollectionsReplacementPanel } from './focusCollectionsReplacementPanel';

/** Aria-label of the Collections section landmark. */
export const COLLECTIONS_SECTION_ARIA_LABEL = 'Collections';

/** Aria-label of the Environments section landmark. */
export const ENVIRONMENTS_SECTION_ARIA_LABEL = 'Environments';

/** Aria-label of the Workflows section landmark. */
export const WORKFLOWS_SECTION_ARIA_LABEL = 'Workflows';

/** Aria-label of the Live Servers section landmark. */
export const LIVE_SERVERS_SECTION_ARIA_LABEL = 'Live servers';

/**
 * Expansion setters required to switch sidebar mode and expand the target section.
 */
export interface SidebarSectionHeadingExpansion {
  /** Selects the activity-rail mode that hosts the target section. */
  setActiveSidebarMode: (mode: SidebarMode) => void;
  /** Expands the first section accordion for the active mode. */
  setSectionExpanded: (expanded: boolean) => void;
}

/**
 * Builds a CSS selector for a sidebar section title label (`h2`).
 *
 * @param ariaLabel - `aria-label` on the wrapping `<nav>` for the section.
 * @returns Selector matching the section header label.
 */
export function sidebarSectionHeadingSelector(ariaLabel: string): string {
  return `#hc-sidebar-rail-panel nav[aria-label="${ariaLabel}"] .hc-sidebar-section-header .hc-sidebar-section-label`;
}

/**
 * Focuses a sidebar section title label, optionally waiting for mount.
 *
 * @param ariaLabel - `aria-label` on the wrapping `<nav>` for the section.
 * @param waitForMount - When true, defer until after two animation frames.
 * @returns True when a focusable section label was found and focused.
 */
export function focusSidebarSectionHeadingButton(ariaLabel: string, waitForMount = false): boolean {
  /**
   * Queries the DOM and focuses the matching section title label.
   *
   * @returns True when the label was found and focused.
   */
  const focusHeading = (): boolean => {
    const label = document.querySelector<HTMLElement>(sidebarSectionHeadingSelector(ariaLabel));
    if (label == null || typeof label.focus !== 'function') {
      return false;
    }
    label.focus({ preventScroll: true });
    return document.activeElement === label;
  };

  if (waitForMount) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        focusHeading();
      });
    });
    return true;
  }

  return focusHeading();
}

/**
 * Reveals the sidebar, switches to the given mode, expands the first section,
 * and focuses that section's title label.
 *
 * When a collections replacement panel is registered:
 * - Collections mode focuses the replacement webview instead.
 * - Other modes no-op because built-in sections are not mounted.
 *
 * @param dispatch - Redux dispatch for navigation updates.
 * @param mode - Activity-rail mode to activate.
 * @param ariaLabel - First section landmark `aria-label` for focus targeting.
 * @param expansion - Mode and section expansion setters.
 */
export function focusSidebarSectionHeading(
  dispatch: AppDispatch,
  mode: SidebarMode,
  ariaLabel: string,
  expansion: SidebarSectionHeadingExpansion
): void {
  const hasCollectionsReplacement =
    selectCollectionsReplacementPanel(getRegisteredSidebarPanels()) != null;

  if (hasCollectionsReplacement && mode !== 'collections') {
    return;
  }

  dispatch(setShowSidebar(true));
  dispatch(setActiveSidebarPanel(null));
  dispatch(setActiveSidebarRailItem(null));

  if (hasCollectionsReplacement && mode === 'collections') {
    focusCollectionsReplacementPanel();
    return;
  }

  expansion.setActiveSidebarMode(mode);
  expansion.setSectionExpanded(true);
  focusSidebarSectionHeadingButton(ariaLabel, true);
}

/**
 * Moves focus to the Collections sidebar first section heading (F1).
 *
 * @param dispatch - Redux dispatch for navigation updates.
 * @param expansion - Mode and Collections section expansion setters.
 */
export function focusCollectionsSidebarHeading(
  dispatch: AppDispatch,
  expansion: Omit<SidebarSectionHeadingExpansion, 'setSectionExpanded'> & {
    /** Expands the Collections section accordion panel. */
    setCollectionsSectionExpanded: (expanded: boolean) => void;
  }
): void {
  focusSidebarSectionHeading(dispatch, 'collections', COLLECTIONS_SECTION_ARIA_LABEL, {
    setActiveSidebarMode: expansion.setActiveSidebarMode,
    setSectionExpanded: expansion.setCollectionsSectionExpanded
  });
}

/**
 * Moves focus to the Environments sidebar first section heading (F2).
 *
 * @param dispatch - Redux dispatch for navigation updates.
 * @param expansion - Mode and Environments section expansion setters.
 */
export function focusEnvironmentsSidebarHeading(
  dispatch: AppDispatch,
  expansion: Omit<SidebarSectionHeadingExpansion, 'setSectionExpanded'> & {
    /** Expands the Environments section accordion panel. */
    setEnvironmentsSectionExpanded: (expanded: boolean) => void;
  }
): void {
  focusSidebarSectionHeading(dispatch, 'environments', ENVIRONMENTS_SECTION_ARIA_LABEL, {
    setActiveSidebarMode: expansion.setActiveSidebarMode,
    setSectionExpanded: expansion.setEnvironmentsSectionExpanded
  });
}

/**
 * Moves focus to the Workflows sidebar first section heading (F6).
 *
 * @param dispatch - Redux dispatch for navigation updates.
 * @param expansion - Mode and Workflows section expansion setters.
 */
export function focusWorkflowsSidebarHeading(
  dispatch: AppDispatch,
  expansion: Omit<SidebarSectionHeadingExpansion, 'setSectionExpanded'> & {
    /** Expands the Workflows section accordion panel. */
    setWorkflowsSectionExpanded: (expanded: boolean) => void;
  }
): void {
  focusSidebarSectionHeading(dispatch, 'workflows', WORKFLOWS_SECTION_ARIA_LABEL, {
    setActiveSidebarMode: expansion.setActiveSidebarMode,
    setSectionExpanded: expansion.setWorkflowsSectionExpanded
  });
}

/**
 * Moves focus to the Live Servers sidebar first section heading (F7).
 *
 * @param dispatch - Redux dispatch for navigation updates.
 * @param expansion - Mode and Live Servers section expansion setters.
 */
export function focusLiveServersSidebarHeading(
  dispatch: AppDispatch,
  expansion: Omit<SidebarSectionHeadingExpansion, 'setSectionExpanded'> & {
    /** Expands the Live Servers section accordion panel. */
    setLiveServersSectionExpanded: (expanded: boolean) => void;
  }
): void {
  focusSidebarSectionHeading(dispatch, 'servers', LIVE_SERVERS_SECTION_ARIA_LABEL, {
    setActiveSidebarMode: expansion.setActiveSidebarMode,
    setSectionExpanded: expansion.setLiveServersSectionExpanded
  });
}
