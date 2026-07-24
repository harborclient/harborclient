import { z } from 'zod';
/**
 * Arguments for the update_request_script tool.
 */
export interface UpdateRequestScriptToolArgs {
    /**
     * Saved request id from the @ reference, or the literal "active" for an unsaved tab.
     */
    requestId: number | 'active';
    /**
     * Script phase: pre-request or post-request.
     */
    phase: 'pre' | 'post';
    /**
     * 1-based index of the script in the phase array (matches @ref syntax).
     */
    scriptIndex: number;
    /**
     * JavaScript source to apply to the script.
     */
    code: string;
    /**
     * Whether to replace or append to existing inline script code; defaults to replace.
     */
    mode?: 'replace' | 'append';
}
/**
 * Updates a specific pre- or post-request script in the active editor request by 1-based index.
 *
 * @param {number | 'active'} requestId - Saved request id from the @ reference, or "active" when unsaved.
 * @param {'pre' | 'post'} phase - Script phase: pre-request or post-request.
 * @param {number} scriptIndex - 1-based index of the script in the phase array.
 * @param {string} code - JavaScript source to apply to the script.
 * @param {string} [mode] - How to apply code; defaults to replace.
 */
export declare const updateRequestScriptTool: {
    readonly name: "update_request_script";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "update_request_script";
            readonly description: "Updates a specific pre- or post-request script in the active editor request by 1-based index. Use when the user message contains @<request-id>.<pre|post>.<script-index> (for example @42.pre.3 or @active.post.1), optionally with #<start>.<end> character offsets into that script source to highlight the selected region. Only inline scripts can be edited; snippet-linked scripts must be reported to the user. Changes update the editor draft only until the user saves.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly requestId: {
                        readonly oneOf: readonly [{
                            readonly type: "number";
                        }, {
                            readonly type: "string";
                            readonly enum: readonly ["active"];
                        }];
                        readonly description: "Saved request id from the @ reference, or \"active\" when the tab is unsaved.";
                    };
                    readonly phase: {
                        readonly type: "string";
                        readonly enum: readonly ["pre", "post"];
                        readonly description: "Script phase: pre-request (pre) or post-request (post).";
                    };
                    readonly scriptIndex: {
                        readonly type: "number";
                        readonly description: "1-based index of the script in the phase array.";
                    };
                    readonly code: {
                        readonly type: "string";
                        readonly description: "JavaScript source to apply to the script.";
                    };
                    readonly mode: {
                        readonly type: "string";
                        readonly enum: readonly ["replace", "append"];
                        readonly description: "How to apply code; defaults to replace.";
                    };
                };
                readonly required: readonly ["requestId", "phase", "scriptIndex", "code"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly requestId: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"active">]>;
        readonly phase: z.ZodEnum<{
            pre: "pre";
            post: "post";
        }>;
        readonly scriptIndex: z.ZodNumber;
        readonly code: z.ZodString;
        readonly mode: z.ZodOptional<z.ZodEnum<{
            replace: "replace";
            append: "append";
        }>>;
    };
};
//# sourceMappingURL=updateRequestScript.d.ts.map