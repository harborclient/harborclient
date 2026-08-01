import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from '@harborclient/core/types';
import { store } from '#/renderer/src/store/redux';
import { setWebsites } from '#/renderer/src/store/slices/websitesSlice';

/**
 * Lists all saved live pages from the local registry and refreshes Redux.
 *
 * @returns Saved website rows.
 */
export async function listLivePagesForPlugin(): Promise<Website[]> {
  const items = await window.api.listWebsites();
  store.dispatch(setWebsites(items));
  return items;
}

/**
 * Returns one saved live page by database id or uuid.
 *
 * @param idOrUuid - Numeric id or uuid string.
 * @returns The saved website, or null when not found.
 */
export async function getLivePageForPlugin(idOrUuid: number | string): Promise<Website | null> {
  const items = await listLivePagesForPlugin();
  if (typeof idOrUuid === 'number') {
    return items.find((item) => item.id === idOrUuid) ?? null;
  }
  const key = String(idOrUuid).trim();
  if (!key) {
    return null;
  }
  return items.find((item) => item.uuid === key || String(item.id) === key) ?? null;
}

/**
 * Creates a saved live page and returns the new row.
 *
 * @param input - Create payload.
 * @returns The created saved website.
 */
export async function createLivePageForPlugin(input: CreateWebsiteInput): Promise<Website> {
  const previousIds = new Set(store.getState().websites.items.map((website) => website.id));
  const items = await window.api.createWebsite(input);
  store.dispatch(setWebsites(items));
  const created = items.find((website) => !previousIds.has(website.id));
  if (created == null) {
    throw new Error('hc.livePages.create failed to resolve the new live page.');
  }
  return created;
}

/**
 * Updates a saved live page and returns the refreshed row.
 *
 * @param input - Full update payload including id.
 * @returns The updated saved website.
 */
export async function updateLivePageForPlugin(input: UpdateWebsiteInput): Promise<Website> {
  const items = await window.api.updateWebsite(input);
  store.dispatch(setWebsites(items));
  const updated = items.find((website) => website.id === input.id);
  if (updated == null) {
    throw new Error(`hc.livePages.update: live page ${input.id} was not found.`);
  }
  return updated;
}

/**
 * Deletes a saved live page (moves it to trash).
 *
 * @param id - Database primary key.
 */
export async function deleteLivePageForPlugin(id: number): Promise<void> {
  if (typeof id !== 'number' || !Number.isFinite(id)) {
    throw new Error('hc.livePages.delete requires a numeric id.');
  }
  const items = await window.api.deleteWebsite(id);
  store.dispatch(setWebsites(items));
}
