import { z } from 'zod';
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
export declare const gitFileDiffTool: {
  readonly name: 'git_file_diff';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'git_file_diff';
      readonly description: 'Returns a diff of one saved request file between two commits in a git-backed collection. Use git_commits or git_file_info to find commit object ids.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly collectionUuid: {
            readonly type: 'string';
            readonly description: 'Collection uuid that owns the request.';
          };
          readonly requestUuid: {
            readonly type: 'string';
            readonly description: 'Stable request uuid for the saved request file to diff.';
          };
          readonly commitA: {
            readonly type: 'string';
            readonly description: 'Older commit object id (parent side of the diff).';
          };
          readonly commitB: {
            readonly type: 'string';
            readonly description: 'Newer commit object id (child side of the diff).';
          };
          readonly maxChars: {
            readonly type: 'number';
            readonly description: 'Maximum diff characters to return; defaults to 4000.';
          };
        };
        readonly required: readonly ['collectionUuid', 'requestUuid', 'commitA', 'commitB'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly collectionUuid: z.ZodString;
    readonly requestUuid: z.ZodString;
    readonly commitA: z.ZodString;
    readonly commitB: z.ZodString;
    readonly maxChars: z.ZodOptional<z.ZodNumber>;
  };
};
//# sourceMappingURL=gitFileDiff.d.ts.map
