import { resolveScriptSourceCode, scriptAutoNameFromCode } from '#/shared/scriptRefs';
import { snippetScopeForPhase } from '#/shared/snippetScope';
import { normalizeScriptStage, readScriptRefStage } from '#/shared/scriptStage';
import type { ScriptRef } from '#/shared/types/script';
import type { Snippet, SnippetBundleEntry, SnippetBundleExport } from '#/shared/types/snippet';
import type { ScriptPhase } from '#/shared/types';
import { normalizeSnippetScope } from '#/shared/snippetScope';

/**
 * Builds a portable snippets bundle from one phase's script list.
 *
 * @param scripts - Ordered script references for the active phase.
 * @param snippets - Snippet library used to resolve referenced source.
 * @param phase - Pre- or post-request phase being exported.
 * @returns HarborClient snippets bundle export payload.
 */
export function buildSnippetBundle(
  scripts: ScriptRef[],
  snippets: Snippet[],
  phase: ScriptPhase
): SnippetBundleExport {
  const defaultScope = snippetScopeForPhase(phase);

  return {
    harborclientVersion: 1,
    harborclientExport: 'snippets-bundle',
    snippets: scripts.map((script) => {
      const code = resolveScriptSourceCode(script, snippets);
      const name = script.name?.trim() || scriptAutoNameFromCode(code) || 'Untitled';
      const stage = normalizeScriptStage(readScriptRefStage(script));
      const referencedSnippet =
        script.kind === 'snippet'
          ? snippets.find((entry) => entry.uuid === script.snippetUuid)
          : undefined;
      const scope = referencedSnippet?.scope ?? defaultScope;

      const entry: SnippetBundleEntry = {
        name,
        code,
        scope,
        stage
      };

      if (script.kind === 'snippet' && script.snippetUuid?.trim()) {
        entry.uuid = script.snippetUuid.trim();
      }

      return entry;
    })
  };
}

/**
 * Returns whether a value is a well-formed snippets bundle entry.
 *
 * @param value - Candidate parsed from JSON.
 * @returns True when the value has required bundle entry fields.
 */
function isSnippetBundleEntry(value: unknown): value is SnippetBundleEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.name !== 'string' || typeof record.code !== 'string') {
    return false;
  }
  if (typeof record.scope !== 'string' || typeof record.stage !== 'string') {
    return false;
  }
  if (record.uuid !== undefined && typeof record.uuid !== 'string') {
    return false;
  }

  return true;
}

/**
 * Parses and validates a snippets bundle export file.
 *
 * @param raw - UTF-8 JSON text from disk.
 * @returns Validated snippets bundle export payload.
 * @throws When the file is not valid JSON or does not match the bundle schema.
 */
export function parseSnippetBundle(raw: string): SnippetBundleExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid snippets bundle: file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid snippets bundle: expected a JSON object.');
  }

  const record = parsed as Record<string, unknown>;
  if (record.harborclientVersion !== 1) {
    throw new Error('Invalid snippets bundle: unsupported harborclientVersion.');
  }
  if (record.harborclientExport !== 'snippets-bundle') {
    throw new Error('Invalid snippets bundle: harborclientExport must be "snippets-bundle".');
  }
  if (!Array.isArray(record.snippets)) {
    throw new Error('Invalid snippets bundle: snippets must be an array.');
  }

  const snippets = record.snippets.map((entry, index) => {
    if (!isSnippetBundleEntry(entry)) {
      throw new Error(`Invalid snippets bundle: entry at index ${index} is malformed.`);
    }

    return {
      name: entry.name.trim() || 'Untitled',
      code: entry.code,
      scope: normalizeSnippetScope(entry.scope),
      stage: normalizeScriptStage(entry.stage),
      ...(entry.uuid?.trim() ? { uuid: entry.uuid.trim() } : {})
    };
  });

  return {
    harborclientVersion: 1,
    harborclientExport: 'snippets-bundle',
    snippets
  };
}
