import type { ITool } from './ITool';

/**
 * Returns the response Console / Headers / Timing inspector for the active tab, or null.
 */
export const getActiveResponseConsoleTool = {
  name: 'get_active_response_console',
  definition: {
    type: 'function',
    function: {
      name: 'get_active_response_console',
      description:
        'Returns the structured response Console inspector for the active tab (general metadata, request/response headers, timing phases), or null. Use for @console.<section>.<row> questions and transport errors. For script logs/tests use get_script_run_diagnostics; for body text use get_active_response_summary / get_active_response.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_active_response_console'>;
