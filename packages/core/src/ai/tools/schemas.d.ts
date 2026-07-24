import { z } from 'zod';
/**
 * JSON schema for key-value rows in update_active_request and related tool arguments.
 */
export declare const AI_KEY_VALUE_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly key: {
            readonly type: "string";
            readonly description: "Header, param, or cookie name.";
        };
        readonly value: {
            readonly type: "string";
            readonly description: "Header, param, or cookie value.";
        };
        readonly enabled: {
            readonly type: "boolean";
            readonly description: "Whether the row is active; defaults to true when omitted.";
        };
    };
    readonly required: readonly ["key", "value"];
    readonly additionalProperties: false;
};
/**
 * JSON schema for saved request rows in create_collection tool arguments.
 */
export declare const CREATE_COLLECTION_REQUEST_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly name: {
            readonly type: "string";
            readonly description: "Display name for the saved request.";
        };
        readonly method: {
            readonly type: "string";
            readonly description: "HTTP method (for example GET or POST).";
        };
        readonly url: {
            readonly type: "string";
            readonly description: "Request URL.";
        };
        readonly folder: {
            readonly type: "string";
            readonly description: "Optional folder name within the new collection.";
        };
        readonly headers: {
            readonly description: "Optional headers as a flat object or key-value rows.";
            readonly oneOf: readonly [{
                readonly type: "object";
                readonly additionalProperties: {
                    readonly type: "string";
                };
            }, {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly key: {
                            readonly type: "string";
                            readonly description: "Header, param, or cookie name.";
                        };
                        readonly value: {
                            readonly type: "string";
                            readonly description: "Header, param, or cookie value.";
                        };
                        readonly enabled: {
                            readonly type: "boolean";
                            readonly description: "Whether the row is active; defaults to true when omitted.";
                        };
                    };
                    readonly required: readonly ["key", "value"];
                    readonly additionalProperties: false;
                };
            }];
        };
        readonly params: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly key: {
                        readonly type: "string";
                        readonly description: "Header, param, or cookie name.";
                    };
                    readonly value: {
                        readonly type: "string";
                        readonly description: "Header, param, or cookie value.";
                    };
                    readonly enabled: {
                        readonly type: "boolean";
                        readonly description: "Whether the row is active; defaults to true when omitted.";
                    };
                };
                readonly required: readonly ["key", "value"];
                readonly additionalProperties: false;
            };
            readonly description: "Optional query params.";
        };
        readonly body: {
            readonly type: "string";
            readonly description: "Optional request body content.";
        };
        readonly bodyType: {
            readonly type: "string";
            readonly enum: readonly ["none", "json", "text", "multipart", "urlencoded"];
            readonly description: "Optional body content type.";
        };
        readonly comment: {
            readonly type: "string";
            readonly description: "Optional free-form notes for the request.";
        };
    };
    readonly required: readonly ["name", "method", "url"];
    readonly additionalProperties: false;
};
/**
 * Zod raw shape for Harbor AI key-value rows in MCP tool arguments.
 */
export declare const aiKeyValueShape: {
    readonly key: z.ZodString;
    readonly value: z.ZodString;
    readonly enabled: z.ZodOptional<z.ZodBoolean>;
};
/**
 * Zod schema for saved request rows in create_collection tool arguments.
 */
export declare const createCollectionRequestRow: z.ZodObject<{
    name: z.ZodString;
    method: z.ZodString;
    url: z.ZodString;
    folder: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodUnion<readonly [z.ZodRecord<z.ZodString, z.ZodString>, z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>]>>;
    params: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    body: z.ZodOptional<z.ZodString>;
    bodyType: z.ZodOptional<z.ZodEnum<{
        none: "none";
        text: "text";
        json: "json";
        multipart: "multipart";
        urlencoded: "urlencoded";
    }>>;
    comment: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=schemas.d.ts.map