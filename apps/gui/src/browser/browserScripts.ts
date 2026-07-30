/**
 * Page-load points at which an injection script may run.
 */
export type BrowserScriptRunAt = 'document-start' | 'dom-ready' | 'did-finish-load';

/**
 * One plain JavaScript injection script owned by a browser tab.
 */
export interface BrowserInjectionScript {
  /**
   * Stable id within the browser tab's script list.
   */
  id: string;

  /**
   * Display name shown in browser settings.
   */
  name: string;

  /**
   * When false, the script is skipped at injection time.
   */
  enabled: boolean;

  /**
   * Guest lifecycle hook that triggers this script.
   */
  runAt: BrowserScriptRunAt;

  /**
   * JavaScript source executed in the page main world.
   */
  source: string;
}

const RUN_AT_VALUES = new Set<BrowserScriptRunAt>([
  'document-start',
  'dom-ready',
  'did-finish-load'
]);

/**
 * Returns whether a value is a valid {@link BrowserScriptRunAt}.
 *
 * @param value - Candidate run-at string.
 * @returns True when the value is a supported hook name.
 */
export function isBrowserScriptRunAt(value: unknown): value is BrowserScriptRunAt {
  return typeof value === 'string' && RUN_AT_VALUES.has(value as BrowserScriptRunAt);
}

/**
 * Normalizes a candidate injection script from persistence or IPC.
 *
 * @param value - Candidate script object.
 * @returns Normalized script, or null when required fields are invalid.
 */
export function normalizeBrowserInjectionScript(value: unknown): BrowserInjectionScript | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return null;
  }
  if (typeof record.name !== 'string') {
    return null;
  }
  if (typeof record.source !== 'string') {
    return null;
  }
  if (!isBrowserScriptRunAt(record.runAt)) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    enabled: record.enabled !== false,
    runAt: record.runAt,
    source: record.source
  };
}

/**
 * Normalizes a script list, dropping invalid entries.
 *
 * @param value - Candidate array from persistence or IPC.
 * @returns Normalized scripts (possibly empty).
 */
export function normalizeBrowserInjectionScripts(value: unknown): BrowserInjectionScript[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const scripts: BrowserInjectionScript[] = [];
  for (const entry of value) {
    const script = normalizeBrowserInjectionScript(entry);
    if (script) {
      scripts.push(script);
    }
  }
  return scripts;
}

/**
 * Stable JSON for dirty comparison of injection scripts.
 *
 * @param scripts - Script list to normalize.
 * @returns JSON string used to detect unsaved edits.
 */
export function normalizeBrowserScriptsForCompare(scripts: BrowserInjectionScript[]): string {
  return JSON.stringify(
    scripts.map((script) => ({
      id: script.id,
      name: script.name,
      enabled: script.enabled,
      runAt: script.runAt,
      source: script.source
    }))
  );
}

/**
 * Returns whether draft scripts differ from the saved baseline.
 *
 * @param scripts - Current editable scripts.
 * @param savedScripts - Last saved scripts used for injection.
 * @returns True when the gear should show a dirty indicator.
 */
export function areBrowserScriptsDirty(
  scripts: BrowserInjectionScript[],
  savedScripts: BrowserInjectionScript[]
): boolean {
  return (
    normalizeBrowserScriptsForCompare(scripts) !== normalizeBrowserScriptsForCompare(savedScripts)
  );
}

/**
 * Filters enabled scripts for one lifecycle hook, preserving list order.
 *
 * @param scripts - Saved scripts configured on the browser tab.
 * @param runAt - Lifecycle hook that just fired.
 * @returns Enabled scripts that should run now, in order.
 */
export function selectScriptsForRunAt(
  scripts: BrowserInjectionScript[],
  runAt: BrowserScriptRunAt
): BrowserInjectionScript[] {
  return scripts.filter(
    (script) => script.enabled && script.runAt === runAt && script.source.trim()
  );
}

/**
 * Creates an empty injection script with a new id.
 *
 * @returns New disabled-ready script draft (enabled by default).
 */
export function createEmptyBrowserScript(): BrowserInjectionScript {
  return {
    id: crypto.randomUUID(),
    name: 'New script',
    enabled: true,
    runAt: 'did-finish-load',
    source: ''
  };
}
