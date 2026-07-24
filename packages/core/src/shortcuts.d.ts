import type { MenuActionId } from './types/app';
/**
 * Identifiers for user-configurable keyboard shortcuts.
 */
export type ShortcutId =
  | 'new-request'
  | 'new-collection'
  | 'sync'
  | 'save'
  | 'settings'
  | 'plugins'
  | 'themes'
  | 'snippets'
  | 'team-hubs'
  | 'accept-team-hub-invite'
  | 'sharing-keys'
  | 'join-shared-collection'
  | 'import'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'toggle-sidebar'
  | 'focus-sidebar-search'
  | 'focus-request-url'
  | 'focus-first-collection'
  | 'focus-first-environment'
  | 'focus-first-request-tab'
  | 'focus-response-editor'
  | 'focus-main-nav'
  | 'next-sidebar-list-item'
  | 'previous-sidebar-list-item'
  | 'toggle-variables'
  | 'toggle-console'
  | 'toggle-ai-sidebar'
  | 'toggle-git-sidebar'
  | 'toggle-request-editor'
  | 'toggle-response-editor'
  | 'toggle-collections-section'
  | 'toggle-environments-section'
  | 'toggle-run-results-section'
  | 'send-request'
  | 'previous-request-tab'
  | 'next-request-tab'
  | 'set-method-get'
  | 'set-method-post'
  | 'set-method-put'
  | 'set-method-patch'
  | 'set-method-delete'
  | 'set-method-head'
  | 'set-method-options'
  | 'toggle-fullscreen'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset-zoom'
  | 'documentation'
  | 'report-issue'
  | 'check-for-updates'
  | 'about'
  | 'shortcuts-reference'
  | 'action-menu'
  | 'new-collection-git'
  | 'git-create-branch'
  | 'git-delete-branch'
  | 'git-commit'
  | 'git-merge'
  | 'git-fetch'
  | 'git-pull'
  | 'git-push'
  | 'git-settings';
/**
 * Electron menu role names used by built-in shortcuts.
 */
export type ShortcutRole =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'togglefullscreen'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom';
/**
 * Definition of a configurable shortcut in the central registry.
 */
export interface ShortcutDef {
  /** Stable shortcut identifier. */
  id: ShortcutId;
  /** User-facing label shown in the settings table. */
  label: string;
  /** Default Electron accelerator string. */
  defaultAccelerator: string;
  /** Whether the shortcut dispatches a custom menu action or uses an Electron role. */
  kind: 'action' | 'role';
  /** Custom menu action id when `kind` is `action`. */
  actionId?: MenuActionId;
  /** Electron menu role when `kind` is `role`. */
  role?: ShortcutRole;
  /**
   * When true, the main process does not dispatch this shortcut; the renderer
   * handles it with context-sensitive logic (for example sidebar list navigation).
   */
  rendererOnly?: boolean;
}
/**
 * Persisted user overrides keyed by shortcut id.
 */
export type ShortcutOverrides = Partial<Record<ShortcutId, string>>;
/**
 * Resolved shortcut binding returned to the renderer and used when building menus.
 */
export interface ShortcutBinding {
  /** Stable shortcut identifier. */
  id: ShortcutId;
  /** User-facing label. */
  label: string;
  /** Effective accelerator after applying overrides. */
  accelerator: string;
  /** Default accelerator from the registry. */
  defaultAccelerator: string;
}
/**
 * Validation result for shortcut override maps.
 */
export interface ShortcutValidationResult {
  /** True when all bindings are valid and non-conflicting. */
  valid: boolean;
  /** Per-shortcut error messages keyed by shortcut id. */
  errors: Partial<Record<ShortcutId, string>>;
}
/**
 * Canonical list of configurable shortcuts in display order.
 */
export declare const SHORTCUT_DEFS: ShortcutDef[];
/**
 * Returns the shortcut definition for an id, if known.
 *
 * @param id - Shortcut identifier.
 * @returns Matching definition or undefined.
 */
export declare function getShortcutDef(id: ShortcutId): ShortcutDef | undefined;
/**
 * Normalizes persisted shortcut overrides by dropping unknown ids and invalid values.
 *
 * @param raw - Raw value from storage or IPC input.
 * @returns Sanitized override map.
 */
