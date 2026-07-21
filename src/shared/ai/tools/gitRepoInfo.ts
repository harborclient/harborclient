import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the git_repo_info tool.
 */
export interface GitRepoInfoToolArgs {
  /**
   * Collection uuid used to resolve the git-backed repository connection.
   */
  collectionUuid: string;
}

/**
 * Returns git repository metadata for a git-backed collection.
 *
 * @param {string} collectionUuid - Collection uuid used to resolve the git-backed repository connection.
 */
export const gitRepoInfoTool = {
  name: 'git_repo_info',
  definition: {
    type: 'function',
    function: {
      name: 'git_repo_info',
      description:
        'Returns git repository metadata for a git-backed collection: remote url, repo path, HarborClient data path, branch/status, saved requests and documents with repo-relative paths, and uncommitted changes. Use list_collections or get_collection to find a collection uuid.',
      parameters: {
        type: 'object',
        properties: {
          collectionUuid: {
            type: 'string',
            description: 'Collection uuid used to resolve the git-backed repository connection.'
          }
        },
        required: ['collectionUuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionUuid: z.string()
  }
} as const satisfies ITool<'git_repo_info'>;
