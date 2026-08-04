import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, Input } from 'electron';

vi.mock('#/main/settings/shortcutSettings', () => ({
  getShortcutOverrides: () => ({})
}));

vi.mock('#/main/window/zoom', () => ({
  stepZoomIn: vi.fn(),
  stepZoomOut: vi.fn(),
  resetZoom: vi.fn()
}));

/**
 * Builds a minimal Electron Input for shortcut matching tests.
 *
 * @param overrides - Fields to merge onto a keyDown baseline.
 * @returns Input-like object for tryDispatchActionShortcut.
 */
function makeInput(overrides: Partial<Input>): Input {
  return {
    type: 'keyDown',
    key: '',
    code: '',
    isAutoRepeat: false,
    shift: false,
    control: false,
    alt: false,
    meta: false,
    ...overrides
  } as Input;
}

describe('tryDispatchActionShortcut', () => {
  it('dispatches menu:action save for Ctrl+S', async () => {
    const { tryDispatchActionShortcut } = await import('./shortcutDispatch');
    const send = vi.fn();
    const window = {
      webContents: { send }
    } as unknown as BrowserWindow;

    const matched = tryDispatchActionShortcut(
      window,
      makeInput({ key: 's', code: 'KeyS', control: true })
    );

    expect(matched).toBe(true);
    expect(send).toHaveBeenCalledWith('menu:action', 'save');
  });

  it('returns false for unmatched chords', async () => {
    const { tryDispatchActionShortcut } = await import('./shortcutDispatch');
    const send = vi.fn();
    const window = {
      webContents: { send }
    } as unknown as BrowserWindow;

    const matched = tryDispatchActionShortcut(window, makeInput({ key: 'a', code: 'KeyA' }));

    expect(matched).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores auto-repeat keydowns', async () => {
    const { tryDispatchActionShortcut } = await import('./shortcutDispatch');
    const send = vi.fn();
    const window = {
      webContents: { send }
    } as unknown as BrowserWindow;

    const matched = tryDispatchActionShortcut(
      window,
      makeInput({ key: 's', code: 'KeyS', control: true, isAutoRepeat: true })
    );

    expect(matched).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores chords while shortcut capture is paused', async () => {
    const { setShortcutCapturePaused, tryDispatchActionShortcut } =
      await import('./shortcutDispatch');
    const send = vi.fn();
    const window = {
      webContents: { send }
    } as unknown as BrowserWindow;

    setShortcutCapturePaused(true);
    try {
      const matched = tryDispatchActionShortcut(
        window,
        makeInput({ key: 's', code: 'KeyS', control: true })
      );
      expect(matched).toBe(false);
      expect(send).not.toHaveBeenCalled();
    } finally {
      setShortcutCapturePaused(false);
    }
  });
});
