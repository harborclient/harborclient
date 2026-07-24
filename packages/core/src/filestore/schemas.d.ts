import { z } from 'zod';
import type { ExportedDocument, ExportedFolder, ExportedRequest, Variable } from '../types';
/**
 * Validates an optional portable document uuid from an export file.
 */
export declare const optionalDocumentUuid: z.ZodOptional<z.ZodString>;
/**
 * Normalizes imported collection variables and drops rows with no meaningful content.
 */
export declare const importVariables: z.ZodPipe<
  z.ZodDefault<z.ZodArray<z.ZodUnknown>>,
  z.ZodTransform<Variable[], unknown[]>
>;
/**
 * Returns the index of the first duplicate folder name, or null when all names are unique.
 *
 * @param folders - Folder rows with normalized names.
 * @returns Index of the second occurrence, or null when names are unique.
 */
export declare function findDuplicateFolderIndex(
  folders: ReadonlyArray<{
    name: string;
  }>
): number | null;
/**
 * Returns the index of the first duplicate folder uuid, or null when all uuids are unique.
 *
 * @param folders - Folder rows with optional uuids.
 * @returns Index of the second occurrence, or null when uuids are unique or absent.
 */
export declare function findDuplicateFolderUuidIndex(
  folders: ReadonlyArray<{
    uuid?: string;
  }>
): number | null;
/**
 * Validates folder rows and applies index-based sort_order defaults.
 */
export declare const exportedFolders: z.ZodPipe<
  z.ZodDefault<
    z.ZodArray<
      z.ZodPipe<
        z.ZodObject<
          {
            uuid: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            sort_order: z.ZodOptional<z.ZodNumber>;
            variables: z.ZodOptional<
              z.ZodPipe<
                z.ZodDefault<z.ZodArray<z.ZodUnknown>>,
                z.ZodTransform<Variable[], unknown[]>
              >
            >;
            headers: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    key: z.ZodString;
                    value: z.ZodString;
                    enabled: z.ZodBoolean;
                  },
                  z.core.$strip
                >
              >
            >;
            auth: z.ZodOptional<
              z.ZodPipe<
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
                  import('../auth').AuthConfig,
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
              >
            >;
            pre_request_script: z.ZodOptional<z.ZodString>;
            post_request_script: z.ZodOptional<z.ZodString>;
            pre_request_scripts: z.ZodPipe<
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
                import('../types').ScriptRef[] | undefined,
                | (
                    | {
                        id: string;
                        enabled: boolean;
                        kind: 'inline';
                        name?: string | undefined;
                        code?: string | undefined;
                        expanded?: boolean | undefined;
                        stage?:
                          | 'before-all'
                          | 'before-each'
                          | 'main'
                          | 'after-each'
                          | 'after-all'
                          | undefined;
                      }
                    | {
                        id: string;
                        enabled: boolean;
                        kind: 'snippet';
                        snippetUuid: string;
                        name?: string | undefined;
                        expanded?: boolean | undefined;
                        stage?:
                          | 'before-all'
                          | 'before-each'
                          | 'main'
                          | 'after-each'
                          | 'after-all'
                          | undefined;
                      }
                  )[]
                | undefined
              >
            >;
            post_request_scripts: z.ZodPipe<
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
                import('../types').ScriptRef[] | undefined,
                | (
                    | {
                        id: string;
                        enabled: boolean;
                        kind: 'inline';
                        name?: string | undefined;
                        code?: string | undefined;
                        expanded?: boolean | undefined;
                        stage?:
                          | 'before-all'
                          | 'before-each'
                          | 'main'
                          | 'after-each'
                          | 'after-all'
                          | undefined;
                      }
                    | {
                        id: string;
                        enabled: boolean;
                        kind: 'snippet';
                        snippetUuid: string;
                        name?: string | undefined;
                        expanded?: boolean | undefined;
                        stage?:
                          | 'before-all'
                          | 'before-each'
                          | 'main'
                          | 'after-each'
                          | 'after-all'
                          | undefined;
                      }
                  )[]
                | undefined
              >
            >;
            color: z.ZodPipe<
              z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
              z.ZodTransform<string | null, string | null | undefined>
            >;
          },
          z.core.$strip
        >,
        z.ZodTransform<
          {
            uuid: string | undefined;
            name: string;
            sort_order: number | undefined;
            variables: Variable[] | undefined;
            headers:
              | {
                  key: string;
                  value: string;
                  enabled: boolean;
                }[]
              | undefined;
            auth: import('../auth').AuthConfig | undefined;
            pre_request_script: string | undefined;
            post_request_script: string | undefined;
            pre_request_scripts: import('../types').ScriptRef[] | undefined;
            post_request_scripts: import('../types').ScriptRef[] | undefined;
            color: string | null;
          },
          {
            name: string;
            pre_request_scripts: import('../types').ScriptRef[] | undefined;
            post_request_scripts: import('../types').ScriptRef[] | undefined;
            color: string | null;
            uuid?: string | undefined;
            sort_order?: number | undefined;
            variables?: Variable[] | undefined;
            headers?:
              | {
                  key: string;
                  value: string;
                  enabled: boolean;
                }[]
              | undefined;
            auth?: import('../auth').AuthConfig | undefined;
            pre_request_script?: string | undefined;
            post_request_script?: string | undefined;
          }
        >
      >
    >
  >,
  z.ZodTransform<
    ExportedFolder[],
    {
      uuid: string | undefined;
      name: string;
      sort_order: number | undefined;
      variables: Variable[] | undefined;
      headers:
        | {
            key: string;
            value: string;
            enabled: boolean;
          }[]
        | undefined;
      auth: import('../auth').AuthConfig | undefined;
      pre_request_script: string | undefined;
      post_request_script: string | undefined;
      pre_request_scripts: import('../types').ScriptRef[] | undefined;
      post_request_scripts: import('../types').ScriptRef[] | undefined;
      color: string | null;
    }[]
  >
