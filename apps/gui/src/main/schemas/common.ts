import { z } from 'zod';
import { normalizeAuth } from '#/shared/auth';
import type { AuthConfig, KeyValue, Variable } from '#/shared/types';

/**
 * Supported HTTP methods for saved and live requests.
 */
export const httpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Supported request body content types.
 */
export const bodyType = z.enum(['none', 'json', 'text', 'multipart', 'urlencoded']);

/**
 * Authorization type for the Auth tab.
 */
export const authType = z.enum(['none', 'basic', 'bearer', 'oauth2']);

/**
 * OAuth 2.0 Client Credentials settings for requests and collections.
 */
export const oauth2Config = z.object({
  tokenUrl: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  scope: z.string(),
  audience: z.string(),
  clientAuth: z.enum(['body', 'header'])
}) satisfies z.ZodType<AuthConfig['oauth2']>;

/**
 * Permissive auth payload accepted from import files and IPC before normalization.
 *
 * Credential blocks (`basic`, `bearer`, `oauth2`) are optional so legacy exports
 * and future auth methods do not break import when a block is absent.
 */
const authConfigInput = z
  .object({
    type: z.string().optional(),
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
      .optional(),
    oauth2: z
      .object({
        tokenUrl: z.string().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        scope: z.string().optional(),
        audience: z.string().optional(),
        clientAuth: z.enum(['body', 'header']).optional()
      })
      .optional()
  })
  .passthrough();

/**
 * Authorization settings for requests and collections.
 *
 * Accepts partial legacy export shapes and normalizes to a full {@link AuthConfig}.
 */
export const authConfig = authConfigInput.transform(normalizeAuth) satisfies z.ZodType<AuthConfig>;

/**
 * Header or query parameter key-value row.
 */
export const keyValue = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean()
}) satisfies z.ZodType<KeyValue>;

/**
 * Collection or environment variable row.
 */
export const variable = z.object({
  key: z.string(),
  value: z.string(),
  defaultValue: z.string(),
  share: z.boolean()
}) satisfies z.ZodType<Variable>;
