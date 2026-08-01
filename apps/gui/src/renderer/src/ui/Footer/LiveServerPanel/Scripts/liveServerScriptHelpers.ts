import {
  createInlineScriptRef,
  normalizeScriptRefs,
  UNNAMED_SCRIPT_NAME
} from '@harborclient/core/scriptRefs';
import {
  DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH,
  normalizeLiveServerScriptMatchPath,
  type LiveServerScriptRef,
  type ScriptRef
} from '@harborclient/core/types';

/**
 * Wraps a shared {@link ScriptRef} as a live-server row with a path-match pattern.
 *
 * Forces `stage` to `main` (live servers do not use Before/Main/After) and
 * defaults blank match paths to {@link DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH}.
 *
 * @param script - Script reference from create/import/paste flows.
 * @param matchPath - Optional match path; defaults to the live-server default.
 * @returns Live-server script ref suitable for the editor list.
 */
export function toLiveServerScriptRef(
  script: ScriptRef,
  matchPath: string = DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH
): LiveServerScriptRef {
  return {
    ...script,
    stage: 'main',
    matchPath: normalizeLiveServerScriptMatchPath(matchPath)
  };
}

/**
 * Creates a blank expanded inline live-server script with the default match path.
 *
 * @returns New {@link LiveServerScriptRef} ready to append to PreRequest/PostRequest.
 */
export function createLiveServerInlineScriptRef(): LiveServerScriptRef {
  return toLiveServerScriptRef(
    {
      ...createInlineScriptRef('', UNNAMED_SCRIPT_NAME, 'main'),
      expanded: true
    },
    DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH
  );
}

/**
 * Normalizes a live-server script list while preserving each row's `matchPath`.
 *
 * @param scripts - Current editor list (possibly dirty).
 * @returns Normalized {@link LiveServerScriptRef} array.
 */
export function normalizeLiveServerEditorScripts(
  scripts: LiveServerScriptRef[]
): LiveServerScriptRef[] {
  return normalizeScriptRefs(scripts).map((script, index) =>
    toLiveServerScriptRef(script, scripts[index]?.matchPath)
  );
}
