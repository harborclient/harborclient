import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveImageViewPage } from './saveImageViewPage';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const copyFileToSaveDialogMock =
  vi.fn<
    (sourcePath: string, defaultFileName: string) => Promise<{ canceled: boolean; path?: string }>
  >();
const saveDataUrlToFileMock =
  vi.fn<
    (payload: {
      dataUrl?: string;
      url?: string;
      defaultFileName: string;
    }) => Promise<{ canceled: boolean; path?: string }>
  >();

describe('saveImageViewPage', () => {
  beforeEach(() => {
    copyFileToSaveDialogMock.mockReset();
    saveDataUrlToFileMock.mockReset();
    copyFileToSaveDialogMock.mockResolvedValue({ canceled: false, path: '/tmp/saved.png' });
    saveDataUrlToFileMock.mockResolvedValue({ canceled: false, path: '/tmp/saved.png' });
    vi.stubGlobal('window', {
      api: {
        copyFileToSaveDialog: copyFileToSaveDialogMock,
        saveDataUrlToFile: saveDataUrlToFileMock
      }
    });
  });

  it('copies a local path through the save dialog', async () => {
    await saveImageViewPage({
      type: 'image-view',
      fileName: 'shot.png',
      shortLabel: 'shot.png',
      source: { kind: 'path', path: '/tmp/shot.png' }
    });

    expect(copyFileToSaveDialogMock).toHaveBeenCalledWith('/tmp/shot.png', 'shot.png');
    expect(saveDataUrlToFileMock).not.toHaveBeenCalled();
  });

  it('downloads a URL through the save dialog', async () => {
    await saveImageViewPage({
      type: 'image-view',
      fileName: 'logo.png',
      shortLabel: 'logo.png',
      source: { kind: 'url', url: 'https://example.com/logo.png' }
    });

    expect(saveDataUrlToFileMock).toHaveBeenCalledWith({
      url: 'https://example.com/logo.png',
      defaultFileName: 'logo.png'
    });
  });

  it('writes an inline data URL through the save dialog', async () => {
    const dataUrl = 'data:image/png;base64,abc';

    await saveImageViewPage({
      type: 'image-view',
      fileName: 'inline.png',
      shortLabel: 'inline.png',
      source: { kind: 'data', dataUrl }
    });

    expect(saveDataUrlToFileMock).toHaveBeenCalledWith({
      dataUrl,
      defaultFileName: 'inline.png'
    });
  });
});
