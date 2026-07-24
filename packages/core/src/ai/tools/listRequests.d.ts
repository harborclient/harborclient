import { z } from 'zod';
/**
 * Arguments for the list_requests tool.
 */
export interface ListRequestsToolArgs {
    /**
     * Collection id whose saved requests should be listed.
     */
    collectionId: number;
}
/**
 * Lists saved requests in a collection by id.
 *
 * @param {number} collectionId - Collection id to list requests for.
 */
export declare const listRequestsTool: {
    readonly name: "list_requests";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "list_requests";
            readonly description: "Lists saved requests in a collection by id.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionId: {
                        readonly type: "number";
                        readonly description: "Collection id to list requests for.";
                    };
                };
                readonly required: readonly ["collectionId"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionId: z.ZodNumber;
    };
};
//# sourceMappingURL=listRequests.d.ts.map