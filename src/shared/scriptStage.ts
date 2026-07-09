import type { ScriptStage } from '@harborclient/sdk';

/**
 * Default stage for script rows and snippets without an explicit stage.
 */
export const DEFAULT_SCRIPT_STAGE: ScriptStage = 'main';

/**
 * Select options for script stage fields in editors and modals.
 */
export const SCRIPT_STAGE_OPTIONS: { value: ScriptStage; label: string }[] = [
  { value: 'before-all', label: 'Before all' },
  { value: 'before-each', label: 'Before each' },
  { value: 'main', label: 'Main' },
  { value: 'after-each', label: 'After each' },
  { value: 'after-all', label: 'After all' }
];

const SCRIPT_STAGES = new Set<ScriptStage>(SCRIPT_STAGE_OPTIONS.map((option) => option.value));

/**
 * Visual and drag-reorder grouping for script stages in the script list editor.
 */
export type ScriptEditorGroup = 'before' | 'main' | 'after';

/**
 * Visible section headings for each editor script group.
 */
export const SCRIPT_EDITOR_GROUP_HEADINGS: Record<ScriptEditorGroup, string> = {
  before: 'Before',
  main: 'Main',
  after: 'After'
};

/**
 * Returns whether the script list editor should show Before/Main/After section headings.
 *
 * Headings appear only when scripts span two or more non-empty groups.
 *
 * @param groups - Before, main, and after script groups from the editor.
 * @returns True when multiple non-empty groups should show section labels.
 */
export function shouldShowScriptSectionHeadings(groups: {
  before: unknown[];
  main: unknown[];
  after: unknown[];
}): boolean {
  const nonEmptyCount =
    (groups.before.length > 0 ? 1 : 0) +
    (groups.main.length > 0 ? 1 : 0) +
    (groups.after.length > 0 ? 1 : 0);
  return nonEmptyCount > 1;
}

/**
 * Maps a script stage to its editor list group.
 *
 * @param stage - Script execution stage.
 * @returns Group used for the three-list script editor layout.
 */
export function scriptStageGroup(stage: ScriptStage): ScriptEditorGroup {
  if (stage === 'before-all' || stage === 'before-each') {
    return 'before';
  }
  if (stage === 'after-each' || stage === 'after-all') {
    return 'after';
  }
  return 'main';
}

/**
 * Coerces an unknown value to a valid script stage.
 *
 * @param value - Raw stage from storage or IPC.
 * @returns Valid stage, defaulting to {@link DEFAULT_SCRIPT_STAGE} for legacy rows.
 */
export function normalizeScriptStage(value: unknown): ScriptStage {
  if (typeof value === 'string' && SCRIPT_STAGES.has(value as ScriptStage)) {
    return value as ScriptStage;
  }
  return DEFAULT_SCRIPT_STAGE;
}

/**
 * Returns the display label for a script stage.
 *
 * @param stage - Script execution stage.
 * @returns Human-readable label for selects and listings.
 */
export function scriptStageLabel(stage: ScriptStage): string {
  return SCRIPT_STAGE_OPTIONS.find((option) => option.value === stage)?.label ?? 'Main';
}

/**
 * Returns the display-only suffix appended to script row titles in the list editor.
 *
 * Not persisted on {@link ScriptRef} names — only clarifies timing for before/after stages.
 *
 * @param stage - Script execution stage.
 * @returns Title-case suffix such as ` (Before Each)`, or an empty string for `main`.
 */
export function scriptRowStageSuffix(stage: ScriptStage): string {
  switch (stage) {
    case 'before-all':
      return ' (Before All)';
    case 'before-each':
      return ' (Before Each)';
    case 'after-all':
      return ' (After All)';
    case 'after-each':
      return ' (After Each)';
    default:
      return '';
  }
}

/**
 * Returns the theme CSS variable for a script row's stage-colored left border.
 *
 * @param stage - Script execution stage.
 * @returns `var(--mac-script-stage-*)` token for inline border styling.
 */
export function scriptStageBorderColor(stage: ScriptStage): string {
  switch (stage) {
    case 'before-all':
      return 'var(--mac-script-stage-before-all)';
    case 'before-each':
      return 'var(--mac-script-stage-before-each)';
    case 'after-all':
      return 'var(--mac-script-stage-after-all)';
    case 'after-each':
      return 'var(--mac-script-stage-after-each)';
    default:
      return 'var(--mac-script-stage-main)';
  }
}

/**
 * Reorders script references into execution order for one phase list.
 *
 * Order: all `before-all`, then for each `main` script all `before-each`, the main
 * script, and all `after-each`, then all `after-all`. Relative order within each
 * stage is preserved from the stored list.
 *
 * @param refs - Normalized script references for one phase.
 * @returns References ordered for send-time execution.
 */
export function orderScriptRefsByStage<T extends { stage?: ScriptStage }>(refs: T[]): T[] {
  const beforeAll: T[] = [];
  const beforeEach: T[] = [];
  const mainScripts: T[] = [];
  const afterEach: T[] = [];
  const afterAll: T[] = [];

  for (const ref of refs) {
    const stage = readScriptRefStage(ref);
    switch (stage) {
      case 'before-all':
        beforeAll.push(ref);
        break;
      case 'before-each':
        beforeEach.push(ref);
        break;
      case 'after-each':
        afterEach.push(ref);
        break;
      case 'after-all':
        afterAll.push(ref);
        break;
      default:
        mainScripts.push(ref);
        break;
    }
  }

  const ordered: T[] = [...beforeAll];

  if (mainScripts.length === 0) {
    return [...ordered, ...afterAll];
  }

  for (const mainScript of mainScripts) {
    ordered.push(...beforeEach, mainScript, ...afterEach);
  }

  ordered.push(...afterAll);
  return ordered;
}

/**
 * Splits script references into the three editor groups while preserving list order.
 *
 * @param refs - Normalized script references for one phase.
 * @returns Before, main, and after groups for the script list editor.
 */
export function splitScriptRefsByGroup<T extends { stage?: ScriptStage }>(
  refs: T[]
): { before: T[]; main: T[]; after: T[] } {
  const before: T[] = [];
  const main: T[] = [];
  const after: T[] = [];

  for (const ref of refs) {
    const group = scriptStageGroup(readScriptRefStage(ref));
    if (group === 'before') {
      before.push(ref);
    } else if (group === 'after') {
      after.push(ref);
    } else {
      main.push(ref);
    }
  }

  return { before, main, after };
}

/**
 * Concatenates editor groups back into canonical stored order.
 *
 * @param groups - Before, main, and after script groups from the editor.
 * @returns Combined script reference list for persistence.
 */
export function mergeScriptRefGroups<T>(groups: { before: T[]; main: T[]; after: T[] }): T[] {
  return [...groups.before, ...groups.main, ...groups.after];
}

/**
 * Reads a script reference stage, accepting legacy `role` JSON keys.
 *
 * @param ref - Script reference or legacy-shaped object from storage.
 * @returns Normalized script stage.
 */
export function readScriptRefStage(ref: { stage?: ScriptStage; role?: unknown }): ScriptStage {
  return normalizeScriptStage(ref.stage ?? ref.role);
}
