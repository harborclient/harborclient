import { release as osRelease } from 'os';
import { app } from 'electron';
import {
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings
} from '@harborclient/core/generalSettings';
import { parseJson } from '@harborclient/core/parseJson';
import type { GeneralSettings } from '@harborclient/core/types';
import {
  appendCustomUserAgent,
  buildHarborClientUserAgent,
  LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT,
  normalizeUserAgent
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
 * Returns whether persisted general settings need a HarborClient User-Agent capture.
 *
 * @param stored - Partial settings parsed from the registry, or null when unset.
 * @returns True when the global User-Agent should be set from runtime values.
 */
export function needsHarborClientUserAgentCapture(
  stored: Partial<GeneralSettings> | null
): boolean {
  if (stored == null) {
    return true;
  }
  const userAgent = normalizeUserAgent(stored.userAgent);
  return userAgent === '' || userAgent === LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT;
}

/**
 * On first run (or when upgrading from the legacy static HarborClient UA), capture
 * a machine-specific User-Agent, persist it as the global default, and add it to
 * the shared custom preset list.
 *
 * @param database - Local registry holding the `general` settings JSON blob.
 */
export function ensureHarborClientUserAgentSettings(database: LocalDatabase): void {
  const raw = database.getSetting(STORE_KEY);
  const stored =
    raw === undefined || raw.trim() === '' ? null : parseJson<Partial<GeneralSettings>>(raw, {});

  if (!needsHarborClientUserAgentCapture(stored)) {
    return;
  }

  const dynamicUa = buildHarborClientUserAgentFromProcess();
  const base = normalizeGeneralSettings({
    ...DEFAULT_GENERAL_SETTINGS,
    ...(stored ?? {})
  });
  const next: GeneralSettings = {
    ...base,
    userAgent: dynamicUa,
    customUserAgents: appendCustomUserAgent(base.customUserAgents, dynamicUa)
  };
  setGeneralSettings(next);
}
