import type { ITool } from './ITool';

/**
 * Returns the authoritative HarborClient `hc` sandbox API reference.
 */
export const getScriptingApiReferenceTool = {
  name: 'get_scripting_api_reference',
  definition: {
    type: 'function',
    function: {
      name: 'get_scripting_api_reference',
      description:
        'Returns the authoritative HarborClient hc sandbox API reference for pre/post scripts (hc.test, hc.expect, hc.response, Postman mapping). Call this before asserting scripting syntax or semantics; do not infer from Chai, Postman, or other API clients.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  inputShape: {}
} as const satisfies ITool<'get_scripting_api_reference'>;
