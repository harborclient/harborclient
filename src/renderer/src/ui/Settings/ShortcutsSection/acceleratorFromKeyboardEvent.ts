import { SHIFTED_SYMBOL_TO_DIGIT } from '#/shared/shortcuts';

/**
 * Minimal keyboard event shape used when converting DOM events to accelerators.
 */
export interface KeyboardCaptureInput {
  /** Normalized key value from the keyboard event. */
  key: string;
  /** Whether the control key is pressed. */
  ctrlKey: boolean;
  /** Whether the meta (command) key is pressed. */
  metaKey: boolean;
  /** Whether the alt key is pressed. */
  altKey: boolean;
  /** Whether the shift key is pressed. */
  shiftKey: boolean;
}

const KEY_ALIASES: Record<string, string> = {
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

const NAMED_KEYS = new Set([
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

/**
 * Converts a captured keyboard event into an Electron accelerator string.
 *
 * Returns null when the event should be ignored (modifier-only presses) or when
 * the user presses Escape to cancel recording.
 *
 * @param event - Keyboard event fields from a keydown handler.
 * @returns Electron accelerator string, or null when no binding should be recorded.
 */
export function acceleratorFromKeyboardEvent(event: KeyboardCaptureInput): string | null {
  if (event.key === 'Escape') {
    return null;
  }

  if (
    event.key === 'Control' ||
    event.key === 'Shift' ||
    event.key === 'Alt' ||
    event.key === 'Meta'
  ) {
    return null;
  }

  const key = normalizeCapturedKey(event.key);
  if (key == null) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push('CmdOrCtrl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  parts.push(key);

  return parts.join('+');
}

/**
 * Normalizes a DOM key value to an Electron accelerator key token.
 *
 * @param key - KeyboardEvent.key value.
 * @returns Electron key token or null when unsupported.
 */
function normalizeCapturedKey(key: string): string | null {
  if (/^F([1-9]|1[0-2])$/i.test(key)) {
    return key.toUpperCase();
  }

  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    return key.toUpperCase();
  }

  if (key.length === 1 && /[0-9]/.test(key)) {
    return key;
  }

  const shiftedDigit = SHIFTED_SYMBOL_TO_DIGIT[key];
  if (shiftedDigit != null) {
    return shiftedDigit;
  }

  const alias = KEY_ALIASES[key];
  if (alias != null) {
    return alias;
  }

  if (NAMED_KEYS.has(key)) {
    return key;
  }

  return null;
}
