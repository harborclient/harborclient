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
        'Returns the full draft of the active editor request (headers, params, body, auth, scripts, cookies). Includes pre_request_scripts and post_request_scripts arrays with 1-based index, name, kind (inline or snippet), and resolved source code for each script row. For multipart and urlencoded bodies, also returns body_raw (verbatim override or null), body_raw_open (drawer state), and body_raw_effective (the wire text that will be sent — the override when set, otherwise a projection from structured rows).',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_active_request_details'>;
