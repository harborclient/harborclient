import { z } from 'zod';
/**
 * Arguments for the create_folder tool.
 */
export interface CreateFolderToolArgs {
  /**
   * Collection id that will own the new folder.
   */
  collectionId: number;
  /**
   * Display name for the new folder.
   */
  name: string;
}
/**
 * Creates a folder inside an existing collection.
 *
 * @param {number} collectionId - Collection id that will own the new folder.
 * @param {string} name - Display name for the new folder.
 */
export declare const createFolderTool: {
  readonly name: 'create_folder';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'create_folder';
      readonly description: 'Creates a folder inside an existing collection. Persists immediately. Use list_collections or get_collection first when you need the collection id.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly collectionId: {
            readonly type: 'number';
            readonly description: 'Collection id that will own the new folder.';
          };
          readonly name: {
            readonly type: 'string';
            readonly description: 'Display name for the new folder.';
          };
        };
        readonly required: readonly ['collectionId', 'name'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly collectionId: z.ZodNumber;
    readonly name: z.ZodString;
  };
};
//# sourceMappingURL=createFolder.d.ts.map
