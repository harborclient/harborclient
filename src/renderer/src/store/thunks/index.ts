export * from '#/renderer/src/store/thunks/collections';
export * from '#/renderer/src/store/thunks/environments';
export * from '#/renderer/src/store/thunks/requests';
export * from '#/renderer/src/store/thunks/modals';

import type { AppDispatch } from '#/renderer/src/store/redux';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { refreshEnvironments } from '#/renderer/src/store/thunks/environments';

/** Dispatches initial data loads on app mount. */
export function initializeStore(dispatch: AppDispatch): void {
  void dispatch(refreshCollections());
  void dispatch(refreshEnvironments());
}
