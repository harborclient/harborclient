import { z } from 'zod';
/**
 * Arguments for the set_active_environment tool.
 */
export interface SetActiveEnvironmentToolArgs {
    /**
     * Environment id to activate, or null for no environment.
     */
    environmentId?: number | null;
    /**
     * Environment name to resolve when id is omitted.
     */
    name?: string;
}
/**
 * Sets the global active environment by id or name.
 *
 * @param {number | null} [environmentId] - Environment id to activate, or null for no environment.
 * @param {string} [name] - Environment name to resolve when environmentId is omitted.
 */
export declare const setActiveEnvironmentTool: {
    readonly name: "set_active_environment";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "set_active_environment";
            readonly description: "Sets the global active environment by id or name. Pass environmentId null to clear the active environment.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly environmentId: {
                        readonly type: readonly ["number", "null"];
                        readonly description: "Environment id to activate, or null for no environment.";
                    };
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Environment name to resolve when environmentId is omitted.";
                    };
                };
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly environmentId: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>>;
        readonly name: z.ZodOptional<z.ZodString>;
    };
};
//# sourceMappingURL=setActiveEnvironment.d.ts.map