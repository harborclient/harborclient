import { hasUnsafeHeaderFieldChars } from './httpHeaders';
/**
 * Returns a default auth config with type none and empty credentials.
 *
 * @returns Empty AuthConfig safe for new requests and collections.
 */
export function defaultAuth() {
    return {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' },
        oauth2: defaultOAuth2Config()
    };
}
/**
 * Returns empty OAuth 2.0 Client Credentials fields.
 *
 * @returns Default OAuth2Config for new auth configs.
 */
export function defaultOAuth2Config() {
    return {
        tokenUrl: '',
        clientId: '',
        clientSecret: '',
        scope: '',
        audience: '',
        clientAuth: 'body'
    };
}
/**
 * JSON string of {@link defaultAuth} for database column defaults.
 */
export const DEFAULT_AUTH_JSON = JSON.stringify(defaultAuth());
/**
 * Returns the flat auth shape for the active auth type in a config.
 *
 * @param auth - Normalized auth configuration.
 * @returns Flat object suitable for hc.*.auth.get().
 */
export function flattenAuthConfig(auth) {
    switch (auth.type) {
        case 'basic':
            return {
                type: 'basic',
                username: auth.basic.username,
                password: auth.basic.password
            };
        case 'bearer':
            return {
                type: 'bearer',
                token: auth.bearer.token
            };
        case 'oauth2':
            return {
                type: 'oauth2',
                tokenUrl: auth.oauth2.tokenUrl,
                clientId: auth.oauth2.clientId,
                clientSecret: auth.oauth2.clientSecret,
                scope: auth.oauth2.scope,
                audience: auth.oauth2.audience,
                clientAuth: auth.oauth2.clientAuth
            };
        default:
            return { type: 'none' };
    }
}
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
export function applyScriptAuthSet(current, input) {
    if (input == null || typeof input !== 'object') {
        throw new Error('auth.set requires an auth object');
    }
    const record = input;
    const next = normalizeAuth(current);
    if (record.type !== undefined) {
        const type = String(record.type);
        if (type !== 'none' && type !== 'basic' && type !== 'bearer' && type !== 'oauth2') {
            throw new Error(`Invalid auth type: ${type}`);
        }
        next.type = type;
    }
    if (record.token !== undefined) {
        next.bearer.token = String(record.token);
    }
    if (record.username !== undefined) {
        next.basic.username = String(record.username);
    }
    if (record.password !== undefined) {
        next.basic.password = String(record.password);
    }
    if (record.tokenUrl !== undefined) {
        next.oauth2.tokenUrl = String(record.tokenUrl);
    }
    if (record.clientId !== undefined) {
        next.oauth2.clientId = String(record.clientId);
    }
    if (record.clientSecret !== undefined) {
        next.oauth2.clientSecret = String(record.clientSecret);
    }
    if (record.scope !== undefined) {
        next.oauth2.scope = String(record.scope);
    }
    if (record.audience !== undefined) {
        next.oauth2.audience = String(record.audience);
    }
    if (record.clientAuth !== undefined) {
        const clientAuth = String(record.clientAuth);
        if (clientAuth !== 'body' && clientAuth !== 'header') {
            throw new Error(`Invalid oauth2 clientAuth: ${clientAuth}`);
        }
        next.oauth2.clientAuth = clientAuth;
    }
    return next;
}
/**
 * Updates a single flat auth field on an existing auth config.
 *
 * @param current - Current normalized auth configuration.
 * @param field - Flat field name from hc.*.auth.update().
 * @param value - New value for the field.
 * @returns Updated auth config.
 */
export function applyScriptAuthUpdate(current, field, value) {
    const key = String(field);
    const validFields = [
        'type',
        'token',
        'username',
        'password',
        'tokenUrl',
        'clientId',
        'clientSecret',
        'scope',
        'audience',
        'clientAuth'
    ];
    if (!validFields.includes(key)) {
        throw new Error(`Invalid auth field: ${key}`);
    }
    return applyScriptAuthSet(current, { [key]: value });
}
/**
 * Builds a stable cache key for OAuth token storage.
 *
 * @param scope - Whether the auth config belongs to a saved request or collection.
 * @param id - Saved entity id.
 * @returns Cache key used by the main-process token store.
 */
