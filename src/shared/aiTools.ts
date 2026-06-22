import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Names of tools exposed to the AI chat agent.
 */
export const AI_TOOL_NAMES = [
  'get_selected_collection',
  'list_collections',
  'list_requests',
  'list_environments',
  'get_sidebar_request',
  'get_active_request',
  'get_active_request_details',
  'get_active_response_summary',
  'get_active_response',
  'query_response_body',
  'send_active_request',
  'set_active_environment'
] as const;

/**
 * Union of supported AI agent tool names.
 */
export type AiToolName = (typeof AI_TOOL_NAMES)[number];

/**
 * Arguments for the list_requests tool.
 */
export interface ListRequestsToolArgs {
  /**
   * Collection id whose saved requests should be listed.
   */
  collectionId: number;
}

/**
 * Arguments for the get_active_response tool.
 */
export interface GetActiveResponseToolArgs {
  /**
   * Maximum response body characters to return; defaults to 16384.
   */
  maxBodyChars?: number;
}

/**
 * Arguments for the send_active_request tool.
 */
export interface SendActiveRequestToolArgs {
  /**
   * When provided and greater than zero, includes a capped response body; otherwise only a summary preview is returned.
   */
  maxBodyChars?: number;
}

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
 * OpenAI tool definitions for querying and controlling Harbor app state.
 */
export const AI_TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_selected_collection',
      description:
        'Returns the collection currently selected in the sidebar, or null when none is selected.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_collections',
      description:
        'Lists all collections with configuration (variables, headers, auth, scripts) and whether each is selected.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_requests',
      description: 'Lists saved requests in a collection by id.',
      parameters: {
        type: 'object',
        properties: {
          collectionId: { type: 'number', description: 'Collection id to list requests for.' }
        },
        required: ['collectionId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_environments',
      description: 'Lists all environments with variables and which one is active.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_sidebar_request',
      description:
        'Returns the saved request highlighted in the sidebar (from the active editor tab), or null when the tab is unsaved.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_active_request',
      description:
        'Returns summary info for the request open in the editor pane (tab id, method, url, dirty state).',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_active_request_details',
      description:
        'Returns the full draft of the active editor request (headers, params, body, auth, scripts).',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_active_response_summary',
      description:
        'Returns a compact summary of the last HTTP response for the active tab (status, headers, short body preview, tests), or null. Prefer this before fetching the full body.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_active_response',
      description:
        'Returns the last HTTP response for the active tab with a capped body (status, headers, body, tests), or null. Use get_active_response_summary first; pass maxBodyChars only when more body text is needed.',
      parameters: {
        type: 'object',
        properties: {
          maxBodyChars: {
            type: 'number',
            description: 'Maximum response body characters to return; defaults to 16384.'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
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
  {
    type: 'function',
    function: {
      name: 'send_active_request',
      description:
        'Sends the HTTP request in the active editor tab (equivalent to clicking Send). Returns a compact response summary by default (status, headers, short body preview, tests). Pass maxBodyChars only when you need a capped full body in the same turn; otherwise call get_active_response afterward.',
      parameters: {
        type: 'object',
        properties: {
          maxBodyChars: {
            type: 'number',
            description:
              'Optional. When provided and greater than zero, includes a capped response body; otherwise only a summary preview is returned.'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
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
  }
];

/**
 * System prompt instructing the agent when and how to use Harbor tools.
 */
export const AI_SYSTEM_PROMPT = `You are an assistant embedded in Harbor, a desktop HTTP API client (similar to Postman).

You can inspect live app state and perform limited actions using the provided tools. Rules:

1. Before answering questions about collections, environments, requests, or responses, call the relevant tool(s). Never invent URLs, headers, bodies, or test results.
2. Use get_selected_collection and list_collections to understand the user's collections.
3. Use list_requests when you need saved requests in a specific collection.
4. Use list_environments before discussing variables or which environment is active.
5. Use get_active_request and get_active_request_details for the request open in the editor. For the last response, call get_active_response_summary first; only call get_active_response (with an optional maxBodyChars limit) when you need more body text than the preview provides.
6. For structured questions about a JSON response body (counting array items, extracting fields, checking values), prefer query_response_body with a JMESPath expression (for example length(@), length(data.items), data.users[*].id). Only fetch the full body with get_active_response when the response is not JSON or you need raw text.
7. Use get_sidebar_request to see which saved request is highlighted in the sidebar (null if the editor tab is unsaved).
8. Only call send_active_request when the user explicitly asks to send, run, or execute the active request. It returns a compact response summary by default; call get_active_response (with maxBodyChars when needed) or query_response_body if you need more detail from the response.
9. Only call set_active_environment when the user explicitly asks to switch or clear the active environment.
10. After tool calls, summarize results clearly for the user. Do not paste large response bodies into your reply; refer to status, headers, preview, query results, and tests instead.`;
