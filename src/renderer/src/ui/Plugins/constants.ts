import type { PluginPermission } from '#/shared/plugin/types';

/**
 * Which class of plugin-like extensions the management screen is showing.
 */
export type PluginManagementKind = 'plugins' | 'themes';

/**
 * Returns the singular noun used in UI copy for a management kind.
 *
 * @param kind - Whether the screen shows plugins or themes.
 * @returns "plugin" or "theme".
 */
export function pluginManagementNoun(kind: PluginManagementKind): 'plugin' | 'theme' {
  return kind === 'themes' ? 'theme' : 'plugin';
}

/**
 * Short permission names shown as badges in detail views.
 */
export const PERMISSION_NAMES: Record<PluginPermission, string> = {
  ui: 'UI',
  storage: 'Storage',
  database: 'Database',
  'filesystem:pick': 'Filesystem: Pick',
  'filesystem:read': 'Filesystem: Read',
  'filesystem:write': 'Filesystem: Write',
  http: 'HTTP',
  ipc: 'IPC',
  server: 'Server'
};

/**
 * Longer permission descriptions shown beside badge labels.
 */
export const PERMISSION_DESCRIPTIONS: Record<PluginPermission, string> = {
  ui: 'Contributions (settings, themes, toasts, commands)',
  storage: 'Plugin-scoped persistent storage',
  database: 'Private SQLite database scoped to this plugin',
  'filesystem:pick': 'Open/save dialogs for user-selected paths',
  'filesystem:read': 'Read from allowlisted filesystem paths',
  'filesystem:write': 'Write to allowlisted filesystem paths',
  http: 'HTTP request hooks in the main process',
  ipc: 'Custom IPC between renderer and main plugin halves',
  server: 'Local HTTP echo server for incoming requests'
};

/**
 * Human-readable labels for plugin permission identifiers shown in compact lists.
 */
export const PERMISSION_LABELS: Record<PluginPermission, string> = {
  ui: 'UI contributions (settings, themes, toasts, commands)',
  storage: 'Plugin-scoped persistent storage',
  database: 'Private SQLite database scoped to this plugin',
  'filesystem:pick': 'Open/save dialogs for user-selected paths',
  'filesystem:read': 'Read from allowlisted filesystem paths',
  'filesystem:write': 'Write to allowlisted filesystem paths',
  http: 'HTTP request hooks in the main process',
  ipc: 'Custom IPC between renderer and main plugin halves',
  server: 'Local HTTP echo server for incoming requests'
};
