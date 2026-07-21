import type { ITool } from './ITool';

/**
 * Returns the saved request highlighted in the sidebar, or null when the tab is unsaved.
 */
export const getSidebarRequestTool = {
  name: 'get_sidebar_request',
  definition: {
    type: 'function',
    function: {
      name: 'get_sidebar_request',
      description:
        'Returns the saved request highlighted in the sidebar (from the active editor tab), or null when the tab is unsaved.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_sidebar_request'>;
