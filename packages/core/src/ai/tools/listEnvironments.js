/**
 * Lists all environments with variables and which one is active.
 */
export const listEnvironmentsTool = {
    name: 'list_environments',
    definition: {
        type: 'function',
        function: {
            name: 'list_environments',
            description: 'Lists all environments with variables and which one is active.',
            parameters: { type: 'object', properties: {}, additionalProperties: false }
        }
    },
    inputShape: {}
};
//# sourceMappingURL=listEnvironments.js.map