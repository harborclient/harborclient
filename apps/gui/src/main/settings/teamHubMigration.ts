import { existsSync, readdirSync, renameSync } from 'fs';
import { join } from 'path';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import { storeTeamHubToken } from './teamHubSecrets';
import { parseJson } from '#/shared/parseJson';
import type { TeamHub } from '#/shared/types';

const LEGACY_TEAM_HUBS_KEY = 'serviceHubs';
const TEAM_HUBS_KEY = 'teamHubs';
const LEGACY_DETACHED_PREFIX = 'serviceHubDetached:';
const TEAM_HUB_DETACHED_PREFIX = 'teamHubDetached:';
const LEGACY_ID_MAP_PREFIX = 'service-hub-';
const TEAM_HUB_ID_MAP_PREFIX = 'team-hub-';

/**
 * Copies legacy `serviceHubs` settings into `teamHubs` when the new key is unset.
 *
 * @param database - Local registry holding app settings.
 */
function migrateTeamHubListKey(database: LocalDatabase): void {
  const current = database.getSetting(TEAM_HUBS_KEY);
  if (current !== undefined && current.trim() !== '' && current.trim() !== '[]') {
    return;
  }

  const legacy = database.getSetting(LEGACY_TEAM_HUBS_KEY);
  if (legacy === undefined || legacy.trim() === '') {
    return;
  }

  database.setSetting(TEAM_HUBS_KEY, legacy);
  database.setSetting(LEGACY_TEAM_HUBS_KEY, '');
}

/**
 * Renames detached-collection registry keys from the service-hub prefix to team-hub.
 *
 * @param database - Local registry holding app settings.
 */
function migrateDetachedSettingKeys(database: LocalDatabase): void {
  for (const legacyKey of database.listSettingKeysWithPrefix(LEGACY_DETACHED_PREFIX)) {
    const hubId = legacyKey.slice(LEGACY_DETACHED_PREFIX.length);
    if (!hubId) continue;

    const newKey = `${TEAM_HUB_DETACHED_PREFIX}${hubId}`;
    const legacyValue = database.getSetting(legacyKey);
    if (legacyValue === undefined || legacyValue.trim() === '') {
      database.setSetting(legacyKey, '');
      continue;
    }

    const existing = database.getSetting(newKey);
    if (existing === undefined || existing.trim() === '') {
      database.setSetting(newKey, legacyValue);
    }

    database.setSetting(legacyKey, '');
  }
}

/**
 * Renames on-disk team hub id-map SQLite files from the legacy filename prefix.
 *
 * @param userDataPath - Electron userData directory.
 */
function migrateTeamHubIdMapFiles(userDataPath: string): void {
  let entries: string[];
  try {
    entries = readdirSync(userDataPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.startsWith(LEGACY_ID_MAP_PREFIX) || !entry.endsWith('.db')) {
      continue;
    }

    const legacyPath = join(userDataPath, entry);
    const nextName = `${TEAM_HUB_ID_MAP_PREFIX}${entry.slice(LEGACY_ID_MAP_PREFIX.length)}`;
    const nextPath = join(userDataPath, nextName);

    if (existsSync(nextPath)) {
      continue;
    }

    renameSync(legacyPath, nextPath);
  }
}

/**
 * Moves inline plaintext bearer tokens from `teamHubs` JSON into encrypted sidecar storage.
 *
 * @param database - Local registry holding app settings.
 */
function migrateTeamHubInlineTokens(database: LocalDatabase): void {
  const raw = database.getSetting(TEAM_HUBS_KEY);
  if (raw === undefined || raw.trim() === '') {
    return;
  }

  const hubs = parseJson<Array<TeamHub & { token?: string }>>(raw, []);
  if (hubs.length === 0) {
    return;
  }

  let changed = false;
  const nextHubs = hubs.map((hub) => {
    const token = hub.token?.trim() ?? '';
    if (!token) {
      return { id: hub.id, name: hub.name, baseUrl: hub.baseUrl };
    }

    storeTeamHubToken(hub.id, token);
    changed = true;
    return { id: hub.id, name: hub.name, baseUrl: hub.baseUrl };
  });

  if (changed) {
    database.setSetting(TEAM_HUBS_KEY, JSON.stringify(nextHubs));
  }
}

/**
 * One-time migration from service-hub naming to team-hub naming for settings and id-map files.
 *
 * Idempotent: safe to run on every startup.
 *
 * @param database - Initialized local registry singleton.
 * @param userDataPath - Electron userData directory for id-map files.
 */
export function migrateTeamHubSettings(database: LocalDatabase, userDataPath: string): void {
  migrateTeamHubListKey(database);
  migrateDetachedSettingKeys(database);
  migrateTeamHubIdMapFiles(userDataPath);
  migrateTeamHubInlineTokens(database);

  // Touch list parse so corrupt legacy JSON fails early during migration rather than later.
  parseJson<TeamHub[]>(database.getSetting(TEAM_HUBS_KEY), []);
}
