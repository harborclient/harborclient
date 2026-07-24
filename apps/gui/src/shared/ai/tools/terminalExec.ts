import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the terminal_exec tool.
 */
export interface TerminalExecToolArgs {
  /**
   * Raw input to send to the active terminal shell stdin; include a newline to run a command.
   */
  input: string;
}

/**
 * Sends raw input to the active footer terminal shell stdin.
 *
 * @param {string} input - Raw bytes to write to the shell stdin; include a newline to run a command.
 */
export const terminalExecTool = {
  name: 'terminal_exec',
  definition: {
    type: 'function',
    function: {
      name: 'terminal_exec',
      description:
        'Sends raw input to the active footer terminal shell stdin (for example "cd foo\\n" to change directory or "npm test\\n" to run a command). The terminal panel must be open. Include a trailing newline when executing a command. Use get_active_terminal_lines afterward to read command output. Never use for destructive or irreversible commands (rm, rmdir, dd, git reset --hard, sudo, shutdown, and similar).',
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description:
              'Raw bytes to write to the shell stdin; include \\n at the end when running a command.'
          }
        },
        required: ['input'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    input: z.string()
  }
} as const satisfies ITool<'terminal_exec'>;
