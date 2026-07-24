/**
 * Returns summary info for the request open in the editor pane.
 */
export declare const getActiveRequestTool: {
    readonly name: "get_active_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_request";
            readonly description: "Returns summary info for the request open in the editor pane (tab id, method, url, dirty state).";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
};
//# sourceMappingURL=getActiveRequest.d.ts.map