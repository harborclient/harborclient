export * from '#/renderer/src/store/thunks/collections';
export * from '#/renderer/src/store/thunks/environments';
export * from '#/renderer/src/store/thunks/requests';
export * from '#/renderer/src/store/thunks/modals';
export * from '#/renderer/src/store/thunks/sync';
export * from '#/renderer/src/store/thunks/aiChat';
export * from '#/renderer/src/store/thunks/collectionRunner';

import type { AppDispatch } from '#/renderer/src/store/redux';
import { setGeneralSettingsState } from '#/renderer/src/store/slices/settingsSlice';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { refreshEnvironments } from '#/renderer/src/store/thunks/environments';

/**
 * Dispatches initial data loads on app mount.
 */
export function initializeStore(dispatch: AppDispatch): void {
  void dispatch(refreshCollections());
  void dispatch(refreshEnvironments());
  void window.api.getGeneralSettings().then((settings) => {
    dispatch(setGeneralSettingsState(settings));
  });
}
