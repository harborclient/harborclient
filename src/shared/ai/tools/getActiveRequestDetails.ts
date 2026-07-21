import type { ITool } from './ITool';

/**
 * Returns the full draft of the active editor request including scripts and cookies.
 */
export const getActiveRequestDetailsTool = {
  name: 'get_active_request_details',
  definition: {
    type: 'function',
    function: {
      name: 'get_active_request_details',
      description:
        'Returns the full draft of the active editor request (headers, params, body, auth, scripts, cookies). Includes pre_request_scripts and post_request_scripts arrays with 1-based index, name, kind (inline or snippet), and resolved source code for each script row.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_active_request_details'>;
