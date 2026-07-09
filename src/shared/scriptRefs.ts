import type { ScriptRef } from '#/shared/types/script';
import type { Snippet } from '#/shared/types/snippet';
import {
  DEFAULT_SCRIPT_STAGE,
  normalizeScriptStage,
  readScriptRefStage
} from '#/shared/scriptStage';

/**
 * Default display label for newly added inline scripts before the user names them.
 */
export const UNNAMED_SCRIPT_NAME = 'Unnamed script...';

/**
 * Maximum length for auto-generated script names derived from source code.
 */
export const SCRIPT_AUTO_NAME_MAX_LENGTH = 25;

/**
 * Creates a new inline script reference with a unique list id.
 *
 * @param code - Initial JavaScript source.
 * @param name - Optional display label.
 * @param stage - Stage within the phase script list.
 * @returns A new inline {@link ScriptRef}.
 */
export function createInlineScriptRef(
  code = '',
  name?: string,
  stage = DEFAULT_SCRIPT_STAGE
): ScriptRef {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    kind: 'inline',
    code,
    stage: normalizeScriptStage(stage),
    ...(name?.trim() ? { name: name.trim() } : {})
  };
}

/**
 * Creates a new snippet reference with a unique list id.
 *
 * @param snippetUuid - Stable uuid of the referenced snippet.
 * @param name - Optional display label override.
 * @param stage - Stage within the phase script list.
 * @returns A new snippet {@link ScriptRef}.
 */
export function createSnippetScriptRef(
  snippetUuid: string,
  name?: string,
  stage = DEFAULT_SCRIPT_STAGE
): ScriptRef {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    kind: 'snippet',
    snippetUuid: snippetUuid.trim(),
    stage: normalizeScriptStage(stage),
    ...(name?.trim() ? { name: name.trim() } : {})
  };
}

/**
 * Converts an existing script row into a snippet reference without stale inline code.
 *
 * @param script - Script row to relink.
 * @param snippetUuid - Saved snippet uuid to reference.
 * @param name - Display label stored on the script row.
 * @returns Snippet-linked {@link ScriptRef} preserving row identity fields.
 */
export function linkScriptRefToSnippet(
  script: ScriptRef,
  snippetUuid: string,
  name: string
): ScriptRef {
  const trimmedUuid = snippetUuid.trim();
  const trimmedName = name.trim();

  return {
    id: script.id,
    enabled: script.enabled,
    kind: 'snippet',
    snippetUuid: trimmedUuid,
    stage: normalizeScriptStage(readScriptRefStage(script)),
    ...(typeof script.expanded === 'boolean' ? { expanded: script.expanded } : {}),
    ...(trimmedName ? { name: trimmedName } : {})
  };
}

/**
 * Returns whether a value is a well-formed script reference object.
 *
 * @param value - Candidate parsed from storage or IPC.
 * @returns True when the value matches the {@link ScriptRef} shape.
 */
function isScriptRef(value: unknown): value is ScriptRef {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim() === '') {
    return false;
  }
  if (typeof record.enabled !== 'boolean') {
    return false;
  }
  if (record.kind !== 'inline' && record.kind !== 'snippet') {
    return false;
  }
  if (record.kind === 'inline') {
    return typeof record.code === 'string';
  }
  return typeof record.snippetUuid === 'string' && record.snippetUuid.trim() !== '';
}

/**
 * Sanitizes script reference arrays loaded from storage or the editor.
 *
 * @param refs - Raw script references.
 * @returns Valid script references with trimmed inline code and snippet uuids.
 */
export function normalizeScriptRefs(refs: ScriptRef[] | undefined | null): ScriptRef[] {
  if (!Array.isArray(refs)) {
    return [];
  }

  return refs.filter(isScriptRef).map((ref) => ({
    ...ref,
    id: ref.id.trim(),
    enabled: ref.enabled,
    kind: ref.kind,
    stage: normalizeScriptStage(readScriptRefStage(ref)),
    ...(ref.name?.trim() ? { name: ref.name.trim() } : {}),
    ...(typeof ref.expanded === 'boolean' ? { expanded: ref.expanded } : {}),
    ...(ref.kind === 'inline'
      ? { code: ref.code ?? '' }
      : { snippetUuid: ref.snippetUuid?.trim() ?? '' })
  }));
}

