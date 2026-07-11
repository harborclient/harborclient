export * from '#/renderer/src/store/thunks/documents';
export * from '#/renderer/src/store/thunks/collections';
export * from '#/renderer/src/store/thunks/documents';
export * from '#/renderer/src/store/thunks/environments';
export * from '#/renderer/src/store/thunks/snippets';
export * from '#/renderer/src/store/thunks/requests';
export * from '#/renderer/src/store/thunks/modals';
export * from '#/renderer/src/store/thunks/sync';
export * from '#/renderer/src/store/thunks/aiChat';
export * from '#/renderer/src/store/thunks/collectionRunner';
export * from '#/renderer/src/store/thunks/runResults';
export * from '#/renderer/src/store/thunks/settings';
export * from '#/renderer/src/store/thunks/tabs';

import type { AppDispatch } from '#/renderer/src/store/redux';
import { setGeneralSettingsState } from '#/renderer/src/store/slices/settingsSlice';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { refreshEnvironments } from '#/renderer/src/store/thunks/environments';
import { refreshRunResults } from '#/renderer/src/store/thunks/runResults';
import { refreshSnippets } from '#/renderer/src/store/thunks/snippets';
import { hydrateOpenTabs } from '#/renderer/src/store/thunks/tabs';

/**
 * Dispatches initial data loads on app mount.
 */
export function initializeStore(dispatch: AppDispatch): void {
  void dispatch(hydrateOpenTabs());
  void dispatch(refreshCollections());
  void dispatch(refreshEnvironments());
  void dispatch(refreshSnippets());
  void dispatch(refreshRunResults());
  void window.api.getGeneralSettings().then((settings) => {
    dispatch(setGeneralSettingsState(settings));
  });
}
