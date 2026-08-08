import { z } from 'zod';
import { scriptStage } from '#/main/schemas/scriptRef';
import {
  MAX_IPC_COMMENT_CHARS,
  MAX_IPC_DOCUMENT_CHARS,
  MAX_IPC_REQUEST_BODY_CHARS,
  MAX_IPC_SCRIPT_CHARS,
  MAX_IPC_URL_CHARS
} from './ipcLimits';
import { HARD_MAX_RESPONSE_SIZE_MB } from '#/main/settings/generalSettings';
import {
  authConfig,
  bodyType,
  httpMethod,
  keyValue,
  oauth2Config,
  requestProtocol,
  variable
} from '#/main/schemas/common';
import {
  ipcLiveServerScriptRefArray,
  ipcScriptRefArray,
  scriptSource
} from '#/main/schemas/scriptRef';
import { CODE_EDITOR_THEME_IDS } from '@harborclient/core/codeEditorSettings';
import { workspaceLayoutSchema } from '@harborclient/core/types/workspace';
import { MAX_ZOOM_FACTOR, MIN_ZOOM_FACTOR } from '@harborclient/core/zoomPresets';
import {
  requestExportSchema,
  runResultsExportSchema,
  saveRunResultInputSchema
} from '#/main/storage/collectionSchemas';
import { customThemeSaveInputSchema } from '@harborclient/core/plugin/customThemeExport';
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
  SaveDocumentInput,
  SaveRequestInput,
  ScriptRequestContext,
  ScriptRunInput,
  SendRequestInput,
  SendResult,
  SentRequest,
  TeamHub,
  ShortcutOverrides,
  SidebarExpansionState,
  RequestHistoryEntry,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  CreateWebsiteInput,
  UpdateWebsiteInput,
  CreateLiveServerInput,
  UpdateLiveServerInput,
  StartLiveServerInput,
  CreateWorkspaceInput,
  McpClientServer,
  McpServerSettings
} from '@harborclient/core/types';
import type { CollectionRunnerConfig } from '@harborclient/core/collectionRunner';
import { pluginSourcesSchema } from '@harborclient/core/plugin/catalog';
import { apisIoCollectionSchema } from '@harborclient/core/apisio/catalog';
import { AI_TOOL_NAMES } from '@harborclient/core/ai/tools';
import { isAbsoluteRepoPath, isGitDirectoryPath } from '#/main/git/repoRelativePath';
import { pathHasParentSegment } from '#/main/pathHasParentSegment';

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
 * Repository-relative file path for git IPC channels.
 *
 * Rejects empty values, absolute paths, parent-directory segments, and `.git`
 * targets. Full realpath confinement still happens in the handler/manager.
 */
export const repoRelativeFilePath = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      !isAbsoluteRepoPath(value) && !pathHasParentSegment(value) && !isGitDirectoryPath(value),
    { message: 'Invalid repository file path' }
  );

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

/**
 * Optional sidebar item marker for IPC setMarker handlers.
 */
export const sidebarMarker = z.union([z.string().trim().min(1), z.null()]);

export const themeSource = z.union([
  z.enum(['light', 'dark', 'system', 'high-contrast']),
  z.string().regex(/^plugin:[^:]+:[^:]+$/),
  z.string().regex(/^custom:[^/\\]+$/)
]);

const themeMenuOption = z.object({
  value: themeSource,
  label: z.string().min(1)
});

export const zoomFactor = z.number().min(MIN_ZOOM_FACTOR).max(MAX_ZOOM_FACTOR);

export const rootMenuLabel = z.enum(['File', 'Edit', 'View', 'Team', 'Git', 'Help']);

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

export const liveServerSettingsTab = z.enum([
  'general',
  'proxy',
  'headers',
  'routing',
  'run',
  'ssl',
  'scripts'
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

export { liveServerScriptRef, scriptRef, scriptStage } from '#/main/schemas/scriptRef';

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
  protocol: requestProtocol,
  method: httpMethod,
  url: ipcUrl,
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: ipcRequestBody,
  body_type: bodyType,
  body_raw: z.string().nullable().optional().default(null),
  body_raw_open: z.boolean().optional().default(false),
  pre_request_script: ipcScriptSource,
  post_request_script: ipcScriptSource,
  pre_request_scripts: ipcScriptRefArray.optional().default([]),
  post_request_scripts: ipcScriptRefArray.optional().default([]),
  comment: ipcComment,
  tags: ipcTags,
  auth: authConfig,
  /**
   * Request-level User-Agent override; empty inherits folder → collection → global.
   */
  userAgent: z.string().optional(),
  folder_id: nullableFolderId.optional()
}) satisfies z.ZodType<SaveRequestInput>;

/** Markdown document content bounded for IPC. */
const ipcDocumentContent = z.string().max(MAX_IPC_DOCUMENT_CHARS);

export const saveDocumentInput = z.object({
  id: dbId.optional(),
  collection_id: dbId,
  uuid: z.string().uuid().optional(),
  folder_id: nullableFolderId.optional(),
  name: z.string().trim().min(1, 'document name is required'),
  content: ipcDocumentContent.optional(),
  sort_order: z.number().int().nonnegative().optional()
}) satisfies z.ZodType<SaveDocumentInput>;

export const sendRequestInput = z.object({
  method: httpMethod,
  url: ipcUrl,
  headers: z.array(keyValue),
  params: z.array(keyValue),
  body: ipcRequestBody,
  bodyType: bodyType,
  bodyRaw: z.string().optional()
}) satisfies z.ZodType<SendRequestInput>;

/**
 * Input for opening an SSE session from the renderer.
 */
