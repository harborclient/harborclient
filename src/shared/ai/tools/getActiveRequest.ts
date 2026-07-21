import type { ITool } from './ITool';

/**
 * Returns summary info for the request open in the editor pane.
 */
export const getActiveRequestTool = {
  name: 'get_active_request',
  definition: {
    type: 'function',
    function: {
      name: 'get_active_request',
      description:
        'Returns summary info for the request open in the editor pane (tab id, method, url, dirty state).',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_active_request'>;
