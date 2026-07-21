import { z } from 'zod';

/**
 * JSON schema for key-value rows in update_active_request and related tool arguments.
 */
export const AI_KEY_VALUE_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'Header, param, or cookie name.' },
    value: { type: 'string', description: 'Header, param, or cookie value.' },
    enabled: {
      type: 'boolean',
      description: 'Whether the row is active; defaults to true when omitted.'
    }
  },
  required: ['key', 'value'],
  additionalProperties: false
} as const;

/**
 * JSON schema for saved request rows in create_collection tool arguments.
 */
export const CREATE_COLLECTION_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Display name for the saved request.' },
    method: {
      type: 'string',
      description: 'HTTP method (for example GET or POST).'
    },
    url: { type: 'string', description: 'Request URL.' },
    folder: {
      type: 'string',
      description: 'Optional folder name within the new collection.'
    },
    headers: {
      description: 'Optional headers as a flat object or key-value rows.',
      oneOf: [
        { type: 'object', additionalProperties: { type: 'string' } },
        { type: 'array', items: AI_KEY_VALUE_SCHEMA }
      ]
    },
    params: {
      type: 'array',
      items: AI_KEY_VALUE_SCHEMA,
      description: 'Optional query params.'
    },
    body: { type: 'string', description: 'Optional request body content.' },
    bodyType: {
      type: 'string',
      enum: ['none', 'json', 'text', 'multipart', 'urlencoded'],
      description: 'Optional body content type.'
    },
    comment: { type: 'string', description: 'Optional free-form notes for the request.' }
  },
  required: ['name', 'method', 'url'],
  additionalProperties: false
} as const;

/**
 * Zod raw shape for Harbor AI key-value rows in MCP tool arguments.
 */
export const aiKeyValueShape = {
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().optional()
} as const;

/**
 * Zod schema for saved request rows in create_collection tool arguments.
 */
export const createCollectionRequestRow = z.object({
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
