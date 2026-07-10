import type {
  AdminEntityConfig,
  CreateHubTokenInput,
  CreateHubUserInput,
  CreateInvitedHubUserInput,
  CreateUserInvitationInput,
  CreatedHubToken,
  CreatedHubUser,
  CreatedInvitedHubUser,
  HubApiTokenRecord,
  HubInvitationPreview,
  HubInvitationRecord,
  HubUserRecord,
  ReloadConfigResponse,
  TeamHub,
  TeamHubAdminCollectionContents,
  TeamHubAdminResourceOptions,
  TeamHubAdminSnippet,
  TeamHubAdminSnippetInput,
  TeamHubAdminRunResult,
  TeamHubInvitationRedeemResult,
  TeamHubSessionScanResult,
  TeamHubVerifiedSession,
  UpdateHubUserInput
} from '#/shared/types/teamHub';

/**
 * IPC methods for teamHub.
 */
export interface ApiTeamHub {
  /**
   * Lists all configured team hubs.
   */
  listTeamHubs: () => Promise<TeamHub[]>;
  /**
   * Creates or updates a team hub.
   *
   * @param hub - Team hub to persist.
   * @returns Updated list of all team hubs.
   */
  saveTeamHub: (hub: TeamHub) => Promise<TeamHub[]>;
  /**
   * Deletes a team hub by id.
   *
   * @param id - Team hub id to remove.
   * @returns Updated list of all team hubs.
   */
  deleteTeamHub: (id: string) => Promise<TeamHub[]>;
  /**
   * Probes each configured team hub for session capabilities via `GET /auth/session`.
   */
  scanTeamHubSessions: () => Promise<TeamHubSessionScanResult[]>;
  /**
   * Lists Team Hub user accounts using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubUsers: (hubId: string) => Promise<HubUserRecord[]>;
  /**
   * Updates a Team Hub user account using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param userId - User account identifier to update.
   * @param input - Partial user fields to apply.
   */
  updateTeamHubUser: (
    hubId: string,
    userId: string,
    input: UpdateHubUserInput
  ) => Promise<HubUserRecord>;
  /**
   * Deletes a Team Hub user account using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param userId - User account identifier to delete.
   */
  deleteTeamHubUser: (hubId: string, userId: string) => Promise<void>;
  /**
   * Creates a Team Hub user account and initial token using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param input - User fields for the new account.
   */
  createTeamHubUser: (hubId: string, input: CreateHubUserInput) => Promise<CreatedHubUser>;
  /**
   * Creates a Team Hub user account and onboarding invitation using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param input - User fields and optional invitation expiry.
   */
  createTeamHubInvitedUser: (
    hubId: string,
    input: CreateInvitedHubUserInput
  ) => Promise<CreatedInvitedHubUser>;
  /**
   * Issues a replacement onboarding invitation for an existing user account.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param userId - User account identifier.
   * @param input - Optional invitation expiry override.
   */
  createTeamHubUserInvitation: (
    hubId: string,
    userId: string,
    input?: CreateUserInvitationInput
  ) => Promise<CreatedInvitedHubUser>;
  /**
   * Lists onboarding invitations for operator review and recovery.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubInvitations: (hubId: string) => Promise<HubInvitationRecord[]>;
  /**
   * Revokes a pending onboarding invitation.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param invitationId - Invitation record identifier.
   */
  revokeTeamHubInvitation: (hubId: string, invitationId: string) => Promise<void>;
  /**
   * Returns invited user details for confirmation without consuming the invitation.
   *
   * @param baseUrl - Team Hub server base URL.
   * @param code - Invitation secret prefixed with `hbi_`.
   */
  previewTeamHubInvitation: (baseUrl: string, code: string) => Promise<HubInvitationPreview>;
  /**
   * Redeems an invitation, verifies the issued bearer token, and returns both results.
   *
   * @param baseUrl - Team Hub server base URL.
   * @param code - Invitation secret prefixed with `hbi_`.
   * @param tokenName - Optional label for the issued API token.
   */
  redeemTeamHubInvitation: (
    baseUrl: string,
    code: string,
    tokenName?: string
  ) => Promise<TeamHubInvitationRedeemResult>;
  /**
   * Verifies a bearer token against `GET /auth/session` without persisting it.
   *
   * @param baseUrl - Team Hub server base URL.
   * @param token - Bearer token prefixed with `hbk_`.
   */
  verifyTeamHubSession: (baseUrl: string, token: string) => Promise<TeamHubVerifiedSession>;
  /**
   * Lists Team Hub API tokens using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubTokens: (hubId: string) => Promise<HubApiTokenRecord[]>;
  /**
   * Creates a Team Hub API token for a user using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param userId - Owning user account identifier.
   * @param input - Human-readable label for the new token.
   */
  createTeamHubUserToken: (
    hubId: string,
    userId: string,
    input: CreateHubTokenInput
  ) => Promise<CreatedHubToken>;
  /**
   * Deletes a Team Hub API token using an admin token on the given hub connection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param tokenId - Token record identifier to delete.
   */
  deleteTeamHubToken: (hubId: string, tokenId: string) => Promise<void>;
  /**
   * Loads collection, environment, and LLM model options for admin user management.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubAdminResourceOptions: (hubId: string) => Promise<TeamHubAdminResourceOptions>;
  /**
   * Loads folders and saved requests in a hub collection for admin inspection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param collectionId - Server collection UUID.
   */
  listTeamHubAdminCollectionContents: (
    hubId: string,
    collectionId: string
  ) => Promise<TeamHubAdminCollectionContents>;
  /**
   * Deletes a hub collection using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param collectionId - Server collection UUID.
   */
  deleteTeamHubCollection: (hubId: string, collectionId: string) => Promise<void>;
  /**
   * Lists hub snippets using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubAdminSnippets: (hubId: string) => Promise<TeamHubAdminSnippet[]>;
  /**
   * Creates a hub snippet using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param input - Snippet name, code, and scope.
   */
  createTeamHubAdminSnippet: (
    hubId: string,
    input: TeamHubAdminSnippetInput
  ) => Promise<TeamHubAdminSnippet>;
  /**
   * Updates a hub snippet using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param snippetId - Server snippet UUID.
   * @param input - Updated snippet name, code, and scope.
   */
  updateTeamHubAdminSnippet: (
    hubId: string,
    snippetId: string,
    input: TeamHubAdminSnippetInput
  ) => Promise<TeamHubAdminSnippet>;
  /**
   * Deletes a hub snippet using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param snippetId - Server snippet UUID.
   */
  deleteTeamHubAdminSnippet: (hubId: string, snippetId: string) => Promise<void>;
  /**
   * Lists hub run results using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  listTeamHubAdminRunResults: (hubId: string) => Promise<TeamHubAdminRunResult[]>;
  /**
   * Deletes a hub run result using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param runResultId - Server run result UUID.
   */
  deleteTeamHubRunResult: (hubId: string, runResultId: string) => Promise<void>;
  /**
   * Deletes a saved request on a hub collection using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param requestId - Server saved request UUID.
   */
  deleteTeamHubRequest: (hubId: string, requestId: string) => Promise<void>;
  /**
   * Deletes a hub environment using an admin token.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param environmentId - Server environment UUID.
   */
  deleteTeamHubEnvironment: (hubId: string, environmentId: string) => Promise<void>;
  /**
   * Updates whether non-admin users may delete a hub collection.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param collectionId - Server collection UUID.
   * @param deletionLocked - When true, user-role tokens cannot delete the collection.
   */
  updateTeamHubCollectionDeletionLocked: (
    hubId: string,
    collectionId: string,
    deletionLocked: boolean
  ) => Promise<AdminEntityConfig>;
  /**
   * Updates whether non-admin users may delete a hub environment.
   *
   * @param hubId - Team hub connection id with an admin token.
   * @param environmentId - Server environment UUID.
   * @param deletionLocked - When true, user-role tokens cannot delete the environment.
   */
  updateTeamHubEnvironmentDeletionLocked: (
    hubId: string,
    environmentId: string,
    deletionLocked: boolean
  ) => Promise<AdminEntityConfig>;
  /**
   * Re-reads reloadable config sections from the Team Hub server.
   *
   * @param hubId - Team hub connection id with an admin token.
   */
  reloadTeamHubConfig: (hubId: string) => Promise<ReloadConfigResponse>;
}
