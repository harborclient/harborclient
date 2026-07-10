import { z } from 'zod';
import { scriptStage } from '#/main/schemas/scriptRef';
import {
  MAX_IPC_COMMENT_CHARS,
  MAX_IPC_REQUEST_BODY_CHARS,
  MAX_IPC_SCRIPT_CHARS,
  MAX_IPC_URL_CHARS
} from '#/main/ipc/ipcLimits';
import { HARD_MAX_RESPONSE_SIZE_MB } from '#/main/settings/generalSettings';
import {
  authConfig,
  bodyType,
  httpMethod,
  keyValue,
  oauth2Config,
  variable
} from '#/main/schemas/common';
import { ipcScriptRefArray, scriptSource } from '#/main/schemas/scriptRef';
import { CODE_EDITOR_THEME_IDS } from '#/shared/codeEditorSettings';
import {
  requestExportSchema,
  runResultsExportSchema,
  saveRunResultInputSchema
} from '#/main/storage/collectionSchemas';
import { customThemeSaveInputSchema } from '#/shared/plugin/customThemeExport';
import type {
  AiChatSessionState,
  AiSettings,
  AddChatMessageInput,
  ChatRole,
  ChatStepInput,
  CreateChatInput,
  GenerateChatTitleInput,
  StorageConnection,
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
  SidebarExpansionState,
  McpClientServer,
  McpServerSettings
} from '#/shared/types';
import type { CollectionRunnerConfig } from '#/shared/collectionRunner';
import { pluginSourcesSchema } from '#/shared/plugin/catalog';
import { AI_TOOL_NAMES } from '#/shared/ai/tools';

export {
  bodyType,
  httpMethod,
  keyValue,
  variable,
  authConfig,
  authType,
  oauth2Config
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
 * Fingerprint id of a trusted recipient public key for share tokens.
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

export const themeSource = z.union([
  z.enum(['light', 'dark', 'system', 'high-contrast']),
  z.string().regex(/^plugin:[^:]+:[^:]+$/),
  z.string().regex(/^custom:[^/\\]+$/)
]);

const themeMenuOption = z.object({
  value: themeSource,
  label: z.string().min(1)
});

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

export const snippetScope = z.enum(['pre-request', 'post-request', 'any']);

export const nullableFolderId = z.union([dbId, z.null()]);

/** Request body string bounded for IPC deserialization. */
const ipcRequestBody = z.string().max(MAX_IPC_REQUEST_BODY_CHARS);

/** Pre/post script source bounded for IPC. */
const ipcScriptSource = scriptSource;

/** Admin snippet create/update payload for Team Hub management routes. */
export const adminSnippetInput = z.object({
  name,
  code: ipcScriptSource,
  scope: snippetScope,
  stage: scriptStage.optional()
});

export { scriptRef, scriptStage } from '#/main/schemas/scriptRef';

/** URL string bounded for IPC. */
const ipcUrl = z.string().max(MAX_IPC_URL_CHARS);

/** Request comment/description bounded for IPC. */
const ipcComment = z.string().max(MAX_IPC_COMMENT_CHARS);

/** Request tags string bounded for IPC. */
const ipcTags = z.string().max(MAX_IPC_COMMENT_CHARS);

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
  pre_request_scripts: ipcScriptRefArray.optional().default([]),
  post_request_scripts: ipcScriptRefArray.optional().default([]),
  comment: ipcComment,
  tags: ipcTags,
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

const requestTimingPhases = z.object({
  stalledMs: z.number().optional(),
  connectMs: z.number().optional(),
  requestSentMs: z.number().optional(),
  waitingMs: z.number().optional(),
  downloadMs: z.number().optional()
});

export const sendResult = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  bodyBase64: z.string().optional(),
  timeMs: z.number(),
  sizeBytes: z.number(),
  error: z.string().optional(),
  setCookieHeaders: z.array(z.string()).optional(),
  request: sentRequest.optional(),
  timing: requestTimingPhases.optional()
}) satisfies z.ZodType<SendResult>;

