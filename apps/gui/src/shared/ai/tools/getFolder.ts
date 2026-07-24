import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Returns one folder by uuid with variables, headers, auth, and scripts.
 *
 * @param {string} uuid - Folder uuid from the @folder reference.
 */
export const getFolderTool = {
  name: 'get_folder',
  definition: {
    type: 'function',
    function: {
      name: 'get_folder',
      description:
        'Returns one folder by uuid with variables, headers, auth, and scripts. Use when the user message contains @folder.<uuid>. Use the uuid only for this tool call; refer to the folder by its returned name in replies.',
      parameters: {
        type: 'object',
        properties: {
          uuid: { type: 'string', description: 'Folder uuid from the @folder reference.' }
        },
        required: ['uuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    uuid: z.string()
  }
} as const satisfies ITool<'get_folder'>;
