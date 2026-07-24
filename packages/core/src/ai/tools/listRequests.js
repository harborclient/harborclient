import { z } from 'zod';
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
};
//# sourceMappingURL=listRequests.js.map