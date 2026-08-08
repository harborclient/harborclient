import { z } from 'zod/v4';

/**
 * Coerces env-interpolated boolean YAML values (`true`/`false` strings or null/empty).
 *
 * @returns Zod schema yielding `boolean | undefined`.
 */
const optionalEnvBooleanSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}, z.boolean().optional());

/**
 * Coerces optional string fields so null/empty env-interpolated values mean unset.
 *
 * @returns Zod schema yielding `string | undefined`.
 */
const optionalEnvStringSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return value;
}, z.string().optional());

const portSchema = z.union([
  z
    .number()
    .int({ message: 'Port must be an integer between 1 and 65535.' })
    .min(1, { message: 'Port must be an integer between 1 and 65535.' })
    .max(65535, { message: 'Port must be an integer between 1 and 65535.' }),
  z
    .string()
    .regex(/^\d+$/, { message: 'Port must be an integer between 1 and 65535.' })
    .transform(Number)
    .pipe(
      z
        .number()
        .int({ message: 'Port must be an integer between 1 and 65535.' })
        .min(1, { message: 'Port must be an integer between 1 and 65535.' })
        .max(65535, { message: 'Port must be an integer between 1 and 65535.' })
    )
]);

/**
 * Zod schema for the `server` section of the config file (host and port).
 */
export const serverSectionSchema = z.object({
  port: portSchema,
  host: z.string().trim().min(1, { message: 'Host must not be empty.' })
});

/**
 * Zod schema for the `db` section of the config file (driver discriminant only).
 *
 * Driver-specific fields are validated by each database implementation.
 */
export const dbSectionSchema = z
  .object({
    driver: z.string().trim().min(1, { message: 'Database driver must not be empty.' })
  })
  .loose();

/**
 * Zod schema for the `redis` section of the config file.
 *
 * Throttle policy fields default to 10 failures / 900s window / 900s block when omitted.
 */
export const redisSectionSchema = z
  .object({
    host: z.string().trim().min(1, { message: 'Redis host must not be empty.' }),
    port: portSchema,
    password: z.string().optional(),
    db: z
      .union([
        z.number().int().min(0).max(15),
        z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(15))
      ])
      .optional(),
    keyPrefix: z.string().optional(),
    maxFailures: z
      .union([
        z.number().int().min(1),
        z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1))
      ])
      .optional(),
    windowSeconds: z
      .union([
        z.number().int().min(1),
        z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1))
      ])
      .optional(),
    blockSeconds: z
      .union([
        z.number().int().min(1),
        z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1))
      ])
      .optional(),
    noticeEventsPubSub: optionalEnvBooleanSchema
  })
  .loose();

/**
 * Zod schema for a single LLM provider API key entry in server.yaml.
 */
export const llmProviderEntrySchema = z.object({
  apiKey: z.string().trim().min(1, { message: 'LLM provider apiKey must not be empty.' })
});

/**
 * Zod schema for MCP server HTTP headers in server.yaml.
 *
 * Accepts an object map, an array of single-key objects, or one nested array level.
 */
export const hubMcpHeadersSchema = z.union([
  z.record(z.string(), z.string()),
  z.array(z.union([z.record(z.string(), z.string()), z.array(z.record(z.string(), z.string()))]))
]);

/**
 * Zod schema for one MCP server entry under llm.mcp.
 */
export const hubMcpServerEntrySchema = z.object({
  name: z.string().trim().min(1),
  url: z.string().trim().min(1),
  headers: hubMcpHeadersSchema.optional()
});

/**
 * Zod schema for the optional `llm` section of the config file.
 */
export const llmSectionSchema = z.object({
  providers: z
    .object({
      openai: llmProviderEntrySchema.optional(),
      claude: llmProviderEntrySchema.optional(),
      gemini: llmProviderEntrySchema.optional()
    })
    .refine(
      (providers) =>
        Boolean(providers.openai?.apiKey || providers.claude?.apiKey || providers.gemini?.apiKey),
      { message: 'llm.providers must include at least one provider with an apiKey.' }
    ),
  models: z.array(z.string().trim().min(1)).optional(),
  mcp: z.array(hubMcpServerEntrySchema).optional()
});

