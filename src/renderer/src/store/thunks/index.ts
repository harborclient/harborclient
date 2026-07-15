export * from './documents';
export * from './collections';
export * from './documents';
export * from './environments';
export * from './snippets';
export * from './requests';
export * from './modals';
export * from './sync';
export * from './aiChat';
export * from './collectionRunner';
export * from './runResults';
export * from './requestHistory';
export * from './tabGroups';
export * from './sidebarDeselect';
export * from './trash';
export * from './settings';
export * from './theme';
export * from './tabs';
export * from './terminals';

import type { AppDispatch } from '#/renderer/src/store/redux';
import { setGeneralSettingsState } from '#/renderer/src/store/slices/settingsSlice';
import { refreshCollections, openSeededBuiltinRequestIfNeeded } from './collections';
import { refreshEnvironments } from './environments';
import { refreshRunResults } from './runResults';
import { refreshRequestHistory } from './requestHistory';
import { refreshTabGroups } from './tabGroups';
import { refreshTrash } from './trash';
import { refreshSnippets } from './snippets';
import { hydrateOpenTabs } from './tabs';
import { hydrateTerminalLayout } from './terminals';

/**
 * Dispatches initial data loads on app mount.
 */
export function initializeStore(dispatch: AppDispatch): void {
  void dispatch(hydrateOpenTabs());
  void dispatch(hydrateTerminalLayout());
  void dispatch(refreshCollections()).then(() => {
    void dispatch(openSeededBuiltinRequestIfNeeded());
  });
  void dispatch(refreshEnvironments());
  void dispatch(refreshSnippets());
  void dispatch(refreshRunResults());
  void dispatch(refreshRequestHistory());
  void dispatch(refreshTabGroups());
  void dispatch(refreshTrash());
  void window.api.getGeneralSettings().then((settings) => {
    dispatch(setGeneralSettingsState(settings));
  });
}
