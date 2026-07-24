import { z } from 'zod';
/**
 * Arguments for the git_file_info tool.
 */
export interface GitFileInfoToolArgs {
  /**
   * Collection uuid that owns the request.
   */
  collectionUuid: string;
  /**
   * Stable request uuid for the saved request file to inspect.
   */
  requestUuid: string;
  /**
   * Maximum number of commits to include in per-file history; defaults to 20.
   */
  depth?: number;
}
/**
 * Returns detailed information about one saved request in a git-backed collection.
 *
 * @param {string} collectionUuid - Collection uuid that owns the request.
 * @param {string} requestUuid - Stable request uuid for the saved request file to inspect.
 * @param {number} [depth] - Maximum number of commits to include in per-file history; defaults to 20.
 */
export declare const gitFileInfoTool: {
  readonly name: 'git_file_info';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'git_file_info';
      readonly description: 'Returns detailed information about one saved request in a git-backed collection, including its repository-relative file path and commit history for that file. Use get_request or list_requests to find request uuids.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly collectionUuid: {
            readonly type: 'string';
            readonly description: 'Collection uuid that owns the request.';
          };
          readonly requestUuid: {
            readonly type: 'string';
            readonly description: 'Stable request uuid for the saved request file to inspect.';
          };
          readonly depth: {
            readonly type: 'number';
            readonly description: 'Maximum number of commits to include in per-file history; defaults to 20.';
          };
        };
        readonly required: readonly ['collectionUuid', 'requestUuid'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly collectionUuid: z.ZodString;
    readonly requestUuid: z.ZodString;
    readonly depth: z.ZodOptional<z.ZodNumber>;
  };
};
//# sourceMappingURL=gitFileInfo.d.ts.map
