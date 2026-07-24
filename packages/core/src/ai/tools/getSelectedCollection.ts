import type { ITool } from './ITool';

/**
 * Returns the collection currently selected in the sidebar, or null when none is selected.
 */
export const getSelectedCollectionTool = {
  name: 'get_selected_collection',
  definition: {
    type: 'function',
    function: {
      name: 'get_selected_collection',
      description:
        'Returns the collection currently selected in the sidebar, or null when none is selected.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_selected_collection'>;