export const sessionOpenInput = z.object({
  protocol: z.literal('sse'),
  url: ipcUrl,
  headers: z.array(keyValue),
  params: z.array(keyValue),
  lastEventId: z.string().optional(),
  reconnect: z.boolean().optional()
});

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
      connectionId: z.string().nullable().optional(),
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
      iteration: z.number().int().nonnegative(),
      workflowId: z.string(),
      workflowActionId: z.string(),
      workflowActionIteration: z.number().int(),
      livepageId: z.string(),
      liveserverId: z.string()
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
  allowScriptFileRead: z.boolean(),
  allowScriptFileWrite: z.boolean(),
  allowScriptWebpage: z.boolean(),
  scriptFileRoot: z.string(),
  workflowResultsDirectory: z.string(),
  maxResponseSizeMb: z.number().min(0).max(HARD_MAX_RESPONSE_SIZE_MB),
  verifySsl: z.boolean(),
  followRedirects: z.boolean(),
  startWebpageUrl: z.string(),
  scrollbarAutoHide: z.boolean(),
  wrapTabs: z.boolean(),
  closeToTray: z.boolean(),
  spellCheckEnabled: z.boolean(),
  warnWhenSwitchingThemes: z.boolean(),
  warnWhenExitingWithUnsavedChanges: z.boolean(),
  warnWhenClosingUnsavedRequests: z.boolean(),
  warnWhenEditingSnippet: z.boolean(),
  warnWhenCloningSnippet: z.boolean(),
  warnWhenClickingReadonlySnippet: z.boolean(),
  warnWhenCreatingWorkspace: z.boolean(),
  warnWhenOpeningWorkspace: z.boolean(),
  warnWhenAgentUsesTerminal: z.boolean(),
  trustedExternalDomains: z.array(
    z.object({
      domain: z.string(),
      enabled: z.boolean()
    })
  ),
  allowAllExternalDomains: z.boolean(),
  dismissedRequestEditorNotices: z.array(editorTab),
  dismissedLiveServerNotices: z.array(liveServerSettingsTab),
  gitAutoAdd: z.boolean(),
  externalMergeEditorPath: z.string(),
  gitCommitAuthorName: z.string(),
  gitCommitAuthorEmail: z.string(),
  gitCommitAuthorPrompted: z.boolean(),
  codeEditorTheme: z.enum(CODE_EDITOR_THEME_IDS),
  codeEditorSetup: z.object({
    lineNumbers: z.boolean(),
    foldGutter: z.boolean(),
    highlightActiveLine: z.boolean(),
    highlightActiveLineGutter: z.boolean()
  }),
  codeEditorFontSize: z.string(),
  terminal: z.object({
    scrollback: z.number().min(0),
    cursorBlink: z.boolean(),
    blinkIntervalDuration: z.number().min(0),
    cursorStyle: z.enum(['block', 'underline', 'bar']),
    fastScrollSensitivity: z.number().min(0),
    fontSize: z.number().min(1),
    fontFamily: z.string(),
    fontWeight: z.enum([
      'normal',
      'bold',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900'
    ]),
    minimumContrastRatio: z.number().min(0),
    screenReaderMode: z.boolean()
  }),
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
  logFilePath: z.string(),
  /**
   * Global default User-Agent when no scoped override is set.
   */
  userAgent: z.string(),
  /**
   * User-added User-Agent presets merged with built-ins in the UI.
   */
  customUserAgents: z.array(z.string())
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
 * Zod schema for a machine-local companion-process runtime.
 */
export const runtime = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['node', 'php', 'python']),
  version: z.string(),
  path: z.string(),
  env: z.array(keyValue)
});

/**
 * Zod schema for verifying a runtime executable path.
 */
export const verifyRuntimeInput = z.object({
  kind: z.enum(['node', 'php', 'python']),
  version: z.string(),
  path: z.string()
});

/**
 * Zod schema for a persisted team hub connection.
 */
export const teamHub = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  baseUrl: z.string().trim().min(1),
  token: z.string().trim().min(1),
  tenantId: z.string().optional()
}) satisfies z.ZodType<TeamHub>;

/**
 * Zod schema for partial Team Hub user updates sent over IPC.
 */
export const updateHubUserInput = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'user']).optional(),
  avatarInitials: z.string().trim().min(1).max(2).optional(),
  avatarColor: z.string().trim().min(1).optional(),
  imageDataUrl: z.string().nullable().optional(),
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
 * Zod schema for Team Hub discussion entity targets sent over IPC.
 */
export const teamHubDiscussionTarget = z.object({
  entityType: z.enum(['request', 'collection', 'folder', 'runResult']),
  entityId: z.string().min(1)
});

/**
 * Zod schema for optional discussion list pagination sent over IPC.
 */
export const teamHubDiscussionListQuery = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().positive().optional()
  })
  .optional();

/**
 * Zod schema for creating or replying to a Team Hub discussion comment.
 */
export const teamHubDiscussionCreateInput = z.object({
  body: z.string(),
  parentCommentId: z.string().optional()
});

/**
 * Zod schema for updating a Team Hub discussion comment body.
 */
export const teamHubDiscussionUpdateInput = z.object({
  body: z.string()
});

/**
 * Zod schema for optional notice list pagination sent over IPC.
 */
export const teamHubNoticeListQuery = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().positive().optional()
  })
  .optional();

/**
 * Zod schema for updating Team Hub notification settings over IPC.
 */
export const teamHubNotificationSettingsUpdateInput = z.object({
  level: z.enum(['all', 'mentions', 'none'])
});

/**
 * Zod schema for updating the authenticated user's Team Hub avatar over IPC.
 */
export const updateMyAvatarInput = z
  .object({
    initials: z.string().trim().min(1).max(2).optional(),
    color: z.string().optional(),
    imageDataUrl: z.string().nullable().optional()
  })
  .refine(
    (body) => body.initials != null || body.color != null || body.imageDataUrl !== undefined,
    {
      message: 'At least one of initials, color, or imageDataUrl is required.'
    }
  );

/**
 * Zod schema for updating the Team Hub server avatar over IPC.
 */
export const updateHubAvatarInput = z
  .object({
    initials: z.string().trim().min(1).max(2).optional(),
    color: z.string().optional(),
    imageDataUrl: z.string().nullable().optional()
  })
  .refine(
    (body) => body.initials != null || body.color != null || body.imageDataUrl !== undefined,
    {
      message: 'At least one of initials, color, or imageDataUrl is required.'
    }
  );

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
  running: z.boolean(),
  name: z.string(),
  logoUrl: z.string(),
  host: z.string().trim().min(1),
  port: z.number().int().positive(),
  token: z.string(),
  exposedTools: z.array(z.enum(AI_TOOL_NAMES)),
  keepLogs: z.boolean()
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
  model: z.string().optional(),
  referenceSnapshots: z.record(z.string(), z.unknown()).optional()
}) as z.ZodType<AddChatMessageInput>;

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
  chatTitlePrompt: z.string().optional(),
  agentVariant: z.enum(['commitMessage']).optional()
}) satisfies z.ZodType<ChatStepInput>;

