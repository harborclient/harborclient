import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the query_response_body tool.
 */
export interface QueryResponseBodyToolArgs {
  /**
   * JMESPath expression to evaluate against the JSON response body.
   */
  expression: string;

  /**
   * Maximum stringified result characters to return; defaults to 4000.
   */
  maxResultChars?: number;
}

/**
 * Evaluates a JMESPath expression against the JSON response body of the last active-tab response.
 *
 * @param {string} expression - JMESPath expression to evaluate against the JSON response body.
 * @param {number} [maxResultChars] - Maximum stringified result characters to return; defaults to 4000.
 */
export const queryResponseBodyTool = {
  name: 'query_response_body',
  definition: {
    type: 'function',
    function: {
      name: 'query_response_body',
      description:
        'Evaluates a JMESPath expression against the JSON response body of the last HTTP response for the active tab and returns a small structured result. Prefer this for counting items, extracting fields, or checking values without loading the full body. Examples: length(@), length(data.items), data.users[*].id, keys(@).',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'JMESPath expression to evaluate against the JSON response body.'
          },
          maxResultChars: {
            type: 'number',
            description: 'Maximum stringified result characters to return; defaults to 4000.'
          }
        },
        required: ['expression'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    expression: z.string(),
    maxResultChars: z.number().optional()
  }
} as const satisfies ITool<'query_response_body'>;