export const scriptRequestContext = z.object({
  method: httpMethod,
  url: ipcUrl,
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: ipcRequestBody,
  bodyType: bodyType,
  auth: authConfig.optional()
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
      headers: z.array(keyValue),
      auth: authConfig.optional()
    })
    .optional(),
  environment: z.object({ name: z.string() }).optional(),
  cookies: z.array(keyValue).optional(),
  info: z
    .object({
      eventName: z.enum(['prerequest', 'test']),
      requestName: z.string(),
      requestId: z.string(),
      iteration: z.number().int().nonnegative()
    })
    .optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  snippetModules: z.record(z.string(), ipcScriptSource).optional(),
  snippetModuleConflicts: z.array(z.string()).optional()
}) satisfies z.ZodType<ScriptRunInput>;

export const generalSettings = z.object({
  requestTimeoutMs: z.number(),
  scriptTimeoutMs: z.number(),
  allowScriptNetworkRequests: z.boolean(),
  allowedNetworkPlugins: z.array(z.string()),
  maxResponseSizeMb: z.number().min(0).max(HARD_MAX_RESPONSE_SIZE_MB),
  verifySsl: z.boolean(),
  followRedirects: z.boolean(),
  scrollbarAutoHide: z.boolean(),
  warnWhenSwitchingThemes: z.boolean(),
  warnWhenExitingWithUnsavedChanges: z.boolean(),
  warnWhenClosingUnsavedRequests: z.boolean(),
  warnWhenEditingSnippet: z.boolean(),
  warnWhenCloningSnippet: z.boolean(),
  warnWhenClickingReadonlySnippet: z.boolean(),
  codeEditorTheme: z.enum(CODE_EDITOR_THEME_IDS),
  codeEditorSetup: z.object({
    lineNumbers: z.boolean(),
    foldGutter: z.boolean(),
    highlightActiveLine: z.boolean(),
    highlightActiveLineGutter: z.boolean()
  }),
  codeEditorFontSize: z.string(),
  proxy: z.object({
    enabled: z.boolean(),
    protocol: z.enum(['http', 'https']),
    host: z.string(),
    port: z.number().int().min(1).max(65535),
    authEnabled: z.boolean(),
    username: z.string(),
    password: z.string()
  }),
  globalVariables: z.array(variable),
  logFilePath: z.string()
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

const storageConnectionCommon = {
  id: connectionId,
  name: z.string(),
  collectionDiscoverySkipped: z.boolean().optional()
};

export const storageConnection = z.discriminatedUnion('type', [
  z.object({
    ...storageConnectionCommon,
    type: z.literal('sqlite'),
    settings: sqliteSettings
  }),
  z.object({
    ...storageConnectionCommon,
    type: z.literal('firestore'),
    settings: firestoreSettings
  }),
  z.object({
    ...storageConnectionCommon,
    type: z.literal('mysql'),
    settings: mySqlSettings
  }),
  z.object({
    ...storageConnectionCommon,
    type: z.literal('postgres'),
    settings: postgresSettings
  }),
  z.object({
    ...storageConnectionCommon,
    type: z.literal('git'),
    settings: gitSettings
  })
]) satisfies z.ZodType<StorageConnection>;

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
 * Zod schema for creating an invited Team Hub user sent over IPC.
 */
export const createInvitedHubUserInput = createHubUserInput.extend({
  expiresInHours: z.number().int().positive().optional()
});

/**
 * Zod schema for reissuing a Team Hub invitation sent over IPC.
 */
export const createUserInvitationInput = z.object({
  expiresInHours: z.number().int().positive().optional()
});

/**
 * Zod schema for public Team Hub invitation preview and redeem calls.
 */
export const teamHubInvitationPublic = z.tuple([
  z.string().trim().min(1),
  z.string().trim().min(1)
]);

/**
 * Zod schema for redeeming a Team Hub invitation with an optional token label.
 */
export const teamHubInvitationRedeem = z.tuple([
  z.string().trim().min(1),
  z.string().trim().min(1),
  z.string().trim().min(1).optional()
]);

/**
 * Zod schema for verifying a Team Hub bearer token against session introspection.
 */
export const teamHubSessionVerify = z.tuple([z.string().trim().min(1), z.string().trim().min(1)]);

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

/**
 * Zod schema for MCP client HTTP header rows.
 */
export const mcpClientHeader = z.object({
  key: z.string(),
  value: z.string()
});

/**
 * Zod schema for configured MCP client servers.
 */
export const mcpClientServer = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  url: z.string().trim().min(1),
  headers: z.array(mcpClientHeader),
  enabled: z.boolean()
}) satisfies z.ZodType<McpClientServer>;

