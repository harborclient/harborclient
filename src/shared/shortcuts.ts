import type { MenuActionId } from '#/shared/types/app';

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
  | 'team-hubs'
  | 'sharing-keys'
  | 'import'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'toggle-sidebar'
  | 'focus-sidebar-search'
  | 'toggle-ai-sidebar'
  | 'toggle-collections-section'
  | 'toggle-environments-section'
  | 'send-request'
  | 'previous-request-tab'
  | 'next-request-tab'
  | 'toggle-fullscreen'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset-zoom'
  | 'documentation'
  | 'report-issue'
  | 'check-for-updates'
  | 'about';

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
export const SHORTCUT_DEFS: ShortcutDef[] = [
  {
    id: 'new-request',
    label: 'New request',
    defaultAccelerator: 'CmdOrCtrl+N',
    kind: 'action',
    actionId: 'new-request'
  },
  {
    id: 'new-collection',
    label: 'New collection',
    defaultAccelerator: 'CmdOrCtrl+Shift+N',
    kind: 'action',
    actionId: 'new-collection'
  },
  {
    id: 'sync',
    label: 'Sync storage',
    defaultAccelerator: 'CmdOrCtrl+Shift+S',
    kind: 'action',
    actionId: 'sync'
  },
  {
    id: 'save',
    label: 'Save request',
    defaultAccelerator: 'CmdOrCtrl+S',
    kind: 'action',
    actionId: 'save'
  },
  {
    id: 'settings',
    label: 'Settings',
    defaultAccelerator: 'CmdOrCtrl+,',
    kind: 'action',
    actionId: 'settings'
  },
  {
    id: 'plugins',
    label: 'Plugins',
    defaultAccelerator: 'CmdOrCtrl+Shift+P',
    kind: 'action',
    actionId: 'plugins'
  },
  {
    id: 'team-hubs',
    label: 'Team Hub',
    defaultAccelerator: 'CmdOrCtrl+Shift+H',
    kind: 'action',
    actionId: 'team-hubs'
  },
  {
    id: 'sharing-keys',
    label: 'Sharing Keys',
    defaultAccelerator: 'CmdOrCtrl+Shift+K',
    kind: 'action',
    actionId: 'sharing-keys'
  },
  {
    id: 'import',
    label: 'Import',
    defaultAccelerator: 'CmdOrCtrl+Shift+I',
    kind: 'action',
    actionId: 'import'
  },
  {
    id: 'undo',
    label: 'Undo',
    defaultAccelerator: 'CmdOrCtrl+Z',
    kind: 'role',
    role: 'undo'
  },
  {
    id: 'redo',
    label: 'Redo',
    defaultAccelerator: 'CmdOrCtrl+Shift+Z',
    kind: 'role',
    role: 'redo'
  },
  {
    id: 'cut',
    label: 'Cut',
    defaultAccelerator: 'CmdOrCtrl+X',
    kind: 'role',
    role: 'cut'
  },
  {
    id: 'copy',
    label: 'Copy',
    defaultAccelerator: 'CmdOrCtrl+C',
    kind: 'role',
    role: 'copy'
  },
  {
    id: 'paste',
    label: 'Paste',
    defaultAccelerator: 'CmdOrCtrl+V',
    kind: 'role',
    role: 'paste'
  },
  {
    id: 'select-all',
    label: 'Select all',
    defaultAccelerator: 'CmdOrCtrl+A',
    kind: 'role',
    role: 'selectAll'
  },
  {
    id: 'toggle-sidebar',
    label: 'Toggle sidebar',
    defaultAccelerator: 'CmdOrCtrl+B',
    kind: 'action',
    actionId: 'toggle-sidebar'
  },
  {
    id: 'focus-sidebar-search',
    label: 'Focus sidebar search',
    defaultAccelerator: 'CmdOrCtrl+F',
    kind: 'action',
    actionId: 'focus-sidebar-search'
  },
  {
    id: 'toggle-ai-sidebar',
    label: 'Toggle agent chat',
    defaultAccelerator: 'CmdOrCtrl+Shift+B',
    kind: 'action',
    actionId: 'toggle-ai-sidebar'
  },
  {
    id: 'toggle-collections-section',
    label: 'Toggle collections section',
    defaultAccelerator: 'CmdOrCtrl+Shift+C',
    kind: 'action',
    actionId: 'toggle-collections-section'
  },
  {
    id: 'toggle-environments-section',
    label: 'Toggle environments section',
    defaultAccelerator: 'CmdOrCtrl+Shift+E',
    kind: 'action',
    actionId: 'toggle-environments-section'
  },
  {
    id: 'send-request',
    label: 'Send request',
    defaultAccelerator: 'F5',
    kind: 'action',
    actionId: 'send-request'
  },
  {
    id: 'previous-request-tab',
    label: 'Previous request tab',
    defaultAccelerator: 'CmdOrCtrl+Shift+Comma',
    kind: 'action',
    actionId: 'previous-request-tab'
  },
  {
    id: 'next-request-tab',
    label: 'Next request tab',
    defaultAccelerator: 'CmdOrCtrl+Shift+Period',
    kind: 'action',
    actionId: 'next-request-tab'
  },
  {
    id: 'toggle-fullscreen',
    label: 'Toggle full screen',
    defaultAccelerator: 'F11',
    kind: 'role',
    role: 'togglefullscreen'
  },
  {
    id: 'zoom-in',
    label: 'Zoom in',
    defaultAccelerator: 'CmdOrCtrl+Plus',
    kind: 'role',
    role: 'zoomIn'
  },
  {
    id: 'zoom-out',
    label: 'Zoom out',
    defaultAccelerator: 'CmdOrCtrl+-',
    kind: 'role',
    role: 'zoomOut'
  },
  {
    id: 'reset-zoom',
    label: 'Reset zoom',
    defaultAccelerator: 'CmdOrCtrl+0',
    kind: 'role',
    role: 'resetZoom'
  },
  {
    id: 'documentation',
    label: 'Documentation',
    defaultAccelerator: 'CmdOrCtrl+Shift+D',
    kind: 'action',
    actionId: 'documentation'
  },
  {
    id: 'report-issue',
    label: 'Report issue',
    defaultAccelerator: 'CmdOrCtrl+Shift+R',
    kind: 'action',
    actionId: 'report-issue'
  },
  {
    id: 'check-for-updates',
    label: 'Check for updates',
    defaultAccelerator: 'CmdOrCtrl+Shift+U',
    kind: 'action',
    actionId: 'check-for-updates'
  },
  {
    id: 'about',
    label: 'About',
    defaultAccelerator: 'CmdOrCtrl+Shift+A',
    kind: 'action',
    actionId: 'about'
  }
];

