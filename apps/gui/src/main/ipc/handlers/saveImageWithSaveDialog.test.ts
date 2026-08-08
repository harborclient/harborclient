import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null)
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  net: {
    fetch: vi.fn()
  }
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(async () => undefined)
}));

vi.mock('#/main/ipc/handlers/filePathAccess', () => ({
  grantFilePathAccess: vi.fn((path: string) => path)
}));

import { dialog } from 'electron';
import { writeFile } from 'fs/promises';
import { saveImageWithSaveDialog } from './saveImageWithSaveDialog';

describe('saveImageWithSaveDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a data URL when the user chooses a destination', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: '/tmp/out.png'
    });

    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const result = await saveImageWithSaveDialog({
      dataUrl,
      defaultFileName: 'pixel.png'
    });

    expect(result).toEqual({ canceled: false, path: '/tmp/out.png' });
    expect(writeFile).toHaveBeenCalledWith('/tmp/out.png', expect.any(Buffer));
  });

  it('returns canceled when the save dialog is dismissed', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: true
    } as Electron.SaveDialogReturnValue);

    const result = await saveImageWithSaveDialog({
      dataUrl: 'data:image/png;base64,abc',
      defaultFileName: 'pixel.png'
    });

    expect(result).toEqual({ canceled: true });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('throws when neither url nor dataUrl is provided', async () => {
    await expect(saveImageWithSaveDialog({})).rejects.toThrow(
      'saveImageWithSaveDialog requires a dataUrl or url.'
    );
  });
});
