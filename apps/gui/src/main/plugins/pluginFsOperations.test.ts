import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginManager } from './PluginManager';
import { pickFileForPlugin, readFileForPlugin } from './pluginFsOperations';

const showOpenDialog = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null)
  },
  dialog: {
    showOpenDialog: (...args: unknown[]) => showOpenDialog(...args)
  }
}));

describe('pluginFsOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants selected paths from pickFileForPlugin', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/example.env']
    });
    const grantFilesystemPath = vi.fn();
    const pluginManager = {
      grantFilesystemPath
    } as unknown as PluginManager;

    await expect(
      pickFileForPlugin(pluginManager, 'com.harborclient.plugins.dotenv', {
        title: 'Select .env file'
      })
    ).resolves.toEqual(['/tmp/example.env']);

    expect(grantFilesystemPath).toHaveBeenCalledWith(
      'com.harborclient.plugins.dotenv',
      '/tmp/example.env'
    );
  });

  it('reads allowlisted files through readFileForPlugin', () => {
    const reconcileFilesystemGrants = vi.fn();
    const readTextFile = vi.fn(() => 'KEY=value\n');
    const pluginManager = {
      reconcileFilesystemGrants,
      fsAllowlist: { readTextFile }
    } as unknown as PluginManager;

    expect(
      readFileForPlugin(pluginManager, 'com.harborclient.plugins.dotenv', '/tmp/example.env')
    ).toBe('KEY=value\n');

    expect(reconcileFilesystemGrants).toHaveBeenCalledWith('com.harborclient.plugins.dotenv');
    expect(readTextFile).toHaveBeenCalledWith(
      'com.harborclient.plugins.dotenv',
      '/tmp/example.env'
    );
  });
});