const SHORTCUT_DEF_BY_ID = new Map(SHORTCUT_DEFS.map((def) => [def.id, def]));

/**
 * Returns the shortcut definition for an id, if known.
 *
 * @param id - Shortcut identifier.
 * @returns Matching definition or undefined.
 */
export function getShortcutDef(id: ShortcutId): ShortcutDef | undefined {
  return SHORTCUT_DEF_BY_ID.get(id);
}

/**
 * Normalizes persisted shortcut overrides by dropping unknown ids and invalid values.
 *
 * @param raw - Raw value from storage or IPC input.
 * @returns Sanitized override map.
 */
export function normalizeShortcutOverrides(raw: unknown): ShortcutOverrides {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }

  const result: ShortcutOverrides = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!SHORTCUT_DEF_BY_ID.has(key as ShortcutId)) {
      continue;
    }
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      continue;
    }
    result[key as ShortcutId] = trimmed;
  }
  return result;
}

/**
 * Merges defaults with user overrides into resolved shortcut bindings.
 *
 * @param overrides - User overrides keyed by shortcut id.
 * @returns Resolved bindings in registry order.
 */
export function resolveShortcuts(overrides: ShortcutOverrides): ShortcutBinding[] {
  return SHORTCUT_DEFS.map((def) => {
    const override = overrides[def.id];
    const accelerator =
      override != null && override.trim().length > 0 ? override.trim() : def.defaultAccelerator;
    return {
      id: def.id,
      label: def.label,
      accelerator,
      defaultAccelerator: def.defaultAccelerator
    };
  });
}

