import { normalizeAuth, type AuthConfig } from './appTypes.js';

/**
 * Authorization modes persisted by HarborClient Team Hub today.
 */
export type TeamHubAuthType = 'none' | 'basic' | 'bearer';

/**
 * Authorization settings shape returned by Team Hub entity routes.
 *
 * Team Hub does not store OAuth 2 yet; HarborClient normalizes this into a
 * full {@link AuthConfig} when mapping records into local storage.
 */
export interface TeamHubAuthConfig {
  /**
   * Selected auth mode supported by the hub API.
   */
  type: TeamHubAuthType;

  /**
   * Username and password for Basic Auth.
   */
  basic: {
    username: string;
    password: string;
  };

  /**
   * Token value for Bearer Token auth.
   */
  bearer: {
    token: string;
  };
}

/**
 * Converts local auth settings to the shape accepted by Team Hub API routes.
 *
 * OAuth 2 configs are downgraded to `none` because the hub does not persist
 * OAuth fields yet; basic and bearer credential strings are preserved.
 *
 * @param auth - Auth configuration from a collection or saved request.
 * @returns Auth payload safe to send to Team Hub create/update routes.
 */
export function toTeamHubAuth(auth: AuthConfig): TeamHubAuthConfig {
  const normalized = normalizeAuth(auth);
  if (normalized.type === 'oauth2') {
    return {
      type: 'none',
      basic: normalized.basic,
      bearer: normalized.bearer
    };
  }

  return {
    type: normalized.type,
    basic: normalized.basic,
    bearer: normalized.bearer
  };
}
