import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Returns one collection by uuid with full configuration.
 *
 * @param {string} uuid - Collection uuid from the @collection reference.
 */
export const getCollectionTool = {
  name: 'get_collection',
  definition: {
    type: 'function',
    function: {
      name: 'get_collection',
      description:
        'Returns one collection by uuid with full configuration (variables, headers, auth, scripts). Use when the user message contains @collection.<uuid>. Use the uuid only for this tool call; refer to the collection by its returned name in replies.',
      parameters: {
        type: 'object',
        properties: {
          uuid: { type: 'string', description: 'Collection uuid from the @collection reference.' }
        },
        required: ['uuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    uuid: z.string()
  }
} as const satisfies ITool<'get_collection'>;
