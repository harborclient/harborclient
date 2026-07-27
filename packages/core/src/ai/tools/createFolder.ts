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

  /**
   * Portable uuid of the parent folder; omit to create at the collection root.
   */
  parentFolderUuid?: string;
}

/**
 * Creates a folder inside an existing collection.
 *
 * @param {number} collectionId - Collection id that will own the new folder.
 * @param {string} name - Display name for the new folder.
 * @param {string} [parentFolderUuid] - Portable uuid of the parent folder.
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
          name: { type: 'string', description: 'Display name for the new folder.' },
          parentFolderUuid: {
            type: 'string',
            description:
              'Portable uuid of the parent folder. Omit to create the folder at the collection root.'
          }
        },
        required: ['collectionId', 'name'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionId: z.number(),
    name: z.string(),
    parentFolderUuid: z.string().optional()
  }
} as const satisfies ITool<'create_folder'>;
