import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ScriptRef, Snippet } from '#/shared/types';
import {
  readScriptRefStage,
  scriptRowStageSuffix,
  type ScriptEditorGroup
} from '#/shared/scriptStage';

/**
 * Accessible labels for bulk enable checkboxes on script group headings.
 */
export const SCRIPT_GROUP_ENABLE_LABELS: Record<ScriptEditorGroup, string> = {
  before: 'Enable all before scripts',
  main: 'Enable all main scripts',
  after: 'Enable all after scripts'
};

export type ScriptGroupEnabledState = 'all' | 'none' | 'mixed';

/**
 * Returns whether a script row's Stage value can be edited from the list editor.
 *
 * @param script - Script reference for the row.
 * @param snippets - Snippet library used to resolve marketplace-linked rows.
 * @returns True for inline scripts and non-marketplace snippet links.
 */
export function isScriptStageEditable(script: ScriptRef, snippets: Snippet[]): boolean {
  if (script.kind === 'inline') {
    return true;
  }

  const linked = snippets.find((entry) => entry.uuid === script.snippetUuid);
  return linked?.source !== 'marketplace';
}

/**
 * Stops pointer events from bubbling to the drag activator on header controls.
 *
 * @param event - Pointer event from a nested interactive control.
 */
export function stopDragPointerDown(event: ReactPointerEvent): void {
  event.stopPropagation();
}

/**
 * Returns the base display name for one script row without the stage suffix.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Base label for the row header.
 */
export function scriptRowBaseLabel(script: ScriptRef, snippets: Snippet[]): string {
  if (script.name?.trim()) {
    return script.name.trim();
  }
  if (script.kind === 'snippet') {
    const snippet = snippets.find((entry) => entry.uuid === script.snippetUuid);
    return snippet ? `Snippet: ${snippet.name}` : 'Missing snippet';
  }
  return 'Inline script';
}

/**
 * Renders a label for one script reference row.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Display label for the row header.
 */
export function scriptRowLabel(script: ScriptRef, snippets: Snippet[]): string {
  return `${scriptRowBaseLabel(script, snippets)}${scriptRowStageSuffix(readScriptRefStage(script))}`;
}

/**
 * Returns the muted placeholder shown when a script has no custom label.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Placeholder label for inline edit mode.
 */
export function scriptRowPlaceholder(script: ScriptRef, snippets: Snippet[]): string {
  if (script.kind === 'snippet') {
    const snippet = snippets.find((entry) => entry.uuid === script.snippetUuid);
    return snippet ? `Snippet: ${snippet.name}` : 'Missing snippet';
  }
  return 'Inline script';
}

/**
 * Returns the default snippet name for the save modal.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Existing snippet name, script label, or placeholder label.
 */
export function saveSnippetDefaultName(script: ScriptRef, snippets: Snippet[]): string {
  if (script.kind === 'snippet') {
    const linked = snippets.find((entry) => entry.uuid === script.snippetUuid);
    if (linked?.name.trim()) {
      return linked.name.trim();
    }
  }

  if (script.name?.trim()) {
    return script.name.trim();
  }

  return scriptRowPlaceholder(script, snippets);
}

/**
 * Returns muted help copy shown under each Before/Main/After group heading.
 *
 * @param group - Editor group for the heading.
 * @param phase - Active request stage tab (`pre` or `post`).
 * @returns One-line description of when scripts in the group run.
 */
export function scriptGroupHeadingDescription(
  group: ScriptEditorGroup,
  phase: 'pre' | 'post'
): string {
  switch (group) {
    case 'before':
      return 'Scripts that run before main';
    case 'main':
      return phase === 'pre'
        ? 'Scripts that run before the request'
        : 'Scripts that run after the request';
    case 'after':
      return 'Scripts that run after main';
  }
}

/**
 * Derives the bulk-enable checkbox state for one script editor group.
 *
 * @param scripts - Scripts in the before, main, or after group.
 * @returns Whether all, none, or a mix of scripts are enabled.
 */
export function scriptGroupEnabledState(scripts: ScriptRef[]): ScriptGroupEnabledState {
  const enabledCount = scripts.filter((script) => script.enabled).length;
  if (enabledCount === 0) {
    return 'none';
  }
  if (enabledCount === scripts.length) {
    return 'all';
  }
  return 'mixed';
}
