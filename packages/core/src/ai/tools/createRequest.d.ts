import { z } from 'zod';
import type { CreateSavedRequestKeyValue } from './types';
/**
 * Arguments for the create_request tool.
 */
export interface CreateRequestToolArgs {
    /**
     * Collection id that will own the new saved request.
     */
    collectionId: number;
    /**
     * Display name for the saved request.
     */
    name: string;
    /**
     * HTTP method for the request.
     */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    /**
     * Request URL.
     */
    url: string;
    /**
     * Folder id when the request belongs to a folder; omit or null for collection root.
     */
    folderId?: number | null;
    /**
     * Folder name to resolve within the collection when folderId is omitted.
     */
    folderName?: string;
    /**
     * Optional request headers as a flat object or key-value rows.
     */
    headers?: Record<string, string> | CreateSavedRequestKeyValue[];
    /**
     * Optional query params as key-value rows.
     */
    params?: CreateSavedRequestKeyValue[];
    /**
     * Optional request body content.
     */
    body?: string;
    /**
     * Optional body content type.
     */
    bodyType?: 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';
    /**
     * Optional free-form notes for the request.
     */
    comment?: string;
}
/**
 * Creates a saved request in an existing collection or folder.
 *
 * @param {number} collectionId - Collection id that will own the new saved request.
 * @param {string} name - Display name for the saved request.
 * @param {string} method - HTTP method for the request.
 * @param {string} url - Request URL.
 * @param {number | null} [folderId] - Folder id when the request belongs to a folder.
 * @param {string} [folderName] - Folder name to resolve when folderId is omitted.
 * @param {object | object[]} [headers] - Optional headers as a flat object or key-value rows.
 * @param {object[]} [params] - Optional query params.
 * @param {string} [body] - Optional request body content.
 * @param {string} [bodyType] - Optional body content type.
 * @param {string} [comment] - Optional free-form notes for the request.
 */
export declare const createRequestTool: {
    readonly name: "create_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "create_request";
            readonly description: "Creates a saved request in an existing collection or folder. Persists immediately without opening an editor tab. Use create_folder first when the target folder does not exist yet.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionId: {
                        readonly type: "number";
                        readonly description: "Collection id that will own the new saved request.";
                    };
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Display name for the saved request.";
                    };
                    readonly method: {
                        readonly type: "string";
                        readonly enum: readonly ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
                        readonly description: "HTTP method for the request.";
                    };
                    readonly url: {
                        readonly type: "string";
                        readonly description: "Request URL.";
                    };
                    readonly folderId: {
                        readonly type: readonly ["number", "null"];
                        readonly description: "Folder id when the request belongs to a folder; omit for collection root.";
                    };
                    readonly folderName: {
                        readonly type: "string";
                        readonly description: "Folder name to resolve within the collection when folderId is omitted.";
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
                readonly required: readonly ["collectionId", "name", "method", "url"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionId: z.ZodNumber;
        readonly name: z.ZodString;
        readonly method: z.ZodEnum<{
            GET: "GET";
            POST: "POST";
            PUT: "PUT";
            PATCH: "PATCH";
            DELETE: "DELETE";
            HEAD: "HEAD";
            OPTIONS: "OPTIONS";
        }>;
        readonly url: z.ZodString;
        readonly folderId: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>>;
        readonly folderName: z.ZodOptional<z.ZodString>;
        readonly headers: z.ZodOptional<z.ZodUnion<readonly [z.ZodRecord<z.ZodString, z.ZodString>, z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>]>>;
        readonly params: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        readonly body: z.ZodOptional<z.ZodString>;
        readonly bodyType: z.ZodOptional<z.ZodEnum<{
            none: "none";
            text: "text";
            json: "json";
            multipart: "multipart";
            urlencoded: "urlencoded";
        }>>;
        readonly comment: z.ZodOptional<z.ZodString>;
    };
};
//# sourceMappingURL=createRequest.d.ts.map