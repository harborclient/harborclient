import type {
  BrowserHcScriptsPayload,
  BrowserRequestDefaultsPayload
} from '@harborclient/core/types';
import { normalizeAuth, type AuthConfig } from '@harborclient/core/auth';
import type { KeyValue, ScriptRef, Snippet } from '@harborclient/core/types';
import type { BrowserInjectionScript } from '#/browser/browserScripts';
import { resolveBrowserHcScriptSources } from '#/browser/browserHcScripts';
import { buildScriptModuleMap } from '#/renderer/src/scripting/scriptResolution';

/**
 * Builds the request-defaults payload pushed to the main-process guest.
 *
 * @param headers - Header rows for chrome-driven navigations.
 * @param auth - Authorization config.
 * @param userAgent - User-Agent override; empty keeps Chromium default.
 * @returns Payload suitable for `BrowserHcScriptsPayload.requestDefaults`.
 */
export function buildBrowserRequestDefaults(
  headers: KeyValue[],
  auth: AuthConfig,
  userAgent: string
): BrowserRequestDefaultsPayload {
  return {
    headers: headers.map((row) => ({ ...row })),
    auth: normalizeAuth(auth),
    userAgent
  };
}

/**
 * Builds the hcScripts IPC payload (resolved scripts + request defaults) for a browser tab.
 *
 * @param tab - Browser tab fields used for guest script application.
 * @param snippets - Snippet library for resolving hc.* sources.
 * @param useSaved - When true, use saved baselines; otherwise use draft fields.
 * @returns Payload for `browserCreate` / `browserSetScripts`.
 */
export function buildBrowserHcScriptsPayload(
  tab: {
    scripts: BrowserInjectionScript[];
    savedScripts: BrowserInjectionScript[];
    pre_request_scripts: ScriptRef[];
    post_request_scripts: ScriptRef[];
    savedPreRequestScripts: ScriptRef[];
    savedPostRequestScripts: ScriptRef[];
    headers: KeyValue[];
    savedHeaders: KeyValue[];
    auth: AuthConfig;
    savedAuth: AuthConfig;
    userAgent: string;
    savedUserAgent: string;
  },
  snippets: Snippet[],
  useSaved = true
): BrowserHcScriptsPayload {
  const pre = useSaved ? tab.savedPreRequestScripts : tab.pre_request_scripts;
  const post = useSaved ? tab.savedPostRequestScripts : tab.post_request_scripts;
  const headers = useSaved ? tab.savedHeaders : tab.headers;
  const auth = useSaved ? tab.savedAuth : tab.auth;
  const userAgent = useSaved ? tab.savedUserAgent : tab.userAgent;
  const { modules, conflicts } = buildScriptModuleMap(snippets, [pre, post]);
  return {
    preRequestScripts: resolveBrowserHcScriptSources(pre, snippets),
    postRequestScripts: resolveBrowserHcScriptSources(post, snippets),
    snippetModules: modules,
    snippetModuleConflicts: conflicts,
    requestDefaults: buildBrowserRequestDefaults(headers, auth, userAgent)
  };
}
