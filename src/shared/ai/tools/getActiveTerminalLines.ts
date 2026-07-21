import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the get_active_terminal_lines tool.
 */
export interface GetActiveTerminalLinesToolArgs {
  /**
   * 1-based first line to read (inclusive).
   */
  startLine: number;

  /**
   * 1-based last line to read (inclusive).
   */
  endLine: number;
}

/**
 * Returns a 1-based inclusive line range from the active footer terminal output as plain text.
 *
 * @param {number} startLine - 1-based first line to read (inclusive).
 * @param {number} endLine - 1-based last line to read (inclusive).
 */
export const getActiveTerminalLinesTool = {
  name: 'get_active_terminal_lines',
  definition: {
    type: 'function',
    function: {
      name: 'get_active_terminal_lines',
      description:
        'Returns a 1-based inclusive line range from the active footer terminal output as plain text. Call get_active_terminal first to see totalLines before requesting a range. Lines are clamped to the available buffer.',
      parameters: {
        type: 'object',
        properties: {
          startLine: {
            type: 'number',
            description: '1-based first line to read (inclusive).'
          },
          endLine: {
            type: 'number',
            description: '1-based last line to read (inclusive).'
          }
        },
        required: ['startLine', 'endLine'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    startLine: z.number(),
    endLine: z.number()
  }
} as const satisfies ITool<'get_active_terminal_lines'>;
