import { z } from 'zod';
import type { AuthConfig, ScriptRef } from '../types';
/**
 * Supported HTTP methods in portable storage records.
 */
export declare const httpMethod: z.ZodEnum<{
  GET: 'GET';
  POST: 'POST';
  PUT: 'PUT';
  PATCH: 'PATCH';
  DELETE: 'DELETE';
  HEAD: 'HEAD';
  OPTIONS: 'OPTIONS';
}>;
/**
 * Supported request body encodings in portable storage records.
 */
export declare const bodyType: z.ZodEnum<{
  none: 'none';
  text: 'text';
  json: 'json';
  multipart: 'multipart';
  urlencoded: 'urlencoded';
}>;
/**
 * Header or query parameter key-value row.
 */
export declare const keyValue: z.ZodObject<
  {
    key: z.ZodString;
    value: z.ZodString;
    enabled: z.ZodBoolean;
  },
  z.core.$strip
>;
/**
 * Authorization settings accepted from portable storage records.
 */
export declare const authConfig: z.ZodPipe<
  z.ZodObject<
    {
      type: z.ZodOptional<z.ZodString>;
      basic: z.ZodOptional<
        z.ZodObject<
          {
            username: z.ZodOptional<z.ZodString>;
            password: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >
      >;
      bearer: z.ZodOptional<
        z.ZodObject<
          {
            token: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >
      >;
      oauth2: z.ZodOptional<
        z.ZodObject<
          {
            tokenUrl: z.ZodOptional<z.ZodString>;
            clientId: z.ZodOptional<z.ZodString>;
            clientSecret: z.ZodOptional<z.ZodString>;
            scope: z.ZodOptional<z.ZodString>;
            audience: z.ZodOptional<z.ZodString>;
            clientAuth: z.ZodOptional<
              z.ZodEnum<{
                body: 'body';
                header: 'header';
              }>
            >;
          },
          z.core.$strip
        >
      >;
    },
    z.core.$loose
  >,
  z.ZodTransform<
    AuthConfig,
    {
      [x: string]: unknown;
      type?: string | undefined;
      basic?:
        | {
            username?: string | undefined;
            password?: string | undefined;
          }
        | undefined;
      bearer?:
        | {
            token?: string | undefined;
          }
        | undefined;
      oauth2?:
        | {
            tokenUrl?: string | undefined;
            clientId?: string | undefined;
            clientSecret?: string | undefined;
            scope?: string | undefined;
            audience?: string | undefined;
            clientAuth?: 'body' | 'header' | undefined;
          }
        | undefined;
    }
  >
>;
/**
 * Optional script-reference arrays for portable exports.
 */
export declare const exportScriptRefArray: z.ZodPipe<
  z.ZodOptional<
    z.ZodArray<
      z.ZodDiscriminatedUnion<
        [
          z.ZodObject<
            {
              id: z.ZodString;
              enabled: z.ZodBoolean;
              kind: z.ZodLiteral<'inline'>;
              name: z.ZodOptional<z.ZodString>;
              code: z.ZodOptional<z.ZodString>;
              expanded: z.ZodOptional<z.ZodBoolean>;
              stage: z.ZodOptional<
                z.ZodEnum<{
                  'before-all': 'before-all';
                  'before-each': 'before-each';
                  'main': 'main';
                  'after-each': 'after-each';
                  'after-all': 'after-all';
                }>
              >;
            },
            z.core.$strip
          >,
          z.ZodObject<
            {
              id: z.ZodString;
              enabled: z.ZodBoolean;
              kind: z.ZodLiteral<'snippet'>;
              name: z.ZodOptional<z.ZodString>;
              snippetUuid: z.ZodString;
              expanded: z.ZodOptional<z.ZodBoolean>;
              stage: z.ZodOptional<
                z.ZodEnum<{
                  'before-all': 'before-all';
                  'before-each': 'before-each';
                  'main': 'main';
                  'after-each': 'after-each';
                  'after-all': 'after-all';
                }>
              >;
            },
            z.core.$strip
          >
        ],
        'kind'
      >
    >
  >,
  z.ZodTransform<
    ScriptRef[] | undefined,
    | (
        | {
            id: string;
            enabled: boolean;
            kind: 'inline';
            name?: string | undefined;
            code?: string | undefined;
            expanded?: boolean | undefined;
            stage?: 'before-all' | 'before-each' | 'main' | 'after-each' | 'after-all' | undefined;
          }
        | {
            id: string;
            enabled: boolean;
            kind: 'snippet';
            snippetUuid: string;
            name?: string | undefined;
            expanded?: boolean | undefined;
            stage?: 'before-all' | 'before-each' | 'main' | 'after-each' | 'after-all' | undefined;
          }
      )[]
    | undefined
  >
>;
//# sourceMappingURL=storageSchemas.d.ts.map
