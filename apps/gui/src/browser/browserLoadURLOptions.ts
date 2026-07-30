import { buildAuthHeaderValue, type AuthConfig } from '@harborclient/core/auth';
import type { KeyValue } from '@harborclient/core/types';

/**
 * Options passed to Electron `webContents.loadURL` for chrome-driven navigations.
 */
export interface BrowserLoadURLOptions {
  /**
   * CRLF-joined extra request headers, when any headers or auth should be sent.
   */
  extraHeaders?: string;

  /**
   * User-Agent override; omitted when empty so Chromium uses its default.
   */
  userAgent?: string;
}

/**
 * Returns whether any enabled header row is a non-empty Authorization field.
 *
 * @param headers - Header rows to inspect.
 * @returns True when a manual Authorization header is present.
 */
function hasManualAuthorization(headers: KeyValue[]): boolean {
  return headers.some(
    (row) =>
      row.enabled && row.key.trim().toLowerCase() === 'authorization' && row.value.trim() !== ''
  );
}

/**
 * Builds Electron `loadURL` options from live-page headers, auth, and User-Agent.
 *
 * Enabled header rows become `extraHeaders`. When auth is Basic/Bearer and no
 * manual Authorization header exists, an Authorization header is appended.
 * Empty User-Agent is omitted so Chromium keeps its default.
 *
 * @param headers - Website/browser header rows.
 * @param auth - Authorization config (Basic/Bearer applied; OAuth2 ignored).
 * @param userAgent - Optional User-Agent override.
 * @returns Options object suitable for `webContents.loadURL(url, options)`.
 */
export function buildBrowserLoadURLOptions(
  headers: KeyValue[],
  auth: AuthConfig,
  userAgent: string
): BrowserLoadURLOptions {
  const lines: string[] = [];
  for (const row of headers) {
    if (!row.enabled) {
      continue;
    }
    const key = row.key.trim();
    if (!key) {
      continue;
    }
    lines.push(`${key}: ${row.value}`);
  }

  const authValue = buildAuthHeaderValue(auth);
  if (authValue && !hasManualAuthorization(headers)) {
    lines.push(`Authorization: ${authValue}`);
  }

  const trimmedUa = userAgent.trim();
  return {
    ...(lines.length > 0 ? { extraHeaders: `${lines.join('\n')}\n` } : {}),
    ...(trimmedUa ? { userAgent: trimmedUa } : {})
  };
}
