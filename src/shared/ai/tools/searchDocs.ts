import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the search_docs tool.
 */
export interface SearchDocsToolArgs {
  /**
   * Natural-language query describing what to find in HarborClient or SDK docs.
   */
  query: string;

  /**
   * Maximum number of documentation passages to return; defaults to 5.
   */
  limit?: number;

  /**
   * Restrict results to site user docs or SDK plugin docs.
   */
  source?: 'site' | 'sdk';
}

/**
 * Search HarborClient user docs and plugin SDK docs; returns ranked passages with titles and URLs.
 *
 * @param {string} query - Natural-language question or keywords to search for.
 * @param {number} [limit] - Maximum number of passages to return; defaults to 5.
 * @param {'site' | 'sdk'} [source] - Optional filter: site user docs or sdk plugin development docs.
 */
export const searchDocsTool = {
  name: 'search_docs',
  definition: {
    type: 'function',
    function: {
      name: 'search_docs',
      description:
        'Search HarborClient user docs and plugin SDK docs for how features work, usage guides, scripting APIs, plugins, and settings. Returns ranked passages with titles and public URLs.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural-language question or keywords to search for in the documentation.'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of passages to return; defaults to 5.'
          },
          source: {
            type: 'string',
            enum: ['site', 'sdk'],
            description: 'Optional filter: site user docs or sdk plugin development docs.'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    query: z.string(),
    limit: z.number().optional(),
    source: z.enum(['site', 'sdk']).optional()
  }
} as const satisfies ITool<'search_docs'>;
