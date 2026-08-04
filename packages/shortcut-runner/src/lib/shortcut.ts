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
  windows: 'meta',
};

const KEY_ALIASES: Record<string, string> = {
  ' ': 'space',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  del: 'delete',
  esc: 'escape',
  plus: '+',
  return: 'enter',
  spacebar: 'space',
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
  up: '↑',
};

export interface ShortcutKeyboardEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

function normalizeKeyName(value: string): string {
  const key = value.trim().toLowerCase();
  return KEY_ALIASES[key] ?? key;
}

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
    ...(key ? [key] : []),
  ].join('+');
}

export function keyboardEventToShortcut(
  event: ShortcutKeyboardEvent,
): string | null {
  const rawKey = event.key.toLowerCase();
  if (rawKey === 'control' || rawKey === 'alt' || rawKey === 'shift' || rawKey === 'meta') {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');
  parts.push(normalizeKeyName(event.key));

  return normalizeShortcut(parts.join('+'));
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

function formatKey(key: string, mac: boolean): string {
  if (key === 'ctrl') return mac ? '⌃' : 'Ctrl';
  if (key === 'alt') return mac ? '⌥' : 'Alt';
  if (key === 'shift') return mac ? '⇧' : 'Shift';
  if (key === 'meta') return mac ? '⌘' : 'Meta';
  if (/^f\d{1,2}$/.test(key)) return key.toUpperCase();
  if (key.length === 1) return key.toUpperCase();
  return DISPLAY_NAMES[key] ?? key.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function displayShortcut(shortcut: string): string[] {
  const mac = isMacPlatform();
  return normalizeShortcut(shortcut)
    .split('+')
    .filter(Boolean)
    .map((key) => formatKey(key, mac));
}
