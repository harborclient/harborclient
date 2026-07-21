import type { ITool } from './ITool';

/**
 * Returns a compact summary of the last HTTP response for the active tab, or null.
 */
export const getActiveResponseSummaryTool = {
  name: 'get_active_response_summary',
  definition: {
    type: 'function',
    function: {
      name: 'get_active_response_summary',
      description:
        'Returns a compact summary of the last HTTP response for the active tab (status, headers, short body preview, tests), or null. Prefer this before fetching the full body.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_active_response_summary'>;
