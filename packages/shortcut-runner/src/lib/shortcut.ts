const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'] as const;

type Modifier = (typeof MODIFIER_ORDER)[number];

const MODIFIER_ALIASES: Record<string, Modifier> = {
  alt: 'alt',
  option: 'alt',
  ctrl: 'ctrl',
  control: 'ctrl',
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  super: 'meta',
  shift: 'shift',
  win: 'meta',
  windows: 'meta'
};

const KEY_ALIASES: Record<string, string> = {
  ' ': 'space',
  'arrowdown': 'down',
  'arrowleft': 'left',
  'arrowright': 'right',
  'arrowup': 'up',
  'del': 'delete',
  'esc': 'escape',
  'plus': '+',
  'return': 'enter',
  'spacebar': 'space'
};

/**
 * US QWERTY characters produced while Shift is held, mapped back to the
 * unshifted key token stored in shortcuts (for example `>` → `.`).
 *
 * Used when `KeyboardEvent.code` is unavailable so Shift+punctuation still
 * matches accelerators like `ctrl+shift+.`.
 */
const SHIFTED_CHAR_TO_BASE: Record<string, string> = {
  '~': '`',
  '!': '1',
  '@': '2',
  '#': '3',
  '$': '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0',
  '_': '-',
  '+': '=',
  '{': '[',
  '}': ']',
  '|': '\\',
  ':': ';',
  '"': "'",
  '<': ',',
  '>': '.',
  '?': '/'
};

/**
 * Physical `KeyboardEvent.code` values mapped to the unshifted game key token.
 *
 * Preferring `code` over `key` avoids Shift turning `.` into `>` (and similar
 * digit-row / punctuation pairs) when matching stored shortcuts.
 */
const CODE_TO_KEY: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'space',
  Enter: 'enter',
  Escape: 'escape',
  Backspace: 'backspace',
  Delete: 'delete',
  Tab: 'tab',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Insert: 'insert'
};

const DISPLAY_NAMES: Record<string, string> = {
  alt: 'Alt',
  backspace: 'Backspace',
  delete: 'Delete',
  down: '↓',
  end: 'End',
  enter: 'Enter',
  escape: 'Esc',
  home: 'Home',
  insert: 'Insert',
  left: '←',
  meta: 'Meta',
  pagedown: 'Page Down',
  pageup: 'Page Up',
  right: '→',
  shift: 'Shift',
  space: 'Space',
  tab: 'Tab',
  up: '↑'
};

/**
 * Minimal keyboard event shape used when converting DOM events to shortcuts.
 */
export interface ShortcutKeyboardEvent {
  /** Whether the Alt key is pressed. */
  altKey: boolean;
  /**
   * Physical key code from the DOM event (for example `Period`, `Digit1`).
   * When present, preferred over `key` so Shift does not rewrite the token.
   */
  code?: string;
  /** Whether the Control key is pressed. */
  ctrlKey: boolean;
  /** Logical key value from the keyboard event. */
  key: string;
  /** Whether the Meta (Command) key is pressed. */
  metaKey: boolean;
  /** Whether the Shift key is pressed. */
  shiftKey: boolean;
}

/**
 * Normalizes a key name token for comparison and storage.
 *
 * @param value - Raw key token from a shortcut string or keyboard event.
 * @returns Lowercased canonical key name.
 */
function normalizeKeyName(value: string): string {
  const key = value.trim().toLowerCase();
  return KEY_ALIASES[key] ?? key;
}

/**
 * Resolves a game key token from a physical `KeyboardEvent.code` value.
 *
 * @param code - DOM / Electron physical key code.
 * @returns Unshifted key token, or null when the code is unsupported.
 */
