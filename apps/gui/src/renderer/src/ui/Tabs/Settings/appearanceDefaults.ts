import { defaultSidebarExpansion } from '@harborclient/core/sidebarExpansion';

/**
 * Factory defaults for Appearance panel-layout toggles.
 *
 * Must stay aligned with {@link DEFAULT_PANEL_LAYOUT} in
 * `apps/gui/src/main/settings/panelLayoutSettings.ts` and
 * `navigationSlice` initial state.
 */
export const APPEARANCE_PANEL_DEFAULTS = {
  showSidebar: true,
  showRail: true,
  showAiSidebar: false,
  showGitSidebar: false,
  showShortcutsSidebar: false,
  showRequestEditor: true,
  showResponseEditor: true,
  showConsole: false,
  showVariables: false,
  showMcp: false,
  showTerminal: false
} as const;

/**
 * Factory defaults for Appearance collections-sidebar display chrome toggles.
 *
 * Derived from {@link defaultSidebarExpansion} so Settings reset matches
 * first-launch sidebar expansion preferences.
 */
export const APPEARANCE_DISPLAY_DEFAULTS = {
  showStorageLocationBadges: defaultSidebarExpansion().showStorageLocationBadges,
  showMarkers: defaultSidebarExpansion().showMarkers,
  showMethodColors: defaultSidebarExpansion().showMethodColors,
  showIndicators: defaultSidebarExpansion().showIndicators,
  showFilters: defaultSidebarExpansion().showFilters,
  showSorting: defaultSidebarExpansion().showSorting
} as const;

/**
 * Boolean key on the panel-layout Appearance defaults map.
 */
export type AppearancePanelFlag = keyof typeof APPEARANCE_PANEL_DEFAULTS;

/**
 * Boolean key on the sidebar-display Appearance defaults map.
 */
export type AppearanceDisplayFlag = keyof typeof APPEARANCE_DISPLAY_DEFAULTS;