>;
/**
 * Validates exported request rows and applies index-based sort_order defaults.
 */
export declare const exportedRequests: z.ZodPipe<
  z.ZodArray<
    z.ZodPipe<
      z.ZodObject<
        {
          uuid: z.ZodOptional<z.ZodString>;
          name: z.ZodString;
          method: z.ZodEnum<{
            GET: 'GET';
            POST: 'POST';
            PUT: 'PUT';
            PATCH: 'PATCH';
            DELETE: 'DELETE';
            HEAD: 'HEAD';
            OPTIONS: 'OPTIONS';
          }>;
          url: z.ZodDefault<z.ZodString>;
          headers: z.ZodDefault<
            z.ZodArray<
              z.ZodObject<
                {
                  key: z.ZodString;
                  value: z.ZodString;
                  enabled: z.ZodBoolean;
                },
                z.core.$strip
              >
            >
          >;
          params: z.ZodDefault<
            z.ZodArray<
              z.ZodObject<
                {
                  key: z.ZodString;
                  value: z.ZodString;
                  enabled: z.ZodBoolean;
                },
                z.core.$strip
              >
            >
          >;
          auth: z.ZodOptional<
            z.ZodPipe<
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
                import('../auth').AuthConfig,
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
            >
          >;
          body: z.ZodDefault<z.ZodString>;
          body_type: z.ZodEnum<{
            none: 'none';
            text: 'text';
            json: 'json';
            multipart: 'multipart';
            urlencoded: 'urlencoded';
          }>;
          body_raw: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
          body_raw_open: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
          pre_request_script: z.ZodDefault<z.ZodString>;
          post_request_script: z.ZodDefault<z.ZodString>;
          pre_request_scripts: z.ZodPipe<
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
              import('../types').ScriptRef[] | undefined,
              | (
                  | {
                      id: string;
                      enabled: boolean;
                      kind: 'inline';
                      name?: string | undefined;
                      code?: string | undefined;
                      expanded?: boolean | undefined;
                      stage?:
                        | 'before-all'
                        | 'before-each'
                        | 'main'
                        | 'after-each'
                        | 'after-all'
                        | undefined;
                    }
                  | {
                      id: string;
                      enabled: boolean;
                      kind: 'snippet';
                      snippetUuid: string;
                      name?: string | undefined;
                      expanded?: boolean | undefined;
                      stage?:
                        | 'before-all'
                        | 'before-each'
                        | 'main'
                        | 'after-each'
                        | 'after-all'
                        | undefined;
                    }
                )[]
              | undefined
            >
          >;
          post_request_scripts: z.ZodPipe<
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
              import('../types').ScriptRef[] | undefined,
              | (
                  | {
                      id: string;
                      enabled: boolean;
                      kind: 'inline';
                      name?: string | undefined;
                      code?: string | undefined;
                      expanded?: boolean | undefined;
                      stage?:
                        | 'before-all'
                        | 'before-each'
                        | 'main'
                        | 'after-each'
                        | 'after-all'
                        | undefined;
                    }
                  | {
                      id: string;
                      enabled: boolean;
                      kind: 'snippet';
                      snippetUuid: string;
                      name?: string | undefined;
                      expanded?: boolean | undefined;
                      stage?:
                        | 'before-all'
                        | 'before-each'
                        | 'main'
                        | 'after-each'
                        | 'after-all'
                        | undefined;
                    }
                )[]
              | undefined
            >
          >;
          comment: z.ZodDefault<z.ZodString>;
          tags: z.ZodDefault<z.ZodString>;
          sort_order: z.ZodOptional<z.ZodNumber>;
          folder_name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
          folder_uuid: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
          color: z.ZodPipe<
            z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
            z.ZodTransform<string | null, string | null | undefined>
          >;
        },
        z.core.$strip
      >,
      z.ZodTransform<
        {
          uuid: string | undefined;
          name: string;
          method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
          url: string;
          headers: {
            key: string;
            value: string;
            enabled: boolean;
          }[];
          params: {
            key: string;
            value: string;
            enabled: boolean;
          }[];
          auth: import('../auth').AuthConfig | undefined;
          body: string;
          body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
          body_raw: string | null;
          body_raw_open: boolean;
          pre_request_script: string;
          post_request_script: string;
          pre_request_scripts: import('../types').ScriptRef[] | undefined;
          post_request_scripts: import('../types').ScriptRef[] | undefined;
          comment: string;
          tags: string;
          sort_order: number | undefined;
          folder_name: string | null | undefined;
          folder_uuid: string | null | undefined;
          color: string | null;
        },
        {
          name: string;
          method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
          url: string;
          headers: {
            key: string;
            value: string;
            enabled: boolean;
          }[];
          params: {
            key: string;
            value: string;
            enabled: boolean;
          }[];
          body: string;
          body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
          body_raw: string | null;
          body_raw_open: boolean;
          pre_request_script: string;
          post_request_script: string;
          pre_request_scripts: import('../types').ScriptRef[] | undefined;
          post_request_scripts: import('../types').ScriptRef[] | undefined;
          comment: string;
          tags: string;
          color: string | null;
          uuid?: string | undefined;
          auth?: import('../auth').AuthConfig | undefined;
          sort_order?: number | undefined;
          folder_name?: string | null | undefined;
          folder_uuid?: string | null | undefined;
        }
      >
    >
  >,
  z.ZodTransform<
    ExportedRequest[],
    {
      uuid: string | undefined;
      name: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
      url: string;
      headers: {
        key: string;
        value: string;
        enabled: boolean;
      }[];
      params: {
        key: string;
        value: string;
        enabled: boolean;
      }[];
      auth: import('../auth').AuthConfig | undefined;
      body: string;
      body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
      body_raw: string | null;
      body_raw_open: boolean;
      pre_request_script: string;
      post_request_script: string;
      pre_request_scripts: import('../types').ScriptRef[] | undefined;
      post_request_scripts: import('../types').ScriptRef[] | undefined;
      comment: string;
      tags: string;
      sort_order: number | undefined;
      folder_name: string | null | undefined;
      folder_uuid: string | null | undefined;
      color: string | null;
    }[]
  >
