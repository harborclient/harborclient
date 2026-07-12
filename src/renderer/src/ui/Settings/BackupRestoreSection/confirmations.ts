import type { GeneralSettings } from '#/shared/types';

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
    key: 'warnWhenCreatingTabGroup',
    label: 'Creating a tab group from open tabs',
    description:
      'When enabled, creating a tab group from open request tabs shows a confirmation dialog.'
  },
  {
    key: 'warnWhenOpeningTabGroup',
    label: 'Opening all requests in a tab group',
    description:
      'When enabled, opening a tab group in the sidebar shows a confirmation dialog before opening tabs.'
  },
  {
    key: 'warnWhenAgentUsesTerminal',
    label: 'AI agent terminal commands',
    description:
      'When enabled, the AI agent must confirm before sending commands to the footer terminal.'
  }
];

/**
 * Returns whether every confirmation prompt is currently enabled.
 *
 * @param general - Live general settings from the renderer store.
 */
export function areAllConfirmationsEnabled(general: GeneralSettings): boolean {
  return CONFIRMATION_ROWS.every((row) => general[row.key]);
}

/**
 * Returns whether every confirmation prompt is currently disabled.
 *
 * @param general - Live general settings from the renderer store.
 */
export function areAllConfirmationsDisabled(general: GeneralSettings): boolean {
  return CONFIRMATION_ROWS.every((row) => !general[row.key]);
}

/**
 * Builds a partial {@link GeneralSettings} patch that sets every confirmation flag to the same value.
 *
 * @param enabled - When true, every confirmation prompt is shown; when false, all are suppressed.
 */
export function confirmationSettingsPatch(enabled: boolean): Partial<GeneralSettings> {
  return Object.fromEntries(
    CONFIRMATION_ROWS.map((row) => [row.key, enabled])
  ) as Partial<GeneralSettings>;
}
