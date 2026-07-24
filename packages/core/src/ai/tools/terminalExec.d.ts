import { z } from 'zod';
/**
 * Arguments for the terminal_exec tool.
 */
export interface TerminalExecToolArgs {
    /**
     * Raw input to send to the active terminal shell stdin; include a newline to run a command.
     */
    input: string;
}
/**
 * Sends raw input to the active footer terminal shell stdin.
 *
 * @param {string} input - Raw bytes to write to the shell stdin; include a newline to run a command.
 */
export declare const terminalExecTool: {
    readonly name: "terminal_exec";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "terminal_exec";
            readonly description: "Sends raw input to the active footer terminal shell stdin (for example \"cd foo\\n\" to change directory or \"npm test\\n\" to run a command). The terminal panel must be open. Include a trailing newline when executing a command. Use get_active_terminal_lines afterward to read command output. Never use for destructive or irreversible commands (rm, rmdir, dd, git reset --hard, sudo, shutdown, and similar).";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly input: {
                        readonly type: "string";
                        readonly description: "Raw bytes to write to the shell stdin; include \\n at the end when running a command.";
                    };
                };
                readonly required: readonly ["input"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly input: z.ZodString;
    };
};
//# sourceMappingURL=terminalExec.d.ts.map