>;
/**
 * Validates exported document rows and applies index-based sort_order defaults.
 */
export declare const exportedDocuments: z.ZodPipe<
  z.ZodDefault<
    z.ZodArray<
      z.ZodPipe<
        z.ZodObject<
          {
            uuid: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            content: z.ZodDefault<z.ZodString>;
            sort_order: z.ZodOptional<z.ZodNumber>;
            folder_name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
            folder_uuid: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
            color: z.ZodPipe<
              z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
              z.ZodTransform<string | null, string | null | undefined>
            >;
          },
          z.core.$strip
        >,
        z.ZodTransform<
          {
            uuid: string | undefined;
            name: string;
            content: string;
            sort_order: number | undefined;
            folder_name: string | null | undefined;
            folder_uuid: string | null | undefined;
          },
          {
            name: string;
            content: string;
            color: string | null;
            uuid?: string | undefined;
            sort_order?: number | undefined;
            folder_name?: string | null | undefined;
            folder_uuid?: string | null | undefined;
          }
        >
      >
    >
  >,
  z.ZodTransform<
    ExportedDocument[],
    {
      uuid: string | undefined;
      name: string;
      content: string;
      sort_order: number | undefined;
      folder_name: string | null | undefined;
      folder_uuid: string | null | undefined;
    }[]
  >
>;
/**
 * Validates portable collection export files for import.
 */