/**
 * Zod schema for the optional `plugins` section of the config file.
 */
export const pluginsSectionSchema = z.object({
  catalogs: z.array(z.string().trim().url()).optional(),
  trusted: z.array(z.string().trim().url()).optional()
});

/**
 * Zod schema for the optional `docs` section of the config file.
 */
export const docsSectionSchema = z.object({
  searchIndexPath: z.string().trim().min(1).optional()
});

/**
 * Zod schema for supported log levels in the optional `logging` section.
 */
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

/**
 * Zod schema for supported Winston formats in the optional `logging` section.
 */
export const logFormatSchema = z.enum(['json', 'simple']);

/**
 * Zod schema for the optional `logging` section of the config file.
 */
export const loggingSectionSchema = z.object({
  level: logLevelSchema.optional(),
  file: z.preprocess((value) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return value;
  }, z.string().trim().min(1).optional()),
  console: optionalEnvBooleanSchema,
  format: logFormatSchema.optional()
});

/**
 * Zod schema for the optional `metrics` section of the config file.
 */
export const metricsSectionSchema = z.object({
  enabled: optionalEnvBooleanSchema,
  path: z.preprocess((value) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return value;
  }, z.string().trim().min(1).optional()),
  authToken: optionalEnvStringSchema
});

/**
 * Zod schema for the optional `storage` section of the config file.
 *
 * Driver-specific required fields are enforced by {@link normalizeStorageConfig}.
 */
export const storageSectionSchema = z
  .object({
    driver: z.string().trim().min(1).optional(),
    prefix: z.string().optional(),
    signedUrlTtlSeconds: z
      .union([
        z.number().int().min(1),
        z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1))
      ])
      .optional(),
    bucket: z.string().optional(),
    region: z.string().optional(),
    endpoint: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    projectId: z.string().optional(),
    keyFilename: z.string().optional()
  })
  .loose();

/**
 * Zod schema for the optional `multitenancy` section of the config file.
 */
export const multitenancySectionSchema = z.object({
  enabled: optionalEnvBooleanSchema
});

/**
 * Zod schema for the optional `collaboration` section of the config file.
 */
export const collaborationSectionSchema = z.object({
  e2ee: z.boolean().optional()
});

/**
 * Zod schema for the full server config document (`server.yaml` root mapping).
 */
export const serverConfigDocumentSchema = z.object({
  server: serverSectionSchema,
  db: dbSectionSchema,
  redis: redisSectionSchema,
  llm: llmSectionSchema.optional(),
  plugins: pluginsSectionSchema.optional(),
  docs: docsSectionSchema.optional(),
  logging: loggingSectionSchema.optional(),
  metrics: metricsSectionSchema.optional(),
  storage: storageSectionSchema.optional(),
  multitenancy: multitenancySectionSchema.optional(),
  collaboration: collaborationSectionSchema.optional()
});

/**
 * Validated shape of a parsed server config YAML file.
 */
export type ServerConfigDocument = z.infer<typeof serverConfigDocumentSchema>;

/**
 * Validated shape of the optional llm section.
 */
export type LlmSection = z.infer<typeof llmSectionSchema>;

/**
 * Validated shape of the optional plugins section.
 */
export type PluginsSection = z.infer<typeof pluginsSectionSchema>;

/**
 * Validated shape of the optional docs section.
 */
export type DocsSection = z.infer<typeof docsSectionSchema>;

/**
 * Validated shape of the optional logging section.
 */
export type LoggingSection = z.infer<typeof loggingSectionSchema>;

/**
 * Validated shape of the optional metrics section.
 */
export type MetricsSection = z.infer<typeof metricsSectionSchema>;

/**
 * Validated shape of the optional storage section.
 */
export type StorageSection = z.infer<typeof storageSectionSchema>;

/**
 * Validated shape of the optional multitenancy section.
 */
export type MultitenancySection = z.infer<typeof multitenancySectionSchema>;
