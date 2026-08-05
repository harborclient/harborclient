import type { ITool } from './ITool';

/**
 * Returns every appearance theme the user can activate, flagging the active one.
 */
export const listThemesTool = {
  name: 'list_themes',
  definition: {
    type: 'function',
    function: {
      name: 'list_themes',
      description:
        'Returns every appearance theme that can be activated: system, the built-ins (light, dark, high-contrast), saved custom themes, and themes contributed by installed plugins. Each entry has the value to pass to set_theme, a display label, its kind, its light/dark type, and isActive for the current theme. Call this before naming available themes or when the user asks which theme is active; do not invent theme names.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'list_themes'>;
