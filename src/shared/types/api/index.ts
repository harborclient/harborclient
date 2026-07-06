import type { ApiCollections } from '#/shared/types/api/collections';
import type { ApiEnvironments } from '#/shared/types/api/environments';
import type { ApiSnippets } from '#/shared/types/api/snippets';
import type { ApiRequests } from '#/shared/types/api/requests';
import type { ApiHttp } from '#/shared/types/api/http';
import type { ApiWindow } from '#/shared/types/api/window';
import type { ApiSettings } from '#/shared/types/api/settings';
import type { ApiChats } from '#/shared/types/api/chats';
import type { ApiStorage } from '#/shared/types/api/storage';
import type { ApiTeamHub } from '#/shared/types/api/teamHub';
import type { ApiGit } from '#/shared/types/api/git';
import type { ApiSharing } from '#/shared/types/api/sharing';
import type { ApiBackup } from '#/shared/types/api/backup';
import type { ApiPlugins } from '#/shared/types/api/plugins';
import type { ApiMcp } from '#/shared/types/api/mcp';

/**
 * IPC bridge API exposed to the renderer via contextBridge.
 */
export interface Api
  extends
    ApiCollections,
    ApiEnvironments,
    ApiSnippets,
    ApiRequests,
    ApiHttp,
    ApiWindow,
    ApiSettings,
    ApiChats,
    ApiStorage,
    ApiTeamHub,
    ApiGit,
    ApiSharing,
    ApiBackup,
    ApiPlugins,
    ApiMcp {}
