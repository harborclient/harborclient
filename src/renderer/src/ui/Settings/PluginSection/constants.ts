import type { PluginPermission } from '#/shared/plugin/types';

/**
 * Human-readable labels for plugin permission identifiers shown in UI.
 */
export const PERMISSION_LABELS: Record<PluginPermission, string> = {
  ui: 'UI contributions (settings, themes, toasts, commands)',
  storage: 'Plugin-scoped persistent storage',
  'filesystem:pick': 'Open/save dialogs for user-selected paths',
  'filesystem:read': 'Read from allowlisted filesystem paths',
  'filesystem:write': 'Write to allowlisted filesystem paths',
  http: 'HTTP request hooks in the main process',
  ipc: 'Custom IPC between renderer and main plugin halves'
};
