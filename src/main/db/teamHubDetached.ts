import type { LocalRegistry } from '#/main/db/LocalRegistry';
import { parseJson } from '#/shared/parseJson';

/**
 * Builds the registry settings key for a hub's detached collection UUID list.
 *
 * @param hubId - Team hub connection id.
 */
export function detachedSettingKey(hubId: string): string {
  return `teamHubDetached:${hubId}`;
}

/**
 * Reads the set of server collection UUIDs detached from a team hub.
 *
 * @param registry - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function readDetachedServerIds(registry: LocalRegistry, hubId: string): Set<string> {
  const raw = registry.getSetting(detachedSettingKey(hubId));
  const ids = parseJson<string[]>(raw, []);
  return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
}

/**
 * Records a server collection UUID as detached so additive sync will not re-add it.
 *
 * @param registry - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 * @param serverCollectionId - Server-side collection UUID.
 */
export function addDetachedServerId(
  registry: LocalRegistry,
  hubId: string,
  serverCollectionId: string
): void {
  const detached = readDetachedServerIds(registry, hubId);
  detached.add(serverCollectionId);
  registry.setSetting(detachedSettingKey(hubId), JSON.stringify([...detached]));
}

/**
 * Removes the detached-collection setting for a hub when the hub itself is deleted.
 *
 * @param registry - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function removeDetachedSetting(registry: LocalRegistry, hubId: string): void {
  registry.setSetting(detachedSettingKey(hubId), '');
}
