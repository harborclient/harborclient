import { describe, expect, it, vi } from 'vitest';
import { Headers } from '#/main/http/Headers';
import {
  applyPluginAfterSendHooks,
  mergePluginHttpHeaders,
  parsePluginHookErrorId,
  recordPluginHookFailure,
  setPluginManager
} from '#/main/ipc/handlers/plugins';
import type { PluginManager } from '#/main/plugins/PluginManager';

vi.mock('#/main/plugins/pluginRunnerHost', () => ({
  runPluginAfterSendHooks: vi.fn(),
  runPluginBeforeSendHooks: vi.fn(),
  activatePluginMain: vi.fn(),
  deactivatePluginMain: vi.fn(),
  invokePluginIpc: vi.fn()
}));

import { runPluginAfterSendHooks } from '#/main/plugins/pluginRunnerHost';

describe('mergePluginHttpHeaders', () => {
  it('disables enabled headers removed by a plugin hook', () => {
    const original = [{ key: 'Authorization', value: 'Bearer secret', enabled: true }];
    const mutated = {};

    const headers = mergePluginHttpHeaders(original, mutated);

    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer secret', enabled: false }]);
    const built = new Headers().build(headers, 'none');
    expect(built).toEqual({ ok: true, headers: {} });
  });

  it('updates header values from the hook result', () => {
    const original = [{ key: 'X-Trace', value: '0', enabled: true }];
    const mutated = { 'X-Trace': '1' };

    const headers = mergePluginHttpHeaders(original, mutated);

    expect(headers).toEqual([{ key: 'X-Trace', value: '1', enabled: true }]);
  });

  it('appends headers added by a plugin hook', () => {
    const original = [{ key: 'Accept', value: 'application/json', enabled: true }];
    const mutated = { Accept: 'application/json', 'X-Plugin-Trace': '1' };

    const headers = mergePluginHttpHeaders(original, mutated);

    expect(headers).toEqual([
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: 'X-Plugin-Trace', value: '1', enabled: true }
    ]);
  });

  it('matches header keys case-insensitively when syncing deletions', () => {
    const original = [{ key: 'Authorization', value: 'Bearer secret', enabled: true }];
    const mutated = {};

    const headers = mergePluginHttpHeaders(original, mutated);

    expect(headers[0]?.enabled).toBe(false);
  });

  it('leaves originally disabled headers unchanged when absent from the hook result', () => {
    const original = [{ key: 'X-Legacy', value: 'keep', enabled: false }];
    const mutated = {};

    const headers = mergePluginHttpHeaders(original, mutated);

    expect(headers).toEqual([{ key: 'X-Legacy', value: 'keep', enabled: false }]);
  });

  it('appends a new enabled row when a plugin adds a header that exists disabled', () => {
    const original = [{ key: 'X-Custom', value: 'old', enabled: false }];
    const mutated = { 'X-Custom': 'new' };

    const headers = mergePluginHttpHeaders(original, mutated);

    expect(headers).toEqual([
      { key: 'X-Custom', value: 'old', enabled: false },
      { key: 'X-Custom', value: 'new', enabled: true }
    ]);
    const built = new Headers().build(headers, 'none');
    expect(built).toEqual({ ok: true, headers: { 'X-Custom': 'new' } });
  });
});

describe('plugin hook failures', () => {
  it('parses plugin ids from hook error messages', () => {
    expect(
      parsePluginHookErrorId(new Error('Plugin com.example.hook: TextEncoder is missing'))
    ).toBe('com.example.hook');
    expect(parsePluginHookErrorId(new Error('Something else'))).toBeUndefined();
  });

  it('records hook failures on the plugin manager', () => {
    const setRuntimeError = vi.fn();
    setPluginManager({ setRuntimeError } as unknown as PluginManager);

    recordPluginHookFailure(new Error('Plugin com.example.hook: TextEncoder is missing'));

    expect(setRuntimeError).toHaveBeenCalledWith(
      'com.example.hook',
      'Plugin com.example.hook: TextEncoder is missing'
    );
  });

  it('does not throw when after-send hooks fail', async () => {
    vi.mocked(runPluginAfterSendHooks).mockRejectedValueOnce(
      new Error('Plugin com.example.hook: TextEncoder is missing')
    );

    await expect(
      applyPluginAfterSendHooks(
        {
          method: 'GET',
          url: 'https://example.com',
          headers: [],
          params: [],
          body: '',
          bodyType: 'none'
        },
        {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: ''
        }
      )
    ).resolves.toBeUndefined();
  });
});
