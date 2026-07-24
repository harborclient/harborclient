import { z } from 'zod';
/**
 * Public URL of the generated snippet catalog served from harborclient.com.
 */
export declare const SNIPPET_CATALOG_URL = 'https://harborclient.com/snippet_catalog.json';
declare const snippetCatalogSnippetEntrySchema: z.ZodObject<
  {
    name: z.ZodString;
    phase: z.ZodEnum<{
      'pre-request': 'pre-request';
      'post-request': 'post-request';
      'any': 'any';
    }>;
    stage: z.ZodEnum<{
      'before-all': 'before-all';
      'before-each': 'before-each';
      'main': 'main';
      'after-each': 'after-each';
      'after-all': 'after-all';
    }>;
    file: z.ZodString;
    uuid: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
/**
 * One snippet entry declared in a marketplace bundle manifest.
 */
export type SnippetCatalogSnippetEntry = z.infer<typeof snippetCatalogSnippetEntrySchema>;
declare const snippetCatalogEntrySchema: z.ZodObject<
  {
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    summary: z.ZodString;
    author: z.ZodString;
    categories: z.ZodPipe<
      z.ZodArray<z.ZodString>,
      z.ZodTransform<
        (
          | 'light'
          | 'dark'
          | 'high-contrast'
          | 'sidebar'
          | 'auth'
          | 'requests'
          | 'import'
          | 'themes'
          | 'environments'
          | 'scripting'
          | 'logging'
          | 'jwt'
          | 'response'
          | 'collections'
          | 'editor'
          | 'testing'
          | 'export'
          | 'graphql'
          | 'websocket'
          | 'mock'
          | 'debugging'
          | 'security'
          | 'utilities'
        )[],
        string[]
      >
    >;
    repoUrl: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    ref: z.ZodOptional<z.ZodString>;
    homepage: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    screenshot: z.ZodOptional<z.ZodString>;
    screenshots: z.ZodOptional<z.ZodArray<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    minAppVersion: z.ZodOptional<z.ZodString>;
    snippets: z.ZodArray<
      z.ZodObject<
        {
          name: z.ZodString;
          phase: z.ZodEnum<{
            'pre-request': 'pre-request';
            'post-request': 'post-request';
            'any': 'any';
          }>;
          stage: z.ZodEnum<{
            'before-all': 'before-all';
            'before-each': 'before-each';
            'main': 'main';
            'after-each': 'after-each';
            'after-all': 'after-all';
          }>;
          file: z.ZodString;
          uuid: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
/**
 * Zod schema for the snippet marketplace catalog document.
 */
export declare const snippetCatalogSchema: z.ZodObject<
  {
    schemaVersion: z.ZodLiteral<1>;
    snippets: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          name: z.ZodString;
          version: z.ZodString;
          summary: z.ZodString;
          author: z.ZodString;
          categories: z.ZodPipe<
            z.ZodArray<z.ZodString>,
            z.ZodTransform<
              (
                | 'light'
                | 'dark'
                | 'high-contrast'
                | 'sidebar'
                | 'auth'
                | 'requests'
                | 'import'
                | 'themes'
                | 'environments'
                | 'scripting'
                | 'logging'
                | 'jwt'
                | 'response'
                | 'collections'
                | 'editor'
                | 'testing'
                | 'export'
                | 'graphql'
                | 'websocket'
                | 'mock'
                | 'debugging'
                | 'security'
                | 'utilities'
              )[],
              string[]
            >
          >;
          repoUrl: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
          ref: z.ZodOptional<z.ZodString>;
          homepage: z.ZodOptional<z.ZodString>;
          icon: z.ZodOptional<z.ZodString>;
          screenshot: z.ZodOptional<z.ZodString>;
          screenshots: z.ZodOptional<z.ZodArray<z.ZodString>>;
          description: z.ZodOptional<z.ZodString>;
          minAppVersion: z.ZodOptional<z.ZodString>;
          snippets: z.ZodArray<
            z.ZodObject<
              {
                name: z.ZodString;
                phase: z.ZodEnum<{
                  'pre-request': 'pre-request';
                  'post-request': 'post-request';
                  'any': 'any';
                }>;
                stage: z.ZodEnum<{
                  'before-all': 'before-all';
                  'before-each': 'before-each';
                  'main': 'main';
                  'after-each': 'after-each';
                  'after-all': 'after-all';
                }>;
                file: z.ZodString;
                uuid: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
/**
 * One curated snippet bundle listing in the marketplace catalog.
 */
export type SnippetCatalogEntry = z.infer<typeof snippetCatalogEntrySchema>;
/**
 * Parsed snippet marketplace catalog returned by the build script and app fetch.
 */
export type SnippetCatalog = {
  schemaVersion: 1;
  snippets: SnippetCatalogEntry[];
  updatedAt?: string;
};
/**
 * Parses and validates a snippet catalog payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated catalog with unique snippet bundle ids.
 * @throws When the payload is invalid or contains duplicate ids.
 */
export declare function parseSnippetCatalog(raw: unknown): SnippetCatalog;
export {};
//# sourceMappingURL=catalog.d.ts.map
