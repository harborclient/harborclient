import type { ScriptRef, Snippet } from '#/shared/types';
import { normalizeScriptRefs, resolveScriptRefs } from '#/shared/scriptRefs';
import { orderScriptRefsByStage } from '#/shared/scriptStage';

/**
 * Ordered script slot to run for a send operation.
 */
export interface ScriptSlot {
  label: string;
  phase: 'pre' | 'post';
  source: string;
}

/**
 * Builds a lookup map from snippet uuid to current JavaScript source.
 *
 * @param snippets - Snippet library entries loaded from the registry.
 * @returns Map keyed by snippet uuid.
 */
export function buildSnippetLookup(snippets: Snippet[]): Map<string, Snippet> {
  const lookup = new Map<string, Snippet>();
  for (const snippet of snippets) {
    const uuid = snippet.uuid.trim();
    if (uuid) {
      lookup.set(uuid, snippet);
    }
  }
  return lookup;
}

/**
 * Resolves one script reference to executable JavaScript source.
 *
 * @param ref - Script reference to resolve.
 * @param snippetLookup - Live snippet library lookup by uuid.
 * @returns Resolved source, or empty string when disabled or missing.
 */
export function resolveScriptRefSource(
  ref: ScriptRef,
  snippetLookup: Map<string, Snippet>
): string {
  if (!ref.enabled) {
    return '';
  }

  if (ref.kind === 'inline') {
    return (ref.code ?? '').trim();
  }

  const snippetUuid = ref.snippetUuid?.trim();
  if (!snippetUuid) {
    return '';
  }

  return snippetLookup.get(snippetUuid)?.code.trim() ?? '';
}

/**
 * Expands ordered script references into executable script slots.
 *
 * @param refs - Ordered script references for one phase.
 * @param phase - Script phase label metadata.
 * @param scopeLabel - Human-readable scope prefix for console output.
 * @param snippetLookup - Live snippet library lookup by uuid.
 * @returns Ordered slots with resolved JavaScript source.
 */
export function expandScriptRefsToSlots(
  refs: ScriptRef[] | undefined | null,
  phase: 'pre' | 'post',
  scopeLabel: string,
  snippetLookup: Map<string, Snippet>
): ScriptSlot[] {
  const slots: ScriptSlot[] = [];
  const normalized = orderScriptRefsByStage(normalizeScriptRefs(refs));

  normalized.forEach((ref, index) => {
    const source = resolveScriptRefSource(ref, snippetLookup);
    if (!source) {
      return;
    }

    const label =
      ref.name?.trim() ||
      (ref.kind === 'snippet'
        ? snippetLookup.get(ref.snippetUuid?.trim() ?? '')?.name
        : undefined) ||
      `${scopeLabel} script ${index + 1}`;

    slots.push({
      label,
      phase,
      source
    });
  });

  return slots;
}

/**
 * Resolves script references with legacy string fallback before slot expansion.
 *
 * @param refs - Canonical script reference array.
 * @param legacyScript - Legacy single-script fallback.
 * @param phase - Script phase label metadata.
 * @param scopeLabel - Human-readable scope prefix for console output.
 * @param snippetLookup - Live snippet library lookup by uuid.
 * @returns Ordered executable script slots.
 */
export function buildScopedScriptSlots(
  refs: ScriptRef[] | undefined | null,
  legacyScript: string,
  phase: 'pre' | 'post',
  scopeLabel: string,
  snippetLookup: Map<string, Snippet>
): ScriptSlot[] {
  return expandScriptRefsToSlots(
    resolveScriptRefs(refs, legacyScript),
    phase,
    scopeLabel,
    snippetLookup
  );
}
