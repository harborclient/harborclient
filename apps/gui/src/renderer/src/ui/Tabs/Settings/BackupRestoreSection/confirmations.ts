import type { GeneralSettings } from '@harborclient/core/types';

import { REQUEST_EDITOR_NOTICE_TABS } from '#/renderer/src/ui/Main/RequestEditor/Editor/requestEditorNotices';

/**
 * Keys on {@link GeneralSettings} that control whether a confirmation prompt is shown.
 */
export type ConfirmationSettingKey = {
  [Key in keyof GeneralSettings]: Key extends `warnWhen${string}` ? Key : never;
}[keyof GeneralSettings];

/**
 * Metadata for one row in the Show confirmations table.
 */
export interface ConfirmationRow {
  /** General settings field that gates the prompt. */
  key: ConfirmationSettingKey;
  /** Short label shown in the table. */
  label: string;
  /** Longer description of when the prompt appears. */
  description: string;
}

/**
 * One row in the Show confirmations table with row-level read and patch
 * behavior, so simple boolean prompts and computed aggregate rows (like the
 * request editor tab tips) can share the same table.
 */
export interface ConfirmationTableRow {
  /** Stable id used for checkbox DOM ids. */
  id: string;
  /** Short label shown in the table. */
  label: string;
  /** Longer description of when the prompt appears. */
  description: string;
  /** Returns whether the prompt is currently enabled. */
  isEnabled: (general: GeneralSettings) => boolean;
  /** Builds the general-settings patch that enables or disables the prompt. */
  patch: (enabled: boolean) => Partial<GeneralSettings>;
}

/**
 * All global confirmation prompts that can be toggled from Backup & Restore settings.
 */
export const CONFIRMATION_ROWS: ConfirmationRow[] = [
  {
    key: 'warnWhenSwitchingThemes',
    label: 'Switching appearance themes',
    description:
      'When enabled, switching appearance themes from the View menu shows a confirmation dialog.'
  },
  {
    key: 'warnWhenExitingWithUnsavedChanges',
    label: 'Exiting the app with unsaved changes',
    description:
      'When enabled, quitting or closing the app with unsaved request tabs shows a confirmation dialog.'
  },
  {
    key: 'warnWhenClosingUnsavedRequests',
    label: 'Closing unsaved request tabs',
    description:
      'When enabled, closing a request tab with unsaved edits shows a confirmation dialog.'
  },
  {
    key: 'warnWhenEditingSnippet',
    label: 'Editing a linked snippet',
    description:
      'When enabled, editing a linked snippet in the request script list shows a confirmation dialog.'
  },
  {
    key: 'warnWhenCloningSnippet',
    label: 'Cloning a linked snippet',
    description:
      'When enabled, cloning a linked snippet in the request script list shows a confirmation dialog.'
  },
  {
    key: 'warnWhenClickingReadonlySnippet',
    label: 'Clicking a read-only linked snippet',
    description:
      'When enabled, clicking a read-only linked snippet in the script list shows an informational dialog.'
  },
  {
    key: 'warnWhenCreatingWorkspace',
    label: 'Creating a workspace from open tabs',
    description:
      'When enabled, creating a workspace from open request tabs shows a confirmation dialog.'
  },
  {
    key: 'warnWhenOpeningWorkspace',
    label: 'Opening all requests in a workspace',
    description:
      'When enabled, opening a workspace in the sidebar shows a confirmation dialog before opening tabs.'
  },
  {
    key: 'warnWhenAgentUsesTerminal',
    label: 'AI agent terminal commands',
    description:
      'When enabled, the AI agent must confirm before sending commands to the footer terminal.'
  }
];

/**
 * Aggregate row for the dismissible request editor tab tips. Enabled only when
 * no tab tip has been dismissed; enabling it restores every tip, disabling it
 * dismisses every tip.
 */
export const REQUEST_EDITOR_NOTICES_ROW: ConfirmationTableRow = {
  id: 'requestEditorNotices',
  label: 'Request editor tab tips',
  description:
    'When enabled, each request editor tab (Params, Body, Headers, and so on) shows a short dismissible tip above its content.',
  isEnabled: (general) => general.dismissedRequestEditorNotices.length === 0,
  patch: (enabled) => ({
    dismissedRequestEditorNotices: enabled ? [] : [...REQUEST_EDITOR_NOTICE_TABS]
  })
};

/**
 * Every row shown in the Show confirmations table: boolean confirmation
 * prompts followed by the aggregate request editor tips row.
 */
export const CONFIRMATION_TABLE_ROWS: ConfirmationTableRow[] = [
  ...CONFIRMATION_ROWS.map(
    (row): ConfirmationTableRow => ({
      id: row.key,
      label: row.label,
      description: row.description,
      isEnabled: (general) => general[row.key],
      patch: (enabled) => ({ [row.key]: enabled })
    })
  ),
  REQUEST_EDITOR_NOTICES_ROW
];

/**
 * Returns whether every confirmation prompt is currently enabled.
 *
 * @param general - Live general settings from the renderer store.
 */
export function areAllConfirmationsEnabled(general: GeneralSettings): boolean {
  return CONFIRMATION_TABLE_ROWS.every((row) => row.isEnabled(general));
}

/**
 * Returns whether every confirmation prompt is currently disabled.
 *
 * @param general - Live general settings from the renderer store.
 */
export function areAllConfirmationsDisabled(general: GeneralSettings): boolean {
  return CONFIRMATION_TABLE_ROWS.every((row) => !row.isEnabled(general));
}

/**
 * Builds a partial {@link GeneralSettings} patch that sets every confirmation
 * row (including the aggregate request editor tips row) to the same state.
 *
 * @param enabled - When true, every confirmation prompt is shown; when false, all are suppressed.
 */
export function confirmationSettingsPatch(enabled: boolean): Partial<GeneralSettings> {
  return CONFIRMATION_TABLE_ROWS.reduce<Partial<GeneralSettings>>(
    (patch, row) => ({ ...patch, ...row.patch(enabled) }),
    {}
  );
}
