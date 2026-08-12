import type {
  AdminEntityConfig,
  AdminResourceOption,
  CollectionRecord,
  CreateCollectionInput,
  CreateDocumentInput,
  CreateEnvironmentInput,
  CreateFolderInput,
  CreateLivePageInput,
  CreateLiveServerInput,
  CreateRequestInput,
  CreateRunResultInput,
  CreateSnippetInput,
  DocumentRecord,
  EnvironmentRecord,
  FolderRecord,
  HealthResponse,
  HubAvatarMetadata,
  HubUserRecord,
  LivePageRecord,
  LiveServerRecord,
  MoveDocumentInput,
  MoveFolderInput,
  MoveRequestInput,
  PluginSourcesResponse,
  RenameFolderInput,
  ReorderDocumentsInput,
  ReorderFoldersInput,
  ReorderRequestsInput,
  RunResultDetail,
  RunResultRecord,
  SavedRequestRecord,
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
  UserAvatarImage,
  UpdateLivePageInput,
  UpdateLiveServerInput,
  CreateHubUserInput,
  CreateInvitedHubUserInput,
  CreateUserInvitationInput,
  CreatedInvitedHubUser,
  HubApiTokenRecord,
  HubDeviceKeyRecord,
  EnrollHubDeviceInput,
  CreatedHubUser,
  CreateHubTokenInput,
  CreatedHubToken,
  HubInvitationPreview,
  HubInvitationRecord,
  PreviewHubInvitationInput,
  RedeemHubInvitationInput,
  UpdateRequestInput,
  UpdateSnippetInput,
  ReloadConfigResponse
} from './types.js';
import type { ChatStepResult, ListHubLlmModelsResponse } from './appTypes.js';
import type { HubChatStepRequest, HubChatStepStreamRequest } from './TeamHubClient.js';
import type { AiChatStreamHandlers } from './readAiChatStream.js';
import type {
  CreateDiscussionCommentInput,
  DiscussionComment,
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
import type { NoticeStreamHandlers } from './noticeStreamTypes.js';

/**
 * Typed HTTP client for HarborClient Server entity and health routes.
 */
export interface ITeamHubClient {
  /**
   * Probes server availability via the public health endpoint.
   */
  checkHealth(): Promise<HealthResponse>;

  /**
   * Returns the authenticated user, token metadata, and derived API capabilities.
   *
   * Calls `GET /auth/session` with bearer auth. Use this to discover whether
   * a token belongs to a `user` or `admin` account before gating management UI.
   */
  getSession(): Promise<SessionResponse>;

  /**
   * Updates avatar initials, color, and/or uploaded image for the authenticated user.
   *
   * @param input - Replacement initials, color key, and/or image data URL.
   */
  updateMyAvatar(input: UpdateMyAvatarInput): Promise<UpdateMyAvatarResponse>;

  /**
   * Fetches the uploaded avatar image bytes for a Team Hub user account.
   *
   * @param userId - User account whose avatar image should be loaded.
   * @param version - Optional cache-busting version from the avatar image URL.
   */
  getUserAvatar(userId: string, version?: string): Promise<UserAvatarImage>;

  /**
   * Fetches the uploaded hub avatar image bytes for the active tenant namespace.
   *
   * @param version - Optional cache-busting version from the hub avatar image URL.
   */
  getHubAvatar(version?: string): Promise<UserAvatarImage>;

  /**
   * Updates hub avatar initials, color, and/or uploaded image for the active tenant.
   *
   * Requires an admin-role bearer token.
   *
   * @param input - Replacement initials, color key, and/or image data URL.
   */
  updateAdminHubAvatar(input: UpdateHubAvatarInput): Promise<HubAvatarMetadata>;

  /**
   * Lists all Team Hub user accounts visible to an admin-role token.
   */
  listAdminUsers(): Promise<HubUserRecord[]>;

  /**
   * Creates a Team Hub user account and an initial API bearer token.
   *
   * @param input - User fields for the new account.
   */
  createAdminUser(input: CreateHubUserInput): Promise<CreatedHubUser>;

  /**
   * Creates a Team Hub user account and a single-use onboarding invitation.
   *
   * @param input - User fields and optional invitation expiry for the new account.
   */
  createAdminInvitedUser(input: CreateInvitedHubUserInput): Promise<CreatedInvitedHubUser>;

  /**
   * Issues a replacement onboarding invitation for an existing user account.
   *
   * @param userId - User account identifier.
   * @param input - Optional invitation expiry override.
   */
  createAdminUserInvitation(
    userId: string,
    input?: CreateUserInvitationInput
  ): Promise<CreatedInvitedHubUser>;

  /**
   * Lists onboarding invitations for operator review and recovery.
   */
  listAdminInvitations(): Promise<HubInvitationRecord[]>;

  /**
   * Revokes a pending onboarding invitation so it can no longer be redeemed.
   *
   * @param id - Invitation record identifier.
   */
  revokeAdminInvitation(id: string): Promise<void>;

  /**
   * Returns invited user details for confirmation without consuming the invitation.
   *
   * @param input - Invitation secret supplied by the operator or invitee.
   */
  previewInvitation(input: PreviewHubInvitationInput): Promise<HubInvitationPreview>;

  /**
   * Consumes a pending invitation and returns a one-time permanent API token secret.
   *
   * @param input - Invitation secret and optional token label.
   */
  redeemInvitation(input: RedeemHubInvitationInput): Promise<CreatedHubToken>;

  /**
   * Updates a Team Hub user account via the management API.
   *
   * @param id - User account identifier.
   * @param input - Partial user fields to apply.
   */
  updateAdminUser(id: string, input: UpdateHubUserInput): Promise<HubUserRecord>;

  /**
   * Deletes a Team Hub user account and their API tokens via the management API.
   *
   * @param id - User account identifier.
   */
  deleteAdminUser(id: string): Promise<void>;

  /**
   * Lists all API bearer tokens visible to an admin-role token.
   */
  listAdminTokens(): Promise<HubApiTokenRecord[]>;

  /**
   * Creates an additional API bearer token for a user account.
   *
   * @param userId - Owning user account identifier.
   * @param input - Human-readable label for the new token.
   */
  createAdminUserToken(userId: string, input: CreateHubTokenInput): Promise<CreatedHubToken>;

  /**
   * Permanently deletes an API bearer token via the management API.
   *
   * @param id - Token record identifier.
   */
  deleteAdminToken(id: string): Promise<void>;

  /**
   * Enrolls the authenticated user's current device on an E2EE-enabled hub.
   *
   * @param input - Public key material and device metadata to upload.
   */
  enrollDevice(input: EnrollHubDeviceInput): Promise<HubDeviceKeyRecord>;

  /**
   * Lists device key enrollments for the authenticated user.
   */
  listMyDevices(): Promise<HubDeviceKeyRecord[]>;

  /**
   * Revokes one of the authenticated user's enrolled devices.
   *
   * @param id - Device key record identifier.
   */
  revokeMyDevice(id: string): Promise<void>;

  /**
   * Lists all device key enrollments visible to an admin-role token.
   */
  listAdminDeviceKeys(): Promise<HubDeviceKeyRecord[]>;

  /**
   * Lists device key enrollments owned by a specific user account.
   *
   * @param userId - Owning user account identifier.
   */
  listAdminUserDevices(userId: string): Promise<HubDeviceKeyRecord[]>;

  /**
   * Revokes a device key enrollment via the management API.
   *
   * @param id - Device key record identifier.
   */
  revokeAdminDeviceKey(id: string): Promise<void>;

  /**
   * Lists all collections as id/name metadata for admin user management.
   */
  listAdminCollections(): Promise<AdminResourceOption[]>;

  /**
   * Lists all environments as id/name metadata for admin user management.
   */
  listAdminEnvironments(): Promise<AdminResourceOption[]>;

  /**
   * Lists folders in a collection for operator inspection.
   *
   * @param collectionId - Parent collection UUID.
   */
  listAdminCollectionFolders(collectionId: string): Promise<FolderRecord[]>;

  /**
   * Lists saved requests in a collection for operator inspection.
   *
   * @param collectionId - Parent collection UUID.
   */
  listAdminCollectionRequests(collectionId: string): Promise<SavedRequestRecord[]>;

  /**
   * Deletes a collection via the admin management API.
   *
   * @param id - Collection UUID.
   */
  deleteAdminCollection(id: string): Promise<void>;

  /**
   * Deletes an environment via the admin management API.
   *
   * @param id - Environment UUID.
   */
  deleteAdminEnvironment(id: string): Promise<void>;

  /**
   * Deletes a saved request via the admin management API.
   *
   * @param id - Saved request UUID.
   */
  deleteAdminRequest(id: string): Promise<void>;

  /**
   * Updates whether non-admin users may delete a collection.
   *
   * @param id - Collection UUID.
   * @param deletionLocked - When true, user-role tokens cannot delete the collection.
   */
  updateAdminCollectionDeletionLocked(
    id: string,
    deletionLocked: boolean
  ): Promise<AdminEntityConfig>;

  /**
   * Updates whether non-admin users may delete an environment.
   *
   * @param id - Environment UUID.
   * @param deletionLocked - When true, user-role tokens cannot delete the environment.
   */
  updateAdminEnvironmentDeletionLocked(
    id: string,
    deletionLocked: boolean
  ): Promise<AdminEntityConfig>;

  /**
   * Lists all snippets for admin user management.
   */
  listAdminSnippets(): Promise<SnippetRecord[]>;

  /**
   * Creates a snippet through the management API.
   *
   * @param input - Display name, JavaScript source, and scope for the new snippet.
   */
  createAdminSnippet(input: CreateSnippetInput): Promise<SnippetRecord>;

  /**
   * Updates a snippet's name, code, and scope through the management API.
   *
   * @param id - Snippet UUID.
   * @param input - Updated snippet fields.
   */
  updateAdminSnippet(id: string, input: UpdateSnippetInput): Promise<SnippetRecord>;

  /**
   * Deletes a snippet regardless of deletion lock state.
   *
   * @param id - Snippet UUID.
   */
  deleteAdminSnippet(id: string): Promise<void>;

  /**
   * Lists all run results for admin management.
   */
  listAdminRunResults(): Promise<RunResultRecord[]>;

  /**
   * Deletes a run result regardless of creator ownership.
   *
   * @param id - Run result UUID.
   */
  deleteAdminRunResult(id: string): Promise<void>;

  /**
   * Lists all hub-offered LLM models for admin user management.
   */
  listAdminLlmModels(): Promise<ListHubLlmModelsResponse>;

  /**
   * Lists hub-offered LLM models visible to the authenticated token.
   */
  listLlmModels(): Promise<ListHubLlmModelsResponse>;

  /**
   * Runs one hub-proxied LLM completion step.
   */
  completeChatStep(input: HubChatStepRequest): Promise<ChatStepResult>;

  /**
   * Runs one hub-proxied LLM completion step over a canonical SSE stream.
   *
   * @param input - Chat input plus desktop stream correlation fields.
   * @param handlers - Callback invoked for every validated stream event.
   * @param signal - Optional caller cancellation signal.
   */
  completeChatStepStream(
    input: HubChatStepStreamRequest,
    handlers: AiChatStreamHandlers,
    signal?: AbortSignal
  ): Promise<ChatStepResult>;

  /**
   * Returns whether the Team Hub server has LLM support configured.
   *
   * @param managementApi - When true, probes `GET /admin/llm/models`.
   */
  probeLlmServiceEnabled(managementApi: boolean): Promise<boolean>;

  /**
   * Returns whether the Team Hub server exposes snippet storage routes.
   */
  probeSnippetsServiceEnabled(): Promise<boolean>;

  /**
   * Returns whether the Team Hub server exposes discussion routes.
   */
  probeCommunicationServiceEnabled(): Promise<boolean>;

  /**
   * Returns plugin catalog and trusted-publisher URLs configured on this Team Hub.
   */
  getPluginSources(): Promise<PluginSourcesResponse>;

  /**
   * Loads collection, environment, and LLM model options for admin user forms.
   */
  listAdminResourceOptions(): Promise<TeamHubAdminResourceOptions>;

  /**
   * Re-reads server.yaml on the Team Hub and applies reloadable config sections.
   *
   * Requires an admin-role bearer token. Returns a per-section report. A `400`
   * response with `fatalError` is returned as a normal result, not thrown.
   */
  reloadConfig(): Promise<ReloadConfigResponse>;

  /**
   * Lists all collections visible to the authenticated token.
   *
   * Admin tokens receive the full catalog from `GET /collections`; create, update,
   * and delete remain forbidden on the server.
   */
  listCollections(): Promise<CollectionRecord[]>;

  /**
   * Creates a new top-level collection.
   *
   * @param input - Display name for the collection.
   */
  createCollection(input: CreateCollectionInput): Promise<CollectionRecord>;

  /**
   * Updates an existing collection's settings.
   *
   * @param id - Collection UUID.
   * @param input - Updated collection fields.
   */
  updateCollection(id: string, input: UpdateCollectionInput): Promise<CollectionRecord>;

  /**
   * Deletes a collection and all nested folders and requests.
   *
   * @param id - Collection UUID.
   */
  deleteCollection(id: string): Promise<void>;

  /**
   * Lists all environments visible to the authenticated token.
   *
   * Admin tokens receive the full catalog from `GET /environments`; create, update,
   * and delete remain forbidden on the server.
   */
  listEnvironments(): Promise<EnvironmentRecord[]>;

  /**
   * Creates a new top-level environment.
   *
   * @param input - Display name for the environment.
   */
  createEnvironment(input: CreateEnvironmentInput): Promise<EnvironmentRecord>;

  /**
   * Updates an existing environment's name and variables.
   *
   * @param id - Environment UUID.
   * @param input - Updated environment fields.
   */
  updateEnvironment(id: string, input: UpdateEnvironmentInput): Promise<EnvironmentRecord>;

  /**
   * Deletes an environment by id.
   *
   * @param id - Environment UUID.
   */
  deleteEnvironment(id: string): Promise<void>;

  /**
   * Lists all snippets visible to the authenticated token.
   *
   * Admin tokens receive the full catalog from `GET /snippets`; create, update,
   * and delete remain forbidden on the server.
   */
  listSnippets(): Promise<SnippetRecord[]>;

  /**
   * Creates a new top-level snippet.
   *
   * @param input - Display name for the snippet.
   */
  createSnippet(input: CreateSnippetInput): Promise<SnippetRecord>;

  /**
   * Updates an existing snippet's name, code, and scope.
   *
   * @param id - Snippet UUID.
   * @param input - Updated snippet fields.
   */
  updateSnippet(id: string, input: UpdateSnippetInput): Promise<SnippetRecord>;

  /**
   * Deletes a snippet by id.
   *
   * @param id - Snippet UUID.
   */
  deleteSnippet(id: string): Promise<void>;

  /**
   * Lists all live servers visible to the authenticated token.
   */
  listLiveServers(): Promise<LiveServerRecord[]>;

  /**
   * Creates a live server.
   *
   * @param input - Complete mutable live server configuration.
   */
  createLiveServer(input: CreateLiveServerInput): Promise<LiveServerRecord>;

  /**
   * Replaces a live server's mutable configuration.
   *
   * @param id - Live server UUID.
   * @param input - Complete replacement configuration.
   */
  updateLiveServer(id: string, input: UpdateLiveServerInput): Promise<LiveServerRecord>;

  /**
   * Deletes a live server by id.
   *
   * @param id - Live server UUID.
   */
  deleteLiveServer(id: string): Promise<void>;

  /**
   * Lists all live pages visible to the authenticated token.
   */
  listLivePages(): Promise<LivePageRecord[]>;

  /**
   * Creates a live page.
   *
   * @param input - Complete mutable live page configuration.
   */
  createLivePage(input: CreateLivePageInput): Promise<LivePageRecord>;

  /**
   * Replaces a live page's mutable configuration.
   *
   * @param id - Live page UUID.
   * @param input - Complete replacement configuration.
   */
  updateLivePage(id: string, input: UpdateLivePageInput): Promise<LivePageRecord>;

  /**
   * Deletes a live page by id.
   *
   * @param id - Live page UUID.
   */
  deleteLivePage(id: string): Promise<void>;

  /**
   * Lists run results saved by the authenticated user token.
   */
  listRunResults(): Promise<RunResultRecord[]>;

  /**
   * Saves a run result snapshot to the Team Hub.
   *
   * @param input - Optional label and HarborClient export payload.
   */
  createRunResult(input: CreateRunResultInput): Promise<RunResultDetail>;

  /**
   * Loads a run result snapshot by id.
   *
   * @param id - Run result UUID.
   */
  getRunResult(id: string): Promise<RunResultDetail>;

  /**
   * Deletes a run result saved by the authenticated user when permitted.
   *
   * @param id - Run result UUID.
   */
  deleteRunResult(id: string): Promise<void>;

  /**
   * Lists folders in a collection ordered by sort order, then name.
   *
   * @param collectionId - Parent collection UUID.
   */
  listFolders(collectionId: string): Promise<FolderRecord[]>;

  /**
   * Creates a folder in the given collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Display name for the folder.
   */
  createFolder(collectionId: string, input: CreateFolderInput): Promise<FolderRecord>;

  /**
   * Renames a folder by id.
   *
   * @param id - Folder UUID.
   * @param input - Updated folder name.
   */
  renameFolder(id: string, input: RenameFolderInput): Promise<FolderRecord>;

  /**
   * Deletes a folder and all saved requests inside it.
   *
   * @param id - Folder UUID.
   */
  deleteFolder(id: string): Promise<void>;

  /**
   * Moves a folder to another parent or collection root.
   *
   * @param id - Folder UUID.
   * @param input - Destination parent and optional sibling index.
   */
  moveFolder(id: string, input: MoveFolderInput): Promise<FolderRecord>;

  /**
   * Reorders sibling folders within a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Folder ids in the desired order.
   */
  reorderFolders(collectionId: string, input: ReorderFoldersInput): Promise<void>;

  /**
   * Lists saved requests in a collection.
   *
   * @param collectionId - Parent collection UUID.
   */
  listRequests(collectionId: string): Promise<SavedRequestRecord[]>;

  /**
   * Creates a new saved request in a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Saved request fields.
   */
  createRequest(collectionId: string, input: CreateRequestInput): Promise<SavedRequestRecord>;

  /**
   * Updates an existing saved request by id.
   *
   * @param id - Saved request UUID.
   * @param input - Updated request fields including collection id.
   */
  updateRequest(id: string, input: UpdateRequestInput): Promise<SavedRequestRecord>;

  /**
   * Deletes a saved request by id.
   *
   * @param id - Saved request UUID.
   */
  deleteRequest(id: string): Promise<void>;

  /**
   * Reorders saved requests within a folder or the collection root.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Destination folder and ordered request ids.
   */
  reorderRequests(collectionId: string, input: ReorderRequestsInput): Promise<void>;

  /**
   * Moves a saved request to another folder or root index.
   *
   * @param id - Saved request UUID.
   * @param input - Destination folder and target index.
   */
  moveRequest(id: string, input: MoveRequestInput): Promise<void>;

  /**
   * Lists markdown documents in a collection.
   *
   * @param collectionId - Parent collection UUID.
   */
  listDocuments(collectionId: string): Promise<DocumentRecord[]>;

  /**
   * Creates a new markdown document in a collection.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Document fields.
   */
  createDocument(collectionId: string, input: CreateDocumentInput): Promise<DocumentRecord>;

  /**
   * Updates an existing markdown document by id.
   *
   * @param id - Document UUID.
   * @param input - Updated document fields including collection id.
   */
  updateDocument(id: string, input: UpdateDocumentInput): Promise<DocumentRecord>;

  /**
   * Deletes a markdown document by id.
   *
   * @param id - Document UUID.
   */
  deleteDocument(id: string): Promise<void>;

  /**
   * Reorders markdown documents within a folder or the collection root.
   *
   * @param collectionId - Parent collection UUID.
   * @param input - Destination folder and ordered document ids.
   */
  reorderDocuments(collectionId: string, input: ReorderDocumentsInput): Promise<void>;

  /**
   * Moves a markdown document to another folder or root index.
   *
   * @param id - Document UUID.
   * @param input - Destination folder and target index.
   */
  moveDocument(id: string, input: MoveDocumentInput): Promise<void>;

  /**
   * Lists discussion comments for a saved request.
   *
   * @param requestId - Saved request UUID.
   * @param query - Optional pagination cursor and limit.
   */
  listRequestDiscussions(
    requestId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse>;

  /**
   * Creates a discussion comment on a saved request.
   *
   * @param requestId - Saved request UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  createRequestDiscussion(
    requestId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment>;

  /**
   * Lists discussion comments for a collection.
   *
   * @param collectionId - Collection UUID.
   * @param query - Optional pagination cursor and limit.
   */
  listCollectionDiscussions(
    collectionId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse>;

  /**
   * Creates a discussion comment on a collection.
   *
   * @param collectionId - Collection UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  createCollectionDiscussion(
    collectionId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment>;

  /**
   * Lists discussion comments for a folder.
   *
   * @param folderId - Folder UUID.
   * @param query - Optional pagination cursor and limit.
   */
  listFolderDiscussions(
    folderId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse>;

  /**
   * Creates a discussion comment on a folder.
   *
   * @param folderId - Folder UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  createFolderDiscussion(
    folderId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment>;

  /**
   * Lists discussion comments for a saved run result.
   *
   * @param runResultId - Run result UUID.
   * @param query - Optional pagination cursor and limit.
   */
  listRunResultDiscussions(
    runResultId: string,
    query?: ListDiscussionsQuery
  ): Promise<ListDiscussionsResponse>;

  /**
   * Creates a discussion comment on a saved run result.
   *
   * @param runResultId - Run result UUID.
   * @param input - Comment body and optional parent id for replies.
   */
  createRunResultDiscussion(
    runResultId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment>;

  /**
   * Creates a reply to an existing discussion comment.
   *
   * @param commentId - Parent comment UUID.
   * @param input - Reply body text.
   */
  createDiscussionReply(
    commentId: string,
    input: CreateDiscussionCommentInput
  ): Promise<DiscussionComment>;

  /**
   * Updates an existing discussion comment body.
   *
   * @param commentId - Comment UUID.
   * @param input - Replacement body text.
   */
  updateDiscussionComment(
    commentId: string,
    input: UpdateDiscussionCommentInput
  ): Promise<DiscussionComment>;

  /**
   * Tombstones a discussion comment by id.
   *
   * @param commentId - Comment UUID.
   */
  deleteDiscussionComment(commentId: string): Promise<DiscussionComment>;

  /**
   * Lists collaboration notices for the authenticated user.
   *
   * @param query - Optional pagination cursor and limit.
   */
  listNotices(query?: ListNoticesQuery): Promise<ListNoticesResponse>;

  /**
   * Returns the unread notice count for the authenticated user.
   */
  getNoticesUnreadCount(): Promise<NoticesUnreadCountResponse>;

  /**
   * Marks one notice as read for the authenticated user.
   *
   * @param noticeId - Notice record identifier.
   */
  markNoticeRead(noticeId: string): Promise<TeamHubNotice>;

  /**
   * Marks every notice as read for the authenticated user.
   */
  markAllNoticesRead(): Promise<void>;

  /**
   * Opens the authenticated notice SSE stream until aborted or the connection closes.
   *
   * @param handlers - Stream lifecycle callbacks.
   * @param signal - Optional abort signal used to stop reading.
   */
  subscribeNoticeStream(handlers: NoticeStreamHandlers, signal?: AbortSignal): Promise<void>;

  /**
   * Returns notification settings for the authenticated user.
   */
  getNotificationSettings(): Promise<NotificationSettings>;

  /**
   * Updates notification settings for the authenticated user.
   *
   * @param input - Replacement notification delivery preference.
   */
  updateNotificationSettings(input: UpdateNotificationSettingsInput): Promise<NotificationSettings>;

  /**
   * Returns whether the authenticated user is subscribed to a discussion thread.
   *
   * @param threadId - Discussion thread identifier (typically root comment id).
   */
  getDiscussionThreadSubscription(threadId: string): Promise<DiscussionThreadSubscription>;

  /**
   * Subscribes the authenticated user to a discussion thread.
   *
   * @param threadId - Discussion thread identifier (typically root comment id).
   */
  subscribeDiscussionThread(threadId: string): Promise<DiscussionThreadSubscription>;

  /**
   * Unsubscribes the authenticated user from a discussion thread.
   *
   * @param threadId - Discussion thread identifier (typically root comment id).
   */
  unsubscribeDiscussionThread(threadId: string): Promise<DiscussionThreadSubscription>;
}
