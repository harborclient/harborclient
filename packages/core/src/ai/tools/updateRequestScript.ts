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
   * JavaScript source to apply.
   *
   * For `replace`, this must be the full script. For `replace_range`, only the
   * replacement text for `[startOffset, endOffset)`. For `append`, text to add.
   */
  code: string;

  /**
   * How to apply code; defaults to replace (full script overwrite).
   */
  mode?: 'replace' | 'append' | 'replace_range';

  /**
   * Inclusive 0-based start offset for `replace_range` (from `@` `#start.end`).
   */
  startOffset?: number;

  /**
   * Exclusive 0-based end offset for `replace_range` (from `@` `#start.end`).
   */
  endOffset?: number;
}

/**
 * Updates a specific pre- or post-request script in the active editor request by 1-based index.
 *
 * @param {number | 'active'} requestId - Saved request id from the @ reference, or "active" when unsaved.
 * @param {'pre' | 'post'} phase - Script phase: pre-request or post-request.
 * @param {number} scriptIndex - 1-based index of the script in the phase array.
 * @param {string} code - JavaScript source to apply (full script, append text, or range replacement).
 * @param {string} [mode] - How to apply code; defaults to replace.
 * @param {number} [startOffset] - Inclusive start offset when mode is replace_range.
 * @param {number} [endOffset] - Exclusive end offset when mode is replace_range.
 */
export const updateRequestScriptTool = {
  name: 'update_request_script',
  definition: {
    type: 'function',
    function: {
      name: 'update_request_script',
      description:
        'Updates a specific pre- or post-request script in the active editor request by 1-based index. Use when the user message contains @<request-id>.<pre|post>.<script-index> (for example @42.pre.3 or @active.post.1), optionally with #<start>.<end> character offsets into that script source. Modes: replace (default) — code must be the FULL script source; preserve all unchanged lines. replace_range — code is only the replacement for [startOffset, endOffset); requires startOffset and endOffset from the @ tag; use this to fix a selected region without deleting surrounding tests/comments. append — add code after existing content. Only inline scripts can be edited; snippet-linked scripts must be reported to the user. Changes update the editor draft only until the user saves.',
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
            description:
              'JavaScript to apply. For replace: full script. For replace_range: replacement text only. For append: text to append.'
          },
          mode: {
            type: 'string',
            enum: ['replace', 'append', 'replace_range'],
            description:
              'How to apply code; defaults to replace. Use replace_range with startOffset/endOffset when editing a selected @ region.'
          },
          startOffset: {
            type: 'number',
            description:
              'Inclusive 0-based character offset into the script for replace_range (from @ #start.end).'
          },
          endOffset: {
            type: 'number',
            description:
              'Exclusive 0-based character offset into the script for replace_range (from @ #start.end).'
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
    mode: z.enum(['replace', 'append', 'replace_range']).optional(),
    startOffset: z.number().optional(),
    endOffset: z.number().optional()
  }
} as const satisfies ITool<'update_request_script'>;
