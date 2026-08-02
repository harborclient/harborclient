import type { LiveServerSettingsTab } from './types/settings';

const LIVE_SERVER_SETTINGS_TABS: ReadonlySet<LiveServerSettingsTab> = new Set([
  'general',
  'proxy',
  'headers',
  'routing',
  'run',
  'ssl',
  'scripts'
]);

/**
 * Returns a valid Live Server settings tab value or null when unknown.
 *
 * @param value - Raw stored value.
 */
export function normalizeLiveServerSettingsTab(value: unknown): LiveServerSettingsTab | null {
  if (typeof value !== 'string' || !LIVE_SERVER_SETTINGS_TABS.has(value as LiveServerSettingsTab)) {
    return null;
  }
  return value as LiveServerSettingsTab;
}
