import { z } from 'zod';
/**
 * Returns one folder by uuid with variables, headers, auth, and scripts.
 *
 * @param {string} uuid - Folder uuid from the @folder reference.
 */
export declare const getFolderTool: {
  readonly name: 'get_folder';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'get_folder';
      readonly description: 'Returns one folder by uuid with variables, headers, auth, and scripts. Use when the user message contains @folder.<uuid>. Use the uuid only for this tool call; refer to the folder by its returned name in replies.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly uuid: {
            readonly type: 'string';
            readonly description: 'Folder uuid from the @folder reference.';
          };
        };
        readonly required: readonly ['uuid'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly uuid: z.ZodString;
  };
};
//# sourceMappingURL=getFolder.d.ts.map