export declare function normalizeShortcutOverrides(raw: unknown): ShortcutOverrides;
/**
 * Merges defaults with user overrides into resolved shortcut bindings.
 *
 * @param overrides - User overrides keyed by shortcut id.
 * @returns Resolved bindings in registry order.
 */
export declare function resolveShortcuts(overrides: ShortcutOverrides): ShortcutBinding[];
/**
 * Builds a lookup map from shortcut id to effective accelerator.
 *
 * @param overrides - User overrides keyed by shortcut id.
 * @returns Map of shortcut id to accelerator string.
 */
export declare function resolveAcceleratorMap(
  overrides: ShortcutOverrides
): Map<ShortcutId, string>;
/**
 * Converts resolved bindings to a persisted override map (non-default values only).
 *
 * @param bindings - Resolved shortcut bindings.
 * @returns Overrides containing only values that differ from defaults.
 */
export declare function bindingsToOverrides(bindings: ShortcutBinding[]): ShortcutOverrides;
/**
 * Validates shortcut overrides for shape, modifier requirements, and conflicts.
 *
 * @param overrides - User overrides keyed by shortcut id.
 * @returns Validation result with per-shortcut error messages.
 */
export declare function validateShortcutOverrides(
  overrides: ShortcutOverrides
): ShortcutValidationResult;
/**
 * Formats an Electron accelerator for display in the settings table.
 *
 * @param accelerator - Electron accelerator string.
 * @returns Human-readable accelerator such as `ctrl+s`.
 */
export declare function formatAcceleratorDisplay(accelerator: string): string;
/**
 * Formats an Electron accelerator for display beside application menu items.
 *
 * Maps `CmdOrCtrl` to `Cmd` on macOS and `Ctrl` on Windows and Linux so custom
 * in-app menus show the same labels users expect from native OS menus.
 *
 * @param accelerator - Electron accelerator string.
 * @param platform - Node.js platform from `process.platform`.
 * @returns Human-readable accelerator such as `Ctrl+Shift+N` or `Cmd+,`.
 */
export declare function formatMenuAcceleratorDisplay(
  accelerator: string,
  platform: NodeJS.Platform
): string;
/**
 * Modifier and key state from an Electron `before-input-event` or DOM keyboard event.
 */
export interface KeyChord {
  /** Normalized key value (for example `F5`, `f`, `,`). */
  key: string;
  /**
   * Physical key code from Electron or DOM (for example `KeyO`, `Digit1`).
   * Used when Alt or layout changes make `key` an unmapped character.
   */
  code?: string;
  /** Whether the control key is pressed. */
  control: boolean;
  /** Whether the meta (command) key is pressed. */
  meta: boolean;
  /** Whether the alt key is pressed. */
  alt: boolean;
  /** Whether the shift key is pressed. */
  shift: boolean;
}
/**
 * US keyboard shifted digit-row symbols mapped to their base digit tokens.
 *
 * Shift+1 reports as `!` in DOM and Electron key events, but accelerators store
 * the unshifted digit when Shift is a modifier (e.g. `Alt+Shift+1`).
 */
export declare const SHIFTED_SYMBOL_TO_DIGIT: Record<string, string>;
/**
 * Builds an Electron accelerator string from a key chord.
 *
 * @param chord - Modifier and key state from a keyboard event.
 * @returns Electron accelerator string, or null when the chord should be ignored.
 */
export declare function acceleratorFromChord(chord: KeyChord): string | null;
/**
 * Canonicalizes an Electron accelerator for chord comparison.
 *
 * Modifiers collapse to sorted `alt`, `mod`, and `shift` tokens so stored
 * accelerators match chords regardless of Cmd vs Ctrl spelling.
 *
 * @param accelerator - Electron accelerator string.
 * @returns Canonical compare string such as `mod+shift+comma`.
 */
export declare function normalizeAcceleratorForCompare(accelerator: string): string;
/**
 * Returns true when a keyboard chord matches a configured accelerator.
 *
 * @param accelerator - Electron accelerator string from shortcut settings.
 * @param chord - Modifier and key state from a keyboard event.
 * @returns Whether the chord triggers the accelerator.
 */
export declare function acceleratorMatchesChord(accelerator: string, chord: KeyChord): boolean;
//# sourceMappingURL=shortcuts.d.ts.map
