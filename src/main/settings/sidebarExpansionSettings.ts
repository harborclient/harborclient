import Store from 'electron-store';
import { defaultSidebarExpansion, normalizeSidebarExpansion } from '#/shared/sidebarExpansion';
import type { SidebarExpansionState } from '#/shared/types';

const STORE_KEY = 'sidebarExpansion';

let store: Store<{ sidebarExpansion: SidebarExpansionState }> | null = null;

/**
 * Returns the lazy electron-store instance for sidebar expansion preferences.
 */
function getStore(): Store<{ sidebarExpansion: SidebarExpansionState }> {
  if (!store) {
    store = new Store<{ sidebarExpansion: SidebarExpansionState }>({
      name: 'settings',
      defaults: {
        sidebarExpansion: defaultSidebarExpansion()
      }
    });
  }
  return store;
}

/**
 * Returns persisted sidebar expansion state.
 */
export function getSidebarExpansion(): SidebarExpansionState {
  const stored = getStore().get(STORE_KEY, defaultSidebarExpansion());
  return normalizeSidebarExpansion(stored);
}

/**
 * Persists sidebar expansion state.
 *
 * @param state - Expansion snapshot to store.
 */
export function setSidebarExpansion(state: SidebarExpansionState): void {
  getStore().set(STORE_KEY, normalizeSidebarExpansion(state));
}