/**
 * Builds a lookup map from shortcut id to effective accelerator.
 *
 * @param overrides - User overrides keyed by shortcut id.
 * @returns Map of shortcut id to accelerator string.
 */
export function resolveAcceleratorMap(overrides: ShortcutOverrides): Map<ShortcutId, string> {
  return new Map(resolveShortcuts(overrides).map((binding) => [binding.id, binding.accelerator]));
}

/**
 * Converts resolved bindings to a persisted override map (non-default values only).
 *
 * @param bindings - Resolved shortcut bindings.
 * @returns Overrides containing only values that differ from defaults.
 */
export function bindingsToOverrides(bindings: ShortcutBinding[]): ShortcutOverrides {
  const overrides: ShortcutOverrides = {};
  for (const binding of bindings) {
    if (binding.accelerator !== binding.defaultAccelerator) {
      overrides[binding.id] = binding.accelerator;
    }
  }
  return overrides;
}

/**
 * Normalizes an accelerator string for duplicate comparison.
 *
 * @param accelerator - Electron accelerator string.
 * @returns Lowercase normalized accelerator.
 */
function normalizeAcceleratorKey(accelerator: string): string {
  return accelerator.trim().toLowerCase();
}

/**
 * Returns true when an accelerator includes a modifier or is a standalone function key.
 *
 * @param accelerator - Electron accelerator string.
 * @returns Whether the accelerator is allowed without conflicting with plain typing.
 */
function hasRequiredModifier(accelerator: string): boolean {
  const parts = accelerator.split('+').map((part) => part.trim());
  if (parts.length === 0) {
    return false;
  }

  const key = parts[parts.length - 1] ?? '';
  if (parts.length === 1 && /^F([1-9]|1[0-2])$/i.test(key)) {
    return true;
  }

  const modifiers = parts.slice(0, -1);
  return modifiers.some((part) =>
    /^(CmdOrCtrl|Alt|Shift|Cmd|Ctrl|Meta|Command|Control)$/i.test(part)
  );
}

/**
 * Returns true when the accelerator matches Electron's expected token pattern.
 *
 * @param accelerator - Electron accelerator string.
 * @returns Whether the accelerator appears well-formed.
 */
function isValidAccelerator(accelerator: string): boolean {
  const trimmed = accelerator.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const parts = trimmed.split('+').map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) {
    return false;
  }

  const key = parts[parts.length - 1] ?? '';
  if (/^F([1-9]|1[0-2])$/i.test(key)) {
    return true;
  }

  if (/^[A-Za-z0-9]$/.test(key)) {
    return true;
  }

  const namedKeys = new Set([
    'Plus',
    'Minus',
    'Equal',
    'Comma',
    'Period',
    'Slash',
    'Backslash',
    'Backquote',
    'BracketLeft',
    'BracketRight',
    'Semicolon',
    'Quote',
    'Space',
    'Tab',
    'Enter',
    'Escape',
    'Backspace',
    'Delete',
    'Up',
    'Down',
    'Left',
    'Right',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    ',',
    '-',
    '+',
    '.',
    '/',
    '\\',
    '`',
    '[',
    ']',
    ';',
    "'"
  ]);

  return namedKeys.has(key);
}

/**
 * Validates shortcut overrides for shape, modifier requirements, and conflicts.
 *
 * @param overrides - User overrides keyed by shortcut id.
 * @returns Validation result with per-shortcut error messages.
 */
