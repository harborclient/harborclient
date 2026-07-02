/**
 * Menu action identifiers sent from the main process menu.
 */
export type MenuActionId =
  | 'new-request'
  | 'new-collection'
  | 'import'
  | 'save'
  | 'settings'
  | 'plugins'
  | 'team-hubs'
  | 'sharing-keys'
  | 'join-shared-collection'
  | 'sync'
  | 'toggle-sidebar'
  | 'focus-sidebar-search'
  | 'toggle-ai-sidebar'
  | 'toggle-request-editor'
  | 'toggle-response-editor'
  | 'toggle-collections-section'
  | 'toggle-environments-section'
  | 'send-request'
  | 'previous-request-tab'
  | 'next-request-tab'
  | 'documentation'
  | 'report-issue'
  | 'about'
  | 'check-for-updates';

/**
 * Top-level application menu labels shown in the Linux in-app menu bar.
 */
export type RootMenuLabel = 'File' | 'Edit' | 'View' | 'Help';

/**
 * Result of comparing the running app version against the latest GitHub release.
 */
export interface UpdateCheckResult {
  /**
   * Semver of the currently running application.
   */
  currentVersion: string;
  /**
   * Semver of the latest published release on GitHub.
   */
  latestVersion: string;
  /**
   * True when the latest release is newer than the running version.
   */
  updateAvailable: boolean;
  /**
   * URL where the user can download releases.
   */
  releaseUrl: string;
}
