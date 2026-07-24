/**
 * Default stage for script rows and snippets without an explicit stage.
 */
export const DEFAULT_SCRIPT_STAGE = 'main';
/**
 * Select options for script stage fields in editors and modals.
 */
export const SCRIPT_STAGE_OPTIONS = [
    { value: 'before-all', label: 'Before all' },
    { value: 'before-each', label: 'Before each' },
    { value: 'main', label: 'Main' },
    { value: 'after-each', label: 'After each' },
    { value: 'after-all', label: 'After all' }
];
const SCRIPT_STAGES = new Set(SCRIPT_STAGE_OPTIONS.map((option) => option.value));
/**
 * Visible section headings for each editor script group.
 */
export const SCRIPT_EDITOR_GROUP_HEADINGS = {
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
export function shouldShowScriptSectionHeadings(groups) {
    const nonEmptyCount = (groups.before.length > 0 ? 1 : 0) +
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
export function scriptStageGroup(stage) {
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
export function normalizeScriptStage(value) {
    if (typeof value === 'string' && SCRIPT_STAGES.has(value)) {
        return value;
    }
    return DEFAULT_SCRIPT_STAGE;
}
/**
 * Returns the display label for a script stage.
 *
 * @param stage - Script execution stage.
 * @returns Human-readable label for selects and listings.
 */
export function scriptStageLabel(stage) {
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
export function scriptRowStageSuffix(stage) {
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
export function scriptStageBorderColor(stage) {
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
export function orderScriptRefsByStage(refs) {
    const beforeAll = [];
    const beforeEach = [];
    const mainScripts = [];
    const afterEach = [];
    const afterAll = [];
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
    const ordered = [...beforeAll];
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
export function splitScriptRefsByGroup(refs) {
    const before = [];
    const main = [];
    const after = [];
    for (const ref of refs) {
        const group = scriptStageGroup(readScriptRefStage(ref));
        if (group === 'before') {
            before.push(ref);
        }
        else if (group === 'after') {
            after.push(ref);
        }
        else {
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
export function mergeScriptRefGroups(groups) {
    return [...groups.before, ...groups.main, ...groups.after];
}
/**
 * Reads a script reference stage, accepting legacy `role` JSON keys.
 *
 * @param ref - Script reference or legacy-shaped object from storage.
 * @returns Normalized script stage.
 */
export function readScriptRefStage(ref) {
    return normalizeScriptStage(ref.stage ?? ref.role);
}
//# sourceMappingURL=scriptStage.js.map