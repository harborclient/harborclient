import { z } from 'zod';
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
export declare const gitDiffTool: {
  readonly name: 'git_diff';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'git_diff';
      readonly description: 'Returns uncommitted git changes for the HarborClient subdirectory of the repository that contains a collection. Use get_collection or list_collections to find a collection uuid. The diff covers the whole repository working tree for that git connection, not only the referenced collection folder.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly collectionUuid: {
            readonly type: 'string';
            readonly description: 'Collection uuid used to resolve the git-backed repository connection.';
          };
          readonly maxFiles: {
            readonly type: 'number';
            readonly description: 'Maximum number of changed files to include; defaults to 40.';
          };
          readonly maxCharsPerFile: {
            readonly type: 'number';
            readonly description: 'Maximum characters per file diff excerpt; defaults to 4000.';
          };
          readonly maxTotalChars: {
            readonly type: 'number';
            readonly description: 'Maximum total characters across all file excerpts; defaults to 32000.';
          };
        };
        readonly required: readonly ['collectionUuid'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly collectionUuid: z.ZodString;
    readonly maxFiles: z.ZodOptional<z.ZodNumber>;
    readonly maxCharsPerFile: z.ZodOptional<z.ZodNumber>;
    readonly maxTotalChars: z.ZodOptional<z.ZodNumber>;
  };
};
//# sourceMappingURL=gitDiff.d.ts.map
