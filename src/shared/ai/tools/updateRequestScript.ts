import { z } from 'zod';
import type { ITool } from './ITool';

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
export const updateRequestScriptTool = {
  name: 'update_request_script',
  definition: {
    type: 'function',
    function: {
      name: 'update_request_script',
      description:
        'Updates a specific pre- or post-request script in the active editor request by 1-based index. Use when the user message contains @<request-id>.<pre|post>.<script-index> (for example @42.pre.3 or @active.post.1), optionally with #<start>.<end> character offsets into that script source to highlight the selected region. Only inline scripts can be edited; snippet-linked scripts must be reported to the user. Changes update the editor draft only until the user saves.',
      parameters: {
        type: 'object',
        properties: {
          requestId: {
            oneOf: [{ type: 'number' }, { type: 'string', enum: ['active'] }],
            description:
              'Saved request id from the @ reference, or "active" when the tab is unsaved.'
          },
          phase: {
            type: 'string',
            enum: ['pre', 'post'],
            description: 'Script phase: pre-request (pre) or post-request (post).'
          },
          scriptIndex: {
            type: 'number',
            description: '1-based index of the script in the phase array.'
          },
          code: {
            type: 'string',
            description: 'JavaScript source to apply to the script.'
          },
          mode: {
            type: 'string',
            enum: ['replace', 'append'],
            description: 'How to apply code; defaults to replace.'
          }
        },
        required: ['requestId', 'phase', 'scriptIndex', 'code'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    requestId: z.union([z.number(), z.literal('active')]),
    phase: z.enum(['pre', 'post']),
    scriptIndex: z.number(),
    code: z.string(),
    mode: z.enum(['replace', 'append']).optional()
  }
} as const satisfies ITool<'update_request_script'>;
