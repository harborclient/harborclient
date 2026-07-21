import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the git_commits tool.
 */
export interface GitCommitsToolArgs {
  /**
   * Collection uuid used to resolve the git-backed repository connection.
   */
  collectionUuid: string;

  /**
   * Maximum number of commits to return; defaults to 20.
   */
  depth?: number;
}

/**
 * Returns recent commit history for the git repository that contains a collection.
 *
 * @param {string} collectionUuid - Collection uuid used to resolve the git-backed repository connection.
 * @param {number} [depth] - Maximum number of commits to return; defaults to 20.
 */
export const gitCommitsTool = {
  name: 'git_commits',
  definition: {
    type: 'function',
    function: {
      name: 'git_commits',
      description:
        'Returns recent commit history for the git repository that contains a collection. Use list_collections or get_collection to find a collection uuid.',
      parameters: {
        type: 'object',
        properties: {
          collectionUuid: {
            type: 'string',
            description: 'Collection uuid used to resolve the git-backed repository connection.'
          },
          depth: {
            type: 'number',
            description: 'Maximum number of commits to return; defaults to 20.'
          }
        },
        required: ['collectionUuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionUuid: z.string(),
    depth: z.number().optional()
  }
} as const satisfies ITool<'git_commits'>;