export function buildOAuthCacheKey(scope, id) {
    return `${scope}:${id}`;
}
/**
 * Normalizes a partial or legacy auth value from storage into a full AuthConfig.
 *
 * @param value - Parsed JSON or unknown field from the database.
 * @returns Valid AuthConfig with defaults for missing fields.
 */
export function normalizeAuth(value) {
    const fallback = defaultAuth();
    if (value == null || typeof value !== 'object') {
        return fallback;
    }
    const record = value;
    const type = record.type === 'basic' ||
        record.type === 'bearer' ||
        record.type === 'oauth2' ||
        record.type === 'none'
        ? record.type
        : fallback.type;
    const basicRecord = record.basic != null && typeof record.basic === 'object'
        ? record.basic
        : {};
    const bearerRecord = record.bearer != null && typeof record.bearer === 'object'
        ? record.bearer
        : {};
    const oauth2Record = record.oauth2 != null && typeof record.oauth2 === 'object'
        ? record.oauth2
        : {};
    return {
        type,
        basic: {
            username: typeof basicRecord.username === 'string' ? basicRecord.username : '',
            password: typeof basicRecord.password === 'string' ? basicRecord.password : ''
        },
        bearer: {
            token: typeof bearerRecord.token === 'string' ? bearerRecord.token : ''
        },
        oauth2: {
            tokenUrl: typeof oauth2Record.tokenUrl === 'string' ? oauth2Record.tokenUrl : '',
            clientId: typeof oauth2Record.clientId === 'string' ? oauth2Record.clientId : '',
            clientSecret: typeof oauth2Record.clientSecret === 'string' ? oauth2Record.clientSecret : '',
            scope: typeof oauth2Record.scope === 'string' ? oauth2Record.scope : '',
            audience: typeof oauth2Record.audience === 'string' ? oauth2Record.audience : '',
            clientAuth: oauth2Record.clientAuth === 'header' ? 'header' : 'body'
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
export function encodeBasicAuth(username, password) {
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
 * type is none or required fields are empty after trimming. OAuth 2.0 tokens
 * are fetched separately in the main process and are not handled here.
 *
 * @param auth - Auth configuration from the request or collection.
 * @returns Header value such as `Basic …` or `Bearer …`, or null when auth is inactive.
 */
export function buildAuthHeaderValue(auth) {
    if (auth.type === 'none' || auth.type === 'oauth2') {
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
 * Builds an Authorization header value from a fetched OAuth access token.
 *
 * @param result - Token fetch result from the main process.
 * @returns Header value such as `Bearer …`, or null when the token is unsafe or empty.
 */
export function buildOAuthAuthHeaderValue(result) {
    const token = result.accessToken.trim();
    if (!token || hasUnsafeHeaderFieldChars(token)) {
        return null;
    }
    const tokenType = result.tokenType.trim() || 'Bearer';
    return `${tokenType} ${token}`;
}
/**
 * Resolves {{variable}} placeholders in auth credential fields using a lookup map.
 *
 * @param auth - Auth config with raw editor values.
 * @param substitute - Function that resolves placeholders in a string.
 * @returns Auth config with substituted credential fields.
 */
export function resolveAuthVariables(auth, substitute) {
    return {
        ...auth,
        basic: {
            username: substitute(auth.basic.username),
            password: substitute(auth.basic.password)
        },
        bearer: {
            token: substitute(auth.bearer.token)
        },
        oauth2: {
            tokenUrl: substitute(auth.oauth2.tokenUrl),
            clientId: substitute(auth.oauth2.clientId),
            clientSecret: substitute(auth.oauth2.clientSecret),
            scope: substitute(auth.oauth2.scope),
            audience: substitute(auth.oauth2.audience),
            clientAuth: auth.oauth2.clientAuth
        }
    };
}
//# sourceMappingURL=auth.js.map