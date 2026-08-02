import type { GeneralSettings, LiveServerSettingsTab } from '@harborclient/core/types';

/**
 * Copy for one Live Server settings panel tab notice.
 */
export interface LiveServerNoticeCopy {
  /** Human-readable tab name used in the dismiss button accessible name. */
  label: string;
  /** One to two sentence description of what the tab does. */
  description: string;
}

/**
 * Inline help copy for every Live Server settings panel tab, keyed by tab id.
 */
export const LIVE_SERVER_NOTICES: Record<LiveServerSettingsTab, LiveServerNoticeCopy> = {
  general: {
    label: 'General',
    description:
      'Set the server name, document root, host, port, and how Live Pages open when the server starts.'
  },
  proxy: {
    label: 'Proxy',
    description:
      'Forward matching path prefixes to an upstream HTTP(S) URL before static files are served.'
  },
  headers: {
    label: 'Headers',
    description:
      'Configure response headers and CORS options applied to every Live Server response.'
  },
  routing: {
    label: 'Routing',
    description:
      'Map URL paths with aliases and fallback rules, and serve custom HTML for error status codes.'
  },
  run: {
    label: 'Command',
    description:
      'Optionally start a companion process with the live server using a runtime and command template.'
  },
  ssl: {
    label: 'SSL',
    description:
      'Supply your own PEM (or compatible) certificate and private key. HarborClient does not generate self-signed certificates.'
  },
  scripts: {
    label: 'Scripts',
    description:
      'Scripts run only when the request path matches. Pre-request scripts finish before proxy and Run command traffic.'
  }
};

/**
 * All Live Server panel tab ids that show a dismissible notice, in tab display order.
 */
export const LIVE_SERVER_NOTICE_TABS = Object.keys(LIVE_SERVER_NOTICES) as LiveServerSettingsTab[];

/**
 * Returns whether the notice for a Live Server panel tab has been dismissed.
 *
 * @param general - Live general settings from the renderer store.
 * @param tab - Live Server settings tab id.
 */
export function isLiveServerNoticeDismissed(
  general: GeneralSettings,
  tab: LiveServerSettingsTab
): boolean {
  return general.dismissedLiveServerNotices.includes(tab);
}

/**
 * Builds a general-settings patch that dismisses one Live Server panel notice,
 * preserving previously dismissed tabs and avoiding duplicates.
 *
 * @param general - Live general settings from the renderer store.
 * @param tab - Live Server settings tab id to dismiss.
 */
export function dismissLiveServerNoticePatch(
  general: GeneralSettings,
  tab: LiveServerSettingsTab
): Partial<GeneralSettings> {
  return {
    dismissedLiveServerNotices: [...new Set([...general.dismissedLiveServerNotices, tab])]
  };
}
