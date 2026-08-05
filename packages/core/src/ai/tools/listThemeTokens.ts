import type { ITool } from './ITool';

/**
 * Returns the complete catalog of `--mac-*` theme tokens with defaults and descriptions.
 */
export const listThemeTokensTool = {
  name: 'list_theme_tokens',
  definition: {
    type: 'function',
    function: {
      name: 'list_theme_tokens',
      description:
        'Returns every HarborClient --mac-* theme token (colors and metrics) with name, token id, kind, group, label, description, and built-in default values for light/dark/high-contrast. Call before discussing available theme tokens; do not invent token names or defaults.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'list_theme_tokens'>;
