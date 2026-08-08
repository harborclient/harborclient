import type { ApiDocuments } from './documents';
import type { ApiCollections } from './collections';
import type { ApiEnvironments } from './environments';
import type { ApiSnippets } from './snippets';
import type { ApiRequests } from './requests';
import type { ApiHttp } from './http';
import type { ApiWindow } from './window';
import type { ApiSettings } from './settings';
import type { ApiChats } from './chats';
import type { ApiStorage } from './storage';
import type { ApiRuntimes } from './runtimes';
import type { ApiTeamHub } from './teamHub';
import type { ApiGit } from './git';
import type { ApiSharing } from './sharing';
import type { ApiBackup } from './backup';
import type { ApiPlugins } from './plugins';
import type { ApiCustomThemes } from './customThemes';
import type { ApiDocs } from './docs';
import type { ApiMcp } from './mcp';
import type { ApiRequestHistory } from './requestHistory';
import type { ApiWorkspaces } from './workspace';
import type { ApiWorkflows } from './workflow';
import type { ApiWorkflowRunHistory } from './workflowRunHistory';
import type { ApiWebsites } from './website';
import type { ApiLiveServer } from './liveServer';
import type { ApiTrash } from './trash';
import type { ApiTerminal } from './terminal';
import type { ApiBrowser } from './browser';

export type { ApiRuntimes, VerifyRuntimeInput, VerifyRuntimeResult } from './runtimes';

export type {
  ApiBrowser,
  BrowserConsoleEntryPayload,
  BrowserCopyToChatPayload,
  BrowserDownloadEntry,
  BrowserDownloadsChangedPayload,
  BrowserHcScriptSourcePayload,
  BrowserHcScriptsPayload,
  BrowserInjectionScriptPayload,
  BrowserNavigationState,
  BrowserOpenImageViewPayload,
  BrowserOpenTabRequest,
  BrowserSecurityState,
  BrowserRequestDefaultsPayload,
  BrowserScriptRunAt,
  BrowserViewBounds
} from './browser';

export type { ApiHttp, SseEventPush, SseSessionStatus, SseStatePush } from './http';

/**
 * IPC bridge API exposed to the renderer via contextBridge.
 */
export interface Api
  extends
    ApiCollections,
    ApiEnvironments,
    ApiSnippets,
    ApiRequests,
    ApiDocuments,
    ApiHttp,
    ApiWindow,
    ApiSettings,
    ApiChats,
    ApiStorage,
    ApiRuntimes,
    ApiTeamHub,
    ApiGit,
    ApiSharing,
    ApiBackup,
    ApiPlugins,
    ApiDocs,
    ApiMcp,
    ApiRequestHistory,
    ApiWorkspaces,
    ApiWorkflows,
    ApiWorkflowRunHistory,
    ApiWebsites,
    ApiLiveServer,
    ApiTrash,
    ApiTerminal,
    ApiCustomThemes,
    ApiBrowser {}
