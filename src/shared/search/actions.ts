/**
 * One action surfaced in the Action menu quick-open mode (`#` prefix).
 */
export interface ActionCommandDefinition {
  /** Stable action id used for dispatch. */
  id: string;
  /** Namespace shown before the label (for example `File` in `File: Settings`). */
  group: string;
  /** Primary label shown after the group prefix. */
  label: string;
  /** Optional secondary description shown beneath the label. */
  description?: string;
}

/**
 * Built-in actions derived from the File, View, Team, and Help application menus.
 */
export const BUILTIN_ACTIONS: ActionCommandDefinition[] = [
  { id: 'builtin:new-request', group: 'File', label: 'New Request' },
  { id: 'builtin:new-collection', group: 'File', label: 'New Collection' },
  { id: 'builtin:sync', group: 'File', label: 'Sync Storage' },
  { id: 'builtin:save', group: 'File', label: 'Save Request' },
  { id: 'builtin:import', group: 'File', label: 'Import' },
  { id: 'builtin:settings', group: 'File', label: 'Settings' },
  { id: 'builtin:plugins', group: 'File', label: 'Plugins' },
  { id: 'builtin:themes', group: 'File', label: 'Themes' },
  { id: 'builtin:snippets', group: 'File', label: 'Snippets' },
  { id: 'builtin:cookies', group: 'File', label: 'Cookies' },
  { id: 'builtin:toggle-sidebar', group: 'View', label: 'Toggle Sidebar' },
  { id: 'builtin:toggle-ai-sidebar', group: 'View', label: 'Toggle Agent Chat' },
  { id: 'builtin:toggle-request-editor', group: 'View', label: 'Toggle Request' },
  { id: 'builtin:toggle-response-editor', group: 'View', label: 'Toggle Response' },
  {
    id: 'builtin:toggle-collections-section',
    group: 'View',
    label: 'Toggle Collections'
  },
  {
    id: 'builtin:toggle-environments-section',
    group: 'View',
    label: 'Toggle Environments'
  },
  {
    id: 'builtin:toggle-run-results-section',
    group: 'View',
    label: 'Toggle Run Results'
  },
  { id: 'builtin:team-hubs', group: 'Team', label: 'Team Hub' },
  {
    id: 'builtin:accept-team-hub-invite',
    group: 'Team',
    label: 'Accept Team Hub Invite'
  },
  { id: 'builtin:sharing-keys', group: 'Team', label: 'Sharing Keys' },
  {
    id: 'builtin:join-shared-collection',
    group: 'Team',
    label: 'Join Shared Collection'
  },
  { id: 'builtin:getting-started', group: 'Help', label: 'Getting Started' },
  { id: 'builtin:check-for-updates', group: 'Help', label: 'Check for Updates' },
  { id: 'builtin:shortcuts-reference', group: 'Help', label: 'Keyboard Shortcuts' },
  { id: 'builtin:about', group: 'Help', label: 'About' }
];

/**
 * Returns the display label for an action row (`group: label`).
 *
 * @param action - Action command definition.
 */
export function actionCommandDisplayLabel(action: ActionCommandDefinition): string {
  return `${action.group}: ${action.label}`;
}

/**
 * Returns whether the query should enter Action menu quick-open mode.
 *
 * @param query - Raw search input value.
 */
export function isActionQuery(query: string): boolean {
  return query.startsWith('#');
}

/**
 * Returns the searchable text for one action definition.
 *
 * @param action - Action command definition.
 */
function actionSearchText(action: ActionCommandDefinition): string {
  const parts = [actionCommandDisplayLabel(action), action.label, action.group];
  if (action.description != null && action.description.length > 0) {
    parts.push(action.description);
  }
  return parts.join(' ').toLowerCase();
}

/**
 * Filters registered actions whose group, label, or description match the typed prefix.
 *
 * @param query - Raw hash-prefixed input.
 * @param actions - Full action catalog to search.
 */
export function matchActionSuggestions(
  query: string,
  actions: ActionCommandDefinition[]
): ActionCommandDefinition[] {
  if (!isActionQuery(query)) {
    return [];
  }

  const filterText = query.slice(1).trim().toLowerCase();
  if (filterText.length === 0) {
    return actions;
  }

  return actions.filter((action) => actionSearchText(action).includes(filterText));
}

/**
 * Builds a stable action id for a plugin-registered quick-open command.
 *
 * @param pluginId - Plugin manifest id.
 * @param commandId - Scoped command id stored in the agent webview.
 */
export function pluginActionId(pluginId: string, commandId: string): string {
  return `plugin:${pluginId}:${commandId}`;
}
