import { z } from 'zod';
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
            description: 'Search HarborClient user docs and plugin SDK docs for how features work, usage guides, scripting APIs, plugins, and settings. Returns ranked passages with titles and public URLs.',
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
};
//# sourceMappingURL=searchDocs.js.map