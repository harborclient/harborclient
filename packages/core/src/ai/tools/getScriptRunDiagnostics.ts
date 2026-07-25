import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the get_script_run_diagnostics tool.
 */
export interface GetScriptRunDiagnosticsToolArgs {
  /**
   * Optional script phase to filter diagnostics to.
   */
  phase?: 'pre' | 'post';

  /**
   * Optional 1-based script index within the phase to filter diagnostics to.
   */
  scriptIndex?: number;

  /**
   * Optional stable script id to filter diagnostics to.
   */
  scriptId?: string;
}

/**
 * Returns script errors, failing tests, and console logs from the latest send.
 *
 * @param {string} [phase] - Optional `pre` or `post` filter.
 * @param {number} [scriptIndex] - Optional 1-based script index within the phase.
 * @param {string} [scriptId] - Optional stable script id filter.
 */
export const getScriptRunDiagnosticsTool = {
  name: 'get_script_run_diagnostics',
  definition: {
    type: 'function',
    function: {
      name: 'get_script_run_diagnostics',
      description:
        'Returns script runtime diagnostics from the most recent matching console send entry: scriptError, structured scriptErrors (with mapped locations), failing tests (name, error, expected, actual, line, column, phase, scriptName), and console logs. Call this before diagnosing why a script failed, "is not a function", or still errors after a change. Optional phase/scriptIndex/scriptId narrow to one script slot.',
      parameters: {
        type: 'object',
        properties: {
          phase: {
            type: 'string',
            enum: ['pre', 'post'],
            description: 'Optional script phase filter.'
          },
          scriptIndex: {
            type: 'number',
            description: 'Optional 1-based script index within the phase.'
          },
          scriptId: {
            type: 'string',
            description: 'Optional stable script id filter.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    phase: z.enum(['pre', 'post']).optional(),
    scriptIndex: z.number().optional(),
    scriptId: z.string().optional()
  }
} as const satisfies ITool<'get_script_run_diagnostics'>;