/**
 * Zod schema for persisted MCP server settings.
 */
export const mcpServerSettings = z.object({
  enabled: z.boolean(),
  host: z.string().trim().min(1),
  port: z.number().int().positive(),
  token: z.string(),
  exposedTools: z.array(z.enum(AI_TOOL_NAMES))
}) satisfies z.ZodType<McpServerSettings>;

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

export const chatGenerateTitleInput = z.object({
  chatId: dbId,
  prompt: z.string().min(1),
  model: z.string().min(1),
  hubId: z.string().optional()
}) satisfies z.ZodType<GenerateChatTitleInput>;

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
  hubId: z.string().optional(),
  scriptAsk: z
    .object({
      code: z.string(),
      line: z.number().int().min(1),
      phase: z.enum(['pre', 'post'])
    })
    .optional(),
  chatTitlePrompt: z.string().optional()
}) satisfies z.ZodType<ChatStepInput>;

export const sidebarExpansion = z.object({
  sections: z.object({
    collections: z.boolean(),
    environments: z.boolean(),
    runResults: z.boolean()
  }),
  sectionVisibility: z.object({
    collections: z.boolean(),
    environments: z.boolean(),
    runResults: z.boolean()
  }),
  collectionIds: z.array(dbId),
  folderIds: z.array(dbId),
  showStorageLocationBadges: z.boolean()
}) satisfies z.ZodType<SidebarExpansionState>;

export const panelLayout = z.object({
  showSidebar: z.boolean(),
  showAiSidebar: z.boolean(),
  showRequestEditor: z.boolean(),
  showResponseEditor: z.boolean(),
  requestEditorSplitHeight: z.number().int().min(160)
}) satisfies z.ZodType<PanelLayoutState>;

export const aiChatSession = z.object({
  openTabIds: z.array(dbId),
  activeChatId: dbId.nullable(),
  enterToSend: z.boolean()
}) satisfies z.ZodType<AiChatSessionState>;

export const collectionRunnerConfig = z.object({
  delayMs: z.number().int().min(0),
  stopOnFailure: z.boolean(),
  environmentMode: z.enum(['active', 'override']),
  environmentId: dbId.nullable()
}) satisfies z.ZodType<CollectionRunnerConfig>;

export const shortcutOverrides = z.record(
  z.string(),
  z.string()
) satisfies z.ZodType<ShortcutOverrides>;