export declare const collectionExportSchema: z.ZodObject<
  {
    folders: z.ZodPipe<
      z.ZodDefault<
        z.ZodArray<
          z.ZodPipe<
            z.ZodObject<
              {
                uuid: z.ZodOptional<z.ZodString>;
                name: z.ZodString;
                sort_order: z.ZodOptional<z.ZodNumber>;
                variables: z.ZodOptional<
                  z.ZodPipe<
                    z.ZodDefault<z.ZodArray<z.ZodUnknown>>,
                    z.ZodTransform<Variable[], unknown[]>
                  >
                >;
                headers: z.ZodOptional<
                  z.ZodArray<
                    z.ZodObject<
                      {
                        key: z.ZodString;
                        value: z.ZodString;
                        enabled: z.ZodBoolean;
                      },
                      z.core.$strip
                    >
                  >
                >;
                auth: z.ZodOptional<
                  z.ZodPipe<
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
                      import('../auth').AuthConfig,
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
                  >
                >;
                pre_request_script: z.ZodOptional<z.ZodString>;
                post_request_script: z.ZodOptional<z.ZodString>;
                pre_request_scripts: z.ZodPipe<
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
                    import('../types').ScriptRef[] | undefined,
                    | (
                        | {
                            id: string;
                            enabled: boolean;
                            kind: 'inline';
                            name?: string | undefined;
                            code?: string | undefined;
                            expanded?: boolean | undefined;
                            stage?:
                              | 'before-all'
                              | 'before-each'
                              | 'main'
                              | 'after-each'
                              | 'after-all'
                              | undefined;
                          }
                        | {
                            id: string;
                            enabled: boolean;
                            kind: 'snippet';
                            snippetUuid: string;
                            name?: string | undefined;
                            expanded?: boolean | undefined;
                            stage?:
                              | 'before-all'
                              | 'before-each'
                              | 'main'
                              | 'after-each'
                              | 'after-all'
                              | undefined;
                          }
                      )[]
                    | undefined
                  >
                >;
                post_request_scripts: z.ZodPipe<
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
                    import('../types').ScriptRef[] | undefined,
                    | (
                        | {
                            id: string;
                            enabled: boolean;
                            kind: 'inline';
                            name?: string | undefined;
                            code?: string | undefined;
                            expanded?: boolean | undefined;
                            stage?:
                              | 'before-all'
                              | 'before-each'
                              | 'main'
                              | 'after-each'
                              | 'after-all'
                              | undefined;
                          }
                        | {
                            id: string;
                            enabled: boolean;
                            kind: 'snippet';
                            snippetUuid: string;
                            name?: string | undefined;
                            expanded?: boolean | undefined;
                            stage?:
                              | 'before-all'
                              | 'before-each'
                              | 'main'
                              | 'after-each'
                              | 'after-all'
                              | undefined;
                          }
                      )[]
                    | undefined
                  >
                >;
                color: z.ZodPipe<
                  z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
                  z.ZodTransform<string | null, string | null | undefined>
                >;
              },
              z.core.$strip
            >,
            z.ZodTransform<
              {
                uuid: string | undefined;
                name: string;
                sort_order: number | undefined;
                variables: Variable[] | undefined;
                headers:
                  | {
                      key: string;
                      value: string;
                      enabled: boolean;
                    }[]
                  | undefined;
                auth: import('../auth').AuthConfig | undefined;
                pre_request_script: string | undefined;
                post_request_script: string | undefined;
                pre_request_scripts: import('../types').ScriptRef[] | undefined;
                post_request_scripts: import('../types').ScriptRef[] | undefined;
                color: string | null;
              },
              {
                name: string;
                pre_request_scripts: import('../types').ScriptRef[] | undefined;
                post_request_scripts: import('../types').ScriptRef[] | undefined;
                color: string | null;
                uuid?: string | undefined;
                sort_order?: number | undefined;
                variables?: Variable[] | undefined;
                headers?:
                  | {
                      key: string;
                      value: string;
                      enabled: boolean;
                    }[]
                  | undefined;
                auth?: import('../auth').AuthConfig | undefined;
                pre_request_script?: string | undefined;
                post_request_script?: string | undefined;
              }
            >
          >
        >
      >,
      z.ZodTransform<
        ExportedFolder[],
        {
          uuid: string | undefined;
          name: string;
          sort_order: number | undefined;
          variables: Variable[] | undefined;
          headers:
            | {
                key: string;
                value: string;
                enabled: boolean;
              }[]
            | undefined;
          auth: import('../auth').AuthConfig | undefined;
          pre_request_script: string | undefined;
          post_request_script: string | undefined;
          pre_request_scripts: import('../types').ScriptRef[] | undefined;
          post_request_scripts: import('../types').ScriptRef[] | undefined;
          color: string | null;
        }[]
      >
    >;
    documents: z.ZodPipe<
      z.ZodDefault<
        z.ZodArray<
          z.ZodPipe<
            z.ZodObject<
              {
                uuid: z.ZodOptional<z.ZodString>;
                name: z.ZodString;
                content: z.ZodDefault<z.ZodString>;
                sort_order: z.ZodOptional<z.ZodNumber>;
                folder_name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
                folder_uuid: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
                color: z.ZodPipe<
                  z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
                  z.ZodTransform<string | null, string | null | undefined>
                >;
              },
              z.core.$strip
            >,
            z.ZodTransform<
              {
                uuid: string | undefined;
                name: string;
                content: string;
                sort_order: number | undefined;
                folder_name: string | null | undefined;
                folder_uuid: string | null | undefined;
              },
              {
                name: string;
                content: string;
                color: string | null;
                uuid?: string | undefined;
                sort_order?: number | undefined;
                folder_name?: string | null | undefined;
                folder_uuid?: string | null | undefined;
              }
            >
          >
        >
      >,
      z.ZodTransform<
        ExportedDocument[],
        {
          uuid: string | undefined;
          name: string;
          content: string;
          sort_order: number | undefined;
          folder_name: string | null | undefined;
          folder_uuid: string | null | undefined;
        }[]
      >
    >;
    harborclientExport: z.ZodLiteral<'collection'>;
    uuid: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    variables: z.ZodPipe<
      z.ZodDefault<z.ZodArray<z.ZodUnknown>>,
      z.ZodTransform<Variable[], unknown[]>
    >;
    headers: z.ZodDefault<
      z.ZodArray<
        z.ZodObject<
          {
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodBoolean;
          },
          z.core.$strip
        >
      >
    >;
    auth: z.ZodOptional<
      z.ZodPipe<
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
          import('../auth').AuthConfig,
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
      >
    >;
    pre_request_script: z.ZodDefault<z.ZodString>;
    post_request_script: z.ZodDefault<z.ZodString>;
    pre_request_scripts: z.ZodPipe<
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
        import('../types').ScriptRef[] | undefined,
        | (
            | {
                id: string;
                enabled: boolean;
                kind: 'inline';
                name?: string | undefined;
                code?: string | undefined;
                expanded?: boolean | undefined;
                stage?:
                  | 'before-all'
                  | 'before-each'
                  | 'main'
                  | 'after-each'
                  | 'after-all'
                  | undefined;
              }
            | {
                id: string;
                enabled: boolean;
                kind: 'snippet';
                snippetUuid: string;
                name?: string | undefined;
                expanded?: boolean | undefined;
                stage?:
                  | 'before-all'
                  | 'before-each'
                  | 'main'
                  | 'after-each'
                  | 'after-all'
                  | undefined;
              }
          )[]
        | undefined
      >
    >;
    post_request_scripts: z.ZodPipe<
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
        import('../types').ScriptRef[] | undefined,
        | (
            | {
                id: string;
                enabled: boolean;
                kind: 'inline';
                name?: string | undefined;
                code?: string | undefined;
                expanded?: boolean | undefined;
                stage?:
                  | 'before-all'
                  | 'before-each'
                  | 'main'
                  | 'after-each'
                  | 'after-all'
                  | undefined;
              }
            | {
                id: string;
                enabled: boolean;
                kind: 'snippet';
                snippetUuid: string;
                name?: string | undefined;
                expanded?: boolean | undefined;
                stage?:
                  | 'before-all'
                  | 'before-each'
                  | 'main'
                  | 'after-each'
                  | 'after-all'
                  | undefined;
              }
          )[]
        | undefined
      >
    >;
    requests: z.ZodPipe<
      z.ZodArray<
        z.ZodPipe<
          z.ZodObject<
            {
              uuid: z.ZodOptional<z.ZodString>;
              name: z.ZodString;
              method: z.ZodEnum<{
                GET: 'GET';
                POST: 'POST';
                PUT: 'PUT';
                PATCH: 'PATCH';
                DELETE: 'DELETE';
                HEAD: 'HEAD';
                OPTIONS: 'OPTIONS';
              }>;
              url: z.ZodDefault<z.ZodString>;
              headers: z.ZodDefault<
                z.ZodArray<
                  z.ZodObject<
                    {
                      key: z.ZodString;
                      value: z.ZodString;
                      enabled: z.ZodBoolean;
                    },
                    z.core.$strip
                  >
                >
              >;
              params: z.ZodDefault<
                z.ZodArray<
                  z.ZodObject<
                    {
                      key: z.ZodString;
                      value: z.ZodString;
                      enabled: z.ZodBoolean;
                    },
                    z.core.$strip
                  >
                >
              >;
              auth: z.ZodOptional<
                z.ZodPipe<
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
                    import('../auth').AuthConfig,
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
                >
              >;
              body: z.ZodDefault<z.ZodString>;
              body_type: z.ZodEnum<{
                none: 'none';
                text: 'text';
                json: 'json';
                multipart: 'multipart';
                urlencoded: 'urlencoded';
              }>;
              body_raw: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
              body_raw_open: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
              pre_request_script: z.ZodDefault<z.ZodString>;
              post_request_script: z.ZodDefault<z.ZodString>;
              pre_request_scripts: z.ZodPipe<
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
                  import('../types').ScriptRef[] | undefined,
                  | (
                      | {
                          id: string;
                          enabled: boolean;
                          kind: 'inline';
                          name?: string | undefined;
                          code?: string | undefined;
                          expanded?: boolean | undefined;
                          stage?:
                            | 'before-all'
                            | 'before-each'
                            | 'main'
                            | 'after-each'
                            | 'after-all'
                            | undefined;
                        }
                      | {
                          id: string;
                          enabled: boolean;
                          kind: 'snippet';
                          snippetUuid: string;
                          name?: string | undefined;
                          expanded?: boolean | undefined;
                          stage?:
                            | 'before-all'
                            | 'before-each'
                            | 'main'
                            | 'after-each'
                            | 'after-all'
                            | undefined;
                        }
                    )[]
                  | undefined
                >
              >;
              post_request_scripts: z.ZodPipe<
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
                  import('../types').ScriptRef[] | undefined,
                  | (
                      | {
                          id: string;
                          enabled: boolean;
                          kind: 'inline';
                          name?: string | undefined;
                          code?: string | undefined;
                          expanded?: boolean | undefined;
                          stage?:
                            | 'before-all'
                            | 'before-each'
                            | 'main'
                            | 'after-each'
                            | 'after-all'
                            | undefined;
                        }
                      | {
                          id: string;
                          enabled: boolean;
                          kind: 'snippet';
                          snippetUuid: string;
                          name?: string | undefined;
                          expanded?: boolean | undefined;
                          stage?:
                            | 'before-all'
                            | 'before-each'
                            | 'main'
                            | 'after-each'
                            | 'after-all'
                            | undefined;
                        }
                    )[]
                  | undefined
                >
              >;
              comment: z.ZodDefault<z.ZodString>;
              tags: z.ZodDefault<z.ZodString>;
              sort_order: z.ZodOptional<z.ZodNumber>;
              folder_name: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
              folder_uuid: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
              color: z.ZodPipe<
                z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
                z.ZodTransform<string | null, string | null | undefined>
              >;
            },
            z.core.$strip
          >,
          z.ZodTransform<
            {
              uuid: string | undefined;
              name: string;
              method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
              url: string;
              headers: {
                key: string;
                value: string;
                enabled: boolean;
              }[];
              params: {
                key: string;
                value: string;
                enabled: boolean;
              }[];
              auth: import('../auth').AuthConfig | undefined;
              body: string;
              body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
              body_raw: string | null;
              body_raw_open: boolean;
              pre_request_script: string;
              post_request_script: string;
              pre_request_scripts: import('../types').ScriptRef[] | undefined;
              post_request_scripts: import('../types').ScriptRef[] | undefined;
              comment: string;
              tags: string;
              sort_order: number | undefined;
              folder_name: string | null | undefined;
              folder_uuid: string | null | undefined;
              color: string | null;
            },
            {
              name: string;
              method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
              url: string;
              headers: {
                key: string;
                value: string;
                enabled: boolean;
              }[];
              params: {
                key: string;
                value: string;
                enabled: boolean;
              }[];
              body: string;
              body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
              body_raw: string | null;
              body_raw_open: boolean;
              pre_request_script: string;
              post_request_script: string;
              pre_request_scripts: import('../types').ScriptRef[] | undefined;
              post_request_scripts: import('../types').ScriptRef[] | undefined;
              comment: string;
              tags: string;
              color: string | null;
              uuid?: string | undefined;
              auth?: import('../auth').AuthConfig | undefined;
              sort_order?: number | undefined;
              folder_name?: string | null | undefined;
              folder_uuid?: string | null | undefined;
            }
          >
        >
      >,
      z.ZodTransform<
        ExportedRequest[],
        {
          uuid: string | undefined;
          name: string;
          method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
          url: string;
          headers: {
            key: string;
            value: string;
            enabled: boolean;
          }[];
          params: {
            key: string;
            value: string;
            enabled: boolean;
          }[];
          auth: import('../auth').AuthConfig | undefined;
          body: string;
          body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
          body_raw: string | null;
          body_raw_open: boolean;
          pre_request_script: string;
          post_request_script: string;
          pre_request_scripts: import('../types').ScriptRef[] | undefined;
          post_request_scripts: import('../types').ScriptRef[] | undefined;
          comment: string;
          tags: string;
          sort_order: number | undefined;
          folder_name: string | null | undefined;
          folder_uuid: string | null | undefined;
          color: string | null;
        }[]
      >
    >;
    color: z.ZodPipe<
      z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
      z.ZodTransform<string | null, string | null | undefined>
    >;
    harborclientVersion: z.ZodLiteral<1>;
  },
  z.core.$strip
