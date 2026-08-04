import { describe, expect, it } from 'vitest';
import { electronAcceleratorToGameShortcut } from './electronAcceleratorToGameShortcut';

describe('electronAcceleratorToGameShortcut', () => {
  it('maps CmdOrCtrl to ctrl on Linux', () => {
    expect(electronAcceleratorToGameShortcut('CmdOrCtrl+S', 'linux')).toBe('ctrl+s');
  });

  it('maps CmdOrCtrl to meta on macOS', () => {
    expect(electronAcceleratorToGameShortcut('CmdOrCtrl+S', 'darwin')).toBe('meta+s');
  });

  it('maps named Electron keys to DOM key tokens', () => {
    expect(electronAcceleratorToGameShortcut('CmdOrCtrl+Shift+Comma', 'linux')).toBe(
      'ctrl+shift+,'
    );
    expect(electronAcceleratorToGameShortcut('Alt+Left', 'linux')).toBe('alt+left');
    expect(electronAcceleratorToGameShortcut('F5', 'linux')).toBe('f5');
  });

  it('returns null for empty accelerators', () => {
    expect(electronAcceleratorToGameShortcut('', 'linux')).toBeNull();
    expect(electronAcceleratorToGameShortcut('   ', 'win32')).toBeNull();
  });

  it('normalizes modifier order', () => {
    expect(electronAcceleratorToGameShortcut('Shift+Alt+Ctrl+P', 'linux')).toBe('ctrl+alt+shift+p');
  });
});
