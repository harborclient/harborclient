import type { z } from 'zod';
import type { ITeamHubClient } from '#/main/teamHub/ITeamHubClient';
import { TeamHubClientError } from '#/main/teamHub/TeamHubClientError';
import {
  collectionRecordSchema,
  environmentRecordSchema,
  errorResponseSchema,
  folderRecordSchema,
  healthResponseSchema,
  listCollectionsResponseSchema,
  listEnvironmentsResponseSchema,
  listFoldersResponseSchema,
  listHubLlmModelsResponseSchema,
  listRequestsResponseSchema,
  hubChatStepResponseSchema,
  savedRequestRecordSchema,
  sessionResponseSchema,
  listAdminUsersResponseSchema,
  listAdminCollectionsResponseSchema,
  listAdminEnvironmentsResponseSchema,
  createAdminUserResponseSchema,
  createdApiTokenResponseSchema,
  listAdminTokensResponseSchema,
  hubUserRecordSchema
} from '#/main/teamHub/schemas';
import type {
  AdminResourceOption,
  CollectionRecord,
  CreateCollectionInput,
  CreateEnvironmentInput,
  CreateFolderInput,
  CreateHubTokenInput,
  CreateHubUserInput,
  CreateRequestInput,
  CreatedHubToken,
  CreatedHubUser,
  EnvironmentRecord,
  FolderRecord,
  HealthResponse,
  HubApiTokenRecord,
  HubUserRecord,
  MoveRequestInput,
  RenameFolderInput,
  ReorderFoldersInput,
  ReorderRequestsInput,
  SavedRequestRecord,
  TeamHubClientConfig,
  SessionResponse,
  TeamHubAdminResourceOptions,
  UpdateCollectionInput,
  UpdateEnvironmentInput,
  UpdateHubUserInput,
  UpdateRequestInput
} from '#/main/teamHub/types';
import type { ChatStepMessage, ChatStepResult, HubLlmModel } from '#/shared/types';

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
  private readonly token: string;
  private readonly requestTimeoutMs: number;

  /**
   * Creates a client bound to a HarborClient Server instance and bearer token.
   *
   * @param config - Base URL, token, and optional request timeout.
   */
  constructor(config: TeamHubClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_TEAM_HUB_REQUEST_TIMEOUT_MS;
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
      headers.Authorization = `Bearer ${this.token}`;
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
      throw new TeamHubClientError('Response body failed validation', {
        status: response.status,
        method,
        path
      });
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
   * Lists all hub-offered LLM models for admin user management.
   *
   * Returns an empty list when LLM support is not configured on the hub.
   */
  async listAdminLlmModels(): Promise<HubLlmModel[]> {
    try {
      const result = await this.request('GET', '/admin/llm/models', {
        schema: listHubLlmModelsResponseSchema
      });
      return (result as { models: HubLlmModel[] }).models;
    } catch (error) {
      if (error instanceof TeamHubClientError && error.status === 503) {
        return [];
      }

      throw error;
    }
  }

  /**
   * Loads collection, environment, and LLM model options for admin user forms.
   */
  async listAdminResourceOptions(): Promise<TeamHubAdminResourceOptions> {
    const [collections, environments, models] = await Promise.all([
      this.listAdminCollections(),
      this.listAdminEnvironments(),
      this.listAdminLlmModels()
    ]);

    return { collections, environments, models };
  }

  /**
   * Lists all collections visible to the authenticated token.
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
   * Reorders folders within a collection.
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
   * Lists hub-offered LLM models visible to the authenticated token.
   */
  async listLlmModels(): Promise<HubLlmModel[]> {
    const result = await this.request('GET', '/llm/models', {
      schema: listHubLlmModelsResponseSchema
    });
    return (result as { models: HubLlmModel[] }).models;
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
}
