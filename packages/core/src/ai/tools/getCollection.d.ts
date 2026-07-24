import { z } from 'zod';
/**
 * Returns one collection by uuid with full configuration.
 *
 * @param {string} uuid - Collection uuid from the @collection reference.
 */
export declare const getCollectionTool: {
  readonly name: 'get_collection';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'get_collection';
      readonly description: 'Returns one collection by uuid with full configuration (variables, headers, auth, scripts). Use when the user message contains @collection.<uuid>. Use the uuid only for this tool call; refer to the collection by its returned name in replies.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly uuid: {
            readonly type: 'string';
            readonly description: 'Collection uuid from the @collection reference.';
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
//# sourceMappingURL=getCollection.d.ts.map
