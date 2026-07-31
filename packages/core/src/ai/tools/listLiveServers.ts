import type { ITool } from './ITool';

/**
 * Lists all saved live servers from the local registry.
 */
export const listLiveServersTool = {
  name: 'list_live_servers',
  definition: {
    type: 'function',
    function: {
      name: 'list_live_servers',
      description:
        'Lists all saved live servers (id, uuid, name, root, port, aliases, watch, cors). Call this before answering questions about configured live servers. Prefer display names in replies; use ids only for follow-up tool calls.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'list_live_servers'>;
