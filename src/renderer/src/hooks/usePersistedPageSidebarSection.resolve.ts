import type { PageSidebarKey } from '#/shared/pageSidebarSection';

interface ResolvePageSidebarSectionInput<T extends string> {
  /**
   * Fallback section when nothing persisted or valid is available.
   */
  defaultSection: T;

  /**
   * Explicit navigation target that should win over persisted memory.
   */
  navigationOverride?: T;

  /**
   * Section loaded from electron-store, if any.
   */
  persisted: string | null;

  /**
   * Validates a candidate section against the current screen state.
   */
  isValidSection: (section: string) => section is T;
}

/**
 * Resolves the sidebar section to show after hydration or explicit navigation.
 *
 * @param input - Default, override, persisted, and validation inputs.
 * @returns Section id safe to render in the sidebar.
 */
export function resolvePageSidebarSection<T extends string>({
  defaultSection,
  navigationOverride,
  persisted,
  isValidSection
}: ResolvePageSidebarSectionInput<T>): T {
  if (navigationOverride != null && isValidSection(navigationOverride)) {
    return navigationOverride;
  }

  if (persisted != null && isValidSection(persisted)) {
    return persisted;
  }

  return defaultSection;
}

interface Options<T extends string> {
  /**
   * Page sidebar storage key such as `settings` or `plugins`.
   */
  pageKey: PageSidebarKey;

  /**
   * Fallback section when nothing persisted or valid is available.
   */
  defaultSection: T;

  /**
   * Validates a candidate section against the current screen state.
   */
  isValidSection: (section: string) => section is T;

  /**
   * Explicit navigation target that should win over persisted memory.
   */
  navigationOverride?: T;
}

interface Result<T extends string> {
  /**
   * Active sidebar section for rendering.
   */
  section: T;

  /**
   * Updates the selected section in memory and electron-store.
   */
  setSection: (section: T) => void;
}

export type {
  Options as UsePersistedPageSidebarSectionOptions,
  Result as UsePersistedPageSidebarSectionResult
};
