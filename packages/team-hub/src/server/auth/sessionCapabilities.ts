import type { AvatarColorKey } from '#/avatar/avatarPresentation.js';
import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import type { ApiTokenRecord, UserRecord } from '#/db/types.js';
import type { HubAvatarMetadata } from '#/avatar/hubAvatarService.js';
import { resolveUserAvatarFromRecord } from '#/avatar/userAvatarService.js';
import { canUseDataApi, canUseLlm, isAdmin } from '#/server/auth/accessControl.js';

/**
 * Capability flags derived from the authenticated user account.
 */
export interface SessionCapabilities {
  /**
   * When true, the token may call entity data routes (collections, environments, etc.).
   */
  dataApi: boolean;

  /**
   * When true, the token may call management routes (user and token administration).
   */
  managementApi: boolean;

  /**
   * When true, the token may call hub-proxied LLM routes.
   */
  llm: boolean;

  /**
   * When true, the token may call discussion and collaboration routes.
   */
  communication: boolean;

  /**
   * When true, this Team Hub requires encrypted discussion comment bodies.
   */
  discussionE2ee: boolean;
}

/**
 * JSON payload returned by `GET /auth/session`.
 */
export interface SessionPayload {
  /**
   * User account owning the authenticated bearer token.
   */
  user: {
    /**
     * Stable user account identifier.
     */
    id: string;

    /**
     * Unique display name for the account.
     */
    name: string;

    /**
     * Account role determining API capabilities.
     */
    role: UserRecord['role'];

    /**
     * Persisted avatar initials tile text.
     */
    avatarInitials: string;

    /**
     * Persisted avatar background color key.
     */
    avatarColor: AvatarColorKey;

    /**
     * Relative URL for the uploaded avatar image when present.
     */
    avatarImageUrl?: string;
  };

  /**
   * Metadata for the API token used to authenticate the request.
   */
  token: {
    /**
     * Stable token record identifier.
     */
    id: string;

    /**
     * Non-secret prefix shown in operator listings (for example `hbk_AbCd1234`).
     */
    prefix: string;
  };

  /**
   * Derived capability flags for clients such as HarborClient.
   */
  capabilities: SessionCapabilities;

  /**
   * Effective tenant id for this authenticated session.
   */
  tenantId: string;

  /**
   * Hub avatar presentation for the active tenant namespace.
   */
  hub: HubAvatarMetadata;
}

/**
 * Builds the session payload for the authenticated user and API token.
 *
 * @param user - User account resolved from the bearer token.
 * @param apiToken - Active API token record used for authentication.
 * @param tenantId - Effective tenant id for the authenticated request.
 * @param hub - Hub avatar metadata for the active tenant namespace.
 * @param collaboration - Active collaboration settings for the hub.
 * @returns Session payload suitable for JSON serialization.
 */
export function buildSessionPayload(
  user: UserRecord,
  apiToken: ApiTokenRecord,
  tenantId: string,
  hub: HubAvatarMetadata,
  collaboration: CollaborationConfig
): SessionPayload {
  const avatar = resolveUserAvatarFromRecord(user);
  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      avatarInitials: avatar.initials,
      avatarColor: avatar.color,
      ...(avatar.imageUrl ? { avatarImageUrl: avatar.imageUrl } : {})
    },
    token: {
      id: apiToken.id,
      prefix: apiToken.tokenPrefix
    },
    capabilities: {
      dataApi: canUseDataApi(user),
      managementApi: isAdmin(user),
      llm: canUseLlm(user),
      communication: canUseDataApi(user),
      discussionE2ee: collaboration.e2ee
    },
    tenantId,
    hub
  };
}
