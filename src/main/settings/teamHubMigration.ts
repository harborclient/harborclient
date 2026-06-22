import { existsSync, readdirSync, renameSync } from 'fs';
import { join } from 'path';
import type { LocalRegistry } from '#/main/db/LocalRegistry';
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
 * @param registry - Local registry holding app settings.
 */
function migrateTeamHubListKey(registry: LocalRegistry): void {
  const current = registry.getSetting(TEAM_HUBS_KEY);
  if (current !== undefined && current.trim() !== '' && current.trim() !== '[]') {
    return;
  }

  const legacy = registry.getSetting(LEGACY_TEAM_HUBS_KEY);
  if (legacy === undefined || legacy.trim() === '') {
    return;
  }

  registry.setSetting(TEAM_HUBS_KEY, legacy);
  registry.setSetting(LEGACY_TEAM_HUBS_KEY, '');
}

/**
 * Renames detached-collection registry keys from the service-hub prefix to team-hub.
 *
 * @param registry - Local registry holding app settings.
 */
function migrateDetachedSettingKeys(registry: LocalRegistry): void {
  for (const legacyKey of registry.listSettingKeysWithPrefix(LEGACY_DETACHED_PREFIX)) {
    const hubId = legacyKey.slice(LEGACY_DETACHED_PREFIX.length);
    if (!hubId) continue;

    const newKey = `${TEAM_HUB_DETACHED_PREFIX}${hubId}`;
    const legacyValue = registry.getSetting(legacyKey);
    if (legacyValue === undefined || legacyValue.trim() === '') {
      registry.setSetting(legacyKey, '');
      continue;
    }

    const existing = registry.getSetting(newKey);
    if (existing === undefined || existing.trim() === '') {
      registry.setSetting(newKey, legacyValue);
    }

    registry.setSetting(legacyKey, '');
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
 * One-time migration from service-hub naming to team-hub naming for settings and id-map files.
 *
 * Idempotent: safe to run on every startup.
 *
 * @param registry - Initialized local registry singleton.
 * @param userDataPath - Electron userData directory for id-map files.
 */
export function migrateTeamHubSettings(registry: LocalRegistry, userDataPath: string): void {
  migrateTeamHubListKey(registry);
  migrateDetachedSettingKeys(registry);
  migrateTeamHubIdMapFiles(userDataPath);

  // Touch list parse so corrupt legacy JSON fails early during migration rather than later.
  parseJson<TeamHub[]>(registry.getSetting(TEAM_HUBS_KEY), []);
}
