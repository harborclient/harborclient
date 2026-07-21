import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the git_file_diff tool.
 */
export interface GitFileDiffToolArgs {
  /**
   * Collection uuid that owns the request.
   */
  collectionUuid: string;

  /**
   * Stable request uuid for the saved request file to diff.
   */
  requestUuid: string;

  /**
   * Older commit object id (parent side of the diff).
   */
  commitA: string;

  /**
   * Newer commit object id (child side of the diff).
   */
  commitB: string;

  /**
   * Maximum diff characters to return; defaults to 4000.
   */
  maxChars?: number;
}

/**
 * Returns a diff of one saved request file between two commits in a git-backed collection.
 *
 * @param {string} collectionUuid - Collection uuid that owns the request.
 * @param {string} requestUuid - Stable request uuid for the saved request file to diff.
 * @param {string} commitA - Older commit object id (parent side of the diff).
 * @param {string} commitB - Newer commit object id (child side of the diff).
 * @param {number} [maxChars] - Maximum diff characters to return; defaults to 4000.
 */
export const gitFileDiffTool = {
  name: 'git_file_diff',
  definition: {
    type: 'function',
    function: {
      name: 'git_file_diff',
      description:
        'Returns a diff of one saved request file between two commits in a git-backed collection. Use git_commits or git_file_info to find commit object ids.',
      parameters: {
        type: 'object',
        properties: {
          collectionUuid: {
            type: 'string',
            description: 'Collection uuid that owns the request.'
          },
          requestUuid: {
            type: 'string',
            description: 'Stable request uuid for the saved request file to diff.'
          },
          commitA: {
            type: 'string',
            description: 'Older commit object id (parent side of the diff).'
          },
          commitB: {
            type: 'string',
            description: 'Newer commit object id (child side of the diff).'
          },
          maxChars: {
            type: 'number',
            description: 'Maximum diff characters to return; defaults to 4000.'
          }
        },
        required: ['collectionUuid', 'requestUuid', 'commitA', 'commitB'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionUuid: z.string(),
    requestUuid: z.string(),
    commitA: z.string(),
    commitB: z.string(),
    maxChars: z.number().optional()
  }
} as const satisfies ITool<'git_file_diff'>;