const pluginId = z.string().min(1);
const pluginEntryKind = z.enum(['renderer', 'main']);

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
  menuRequestEditorVisible: z.tuple([z.boolean()]),
  menuResponseEditorVisible: z.tuple([z.boolean()]),
  menuCollectionsVisible: z.tuple([z.boolean()]),
  menuEnvironmentsVisible: z.tuple([z.boolean()]),
  menuRunResultsVisible: z.tuple([z.boolean()]),
  menuThemeMenuState: z.tuple([themeSource, z.array(themeMenuOption)]),
  menuCreatorUndoRedo: z.tuple([z.boolean(), z.boolean(), z.boolean()]),
  menuPopupSubmenu: z.tuple([rootMenuLabel, z.number(), z.number()]),
  chatCreate: z.tuple([chatCreateInput]),
  chatGet: z.tuple([dbId]),
  chatAddMessage: z.tuple([chatAddMessageInput]),
  chatGenerateTitle: z.tuple([chatGenerateTitleInput]),
  chatCompleteStep: z.tuple([chatCompleteStepInput, requestId.optional()]),
  chatCancelStep: z.tuple([requestId]),
  chatDelete: z.tuple([dbId]),
  saveRequest: z.tuple([saveRequestInput]),
  sendRequest: z.tuple([sendRequestInput, requestId.optional()]),
  cancelRequest: z.tuple([requestId]),
  scriptRun: z.tuple([scriptRunInput]),
  generalSettings: z.tuple([generalSettings]),
  aiSettings: z.tuple([aiSettings]),
  mcpServerSettings: z.tuple([mcpServerSettings]),
  mcpClientServer: z.tuple([mcpClientServer]),
  mcpCallTool: z.tuple([z.string().min(1), z.unknown()]),
  searchDocs: z.tuple([
    z.object({
      query: z.string().min(1),
      limit: z.number().optional(),
      source: z.enum(['site', 'sdk']).optional()
    })
  ]),
  storageConnection: z.tuple([storageConnection]),
  teamHub: z.tuple([teamHub]),
  teamHubUserUpdate: z.tuple([connectionId, connectionId, updateHubUserInput]),
  teamHubUserDelete: z.tuple([connectionId, connectionId]),
  teamHubUserCreate: z.tuple([connectionId, createHubUserInput]),
  teamHubInvitedUserCreate: z.tuple([connectionId, createInvitedHubUserInput]),
  teamHubUserInvitationCreate: z.tuple([
    connectionId,
    connectionId,
    createUserInvitationInput.optional()
  ]),
  teamHubInvitationList: z.tuple([connectionId]),
  teamHubInvitationRevoke: z.tuple([connectionId, z.string().min(1)]),
  teamHubInvitationPreview: teamHubInvitationPublic,
  teamHubInvitationRedeem: teamHubInvitationRedeem,
  teamHubSessionVerify: teamHubSessionVerify,
  teamHubTokenList: z.tuple([connectionId]),
  teamHubTokenCreate: z.tuple([connectionId, connectionId, createHubTokenInput]),
  teamHubTokenDelete: z.tuple([connectionId, connectionId]),
  teamHubCollectionDelete: z.tuple([connectionId, z.string().min(1)]),
  teamHubCollectionContents: z.tuple([connectionId, z.string().min(1)]),
  teamHubRequestDelete: z.tuple([connectionId, z.string().min(1)]),
  teamHubEnvironmentDelete: z.tuple([connectionId, z.string().min(1)]),
  teamHubCollectionDeletionLocked: z.tuple([connectionId, z.string().min(1), z.boolean()]),
  teamHubEnvironmentDeletionLocked: z.tuple([connectionId, z.string().min(1), z.boolean()]),
  teamHubSnippetList: z.tuple([connectionId]),
  teamHubSnippetCreate: z.tuple([connectionId, adminSnippetInput]),
  teamHubSnippetUpdate: z.tuple([connectionId, z.string().min(1), adminSnippetInput]),
  teamHubSnippetDelete: z.tuple([connectionId, z.string().min(1)]),
  teamHubRunResultList: z.tuple([connectionId]),
  teamHubRunResultDelete: z.tuple([connectionId, z.string().min(1)]),
  providerSync: z.tuple([connectionId]),
  providerListUnregisteredCollections: z.tuple([connectionId]),
  providerRegisterDiscoveredCollections: z.tuple([
    connectionId,
    z.array(z.number().int().positive())
  ]),
  providerMarkCollectionDiscoverySkipped: z.tuple([connectionId]),
  setEditorTab: z.tuple([storageKey, editorTab]),
  setPageSidebarSection: z.tuple([storageKey, z.string().min(1)]),
  sidebarExpansionSet: z.tuple([sidebarExpansion]),
  panelLayoutSet: z.tuple([panelLayout]),
  openTabsPayloadSet: z.tuple([z.string().min(1)]),
  autocompleteList: z.tuple([z.string().min(1)]),
  autocompleteAdd: z.tuple([z.string().min(1), z.string()]),
  aiChatSessionSet: z.tuple([aiChatSession]),
  collectionRunnerConfigSet: z.tuple([collectionRunnerConfig]),
  shortcutOverridesSet: z.tuple([shortcutOverrides]),
  setCookies: z.tuple([domain, z.array(keyValue)]),
  collectionUpdate: z.tuple([
    dbId,
    name,
    z.array(variable),
    z.array(keyValue),
    z.string(),
    z.string(),
    authConfig,
    ipcScriptRefArray,
    ipcScriptRefArray
  ]),
  snippetCreate: z.tuple([
    name,
    ipcScriptSource,
    snippetScope,
    scriptStage.optional(),
    connectionId.optional()
  ]),
  snippetUpdate: z.tuple([dbId, name, ipcScriptSource, snippetScope, scriptStage.optional()]),
  snippetMove: z.tuple([dbId, connectionId]),
  importSnippetFile: z.tuple([z.boolean().optional()]),
  snippetInstallFromGit: z.tuple([z.string().min(1), z.string().min(1).optional()]),
  snippetInstallFromPath: z.tuple([z.string().min(1)]),
  snippetLoadUnpackedFromPath: z.tuple([z.string().min(1)]),
  snippetPreviewFromGit: z.tuple([z.string().min(1), z.string().min(1).optional()]),
  snippetCatalogId: z.tuple([z.string().min(1)]),
  environmentUpdate: z.tuple([dbId, name, z.array(variable)]),
  collectionMove: z.tuple([dbId, connectionId]),
  collectionReorder: z.tuple([z.array(dbId)]),
  environmentReorder: z.tuple([z.array(dbId)]),
  folderCreate: z.tuple([dbId, name]),
  folderRename: z.tuple([dbId, name]),
  folderUpdate: z.tuple([
    dbId,
    name,
    z.array(variable),
    z.array(keyValue),
    z.string(),
    z.string(),
    authConfig,
    ipcScriptRefArray,
    ipcScriptRefArray
  ]),
  folderReorder: z.tuple([dbId, z.array(dbId)]),
  requestReorder: z.tuple([dbId, nullableFolderId, z.array(dbId)]),
  requestMove: z.tuple([dbId, nullableFolderId, dbId]),
  requestExport: z.tuple([requestExportSchema]),
  runResultsExport: z.tuple([runResultsExportSchema]),
  runResultsSave: z.tuple([z.string().min(1), saveRunResultInputSchema]),
  runResultUuid: z.tuple([z.string().uuid()]),
  requestImport: z.tuple([dbId, nullableFolderId.optional()]),
  importAuto: z.tuple([dbId.nullable()]),
  shareCreate: z.tuple([dbId, recipientKid.optional()]),
  openDirectory: z.tuple([z.string()]),
  saveFile: z.tuple([z.string()]),
  saveTextFile: z.tuple([z.string().max(MAX_IPC_REQUEST_BODY_CHARS), z.string()]),
  backupExport: z.tuple([z.record(z.string(), z.string())]),
  gitCommit: z.tuple([connectionId, z.string().trim().min(1), z.boolean().optional()]),
  gitLog: z.tuple([connectionId, z.number().int().positive().optional()]),
  gitSetPat: z.tuple([connectionId, z.string(), z.string().min(1)]),
  pluginId: z.tuple([pluginId]),
  pluginSetEnabled: z.tuple([pluginId, z.boolean()]),
  pluginInstallFromPath: z.tuple([z.string().min(1)]),
  pluginInstallFromGit: z.tuple([z.string().min(1), z.string().min(1).optional()]),
  pluginPreviewFromGit: z.tuple([z.string().min(1), z.string().min(1).optional()]),
  pluginLoadUnpackedFromPath: z.tuple([z.string().min(1)]),
  pluginSources: z.tuple([pluginSourcesSchema]),
  pluginReadEntry: z.tuple([pluginId, pluginEntryKind]),
  pluginReadAsset: z.tuple([pluginId, z.string().min(1)]),
  pluginStorageKey: z.tuple([pluginId, z.string().min(1)]),
  pluginStorageSet: z.tuple([pluginId, z.string().min(1), z.unknown()]),
  pluginDbQuery: z.tuple([
    pluginId,
    z.enum(['get', 'all', 'run']),
    z.string().min(1).max(MAX_IPC_SCRIPT_CHARS),
    z.array(z.unknown()).optional(),
    z.string().min(1).optional()
  ]),
  pluginDbExec: z.tuple([pluginId, z.string().min(1).max(MAX_IPC_SCRIPT_CHARS)]),
  pluginDbTxBegin: z.tuple([pluginId]),
  pluginDbTxEnd: z.tuple([pluginId, z.string().min(1), z.enum(['commit', 'rollback'])]),
  pluginActivateMain: z.tuple([pluginId]),
  pluginReportRuntimeError: z.tuple([
    pluginId,
    z.string().nullable(),
    z.string().max(MAX_IPC_COMMENT_CHARS).optional()
  ]),
  pluginInvokeMain: z.tuple([pluginId, z.string().min(1), z.array(z.unknown())]),
  pluginMenuContributions: z.tuple([
    z.array(
      z.object({
        pluginId: pluginId,
        menu: z.enum(['file', 'edit', 'view', 'help']),
        command: z.string().min(1),
        label: z.string().optional(),
        group: z.string().optional(),
        order: z.number().optional()
      })
    )
  ]),
  pluginFsPickFile: z.tuple([
    pluginId,
    z
      .object({
        title: z.string().optional(),
        multiple: z.boolean().optional(),
        filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional()
      })
      .optional()
  ]),
  pluginFsPickDirectory: z.tuple([pluginId, z.string()]),
  pluginFsSaveFile: z.tuple([
    pluginId,
    z.string().max(MAX_IPC_REQUEST_BODY_CHARS),
    z
      .object({
        defaultPath: z.string().optional(),
        filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional()
      })
      .optional()
  ]),
  pluginFsReadFile: z.tuple([pluginId, z.string().min(1)]),
  pluginFsWriteFile: z.tuple([
    pluginId,
    z.string().min(1),
    z.string().max(MAX_IPC_REQUEST_BODY_CHARS)
  ]),
  pluginFsWatchFile: z.tuple([pluginId, z.string().min(1)]),
  pluginFsUnwatchFile: z.tuple([pluginId, z.string().min(1)]),
  pluginPushViewContext: z.tuple([
    z.object({
      pluginId: z.string().min(1),
      contributionId: z.string().min(1),
      kind: z.string().min(1),
      context: z.unknown()
    })
  ]),
  pluginPushHttpAfterSend: z.tuple([
    z.object({
      request: z.object({
        method: z.string(),
        url: z.string(),
        headers: z.record(z.string(), z.string()),
        body: z.string(),
        bodyType: z.string().optional(),
        params: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
        sourceRequestId: z.number().optional(),
        sourceRequestName: z.string().optional()
      }),
      response: z.object({
        status: z.number(),
        statusText: z.string(),
        headers: z.record(z.string(), z.string()),
        body: z.string()
      })
    })
  ]),
  pluginExecuteAgentCommand: z.tuple([pluginId, z.string().min(1), z.array(z.unknown())]),
  oauthFetchToken: z.tuple([z.string(), oauth2Config, z.boolean()]),
  oauthClearToken: z.tuple([z.string().min(1)]),
  customThemeId: z.tuple([
    z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .min(1)
      .max(128)
  ]),
  customThemeSave: z.tuple([customThemeSaveInputSchema]),
  inspectElement: z.tuple([z.object({ x: z.number(), y: z.number() })])
} as const;
