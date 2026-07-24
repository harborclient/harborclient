import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the create_folder tool.
 */
export interface CreateFolderToolArgs {
  /**
   * Collection id that will own the new folder.
   */
  collectionId: number;

  /**
   * Display name for the new folder.
   */
  name: string;
}

/**
 * Creates a folder inside an existing collection.
 *
 * @param {number} collectionId - Collection id that will own the new folder.
 * @param {string} name - Display name for the new folder.
 */
export const createFolderTool = {
  name: 'create_folder',
  definition: {
    type: 'function',
    function: {
      name: 'create_folder',
      description:
        'Creates a folder inside an existing collection. Persists immediately. Use list_collections or get_collection first when you need the collection id.',
      parameters: {
        type: 'object',
        properties: {
          collectionId: {
            type: 'number',
            description: 'Collection id that will own the new folder.'
          },
          name: { type: 'string', description: 'Display name for the new folder.' }
        },
        required: ['collectionId', 'name'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionId: z.number(),
    name: z.string()
  }
} as const satisfies ITool<'create_folder'>;
