import type { ProxySettings } from './types.js';

/**
 * Absolute ceiling for the configurable max response size setting (MB).
 */
export const HARD_MAX_RESPONSE_SIZE_MB = 512;

/**
 * Default proxy settings used when request settings are not supplied.
 */
export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: 8080,
  authEnabled: false,
  username: '',
  password: ''
};

/**
 * HTTP execution settings consumed by {@link Requester}.
 *
 * A subset of the main app's GeneralSettings — excludes editor, theme, and
 * global variable fields so the package stays self-contained.
 */
export interface RequestSettings {
  /**
   * Request timeout in milliseconds; 0 disables the timeout.
   */
  requestTimeoutMs: number;

  /**
   * Maximum response body size in megabytes; 0 disables the configurable limit.
   */
  maxResponseSizeMb: number;

  /**
   * When true, TLS certificates are verified for HTTPS requests.
   */
  verifySsl: boolean;

  /**
   * When true, 3xx responses are followed automatically.
   */
  followRedirects: boolean;

  /**
   * Global HTTP proxy applied to every outbound request.
   */
  proxy: ProxySettings;
}

/**
 * Default request settings matching the main app's general settings defaults.
 */
export const DEFAULT_REQUEST_SETTINGS: RequestSettings = {
  requestTimeoutMs: 30000,
  maxResponseSizeMb: 50,
  verifySsl: true,
  followRedirects: true,
  proxy: { ...DEFAULT_PROXY_SETTINGS }
};
