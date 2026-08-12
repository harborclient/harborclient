import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments accepted by the renderer-owned `ask_user` pause tool.
 */
export interface AskUserToolArgs {
  /**
   * Question shown to the user before the turn resumes.
   */
  question: string;

  /**
   * Optional suggested answers the user may choose or replace with free text.
   */
  choices?: string[];
}

/**
 * Pauses the current agent turn so the user can provide missing information.
 */
export const askUserTool = {
  name: 'ask_user',
  definition: {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Pause the current turn and ask the user one focused question. Use this when required information, ambiguity, or a user decision prevents safe progress.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'A concise question that explains the decision or information needed.'
          },
          choices: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional concise suggested answers. The user may still provide free text.'
          }
        },
        required: ['question'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).optional()
  }
} as const satisfies ITool<'ask_user'>;
