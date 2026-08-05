import { HARBOR_PLUGIN_PROTOCOL } from '@harborclient/core/plugin/pluginSurface';

/** Role of an isolated plugin webview session. */
export type PluginWebviewRole = 'agent' | 'view';

/**
 * Session metadata for a plugin webview, always derived from the guest URL /
 * partition rather than trusting IPC registration fields.
 */
export interface PluginWebviewSession {
  pluginId: string;
  role: PluginWebviewRole;
  contributionId?: string;
  kind?: string;
  slot?: string;
}

/** Minimal webContents surface needed to derive plugin identity. */
export interface PluginWebContentsIdentitySource {
  getURL: () => string;
  /**
   * Electron Session does not document `partition` on the public type, but some
   * builds expose it. Accept unknown session objects and read defensively.
   */
  session?: unknown;
}

/**
 * Reads an optional partition string from a webContents session object.
 *
 * @param session - Electron session or test double.
 * @returns Partition name when present.
 */
function readSessionPartition(session: unknown): string | null {
  if (!session || typeof session !== 'object') {
    return null;
  }
  const partition = (session as { partition?: unknown }).partition;
  return typeof partition === 'string' && partition.length > 0 ? partition : null;
}

/**
 * Parses a harbor-plugin: URL into session identity fields.
 *
 * @param href - Absolute guest URL.
 * @returns Session identity for the plugin webview.
 * @throws When the URL is not a harbor-plugin document.
 */
export function parsePluginWebviewSessionFromUrl(href: string): PluginWebviewSession {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new Error('Plugin webview URL is not a valid absolute URL.');
  }

  const expectedProtocol = `${HARBOR_PLUGIN_PROTOCOL}:`;
  if (url.protocol !== expectedProtocol) {
    throw new Error(`Plugin webview URL must use ${expectedProtocol} (got ${url.protocol}).`);
  }

  const pluginId = decodeURIComponent(url.hostname).trim();
  if (!pluginId) {
    throw new Error('Plugin webview URL is missing a plugin id hostname.');
  }

  const roleParam = url.searchParams.get('role');
  const role: PluginWebviewRole = roleParam === 'view' ? 'view' : 'agent';
  const contributionId = url.searchParams.get('contrib')?.trim() || undefined;
  const kind = url.searchParams.get('kind')?.trim() || undefined;
  const slot = url.searchParams.get('slot')?.trim() || undefined;

  return {
    pluginId,
    role,
    ...(contributionId ? { contributionId } : {}),
    ...(kind ? { kind } : {}),
    ...(slot ? { slot } : {})
  };
}

/**
 * Builds the expected session partition string for a plugin id.
 *
 * @param pluginId - Plugin manifest id.
 * @returns Electron partition name used by plugin webviews.
 */
export function pluginSessionPartition(pluginId: string): string {
  return `persist:plugin-${pluginId}`;
}

/**
 * Derives plugin webview session identity from webContents URL (and partition when
 * Electron exposes it). Registration IPC payloads must not be trusted for identity.
 *
 * @param source - Guest webContents (or test double) exposing getURL / session.
 * @returns Session identity bound to this webContents.
 * @throws When the guest URL or partition does not identify a plugin webview.
 */
export function derivePluginWebviewSession(
  source: PluginWebContentsIdentitySource
): PluginWebviewSession {
  const session = parsePluginWebviewSessionFromUrl(source.getURL());
  const partition = readSessionPartition(source.session);
  if (partition != null) {
    const expected = pluginSessionPartition(session.pluginId);
    if (partition !== expected) {
      throw new Error(`Plugin webview partition mismatch: expected ${expected}, got ${partition}.`);
    }
  }
  return session;
}
