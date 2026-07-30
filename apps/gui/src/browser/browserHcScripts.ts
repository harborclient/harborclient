import type {
  ScriptRef,
  ScriptRequestContext,
  ScriptRunResult,
  SendResult,
  Snippet
} from '@harborclient/core/types';
import {
  normalizeScriptRefs,
  normalizeScriptRefsForCompare,
  resolveScriptSourceCode
} from '@harborclient/core/scriptRefs';
import { normalizeScriptStage } from '@harborclient/core/scriptStage';
import { variableKeyIsCleared } from '@harborclient/core/scripting/variableClearMatch';

/**
 * Maximum characters of page HTML exposed to post-request scripts via hc.response.
 */
export const BROWSER_PAGE_HTML_MAX_CHARS = 512_000;

/**
 * One resolved pre/post script ready to run in the browser guest SES sandbox.
 */
export interface BrowserHcScriptSource {
  /**
   * Stable script id from the editor ScriptRef.
   */
  id: string;

  /**
   * Display name used in verbose logs.
   */
  name: string;

  /**
   * JavaScript source executed in the SES sandbox.
   */
  source: string;
}

/**
 * Seeds a GET ScriptRequestContext for browser pre/post scripts from a target URL.
 *
 * @param url - Navigation target URL.
 * @returns Minimal request context for the SES sandbox.
 */
export function buildBrowserScriptRequest(url: string): ScriptRequestContext {
  return {
    method: 'GET',
    url,
    headers: [],
    userAgent: '',
    params: [],
    body: '',
    bodyType: 'none',
    tags: '',
    comment: ''
  };
}

/**
 * Applies ephemeral variable sets and clears from one browser script onto a working map.
 *
 * Used to chain `hc.request.variables` across sequential pre/post scripts in one navigation.
 * Does not mutate the session baseline — callers pass a per-navigation copy.
 *
 * @param runtimeVars - Current working variable map for this navigation.
 * @param result - Script run result with variableSets and variableClears.
 * @returns Updated working map for the next script in the chain.
 */
export function applyBrowserScriptVariableResult(
  runtimeVars: Record<string, string>,
  result: Pick<ScriptRunResult, 'variableSets' | 'variableClears'>
): Record<string, string> {
  const clears = result.variableClears ?? [];
  let next = runtimeVars;
  if (clears.length > 0) {
    next = { ...runtimeVars };
    for (const key of Object.keys(next)) {
      if (variableKeyIsCleared(key, clears)) {
        delete next[key];
      }
    }
  }
  const sets = result.variableSets ?? {};
  if (Object.keys(sets).length === 0) {
    return next;
  }
  return { ...next, ...sets };
}

/**
 * Returns whether two script-ref lists differ for dirty comparison.
 *
 * @param draft - Editable script list.
 * @param saved - Last saved baseline.
 * @returns True when the lists are not equivalent ignoring expanded UI state.
 */
export function areBrowserHcScriptsDirty(draft: ScriptRef[], saved: ScriptRef[]): boolean {
  return (
    JSON.stringify(normalizeScriptRefsForCompare(draft)) !==
    JSON.stringify(normalizeScriptRefsForCompare(saved))
  );
}

/**
 * Forces every script stage to `main` for browser settings (main-only stages).
 *
 * @param refs - Candidate script references.
 * @returns Normalized refs with stage `main`.
 */
export function normalizeBrowserHcScriptRefs(refs: unknown): ScriptRef[] {
  return normalizeScriptRefs(refs as ScriptRef[] | undefined | null).map((script) =>
    normalizeScriptStage(script.stage) === 'main' ? script : { ...script, stage: 'main' as const }
  );
}

/**
 * Resolves enabled main-stage script refs to executable sources for the guest manager.
 *
 * @param refs - Saved pre or post script list.
 * @param snippets - Snippet library for snippet refs.
 * @returns Ordered sources with non-empty code.
 */
export function resolveBrowserHcScriptSources(
  refs: ScriptRef[],
  snippets: Snippet[]
): BrowserHcScriptSource[] {
  const sources: BrowserHcScriptSource[] = [];
  for (const script of normalizeBrowserHcScriptRefs(refs)) {
    if (!script.enabled) {
      continue;
    }
    const source = resolveScriptSourceCode(script, snippets);
    if (!source.trim()) {
      continue;
    }
    sources.push({
      id: script.id,
      name: script.name?.trim() || 'Script',
      source
    });
  }
  return sources;
}

/**
 * Caps HTML length for post-request hc.response bodies.
 *
 * @param html - Full document outerHTML.
 * @returns Truncated HTML when over the size cap.
 */
export function capBrowserPageHtml(html: string): string {
  if (html.length <= BROWSER_PAGE_HTML_MAX_CHARS) {
    return html;
  }
  return html.slice(0, BROWSER_PAGE_HTML_MAX_CHARS);
}

/**
 * Builds a SendResult-shaped snapshot so post scripts can read the loaded page via hc.response.
 *
 * @param input - Page URL, title, optional HTTP status, and HTML body.
 * @returns Response context for ScriptRunInput.response.
 */
export function buildBrowserPageResponseSnapshot(input: {
  url: string;
  title: string;
  statusCode?: number;
  html: string;
}): SendResult {
  const body = capBrowserPageHtml(input.html);
  const status =
    typeof input.statusCode === 'number' && input.statusCode > 0 ? input.statusCode : 200;
  return {
    status,
    statusText: input.title.trim() || 'OK',
    headers: {
      'content-type': 'text/html'
    },
    body,
    timeMs: 0,
    sizeBytes: new TextEncoder().encode(body).length,
    request: {
      method: 'GET',
      url: input.url,
      headers: {},
      body: '',
      bodyType: 'none'
    }
  };
}
