/**
 * Maps Electron accelerator key tokens to the key names produced by the
 * shortcut-runner game's `keyboardEventToShortcut` helper.
 */
const ELECTRON_KEY_TO_GAME: Record<string, string> = {
  Plus: '+',
  Minus: '-',
  equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
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
  Return: 'enter',
  Esc: 'escape',
  Del: 'delete'
};

/**
 * Converts an Electron accelerator string into a shortcut-runner game shortcode.
 *
 * Resolves `CmdOrCtrl` for the current platform and maps named Electron keys
 * (Comma, Left, Plus, …) to the tokens the game matches from DOM keyboard events.
 *
 * @param accelerator - Electron accelerator such as `CmdOrCtrl+Shift+Comma`.
 * @param platform - Host platform (`darwin` uses Meta for CmdOrCtrl).
 * @returns Normalized game shortcode such as `ctrl+shift+,`, or null when empty.
 */
export function electronAcceleratorToGameShortcut(
  accelerator: string,
  platform: NodeJS.Platform
): string | null {
  const trimmed = accelerator.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const cmdOrCtrl = platform === 'darwin' ? 'meta' : 'ctrl';
  const parts = trimmed
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const modifiers: string[] = [];
  let key = '';

  for (const part of parts) {
    if (/^(CmdOrCtrl|CommandOrControl)$/i.test(part)) {
      modifiers.push(cmdOrCtrl);
      continue;
    }
    if (/^(Command|Cmd|Meta)$/i.test(part)) {
      modifiers.push('meta');
      continue;
    }
    if (/^(Control|Ctrl)$/i.test(part)) {
      modifiers.push('ctrl');
      continue;
    }
    if (/^Alt$/i.test(part)) {
      modifiers.push('alt');
      continue;
    }
    if (/^Shift$/i.test(part)) {
      modifiers.push('shift');
      continue;
    }

    const mapped = ELECTRON_KEY_TO_GAME[part] ?? ELECTRON_KEY_TO_GAME[part.toLowerCase()];
    key = (mapped ?? part).toLowerCase();
  }

  if (key.length === 0) {
    return null;
  }

  const order = ['ctrl', 'alt', 'shift', 'meta'] as const;
  const uniqueMods = order.filter((modifier) => modifiers.includes(modifier));
  return [...uniqueMods, key].join('+');
}
