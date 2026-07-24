import { resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { shell, type WebContents } from 'electron';
import { logVerbose } from '#/main/logger';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Dev-server or packaged file policy for in-window renderer navigation.
 */
export type RendererNavigationPolicy =
  | {
      mode: 'dev';
      /** Origin of the Vite dev server (for example `http://127.0.0.1:5173`). */
      devServerOrigin: string;
    }
  | {
      mode: 'file';
      /** Absolute path to the renderer index.html entry. */
      indexPath: string;
      /** Absolute path to the renderer output directory. */
      rendererRoot: string;
    };

/**
 * Options used to build a {@link RendererNavigationPolicy} for the main window.
 */
export type CreateRendererNavigationPolicyOptions = {
  /** Whether the app is running unpackaged (dev). */
  isDev: boolean;
  /** Vite dev-server URL when running in dev; undefined in production. */
  devRendererUrl: string | undefined;
  /** Absolute path to the packaged renderer index.html. */
  indexPath: string;
  /** Absolute path to the renderer output directory. */
  rendererRoot: string;
};

/**
 * Returns whether a URL is safe to hand to `shell.openExternal`.
 *
 * Only http, https, and mailto schemes are allowed so attacker-controlled
 * renderer content cannot trigger local file opens or custom protocol handlers.
 *
 * @param url - URL requested by the renderer via `window.open` or `target="_blank"`.
 * @returns True when the URL uses an allowed external scheme.
 */
export function isAllowedExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Returns whether in-window navigation should be permitted for the main renderer.
 *
 * Blocks navigation away from the trusted app shell (Vite dev origin in dev, or
 * the packaged renderer directory in production).
 *
 * @param url - Navigation or redirect target URL.
 * @param policy - Active renderer navigation policy.
 * @returns True when navigation may proceed inside the main window.
 */
export function isAllowedRendererNavigation(
  url: string,
  policy: RendererNavigationPolicy
): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (policy.mode === 'dev') {
    return parsed.origin === policy.devServerOrigin;
  }

  if (parsed.protocol !== 'file:') {
    return false;
  }

  const targetPath = resolve(fileURLToPath(parsed.href));
  const indexPath = resolve(policy.indexPath);
  const rendererRoot = resolve(policy.rendererRoot);

  if (targetPath === indexPath) {
    return true;
  }

  const rootPrefix = rendererRoot.endsWith(sep) ? rendererRoot : `${rendererRoot}${sep}`;
  return targetPath.startsWith(rootPrefix);
}

/**
 * Builds the navigation policy for the main renderer window.
 *
 * @param options - Dev/prod paths and dev-server URL.
 * @returns Policy used by {@link attachRendererNavigationGuards}.
 */
export function createRendererNavigationPolicy(
  options: CreateRendererNavigationPolicyOptions
): RendererNavigationPolicy {
  if (options.isDev && options.devRendererUrl) {
    return {
      mode: 'dev',
      devServerOrigin: new URL(options.devRendererUrl).origin
    };
  }

  return {
    mode: 'file',
    indexPath: options.indexPath,
    rendererRoot: options.rendererRoot
  };
}

/**
 * Registers main-window guards against unsafe external opens and navigation.
 *
 * Wires `setWindowOpenHandler`, `will-navigate`, and `will-redirect` so
 * attacker-controlled renderer content cannot open arbitrary URLs externally or
 * navigate the main window away from the app shell.
 *
 * @param webContents - Main window web contents.
 * @param policy - Allowed in-window navigation targets.
 */
export function attachRendererNavigationGuards(
  webContents: WebContents,
  policy: RendererNavigationPolicy
): void {
  webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      void shell.openExternal(details.url);
    } else {
      logVerbose('Blocked window.open to disallowed URL:', details.url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedRendererNavigation(url, policy)) {
      logVerbose('Blocked will-navigate to disallowed URL:', url);
      event.preventDefault();
    }
  });

  webContents.on('will-redirect', (event, url) => {
    if (!isAllowedRendererNavigation(url, policy)) {
      logVerbose('Blocked will-redirect to disallowed URL:', url);
      event.preventDefault();
    }
  });
}
