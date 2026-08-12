import type { z } from 'zod';
import type { ITeamHubClient } from './ITeamHubClient.js';
import { TeamHubClientError } from './TeamHubClientError.js';
import { isTeamHubSnippetsUnsupportedError } from './isTeamHubSnippetsUnsupportedError.js';
import {
  collectionRecordSchema,
  documentRecordSchema,
  environmentRecordSchema,
  errorResponseSchema,
  folderRecordSchema,
  healthResponseSchema,
  listCollectionsResponseSchema,
  listDocumentsResponseSchema,
  listEnvironmentsResponseSchema,
  listFoldersResponseSchema,
  listHubLlmModelsResponseSchema,
  listLivePagesResponseSchema,
  listLiveServersResponseSchema,
  listSnippetsResponseSchema,
  pluginSourcesResponseSchema,
  listRequestsResponseSchema,
  hubChatStepResponseSchema,
  savedRequestRecordSchema,
  hubAvatarSchema,
  updateMyAvatarResponseSchema,
  sessionResponseSchema,
  snippetRecordSchema,
  listAdminUsersResponseSchema,
  listAdminCollectionsResponseSchema,
  listAdminEnvironmentsResponseSchema,
  listAdminSnippetsResponseSchema,
  listAdminRunResultsResponseSchema,
  listRunResultsResponseSchema,
  runResultDetailSchema,
  adminEntityConfigSchema,
  createAdminUserResponseSchema,
  createdApiTokenResponseSchema,
  listAdminTokensResponseSchema,
  enrolledDeviceResponseSchema,
  listDeviceKeysResponseSchema,
  hubUserRecordSchema,
  livePageRecordSchema,
  liveServerRecordSchema,
  reloadConfigResponseSchema,
  createAdminInvitationResponseSchema,
  listAdminInvitationsResponseSchema,
  previewInvitationResponseSchema,
  listDiscussionsResponseSchema,
  discussionCommentSchema,
  discussionMlsCommitSchema,
  discussionMlsGroupStateSchema,
  discussionMlsWelcomeSchema,
  listDiscussionMlsCommitsResponseSchema,
  listDiscussionMlsWelcomesResponseSchema,
  listNoticesResponseSchema,
  noticesUnreadCountResponseSchema,
  teamHubNoticeSchema,
  notificationSettingsSchema,
  discussionThreadSubscriptionSchema
} from './schemas.js';
import type {
  AdminResourceOption,
  AdminEntityConfig,
  CollectionRecord,
  CreateCollectionInput,
  CreateDocumentInput,
  CreateEnvironmentInput,
  CreateFolderInput,
  CreateHubTokenInput,
  CreateHubUserInput,
  CreateLivePageInput,
  CreateLiveServerInput,
  CreateRequestInput,
  CreateRunResultInput,
  CreateSnippetInput,
  CreateUserInvitationInput,
  CreatedHubToken,
  CreatedHubUser,
  CreatedInvitedHubUser,
  CreateInvitedHubUserInput,
  DocumentRecord,
  EnvironmentRecord,
  FolderRecord,
  HealthResponse,
  HubAvatarMetadata,
  HubApiTokenRecord,
  HubDeviceKeyRecord,
  EnrollHubDeviceInput,
  HubInvitationPreview,
  HubInvitationRecord,
  HubUserRecord,
  LivePageRecord,
  LiveServerRecord,
  MoveDocumentInput,
  MoveFolderInput,
  MoveRequestInput,
  PluginSourcesResponse,
  PreviewHubInvitationInput,
  RedeemHubInvitationInput,
  RenameFolderInput,
  ReorderDocumentsInput,
  ReorderFoldersInput,
  ReorderRequestsInput,
  RunResultDetail,
  RunResultRecord,
  SavedRequestRecord,
  TeamHubClientConfig,
  SessionResponse,
  SnippetRecord,
  TeamHubAdminResourceOptions,
  UpdateCollectionInput,
  UpdateDocumentInput,
  UpdateEnvironmentInput,
  UpdateHubUserInput,
  UpdateHubAvatarInput,
  UpdateMyAvatarInput,
  UpdateMyAvatarResponse,
  UpdateLivePageInput,
  UpdateLiveServerInput,
  UpdateRequestInput,
  UpdateSnippetInput,
  ReloadConfigResponse,
  UserAvatarImage
} from './types.js';
import type {
  CreateDiscussionCommentInput,
  DiscussionComment,
  DiscussionEntityType,
  ListDiscussionsQuery,
  ListDiscussionsResponse,
  UpdateDiscussionCommentInput
} from './discussionTypes.js';
import type {
  DiscussionThreadSubscription,
  ListNoticesQuery,
  ListNoticesResponse,
  NotificationSettings,
  NoticesUnreadCountResponse,
  TeamHubNotice,
  UpdateNotificationSettingsInput
} from './noticeTypes.js';
import { readNoticeStreamBody } from './readNoticeStream.js';
import type { NoticeStreamHandlers } from './noticeStreamTypes.js';
import { readAiChatStreamBody, type AiChatStreamHandlers } from './readAiChatStream.js';
import type { ChatStepMessage, ChatStepResult, ListHubLlmModelsResponse } from './appTypes.js';

/**
 * Default request timeout when {@link TeamHubClientConfig.requestTimeoutMs} is omitted.
 */
export const DEFAULT_TEAM_HUB_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Input for POST /llm/chat/step on Team Hub.
 */
export interface HubChatStepRequest {
  /**
   * Provider-specific model id.
   */
  model: string;

  /**
   * Conversation messages excluding the injected system prompt.
   */
  messages: ChatStepMessage[];

  /**
   * OpenAI-compatible tool definitions forwarded to the provider.
   */
  tools?: Record<string, unknown>[];

  /**
   * System prompt injected ahead of the conversation messages.
   */
  systemPrompt?: string;
}

/**
 * Input for POST /llm/chat/stream on Team Hub.
 */
export interface HubChatStepStreamRequest extends HubChatStepRequest {
  /**
   * Stable renderer turn identifier copied onto every stream event.
   */
  turnId: string;

  /**
   * Zero-based renderer outer-loop step index.
   */
  stepIndex: number;
}

/**
 * Options passed to the internal {@link TeamHubClient.request} helper.
 */
interface RequestOptions<T> {
  /**
   * JSON request body; omitted for bodyless methods.
   */
  body?: unknown;

  /**
   * Zod schema used to validate a JSON response body.
   */
  schema?: z.ZodType<T>;

  /**
   * When false, omits the bearer token (used for `GET /health`).
   */
  auth?: boolean;
}

/**
 * Executes typed HTTP requests against HarborClient Server.
 */
