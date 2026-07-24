import type { ScriptStage } from '@harborclient/sdk';
/**
 * Default stage for script rows and snippets without an explicit stage.
 */
export declare const DEFAULT_SCRIPT_STAGE: ScriptStage;
/**
 * Select options for script stage fields in editors and modals.
 */
export declare const SCRIPT_STAGE_OPTIONS: {
    value: ScriptStage;
    label: string;
}[];
/**
 * Visual and drag-reorder grouping for script stages in the script list editor.
 */
export type ScriptEditorGroup = 'before' | 'main' | 'after';
/**
 * Visible section headings for each editor script group.
 */
export declare const SCRIPT_EDITOR_GROUP_HEADINGS: Record<ScriptEditorGroup, string>;
/**
 * Returns whether the script list editor should show Before/Main/After section headings.
 *
 * Headings appear only when scripts span two or more non-empty groups.
 *
 * @param groups - Before, main, and after script groups from the editor.
 * @returns True when multiple non-empty groups should show section labels.
 */
export declare function shouldShowScriptSectionHeadings(groups: {
    before: unknown[];
    main: unknown[];
    after: unknown[];
}): boolean;
/**
 * Maps a script stage to its editor list group.
 *
 * @param stage - Script execution stage.
 * @returns Group used for the three-list script editor layout.
 */
export declare function scriptStageGroup(stage: ScriptStage): ScriptEditorGroup;
/**
 * Coerces an unknown value to a valid script stage.
 *
 * @param value - Raw stage from storage or IPC.
 * @returns Valid stage, defaulting to {@link DEFAULT_SCRIPT_STAGE} for legacy rows.
 */
export declare function normalizeScriptStage(value: unknown): ScriptStage;
/**
 * Returns the display label for a script stage.
 *
 * @param stage - Script execution stage.
 * @returns Human-readable label for selects and listings.
 */
export declare function scriptStageLabel(stage: ScriptStage): string;
/**
 * Returns the display-only suffix appended to script row titles in the list editor.
 *
 * Not persisted on {@link ScriptRef} names — only clarifies timing for before/after stages.
 *
 * @param stage - Script execution stage.
 * @returns Title-case suffix such as ` (Before Each)`, or an empty string for `main`.
 */
export declare function scriptRowStageSuffix(stage: ScriptStage): string;
/**
 * Returns the theme CSS variable for a script row's stage-colored left border.
 *
 * @param stage - Script execution stage.
 * @returns `var(--mac-script-stage-*)` token for inline border styling.
 */
export declare function scriptStageBorderColor(stage: ScriptStage): string;
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
export declare function orderScriptRefsByStage<T extends {
    stage?: ScriptStage;
}>(refs: T[]): T[];
/**
 * Splits script references into the three editor groups while preserving list order.
 *
 * @param refs - Normalized script references for one phase.
 * @returns Before, main, and after groups for the script list editor.
 */
export declare function splitScriptRefsByGroup<T extends {
    stage?: ScriptStage;
}>(refs: T[]): {
    before: T[];
    main: T[];
    after: T[];
};
/**
 * Concatenates editor groups back into canonical stored order.
 *
 * @param groups - Before, main, and after script groups from the editor.
 * @returns Combined script reference list for persistence.
 */
export declare function mergeScriptRefGroups<T>(groups: {
    before: T[];
    main: T[];
    after: T[];
}): T[];
/**
 * Reads a script reference stage, accepting legacy `role` JSON keys.
 *
 * @param ref - Script reference or legacy-shaped object from storage.
 * @returns Normalized script stage.
 */
export declare function readScriptRefStage(ref: {
    stage?: ScriptStage;
    role?: unknown;
}): ScriptStage;
//# sourceMappingURL=scriptStage.d.ts.map