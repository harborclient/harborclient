import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the git_diff tool.
 */
export interface GitDiffToolArgs {
  /**
   * Collection uuid used to resolve the git-backed repository connection.
   */
  collectionUuid: string;

  /**
   * Maximum number of changed files to include; defaults to 40.
   */
  maxFiles?: number;

  /**
   * Maximum characters per file diff excerpt; defaults to 4000.
   */
  maxCharsPerFile?: number;

  /**
   * Maximum total characters across all file excerpts; defaults to 32000.
   */
  maxTotalChars?: number;
}

/**
 * Returns uncommitted git changes for the repository that contains a collection.
 *
 * @param {string} collectionUuid - Collection uuid used to resolve the git-backed repository connection.
 * @param {number} [maxFiles] - Maximum number of changed files to include; defaults to 40.
 * @param {number} [maxCharsPerFile] - Maximum characters per file diff excerpt; defaults to 4000.
 * @param {number} [maxTotalChars] - Maximum total characters across all file excerpts; defaults to 32000.
 */
export const gitDiffTool = {
  name: 'git_diff',
  definition: {
    type: 'function',
    function: {
      name: 'git_diff',
      description:
        'Returns uncommitted git changes for the HarborClient subdirectory of the repository that contains a collection. Use get_collection or list_collections to find a collection uuid. The diff covers the whole repository working tree for that git connection, not only the referenced collection folder.',
      parameters: {
        type: 'object',
        properties: {
          collectionUuid: {
            type: 'string',
            description: 'Collection uuid used to resolve the git-backed repository connection.'
          },
          maxFiles: {
            type: 'number',
            description: 'Maximum number of changed files to include; defaults to 40.'
          },
          maxCharsPerFile: {
            type: 'number',
            description: 'Maximum characters per file diff excerpt; defaults to 4000.'
          },
          maxTotalChars: {
            type: 'number',
            description: 'Maximum total characters across all file excerpts; defaults to 32000.'
          }
        },
        required: ['collectionUuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    collectionUuid: z.string(),
    maxFiles: z.number().optional(),
    maxCharsPerFile: z.number().optional(),
    maxTotalChars: z.number().optional()
  }
} as const satisfies ITool<'git_diff'>;