/**
 * Normalizes script references for dirty-state and equality checks.
 *
 * Omits {@link ScriptRef.expanded}, which is editor UI state and is not
 * persisted to storage.
 *
 * @param refs - Raw script references from drafts or forms.
 * @returns Comparable script references without ephemeral UI fields.
 */
export function normalizeScriptRefsForCompare(refs: ScriptRef[] | undefined | null): ScriptRef[] {
  return normalizeScriptRefs(refs).map((ref) => {
    const comparable = { ...ref };
    delete comparable.expanded;
    return comparable;
  });
}

/**
 * Resolves canonical script references, falling back to a legacy single string.
 *
 * @param refs - Stored script reference array, possibly empty.
 * @param legacyScript - Legacy single-script column value.
 * @returns Normalized script references for the editor and send pipeline.
 */
export function resolveScriptRefs(
  refs: ScriptRef[] | undefined | null,
  legacyScript: string
): ScriptRef[] {
  const normalized = normalizeScriptRefs(refs);
  if (normalized.length > 0) {
    return normalized;
  }

  const legacy = legacyScript.trim();
  if (!legacy) {
    return [];
  }

  return [createInlineScriptRef(legacy)];
}

/**
 * Parses script references from a JSON column with legacy fallback.
 *
 * @param raw - JSON string or already-parsed array from storage.
 * @param legacyScript - Legacy single-script column value.
 * @returns Resolved script references.
 */
export function readScriptRefsFromJson(raw: unknown, legacyScript: string): ScriptRef[] {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[]') {
      return resolveScriptRefs([], legacyScript);
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return resolveScriptRefs(Array.isArray(parsed) ? (parsed as ScriptRef[]) : [], legacyScript);
    } catch {
      return resolveScriptRefs([], legacyScript);
    }
  }

  if (Array.isArray(raw)) {
    return resolveScriptRefs(raw as ScriptRef[], legacyScript);
  }

  return resolveScriptRefs([], legacyScript);
}

/**
 * Serializes script references for JSON storage columns.
 *
 * @param refs - Script references to persist.
 * @returns JSON string suitable for SQLite/Postgres TEXT columns.
 */
export function serializeScriptRefs(refs: ScriptRef[] | undefined | null): string {
  return JSON.stringify(normalizeScriptRefs(refs));
}

/**
 * Builds the legacy single-script mirror from enabled inline scripts only.
 *
 * Snippet references are excluded because their source is resolved at send time.
 *
 * @param refs - Canonical script reference array.
 * @returns Concatenated inline script source for legacy export paths.
 */
export function mirrorLegacyScriptString(refs: ScriptRef[] | undefined | null): string {
  return normalizeScriptRefs(refs)
    .filter((ref) => ref.enabled && ref.kind === 'inline')
    .map((ref) => (ref.code ?? '').trim())
    .filter((code) => code.length > 0)
    .join('\n\n');
}

/**
 * Converts a legacy single-script string into a one-item inline script list.
 *
 * @param legacyScript - Legacy script column value.
 * @returns Inline script references, or an empty list when blank.
 */
export function scriptRefsFromLegacyString(legacyScript: string): ScriptRef[] {
  const trimmed = legacyScript.trim();
  if (!trimmed) {
    return [];
  }
  return [createInlineScriptRef(trimmed)];
}

/**
 * Ensures at least one empty inline script exists for the script tab editor.
 *
 * @param refs - Current script references, possibly empty.
 * @returns The existing list when non-empty, otherwise a single blank inline script.
 */
export function ensureDefaultScriptRef(refs: ScriptRef[] | undefined | null): ScriptRef[] {
  const normalized = normalizeScriptRefs(refs);
  if (normalized.length > 0) {
    return normalized;
  }
  return [{ ...createInlineScriptRef(''), expanded: true }];
}

/**
 * Resolves JavaScript source for one script reference.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Inline code or referenced snippet source.
 */
export function resolveScriptSourceCode(script: ScriptRef, snippets: Snippet[]): string {
  if (script.kind === 'inline') {
    return script.code ?? '';
  }

  return snippets.find((entry) => entry.uuid === script.snippetUuid)?.code ?? '';
}

/**
 * Derives an auto-generated script name from the first non-empty source line.
 *
 * @param code - JavaScript source to inspect.
 * @returns Trimmed first line up to {@link SCRIPT_AUTO_NAME_MAX_LENGTH}, or null when empty.
 */
