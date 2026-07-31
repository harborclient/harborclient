import type { ITool } from './ITool';

/**
 * Lists currently running live server instances.
 */
export const listRunningLiveServersTool = {
  name: 'list_running_live_servers',
  definition: {
    type: 'function',
    function: {
      name: 'list_running_live_servers',
      description:
        'Lists currently running live server instances (runtime id, savedId, name, root, port, origin, startedAt, watchUnavailable). Call this for status, port, or origin questions. Live servers bind loopback only (127.0.0.1).',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'list_running_live_servers'>;
