import { z } from 'zod';
/**
 * Arguments for the get_active_response tool.
 */
export interface GetActiveResponseToolArgs {
    /**
     * Maximum response body characters to return; defaults to 16384.
     */
    maxBodyChars?: number;
}
/**
 * Returns the last HTTP response for the active tab with a capped body, or null.
 *
 * @param {number} [maxBodyChars] - Maximum response body characters to return; defaults to 16384.
 */
export declare const getActiveResponseTool: {
    readonly name: "get_active_response";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_response";
            readonly description: "Returns the last HTTP response for the active tab with a capped body (status, headers, body, tests), or null. Use get_active_response_summary first; pass maxBodyChars only when more body text is needed.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly maxBodyChars: {
                        readonly type: "number";
                        readonly description: "Maximum response body characters to return; defaults to 16384.";
                    };
                };
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly maxBodyChars: z.ZodOptional<z.ZodNumber>;
    };
};
//# sourceMappingURL=getActiveResponse.d.ts.map