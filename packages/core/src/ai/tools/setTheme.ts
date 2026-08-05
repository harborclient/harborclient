import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the set_theme tool.
 */
export interface SetThemeToolArgs {
  /**
   * Theme value (`light`, `system`, `custom:ocean`) or display label (`Ocean`).
   */
  theme: string;
}

/**
 * Switches the active appearance theme for the whole app.
 *
 * @param {string} theme - Theme value or display label to activate.
 */
export const setThemeTool = {
  name: 'set_theme',
  definition: {
    type: 'function',
    function: {
      name: 'set_theme',
      description:
        'Switches the active appearance theme for the whole app and persists the preference. Accepts a value from list_themes (system, light, dark, high-contrast, custom:<id>, plugin:<pluginId>:<themeId>) or a theme display label. This is the only way to change which theme is active — update_general_settings cannot do it, and update_theme_token only edits colors within the theme that is already active. Only call when the user explicitly asks to switch, change, or set the theme. When the user has theme-switch warnings enabled they are asked to confirm, and the result reports whether they declined.',
      parameters: {
        type: 'object',
        properties: {
          theme: {
            type: 'string',
            description:
              'Theme value (light, dark, system, high-contrast, custom:<id>, plugin:<pluginId>:<themeId>) or its display label.'
          }
        },
        required: ['theme'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    theme: z.string()
  }
} as const satisfies ITool<'set_theme'>;
