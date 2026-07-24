import type { ITool } from './ITool';

/**
 * Lists all collections with configuration, storage metadata, and selection state.
 */
export const listCollectionsTool = {
  name: 'list_collections',
  definition: {
    type: 'function',
    function: {
      name: 'list_collections',
      description:
        'Lists all collections with configuration (variables, headers, auth, scripts), storage metadata (uuid, storageType, isGitBacked, connectionId), and whether each is selected.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'list_collections'>;
