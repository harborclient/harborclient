import { hasUnsafeHeaderFieldChars } from '#/shared/httpHeaders';

/**
 * Authorization type for the Auth tab; none inherits collection auth at send time.
 */
export type AuthType = 'none' | 'basic' | 'bearer';

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
}

/**
 * Returns a default auth config with type none and empty credentials.
 *
 * @returns Empty AuthConfig safe for new requests and collections.
 */
export function defaultAuth(): AuthConfig {
  return {
    type: 'none',
    basic: { username: '', password: '' },
    bearer: { token: '' }
  };
}

/**
 * JSON string of {@link defaultAuth} for database column defaults.
 */
export const DEFAULT_AUTH_JSON = JSON.stringify(defaultAuth());

/**
 * Normalizes a partial or legacy auth value from storage into a full AuthConfig.
 *
 * @param value - Parsed JSON or unknown field from the database.
 * @returns Valid AuthConfig with defaults for missing fields.
 */
export function normalizeAuth(value: unknown): AuthConfig {
  const fallback = defaultAuth();
  if (value == null || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const type =
    record.type === 'basic' || record.type === 'bearer' || record.type === 'none'
      ? record.type
      : fallback.type;

  const basicRecord =
    record.basic != null && typeof record.basic === 'object'
      ? (record.basic as Record<string, unknown>)
      : {};
  const bearerRecord =
    record.bearer != null && typeof record.bearer === 'object'
      ? (record.bearer as Record<string, unknown>)
      : {};

  return {
    type,
    basic: {
      username: typeof basicRecord.username === 'string' ? basicRecord.username : '',
      password: typeof basicRecord.password === 'string' ? basicRecord.password : ''
    },
    bearer: {
      token: typeof bearerRecord.token === 'string' ? bearerRecord.token : ''
    }
  };
}

/**
 * Encodes username and password as a UTF-8-safe Basic Auth credential string.
 *
 * @param username - Basic Auth username (already variable-resolved at send time).
 * @param password - Basic Auth password (already variable-resolved at send time).
 * @returns Base64-encoded `username:password` suitable for the Authorization header.
 */
export function encodeBasicAuth(username: string, password: string): string {
  const credential = `${username}:${password}`;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(credential, 'utf-8').toString('base64');
  }

  const bytes = new TextEncoder().encode(credential);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

/**
 * Builds the Authorization header value from an auth config.
 *
 * Assumes credential strings are already variable-resolved. Returns null when
 * type is none or required fields are empty after trimming.
 *
 * @param auth - Auth configuration from the request or collection.
 * @returns Header value such as `Basic …` or `Bearer …`, or null when auth is inactive.
 */
export function buildAuthHeaderValue(auth: AuthConfig): string | null {
  if (auth.type === 'none') {
    return null;
  }

  if (auth.type === 'basic') {
    const username = auth.basic.username.trim();
    const password = auth.basic.password;
    if (!username && !password.trim()) {
      return null;
    }
    return `Basic ${encodeBasicAuth(username, password)}`;
  }

  const token = auth.bearer.token.trim();
  if (!token || hasUnsafeHeaderFieldChars(token)) {
    return null;
  }
  return `Bearer ${token}`;
}

/**
 * Resolves {{variable}} placeholders in auth credential fields using a lookup map.
 *
 * @param auth - Auth config with raw editor values.
 * @param substitute - Function that resolves placeholders in a string.
 * @returns Auth config with substituted credential fields.
 */
export function resolveAuthVariables(
  auth: AuthConfig,
  substitute: (text: string) => string
): AuthConfig {
  return {
    ...auth,
    basic: {
      username: substitute(auth.basic.username),
      password: substitute(auth.basic.password)
    },
    bearer: {
      token: substitute(auth.bearer.token)
    }
  };
}
