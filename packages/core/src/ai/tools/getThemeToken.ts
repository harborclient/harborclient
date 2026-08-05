import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the get_theme_token tool.
 */
export interface GetThemeTokenToolArgs {
  /**
   * Token id (`accent`) or CSS variable name (`--mac-accent`).
   */
  token: string;
}

/**
 * Returns one theme token's catalog metadata and the currently resolved CSS value.
 *
 * @param {string} token - Token id (`accent`) or CSS variable (`--mac-accent`).
 */
export const getThemeTokenTool = {
  name: 'get_theme_token',
  definition: {
    type: 'function',
    function: {
      name: 'get_theme_token',
      description:
        'Returns one --mac-* theme token: catalog metadata (name, token, kind, group, label, description, defaults) plus currentValue from the live resolved CSS on :root. Accepts a bare token id (accent) or CSS variable name (--mac-accent).',
      parameters: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'Token id (accent) or CSS variable name (--mac-accent).'
          }
        },
        required: ['token'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    token: z.string()
  }
} as const satisfies ITool<'get_theme_token'>;