export class TeamHubClient implements ITeamHubClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly requestTimeoutMs: number;
  private readonly tenantId: string | undefined;

  /**
   * Creates a client bound to a HarborClient Server instance and bearer token.
   *
   * @param config - Base URL, token, and optional request timeout.
   */
  constructor(config: TeamHubClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_TEAM_HUB_REQUEST_TIMEOUT_MS;

    const trimmedTenant = config.tenantId?.trim();
    this.tenantId = trimmedTenant && trimmedTenant.length > 0 ? trimmedTenant : undefined;
  }

  /**
   * Joins the configured base URL with a relative API path.
   *
   * @param path - Path beginning with `/`.
   */
  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  /**
   * Parses a failed response body into a human-readable error message.
   *
   * @param response - Non-success fetch response.
   * @param method - HTTP method used for the request.
   * @param path - Request path relative to the base URL.
   */
  private async parseErrorMessage(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        const json: unknown = await response.json();
        const parsed = errorResponseSchema.safeParse(json);
        if (parsed.success) {
          return parsed.data.error;
        }
      } catch {
        // Fall through to status-based message.
      }
    }

    return `Request failed with status ${response.status}`;
  }

  /**
   * Sends an HTTP request to HarborClient Server and validates the response.
   *
   * @param method - HTTP method.
   * @param path - Path relative to the configured base URL.
   * @param options - Optional body, response schema, and auth flag.
   * @returns Parsed response body, or `undefined` for `204 No Content`.
   * @throws {TeamHubClientError} When the request fails or the response is invalid.
   */
  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions<T> = {}
  ): Promise<T | undefined> {
    const { body, schema, auth = true } = options;
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    if (auth) {
      if (!this.token) {
        throw new TeamHubClientError('Bearer token is required for authenticated requests', {
          status: 0,
          method,
          path
        });
      }

      headers.Authorization = `Bearer ${this.token}`;
    }

    if (this.tenantId) {
      headers['X-Harbor-Tenant'] = this.tenantId;
    }

    let requestBody: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(this.buildUrl(path), {
        method,
        headers,
        body: requestBody,
        signal: AbortSignal.timeout(this.requestTimeoutMs)
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'TimeoutError'
          ? `Request timed out after ${this.requestTimeoutMs} ms`
          : err instanceof Error
            ? err.message
            : 'Unknown network error';
      throw new TeamHubClientError(message, { status: 0, method, path });
    }

    if (response.status === 204) {
      return undefined;
    }

    if (!response.ok) {
      const message = await this.parseErrorMessage(response);
      throw new TeamHubClientError(message, {
        status: response.status,
        method,
        path
      });
    }

    if (!schema) {
      return undefined;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new TeamHubClientError('Response body is not valid JSON', {
        status: response.status,
        method,
        path
      });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const issuePath = issue?.path?.length ? issue.path.join('.') : 'body';
      const issueMessage = issue?.message ?? 'unknown schema error';
      throw new TeamHubClientError(
        `Response body failed validation (${issuePath}: ${issueMessage})`,
        {
          status: response.status,
          method,
          path
        }
      );
    }

    return parsed.data;
  }

  /**
   * Probes server availability via the public health endpoint.
   */
  async checkHealth(): Promise<HealthResponse> {
    const result = await this.request('GET', '/health', {
      auth: false,
      schema: healthResponseSchema
    });
    return result as HealthResponse;
  }

  /**
   * Returns the authenticated user, token metadata, and derived API capabilities.
   */
  async getSession(): Promise<SessionResponse> {
    const result = await this.request('GET', '/auth/session', {
      schema: sessionResponseSchema
    });
    return result as SessionResponse;
  }

  /**
   * Updates avatar initials, color, and/or uploaded image for the authenticated user.
   *
   * @param input - Replacement initials, color key, and/or image data URL.
   */
  async updateMyAvatar(input: UpdateMyAvatarInput): Promise<UpdateMyAvatarResponse> {
    const result = await this.request('PUT', '/auth/profile/avatar', {
      body: input,
      schema: updateMyAvatarResponseSchema
    });
    return result as UpdateMyAvatarResponse;
  }

  /**
   * Fetches the uploaded avatar image bytes for a Team Hub user account.
   *
   * Uses a binary request path because {@link request} only accepts JSON bodies.
   *
   * @param userId - User account whose avatar image should be loaded.
   * @param version - Optional cache-busting version from the avatar image URL.
   */
  async getUserAvatar(userId: string, version?: string): Promise<UserAvatarImage> {
    const encodedId = encodeURIComponent(userId);
    const query = version != null && version.length > 0 ? `?v=${encodeURIComponent(version)}` : '';
    const path = `/auth/users/${encodedId}/avatar${query}`;
    const headers: Record<string, string> = {
      Accept: 'image/*'
    };

    if (!this.token) {
      throw new TeamHubClientError('Bearer token is required for authenticated requests', {
        status: 0,
        method: 'GET',
        path
      });
    }

    headers.Authorization = `Bearer ${this.token}`;
    if (this.tenantId) {
      headers['X-Harbor-Tenant'] = this.tenantId;
    }

    let response: Response;
    try {
      response = await fetch(this.buildUrl(path), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.requestTimeoutMs)
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'TimeoutError'
          ? `Request timed out after ${this.requestTimeoutMs} ms`
          : err instanceof Error
            ? err.message
            : 'Unknown network error';
      throw new TeamHubClientError(message, { status: 0, method: 'GET', path });
    }

    if (!response.ok) {
      const message = await this.parseErrorMessage(response);
      throw new TeamHubClientError(message, {
        status: response.status,
        method: 'GET',
        path
      });
    }

    const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    const buffer = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let index = 0; index < buffer.length; index += 1) {
      binary += String.fromCharCode(buffer[index]!);
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;

    return {
      mime,
      bytes: buffer,
      dataUrl
    };
  }

  /**
   * Fetches the uploaded hub avatar image bytes for the active tenant namespace.
   *
   * Uses a binary request path because {@link request} only accepts JSON bodies.
   *
   * @param version - Optional cache-busting version from the hub avatar image URL.
   */
  async getHubAvatar(version?: string): Promise<UserAvatarImage> {
    const query = version != null && version.length > 0 ? `?v=${encodeURIComponent(version)}` : '';
    const path = `/auth/hub/avatar${query}`;
    const headers: Record<string, string> = {
      Accept: 'image/*'
    };

    if (!this.token) {
      throw new TeamHubClientError('Bearer token is required for authenticated requests', {
        status: 0,
        method: 'GET',
        path
      });
    }

    headers.Authorization = `Bearer ${this.token}`;
    if (this.tenantId) {
      headers['X-Harbor-Tenant'] = this.tenantId;
    }

    let response: Response;
    try {
      response = await fetch(this.buildUrl(path), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.requestTimeoutMs)
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'TimeoutError'
          ? `Request timed out after ${this.requestTimeoutMs} ms`
          : err instanceof Error
            ? err.message
            : 'Unknown network error';
      throw new TeamHubClientError(message, { status: 0, method: 'GET', path });
    }

    if (!response.ok) {
      const message = await this.parseErrorMessage(response);
      throw new TeamHubClientError(message, {
        status: response.status,
        method: 'GET',
        path
      });
    }

    const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    const buffer = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let index = 0; index < buffer.length; index += 1) {
      binary += String.fromCharCode(buffer[index]!);
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;

    return {
      mime,
      bytes: buffer,
      dataUrl
    };
  }

  /**
   * Updates hub avatar initials, color, and/or uploaded image for the active tenant.
   *
   * Requires an admin-role bearer token.
   *
   * @param input - Replacement initials, color key, and/or image data URL.
   */
  async updateAdminHubAvatar(input: UpdateHubAvatarInput): Promise<HubAvatarMetadata> {
    const result = await this.request('PUT', '/admin/hub/avatar', {
      body: input,
      schema: hubAvatarSchema
    });
    return result as HubAvatarMetadata;
  }

  /**
   * Lists all Team Hub user accounts visible to an admin-role token.
   */
  async listAdminUsers(): Promise<HubUserRecord[]> {
    const result = await this.request('GET', '/admin/users', {
      schema: listAdminUsersResponseSchema
    });
    return (result as { users: HubUserRecord[] }).users;
  }

  /**
   * Creates a Team Hub user account and an initial API bearer token.
   *
   * @param input - User fields for the new account.
   */
  async createAdminUser(input: CreateHubUserInput): Promise<CreatedHubUser> {
    const result = await this.request('POST', '/admin/users', {
      body: input,
      schema: createAdminUserResponseSchema
    });
    return result as CreatedHubUser;
  }

  /**
   * Creates a Team Hub user account and a single-use onboarding invitation.
   *
   * @param input - User fields and optional invitation expiry for the new account.
   */
  async createAdminInvitedUser(input: CreateInvitedHubUserInput): Promise<CreatedInvitedHubUser> {
    const result = await this.request('POST', '/admin/invited-users', {
      body: input,
      schema: createAdminInvitationResponseSchema
    });
    return result as CreatedInvitedHubUser;
  }

  /**
   * Issues a replacement onboarding invitation for an existing user account.
   *
   * @param userId - User account identifier.
   * @param input - Optional invitation expiry override.
   */
  async createAdminUserInvitation(
    userId: string,
    input: CreateUserInvitationInput = {}
  ): Promise<CreatedInvitedHubUser> {
    const result = await this.request('POST', `/admin/users/${userId}/invitations`, {
      body: input,
      schema: createAdminInvitationResponseSchema
    });
    return result as CreatedInvitedHubUser;
  }

  /**
   * Lists onboarding invitations for operator review and recovery.
   */
  async listAdminInvitations(): Promise<HubInvitationRecord[]> {
    const result = await this.request('GET', '/admin/invitations', {
      schema: listAdminInvitationsResponseSchema
    });
    return (result as { invitations: HubInvitationRecord[] }).invitations;
  }

  /**
   * Revokes a pending onboarding invitation so it can no longer be redeemed.
   *
   * @param id - Invitation record identifier.
   */
  async revokeAdminInvitation(id: string): Promise<void> {
    await this.request('DELETE', `/admin/invitations/${id}`);
  }

  /**
   * Returns invited user details for confirmation without consuming the invitation.
   *
   * @param input - Invitation secret supplied by the operator or invitee.
   */
  async previewInvitation(input: PreviewHubInvitationInput): Promise<HubInvitationPreview> {
    const result = await this.request('POST', '/auth/invitations/preview', {
      auth: false,
      body: input,
      schema: previewInvitationResponseSchema
    });
    return result as HubInvitationPreview;
  }

  /**
   * Consumes a pending invitation and returns a one-time permanent API token secret.
   *
   * @param input - Invitation secret and optional token label.
   */
  async redeemInvitation(input: RedeemHubInvitationInput): Promise<CreatedHubToken> {
    const result = await this.request('POST', '/auth/invitations/redeem', {
      auth: false,
      body: input,
      schema: createdApiTokenResponseSchema
    });
    return result as CreatedHubToken;
  }

  /**
   * Updates a Team Hub user account via the management API.
   *
   * @param id - User account identifier.
   * @param input - Partial user fields to apply.
   */
  async updateAdminUser(id: string, input: UpdateHubUserInput): Promise<HubUserRecord> {
    const result = await this.request('PUT', `/admin/users/${id}`, {
      body: input,
      schema: hubUserRecordSchema
    });
    return result as HubUserRecord;
  }

  /**
   * Deletes a Team Hub user account and their API tokens via the management API.
   *
   * @param id - User account identifier.
   */
  async deleteAdminUser(id: string): Promise<void> {
    await this.request('DELETE', `/admin/users/${id}`);
  }

  /**
   * Lists all API bearer tokens visible to an admin-role token.
   */
  async listAdminTokens(): Promise<HubApiTokenRecord[]> {
    const result = await this.request('GET', '/admin/tokens', {
      schema: listAdminTokensResponseSchema
    });
    return (result as { tokens: HubApiTokenRecord[] }).tokens;
  }

  /**
   * Creates an additional API bearer token for a user account.
   *
   * @param userId - Owning user account identifier.
   * @param input - Human-readable label for the new token.
   */
  async createAdminUserToken(userId: string, input: CreateHubTokenInput): Promise<CreatedHubToken> {
    const result = await this.request('POST', `/admin/users/${userId}/tokens`, {
      body: input,
      schema: createdApiTokenResponseSchema
    });
    return result as CreatedHubToken;
  }

  /**
   * Permanently deletes an API bearer token via the management API.
   *
   * @param id - Token record identifier.
   */
  async deleteAdminToken(id: string): Promise<void> {
    await this.request('DELETE', `/admin/tokens/${id}`);
  }

  /**
   * Enrolls the authenticated user's current device on an E2EE-enabled hub.
   *
   * @param input - Public key material and device metadata to upload.
   */
  async enrollDevice(input: EnrollHubDeviceInput): Promise<HubDeviceKeyRecord> {
    const result = await this.request('POST', '/devices', {
      body: input,
      schema: enrolledDeviceResponseSchema
    });
    return (result as { device: HubDeviceKeyRecord }).device;
  }

  /**
   * Lists device key enrollments for the authenticated user.
   */
  async listMyDevices(): Promise<HubDeviceKeyRecord[]> {
    const result = await this.request('GET', '/devices', {
      schema: listDeviceKeysResponseSchema
    });
    return (result as { devices: HubDeviceKeyRecord[] }).devices;
  }

  /**
   * Revokes one of the authenticated user's enrolled devices.
   *
   * @param id - Device key record identifier.
   */
  async revokeMyDevice(id: string): Promise<void> {
    await this.request('DELETE', `/devices/${id}`);
  }

  /**
   * Lists all device key enrollments visible to an admin-role token.
   */
  async listAdminDeviceKeys(): Promise<HubDeviceKeyRecord[]> {
    const result = await this.request('GET', '/admin/device-keys', {
      schema: listDeviceKeysResponseSchema
    });
    return (result as { devices: HubDeviceKeyRecord[] }).devices;
  }

  /**
   * Lists device key enrollments owned by a specific user account.
   *
   * @param userId - Owning user account identifier.
   */
  async listAdminUserDevices(userId: string): Promise<HubDeviceKeyRecord[]> {
    const result = await this.request('GET', `/admin/users/${userId}/devices`, {
      schema: listDeviceKeysResponseSchema
    });
    return (result as { devices: HubDeviceKeyRecord[] }).devices;
  }

  /**
   * Revokes a device key enrollment via the management API.
   *
   * @param id - Device key record identifier.
   */
  async revokeAdminDeviceKey(id: string): Promise<void> {
    await this.request('DELETE', `/admin/device-keys/${id}`);
  }

  /**
   * Lists all collections as id/name metadata for admin user management.
   */
  async listAdminCollections(): Promise<AdminResourceOption[]> {
    const result = await this.request('GET', '/admin/collections', {
      schema: listAdminCollectionsResponseSchema
    });
    return (result as { collections: AdminResourceOption[] }).collections;
  }

  /**
   * Lists all environments as id/name metadata for admin user management.
   */
  async listAdminEnvironments(): Promise<AdminResourceOption[]> {
    const result = await this.request('GET', '/admin/environments', {
      schema: listAdminEnvironmentsResponseSchema
    });
    return (result as { environments: AdminResourceOption[] }).environments;
  }

  /**
   * Lists folders in a collection for operator inspection.
   *
   * @param collectionId - Parent collection UUID.
   */
  async listAdminCollectionFolders(collectionId: string): Promise<FolderRecord[]> {
    const result = await this.request('GET', `/admin/collections/${collectionId}/folders`, {
      schema: listFoldersResponseSchema
    });
    return (result as { folders: FolderRecord[] }).folders;
  }

  /**
   * Lists saved requests in a collection for operator inspection.
   *
   * @param collectionId - Parent collection UUID.
   */
  async listAdminCollectionRequests(collectionId: string): Promise<SavedRequestRecord[]> {
    const result = await this.request('GET', `/admin/collections/${collectionId}/requests`, {
      schema: listRequestsResponseSchema
    });
    return (result as { requests: SavedRequestRecord[] }).requests;
  }

  /**
   * Deletes a collection via the admin management API.
   *
   * @param id - Collection UUID.
   */
  async deleteAdminCollection(id: string): Promise<void> {
    await this.request('DELETE', `/admin/collections/${id}`);
  }

  /**
   * Deletes an environment via the admin management API.
   *
   * @param id - Environment UUID.
   */
  async deleteAdminEnvironment(id: string): Promise<void> {
    await this.request('DELETE', `/admin/environments/${id}`);
  }

  /**
   * Deletes a saved request via the admin management API.
   *
   * @param id - Saved request UUID.
   */
  async deleteAdminRequest(id: string): Promise<void> {
    await this.request('DELETE', `/admin/requests/${id}`);
  }

  /**
   * Updates whether non-admin users may delete a collection.
   *
   * @param id - Collection UUID.
   * @param deletionLocked - When true, user-role tokens cannot delete the collection.
   */
  async updateAdminCollectionDeletionLocked(
    id: string,
    deletionLocked: boolean
  ): Promise<AdminEntityConfig> {
    const result = await this.request('PUT', `/admin/collections/${id}`, {
      body: { deletionLocked },
      schema: adminEntityConfigSchema
    });
    return result as AdminEntityConfig;
  }

  /**
   * Updates whether non-admin users may delete an environment.
   *
   * @param id - Environment UUID.
   * @param deletionLocked - When true, user-role tokens cannot delete the environment.
   */
  async updateAdminEnvironmentDeletionLocked(
    id: string,
    deletionLocked: boolean
  ): Promise<AdminEntityConfig> {
    const result = await this.request('PUT', `/admin/environments/${id}`, {
      body: { deletionLocked },
      schema: adminEntityConfigSchema
    });
    return result as AdminEntityConfig;
  }

  /**
   * Lists all snippets for admin user management.
   */
  async listAdminSnippets(): Promise<SnippetRecord[]> {
    const result = await this.request('GET', '/admin/snippets', {
      schema: listAdminSnippetsResponseSchema
    });
    return (result as { snippets: SnippetRecord[] }).snippets;
  }

  /**
   * Creates a snippet through the management API.
   *
   * @param input - Display name, JavaScript source, and scope for the new snippet.
   */
  async createAdminSnippet(input: CreateSnippetInput): Promise<SnippetRecord> {
    const result = await this.request('POST', '/admin/snippets', {
      body: input,
      schema: snippetRecordSchema
    });
    return result as SnippetRecord;
  }

  /**
   * Updates a snippet's name, code, and scope through the management API.
   *
   * @param id - Snippet UUID.
   * @param input - Updated snippet fields.
   */
  async updateAdminSnippet(id: string, input: UpdateSnippetInput): Promise<SnippetRecord> {
    const result = await this.request('PUT', `/admin/snippets/${id}`, {
      body: input,
      schema: snippetRecordSchema
    });
    return result as SnippetRecord;
  }

  /**
   * Deletes a snippet regardless of deletion lock state.
   *
   * @param id - Snippet UUID.
   */
  async deleteAdminSnippet(id: string): Promise<void> {
    await this.request('DELETE', `/admin/snippets/${id}`);
  }

  /**
   * Lists all run results for admin management.
   */
  async listAdminRunResults(): Promise<RunResultRecord[]> {
    const result = await this.request('GET', '/admin/run-results', {
      schema: listAdminRunResultsResponseSchema
    });
    return (result as { runResults: RunResultRecord[] }).runResults;
  }

  /**
   * Deletes a run result via the admin management API.
   *
   * @param id - Run result UUID.
   */
  async deleteAdminRunResult(id: string): Promise<void> {
    await this.request('DELETE', `/admin/run-results/${id}`);
  }

  /**
   * Lists all hub-offered LLM models for admin user management.
   *
   * Returns an empty list when LLM support is not configured on the hub.
   */
  async listAdminLlmModels(): Promise<ListHubLlmModelsResponse> {
    try {
      const result = await this.request('GET', '/admin/llm/models', {
        schema: listHubLlmModelsResponseSchema
      });
      return result as ListHubLlmModelsResponse;
    } catch (error) {
      if (error instanceof TeamHubClientError && error.status === 503) {
        return { models: [], capabilities: { openai: false } };
      }

      throw error;
    }
  }

  /**
   * Returns whether the Team Hub server has LLM support configured.
   *
   * Uses the admin models route for management tokens and the user route otherwise.
   * A 503 response means LLM is not configured; any other successful response means
   * configured.
   *
   * @param managementApi - When true, probes `GET /admin/llm/models`.
   */
  async probeLlmServiceEnabled(managementApi: boolean): Promise<boolean> {
    const path = managementApi ? '/admin/llm/models' : '/llm/models';

    try {
      await this.request('GET', path, {
        schema: listHubLlmModelsResponseSchema
      });
      return true;
    } catch (error) {
      if (error instanceof TeamHubClientError && error.status === 503) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Returns whether the Team Hub server exposes snippet storage routes.
   *
   * Older hub deployments return 404 for `GET /snippets` before the feature shipped.
   */
  async probeSnippetsServiceEnabled(): Promise<boolean> {
    try {
      await this.request('GET', '/snippets', {
        schema: listSnippetsResponseSchema
      });
      return true;
    } catch (error) {
      if (isTeamHubSnippetsUnsupportedError(error)) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Returns whether the Team Hub server exposes discussion routes.
   */
  async probeCommunicationServiceEnabled(): Promise<boolean> {
    try {
      const session = await this.getSession();
      return session.capabilities.communication === true;
    } catch {
      return false;
    }
  }

  /**
   * Loads collection, environment, and LLM model options for admin user forms.
   */
  async listAdminResourceOptions(): Promise<TeamHubAdminResourceOptions> {
    const [collections, environments, llmListing] = await Promise.all([
      this.listAdminCollections(),
      this.listAdminEnvironments(),
      this.listAdminLlmModels()
    ]);

    return { collections, environments, models: llmListing.models };
  }

  /**
   * Re-reads server.yaml on the Team Hub and applies reloadable config sections.
   *
   * Returns parsed bodies for both `200` and `400` responses. Only auth and
   * transport failures throw {@link TeamHubClientError}.
   */
  async reloadConfig(): Promise<ReloadConfigResponse> {
    const method = 'POST';
    const path = '/admin/config/reload';

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.token}`
    };

    if (this.tenantId) {
      headers['X-Harbor-Tenant'] = this.tenantId;
    }

    let response: Response;
    try {
      response = await fetch(this.buildUrl(path), {
        method,
        headers,
        signal: AbortSignal.timeout(this.requestTimeoutMs)
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'TimeoutError'
          ? `Request timed out after ${this.requestTimeoutMs} ms`
          : err instanceof Error
            ? err.message
            : 'Unknown network error';
      throw new TeamHubClientError(message, { status: 0, method, path });
    }

    if (response.status !== 200 && response.status !== 400) {
      const message = await this.parseErrorMessage(response);
      throw new TeamHubClientError(message, {
        status: response.status,
        method,
        path
      });
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new TeamHubClientError('Response body is not valid JSON', {
        status: response.status,
        method,
        path
      });
    }

    const parsed = reloadConfigResponseSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const issuePath = issue?.path?.length ? issue.path.join('.') : 'body';
      const issueMessage = issue?.message ?? 'unknown schema error';
      throw new TeamHubClientError(
        `Response body failed validation (${issuePath}: ${issueMessage})`,
        {
          status: response.status,
          method,
          path
        }
      );
    }

    return parsed.data;
  }

  /**
   * Lists all collections visible to the authenticated token.
   *
   * Admin tokens receive the full catalog from `GET /collections`; create, update,
   * and delete remain forbidden on the server.
   */
  async listCollections(): Promise<CollectionRecord[]> {
    const result = await this.request('GET', '/collections', {
      schema: listCollectionsResponseSchema
    });
    return (result as { collections: CollectionRecord[] }).collections;
  }

  /**
   * Creates a new top-level collection.
   *
   * @param input - Display name for the collection.
   */
  async createCollection(input: CreateCollectionInput): Promise<CollectionRecord> {
    const result = await this.request('POST', '/collections', {
      body: input,
      schema: collectionRecordSchema
    });
    return result as CollectionRecord;
  }

  /**
   * Updates an existing collection's settings.
   *
   * @param id - Collection UUID.
   * @param input - Updated collection fields.
   */
  async updateCollection(id: string, input: UpdateCollectionInput): Promise<CollectionRecord> {
    const result = await this.request('PUT', `/collections/${id}`, {
      body: input,
      schema: collectionRecordSchema
    });
    return result as CollectionRecord;
  }

  /**
   * Deletes a collection and all nested folders and requests.
   *
   * @param id - Collection UUID.
   */
  async deleteCollection(id: string): Promise<void> {
    await this.request('DELETE', `/collections/${id}`);
  }

  /**
   * Lists all environments visible to the authenticated token.
   *
   * Admin tokens receive the full catalog from `GET /environments`; create, update,
   * and delete remain forbidden on the server.
   */
  async listEnvironments(): Promise<EnvironmentRecord[]> {
    const result = await this.request('GET', '/environments', {
      schema: listEnvironmentsResponseSchema
    });
    return (result as { environments: EnvironmentRecord[] }).environments;
  }

  /**
   * Creates a new top-level environment.
   *
   * @param input - Display name for the environment.
   */
  async createEnvironment(input: CreateEnvironmentInput): Promise<EnvironmentRecord> {
    const result = await this.request('POST', '/environments', {
      body: input,
      schema: environmentRecordSchema
    });
    return result as EnvironmentRecord;
  }

  /**
   * Updates an existing environment's name and variables.
   *
   * @param id - Environment UUID.
   * @param input - Updated environment fields.
   */
  async updateEnvironment(id: string, input: UpdateEnvironmentInput): Promise<EnvironmentRecord> {
    const result = await this.request('PUT', `/environments/${id}`, {
      body: input,
      schema: environmentRecordSchema
    });
    return result as EnvironmentRecord;
  }

  /**
   * Deletes an environment by id.
   *
   * @param id - Environment UUID.
   */
  async deleteEnvironment(id: string): Promise<void> {
    await this.request('DELETE', `/environments/${id}`);
  }

  /**
   * Lists all snippets visible to the authenticated token.
   *
   * Admin tokens receive the full catalog from `GET /snippets`; create, update,
   * and delete remain forbidden on the server.
   */
  async listSnippets(): Promise<SnippetRecord[]> {
    const result = await this.request('GET', '/snippets', {
      schema: listSnippetsResponseSchema
    });
    return (result as { snippets: SnippetRecord[] }).snippets;
  }

  /**
   * Creates a new top-level snippet.
   *
   * @param input - Display name for the snippet.
   */
  async createSnippet(input: CreateSnippetInput): Promise<SnippetRecord> {
    const result = await this.request('POST', '/snippets', {
      body: input,
      schema: snippetRecordSchema
    });
    return result as SnippetRecord;
  }

  /**
   * Updates an existing snippet's name, code, and scope.
   *
   * @param id - Snippet UUID.
   * @param input - Updated snippet fields.
   */
  async updateSnippet(id: string, input: UpdateSnippetInput): Promise<SnippetRecord> {
    const result = await this.request('PUT', `/snippets/${id}`, {
      body: input,
      schema: snippetRecordSchema
    });
    return result as SnippetRecord;
  }

  /**
   * Deletes a snippet by id.
   *
   * @param id - Snippet UUID.
   */
  async deleteSnippet(id: string): Promise<void> {
    await this.request('DELETE', `/snippets/${id}`);
  }

  /**
   * Lists all live servers visible to the authenticated token.
   */
  async listLiveServers(): Promise<LiveServerRecord[]> {
    const result = await this.request('GET', '/live-servers', {
      schema: listLiveServersResponseSchema
    });
    return (result as { liveServers: LiveServerRecord[] }).liveServers;
  }

  /**
   * Creates a live server.
   *
   * @param input - Complete mutable live server configuration.
   */
  async createLiveServer(input: CreateLiveServerInput): Promise<LiveServerRecord> {
    const result = await this.request('POST', '/live-servers', {
      body: input,
      schema: liveServerRecordSchema
    });
    return result as LiveServerRecord;
  }

  /**
   * Replaces a live server's mutable configuration.
   *
   * @param id - Live server UUID.
   * @param input - Complete replacement configuration.
   */
  async updateLiveServer(id: string, input: UpdateLiveServerInput): Promise<LiveServerRecord> {
    const result = await this.request('PUT', `/live-servers/${id}`, {
      body: input,
      schema: liveServerRecordSchema
    });
    return result as LiveServerRecord;
  }

  /**
   * Deletes a live server by id.
   *
   * @param id - Live server UUID.
   */
  async deleteLiveServer(id: string): Promise<void> {
    await this.request('DELETE', `/live-servers/${id}`);
  }

  /**
   * Lists all live pages visible to the authenticated token.
   */
  async listLivePages(): Promise<LivePageRecord[]> {
    const result = await this.request('GET', '/live-pages', {
      schema: listLivePagesResponseSchema
    });
    return (result as { livePages: LivePageRecord[] }).livePages;
  }

  /**
   * Creates a live page.
   *
   * @param input - Complete mutable live page configuration.
   */
  async createLivePage(input: CreateLivePageInput): Promise<LivePageRecord> {
    const result = await this.request('POST', '/live-pages', {
      body: input,
      schema: livePageRecordSchema
    });
    return result as LivePageRecord;
  }

  /**
   * Replaces a live page's mutable configuration.
   *
   * @param id - Live page UUID.
   * @param input - Complete replacement configuration.
   */
  async updateLivePage(id: string, input: UpdateLivePageInput): Promise<LivePageRecord> {
    const result = await this.request('PUT', `/live-pages/${id}`, {
      body: input,
      schema: livePageRecordSchema
    });
    return result as LivePageRecord;
  }

  /**
   * Deletes a live page by id.
   *
   * @param id - Live page UUID.
   */
  async deleteLivePage(id: string): Promise<void> {
    await this.request('DELETE', `/live-pages/${id}`);
  }

  /**
   * Lists run results saved by the authenticated user token.
   */
  async listRunResults(): Promise<RunResultRecord[]> {
    const result = await this.request('GET', '/run-results', {
      schema: listRunResultsResponseSchema
    });
    return (result as { runResults: RunResultRecord[] }).runResults;
  }

  /**
   * Saves a run result snapshot to the Team Hub.
   *
   * @param input - Optional label and HarborClient export payload.
   */
  async createRunResult(input: CreateRunResultInput): Promise<RunResultDetail> {
    const result = await this.request('POST', '/run-results', {
      body: input,
      schema: runResultDetailSchema
    });
    return result as RunResultDetail;
  }

  /**
   * Loads a run result snapshot by id.
   *
   * @param id - Run result UUID.
   */
  async getRunResult(id: string): Promise<RunResultDetail> {
    const result = await this.request('GET', `/run-results/${id}`, {
      schema: runResultDetailSchema
    });
    return result as RunResultDetail;
  }

  /**
   * Deletes a run result saved by the authenticated user when permitted.
   *
   * @param id - Run result UUID.
   */
  async deleteRunResult(id: string): Promise<void> {
    await this.request('DELETE', `/run-results/${id}`);
  }

  /**
   * Lists folders in a collection ordered by sort order, then name.
   *
   * @param collectionId - Parent collection UUID.
   */
  async listFolders(collectionId: string): Promise<FolderRecord[]> {
    const result = await this.request('GET', `/collections/${collectionId}/folders`, {
      schema: listFoldersResponseSchema
    });
    return (result as { folders: FolderRecord[] }).folders;
  }

  /**
   * Creates a folder in the given collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Display name for the folder.
   */
  async createFolder(collectionId: string, input: CreateFolderInput): Promise<FolderRecord> {
    const result = await this.request('POST', `/collections/${collectionId}/folders`, {
      body: input,
      schema: folderRecordSchema
    });
    return result as FolderRecord;
  }

  /**
   * Renames a folder by id.
   *
   * @param id - Folder UUID.
   * @param input - Updated folder name.
   */
  async renameFolder(id: string, input: RenameFolderInput): Promise<FolderRecord> {
    const result = await this.request('PATCH', `/folders/${id}`, {
      body: input,
      schema: folderRecordSchema
    });
    return result as FolderRecord;
  }

  /**
   * Deletes a folder and all saved requests inside it.
   *
   * @param id - Folder UUID.
   */
  async deleteFolder(id: string): Promise<void> {
    await this.request('DELETE', `/folders/${id}`);
  }

  /**
   * Moves a folder to another parent or collection root.
   *
   * @param id - Folder UUID.
   * @param input - Destination parent and optional sibling index.
   */
  async moveFolder(id: string, input: MoveFolderInput): Promise<FolderRecord> {
    const result = await this.request('PUT', `/folders/${id}/move`, {
      body: input,
      schema: folderRecordSchema
    });
    return result as FolderRecord;
  }

  /**
   * Reorders sibling folders within a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Folder ids in the desired order.
   */
  async reorderFolders(collectionId: string, input: ReorderFoldersInput): Promise<void> {
    await this.request('PUT', `/collections/${collectionId}/folders/reorder`, {
      body: input
    });
  }

  /**
   * Lists saved requests in a collection.
   *
   * @param collectionId - Parent collection UUID.
   */
  async listRequests(collectionId: string): Promise<SavedRequestRecord[]> {
    const result = await this.request('GET', `/collections/${collectionId}/requests`, {
      schema: listRequestsResponseSchema
    });
    return (result as { requests: SavedRequestRecord[] }).requests;
  }

  /**
   * Creates a new saved request in a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Saved request fields.
   */
  async createRequest(
    collectionId: string,
    input: CreateRequestInput
  ): Promise<SavedRequestRecord> {
    const result = await this.request('POST', `/collections/${collectionId}/requests`, {
      body: input,
      schema: savedRequestRecordSchema
    });
    return result as SavedRequestRecord;
  }

  /**
   * Updates an existing saved request by id.
   *
   * @param id - Saved request UUID.
   * @param input - Updated request fields including collection id.
   */
  async updateRequest(id: string, input: UpdateRequestInput): Promise<SavedRequestRecord> {
    const result = await this.request('PUT', `/requests/${id}`, {
      body: input,
      schema: savedRequestRecordSchema
    });
    return result as SavedRequestRecord;
  }

  /**
   * Deletes a saved request by id.
   *
   * @param id - Saved request UUID.
   */
  async deleteRequest(id: string): Promise<void> {
    await this.request('DELETE', `/requests/${id}`);
  }

  /**
   * Reorders saved requests within a folder or the collection root.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Destination folder and ordered request ids.
   */
  async reorderRequests(collectionId: string, input: ReorderRequestsInput): Promise<void> {
    await this.request('PUT', `/collections/${collectionId}/requests/reorder`, {
      body: input
    });
  }

  /**
   * Moves a saved request to another folder or root index.
   *
   * @param id - Saved request UUID.
   * @param input - Destination folder and target index.
   */
  async moveRequest(id: string, input: MoveRequestInput): Promise<void> {
    await this.request('PUT', `/requests/${id}/move`, {
      body: input
    });
  }

  /**
   * Lists markdown documents in a collection.
   *
   * @param collectionId - Parent collection UUID.
   */
  async listDocuments(collectionId: string): Promise<DocumentRecord[]> {
    const result = await this.request('GET', `/collections/${collectionId}/documents`, {
      schema: listDocumentsResponseSchema
    });
    return (result as { documents: DocumentRecord[] }).documents;
  }

  /**
   * Creates a new markdown document in a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Document fields.
   */
  async createDocument(collectionId: string, input: CreateDocumentInput): Promise<DocumentRecord> {
    const result = await this.request('POST', `/collections/${collectionId}/documents`, {
      body: input,
      schema: documentRecordSchema
    });
    return result as DocumentRecord;
  }

  /**
   * Updates an existing markdown document by id.
   *
   * @param id - Document UUID.
   * @param input - Updated document fields including collection id.
   */
  async updateDocument(id: string, input: UpdateDocumentInput): Promise<DocumentRecord> {
    const result = await this.request('PUT', `/documents/${id}`, {
      body: input,
      schema: documentRecordSchema
    });
    return result as DocumentRecord;
  }

  /**
   * Deletes a markdown document by id.
   *
   * @param id - Document UUID.
   */
  async deleteDocument(id: string): Promise<void> {
    await this.request('DELETE', `/documents/${id}`);
  }

  /**
   * Reorders markdown documents within a folder or the collection root.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Destination folder and ordered document ids.
   */
  async reorderDocuments(collectionId: string, input: ReorderDocumentsInput): Promise<void> {
    await this.request('PUT', `/collections/${collectionId}/documents/reorder`, {
      body: input
    });
  }

  /**
   * Moves a markdown document to another folder or root index.
   *
   * @param id - Document UUID.
   * @param input - Destination folder and target index.
   */
  async moveDocument(id: string, input: MoveDocumentInput): Promise<void> {
    await this.request('PUT', `/documents/${id}/move`, {
      body: input
    });
  }

  /**
   * Lists hub-offered LLM models visible to the authenticated token.
   */
  async listLlmModels(): Promise<ListHubLlmModelsResponse> {
    const result = await this.request('GET', '/llm/models', {
      schema: listHubLlmModelsResponseSchema
    });
    return result as ListHubLlmModelsResponse;
  }

  /**
   * Returns plugin catalog and trusted-publisher URLs configured on this Team Hub.
   */
  async getPluginSources(): Promise<PluginSourcesResponse> {
    const result = await this.request('GET', '/plugins/sources', {
      schema: pluginSourcesResponseSchema
    });
    return result as PluginSourcesResponse;
  }

  /**
   * Builds the list/create path for an entity-scoped discussion route.
   *
   * @param entityType - Target entity kind.
   * @param entityId - Target entity UUID.
   */
  private discussionEntityPath(entityType: DiscussionEntityType, entityId: string): string {
    switch (entityType) {
      case 'request':
        return `/requests/${entityId}/discussions`;
      case 'collection':
        return `/collections/${entityId}/discussions`;
      case 'folder':
        return `/folders/${entityId}/discussions`;
      case 'runResult':
        return `/run-results/${entityId}/discussions`;
    }
  }

  /**
   * Serializes optional pagination query parameters for discussion list routes.
   *
   * @param query - Optional cursor and limit.
   */
  private discussionQueryString(query?: ListDiscussionsQuery): string {
    if (query == null) {
      return '';
    }

    const params = new URLSearchParams();
    if (query.cursor) {
      params.set('cursor', query.cursor);
    }
    if (query.limit != null) {
      params.set('limit', String(query.limit));
    }

    const serialized = params.toString();
    return serialized.length > 0 ? `?${serialized}` : '';
  }

  /**
   * Lists discussion comments for a target entity.
   *
   * @param entityType - Target entity kind.
   * @param entityId - Target entity UUID.
   * @param query - Optional pagination cursor and limit.
   */
  private async listEntityDiscussions(
    entityType: DiscussionEntityType,
    entityId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse> {
    const path = `${this.discussionEntityPath(entityType, entityId)}${this.discussionQueryString(query)}`;
    const result = await this.request('GET', path, {
      schema: listDiscussionsResponseSchema
    });
    return result as ListDiscussionsResponse;
  }

  /**
   * Creates a discussion comment on a target entity.
   *
   * @param entityType - Target entity kind.
   * @param entityId - Target entity UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  private async createEntityDiscussion(
    entityType: DiscussionEntityType,
    entityId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment> {
    const result = await this.request('POST', this.discussionEntityPath(entityType, entityId), {
      body: input,
      schema: discussionCommentSchema
    });
    return result as DiscussionComment;
  }

  /**
   * Lists discussion comments for a saved request.
   *
   * @param requestId - Saved request UUID.
   * @param query - Optional pagination cursor and limit.
   */
  async listRequestDiscussions(
    requestId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse> {
    return this.listEntityDiscussions('request', requestId, query);
  }

  /**
   * Creates a discussion comment on a saved request.
   *
   * @param requestId - Saved request UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  async createRequestDiscussion(
    requestId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment> {
    return this.createEntityDiscussion('request', requestId, input);
  }

  /**
   * Lists discussion comments for a collection.
   *
   * @param collectionId - Collection UUID.
   * @param query - Optional pagination cursor and limit.
   */
  async listCollectionDiscussions(
    collectionId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse> {
    return this.listEntityDiscussions('collection', collectionId, query);
  }

  /**
   * Creates a discussion comment on a collection.
   *
   * @param collectionId - Collection UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  async createCollectionDiscussion(
    collectionId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment> {
    return this.createEntityDiscussion('collection', collectionId, input);
  }

  /**
   * Lists discussion comments for a folder.
   *
   * @param folderId - Folder UUID.
   * @param query - Optional pagination cursor and limit.
   */
  async listFolderDiscussions(
    folderId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse> {
    return this.listEntityDiscussions('folder', folderId, query);
  }

  /**
   * Creates a discussion comment on a folder.
   *
   * @param folderId - Folder UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  async createFolderDiscussion(
    folderId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment> {
    return this.createEntityDiscussion('folder', folderId, input);
  }

  /**
   * Lists discussion comments for a saved run result.
   *
   * @param runResultId - Run result UUID.
   * @param query - Optional pagination cursor and limit.
   */
  async listRunResultDiscussions(
    runResultId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse> {
    return this.listEntityDiscussions('runResult', runResultId, query);
  }

  /**
   * Creates a discussion comment on a saved run result.
   *
   * @param runResultId - Run result UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  async createRunResultDiscussion(
    runResultId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment> {
    return this.createEntityDiscussion('runResult', runResultId, input);
  }

  /**
   * Creates a reply to an existing discussion comment.
   *
   * @param commentId - Parent comment UUID.
   * @param input - Reply body text.
   */
  async createDiscussionReply(
    commentId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment> {
    const result = await this.request('POST', `/discussion-comments/${commentId}/replies`, {
      body: input,
      schema: discussionCommentSchema
    });
    return result as DiscussionComment;
  }

  /**
   * Updates an existing discussion comment body.
   *
   * @param commentId - Comment UUID.
   * @param input - Replacement body text.
   */
  async updateDiscussionComment(
    commentId: string,
    input: UpdateDiscussionCommentInput
  ): Promise<DiscussionComment> {
    const result = await this.request('PUT', `/discussion-comments/${commentId}`, {
      body: input,
      schema: discussionCommentSchema
    });
    return result as DiscussionComment;
  }

  /**
   * Tombstones a discussion comment by id.
   *
   * @param commentId - Comment UUID.
   */
  async deleteDiscussionComment(commentId: string): Promise<DiscussionComment> {
    const result = await this.request('DELETE', `/discussion-comments/${commentId}`, {
      schema: discussionCommentSchema
    });
    return result as DiscussionComment;
  }

  /**
   * Posts an MLS commit relay record for offline catch-up.
   *
   * @param input - Commit payload to persist on the Team Hub server.
   */
  async createDiscussionMlsCommit(
    input: import('./discussionMlsTypes.js').CreateDiscussionMlsCommitInput
  ): Promise<import('./discussionMlsTypes.js').DiscussionMlsCommit> {
    const result = await this.request('POST', '/discussion-mls/commits', {
      body: input,
      schema: discussionMlsCommitSchema
    });
    return result as import('./discussionMlsTypes.js').DiscussionMlsCommit;
  }

  /**
   * Lists MLS commits for a discussion thread in ascending epoch order.
   *
   * @param query - MLS group id and optional pagination options.
   */
  async listDiscussionMlsCommits(
    query: import('./discussionMlsTypes.js').ListDiscussionMlsCommitsQuery
  ): Promise<import('./discussionMlsTypes.js').ListDiscussionMlsCommitsResponse> {
    const params = new URLSearchParams({ mlsGroupId: query.mlsGroupId });
    if (query.cursor) {
      params.set('cursor', query.cursor);
    }
    if (query.limit != null) {
      params.set('limit', String(query.limit));
    }

    const result = await this.request('GET', `/discussion-mls/commits?${params.toString()}`, {
      schema: listDiscussionMlsCommitsResponseSchema
    });
    return result as import('./discussionMlsTypes.js').ListDiscussionMlsCommitsResponse;
  }

  /**
   * Posts an MLS welcome relay record for a newly added device.
   *
   * @param input - Welcome payload to persist on the Team Hub server.
   */
  async createDiscussionMlsWelcome(
    input: import('./discussionMlsTypes.js').CreateDiscussionMlsWelcomeInput
  ): Promise<import('./discussionMlsTypes.js').DiscussionMlsWelcome> {
    const result = await this.request('POST', '/discussion-mls/welcomes', {
      body: input,
      schema: discussionMlsWelcomeSchema
    });
    return result as import('./discussionMlsTypes.js').DiscussionMlsWelcome;
  }

  /**
   * Lists MLS welcomes for a discussion thread.
   *
   * @param query - MLS group id and optional recipient device filter.
   */
  async listDiscussionMlsWelcomes(
    query: import('./discussionMlsTypes.js').ListDiscussionMlsWelcomesQuery
  ): Promise<import('./discussionMlsTypes.js').ListDiscussionMlsWelcomesResponse> {
    const params = new URLSearchParams({ mlsGroupId: query.mlsGroupId });
    if (query.recipientDeviceId) {
      params.set('recipientDeviceId', query.recipientDeviceId);
    }

    const result = await this.request('GET', `/discussion-mls/welcomes?${params.toString()}`, {
      schema: listDiscussionMlsWelcomesResponseSchema
    });
    return result as import('./discussionMlsTypes.js').ListDiscussionMlsWelcomesResponse;
  }

  /**
   * Returns the latest MLS epoch observed for a discussion thread.
   *
   * @param mlsGroupId - Canonical MLS group id for the discussion thread.
   */
  async getDiscussionMlsGroupState(
    mlsGroupId: string
  ): Promise<import('./discussionMlsTypes.js').DiscussionMlsGroupState> {
    const result = await this.request(
      'GET',
      `/discussion-mls/group-state/${encodeURIComponent(mlsGroupId)}`,
      {
        schema: discussionMlsGroupStateSchema
      }
    );
    return result as import('./discussionMlsTypes.js').DiscussionMlsGroupState;
  }

  /**
   * Serializes optional pagination query parameters for notice list routes.
   *
   * @param query - Optional cursor and limit.
   */
  private noticeQueryString(query?: ListNoticesQuery): string {
    if (query == null) {
      return '';
    }

    const params = new URLSearchParams();
    if (query.cursor) {
      params.set('cursor', query.cursor);
    }
    if (query.limit != null) {
      params.set('limit', String(query.limit));
    }

    const serialized = params.toString();
    return serialized.length > 0 ? `?${serialized}` : '';
  }

  /**
   * Lists collaboration notices for the authenticated user.
   *
   * @param query - Optional pagination cursor and limit.
   */
  async listNotices(query?: ListNoticesQuery): Promise<ListNoticesResponse> {
    const path = `/notices${this.noticeQueryString(query)}`;
    const result = await this.request('GET', path, {
      schema: listNoticesResponseSchema
    });
    return result as ListNoticesResponse;
  }

  /**
   * Returns the unread notice count for the authenticated user.
   */
  async getNoticesUnreadCount(): Promise<NoticesUnreadCountResponse> {
    const result = await this.request('GET', '/notices/unread-count', {
      schema: noticesUnreadCountResponseSchema
    });
    return result as NoticesUnreadCountResponse;
  }

  /**
   * Marks one notice as read for the authenticated user.
   *
   * @param noticeId - Notice record identifier.
   */
  async markNoticeRead(noticeId: string): Promise<TeamHubNotice> {
    const result = await this.request('POST', `/notices/${noticeId}/read`, {
      schema: teamHubNoticeSchema
    });
    return result as TeamHubNotice;
  }

  /**
   * Marks every notice as read for the authenticated user.
   */
  async markAllNoticesRead(): Promise<void> {
    await this.request('POST', '/notices/read-all');
  }

  /**
   * Opens the authenticated notice SSE stream until aborted or the connection closes.
   *
   * @param handlers - Stream lifecycle callbacks.
   * @param signal - Optional abort signal used to stop reading.
   */
  async subscribeNoticeStream(handlers: NoticeStreamHandlers, signal?: AbortSignal): Promise<void> {
    if (!this.token) {
      throw new TeamHubClientError('Bearer token is required for authenticated requests', {
        status: 0,
        method: 'GET',
        path: '/notices/stream'
      });
    }

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${this.token}`
    };

    if (this.tenantId) {
      headers['X-Harbor-Tenant'] = this.tenantId;
    }

    const controller = new AbortController();
    const unlinkAbort = linkAbortSignal(signal, controller);

    try {
      const response = await fetch(this.buildUrl('/notices/stream'), {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new TeamHubClientError(await this.parseErrorMessage(response), {
          status: response.status,
          method: 'GET',
          path: '/notices/stream'
        });
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        throw new TeamHubClientError('Response Content-Type is not text/event-stream', {
          status: response.status,
          method: 'GET',
          path: '/notices/stream'
        });
      }

      if (!response.body) {
        throw new TeamHubClientError('Notice stream response has no body', {
          status: response.status,
          method: 'GET',
          path: '/notices/stream'
        });
      }

      handlers.onOpen?.();
      await readNoticeStreamBody(response.body, { onEvent: handlers.onEvent }, controller.signal);
      handlers.onClose?.();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      handlers.onClose?.(
        error instanceof Error
          ? error
          : new TeamHubClientError(String(error), {
              status: 0,
              method: 'GET',
              path: '/notices/stream'
            })
      );
      throw error;
    } finally {
      unlinkAbort();
    }
  }

  /**
   * Returns notification settings for the authenticated user.
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    const result = await this.request('GET', '/me/notification-settings', {
      schema: notificationSettingsSchema
    });
    return result as NotificationSettings;
  }

  /**
   * Updates notification settings for the authenticated user.
   *
   * @param input - Replacement notification delivery preference.
   */
  async updateNotificationSettings(
    input: UpdateNotificationSettingsInput
  ): Promise<NotificationSettings> {
    const result = await this.request('PUT', '/me/notification-settings', {
      body: input,
      schema: notificationSettingsSchema
    });
    return result as NotificationSettings;
  }

  /**
   * Returns whether the authenticated user is subscribed to a discussion thread.
   *
   * @param threadId - Discussion thread identifier (typically root comment id).
   */
  async getDiscussionThreadSubscription(threadId: string): Promise<DiscussionThreadSubscription> {
    const result = await this.request('GET', `/discussion-threads/${threadId}/subscription`, {
      schema: discussionThreadSubscriptionSchema
    });
    return result as DiscussionThreadSubscription;
  }

  /**
   * Subscribes the authenticated user to a discussion thread.
   *
   * @param threadId - Discussion thread identifier (typically root comment id).
   */
  async subscribeDiscussionThread(threadId: string): Promise<DiscussionThreadSubscription> {
    const result = await this.request('POST', `/discussion-threads/${threadId}/subscribe`, {
      schema: discussionThreadSubscriptionSchema
    });
    return result as DiscussionThreadSubscription;
  }

  /**
   * Unsubscribes the authenticated user from a discussion thread.
   *
   * @param threadId - Discussion thread identifier (typically root comment id).
   */
  async unsubscribeDiscussionThread(threadId: string): Promise<DiscussionThreadSubscription> {
    const result = await this.request('POST', `/discussion-threads/${threadId}/unsubscribe`, {
      schema: discussionThreadSubscriptionSchema
    });
    return result as DiscussionThreadSubscription;
  }

  /**
   * Runs one hub-proxied LLM completion step.
   *
   * @param input - Model, messages, tools, and system prompt for the step.
   */
  async completeChatStep(input: HubChatStepRequest): Promise<ChatStepResult> {
    const result = await this.request('POST', '/llm/chat/step', {
      body: input,
      schema: hubChatStepResponseSchema
    });
    return result as ChatStepResult;
  }

  /**
   * Runs one hub-proxied LLM completion step and consumes its canonical SSE events.
   *
   * The configured request timeout and optional caller cancellation both remain
   * active for the full lifetime of the response body.
   *
   * @param input - Model input plus desktop turn and step correlation fields.
   * @param handlers - Callback invoked for every validated stream event.
   * @param signal - Optional caller cancellation signal.
   * @returns Final backward-compatible result reconstructed from `step.end`.
   */
  async completeChatStepStream(
    input: HubChatStepStreamRequest,
    handlers: AiChatStreamHandlers,
    signal?: AbortSignal
  ): Promise<ChatStepResult> {
    const method = 'POST';
    const path = '/llm/chat/stream';
    if (!this.token) {
      throw new TeamHubClientError('Bearer token is required for authenticated requests', {
        status: 0,
        method,
        path
      });
    }

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
    if (this.tenantId) {
      headers['X-Harbor-Tenant'] = this.tenantId;
    }

    const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
    const requestSignal = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;
    let response: Response;
    try {
      response = await fetch(this.buildUrl(path), {
        method,
        headers,
        body: JSON.stringify(input),
        signal: requestSignal
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      const message =
        error instanceof Error && (error.name === 'TimeoutError' || timeoutSignal.aborted)
          ? `Request timed out after ${this.requestTimeoutMs} ms`
          : error instanceof Error
            ? error.message
            : 'Unknown network error';
      throw new TeamHubClientError(message, { status: 0, method, path });
    }

    if (!response.ok) {
      throw new TeamHubClientError(await this.parseErrorMessage(response), {
        status: response.status,
        method,
        path
      });
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      throw new TeamHubClientError('Response Content-Type is not text/event-stream', {
        status: response.status,
        method,
        path
      });
    }
    if (!response.body) {
      throw new TeamHubClientError('AI chat stream response has no body', {
        status: response.status,
        method,
        path
      });
    }

    try {
      return await readAiChatStreamBody(response.body, handlers, requestSignal);
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      const message = timeoutSignal.aborted
        ? `Request timed out after ${this.requestTimeoutMs} ms`
        : error instanceof Error
          ? error.message
          : 'AI chat stream failed';
      throw new TeamHubClientError(message, { status: response.status, method, path });
    }
  }
}

/**
 * Links an optional parent abort signal to a child controller.
 *
 * @param parent - External abort signal, when provided.
 * @param controller - Child controller aborted with the parent.
 * @returns Cleanup function that removes the listener.
 */
function linkAbortSignal(parent: AbortSignal | undefined, controller: AbortController): () => void {
  if (!parent) {
    return () => {};
  }

  if (parent.aborted) {
    controller.abort();
    return () => {};
  }

  /**
   * Aborts the child controller when the parent signal fires.
   */
  const onAbort = (): void => {
    controller.abort();
  };

  parent.addEventListener('abort', onAbort);
  return () => {
    parent.removeEventListener('abort', onAbort);
  };
}
