import { z } from 'zod/v4';

/**
 * Zod schema for validating Postgres port values from server.yaml.
 */
export const portSchema = z.union([
  z
    .number()
    .int({ message: 'Postgres port must be an integer between 1 and 65535.' })
    .min(1, { message: 'Postgres port must be an integer between 1 and 65535.' })
    .max(65535, { message: 'Postgres port must be an integer between 1 and 65535.' }),
  z
    .string()
    .regex(/^\d+$/, { message: 'Postgres port must be an integer between 1 and 65535.' })
    .transform(Number)
    .pipe(
      z
        .number()
        .int({ message: 'Postgres port must be an integer between 1 and 65535.' })
        .min(1, { message: 'Postgres port must be an integer between 1 and 65535.' })
        .max(65535, { message: 'Postgres port must be an integer between 1 and 65535.' })
    )
]);

/**
 * Coerces numeric YAML/env values while treating null or empty string as unset.
 *
 * @param min - Inclusive minimum after coercion.
 * @param message - Error message when validation fails.
 * @returns Zod schema that yields `number | undefined`.
 */
function optionalNonNegativeIntSchema(min: number, message: string) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === '') {
        return undefined;
      }
      return value;
    },
    z
      .union([
        z.number().int({ message }).min(min, { message }),
        z
          .string()
          .regex(/^\d+$/, { message })
          .transform(Number)
          .pipe(z.number().int({ message }).min(min, { message }))
      ])
      .optional()
  );
}

/**
 * Zod schema for optional Postgres TLS settings from server.yaml.
 *
 * Accepts a boolean, an object with certificate fields, or null/empty (unset).
 * String `"true"` / `"false"` from env-rendered YAML are coerced to booleans.
 */
export const postgresSslSchema = z.preprocess(
  (value) => {
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
  },
  z
    .union([
      z.boolean(),
      z.object({
        rejectUnauthorized: z.boolean().optional(),
        ca: z.string().optional(),
        cert: z.string().optional(),
        key: z.string().optional()
      })
    ])
    .optional()
);

/**
 * Zod schema for validating raw Postgres database config from server.yaml.
 */
export const postgresConfigSchema = z.object({
  driver: z.literal('postgres'),
  host: z.string().trim().min(1, { message: 'Postgres host must not be empty.' }),
  port: portSchema,
  user: z.string().trim().min(1, { message: 'Postgres user must not be empty.' }),
  password: z.string(),
  database: z.string().trim().min(1, { message: 'Postgres database must not be empty.' }),
  max: optionalNonNegativeIntSchema(
    1,
    'Postgres max must be an integer greater than or equal to 1.'
  ),
  idleTimeoutMillis: optionalNonNegativeIntSchema(
    0,
    'Postgres idleTimeoutMillis must be an integer greater than or equal to 0.'
  ),
  connectionTimeoutMillis: optionalNonNegativeIntSchema(
    0,
    'Postgres connectionTimeoutMillis must be an integer greater than or equal to 0.'
  ),
  ssl: postgresSslSchema
});
