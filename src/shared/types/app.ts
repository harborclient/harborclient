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
  | 'themes'
  | 'snippets'
  | 'cookies'
  | 'team-hubs'
  | 'accept-team-hub-invite'
  | 'sharing-keys'
  | 'join-shared-collection'
  | 'sync'
  | 'toggle-sidebar'
  | 'focus-sidebar-search'
  | 'focus-request-url'
  | 'focus-first-collection'
  | 'focus-first-environment'
  | 'focus-first-request-tab'
  | 'focus-response-editor'
  | 'focus-main-nav'
  | 'toggle-variables'
  | 'toggle-console'
  | 'toggle-ai-sidebar'
  | 'toggle-git-sidebar'
  | 'toggle-request-editor'
  | 'toggle-response-editor'
  | 'toggle-collections-section'
  | 'toggle-environments-section'
  | 'toggle-run-results-section'
  | 'send-request'
  | 'previous-request-tab'
  | 'next-request-tab'
  | 'set-method-get'
  | 'set-method-post'
  | 'set-method-put'
  | 'set-method-patch'
  | 'set-method-delete'
  | 'set-method-head'
  | 'set-method-options'
  | 'getting-started'
  | 'documentation'
  | 'report-issue'
  | 'about'
  | 'check-for-updates'
  | 'shortcuts-reference'
  | 'action-menu'
  | 'undo'
  | 'redo'
  | 'create-tab-group'
  | 'deselect-all-sidebar'
  | 'format-markdown-document'
  | 'new-collection-git'
  | 'git-create-branch'
  | 'git-delete-branch'
  | 'git-commit'
  | 'git-merge'
  | 'git-fetch'
  | 'git-pull'
  | 'git-push'
  | 'git-settings';

/**
 * Top-level application menu labels shown in the Linux in-app menu bar.
 */
export type RootMenuLabel = 'File' | 'Edit' | 'View' | 'Team' | 'Git' | 'Help';

/**
 * Serializable application submenu entry for Linux in-app dropdown menus.
 *
 * Native GTK menus on Linux do not always follow Electron nativeTheme overrides,
 * so the renderer draws themed dropdowns from this snapshot instead.
 */
export type AppSubmenuItemSnapshot =
  | {
      /** Flat index in the root submenu used to activate the item in the main process. */
      index: number;
      kind: 'separator';
    }
  | {
      /** Flat index in the root submenu used to activate the item in the main process. */
      index: number;
      kind: 'normal' | 'checkbox';
      /** Visible menu label. */
      label: string;
      /** Whether a checkbox item is currently checked. */
      checked?: boolean;
      /** Whether the item can be activated. */
      enabled: boolean;
      /** Keyboard shortcut hint shown beside the label. */
      accelerator?: string;
    };

/**
 * Saved request to open automatically after built-in collections are imported on first launch.
 */
export interface BuiltinCollectionOpenRequestTarget {
  /** Stable uuid of the seeded collection export. */
  collectionUuid: string;
  /** Stable uuid of the request within that collection. */
  requestUuid: string;
}

/**
 * Host operating system metadata for the machine running HarborClient.
 */
export interface OperatingSystemInfo {
  /**
   * Node.js platform identifier (darwin, linux, win32).
   */
  platform: NodeJS.Platform;

  /**
   * Operating system name from Node (for example Linux, Darwin, Windows_NT).
   */
  type: string;

  /**
   * Operating system release version string.
   */
  release: string;

  /**
   * CPU architecture (for example x64, arm64).
   */
  arch: string;
}

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
