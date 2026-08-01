import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectronClipboardProvider } from './electronClipboardProvider';

describe('ElectronClipboardProvider', () => {
  const readClipboardText = vi.fn();
  const writeClipboardText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      api: {
        readClipboardText,
        writeClipboardText
      }
    });
  });

  it('reads clipboard text from window.api', () => {
    readClipboardText.mockReturnValue('from-clipboard');
    const provider = new ElectronClipboardProvider();

    expect(provider.readText('c')).toBe('from-clipboard');
    expect(readClipboardText).toHaveBeenCalledOnce();
  });

  it('writes clipboard text through window.api', () => {
    const provider = new ElectronClipboardProvider();

    provider.writeText('c', 'paste-me');

    expect(writeClipboardText).toHaveBeenCalledWith('paste-me');
  });
});