>;
/**
 * Maps a Zod validation failure to a user-facing import error fragment.
 *
 * @param error - Zod error from collectionExportSchema.safeParse.
 * @returns Message suffix after the "Invalid collection file:" prefix.
 */
export declare function formatCollectionImportError(error: z.ZodError): string;
/**
 * Validates portable request export files for import.
 */
export declare const requestExportSchema: z.ZodPipe<
  z.ZodObject<
    {
      harborclientVersion: z.ZodLiteral<1>;
      harborclientExport: z.ZodLiteral<'request'>;
      uuid: z.ZodOptional<z.ZodString>;
      name: z.ZodString;
      method: z.ZodEnum<{
        GET: 'GET';
        POST: 'POST';
        PUT: 'PUT';
        PATCH: 'PATCH';
        DELETE: 'DELETE';
        HEAD: 'HEAD';
        OPTIONS: 'OPTIONS';
      }>;
      url: z.ZodDefault<z.ZodString>;
      headers: z.ZodDefault<
        z.ZodArray<
          z.ZodObject<
            {
              key: z.ZodString;
              value: z.ZodString;
              enabled: z.ZodBoolean;
            },
            z.core.$strip
          >
        >
      >;
      params: z.ZodDefault<
        z.ZodArray<
          z.ZodObject<
            {
              key: z.ZodString;
              value: z.ZodString;
              enabled: z.ZodBoolean;
            },
            z.core.$strip
          >
        >
      >;
      auth: z.ZodOptional<
        z.ZodPipe<
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
            import('../auth').AuthConfig,
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
        >
      >;
      body: z.ZodDefault<z.ZodString>;
      body_type: z.ZodEnum<{
        none: 'none';
        text: 'text';
        json: 'json';
        multipart: 'multipart';
        urlencoded: 'urlencoded';
      }>;
      body_raw: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      body_raw_open: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
      pre_request_script: z.ZodDefault<z.ZodString>;
      post_request_script: z.ZodDefault<z.ZodString>;
      pre_request_scripts: z.ZodPipe<
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
          import('../types').ScriptRef[] | undefined,
          | (
              | {
                  id: string;
                  enabled: boolean;
                  kind: 'inline';
                  name?: string | undefined;
                  code?: string | undefined;
                  expanded?: boolean | undefined;
                  stage?:
                    | 'before-all'
                    | 'before-each'
                    | 'main'
                    | 'after-each'
                    | 'after-all'
                    | undefined;
                }
              | {
                  id: string;
                  enabled: boolean;
                  kind: 'snippet';
                  snippetUuid: string;
                  name?: string | undefined;
                  expanded?: boolean | undefined;
                  stage?:
                    | 'before-all'
                    | 'before-each'
                    | 'main'
                    | 'after-each'
                    | 'after-all'
                    | undefined;
                }
            )[]
          | undefined
        >
      >;
      post_request_scripts: z.ZodPipe<
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
          import('../types').ScriptRef[] | undefined,
          | (
              | {
                  id: string;
                  enabled: boolean;
                  kind: 'inline';
                  name?: string | undefined;
                  code?: string | undefined;
                  expanded?: boolean | undefined;
                  stage?:
                    | 'before-all'
                    | 'before-each'
                    | 'main'
                    | 'after-each'
                    | 'after-all'
                    | undefined;
                }
              | {
                  id: string;
                  enabled: boolean;
                  kind: 'snippet';
                  snippetUuid: string;
                  name?: string | undefined;
                  expanded?: boolean | undefined;
                  stage?:
                    | 'before-all'
                    | 'before-each'
                    | 'main'
                    | 'after-each'
                    | 'after-all'
                    | undefined;
                }
            )[]
          | undefined
        >
      >;
      comment: z.ZodDefault<z.ZodString>;
      tags: z.ZodDefault<z.ZodString>;
      color: z.ZodPipe<
        z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
        z.ZodTransform<string | null, string | null | undefined>
      >;
    },
    z.core.$strip
  >,
  z.ZodTransform<
    {
      harborclientVersion: 1;
      harborclientExport: 'request';
      uuid: string | undefined;
      name: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
      url: string;
      headers: {
        key: string;
        value: string;
        enabled: boolean;
      }[];
      params: {
        key: string;
        value: string;
        enabled: boolean;
      }[];
      auth: import('../auth').AuthConfig | undefined;
      body: string;
      body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
      body_raw: string | null;
      body_raw_open: boolean;
      pre_request_script: string;
      post_request_script: string;
      pre_request_scripts: import('../types').ScriptRef[] | undefined;
      post_request_scripts: import('../types').ScriptRef[] | undefined;
      comment: string;
      tags: string;
      color: string | null;
    },
    {
      harborclientVersion: 1;
      harborclientExport: 'request';
      name: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
      url: string;
      headers: {
        key: string;
        value: string;
        enabled: boolean;
      }[];
      params: {
        key: string;
        value: string;
        enabled: boolean;
      }[];
      body: string;
      body_type: 'none' | 'text' | 'json' | 'multipart' | 'urlencoded';
      body_raw: string | null;
      body_raw_open: boolean;
      pre_request_script: string;
      post_request_script: string;
      pre_request_scripts: import('../types').ScriptRef[] | undefined;
      post_request_scripts: import('../types').ScriptRef[] | undefined;
      comment: string;
      tags: string;
      color: string | null;
      uuid?: string | undefined;
      auth?: import('../auth').AuthConfig | undefined;
    }
  >
