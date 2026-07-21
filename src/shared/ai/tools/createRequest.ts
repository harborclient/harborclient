import { z } from 'zod';
import type { ITool } from './ITool';
import { AI_KEY_VALUE_SCHEMA, aiKeyValueShape } from './schemas';
import type { CreateSavedRequestKeyValue } from './types';

/**
 * Arguments for the create_request tool.
 */
export interface CreateRequestToolArgs {
  /**
   * Collection id that will own the new saved request.
   */
  collectionId: number;

  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method for the request.
   */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

  /**
   * Request URL.
   */
  url: string;

  /**
   * Folder id when the request belongs to a folder; omit or null for collection root.
   */
  folderId?: number | null;

  /**
   * Folder name to resolve within the collection when folderId is omitted.
   */
  folderName?: string;

  /**
   * Optional request headers as a flat object or key-value rows.
   */
  headers?: Record<string, string> | CreateSavedRequestKeyValue[];

  /**
   * Optional query params as key-value rows.
   */
  params?: CreateSavedRequestKeyValue[];

  /**
   * Optional request body content.
   */
  body?: string;

  /**
   * Optional body content type.
   */
  bodyType?: 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

  /**
   * Optional free-form notes for the request.
   */
  comment?: string;
}

/**
 * Creates a saved request in an existing collection or folder.
 *
 * @param {number} collectionId - Collection id that will own the new saved request.
 * @param {string} name - Display name for the saved request.
 * @param {string} method - HTTP method for the request.
 * @param {string} url - Request URL.
 * @param {number | null} [folderId] - Folder id when the request belongs to a folder.
 * @param {string} [folderName] - Folder name to resolve when folderId is omitted.
 * @param {object | object[]} [headers] - Optional headers as a flat object or key-value rows.
 * @param {object[]} [params] - Optional query params.
 * @param {string} [body] - Optional request body content.
 * @param {string} [bodyType] - Optional body content type.
 * @param {string} [comment] - Optional free-form notes for the request.
 */
export const createRequestTool = {
  name: 'create_request',
  definition: {
    type: 'function',
    function: {
      name: 'create_request',
      description:
        'Creates a saved request in an existing collection or folder. Persists immediately without opening an editor tab. Use create_folder first when the target folder does not exist yet.',
      parameters: {
        type: 'object',
        properties: {
          collectionId: {
            type: 'number',
            description: 'Collection id that will own the new saved request.'
          },
          name: { type: 'string', description: 'Display name for the saved request.' },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            description: 'HTTP method for the request.'
          },
          url: { type: 'string', description: 'Request URL.' },
          folderId: {
            type: ['number', 'null'],
            description: 'Folder id when the request belongs to a folder; omit for collection root.'
          },
          folderName: {
            type: 'string',
            description: 'Folder name to resolve within the collection when folderId is omitted.'
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
        required: ['collectionId', 'name', 'method', 'url'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
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
  }
} as const satisfies ITool<'create_request'>;
