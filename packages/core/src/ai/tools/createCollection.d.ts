import { z } from 'zod';
import type { CreateCollectionRequestRow } from './types';
/**
 * Arguments for the create_collection tool.
 */
export interface CreateCollectionToolArgs {
  /**
   * Display name for the new collection.
   */
  name: string;
  /**
   * Saved requests to create inside the collection; defaults to an empty collection.
   */
  requests?: CreateCollectionRequestRow[];
}
/**
 * Creates a new collection and optionally saves requests inside it.
 *
 * @param {string} name - Display name for the new collection.
 * @param {object[]} [requests] - Saved requests to create inside the collection.
 */
export declare const createCollectionTool: {
  readonly name: 'create_collection';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'create_collection';
      readonly description: 'Creates a new collection and optionally saves requests inside it. Persists immediately to storage and selects the collection in the sidebar. Use when the user asks to create a new collection or scaffold API requests in a new collection. Each request row may include an optional folder name; folders are created automatically.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly name: {
            readonly type: 'string';
            readonly description: 'Display name for the new collection.';
          };
          readonly requests: {
            readonly type: 'array';
            readonly items: {
              readonly type: 'object';
              readonly properties: {
                readonly name: {
                  readonly type: 'string';
                  readonly description: 'Display name for the saved request.';
                };
                readonly method: {
                  readonly type: 'string';
                  readonly description: 'HTTP method (for example GET or POST).';
                };
                readonly url: {
                  readonly type: 'string';
                  readonly description: 'Request URL.';
                };
                readonly folder: {
                  readonly type: 'string';
                  readonly description: 'Optional folder name within the new collection.';
                };
                readonly headers: {
                  readonly description: 'Optional headers as a flat object or key-value rows.';
                  readonly oneOf: readonly [
                    {
                      readonly type: 'object';
                      readonly additionalProperties: {
                        readonly type: 'string';
                      };
                    },
                    {
                      readonly type: 'array';
                      readonly items: {
                        readonly type: 'object';
                        readonly properties: {
                          readonly key: {
                            readonly type: 'string';
                            readonly description: 'Header, param, or cookie name.';
                          };
                          readonly value: {
                            readonly type: 'string';
                            readonly description: 'Header, param, or cookie value.';
                          };
                          readonly enabled: {
                            readonly type: 'boolean';
                            readonly description: 'Whether the row is active; defaults to true when omitted.';
                          };
                        };
                        readonly required: readonly ['key', 'value'];
                        readonly additionalProperties: false;
                      };
                    }
                  ];
                };
                readonly params: {
                  readonly type: 'array';
                  readonly items: {
                    readonly type: 'object';
                    readonly properties: {
                      readonly key: {
                        readonly type: 'string';
                        readonly description: 'Header, param, or cookie name.';
                      };
                      readonly value: {
                        readonly type: 'string';
                        readonly description: 'Header, param, or cookie value.';
                      };
                      readonly enabled: {
                        readonly type: 'boolean';
                        readonly description: 'Whether the row is active; defaults to true when omitted.';
                      };
                    };
                    readonly required: readonly ['key', 'value'];
                    readonly additionalProperties: false;
                  };
                  readonly description: 'Optional query params.';
                };
                readonly body: {
                  readonly type: 'string';
                  readonly description: 'Optional request body content.';
                };
                readonly bodyType: {
                  readonly type: 'string';
                  readonly enum: readonly ['none', 'json', 'text', 'multipart', 'urlencoded'];
                  readonly description: 'Optional body content type.';
                };
                readonly comment: {
                  readonly type: 'string';
                  readonly description: 'Optional free-form notes for the request.';
                };
              };
              readonly required: readonly ['name', 'method', 'url'];
              readonly additionalProperties: false;
            };
            readonly description: 'Saved requests to create inside the collection.';
          };
        };
        readonly required: readonly ['name'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly name: z.ZodString;
    readonly requests: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            name: z.ZodString;
            method: z.ZodString;
            url: z.ZodString;
            folder: z.ZodOptional<z.ZodString>;
            headers: z.ZodOptional<
              z.ZodUnion<
                readonly [
                  z.ZodRecord<z.ZodString, z.ZodString>,
                  z.ZodArray<
                    z.ZodObject<
                      {
                        key: z.ZodString;
                        value: z.ZodString;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                      },
                      z.core.$strip
                    >
                  >
                ]
              >
            >;
            params: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    key: z.ZodString;
                    value: z.ZodString;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                  },
                  z.core.$strip
                >
              >
            >;
            body: z.ZodOptional<z.ZodString>;
            bodyType: z.ZodOptional<
              z.ZodEnum<{
                none: 'none';
                text: 'text';
                json: 'json';
                multipart: 'multipart';
                urlencoded: 'urlencoded';
              }>
            >;
            comment: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >
      >
    >;
  };
};
//# sourceMappingURL=createCollection.d.ts.map