>;
/**
 * Maps a Zod validation failure to a user-facing request import error fragment.
 *
 * @param error - Zod error from requestExportSchema.safeParse.
 * @returns Message suffix after the "Invalid request file:" prefix.
 */
export declare function formatRequestImportError(error: z.ZodError): string;
/**
 * Validates portable environment export files for import.
 */
export declare const environmentExportSchema: z.ZodObject<
  {
    harborclientVersion: z.ZodLiteral<1>;
    harborclientExport: z.ZodLiteral<'environment'>;
    uuid: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    variables: z.ZodPipe<
      z.ZodDefault<z.ZodArray<z.ZodUnknown>>,
      z.ZodTransform<Variable[], unknown[]>
    >;
    color: z.ZodPipe<
      z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
      z.ZodTransform<string | null, string | null | undefined>
    >;
  },
  z.core.$strip
>;
/**
 * Maps a Zod validation failure to a user-facing environment import error fragment.
 *
 * @param error - Zod error from environmentExportSchema.safeParse.
 * @returns Message suffix after the "Invalid environment file:" prefix.
 */
export declare function formatEnvironmentImportError(error: z.ZodError): string;
/**
 * Validates portable collection or request run-results export files for import.
 */
export declare const runResultsExportSchema: z.ZodObject<
  {
    harborclientVersion: z.ZodLiteral<1>;
    harborclientExport: z.ZodEnum<{
      'collection-run-results': 'collection-run-results';
      'request-run-results': 'request-run-results';
    }>;
    delay: z.ZodNumber;
    stopOnFailure: z.ZodBoolean;
    environment: z.ZodObject<
      {
        mode: z.ZodEnum<{
          override: 'override';
          active: 'active';
        }>;
        id: z.ZodNullable<z.ZodNumber>;
        name: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >;
    collection: z.ZodOptional<
      z.ZodObject<
        {
          uuid: z.ZodString;
          name: z.ZodString;
          folderName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        },
        z.core.$strip
      >
    >;
    request: z.ZodOptional<
      z.ZodObject<
        {
          uuid: z.ZodString;
          name: z.ZodString;
          method: z.ZodEnum<{
            GET: 'GET';
            POST: 'POST';
            PUT: 'PUT';
            PATCH: 'PATCH';
            DELETE: 'DELETE';
            HEAD: 'HEAD';
            OPTIONS: 'OPTIONS';
          }>;
        },
        z.core.$strip
      >
    >;
    results: z.ZodArray<
      z.ZodObject<
        {
          requestId: z.ZodNumber;
          requestName: z.ZodString;
          requestMethod: z.ZodEnum<{
            GET: 'GET';
            POST: 'POST';
            PUT: 'PUT';
            PATCH: 'PATCH';
            DELETE: 'DELETE';
            HEAD: 'HEAD';
            OPTIONS: 'OPTIONS';
          }>;
          status: z.ZodEnum<{
            failed: 'failed';
            pending: 'pending';
            running: 'running';
            passed: 'passed';
            skipped: 'skipped';
          }>;
          httpStatus: z.ZodOptional<z.ZodNumber>;
          httpError: z.ZodOptional<z.ZodString>;
          testsPassed: z.ZodNumber;
          testsFailed: z.ZodNumber;
          response: z.ZodOptional<
            z.ZodNullable<
              z.ZodObject<
                {
                  status: z.ZodNumber;
                  statusText: z.ZodString;
                  headers: z.ZodRecord<z.ZodString, z.ZodString>;
                  body: z.ZodString;
                  bodyBase64: z.ZodOptional<z.ZodString>;
                  timeMs: z.ZodNumber;
                  sizeBytes: z.ZodNumber;
                  error: z.ZodOptional<z.ZodString>;
                  setCookieHeaders: z.ZodOptional<z.ZodArray<z.ZodString>>;
                  request: z.ZodOptional<z.ZodUnknown>;
                  timing: z.ZodOptional<z.ZodUnknown>;
                },
                z.core.$strip
              >
            >
          >;
          testResults: z.ZodOptional<
            z.ZodArray<
              z.ZodObject<
                {
                  name: z.ZodString;
                  passed: z.ZodBoolean;
                  error: z.ZodOptional<z.ZodString>;
                  scriptName: z.ZodOptional<z.ZodString>;
                },
                z.core.$strip
              >
            >
          >;
          scriptLogs: z.ZodOptional<z.ZodArray<z.ZodString>>;
          scriptError: z.ZodOptional<z.ZodString>;
          requestUrl: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
/**
 * Validates run-results payloads saved to storage providers.
 */
export declare const saveRunResultInputSchema: z.ZodObject<
  {
    label: z.ZodOptional<z.ZodString>;
    payload: z.ZodObject<
      {
        harborclientVersion: z.ZodLiteral<1>;
        harborclientExport: z.ZodEnum<{
          'collection-run-results': 'collection-run-results';
          'request-run-results': 'request-run-results';
        }>;
        delay: z.ZodNumber;
        stopOnFailure: z.ZodBoolean;
        environment: z.ZodObject<
          {
            mode: z.ZodEnum<{
              override: 'override';
              active: 'active';
            }>;
            id: z.ZodNullable<z.ZodNumber>;
            name: z.ZodNullable<z.ZodString>;
          },
          z.core.$strip
        >;
        collection: z.ZodOptional<
          z.ZodObject<
            {
              uuid: z.ZodString;
              name: z.ZodString;
              folderName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            },
            z.core.$strip
          >
        >;
        request: z.ZodOptional<
          z.ZodObject<
            {
              uuid: z.ZodString;
              name: z.ZodString;
              method: z.ZodEnum<{
                GET: 'GET';
                POST: 'POST';
                PUT: 'PUT';
                PATCH: 'PATCH';
                DELETE: 'DELETE';
                HEAD: 'HEAD';
                OPTIONS: 'OPTIONS';
              }>;
            },
            z.core.$strip
          >
        >;
        results: z.ZodArray<
          z.ZodObject<
            {
              requestId: z.ZodNumber;
              requestName: z.ZodString;
              requestMethod: z.ZodEnum<{
                GET: 'GET';
                POST: 'POST';
                PUT: 'PUT';
                PATCH: 'PATCH';
                DELETE: 'DELETE';
                HEAD: 'HEAD';
                OPTIONS: 'OPTIONS';
              }>;
              status: z.ZodEnum<{
                failed: 'failed';
                pending: 'pending';
                running: 'running';
                passed: 'passed';
                skipped: 'skipped';
              }>;
              httpStatus: z.ZodOptional<z.ZodNumber>;
              httpError: z.ZodOptional<z.ZodString>;
              testsPassed: z.ZodNumber;
              testsFailed: z.ZodNumber;
              response: z.ZodOptional<
                z.ZodNullable<
                  z.ZodObject<
                    {
                      status: z.ZodNumber;
                      statusText: z.ZodString;
                      headers: z.ZodRecord<z.ZodString, z.ZodString>;
                      body: z.ZodString;
                      bodyBase64: z.ZodOptional<z.ZodString>;
                      timeMs: z.ZodNumber;
                      sizeBytes: z.ZodNumber;
                      error: z.ZodOptional<z.ZodString>;
                      setCookieHeaders: z.ZodOptional<z.ZodArray<z.ZodString>>;
                      request: z.ZodOptional<z.ZodUnknown>;
                      timing: z.ZodOptional<z.ZodUnknown>;
                    },
                    z.core.$strip
                  >
                >
              >;
              testResults: z.ZodOptional<
                z.ZodArray<
                  z.ZodObject<
                    {
                      name: z.ZodString;
                      passed: z.ZodBoolean;
                      error: z.ZodOptional<z.ZodString>;
                      scriptName: z.ZodOptional<z.ZodString>;
                    },
                    z.core.$strip
                  >
                >
              >;
              scriptLogs: z.ZodOptional<z.ZodArray<z.ZodString>>;
              scriptError: z.ZodOptional<z.ZodString>;
              requestUrl: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/**
 * Maps a Zod validation failure to a user-facing run-results import error fragment.
 *
 * @param error - Zod error from runResultsExportSchema.safeParse.
 * @returns Message suffix after the "Invalid run results file:" prefix.
 */
export declare function formatRunResultsImportError(error: z.ZodError): string;
//# sourceMappingURL=schemas.d.ts.map