function keyFromCode(code: string): string | null {
  const letterMatch = /^Key([A-Z])$/.exec(code);
  const letter = letterMatch?.[1];
  if (letter != null) {
    return letter.toLowerCase();
  }

  const digitMatch = /^Digit([0-9])$/.exec(code);
  const digit = digitMatch?.[1];
  if (digit != null) {
    return digit;
  }

  if (/^F([1-9]|1[0-2])$/.test(code)) {
    return code.toLowerCase();
  }

  return CODE_TO_KEY[code] ?? null;
}

/**
 * Resolves the non-modifier key for a keyboard event.
 *
 * Prefers the physical `code` so Shift+`.` reports as `.` (matching stored
 * shortcuts) rather than the shifted character `>`. Falls back to unwinding
 * common US shifted characters when `code` is missing.
 *
 * @param event - Keyboard event fields from a keydown handler.
 * @returns Canonical key token before alias normalization.
 */
function resolveEventKey(event: ShortcutKeyboardEvent): string {
  if (event.code != null && event.code.length > 0) {
    const fromCode = keyFromCode(event.code);
    if (fromCode != null) {
      return fromCode;
    }
  }

  if (event.shiftKey) {
    const base = SHIFTED_CHAR_TO_BASE[event.key];
    if (base != null) {
      return base;
    }
  }

  return event.key;
}

/**
 * Normalizes a shortcut string into a stable `mod+mod+key` form.
 *
 * @param shortcut - User or config shortcut such as `Ctrl+Shift+.`.
 * @returns Canonical lowercase shortcut used for equality checks.
 */
export function normalizeShortcut(shortcut: string): string {
  const tokens = shortcut
    .split('+')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const modifiers = new Set<Modifier>();
  let key = '';

  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES[token];
    if (modifier) {
      modifiers.add(modifier);
    } else {
      key = normalizeKeyName(token);
    }
  }

  return [
    ...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
    ...(key ? [key] : [])
  ].join('+');
}

/**
 * Converts a keyboard event into a normalized shortcut string.
 *
 * Returns null for modifier-only presses. Uses the physical key code when
 * available so holding Shift does not change punctuation/digit tokens
 * (for example Shift+`.` stays `.`, not `>`).
 *
 * @param event - Keyboard event fields from a keydown handler.
 * @returns Normalized shortcut such as `ctrl+shift+.`, or null when ignored.
 */
export function keyboardEventToShortcut(event: ShortcutKeyboardEvent): string | null {
  const rawKey = event.key.toLowerCase();
  if (rawKey === 'control' || rawKey === 'alt' || rawKey === 'shift' || rawKey === 'meta') {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');
  parts.push(normalizeKeyName(resolveEventKey(event)));

  return normalizeShortcut(parts.join('+'));
}

/**
 * Detects whether the current runtime is a macOS / iOS browser.
 *
 * @returns True when `navigator.platform` looks like Apple.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

/**
 * Formats a single normalized key token for on-screen display.
 *
 * @param key - Canonical key token such as `ctrl` or `.`.
 * @param mac - Whether to use macOS modifier glyphs.
 * @returns Human-readable label for the key.
 */
function formatKey(key: string, mac: boolean): string {
  if (key === 'ctrl') return mac ? '⌃' : 'Ctrl';
  if (key === 'alt') return mac ? '⌥' : 'Alt';
  if (key === 'shift') return mac ? '⇧' : 'Shift';
  if (key === 'meta') return mac ? '⌘' : 'Meta';
  if (/^f\d{1,2}$/.test(key)) return key.toUpperCase();
  if (key.length === 1) return key.toUpperCase();
  return DISPLAY_NAMES[key] ?? key.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

/**
 * Splits a shortcut into display labels for the current platform.
 *
 * @param shortcut - Shortcut string such as `ctrl+shift+.`.
 * @returns Ordered display tokens (modifiers then key).
 */
export function displayShortcut(shortcut: string): string[] {
  const mac = isMacPlatform();
  return normalizeShortcut(shortcut)
    .split('+')
    .filter(Boolean)
    .map((key) => formatKey(key, mac));
}
