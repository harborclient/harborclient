import { z } from 'zod';
import { normalizeAuth } from '@harborclient/core/auth';
import type { AuthConfig, KeyValue, ScriptRef } from '@harborclient/core/types';

/**
 * Supported HTTP methods in portable storage records.
 */
export const httpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Supported request body encodings in portable storage records.
 */
export const bodyType = z.enum(['none', 'json', 'text', 'multipart', 'urlencoded']);

/**
 * Header or query parameter key-value row.
 */
export const keyValue = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean()
}) satisfies z.ZodType<KeyValue>;

/**
 * Authorization settings accepted from portable storage records.
 */
export const authConfig = z
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
  .passthrough()
  .transform(normalizeAuth) satisfies z.ZodType<AuthConfig>;

/**
 * Script references accepted from portable storage records.
 */
const scriptRef = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('inline'),
    name: z.string().optional(),
    code: z
      .string()
      .max(512 * 1024)
      .optional(),
    expanded: z.boolean().optional(),
    stage: z.enum(['before-all', 'before-each', 'main', 'after-each', 'after-all']).optional()
  }),
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('snippet'),
    name: z.string().optional(),
    snippetUuid: z.string().min(1),
    expanded: z.boolean().optional(),
    stage: z.enum(['before-all', 'before-each', 'main', 'after-each', 'after-all']).optional()
  })
]) satisfies z.ZodType<ScriptRef>;

/**
 * Removes UI-only expansion state before serializing a script reference.
 *
 * @param ref - Parsed script reference from an export record.
 * @returns The portable script reference without expansion state.
 */
function stripExpandedFromScriptRef(ref: ScriptRef): ScriptRef {
  const { expanded: _, ...portableRef } = ref;
  void _;
  return portableRef;
}

/**
 * Optional script-reference arrays for portable exports.
 */
export const exportScriptRefArray = z
  .array(scriptRef)
  .max(64)
  .optional()
  .transform((refs) => (refs?.length ? refs.map(stripExpandedFromScriptRef) : undefined));
