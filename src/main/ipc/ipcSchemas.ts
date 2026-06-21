import { z } from 'zod';
import { authConfig, bodyType, httpMethod, keyValue, variable } from '#/main/schemas/common';
import type {
  DatabaseConnection,
  GeneralSettings,
  SaveRequestInput,
  ScriptRequestContext,
  ScriptRunInput,
  SendRequestInput,
  SendResult,
  SentRequest,
  SidebarExpansionState
} from '#/shared/types';

export {
  bodyType,
  httpMethod,
  keyValue,
  variable,
  authConfig,
  authType
} from '#/main/schemas/common';

/** Non-negative integer database row id. */
export const dbId = z.number().int().nonnegative();

/** UUID or opaque string connection / request id. */
export const connectionId = z.string();

export const requestId = z.string();
export const storageKey = z.string();
export const domain = z.string();
export const label = z.string();
export const token = z.string();
export const publicKeyPem = z.string();
export const name = z.string();

export const themeSource = z.enum(['light', 'dark', 'system']);

export const editorTab = z.enum([
  'params',
  'headers',
  'auth',
  'cookies',
  'body',
  'pre',
  'post',
  'comment'
]);

export const scriptPhase = z.enum(['pre', 'post']);

export const nullableFolderId = z.union([dbId, z.null()]);

export const saveRequestInput = z.object({
  id: dbId.optional(),
  collection_id: dbId,
  name: z.string(),
  method: httpMethod,
  url: z.string(),
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: z.string(),
  body_type: bodyType,
  pre_request_script: z.string(),
  post_request_script: z.string(),
  comment: z.string(),
  auth: authConfig,
  folder_id: nullableFolderId.optional()
}) satisfies z.ZodType<SaveRequestInput>;

export const sendRequestInput = z.object({
  method: httpMethod,
  url: z.string(),
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: z.string(),
  bodyType: bodyType
}) satisfies z.ZodType<SendRequestInput>;

export const sentRequest = z.object({
  method: httpMethod,
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  bodyType: bodyType.optional()
}) satisfies z.ZodType<SentRequest>;

export const sendResult = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  timeMs: z.number(),
  sizeBytes: z.number(),
  error: z.string().optional(),
  setCookieHeaders: z.array(z.string()).optional(),
  request: sentRequest.optional()
}) satisfies z.ZodType<SendResult>;

export const scriptRequestContext = z.object({
  method: httpMethod,
  url: z.string(),
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: z.string(),
  bodyType: bodyType
}) satisfies z.ZodType<ScriptRequestContext>;

export const scriptRunInput = z.object({
  phase: scriptPhase,
  script: z.string(),
  request: scriptRequestContext,
  response: sendResult.optional(),
  variables: z.record(z.string(), z.string()),
  collection: z
    .object({
      id: z.number().int().nullable(),
      name: z.string(),
      headers: z.array(keyValue)
    })
    .optional(),
  environment: z.object({ name: z.string() }).optional()
}) satisfies z.ZodType<ScriptRunInput>;

export const generalSettings = z.object({
  requestTimeoutMs: z.number(),
  maxResponseSizeMb: z.number(),
  verifySsl: z.boolean()
}) satisfies z.ZodType<GeneralSettings>;

const sqliteSettings = z.object({
  dbFilename: z.string(),
  legacyDbFilename: z.string(),
  legacyUserDataDir: z.string()
});

const firestoreSettings = z.object({
  apiKey: z.string(),
  authDomain: z.string(),
  projectId: z.string(),
  appId: z.string(),
  email: z.string(),
  password: z.string()
});

const mySqlSettings = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string()
});

const postgresSettings = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string()
});

export const databaseConnection = z.discriminatedUnion('type', [
  z.object({
    id: connectionId,
    name: z.string(),
    type: z.literal('sqlite'),
    settings: sqliteSettings
  }),
  z.object({
    id: connectionId,
    name: z.string(),
    type: z.literal('firestore'),
    settings: firestoreSettings
  }),
  z.object({
    id: connectionId,
    name: z.string(),
    type: z.literal('mysql'),
    settings: mySqlSettings
  }),
  z.object({
    id: connectionId,
    name: z.string(),
    type: z.literal('postgres'),
    settings: postgresSettings
  })
]) satisfies z.ZodType<DatabaseConnection>;

export const sidebarExpansion = z.object({
  sections: z.object({
    collections: z.boolean(),
    environments: z.boolean()
  }),
  collectionIds: z.array(dbId),
  folderIds: z.array(dbId)
}) satisfies z.ZodType<SidebarExpansionState>;

/** Tuple schemas for IPC handler argument validation. */
export const ipcArgSchemas = {
  none: z.tuple([]),
  name: z.tuple([name]),
  dbId: z.tuple([dbId]),
  collectionId: z.tuple([dbId]),
  connectionId: z.tuple([connectionId]),
  storageKey: z.tuple([storageKey]),
  domain: z.tuple([domain]),
  token: z.tuple([token]),
  label: z.tuple([label]),
  labelAndPublicKey: z.tuple([label, publicKeyPem]),
  themeSet: z.tuple([themeSource]),
  saveRequest: z.tuple([saveRequestInput]),
  sendRequest: z.tuple([sendRequestInput, requestId.optional()]),
  cancelRequest: z.tuple([requestId]),
  scriptRun: z.tuple([scriptRunInput]),
  generalSettings: z.tuple([generalSettings]),
  databaseConnection: z.tuple([databaseConnection]),
  setEditorTab: z.tuple([storageKey, editorTab]),
  sidebarExpansionSet: z.tuple([sidebarExpansion]),
  setCookies: z.tuple([domain, z.array(keyValue)]),
  collectionUpdate: z.tuple([
    dbId,
    name,
    z.array(variable),
    z.array(keyValue),
    z.string(),
    z.string(),
    authConfig
  ]),
  environmentUpdate: z.tuple([dbId, name, z.array(variable)]),
  collectionMove: z.tuple([dbId, connectionId]),
  collectionReorder: z.tuple([z.array(dbId)]),
  folderCreate: z.tuple([dbId, name]),
  folderRename: z.tuple([dbId, name]),
  folderReorder: z.tuple([dbId, z.array(dbId)]),
  requestReorder: z.tuple([dbId, nullableFolderId, z.array(dbId)]),
  requestMove: z.tuple([dbId, nullableFolderId, dbId]),
  inviteCreate: z.tuple([dbId, connectionId.optional()])
} as const;
