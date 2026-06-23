import { z } from 'zod';
import {
  MAX_IPC_COMMENT_CHARS,
  MAX_IPC_REQUEST_BODY_CHARS,
  MAX_IPC_SCRIPT_CHARS,
  MAX_IPC_URL_CHARS
} from '#/main/ipc/ipcLimits';
import { HARD_MAX_RESPONSE_SIZE_MB } from '#/main/settings/generalSettings';
import { authConfig, bodyType, httpMethod, keyValue, variable } from '#/main/schemas/common';
import { CODE_EDITOR_THEME_IDS } from '#/shared/codeEditorSettings';
import { requestExportSchema } from '#/main/db/collectionSchemas';
import type {
  AiChatSessionState,
  AiSettings,
  AddChatMessageInput,
  ChatRole,
  ChatStepInput,
  CreateChatInput,
  DatabaseConnection,
  GeneralSettings,
  PanelLayoutState,
  SaveRequestInput,
  ScriptRequestContext,
  ScriptRunInput,
  SendRequestInput,
  SendResult,
  SentRequest,
  TeamHub,
  ShortcutOverrides,
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

/**
 * Non-negative integer database row id.
 */
export const dbId = z.number().int().nonnegative();

/**
 * UUID or opaque string connection / request id.
 */
export const connectionId = z.string();

/**
 * Fingerprint id of a trusted recipient public key for invite tokens.
 */
export const recipientKid = z.string().min(1);

export const requestId = z.string();
export const storageKey = z.string();
export const domain = z.string();
export const label = z.string();
export const token = z.string();
export const publicKeyPem = z.string();
/**
 * Non-empty display name after trimming whitespace.
 */
export const name = z.string().trim().min(1, 'name is required');

export const themeSource = z.enum(['light', 'dark', 'system', 'high-contrast']);

export const rootMenuLabel = z.enum(['File', 'Edit', 'View', 'Help']);

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

/** Request body string bounded for IPC deserialization. */
const ipcRequestBody = z.string().max(MAX_IPC_REQUEST_BODY_CHARS);

/** Pre/post script source bounded for IPC. */
const ipcScriptSource = z.string().max(MAX_IPC_SCRIPT_CHARS);

/** URL string bounded for IPC. */
const ipcUrl = z.string().max(MAX_IPC_URL_CHARS);

/** Request comment/description bounded for IPC. */
const ipcComment = z.string().max(MAX_IPC_COMMENT_CHARS);

export const saveRequestInput = z.object({
  id: dbId.optional(),
  collection_id: dbId,
  name: z.string().trim().min(1, 'request name is required'),
  method: httpMethod,
  url: ipcUrl,
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: ipcRequestBody,
  body_type: bodyType,
  pre_request_script: ipcScriptSource,
  post_request_script: ipcScriptSource,
  comment: ipcComment,
  auth: authConfig,
  folder_id: nullableFolderId.optional()
}) satisfies z.ZodType<SaveRequestInput>;

export const sendRequestInput = z.object({
  method: httpMethod,
  url: ipcUrl,
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: ipcRequestBody,
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
  url: ipcUrl,
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: ipcRequestBody,
  bodyType: bodyType
}) satisfies z.ZodType<ScriptRequestContext>;

export const scriptRunInput = z.object({
  phase: scriptPhase,
  script: ipcScriptSource,
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
  maxResponseSizeMb: z.number().min(0).max(HARD_MAX_RESPONSE_SIZE_MB),
  verifySsl: z.boolean(),
  codeEditorTheme: z.enum(CODE_EDITOR_THEME_IDS),
  codeEditorSetup: z.object({
    lineNumbers: z.boolean(),
    foldGutter: z.boolean(),
    highlightActiveLine: z.boolean(),
    highlightActiveLineGutter: z.boolean()
  }),
  proxy: z.object({
    enabled: z.boolean(),
    protocol: z.enum(['http', 'https']),
    host: z.string(),
    port: z.number().int().min(1).max(65535),
    authEnabled: z.boolean(),
    username: z.string(),
    password: z.string()
  })
}) satisfies z.ZodType<GeneralSettings>;

/**
 * Single directory name safe for `join(parentDir, segment, ...)`.
 * Rejects path separators and `.` / `..` so IPC cannot escape the parent.
 */
const singlePathSegment = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\'),
    { message: 'must be a single path segment' }
  );

const sqliteSettings = z.object({
  dbFilename: z.string(),
  legacyDbFilename: z.string(),
  legacyUserDataDir: singlePathSegment
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

const gitAuthMethod = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pat'),
    username: z.string()
  }),
  z.object({
    kind: z.literal('oauth'),
    provider: z.literal('github')
  })
]);

const gitSettings = z.object({
  repoPath: z.string(),
  url: z.string(),
  branch: z.string(),
  subdir: z.string(),
  oauthClientId: z.string().optional(),
  auth: gitAuthMethod
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
  }),
  z.object({
    id: connectionId,
    name: z.string(),
    type: z.literal('git'),
    settings: gitSettings
  })
]) satisfies z.ZodType<DatabaseConnection>;

/**
 * Zod schema for a persisted team hub connection.
 */
export const teamHub = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  baseUrl: z.string().trim().min(1),
  token: z.string().trim().min(1)
}) satisfies z.ZodType<TeamHub>;

/**
 * Zod schema for partial Team Hub user updates sent over IPC.
 */
export const updateHubUserInput = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'user']).optional(),
  collectionAccess: z.array(z.string()).optional(),
  environmentAccess: z.array(z.string()).optional(),
  llmAccess: z.boolean().optional(),
  llmModels: z.array(z.string()).optional(),
  llmMonthlyTokenLimit: z.number().int().nonnegative().nullable().optional()
});

