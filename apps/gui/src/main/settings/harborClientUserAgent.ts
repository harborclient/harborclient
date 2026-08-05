import { release as osRelease } from 'os';
import { app } from 'electron';
import {
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings
} from '@harborclient/core/generalSettings';
import { isPlainObject, parseJson } from '@harborclient/core/parseJson';
import type { GeneralSettings } from '@harborclient/core/types';
import {
  buildHarborClientUserAgent,
  isGeneratedHarborClientUserAgent,
  normalizeUserAgent,
  syncHarborClientUserAgentPresets
} from '@harborclient/core/userAgent';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import { setGeneralSettings } from './generalSettings';

const STORE_KEY = 'general';

/**
 * Builds a machine-specific HarborClient User-Agent from the current Electron process.
 *
 * @returns HarborClient User-Agent with real app, OS, Electron, and Chrome versions.
 */
export function buildHarborClientUserAgentFromProcess(): string {
  const getSystemVersion =
    typeof process.getSystemVersion === 'function'
      ? process.getSystemVersion.bind(process)
      : undefined;

  return buildHarborClientUserAgent({
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    osRelease: osRelease(),
    electronVersion: process.versions.electron ?? '',
    chromeVersion: process.versions.chrome ?? '',
    ...(getSystemVersion ? { systemVersion: getSystemVersion() } : {})
  });
}

/**
 * Reconciles persisted general settings against the current HarborClient User-Agent.
 *
 * Refreshes `userAgent` when it is missing, empty, or a generated HarborClient
 * string that no longer matches {@link current}. Independently syncs
 * `customUserAgents` so a stale preset is replaced even when the global default
 * points at a non-HarborClient value. Returns null when nothing needs writing.
 *
 * @param stored - Partial settings parsed from the registry, or null when unset.
 * @param current - Fresh HarborClient User-Agent from the running process.
 * @returns Settings to persist, or null when already up to date.
 */
export function resolveHarborClientUserAgentSettings(
  stored: Partial<GeneralSettings> | null,
  current: string
): GeneralSettings | null {
  const nextCurrent = normalizeUserAgent(current);
  if (!nextCurrent) {
    return null;
  }

  const base = normalizeGeneralSettings({
    ...DEFAULT_GENERAL_SETTINGS,
    ...(stored ?? {})
  });
  const previousUserAgent = normalizeUserAgent(stored?.userAgent);
  const shouldRefreshUserAgent =
    previousUserAgent === '' ||
    (isGeneratedHarborClientUserAgent(previousUserAgent) && previousUserAgent !== nextCurrent);
  const nextUserAgent = shouldRefreshUserAgent ? nextCurrent : base.userAgent;
  const nextCustoms = syncHarborClientUserAgentPresets(base.customUserAgents, nextCurrent);
  const customsUnchanged =
    nextCustoms.length === base.customUserAgents.length &&
    nextCustoms.every((entry, index) => entry === base.customUserAgents[index]);

  if (!shouldRefreshUserAgent && customsUnchanged) {
    return null;
  }

  return {
    ...base,
    userAgent: nextUserAgent,
    customUserAgents: nextCustoms
  };
}

/**
 * On every startup, rebuild the HarborClient User-Agent from the current app,
 * Electron, Chrome, and OS versions, then update the global default and the
 * custom preset list when a generated value has gone stale.
 *
 * Non-generated User-Agent strings (user-authored defaults or presets) are left
 * untouched. Skips persistence when nothing changed so file logger, spell check,
 * and tray side effects in {@link setGeneralSettings} are not re-run needlessly.
 *
 * @param database - Local registry holding the `general` settings JSON blob.
 */
export function ensureHarborClientUserAgentSettings(database: LocalDatabase): void {
  const raw = database.getSetting(STORE_KEY);
  let stored: Partial<GeneralSettings> | null = null;
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = parseJson(raw, null);
    stored = isPlainObject(parsed) ? (parsed as Partial<GeneralSettings>) : null;
  }
  const next = resolveHarborClientUserAgentSettings(
    stored,
    buildHarborClientUserAgentFromProcess()
  );
  if (next == null) {
    return;
  }
  setGeneralSettings(next);
}