export function validateShortcutOverrides(overrides: ShortcutOverrides): ShortcutValidationResult {
  const bindings = resolveShortcuts(overrides);
  const errors: Partial<Record<ShortcutId, string>> = {};
  const byAccelerator = new Map<string, ShortcutId[]>();

  for (const binding of bindings) {
    if (!isValidAccelerator(binding.accelerator)) {
      errors[binding.id] = 'Invalid key combination.';
      continue;
    }

    if (!hasRequiredModifier(binding.accelerator)) {
      errors[binding.id] = 'Include a modifier key (Ctrl, Alt, or Shift) or use a function key.';
      continue;
    }

    const normalized = normalizeAcceleratorKey(binding.accelerator);
    const existing = byAccelerator.get(normalized) ?? [];
    existing.push(binding.id);
    byAccelerator.set(normalized, existing);
  }

  for (const ids of byAccelerator.values()) {
    if (ids.length <= 1) {
      continue;
    }
    for (const id of ids) {
      errors[id] = 'This key combination is already assigned to another shortcut.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Formats an Electron accelerator for display in the settings table.
 *
 * @param accelerator - Electron accelerator string.
 * @returns Human-readable accelerator such as `ctrl+s`.
 */
export function formatAcceleratorDisplay(accelerator: string): string {
  const keyDisplayNames: Record<string, string> = {
    Plus: 'plus',
    Minus: 'minus',
    Equal: 'equal',
    Comma: 'comma',
    Period: 'period',
    ',': 'comma',
    '-': 'minus',
    '+': 'plus'
  };

  return accelerator
    .replace(/CmdOrCtrl/gi, 'ctrl')
    .replace(/CommandOrControl/gi, 'ctrl')
    .replace(/Command/gi, 'cmd')
    .replace(/Control/gi, 'ctrl')
    .replace(/Cmd/gi, 'cmd')
    .replace(/Meta/gi, 'cmd')
    .replace(/Alt/gi, 'alt')
    .replace(/Shift/gi, 'shift')
    .split('+')
    .map((part) => {
      const trimmed = part.trim();
      const mapped = keyDisplayNames[trimmed] ?? keyDisplayNames[trimmed.toLowerCase()];
      return (mapped ?? trimmed).toLowerCase();
    })
    .join('-');
}

/**
 * Modifier and key state from an Electron `before-input-event` or DOM keyboard event.
 */
export interface KeyChord {
  /** Normalized key value (for example `F5`, `f`, `,`). */
  key: string;
  /** Whether the control key is pressed. */
  control: boolean;
  /** Whether the meta (command) key is pressed. */
  meta: boolean;
  /** Whether the alt key is pressed. */
  alt: boolean;
  /** Whether the shift key is pressed. */
  shift: boolean;
}

const CHORD_KEY_ALIASES: Record<string, string> = {
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  '\\': 'Backslash',
  '`': 'Backquote',
  '-': 'Minus',
  '=': 'Equal',
  '+': 'Plus',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  ';': 'Semicolon',
  "'": 'Quote',
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right'
};

const CHORD_NAMED_KEYS = new Set([
  'Enter',
  'Backspace',
  'Delete',
  'Tab',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape'
]);

const KEY_COMPARE_ALIASES: Record<string, string> = {
  Plus: 'plus',
  Minus: 'minus',
  Equal: 'equal',
  Comma: 'comma',
  Period: 'period',
  Slash: 'slash',
  Backslash: 'backslash',
  Backquote: 'backquote',
  BracketLeft: 'bracketleft',
  BracketRight: 'bracketright',
  Semicolon: 'semicolon',
  Quote: 'quote',
  Space: 'space',
  Tab: 'tab',
  Enter: 'enter',
  Escape: 'escape',
  Backspace: 'backspace',
  Delete: 'delete',
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  ',': 'comma',
  '.': 'period',
  '/': 'slash',
  '\\': 'backslash',
  '`': 'backquote',
  '-': 'minus',
  '=': 'equal',
  '+': 'plus',
  '[': 'bracketleft',
  ']': 'bracketright',
  ';': 'semicolon',
  "'": 'quote',
  ' ': 'space'
};

/**
 * Normalizes a DOM or Electron key value to an Electron accelerator key token.
 *
 * @param key - Key value from a keyboard or before-input event.
 * @returns Electron key token or null when unsupported.
 */
function normalizeChordKey(key: string): string | null {
  if (/^F([1-9]|1[0-2])$/i.test(key)) {
    return key.toUpperCase();
  }

  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    return key.toUpperCase();
  }

  if (key.length === 1 && /[0-9]/.test(key)) {
    return key;
  }

  const alias = CHORD_KEY_ALIASES[key];
  if (alias != null) {
    return alias;
  }

  if (CHORD_NAMED_KEYS.has(key)) {
    return key;
  }

  return null;
}

/**
 * Builds an Electron accelerator string from a key chord.
 *
 * @param chord - Modifier and key state from a keyboard event.
 * @returns Electron accelerator string, or null when the chord should be ignored.
 */
export function acceleratorFromChord(chord: KeyChord): string | null {
  if (
    chord.key === 'Control' ||
    chord.key === 'Shift' ||
    chord.key === 'Alt' ||
    chord.key === 'Meta'
  ) {
    return null;
  }

  const key = normalizeChordKey(chord.key);
  if (key == null) {
    return null;
  }

  const parts: string[] = [];
  if (chord.control || chord.meta) {
    parts.push('CmdOrCtrl');
  }
  if (chord.alt) {
    parts.push('Alt');
  }
  if (chord.shift) {
    parts.push('Shift');
  }
  parts.push(key);

  return parts.join('+');
}

/**
 * Maps an accelerator modifier token to a canonical compare token.
 *
 * @param part - Modifier segment from an accelerator string.
 * @returns Canonical modifier token, or null when the segment is not a modifier.
 */
function normalizeModifierForCompare(part: string): string | null {
  if (/^(CmdOrCtrl|CommandOrControl|Command|Control|Cmd|Ctrl|Meta)$/i.test(part)) {
    return 'mod';
  }

  if (/^Alt$/i.test(part)) {
    return 'alt';
  }

  if (/^Shift$/i.test(part)) {
    return 'shift';
  }

  return null;
}

/**
 * Maps an accelerator key token to a canonical compare token.
 *
 * @param key - Key segment from an accelerator string.
 * @returns Lowercase canonical key token for comparison.
 */
function normalizeKeyTokenForCompare(key: string): string {
  const trimmed = key.trim();

  if (/^F([1-9]|1[0-2])$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (/^[A-Za-z0-9]$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const mapped =
    KEY_COMPARE_ALIASES[trimmed] ??
    KEY_COMPARE_ALIASES[trimmed.toLowerCase()] ??
    trimmed.toLowerCase();
  return mapped;
}

/**
 * Canonicalizes an Electron accelerator for chord comparison.
 *
 * Modifiers collapse to sorted `alt`, `mod`, and `shift` tokens so stored
 * accelerators match chords regardless of Cmd vs Ctrl spelling.
 *
 * @param accelerator - Electron accelerator string.
 * @returns Canonical compare string such as `mod+shift+comma`.
 */
export function normalizeAcceleratorForCompare(accelerator: string): string {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return '';
  }

  const key = parts[parts.length - 1] ?? '';
  const modifiers: string[] = [];

  for (const part of parts.slice(0, -1)) {
    const normalized = normalizeModifierForCompare(part);
    if (normalized != null) {
      modifiers.push(normalized);
    }
  }

  modifiers.sort();

  return [...modifiers, normalizeKeyTokenForCompare(key)].join('+');
}

/**
 * Returns true when a keyboard chord matches a configured accelerator.
 *
 * @param accelerator - Electron accelerator string from shortcut settings.
 * @param chord - Modifier and key state from a keyboard event.
 * @returns Whether the chord triggers the accelerator.
 */
export function acceleratorMatchesChord(accelerator: string, chord: KeyChord): boolean {
  const derived = acceleratorFromChord(chord);
  if (derived == null) {
    return false;
  }

  return normalizeAcceleratorForCompare(accelerator) === normalizeAcceleratorForCompare(derived);
}
