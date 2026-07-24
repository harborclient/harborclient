import { z } from 'zod';
/**
 * Returns one saved request by uuid with method, url, headers, params, body, auth, and scripts.
 *
 * @param {string} uuid - Saved request uuid from the @request reference.
 */
export declare const getRequestTool: {
    readonly name: "get_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_request";
            readonly description: "Returns one saved request by uuid with method, url, headers, params, body, auth, and scripts. Use when the user message contains @request.<uuid>. Use the uuid only for this tool call; refer to the request by its returned name in replies.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly uuid: {
                        readonly type: "string";
                        readonly description: "Saved request uuid from the @request reference.";
                    };
                };
                readonly required: readonly ["uuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly uuid: z.ZodString;
    };
};
//# sourceMappingURL=getRequest.d.ts.map