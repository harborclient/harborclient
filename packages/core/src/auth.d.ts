/**
 * Authorization type for the Auth tab; none inherits collection auth at send time.
 */
export type AuthType = 'none' | 'basic' | 'bearer' | 'oauth2';
/**
 * How OAuth client credentials are sent to the token endpoint.
 */
export type OAuth2ClientAuth = 'body' | 'header';
/**
 * OAuth 2.0 Client Credentials configuration stored on requests and collections.
 */
export interface OAuth2Config {
  /**
   * Token endpoint URL.
   */
  tokenUrl: string;
  /**
   * OAuth client id.
   */
  clientId: string;
  /**
   * OAuth client secret.
   */
  clientSecret: string;
  /**
   * Space-delimited OAuth scopes.
   */
  scope: string;
  /**
   * Optional audience claim for token requests.
   */
  audience: string;
  /**
   * Whether client credentials are sent in the POST body or as HTTP Basic auth.
   */
  clientAuth: OAuth2ClientAuth;
}
/**
 * Basic and bearer credential fields stored together so switching type preserves values.
 */
export interface AuthConfig {
  /**
   * Selected auth mode; none means no request-level override.
   */
  type: AuthType;
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
  /**
   * OAuth 2.0 Client Credentials settings.
   */
  oauth2: OAuth2Config;
}
/**
 * Result of fetching or refreshing an OAuth 2.0 access token.
 */
export interface OAuthFetchTokenResult {
  /**
   * Access token returned by the authorization server.
   */
  accessToken: string;
  /**
   * ISO 8601 expiry timestamp when known.
   */
  expiresAt?: string;
  /**
   * Token type from the token response, typically Bearer.
   */
  tokenType: string;
}
/**
 * Returns a default auth config with type none and empty credentials.
 *
 * @returns Empty AuthConfig safe for new requests and collections.
 */
export declare function defaultAuth(): AuthConfig;
/**
 * Returns empty OAuth 2.0 Client Credentials fields.
 *
 * @returns Default OAuth2Config for new auth configs.
 */
export declare function defaultOAuth2Config(): OAuth2Config;
/**
 * JSON string of {@link defaultAuth} for database column defaults.
 */
export declare const DEFAULT_AUTH_JSON: string;
/**
 * Flat auth shape exposed by hc.request.auth and hc.collection.auth in scripts.
 */
export type ScriptAuthInput = {
  type?: AuthType;
  token?: string;
  username?: string;
  password?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
  clientAuth?: OAuth2ClientAuth;
};
/**
 * Flat field names accepted by hc.*.auth.update().
 */
export type ScriptAuthField = keyof ScriptAuthInput;
/**
 * Returns the flat auth shape for the active auth type in a config.
 *
 * @param auth - Normalized auth configuration.
 * @returns Flat object suitable for hc.*.auth.get().
 */
export declare function flattenAuthConfig(auth: AuthConfig): ScriptAuthInput;
/**
 * Merges a flat script auth input onto an existing auth config.
 *
 * Preserves credential values in inactive sub-objects so switching type
 * matches the Auth tab behavior.
 *
 * @param current - Current normalized auth configuration.
 * @param input - Flat partial auth from hc.*.auth.set().
 * @returns Updated auth config.
 */
export declare function applyScriptAuthSet(current: AuthConfig, input: unknown): AuthConfig;
/**
 * Updates a single flat auth field on an existing auth config.
 *
 * @param current - Current normalized auth configuration.
 * @param field - Flat field name from hc.*.auth.update().
 * @param value - New value for the field.
 * @returns Updated auth config.
 */
export declare function applyScriptAuthUpdate(
  current: AuthConfig,
  field: unknown,
  value: unknown
): AuthConfig;
/**
 * Builds a stable cache key for OAuth token storage.
 *
 * @param scope - Whether the auth config belongs to a saved request or collection.
 * @param id - Saved entity id.
 * @returns Cache key used by the main-process token store.
 */
export declare function buildOAuthCacheKey(
  scope: 'request' | 'collection' | 'folder',
  id: number
): string;
/**
 * Normalizes a partial or legacy auth value from storage into a full AuthConfig.
 *
 * @param value - Parsed JSON or unknown field from the database.
 * @returns Valid AuthConfig with defaults for missing fields.
 */
export declare function normalizeAuth(value: unknown): AuthConfig;
/**
 * Encodes username and password as a UTF-8-safe Basic Auth credential string.
 *
 * @param username - Basic Auth username (already variable-resolved at send time).
 * @param password - Basic Auth password (already variable-resolved at send time).
 * @returns Base64-encoded `username:password` suitable for the Authorization header.
 */
export declare function encodeBasicAuth(username: string, password: string): string;
/**
 * Builds the Authorization header value from an auth config.
 *
 * Assumes credential strings are already variable-resolved. Returns null when
 * type is none or required fields are empty after trimming. OAuth 2.0 tokens
 * are fetched separately in the main process and are not handled here.
 *
 * @param auth - Auth configuration from the request or collection.
 * @returns Header value such as `Basic …` or `Bearer …`, or null when auth is inactive.
 */
export declare function buildAuthHeaderValue(auth: AuthConfig): string | null;
/**
 * Builds an Authorization header value from a fetched OAuth access token.
 *
 * @param result - Token fetch result from the main process.
 * @returns Header value such as `Bearer …`, or null when the token is unsafe or empty.
 */
export declare function buildOAuthAuthHeaderValue(result: OAuthFetchTokenResult): string | null;
/**
 * Resolves {{variable}} placeholders in auth credential fields using a lookup map.
 *
 * @param auth - Auth config with raw editor values.
 * @param substitute - Function that resolves placeholders in a string.
 * @returns Auth config with substituted credential fields.
 */
export declare function resolveAuthVariables(
  auth: AuthConfig,
  substitute: (text: string) => string
): AuthConfig;
//# sourceMappingURL=auth.d.ts.map
