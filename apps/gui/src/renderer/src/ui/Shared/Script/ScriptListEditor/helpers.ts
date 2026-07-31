import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MenuItem } from '@harborclient/sdk/components';
import type { ScriptStage } from '@harborclient/sdk';
import type { ScriptRef, Snippet } from '@harborclient/core/types';
import {
  readScriptRefStage,
  scriptRowStageSuffix,
  type ScriptEditorGroup
} from '@harborclient/core/scriptStage';

/**
 * Accessible labels for bulk enable checkboxes on script group headings.
 */
export const SCRIPT_GROUP_ENABLE_LABELS: Record<ScriptEditorGroup, string> = {
  before: 'Enable all before scripts',
  main: 'Enable all main scripts',
  after: 'Enable all after scripts'
};

/**
 * Accessible names for Before/Main/After section hamburger menus.
 */
export const SCRIPT_GROUP_MENU_LABELS: Record<ScriptEditorGroup, string> = {
  before: 'Before script actions',
  main: 'Main script actions',
  after: 'After script actions'
};

/**
 * Ordered "New …" stage entries for each section header menu.
 *
 * After lists after-all before after-each to match the product menu order.
 */
export const SCRIPT_GROUP_NEW_STAGE_OPTIONS: Record<
  ScriptEditorGroup,
  { stage: ScriptStage; label: string }[]
> = {
  before: [
    { stage: 'before-all', label: 'New before-all' },
    { stage: 'before-each', label: 'New before-each' }
  ],
  main: [{ stage: 'main', label: 'New script' }],
  after: [
    { stage: 'after-all', label: 'New after-all' },
    { stage: 'after-each', label: 'New after-each' }
  ]
};

/**
 * Builds hamburger menu groups for a Before/Main/After section header.
 *
 * Stage "New …" items are filtered to `allowedStages`. Snippets is always a
 * submenu whose contents match the toolbar snippet library menu.
 *
 * @param group - Section whose menu is being built.
 * @param allowedStages - Stages the editor may assign to new scripts.
 * @param options - Callbacks and snippet submenu contents.
 * @returns Grouped `RowActionsMenu` entries for the section header.
 */
export function buildScriptGroupActionMenuGroups(
  group: ScriptEditorGroup,
  allowedStages: ScriptStage[],
  options: {
    onAddStage: (stage: ScriptStage) => void;
    snippetMenuGroups: MenuItem[][];
  }
): MenuItem[][] {
  const allowed = new Set(allowedStages);
  const stageItems: MenuItem[] = SCRIPT_GROUP_NEW_STAGE_OPTIONS[group]
    .filter((entry) => allowed.has(entry.stage))
    .map((entry) => ({
      label: entry.label,
      onSelect: () => options.onAddStage(entry.stage)
    }));

  const groups: MenuItem[][] = [];
  if (stageItems.length > 0) {
    groups.push(stageItems);
  }
  groups.push([{ label: 'Snippets', submenu: options.snippetMenuGroups }]);
  return groups;
}

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