/**
 * Zod schema for creating a Team Hub user sent over IPC.
 */
export const createHubUserInput = z.object({
  name: z.string().trim().min(1),
  role: z.enum(['admin', 'user']),
  collectionAccess: z.array(z.string()).optional(),
  environmentAccess: z.array(z.string()).optional(),
  llmAccess: z.boolean().optional(),
  llmModels: z.array(z.string()).optional(),
  llmMonthlyTokenLimit: z.number().int().nonnegative().nullable().optional()
});

/**
 * Zod schema for creating a Team Hub API token sent over IPC.
 */
export const createHubTokenInput = z.object({
  name: z.string().trim().min(1)
});

/**
 * Zod schema for persisted AI provider API keys.
 */
export const aiSettings = z.object({
  openaiApiKey: z.string(),
  claudeApiKey: z.string(),
  geminiApiKey: z.string()
}) satisfies z.ZodType<AiSettings>;

export const chatRole = z.enum(['user', 'assistant']) satisfies z.ZodType<ChatRole>;

export const chatCreateInput = z.object({
  title: z.string().optional(),
  model: z.string().optional()
}) satisfies z.ZodType<CreateChatInput>;

export const chatAddMessageInput = z.object({
  chatId: dbId,
  role: chatRole,
  content: z.string(),
  model: z.string().optional()
}) satisfies z.ZodType<AddChatMessageInput>;

export const chatCompleteStepInput = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant', 'tool']),
      content: z.string().nullable().optional(),
      tool_calls: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            arguments: z.string()
          })
        )
        .optional(),
      tool_call_id: z.string().optional(),
      name: z.string().optional()
    })
  ),
  hubId: z.string().optional()
}) satisfies z.ZodType<ChatStepInput>;

export const sidebarExpansion = z.object({
  sections: z.object({
    collections: z.boolean(),
    environments: z.boolean()
  }),
  collectionIds: z.array(dbId),
  folderIds: z.array(dbId)
}) satisfies z.ZodType<SidebarExpansionState>;

export const panelLayout = z.object({
  showSidebar: z.boolean(),
  showAiSidebar: z.boolean()
}) satisfies z.ZodType<PanelLayoutState>;

export const aiChatSession = z.object({
  openTabIds: z.array(dbId),
  activeChatId: dbId.nullable()
}) satisfies z.ZodType<AiChatSessionState>;

export const shortcutOverrides = z.record(
  z.string(),
  z.string()
) satisfies z.ZodType<ShortcutOverrides>;

/**
 * Tuple schemas for IPC handler argument validation.
 */
export const ipcArgSchemas = {
  none: z.tuple([]),
  name: z.tuple([name]),
  collectionCreate: z.tuple([name, connectionId.optional()]),
  dbId: z.tuple([dbId]),
  collectionId: z.tuple([dbId]),
  connectionId: z.tuple([connectionId]),
  storageKey: z.tuple([storageKey]),
  domain: z.tuple([domain]),
  token: z.tuple([token]),
  label: z.tuple([label]),
  labelAndPublicKey: z.tuple([label, publicKeyPem]),
  themeSet: z.tuple([themeSource]),
  closeDecision: z.tuple([z.boolean()]),
  menuSidebarVisible: z.tuple([z.boolean()]),
  menuAiSidebarVisible: z.tuple([z.boolean()]),
  menuPopupSubmenu: z.tuple([rootMenuLabel, z.number(), z.number()]),
  chatCreate: z.tuple([chatCreateInput]),
  chatGet: z.tuple([dbId]),
  chatAddMessage: z.tuple([chatAddMessageInput]),
  chatCompleteStep: z.tuple([chatCompleteStepInput]),
  chatDelete: z.tuple([dbId]),
  saveRequest: z.tuple([saveRequestInput]),
  sendRequest: z.tuple([sendRequestInput, requestId.optional()]),
  cancelRequest: z.tuple([requestId]),
  scriptRun: z.tuple([scriptRunInput]),
  generalSettings: z.tuple([generalSettings]),
  aiSettings: z.tuple([aiSettings]),
  databaseConnection: z.tuple([databaseConnection]),
  teamHub: z.tuple([teamHub]),
  teamHubUserUpdate: z.tuple([connectionId, connectionId, updateHubUserInput]),
  teamHubUserDelete: z.tuple([connectionId, connectionId]),
  teamHubUserCreate: z.tuple([connectionId, createHubUserInput]),
  teamHubTokenList: z.tuple([connectionId]),
  teamHubTokenCreate: z.tuple([connectionId, connectionId, createHubTokenInput]),
  teamHubTokenDelete: z.tuple([connectionId, connectionId]),
  providerSync: z.tuple([connectionId]),
  setEditorTab: z.tuple([storageKey, editorTab]),
  sidebarExpansionSet: z.tuple([sidebarExpansion]),
  panelLayoutSet: z.tuple([panelLayout]),
  aiChatSessionSet: z.tuple([aiChatSession]),
  shortcutOverridesSet: z.tuple([shortcutOverrides]),
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
  requestExport: z.tuple([requestExportSchema]),
  requestImport: z.tuple([dbId, nullableFolderId.optional()]),
  importAuto: z.tuple([dbId.nullable()]),
  inviteCreate: z.tuple([dbId, recipientKid.optional()]),
  saveTextFile: z.tuple([z.string().max(MAX_IPC_REQUEST_BODY_CHARS), z.string()]),
  gitCommit: z.tuple([connectionId, z.string().trim().min(1)]),
  gitLog: z.tuple([connectionId, z.number().int().positive().optional()]),
  gitSetPat: z.tuple([connectionId, z.string(), z.string().min(1)])
} as const;
