import { z } from 'zod';
/**
 * Arguments for the query_response_body tool.
 */
export interface QueryResponseBodyToolArgs {
    /**
     * JMESPath expression to evaluate against the JSON response body.
     */
    expression: string;
    /**
     * Maximum stringified result characters to return; defaults to 4000.
     */
    maxResultChars?: number;
}
/**
 * Evaluates a JMESPath expression against the JSON response body of the last active-tab response.
 *
 * @param {string} expression - JMESPath expression to evaluate against the JSON response body.
 * @param {number} [maxResultChars] - Maximum stringified result characters to return; defaults to 4000.
 */
export declare const queryResponseBodyTool: {
    readonly name: "query_response_body";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "query_response_body";
            readonly description: "Evaluates a JMESPath expression against the JSON response body of the last HTTP response for the active tab and returns a small structured result. Prefer this for counting items, extracting fields, or checking values without loading the full body. Examples: length(@), length(data.items), data.users[*].id, keys(@).";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly expression: {
                        readonly type: "string";
                        readonly description: "JMESPath expression to evaluate against the JSON response body.";
                    };
                    readonly maxResultChars: {
                        readonly type: "number";
                        readonly description: "Maximum stringified result characters to return; defaults to 4000.";
                    };
                };
                readonly required: readonly ["expression"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly expression: z.ZodString;
        readonly maxResultChars: z.ZodOptional<z.ZodNumber>;
    };
};
//# sourceMappingURL=queryResponseBody.d.ts.map