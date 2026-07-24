/**
 * Returns summary info for the active footer terminal tab, or an error when none is selected.
 */
export declare const getActiveTerminalTool: {
    readonly name: "get_active_terminal";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_terminal";
            readonly description: "Returns summary info for the active footer terminal tab (id, title, 1-based tab index, total output line count, host operating system metadata), or an error when no terminal tab is selected.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
};
//# sourceMappingURL=getActiveTerminal.d.ts.map