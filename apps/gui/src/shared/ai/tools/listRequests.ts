import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the list_requests tool.
 */
export interface ListRequestsToolArgs {
  /**
   * Collection id whose saved requests should be listed.
   */
  collectionId: number;
}

/**
 * Lists saved requests in a collection by id.
 *
 * @param {number} collectionId - Collection id to list requests for.
 */
export const listRequestsTool = {
  name: 'list_requests',
  definition: {
    type: 'function',
    function: {
      name: 'list_requests',
      description: 'Lists saved requests in a collection by id.',
      parameters: {
        type: 'object',
        properties: {
          collectionId: { type: 'number', description: 'Collection id to list requests for.' }
        },
        required: ['collectionId'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionId: z.number()
  }
} as const satisfies ITool<'list_requests'>;
