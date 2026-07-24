/**
 * Lists all collections with configuration, storage metadata, and selection state.
 */
export declare const listCollectionsTool: {
    readonly name: "list_collections";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "list_collections";
            readonly description: "Lists all collections with configuration (variables, headers, auth, scripts), storage metadata (uuid, storageType, isGitBacked, connectionId), and whether each is selected.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
};
//# sourceMappingURL=listCollections.d.ts.map