import { z } from 'zod';
/**
 * Arguments for the get_active_terminal_lines tool.
 */
export interface GetActiveTerminalLinesToolArgs {
  /**
   * 1-based first line to read (inclusive).
   */
  startLine: number;
  /**
   * 1-based last line to read (inclusive).
   */
  endLine: number;
}
/**
 * Returns a 1-based inclusive line range from the active footer terminal output as plain text.
 *
 * @param {number} startLine - 1-based first line to read (inclusive).
 * @param {number} endLine - 1-based last line to read (inclusive).
 */
export declare const getActiveTerminalLinesTool: {
  readonly name: 'get_active_terminal_lines';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'get_active_terminal_lines';
      readonly description: 'Returns a 1-based inclusive line range from the active footer terminal output as plain text. Call get_active_terminal first to see totalLines before requesting a range. Lines are clamped to the available buffer.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly startLine: {
            readonly type: 'number';
            readonly description: '1-based first line to read (inclusive).';
          };
          readonly endLine: {
            readonly type: 'number';
            readonly description: '1-based last line to read (inclusive).';
          };
        };
        readonly required: readonly ['startLine', 'endLine'];
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly startLine: z.ZodNumber;
    readonly endLine: z.ZodNumber;
  };
};
//# sourceMappingURL=getActiveTerminalLines.d.ts.map
