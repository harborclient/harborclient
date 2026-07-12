import { z } from 'zod';
import { AI_TOOL_NAMES, type AiToolName } from '#/shared/ai/tools';

/**
 * Zod raw shape for Harbor AI key-value rows in MCP tool arguments.
 */
const aiKeyValueShape = {
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().optional()
} as const;

/**
 * Zod schema for saved request rows in create_collection tool arguments.
 */
const createCollectionRequestRow = z.object({
  name: z.string(),
  method: z.string(),
  url: z.string(),
  folder: z.string().optional(),
  headers: z
    .union([z.record(z.string(), z.string()), z.array(z.object(aiKeyValueShape))])
    .optional(),
  params: z.array(z.object(aiKeyValueShape)).optional(),
  body: z.string().optional(),
  bodyType: z.enum(['none', 'json', 'text', 'multipart', 'urlencoded']).optional(),
  comment: z.string().optional()
});

/**
 * Zod raw shapes for Harbor AI tools, used when registering tools on the MCP server.
 */
const AI_TOOL_INPUT_SHAPES: Record<AiToolName, Record<string, z.ZodType>> = {
  get_selected_collection: {},
  list_collections: {},
  get_collection: {
    uuid: z.string()
  },
  list_requests: {
    collectionId: z.number()
  },
  get_folder: {
    uuid: z.string()
  },
  get_request: {
    uuid: z.string()
  },
  list_environments: {},
  get_sidebar_request: {},
  get_active_request: {},
  get_active_request_details: {},
  get_active_response_summary: {},
  get_active_response: {
    maxBodyChars: z.number().optional()
  },
  query_response_body: {
    expression: z.string(),
    maxResultChars: z.number().optional()
  },
  send_active_request: {
    maxBodyChars: z.number().optional()
  },
  set_active_environment: {
    environmentId: z.union([z.number(), z.null()]).optional(),
    name: z.string().optional()
  },
  update_active_request: {
    name: z.string().optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).optional(),
    url: z.string().optional(),
    body: z.string().optional(),
    body_type: z.enum(['none', 'json', 'text', 'multipart', 'urlencoded']).optional(),
    pre_request_script: z.string().optional(),
    pre_request_script_mode: z.enum(['replace', 'append']).optional(),
    post_request_script: z.string().optional(),
    post_request_script_mode: z.enum(['replace', 'append']).optional(),
    comment: z.string().optional(),
    headers: z.array(z.object(aiKeyValueShape)).optional(),
    headers_mode: z.enum(['merge', 'replace']).optional(),
    params: z.array(z.object(aiKeyValueShape)).optional(),
    params_mode: z.enum(['merge', 'replace']).optional(),
    auth: z
      .object({
        type: z.enum(['none', 'basic', 'bearer']).optional(),
        basic: z
          .object({
            username: z.string().optional(),
            password: z.string().optional()
          })
          .optional(),
        bearer: z
          .object({
            token: z.string().optional()
          })
          .optional()
      })
      .optional(),
    cookies: z.array(z.object(aiKeyValueShape)).optional(),
    cookies_mode: z.enum(['merge', 'replace']).optional()
  },
  update_request_script: {
    requestId: z.union([z.number(), z.literal('active')]),
    phase: z.enum(['pre', 'post']),
    scriptIndex: z.number(),
    code: z.string(),
    mode: z.enum(['replace', 'append']).optional()
  },
  create_collection: {
    name: z.string(),
    requests: z.array(createCollectionRequestRow).optional()
  },
  create_folder: {
    collectionId: z.number(),
    name: z.string()
  },
  create_request: {
    collectionId: z.number(),
    name: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    url: z.string(),
    folderId: z.union([z.number(), z.null()]).optional(),
    folderName: z.string().optional(),
    headers: z
      .union([z.record(z.string(), z.string()), z.array(z.object(aiKeyValueShape))])
      .optional(),
    params: z.array(z.object(aiKeyValueShape)).optional(),
    body: z.string().optional(),
    bodyType: z.enum(['none', 'json', 'text', 'multipart', 'urlencoded']).optional(),
    comment: z.string().optional()
  },
  search_docs: {
    query: z.string(),
    limit: z.number().optional(),
    source: z.enum(['site', 'sdk']).optional()
  },
  get_active_terminal: {},
  get_active_terminal_lines: {
    startLine: z.number(),
    endLine: z.number()
  },
  terminal_exec: {
    input: z.string()
  }
};

/**
 * Returns the Zod raw shape for a Harbor AI tool's MCP input schema.
 *
 * @param name - Harbor AI tool name.
 */
export function getAiToolInputShape(name: AiToolName): Record<string, z.ZodType> {
  return AI_TOOL_INPUT_SHAPES[name];
}

/**
 * Ensures every Harbor AI tool has a corresponding MCP input shape definition.
 */
for (const name of AI_TOOL_NAMES) {
  if (!(name in AI_TOOL_INPUT_SHAPES)) {
    throw new Error(`Missing MCP input shape for AI tool: ${name}`);
  }
}
