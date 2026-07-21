import { z } from 'zod';
import type { ITool } from './ITool';
import { CREATE_COLLECTION_REQUEST_SCHEMA, createCollectionRequestRow } from './schemas';
import type { CreateCollectionRequestRow } from './types';

/**
 * Arguments for the create_collection tool.
 */
export interface CreateCollectionToolArgs {
  /**
   * Display name for the new collection.
   */
  name: string;

  /**
   * Saved requests to create inside the collection; defaults to an empty collection.
   */
  requests?: CreateCollectionRequestRow[];
}

/**
 * Creates a new collection and optionally saves requests inside it.
 *
 * @param {string} name - Display name for the new collection.
 * @param {object[]} [requests] - Saved requests to create inside the collection.
 */
export const createCollectionTool = {
  name: 'create_collection',
  definition: {
    type: 'function',
    function: {
      name: 'create_collection',
      description:
        'Creates a new collection and optionally saves requests inside it. Persists immediately to storage and selects the collection in the sidebar. Use when the user asks to create a new collection or scaffold API requests in a new collection. Each request row may include an optional folder name; folders are created automatically.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name for the new collection.' },
          requests: {
            type: 'array',
            items: CREATE_COLLECTION_REQUEST_SCHEMA,
            description: 'Saved requests to create inside the collection.'
          }
        },
        required: ['name'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    name: z.string(),
    requests: z.array(createCollectionRequestRow).optional()
  }
} as const satisfies ITool<'create_collection'>;
