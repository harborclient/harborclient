import type { KeyValue } from './types';

/**
 * Legacy hardcoded HarborClient User-Agent used before first-run dynamic capture.
 *
 * Detected once at app startup so existing installs migrate to a machine-specific string.
 */
export const LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT =
  'HarborClient/1.0.0 (Windows NT 10.0; Win64; x64) Electron/39.0.0 Chrome/140.0.0.0';

/**
 * Generic fallback User-Agent when no persisted machine-specific value exists
 * (for example CLI-only usage before the desktop app has run).
 */
export const DEFAULT_USER_AGENT = 'HarborClient/0.0.0 (Unknown) Electron/0.0.0 Chrome/0.0.0';

/**
 * Built-in browser User-Agent presets shown in every User-Agent control.
 *
 * The HarborClient string is not a builtin; it is captured from the host on first
 * run and stored in general settings `customUserAgents`.
 */
export const BUILTIN_USER_AGENT_PRESETS: readonly string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',
  'Mozilla/5.0 (Linux; Android 16; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
];

/**
 * Runtime inputs used to build a machine-specific HarborClient User-Agent.
 */
export interface HarborClientUserAgentRuntime {
  /**
   * Desktop app version from Electron `app.getVersion()`.
   */
  appVersion: string;

  /**
   * Node process platform (`win32`, `darwin`, `linux`, …).
   */
  platform: NodeJS.Platform;

  /**
   * CPU architecture (`x64`, `arm64`, …).
   */
  arch: string;

  /**
   * Kernel release from `os.release()` (used for Windows NT version).
   */
  osRelease: string;

  /**
   * Electron version string.
   */
  electronVersion: string;

  /**
   * Chromium version string bundled with Electron.
   */
  chromeVersion: string;

  /**
   * Optional macOS product version from `process.getSystemVersion()`.
   */
  systemVersion?: string;
}

/**
 * Builds the Chromium-style OS token for the HarborClient User-Agent parenthetical.
 *
 * @param runtime - Host platform, arch, and OS version fields.
 * @returns Parenthetical OS segment without surrounding parentheses.
 */
function buildHarborClientOsToken(runtime: HarborClientUserAgentRuntime): string {
  const arch = runtime.arch.trim() || 'unknown';
  if (runtime.platform === 'win32') {
    const nt = runtime.osRelease.trim() || '10.0';
    if (arch === 'arm64') {
      return `Windows NT ${nt}; ARM64`;
    }
    if (arch === 'ia32') {
      return `Windows NT ${nt}; Win32`;
    }
    return `Windows NT ${nt}; Win64; x64`;
  }
  if (runtime.platform === 'darwin') {
    const raw = (runtime.systemVersion?.trim() || runtime.osRelease.trim() || '10_15_7').replace(
      /\./g,
      '_'
    );
    const cpu = arch === 'arm64' ? 'ARM' : 'Intel';
    return `Macintosh; ${cpu} Mac OS X ${raw}`;
  }
  if (runtime.platform === 'linux') {
    const linuxArch = arch === 'arm64' ? 'aarch64' : arch === 'x64' ? 'x86_64' : arch;
    return `X11; Linux ${linuxArch}`;
  }
  return `${runtime.platform}; ${arch}`;
}

/**
 * Builds a HarborClient User-Agent from explicit runtime version and OS fields.
 *
 * @param runtime - App, Electron, Chrome, and OS identity for this machine.
 * @returns Fully formed HarborClient User-Agent string.
 */
export function buildHarborClientUserAgent(runtime: HarborClientUserAgentRuntime): string {
  const appVersion = runtime.appVersion.trim() || '0.0.0';
  const electronVersion = runtime.electronVersion.trim() || '0.0.0';
  const chromeVersion = runtime.chromeVersion.trim() || '0.0.0';
  const osToken = buildHarborClientOsToken(runtime);
  return `HarborClient/${appVersion} (${osToken}) Electron/${electronVersion} Chrome/${chromeVersion}`;
}