const sidebarSortModeEnum = z.enum([
  'default',
  'name-asc',
  'name-desc',
  'created-asc',
  'created-desc',
  'marker'
]);

export const sidebarExpansion = z.object({
  sections: z.object({
    collections: z.boolean(),
    environments: z.boolean(),
    runResults: z.boolean(),
    history: z.boolean(),
    workspaces: z.boolean(),
    workflows: z.boolean(),
    websites: z.boolean(),
    liveServers: z.boolean(),
    liveServerLogs: z.boolean(),
    archive: z.boolean(),
    trash: z.boolean()
  }),
  activeSidebarMode: z.enum(['collections', 'environments', 'workflows', 'servers', 'trash']),
  sidebarRailExpanded: z.boolean(),
  sectionSort: z.object({
    collections: sidebarSortModeEnum,
    environments: sidebarSortModeEnum,
    runResults: sidebarSortModeEnum,
    history: sidebarSortModeEnum,
    workspaces: sidebarSortModeEnum,
    workflows: sidebarSortModeEnum,
    websites: sidebarSortModeEnum,
    liveServers: sidebarSortModeEnum,
    liveServerLogs: sidebarSortModeEnum,
    archive: sidebarSortModeEnum,
    trash: sidebarSortModeEnum
  }),
  collectionIds: z.array(dbId),
  folderIds: z.array(dbId),
  environmentIds: z.array(dbId),
  showStorageLocationBadges: z.boolean(),
  showMarkers: z.boolean(),
  showMethodColors: z.boolean(),
  showIndicators: z.boolean(),
  showFilters: z.boolean(),
  showSorting: z.boolean()
}) satisfies z.ZodType<SidebarExpansionState>;

export const requestHistoryEntry = z.object({
  id: z.number().int(),
  method: z.string().min(1),
  url: z.string(),
  status: z.number().int(),
  statusText: z.string(),
  ts: z.number().int(),
  savedRequestId: z.number().int().positive().optional(),
  name: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  params: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  body: z.string().optional(),
  bodyType: bodyType.optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  responseBody: z.string().optional(),
  kind: z.enum(['request', 'run']).optional(),
  runCollectionId: z.number().int().positive().optional(),
  runFolderId: z.number().int().positive().nullable().optional(),
  runRequestId: z.number().int().positive().nullable().optional(),
  corrupt: z.boolean().optional()
}) satisfies z.ZodType<RequestHistoryEntry>;

export const workspaceRequest = z.object({
  requestUuid: z.string().trim().min(1),
  collectionId: z.number().int().positive().optional(),
  requestName: z.string().optional()
});

export const createWorkspaceInput = z.object({
  name: z.string().trim().min(1),
  requests: z.array(workspaceRequest),
  marker: sidebarMarker.optional(),
  layout: workspaceLayoutSchema.nullish()
}) satisfies z.ZodType<CreateWorkspaceInput>;

export const createWorkflowInput = z.object({
  name: z.string().trim().min(1),
  uuid: z.string().trim().min(1).optional(),
  durationMs: z.number().finite().nonnegative(),
  delayMs: z.number().finite().nonnegative().optional(),
  variables: z.record(z.string(), z.string()).optional(),
  actions: z.array(
    z.object({
      uuid: z.string().trim().min(1),
      type: z.string().trim().min(1),
      at: z.number().finite().optional(),
      payload: z.unknown()
    })
  )
}) satisfies z.ZodType<CreateWorkflowInput>;

export const updateWorkflowInput = z.object({
  id: z.number().int().positive(),
  durationMs: z.number().finite().nonnegative(),
  delayMs: z.number().finite().nonnegative(),
  actions: z.array(
    z.object({
      uuid: z.string().trim().min(1),
      type: z.string().trim().min(1),
      at: z.number().finite().optional(),
      payload: z.unknown()
    })
  )
}) satisfies z.ZodType<UpdateWorkflowInput>;

/**
 * Injection script persisted with a website.
 */
export const websiteInjectionScript = z.object({
  id: z.string().min(1),
  name: z.string(),
  enabled: z.boolean(),
  runAt: z.enum(['document-start', 'dom-ready', 'did-finish-load']),
  source: z.string()
});

export const createWebsiteInput = z.object({
  name: z.string().trim().min(1),
  uuid: z.string().trim().min(1).optional(),
  connectionId: connectionId.optional(),
  url: z.string(),
  homeUrl: z.string(),
  faviconDataUrl: z.union([z.string(), z.null()]).optional(),
  scripts: z.array(websiteInjectionScript).optional(),
  preRequestScripts: ipcScriptRefArray.optional(),
  postRequestScripts: ipcScriptRefArray.optional(),
  variables: z.array(variable).optional(),
  headers: z.array(keyValue).optional(),
  userAgent: z.string().optional(),
  auth: authConfig.optional()
}) satisfies z.ZodType<CreateWebsiteInput>;

export const updateWebsiteInput = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  url: z.string(),
  homeUrl: z.string(),
  faviconDataUrl: z.union([z.string(), z.null()]).optional(),
  scripts: z.array(websiteInjectionScript),
  preRequestScripts: ipcScriptRefArray,
  postRequestScripts: ipcScriptRefArray,
  variables: z.array(variable),
  headers: z.array(keyValue),
  userAgent: z.string(),
  auth: authConfig
}) satisfies z.ZodType<UpdateWebsiteInput>;

/**
 * One URL-path-to-filesystem alias for a live server.
 */
export const liveServerAlias = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .refine((value) => value.startsWith('/'), {
      message: 'Alias path must start with /'
    }),
  target: z.string().trim().min(1)
});

/**
 * One custom response header for a live server.
 */
export const liveServerResponseHeader = z.object({
  name: z.string(),
  value: z.string(),
  enabled: z.boolean().optional()
});

/**
 * One path-routing rule for a live server (SPA fallback / soft rewrite).
 */
export const liveServerRoute = z.object({
  match: z.string(),
  target: z.string(),
  enabled: z.boolean().optional()
});

/**
 * One custom error-page mapping for a live server (status code → HTML file).
 */
