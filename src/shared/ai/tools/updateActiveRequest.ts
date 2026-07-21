import { z } from 'zod';
import type { ITool } from './ITool';
import { AI_KEY_VALUE_SCHEMA, aiKeyValueShape } from './schemas';

/**
 * Modifies the request open in the editor; changes appear immediately but are not saved until the user saves.
 *
 * @param {string} [name] - Display name for the request.
 * @param {string} [method] - HTTP method for the request.
 * @param {string} [url] - Request URL.
 * @param {string} [body] - Request body content.
 * @param {string} [body_type] - Content type of the request body.
 * @param {string} [pre_request_script] - JavaScript run before the request is sent.
 * @param {string} [pre_request_script_mode] - How to apply pre_request_script; defaults to replace.
 * @param {string} [post_request_script] - JavaScript run after the response is received.
 * @param {string} [post_request_script_mode] - How to apply post_request_script; defaults to replace.
 * @param {string} [comment] - Free-form notes for the request.
 * @param {object[]} [headers] - Request headers to merge or replace.
 * @param {string} [headers_mode] - How to apply headers; defaults to merge.
 * @param {object[]} [params] - Query params to merge or replace.
 * @param {string} [params_mode] - How to apply params; defaults to merge.
 * @param {object} [auth] - Partial auth settings patch.
 * @param {object[]} [cookies] - Cookies for the request host.
 * @param {string} [cookies_mode] - How to apply cookies; defaults to merge.
 */
export const updateActiveRequestTool = {
  name: 'update_active_request',
  definition: {
    type: 'function',
    function: {
      name: 'update_active_request',
      description:
        'Modifies the request open in the editor (method, URL, params, headers, body, auth, pre/post scripts, cookies). Call get_active_request_details first when you need current values. Use HarborClient hc API in scripts, not Postman pm (hc.data for passing values between scripts in one send; hc.request.variables/collection.variables/environment.variables/globals with get/set/clear for persisted variables; hc.cookies, hc.execution.setNextRequest/skipRequest, await hc.sendRequest when enabled in Settings → General). Changes appear in the editor immediately but are not saved until the user saves.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name for the request.' },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            description: 'HTTP method for the request.'
          },
          url: {
            type: 'string',
            description:
              'Request URL. When changed without params, the params table syncs from the query string.'
          },
          body: { type: 'string', description: 'Request body content.' },
          body_type: {
            type: 'string',
            enum: ['none', 'json', 'text', 'multipart', 'urlencoded'],
            description: 'Content type of the request body.'
          },
          pre_request_script: {
            type: 'string',
            description: 'JavaScript run before the request is sent.'
          },
          pre_request_script_mode: {
            type: 'string',
            enum: ['replace', 'append'],
            description: 'How to apply pre_request_script; defaults to replace.'
          },
          post_request_script: {
            type: 'string',
            description: 'JavaScript run after the response is received.'
          },
          post_request_script_mode: {
            type: 'string',
            enum: ['replace', 'append'],
            description: 'How to apply post_request_script; defaults to replace.'
          },
          comment: { type: 'string', description: 'Free-form notes for the request.' },
          headers: {
            type: 'array',
            items: AI_KEY_VALUE_SCHEMA,
            description: 'Request headers to merge or replace.'
          },
          headers_mode: {
            type: 'string',
            enum: ['merge', 'replace'],
            description: 'How to apply headers; defaults to merge.'
          },
          params: {
            type: 'array',
            items: AI_KEY_VALUE_SCHEMA,
            description: 'Query params to merge or replace.'
          },
          params_mode: {
            type: 'string',
            enum: ['merge', 'replace'],
            description: 'How to apply params; defaults to merge.'
          },
          auth: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['none', 'basic', 'bearer'],
                description: 'Selected auth mode.'
              },
              basic: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' }
                },
                additionalProperties: false
              },
              bearer: {
                type: 'object',
                properties: {
                  token: { type: 'string' }
                },
                additionalProperties: false
              }
            },
            additionalProperties: false,
            description: 'Partial auth settings patch.'
          },
          cookies: {
            type: 'array',
            items: AI_KEY_VALUE_SCHEMA,
            description:
              'Cookies for the request host; stored in the cookie jar for the URL hostname.'
          },
          cookies_mode: {
            type: 'string',
            enum: ['merge', 'replace'],
            description: 'How to apply cookies; defaults to merge.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
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
  }
} as const satisfies ITool<'update_active_request'>;