/**
 * Normalizes a scoped or global User-Agent string.
 *
 * @param value - Raw User-Agent from storage or UI.
 * @returns Trimmed value, or empty string when missing/invalid.
 */
export function normalizeUserAgent(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalizes user-added User-Agent presets, dropping builtins and duplicates.
 *
 * @param input - Raw custom User-Agent list from storage or UI.
 * @returns Unique trimmed custom values not already in the built-in list.
 */
export function normalizeCustomUserAgents(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const builtin = new Set(BUILTIN_USER_AGENT_PRESETS.map((entry) => entry.toLowerCase()));
  const seen = new Set<string>();
  const customs: string[] = [];
  for (const entry of input) {
    if (typeof entry !== 'string') {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (builtin.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    customs.push(trimmed);
  }
  return customs;
}

/**
 * Merges built-in presets with user-added customs for autocomplete/select lists.
 *
 * @param customUserAgents - User-added values from general settings.
 * @returns Built-ins first, then customs (already normalized).
 */
export function listUserAgentPresets(customUserAgents: readonly string[] = []): string[] {
  const customs = normalizeCustomUserAgents(customUserAgents);
  return [...BUILTIN_USER_AGENT_PRESETS, ...customs];
}

/**
 * Appends a custom User-Agent when it is not already a built-in or custom entry.
 *
 * @param customUserAgents - Current custom list.
 * @param value - Candidate value from the User-Agent control.
 * @returns Updated custom list, or the original array when nothing new was added.
 */
export function appendCustomUserAgent(
  customUserAgents: readonly string[],
  value: string
): string[] {
  const trimmed = normalizeUserAgent(value);
  if (!trimmed) {
    return [...customUserAgents];
  }
  const current = normalizeCustomUserAgents(customUserAgents);
  const known = new Set(
    [...BUILTIN_USER_AGENT_PRESETS, ...current].map((entry) => entry.toLowerCase())
  );
  if (known.has(trimmed.toLowerCase())) {
    return current;
  }
  return [...current, trimmed];
}

/**
 * Returns whether an enabled key/value header already supplies User-Agent.
 *
 * @param headers - Inherited and request-specific header rows.
 * @returns True when a non-empty User-Agent header is enabled.
 */
export function hasManualUserAgentHeader(headers: KeyValue[]): boolean {
  return headers.some(
    (header) =>
      header.enabled &&
      header.key.trim().toLowerCase() === 'user-agent' &&
      header.value.trim() !== ''
  );
}

/**
 * Scopes that contribute to the effective User-Agent, highest precedence first.
 */
export interface UserAgentScopes {
  /**
   * Request-level override; empty inherits.
   */
  request?: string | null;

  /**
   * Folder-level override; empty inherits.
   */
  folder?: string | null;

  /**
   * Collection-level override; empty inherits.
   */
  collection?: string | null;

  /**
   * Global default from general settings; omit when unavailable at this layer.
   */
  general?: string | null;
}

/**
 * Resolves the User-Agent string from request → folder → collection → general.
 *
 * @param scopes - Scoped and global User-Agent values.
 * @returns Effective User-Agent, or null when every scope is empty.
 */
export function resolveEffectiveUserAgent(scopes: UserAgentScopes): string | null {
  for (const candidate of [scopes.request, scopes.folder, scopes.collection, scopes.general]) {
    const trimmed = normalizeUserAgent(candidate);
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Injects a User-Agent header when none is already present in the key/value list.
 *
 * @param headers - Outbound header rows (mutated only via returned copy).
 * @param scopes - Scoped and global User-Agent values.
 * @returns Headers with User-Agent prepended when a non-empty value resolves.
 */
export function applyUserAgentHeader(headers: KeyValue[], scopes: UserAgentScopes): KeyValue[] {
  if (hasManualUserAgentHeader(headers)) {
    return headers;
  }
  const value = resolveEffectiveUserAgent(scopes);
  if (!value) {
    return headers;
  }
  return [{ key: 'User-Agent', value, enabled: true }, ...headers];
}