export const liveServerErrorPage = z.object({
  code: z.string(),
  path: z.string(),
  enabled: z.boolean().optional()
});

/**
 * One reverse-proxy rule for a live server (path prefix → upstream).
 */
export const liveServerProxy = z.object({
  path: z.string(),
  target: z.string(),
  stripPath: z.boolean().optional(),
  enabled: z.boolean().optional()
});

/**
 * TLS certificate settings for a live server.
 */
export const liveServerSslSettings = z.object({
  enabled: z.boolean(),
  certPath: z.string(),
  keyPath: z.string()
});

/**
 * CORS middleware settings for a live server.
 */
export const liveServerCorsSettings = z.object({
  enabled: z.boolean(),
  origin: z.string(),
  methods: z.string(),
  allowedHeaders: z.string(),
  exposedHeaders: z.string(),
  maxAge: z.string(),
  credentials: z.boolean()
});

/**
 * Live server configuration used when starting or saving a server.
 */
export const liveServerConfig = z.object({
  name: z.string().trim().min(1),
  root: z.string().trim().min(1),
  port: z.number().int().positive().max(65535).nullable(),
  aliases: z.array(liveServerAlias),
  watch: z.boolean(),
  cors: liveServerCorsSettings,
  openPath: z.string(),
  openPathOnStartup: z.boolean(),
  rememberLastUrl: z.boolean(),
  lastOpenedPath: z.string().nullable(),
  indexFiles: z.array(z.string()),
  host: z.string(),
  headers: z.array(liveServerResponseHeader),
  routes: z.array(liveServerRoute),
  errorPages: z.array(liveServerErrorPage),
  proxies: z.array(liveServerProxy),
  ssl: liveServerSslSettings,
  runCommand: z.string(),
  runtimeId: z.string(),
  runCommandEnabled: z.boolean(),
  runCommandEnv: z.array(keyValue),
  restartOnCrash: z.boolean(),
  urlVariable: z.string(),
  preRequestScripts: ipcLiveServerScriptRefArray,
  postRequestScripts: ipcLiveServerScriptRefArray
});

/**
 * Input for starting a live server instance.
 */
export const startLiveServerInput = z.object({
  id: z.string().trim().min(1).optional(),
  savedId: z.number().int().positive().nullable().optional(),
  config: liveServerConfig
}) satisfies z.ZodType<StartLiveServerInput>;

/**
 * Input for creating a saved live server.
 */
export const createLiveServerInput = z.object({
  name: z.string().trim().min(1),
  uuid: z.string().trim().min(1).optional(),
  connectionId: connectionId.optional(),
  root: z.string().trim().min(1),
  port: z.number().int().positive().max(65535).nullable().optional(),
  aliases: z.array(liveServerAlias).optional(),
  watch: z.boolean().optional(),
  cors: liveServerCorsSettings.optional(),
  openPath: z.string().optional(),
  openPathOnStartup: z.boolean().optional(),
  rememberLastUrl: z.boolean().optional(),
  lastOpenedPath: z.string().nullable().optional(),
  indexFiles: z.array(z.string()).optional(),
  host: z.string().optional(),
  headers: z.array(liveServerResponseHeader).optional(),
  routes: z.array(liveServerRoute).optional(),
  errorPages: z.array(liveServerErrorPage).optional(),
  proxies: z.array(liveServerProxy).optional(),
  ssl: liveServerSslSettings.optional(),
  runCommand: z.string().optional(),
  runtimeId: z.string().optional(),
  runCommandEnabled: z.boolean().optional(),
  runCommandEnv: z.array(keyValue).optional(),
  restartOnCrash: z.boolean().optional(),
  urlVariable: z.string().optional(),
  preRequestScripts: ipcLiveServerScriptRefArray.optional().default([]),
  postRequestScripts: ipcLiveServerScriptRefArray.optional().default([])
}) satisfies z.ZodType<CreateLiveServerInput>;

/**
 * Input for updating a saved live server.
 */
export const updateLiveServerInput = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  root: z.string().trim().min(1),
  port: z.number().int().positive().max(65535).nullable(),
  aliases: z.array(liveServerAlias),
  watch: z.boolean(),
  cors: liveServerCorsSettings,
  openPath: z.string(),
  openPathOnStartup: z.boolean(),
  rememberLastUrl: z.boolean(),
  lastOpenedPath: z.string().nullable(),
  indexFiles: z.array(z.string()),
  host: z.string(),
  headers: z.array(liveServerResponseHeader),
  routes: z.array(liveServerRoute),
  errorPages: z.array(liveServerErrorPage),
  proxies: z.array(liveServerProxy),
  ssl: liveServerSslSettings,
  runCommand: z.string(),
  runtimeId: z.string(),
  runCommandEnabled: z.boolean(),
  runCommandEnv: z.array(keyValue),
  restartOnCrash: z.boolean(),
  urlVariable: z.string(),
  preRequestScripts: ipcLiveServerScriptRefArray,
  postRequestScripts: ipcLiveServerScriptRefArray
}) satisfies z.ZodType<UpdateLiveServerInput>;

/**
 * Query for reading or clearing buffered live-server request logs.
 */
export const liveServerLogsQuery = z.union([
  z.object({ savedId: z.number().int().positive() }),
  z.object({ id: z.string().min(1) })
]);

/**
 * Workflow run export envelope stored inside workflow run history rows.
 */
export const workflowRunExport = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('workflow-run'),
  name: z.string(),
  environment: z.string(),
  date_created: z.string(),
  actions: z.array(
    z.object({
      index: z.number().int().positive(),
      ranAt: z.string(),
      durationMs: z.number().finite().nonnegative(),
      result: z.unknown()
    })
  )
});

/**
 * Action-bearing step stored with a workflow run history entry.
 */
export const workflowRunHistoryStep = z.object({
  action: z.object({
    uuid: z.string().trim().min(1),
    type: z.string().trim().min(1),
    at: z.number().finite().optional(),
    payload: z.unknown()
  }),
  result: z.unknown(),
  ranAt: z.string(),
  durationMs: z.number().finite().nonnegative()
});

/**
 * Input for adding a workflow run history entry (id assigned by the database).
 */
