import type { CodeEditorSlashCommand } from '@harborclient/sdk/components';

/**
 * Slash commands offered in HarborClient script editors when AI is available.
 */
export const SCRIPT_ASK_COMMANDS: CodeEditorSlashCommand[] = [
  {
    name: 'ask',
    description: 'Ask AI about this script'
  }
];
