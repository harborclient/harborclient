import type { LocalDatabase } from './LocalDatabase';
import { parseJson } from '#/shared/parseJson';

/**
 * Builds the registry settings key for a hub's detached snippet UUID list.
 *
 * @param hubId - Team hub connection id.
 */
export function detachedSnippetSettingKey(hubId: string): string {
  return `teamHubDetachedSnippet:${hubId}`;
}

/**
 * Reads the set of server snippet UUIDs detached from a team hub.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function readDetachedSnippetServerIds(database: LocalDatabase, hubId: string): Set<string> {
  const raw = database.getSetting(detachedSnippetSettingKey(hubId));
  const ids = parseJson<string[]>(raw, []);
  return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
}

/**
 * Records a server snippet UUID as detached so additive sync will not re-add it.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 * @param serverSnippetId - Server-side snippet UUID.
 */
export function addDetachedSnippetServerId(
  database: LocalDatabase,
  hubId: string,
  serverSnippetId: string
): void {
  const detached = readDetachedSnippetServerIds(database, hubId);
  detached.add(serverSnippetId);
  database.setSetting(detachedSnippetSettingKey(hubId), JSON.stringify([...detached]));
}

/**
 * Removes the detached-snippet setting for a hub when the hub itself is deleted.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function removeDetachedSnippetSetting(database: LocalDatabase, hubId: string): void {
  database.setSetting(detachedSnippetSettingKey(hubId), '');
}

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
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function readDetachedServerIds(database: LocalDatabase, hubId: string): Set<string> {
  const raw = database.getSetting(detachedSettingKey(hubId));
  const ids = parseJson<string[]>(raw, []);
  return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
}

/**
 * Records a server collection UUID as detached so additive sync will not re-add it.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 * @param serverCollectionId - Server-side collection UUID.
 */
export function addDetachedServerId(
  database: LocalDatabase,
  hubId: string,
  serverCollectionId: string
): void {
  const detached = readDetachedServerIds(database, hubId);
  detached.add(serverCollectionId);
  database.setSetting(detachedSettingKey(hubId), JSON.stringify([...detached]));
}

/**
 * Removes the detached-collection setting for a hub when the hub itself is deleted.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function removeDetachedSetting(database: LocalDatabase, hubId: string): void {
  database.setSetting(detachedSettingKey(hubId), '');
}