export const workflowRunHistoryAddInput = z.object({
  id: z.number().int().positive().optional(),
  workflowUuid: z.string().trim().min(1),
  name: z.string().min(1),
  environment: z.string(),
  dateCreated: z.string().min(1),
  ts: z.number().int(),
  payload: z.object({
    export: workflowRunExport,
    steps: z.array(workflowRunHistoryStep)
  })
});

export const panelLayout = z.object({
  showSidebar: z.boolean(),
  showRail: z.boolean(),
  sidebarPlacement: z.enum(['left', 'right']),
  showAiSidebar: z.boolean(),
  showGitSidebar: z.boolean(),
  showShortcutsSidebar: z.boolean(),
  showRequestEditor: z.boolean(),
  showResponseEditor: z.boolean(),
  requestEditorSplitHeight: z.number().int().min(160),
  responseEditorSplit: z
    .object({
      side: z.enum(['left', 'right', 'up', 'down']),
      secondaryTabIds: z.array(z.string().min(1)),
      size: z.number().int().min(120),
      activeTab: z.string().nullable()
    })
    .nullable(),
  showConsole: z.boolean(),
  showVariables: z.boolean(),
  showMcp: z.boolean(),
  showTerminal: z.boolean(),
  showLiveServerLogs: z.boolean(),
  liveServerLogsPlacement: z.enum(['footer', 'sidebar']),
  liveServerLogsPlacements: z.record(z.string(), z.enum(['footer', 'sidebar'])),
  activePluginFooterPanelId: z.string().nullable()
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
  githubModelsCompleteSignIn: z.tuple([z.string().url()]),
  appLogVerbose: z.tuple([z.string(), z.record(z.string(), z.unknown()).optional()]),
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
  zoomSet: z.tuple([zoomFactor]),
  closeDecision: z.tuple([z.boolean()]),
  menuSidebarVisible: z.tuple([z.boolean()]),
  menuRailVisible: z.tuple([z.boolean()]),
  menuAiSidebarVisible: z.tuple([z.boolean()]),
  menuGitSidebarVisible: z.tuple([z.boolean()]),
  menuRequestEditorVisible: z.tuple([z.boolean()]),
  menuResponseEditorVisible: z.tuple([z.boolean()]),
  menuShortcutsSidebarOpen: z.tuple([z.boolean()]),
  menuConsoleVisible: z.tuple([z.boolean()]),
  menuVariablesVisible: z.tuple([z.boolean()]),
  menuMcpVisible: z.tuple([z.boolean()]),
  menuTerminalVisible: z.tuple([z.boolean()]),
  menuStorageLocationsVisible: z.tuple([z.boolean()]),
  menuColorMarkersVisible: z.tuple([z.boolean()]),
  menuHighlightsVisible: z.tuple([z.boolean()]),
  menuIndicatorsVisible: z.tuple([z.boolean()]),
  menuFiltersVisible: z.tuple([z.boolean()]),
  menuSortingVisible: z.tuple([z.boolean()]),
  menuThemeMenuState: z.tuple([themeSource, z.array(themeMenuOption)]),
  menuDesignerUndoRedo: z.tuple([z.boolean(), z.boolean(), z.boolean()]),
  menuWorkspaceAvailable: z.tuple([z.boolean()]),
  menuSidebarDeselectAllAvailable: z.tuple([z.boolean()]),
  menuGitCollectionActive: z.tuple([z.boolean()]),
  menuPopupSubmenu: z.tuple([rootMenuLabel, z.number(), z.number()]),
  menuGetSubmenuSnapshot: z.tuple([rootMenuLabel]),
  menuActivateSubmenuItem: z.tuple([
    rootMenuLabel,
    z.number().int().nonnegative(),
    z.number().int().nonnegative().optional()
  ]),
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
  openSseSession: z.tuple([sessionOpenInput, requestId]),
  closeSseSession: z.tuple([requestId]),
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
  runtime: z.tuple([runtime]),
  verifyRuntime: z.tuple([verifyRuntimeInput]),
  teamHub: z.tuple([teamHub]),
  teamHubConnected: z.tuple([connectionId, z.boolean()]),
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
  teamHubDeviceEnroll: z.tuple([connectionId, z.string().optional()]),
  teamHubDeviceReset: z.tuple([connectionId]),
  teamHubDeviceList: z.tuple([connectionId]),
  teamHubDeviceRevoke: z.tuple([connectionId, z.string().min(1)]),
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
  teamHubDiscussionList: z.tuple([
    connectionId,
    teamHubDiscussionTarget,
    teamHubDiscussionListQuery
  ]),
  teamHubDiscussionCreate: z.tuple([
    connectionId,
    teamHubDiscussionTarget,
    teamHubDiscussionCreateInput
  ]),
  teamHubDiscussionReply: z.tuple([
    connectionId,
    teamHubDiscussionTarget,
    z.string().min(1),
    teamHubDiscussionCreateInput
  ]),
  teamHubDiscussionUpdate: z.tuple([
    connectionId,
    teamHubDiscussionTarget,
    z.string().min(1),
    teamHubDiscussionUpdateInput
  ]),
  teamHubDiscussionDelete: z.tuple([connectionId, z.string().min(1)]),
  teamHubNoticeList: z.tuple([connectionId, teamHubNoticeListQuery]),
  teamHubNoticeRead: z.tuple([connectionId, z.string().min(1)]),
  teamHubNoticeStreamSync: z.tuple([z.array(connectionId)]),
  teamHubNotificationSettingsUpdate: z.tuple([
    connectionId,
    teamHubNotificationSettingsUpdateInput
  ]),
  teamHubUpdateMyAvatar: z.tuple([connectionId, updateMyAvatarInput]),
  teamHubUpdateHubAvatar: z.tuple([connectionId, updateHubAvatarInput]),
  teamHubGetUserAvatar: z.tuple([connectionId, z.string().min(1), z.string().optional()]),
  teamHubGetHubAvatar: z.tuple([connectionId, z.string().optional()]),
  teamHubDiscussionThreadId: z.tuple([connectionId, z.string().min(1)]),
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
  browserTabId: z.tuple([z.string().min(1)]),
  browserCapturePage: z.tuple([
    z.string().min(1),
    z
      .object({
        fullPage: z.boolean().optional()
      })
      .optional()
  ]),
  browserCreate: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        enabled: z.boolean(),
        runAt: z.enum(['document-start', 'dom-ready', 'did-finish-load']),
        source: z.string()
      })
    ),
    z
      .object({
        preRequestScripts: z
          .array(
            z.object({
              id: z.string().min(1),
              name: z.string(),
              source: z.string()
            })
          )
          .optional(),
        postRequestScripts: z
          .array(
            z.object({
              id: z.string().min(1),
              name: z.string(),
              source: z.string()
            })
          )
          .optional(),
        snippetModules: z.record(z.string(), z.string()).optional(),
        snippetModuleConflicts: z.array(z.string()).optional(),
        requestDefaults: z
          .object({
            headers: z.array(keyValue),
            auth: authConfig,
            userAgent: z.string()
          })
          .optional(),
        variables: z.record(z.string(), z.string()).optional(),
        livepageId: z.string().optional()
      })
      .optional()
  ]),
  browserSetBounds: z.tuple([
    z.string().min(1),
    z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    })
  ]),
  browserSetVisible: z.tuple([z.string().min(1), z.boolean()]),
  browserLoadURL: z.tuple([z.string().min(1), z.string().min(1)]),
  browserSetScripts: z.tuple([
    z.string().min(1),
    z.array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        enabled: z.boolean(),
        runAt: z.enum(['document-start', 'dom-ready', 'did-finish-load']),
        source: z.string()
      })
    ),
    z
      .object({
        preRequestScripts: z
          .array(
            z.object({
              id: z.string().min(1),
              name: z.string(),
              source: z.string()
            })
          )
          .optional(),
        postRequestScripts: z
          .array(
            z.object({
              id: z.string().min(1),
              name: z.string(),
              source: z.string()
            })
          )
          .optional(),
        snippetModules: z.record(z.string(), z.string()).optional(),
        snippetModuleConflicts: z.array(z.string()).optional(),
        requestDefaults: z
          .object({
            headers: z.array(keyValue),
            auth: authConfig,
            userAgent: z.string()
          })
          .optional(),
        variables: z.record(z.string(), z.string()).optional(),
        livepageId: z.string().optional()
      })
      .optional()
  ]),
  browserSetHomeUrl: z.tuple([z.string().min(1), z.string().min(1)]),
  browserExecuteJavaScript: z.tuple([z.string().min(1), z.string()]),
  browserInsertCSS: z.tuple([z.string().min(1), z.string()]),
  browserQuerySelector: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.boolean().optional(),
    z.number().optional()
  ]),
  browserWaitForLoad: z.tuple([z.string().min(1), z.number().optional()]),
  autocompleteList: z.tuple([z.string().min(1)]),
  autocompleteAdd: z.tuple([z.string().min(1), z.string()]),
  aiChatSessionSet: z.tuple([aiChatSession]),
  collectionRunnerConfigSet: z.tuple([collectionRunnerConfig]),
  shortcutOverridesSet: z.tuple([shortcutOverrides]),
  shortcutCapturePausedSet: z.tuple([z.boolean()]),
  setCookies: z.tuple([domain, z.array(keyValue)]),
  collectionUpdate: z.tuple([
    dbId,
    name,
    z.array(variable),
    z.array(keyValue),
    z.string(),
    z.string(),
    authConfig,
    z.string(),
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
  environmentUpdate: z.tuple([
    dbId,
    name,
    z.array(variable),
    z.union([z.string().uuid(), z.null()]).optional()
  ]),
  collectionMove: z.tuple([dbId, connectionId]),
  collectionReorder: z.tuple([z.array(dbId)]),
  environmentReorder: z.tuple([z.array(dbId)]),
  folderCreate: z.tuple([dbId, name, z.union([dbId, z.null()]).optional()]),
  folderMove: z.tuple([dbId, z.union([dbId, z.null()]), z.number().optional()]),
  folderRename: z.tuple([dbId, name]),
  folderUpdate: z.tuple([
    dbId,
    name,
    z.array(variable),
    z.array(keyValue),
    z.string(),
    z.string(),
    authConfig,
    z.string(),
    ipcScriptRefArray,
    ipcScriptRefArray
  ]),
  folderReorder: z.tuple([dbId, z.union([dbId, z.null()]), z.array(dbId)]),
  requestReorder: z.tuple([dbId, nullableFolderId, z.array(dbId)]),
  requestMove: z.tuple([dbId, nullableFolderId, dbId]),
  containerItemRef: z.object({
    kind: z.enum(['request', 'document']),
    id: dbId
  }),
  containerItemsReorder: z.tuple([
    dbId,
    nullableFolderId,
    z.array(z.object({ kind: z.enum(['request', 'document']), id: dbId }))
  ]),
  documentList: z.tuple([dbId]),
  documentSave: z.tuple([saveDocumentInput]),
  documentDelete: z.tuple([dbId]),
  documentReorder: z.tuple([dbId, nullableFolderId, z.array(dbId)]),
  documentMove: z.tuple([dbId, nullableFolderId, dbId]),
  requestExport: z.tuple([requestExportSchema]),
  runResultsExport: z.tuple([runResultsExportSchema]),
  runResultsSave: z.tuple([z.string().min(1), saveRunResultInputSchema]),
  runResultUuid: z.tuple([z.string().uuid()]),
  requestImport: z.tuple([dbId, nullableFolderId.optional()]),
  importAuto: z.tuple([dbId.nullable(), z.array(z.string()).optional()]),
  shareCreate: z.tuple([dbId, recipientKid.optional()]),
  openDirectory: z.tuple([z.string()]),
  openFile: z.tuple([z.string()]),
  /**
   * Default path for the SSL cert/key single-file picker (empty string when unset).
   */
  openSslFile: z.tuple([z.string()]),
  openPath: z.tuple([z.string().min(1)]),
  saveFile: z.tuple([z.string()]),
  saveTextFile: z.tuple([z.string().max(MAX_IPC_REQUEST_BODY_CHARS), z.string()]),
  writeTextInDirectory: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().max(MAX_IPC_REQUEST_BODY_CHARS)
  ]),
  readImageDataUrl: z.tuple([z.string().min(1)]),
  copyFileToSaveDialog: z.tuple([z.string().min(1), z.string()]),
  saveDataUrlToFile: z.tuple([
    z.object({
      dataUrl: z.string().max(MAX_IPC_REQUEST_BODY_CHARS).optional(),
      url: z.string().max(MAX_IPC_URL_CHARS).optional(),
      defaultFileName: z.string()
    })
  ]),
  backupExport: z.tuple([z.record(z.string(), z.string())]),
  gitCommit: z.tuple([
    connectionId,
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.boolean().optional()
  ]),
  gitListBranches: z.tuple([connectionId]),
  gitCreateBranch: z.tuple([connectionId, z.string().trim().min(1)]),
  gitDeleteBranch: z.tuple([connectionId, z.string().trim().min(1)]),
  gitCheckoutBranch: z.tuple([connectionId, z.string().trim().min(1)]),
  gitMergeBranch: z.tuple([connectionId, z.string().trim().min(1)]),
  gitReadConflictFile: z.tuple([
    z.object({
      connectionId,
      filePath: repoRelativeFilePath
    })
  ]),
  gitWriteConflictFile: z.tuple([
    z.object({
      connectionId,
      filePath: repoRelativeFilePath,
      content: z.string()
    })
  ]),
  gitOpenExternalMergeEditor: z.tuple([
    z.object({
      connectionId,
      filePath: repoRelativeFilePath
    })
  ]),
  gitLog: z.tuple([connectionId, z.number().int().positive().optional()]),
  gitSuggestedAuthor: z.tuple([connectionId.optional()]),
  gitDeleteRepoDirectory: z.tuple([connectionId]),
  gitGraphLog: z.tuple([connectionId, z.number().int().positive().optional()]),
  gitCommitDetail: z.tuple([connectionId, z.string().trim().min(1)]),
  gitCommitFileDiff: z.tuple([
    z.object({
      connectionId,
      commitOid: z.string().trim().min(1),
      filePath: repoRelativeFilePath,
      status: z.enum(['added', 'modified', 'deleted']),
      displayName: z.string().optional(),
      resourceKind: z.enum(['request', 'document', 'collection']).optional(),
      method: z.string().optional(),
      maxChars: z.number().int().positive().optional()
    })
  ]),
  gitDiff: z.tuple([
    z.object({
      collectionUuid: z.string().trim().min(1),
      maxFiles: z.number().int().positive().optional(),
      maxCharsPerFile: z.number().int().positive().optional(),
      maxTotalChars: z.number().int().positive().optional(),
      stagedOnly: z.boolean().optional(),
      excludeUntracked: z.boolean().optional()
    })
  ]),
  gitRepoInfo: z.tuple([
    z.object({
      collectionUuid: z.string().trim().min(1)
    })
  ]),
  gitCollectionCommits: z.tuple([
    z.object({
      collectionUuid: z.string().trim().min(1),
      depth: z.number().int().positive().optional()
    })
  ]),
  gitFileInfo: z.tuple([
    z.object({
      collectionUuid: z.string().trim().min(1),
      requestUuid: z.string().trim().min(1),
      depth: z.number().int().positive().optional()
    })
  ]),
  gitFileDiff: z.tuple([
    z.object({
      collectionUuid: z.string().trim().min(1),
      requestUuid: z.string().trim().min(1),
      commitA: z.string().trim().min(1),
      commitB: z.string().trim().min(1),
      maxChars: z.number().int().positive().optional()
    })
  ]),
  gitListItemStatuses: z.tuple([connectionId, z.string().trim().min(1)]),
  gitChangedItemCount: z.tuple([connectionId, z.string().trim().min(1)]),
  gitStageItem: z.tuple([connectionId, z.string().trim().min(1), z.string().trim().min(1)]),
  gitStageAllUntrackedItems: z.tuple([connectionId, z.string().trim().min(1)]),
  gitUnstageItem: z.tuple([connectionId, z.string().trim().min(1), z.string().trim().min(1)]),
  gitRevertFile: z.tuple([
    connectionId,
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.array(z.string().trim().min(1)).optional()
  ]),
  gitSetPat: z.tuple([connectionId, z.string(), z.string().min(1)]),
  readGitRemoteUrl: z.tuple([z.string()]),
  gitHost: z.tuple([z.string().min(1)]),
  gitSetHostPat: z.tuple([
    z.string().min(1),
    z.string(),
    z.string().min(1),
    z.string().optional(),
    z.string().optional()
  ]),
  gitStartHostOAuth: z.tuple([z.string().min(1), z.string().optional(), z.string().optional()]),
  gitCompleteOAuth: z.tuple([connectionId, z.string().url()]),
  gitCompleteHostOAuth: z.tuple([
    z.string().min(1),
    z.string().url(),
    z.string().optional(),
    z.string().optional()
  ]),
  isGitRepo: z.tuple([z.string()]),
  initGitRepo: z.tuple([z.string(), z.string(), z.string()]),
  pluginId: z.tuple([pluginId]),
  pluginSetEnabled: z.tuple([pluginId, z.boolean()]),
  pluginInstallFromPath: z.tuple([z.string().min(1)]),
  pluginInstallFromGit: z.tuple([z.string().min(1), z.string().min(1).optional()]),
  pluginPreviewFromGit: z.tuple([z.string().min(1), z.string().min(1).optional()]),
  pluginLoadUnpackedFromPath: z.tuple([z.string().min(1)]),
  pluginSources: z.tuple([pluginSourcesSchema]),
  publicCollectionSearch: z.tuple([z.string().min(1), z.number().int().min(1).optional()]),
  publicCollectionRef: z.tuple([apisIoCollectionSchema]),
  collectionImportUrl: z.tuple([z.string().min(1)]),
  pluginReadEntry: z.tuple([pluginId, pluginEntryKind]),
  pluginReadAsset: z.tuple([pluginId, z.string().min(1)]),
  pluginResolveThemeImport: z.tuple([pluginId, z.string().min(1)]),
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
  pluginFsWriteBytes: z.tuple([
    pluginId,
    z.string().min(1),
    z
      .string()
      .min(1)
      .max(50 * 1024 * 1024)
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
  pluginRunAiBeforeTurn: z.tuple([
    z.object({
      chatId: z.number(),
      model: z.string(),
      hubId: z.string().optional(),
      userMessage: z.object({
        content: z.string(),
        referenceSnapshots: z.record(z.string(), z.unknown()).optional()
      }),
      messages: z.array(
        z.object({
          role: z.enum(['system', 'user', 'assistant', 'tool']),
          content: z.string().nullable().optional()
        })
      )
    })
  ]),
  pluginPushAiAfterTurn: z.tuple([
    z.object({
      chatId: z.number(),
      model: z.string(),
      hubId: z.string().optional(),
      userMessage: z.object({ content: z.string() }),
      assistantMessage: z.object({ content: z.string() }).nullable(),
      status: z.enum(['completed', 'cancelled', 'error']),
      error: z.object({ message: z.string() }).optional(),
      stats: z.object({
        stepCount: z.number(),
        toolCallCount: z.number(),
        durationMs: z.number()
      })
    })
  ]),
  pluginRegisterAiInstructions: z.tuple([z.string().min(1), z.string().min(1), z.string()]),
  pluginUnregisterAiInstructions: z.tuple([z.string().min(1), z.string().min(1)]),
  pluginRunBeforeScripts: z.tuple([
    z.object({
      phase: z.enum(['pre', 'post']),
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
      data: z.record(z.string(), z.unknown())
    })
  ]),
  pluginRunAfterScripts: z.tuple([
    z.object({
      phase: z.enum(['pre', 'post']),
      data: z.record(z.string(), z.unknown()),
      tests: z.array(
        z.object({
          name: z.string(),
          passed: z.boolean(),
          error: z.string().optional()
        })
      ),
      logs: z.array(
        z.object({
          level: z.enum(['log', 'warn', 'error']),
          message: z.string(),
          scriptName: z.string().optional(),
          scriptId: z.string().optional()
        })
      ),
      errors: z.array(z.string())
    })
  ]),
  pluginPushLibraryChanged: z.tuple([
    z.object({
      reason: z.enum(['collections', 'folders', 'requests', 'documents']),
      collectionId: z.number().optional()
    })
  ]),
  pluginPushWorkflowsChanged: z.tuple([
    z.object({
      reason: z.enum(['created', 'updated', 'renamed', 'deleted', 'refreshed']),
      workflowId: z.number().optional()
    })
  ]),
  pluginPushLiveServersRunningChanged: z.tuple([z.array(z.unknown())]),
  pluginPushLiveServerRequestLog: z.tuple([z.unknown()]),
  pluginPushSidebarSelectionChanged: z.tuple([
    z
      .object({
        kind: z.enum(['collection', 'folder', 'request', 'document']),
        collectionId: z.number(),
        folderId: z.number().nullable().optional(),
        requestId: z.number().optional(),
        documentId: z.number().optional()
      })
      .nullable()
  ]),
  pluginExecuteAgentCommand: z.tuple([pluginId, z.string().min(1), z.array(z.unknown())]),
  pluginInvokeImportHandler: z.tuple([
    pluginId,
    z.string().min(1),
    z.enum(['canImport', 'import']),
    z.object({
      name: z.string(),
      path: z.string(),
      extension: z.string(),
      contents: z.string()
    })
  ]),
  pluginInvokeParseChatPointer: z.tuple([
    pluginId,
    z.string().min(1),
    z.object({
      matchGroups: z.array(z.string().nullable()),
      fullToken: z.string(),
      atIndex: z.number().int()
    })
  ]),
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
  inspectElement: z.tuple([z.object({ x: z.number(), y: z.number() })]),
  requestHistoryAdd: z.tuple([requestHistoryEntry]),
  requestHistoryDelete: z.tuple([z.number().int()]),
  workspacesCreate: z.tuple([createWorkspaceInput]),
  workspacesUpdate: z.tuple([
    z.number().int().positive(),
    z.array(workspaceRequest),
    workspaceLayoutSchema.nullish()
  ]),
  workspacesRename: z.tuple([z.number().int().positive(), z.string().trim().min(1)]),
  workspacesClone: z.tuple([z.number().int().positive(), z.string().trim().min(1)]),
  workspacesDelete: z.tuple([z.number().int().positive()]),
  workspacesReorder: z.tuple([z.array(dbId)]),
  workspacesSetMarker: z.tuple([dbId, sidebarMarker]),
  workflowsCreate: z.tuple([createWorkflowInput]),
  workflowsRename: z.tuple([z.number().int().positive(), z.string().trim().min(1)]),
  workflowsUpdate: z.tuple([updateWorkflowInput]),
  workflowsDelete: z.tuple([z.number().int().positive()]),
  workflowsSetArchived: z.tuple([z.number().int().positive(), z.boolean()]),
  websitesCreate: z.tuple([createWebsiteInput]),
  websitesUpdate: z.tuple([updateWebsiteInput]),
  websitesDelete: z.tuple([z.number().int().positive()]),
  websitesMove: z.tuple([z.number().int().positive(), connectionId]),
  liveServerStart: z.tuple([startLiveServerInput]),
  liveServerStop: z.tuple([z.string().min(1)]),
  liveServerLogsQuery: z.tuple([liveServerLogsQuery]),
  liveServersCreate: z.tuple([createLiveServerInput]),
  liveServersUpdate: z.tuple([updateLiveServerInput]),
  liveServersDelete: z.tuple([z.number().int().positive()]),
  liveServersMove: z.tuple([z.number().int().positive(), connectionId]),
  liveServersSetLastOpenedPath: z.tuple([z.number().int().positive(), z.string().nullable()]),
  workflowRunHistoryAdd: z.tuple([workflowRunHistoryAddInput]),
  workflowRunHistoryDelete: z.tuple([z.number().int().positive()]),
  collectionsSetMarker: z.tuple([dbId, sidebarMarker]),
  collectionsSetArchived: z.tuple([dbId, z.boolean()]),
  foldersSetMarker: z.tuple([dbId, sidebarMarker]),
  requestsSetMarker: z.tuple([dbId, sidebarMarker]),
  documentsSetMarker: z.tuple([dbId, sidebarMarker]),
  environmentsSetMarker: z.tuple([dbId, sidebarMarker]),
  terminalCreate: z.tuple([
    z.object({
      id: z.string().min(1),
      cwd: z.string().optional(),
      cols: z.number().int().positive(),
      rows: z.number().int().positive()
    })
  ]),
  terminalId: z.tuple([z.string().min(1)]),
  terminalWrite: z.tuple([z.string().min(1), z.string()]),
  terminalResize: z.tuple([
    z.string().min(1),
    z.number().int().positive(),
    z.number().int().positive()
  ])
} as const;
