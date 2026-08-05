import type { LocalDatabase } from './LocalDatabase';
import { parseJson } from '@harborclient/core/parseJson';

/**
 * Reads detached server UUIDs for an entity-specific hub setting.
 *
 * @param database - Local registry holding app settings.
 * @param key - Entity-specific detached setting key.
 * @returns Valid non-empty server UUIDs.
 */
function readDetachedIds(database: LocalDatabase, key: string): Set<string> {
  const parsed = parseJson(database.getSetting(key), []);
  const ids = Array.isArray(parsed) ? parsed : [];
  return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
}

/**
 * Adds a server UUID to an entity-specific detached setting.
 *
 * @param database - Local registry holding app settings.
 * @param key - Entity-specific detached setting key.
 * @param serverId - Server-side entity UUID.
 */
function addDetachedId(database: LocalDatabase, key: string, serverId: string): void {
  const detached = readDetachedIds(database, key);
  detached.add(serverId);
  database.setSetting(key, JSON.stringify([...detached]));
}

/**
 * Builds the detached-live-server setting key for a hub.
 *
 * @param hubId - Team hub connection id.
 * @returns Entity-specific setting key.
 */
export function detachedLiveServerSettingKey(hubId: string): string {
  return `teamHubDetachedLiveServer:${hubId}`;
}

/**
 * Reads live-server UUIDs intentionally detached from a hub.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 * @returns Detached live-server UUIDs.
 */
export function readDetachedLiveServerIds(database: LocalDatabase, hubId: string): Set<string> {
  return readDetachedIds(database, detachedLiveServerSettingKey(hubId));
}

/**
 * Records a detached Team Hub live server.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 * @param serverId - Server-side live-server UUID.
 */
export function addDetachedLiveServerId(
  database: LocalDatabase,
  hubId: string,
  serverId: string
): void {
  addDetachedId(database, detachedLiveServerSettingKey(hubId), serverId);
}

/**
 * Clears detached live-server tracking when a hub is removed.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function removeDetachedLiveServerSetting(database: LocalDatabase, hubId: string): void {
  database.setSetting(detachedLiveServerSettingKey(hubId), '');
}

/**
 * Builds the detached-live-page setting key for a hub.
 *
 * @param hubId - Team hub connection id.
 * @returns Entity-specific setting key.
 */
export function detachedLivePageSettingKey(hubId: string): string {
  return `teamHubDetachedLivePage:${hubId}`;
}

/**
 * Reads live-page UUIDs intentionally detached from a hub.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 * @returns Detached live-page UUIDs.
 */
export function readDetachedLivePageIds(database: LocalDatabase, hubId: string): Set<string> {
  return readDetachedIds(database, detachedLivePageSettingKey(hubId));
}

/**
 * Records a detached Team Hub live page.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 * @param serverId - Server-side live-page UUID.
 */
export function addDetachedLivePageId(
  database: LocalDatabase,
  hubId: string,
  serverId: string
): void {
  addDetachedId(database, detachedLivePageSettingKey(hubId), serverId);
}

/**
 * Clears detached live-page tracking when a hub is removed.
 *
 * @param database - Local registry holding app settings.
 * @param hubId - Team hub connection id.
 */
export function removeDetachedLivePageSetting(database: LocalDatabase, hubId: string): void {
  database.setSetting(detachedLivePageSettingKey(hubId), '');
}

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
  const parsed = parseJson(raw, []);
  const ids = Array.isArray(parsed) ? parsed : [];
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
  const parsed = parseJson(raw, []);
  const ids = Array.isArray(parsed) ? parsed : [];
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
