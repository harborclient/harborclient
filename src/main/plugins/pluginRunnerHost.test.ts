import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  utilityProcess: {
    fork: vi.fn(() => ({
      on: vi.fn(),
      postMessage: vi.fn(),
      kill: vi.fn()
    }))
  }
}));

vi.mock('esbuild', () => ({
  transformSync: vi.fn(() => ({ code: 'module.exports = {};' }))
}));

describe('pluginRunnerHost shutdown', () => {
  it('rejects new work after disposePluginRunner is called', async () => {
    vi.resetModules();
    const { activatePluginMain, disposePluginRunner, PluginRunnerUnavailableError } =
      await import('#/main/plugins/pluginRunnerHost');

    disposePluginRunner();

    await expect(activatePluginMain('test.plugin', 'export {}', [])).rejects.toBeInstanceOf(
      PluginRunnerUnavailableError
    );
  });
});
