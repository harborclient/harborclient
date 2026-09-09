/**
 * Storage keys for last-opened collection and folder settings SegmentedTabs.
 */
export type ScopedSettingsScope = 'collection' | 'folder';

const SCOPED_SETTINGS_SCOPES = new Set<ScopedSettingsScope>(['collection', 'folder']);

const BUILTIN_SCOPED_SETTINGS_SECTIONS = new Set<string>([
  'general',
  'git',
  'variables',
  'headers',
  'auth',
  'pre',
  'post',
  'discuss'
]);

/**
 * Plugin collection-settings tab ids are contribution ids. Allow the same
 * conservative token shape used elsewhere for plugin UI identifiers.
 */
const PLUGIN_SECTION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;

/**
 * Returns whether a value is a supported scoped-settings persistence scope.
 *
 * @param value - Candidate key from persisted storage or IPC.
 * @returns True when the key identifies collection or folder settings.
 */
export function isScopedSettingsScope(value: unknown): value is ScopedSettingsScope {
  return typeof value === 'string' && SCOPED_SETTINGS_SCOPES.has(value as ScopedSettingsScope);
}

/**
 * Normalizes a scoped-settings persistence scope.
 *
 * @param value - Candidate key from persisted storage or IPC.
 * @returns Valid scope or null when unrecognized.
 */
export function normalizeScopedSettingsScope(value: unknown): ScopedSettingsScope | null {
  return isScopedSettingsScope(value) ? value : null;
}

/**
 * Returns whether a section id can be remembered for collection or folder settings.
 *
 * Built-in tabs are allowlisted. Plugin tabs use a conservative identifier pattern
 * so a corrupt store cannot persist arbitrary strings.
 *
 * @param section - Candidate SegmentedTabs value.
 * @returns True when the section is safe to persist.
 */
export function isAllowedScopedSettingsSection(section: string): boolean {
  return BUILTIN_SCOPED_SETTINGS_SECTIONS.has(section) || PLUGIN_SECTION_PATTERN.test(section);
}

/**
 * Normalizes a persisted scoped-settings SegmentedTabs value.
 *
 * @param value - Candidate section from persisted storage.
 * @returns Valid section id or null when invalid.
 */
export function normalizeScopedSettingsSection(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const section = value.trim();
  return isAllowedScopedSettingsSection(section) ? section : null;
}

/**
 * Picks the SegmentedTabs section to show when opening collection or folder settings.
 *
 * Explicit deep links (`focusSection` / implied Variables) win over the last
 * remembered tab so Git alerts and variable jumps still land correctly.
 *
 * @param explicit - Section from the page ref, if any.
 * @param remembered - Last section persisted for this settings scope.
 * @returns Section to focus, or undefined to keep the form default (General).
 */
export function resolveScopedSettingsFocusSection(
  explicit: string | undefined,
  remembered: string | null
): string | undefined {
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return explicit;
  }
  return remembered ?? undefined;
}
