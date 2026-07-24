import type { ITool } from './ITool';

/**
 * Returns summary info for the active footer terminal tab, or an error when none is selected.
 */
export const getActiveTerminalTool = {
  name: 'get_active_terminal',
  definition: {
    type: 'function',
    function: {
      name: 'get_active_terminal',
      description:
        'Returns summary info for the active footer terminal tab (id, title, 1-based tab index, total output line count, host operating system metadata), or an error when no terminal tab is selected.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_active_terminal'>;
