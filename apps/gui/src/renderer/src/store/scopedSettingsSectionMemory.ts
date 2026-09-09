import {
  resolveScopedSettingsFocusSection,
  type ScopedSettingsScope
} from '@harborclient/core/scopedSettingsSection';

/** Last collection/folder settings SegmentedTabs values loaded during bootstrap. */
const remembered: Record<ScopedSettingsScope, string | null> = {
  collection: null,
  folder: null
};

/**
 * Stashes a persisted scoped-settings section so opening settings can restore
 * the last tab without waiting on IPC.
 *
 * @param scope - Collection or folder settings.
 * @param section - Normalized section id, or null when unset.
 */
export function setRememberedScopedSettingsSection(
  scope: ScopedSettingsScope,
  section: string | null
): void {
  remembered[scope] = section;
}

/**
 * Returns the last SegmentedTabs section for collection or folder settings.
 *
 * @param scope - Collection or folder settings.
 * @returns Remembered section id, or null when none is stored.
 */
export function getRememberedScopedSettingsSection(scope: ScopedSettingsScope): string | null {
  return remembered[scope];
}

/**
 * Updates in-memory last-tab state and persists it to electron-store.
 *
 * @param scope - Collection or folder settings.
 * @param section - Section the user selected.
 */
export function rememberScopedSettingsSection(scope: ScopedSettingsScope, section: string): void {
  remembered[scope] = section;
  void window.api.setScopedSettingsSection(scope, section);
}

/**
 * Resolves the section to show when opening collection or folder settings.
 *
 * @param scope - Collection or folder settings.
 * @param explicit - Section from the page ref (deep link or open-tab memory).
 * @returns Section to focus, or undefined to keep the form default.
 */
export function resolveRememberedScopedSettingsFocusSection(
  scope: ScopedSettingsScope,
  explicit: string | undefined
): string | undefined {
  return resolveScopedSettingsFocusSection(explicit, remembered[scope]);
}

/**
 * Loads persisted collection and folder settings tabs before the window is shown
 * so the first open after launch restores the last section without a flash.
 */
export async function hydrateScopedSettingsSections(): Promise<void> {
  try {
    const [collection, folder] = await Promise.all([
      window.api.getScopedSettingsSection('collection'),
      window.api.getScopedSettingsSection('folder')
    ]);
    remembered.collection = collection;
    remembered.folder = folder;
  } catch {
    // Keep defaults when IPC fails so shell bootstrap can continue.
  }
}

/**
 * Clears remembered sections for tests simulating a cold app start.
 */
export function resetScopedSettingsSectionMemoryForTests(): void {
  remembered.collection = null;
  remembered.folder = null;
}