export function scriptAutoNameFromCode(code: string): string | null {
  if (!code.trim()) {
    return null;
  }

  const firstLine = (code.split('\n')[0] ?? '').trim();
  if (!firstLine) {
    return null;
  }

  return firstLine.slice(0, SCRIPT_AUTO_NAME_MAX_LENGTH);
}

/**
 * Renames unnamed script rows using the first line of their resolved source code.
 *
 * @param refs - Script references to normalize and inspect.
 * @param snippets - Snippet library lookup source.
 * @param unnamedLabel - Placeholder label that triggers auto-naming.
 * @returns Script references with auto names applied where applicable.
 */
export function autoNameUnnamedScripts(
  refs: ScriptRef[] | undefined | null,
  snippets: Snippet[],
  unnamedLabel: string = UNNAMED_SCRIPT_NAME
): ScriptRef[] {
  return normalizeScriptRefs(refs).map((ref) => {
    if (ref.name?.trim() !== unnamedLabel) {
      return ref;
    }

    const autoName = scriptAutoNameFromCode(resolveScriptSourceCode(ref, snippets));
    if (!autoName) {
      return ref;
    }

    return { ...ref, name: autoName };
  });
}

/**
 * One script row id change reported when storage round-trips regenerate list keys.
 */
export interface ScriptRefIdMigration {
  /**
   * Previous {@link ScriptRef.id} from the pre-save editor draft.
   */
  from: string;

  /**
   * New {@link ScriptRef.id} from the saved storage payload.
   */
  to: string;
}

/**
 * Result of merging ephemeral script UI state into a post-save script list.
 */
export interface MergeScriptRefsUiStateResult {
  /**
   * Saved script references with editor UI fields restored from the pre-save draft.
   */
  merged: ScriptRef[];

  /**
   * Id pairs to migrate persisted CodeEditor UI state in localStorage.
   */
  idMigrations: ScriptRefIdMigration[];
}

/**
 * Copies ephemeral {@link ScriptRef.expanded} from a pre-save list onto a saved list.
 *
 * Matches rows by id first, then by index when storage regenerates ids. Reports id
 * changes so callers can migrate localStorage editor UI keys.
 *
 * @param before - Script references from the editor draft before save.
 * @param after - Script references returned from storage after save.
 * @returns Merged list and any id migrations detected during index fallback matching.
 */
export function mergeScriptRefsUiState(
  before: ScriptRef[] | undefined | null,
  after: ScriptRef[] | undefined | null
): MergeScriptRefsUiStateResult {
  const previous = normalizeScriptRefs(before);
  const saved = normalizeScriptRefs(after);
  const beforeById = new Map(previous.map((ref) => [ref.id, ref]));
  const idMigrations: ScriptRefIdMigration[] = [];
  const consumedBeforeIds = new Set<string>();

  const merged = saved.map((savedRef, index) => {
    let beforeRef = beforeById.get(savedRef.id);
    if (beforeRef) {
      consumedBeforeIds.add(beforeRef.id);
    } else {
      const indexMatch = previous[index];
      if (indexMatch && !consumedBeforeIds.has(indexMatch.id)) {
        beforeRef = indexMatch;
        consumedBeforeIds.add(indexMatch.id);
        if (indexMatch.id !== savedRef.id) {
          idMigrations.push({ from: indexMatch.id, to: savedRef.id });
        }
      }
    }

    if (!beforeRef || typeof beforeRef.expanded !== 'boolean') {
      return savedRef;
    }

    if (typeof savedRef.expanded === 'boolean') {
      return savedRef;
    }

    return { ...savedRef, expanded: beforeRef.expanded };
  });

  return { merged, idMigrations };
}

/**
 * Returns whether any enabled script references exist in the list.
 *
 * @param refs - Script references to inspect.
 * @returns True when at least one enabled inline or snippet reference is present.
 */
export function hasScriptContent(refs: ScriptRef[] | undefined | null): boolean {
  return normalizeScriptRefs(refs).some((ref) => {
    if (!ref.enabled) {
      return false;
    }
    if (ref.kind === 'snippet') {
      return Boolean(ref.snippetUuid?.trim());
    }
    return Boolean((ref.code ?? '').trim());
  });
}
