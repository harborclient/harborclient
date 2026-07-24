import { z } from 'zod';
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
export declare const gitCommitsTool: {
  readonly name: 'git_commits';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'git_commits';
      readonly description: 'Returns recent commit history for the git repository that contains a collection. Use list_collections or get_collection to find a collection uuid.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly collectionUuid: {
            readonly type: 'string';
            readonly description: 'Collection uuid used to resolve the git-backed repository connection.';
          };
          readonly depth: {
            readonly type: 'number';
            readonly description: 'Maximum number of commits to return; defaults to 20.';
          };
        };
        readonly required: readonly ['collectionUuid'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly collectionUuid: z.ZodString;
    readonly depth: z.ZodOptional<z.ZodNumber>;
  };
};
//# sourceMappingURL=gitCommits.d.ts.map
