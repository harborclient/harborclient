import { z } from 'zod';
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
export declare const gitRepoInfoTool: {
    readonly name: "git_repo_info";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "git_repo_info";
            readonly description: "Returns git repository metadata for a git-backed collection: remote url, repo path, HarborClient data path, branch/status, saved requests and documents with repo-relative paths, and uncommitted changes. Use list_collections or get_collection to find a collection uuid.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionUuid: {
                        readonly type: "string";
                        readonly description: "Collection uuid used to resolve the git-backed repository connection.";
                    };
                };
                readonly required: readonly ["collectionUuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionUuid: z.ZodString;
    };
};
//# sourceMappingURL=gitRepoInfo.d.ts.map