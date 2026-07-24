import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the get_markdown_document tool.
 */
export interface GetMarkdownDocumentToolArgs {
  /**
   * UUID of a collection markdown document or saved request whose comment should be fetched.
   */
  uuid: string;
}

/**
 * Returns one collection markdown document or saved request comment by uuid.
 *
 * @param {string} uuid - Markdown document or request uuid from the @markdown reference.
 */
export const getMarkdownDocumentTool = {
  name: 'get_markdown_document',
  definition: {
    type: 'function',
    function: {
      name: 'get_markdown_document',
      description:
        'Returns one collection markdown document or saved request comment by uuid with name and markdown content. Use when the user message contains @markdown.<uuid>. Prefer the open editor tab content when the document is being edited. Use the uuid only for this tool call; refer to the document by its returned name in replies.',
      parameters: {
        type: 'object',
        properties: {
          uuid: {
            type: 'string',
            description: 'Markdown document or request uuid from the @markdown reference.'
          }
        },
        required: ['uuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    uuid: z.string()
  }
} as const satisfies ITool<'get_markdown_document'>;
