import type { ITool } from './ITool';

/**
 * Returns the current General Settings (timeouts, SSL, proxy, script permissions, and related prefs).
 */
export const getGeneralSettingsTool = {
  name: 'get_general_settings',
  definition: {
    type: 'function',
    function: {
      name: 'get_general_settings',
      description:
        'Returns the current General Settings values (request/script timeouts, verifySsl / SSL certificate verification, followRedirects, script permissions, proxy, code editor, git author, warnings, global variables, and related prefs). Use before discussing or changing settings. proxy.password is redacted when set. Does not include AI provider API keys.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_general_settings'>;
