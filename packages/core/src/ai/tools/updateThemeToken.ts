import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the update_theme_token tool.
 */
export interface UpdateThemeTokenToolArgs {
  /**
   * Token id (`accent`) or CSS variable name (`--mac-accent`).
   */
  token: string;

  /**
   * New CSS value to persist (for example `#007acc` or `14px`).
   */
  value: string;
}

/**
 * Updates one `--mac-*` token on the active theme's on-disk file and re-applies it.
 *
 * @param {string} token - Token id (`accent`) or CSS variable (`--mac-accent`).
 * @param {string} value - New CSS value to persist.
 */
export const updateThemeTokenTool = {
  name: 'update_theme_token',
  definition: {
    type: 'function',
    function: {
      name: 'update_theme_token',
      description:
        'Updates one --mac-* color or metric token on the active theme file and applies it immediately. Persists to the built-in or custom theme JSON under userData (not a temporary override). Only call when the user explicitly asks to change a theme color or metric. Fails for plugin themes. Accepts a bare token id or --mac-* name.',
      parameters: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'Token id (accent) or CSS variable name (--mac-accent).'
          },
          value: {
            type: 'string',
            description: 'New CSS value (for example #007acc, rgba(...), 14px, or a font stack).'
          }
        },
        required: ['token', 'value'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    token: z.string(),
    value: z.string()
  }
} as const satisfies ITool<'update_theme_token'>;
