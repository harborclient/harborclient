import { z } from 'zod';
import type { ITool } from './ITool';

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
export const setActiveEnvironmentTool = {
  name: 'set_active_environment',
  definition: {
    type: 'function',
    function: {
      name: 'set_active_environment',
      description:
        'Sets the global active environment by id or name. Pass environmentId null to clear the active environment.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: ['number', 'null'],
            description: 'Environment id to activate, or null for no environment.'
          },
          name: {
            type: 'string',
            description: 'Environment name to resolve when environmentId is omitted.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    environmentId: z.union([z.number(), z.null()]).optional(),
    name: z.string().optional()
  }
} as const satisfies ITool<'set_active_environment'>;
