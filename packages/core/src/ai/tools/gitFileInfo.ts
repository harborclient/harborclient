import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the git_file_info tool.
 */
export interface GitFileInfoToolArgs {
  /**
   * Collection uuid that owns the request.
   */
  collectionUuid: string;

  /**
   * Stable request uuid for the saved request file to inspect.
   */
  requestUuid: string;

  /**
   * Maximum number of commits to include in per-file history; defaults to 20.
   */
  depth?: number;
}

/**
 * Returns detailed information about one saved request in a git-backed collection.
 *
 * @param {string} collectionUuid - Collection uuid that owns the request.
 * @param {string} requestUuid - Stable request uuid for the saved request file to inspect.
 * @param {number} [depth] - Maximum number of commits to include in per-file history; defaults to 20.
 */
export const gitFileInfoTool = {
  name: 'git_file_info',
  definition: {
    type: 'function',
    function: {
      name: 'git_file_info',
      description:
        'Returns detailed information about one saved request in a git-backed collection, including its repository-relative file path and commit history for that file. Use get_request or list_requests to find request uuids.',
      parameters: {
        type: 'object',
        properties: {
          collectionUuid: {
            type: 'string',
            description: 'Collection uuid that owns the request.'
          },
          requestUuid: {
            type: 'string',
            description: 'Stable request uuid for the saved request file to inspect.'
          },
          depth: {
            type: 'number',
            description: 'Maximum number of commits to include in per-file history; defaults to 20.'
          }
        },
        required: ['collectionUuid', 'requestUuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionUuid: z.string(),
    requestUuid: z.string(),
    depth: z.number().optional()
  }
} as const satisfies ITool<'git_file_info'>;
