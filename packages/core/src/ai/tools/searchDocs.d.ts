import { z } from 'zod';
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
export declare const searchDocsTool: {
    readonly name: "search_docs";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "search_docs";
            readonly description: "Search HarborClient user docs and plugin SDK docs for how features work, usage guides, scripting APIs, plugins, and settings. Returns ranked passages with titles and public URLs.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly query: {
                        readonly type: "string";
                        readonly description: "Natural-language question or keywords to search for in the documentation.";
                    };
                    readonly limit: {
                        readonly type: "number";
                        readonly description: "Maximum number of passages to return; defaults to 5.";
                    };
                    readonly source: {
                        readonly type: "string";
                        readonly enum: readonly ["site", "sdk"];
                        readonly description: "Optional filter: site user docs or sdk plugin development docs.";
                    };
                };
                readonly required: readonly ["query"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly query: z.ZodString;
        readonly limit: z.ZodOptional<z.ZodNumber>;
        readonly source: z.ZodOptional<z.ZodEnum<{
            site: "site";
            sdk: "sdk";
        }>>;
    };
};
//# sourceMappingURL=searchDocs.d.ts.map