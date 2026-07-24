import { z } from 'zod';
/**
 * Arguments for the get_markdown_document tool.
 */
export interface GetMarkdownDocumentToolArgs {
    /**
     * UUID of a collection markdown document or saved request whose comment should be fetched.
     */
    uuid: string;
}
/**
 * Returns one collection markdown document or saved request comment by uuid.
 *
 * @param {string} uuid - Markdown document or request uuid from the @markdown reference.
 */
export declare const getMarkdownDocumentTool: {
    readonly name: "get_markdown_document";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_markdown_document";
            readonly description: "Returns one collection markdown document or saved request comment by uuid with name and markdown content. Use when the user message contains @markdown.<uuid>. Prefer the open editor tab content when the document is being edited. Use the uuid only for this tool call; refer to the document by its returned name in replies.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly uuid: {
                        readonly type: "string";
                        readonly description: "Markdown document or request uuid from the @markdown reference.";
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
//# sourceMappingURL=getMarkdownDocument.d.ts.map