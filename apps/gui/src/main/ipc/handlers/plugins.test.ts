import { describe, expect, it, vi } from 'vitest';
import { Headers } from '@harborclient/http';
import {
  applyPluginAfterScriptsHooks,
  applyPluginAfterSendHooks,
  applyPluginBeforeScriptsHooks,
  logPluginActivationFailureToTerminal,
  mergePluginHttpHeaders,
  parsePluginHookErrorId,
  recordPluginHookFailure,
  sanitizeInjectedScripts,
  setPluginManager
} from './plugins';
import type { PluginInfo } from '@harborclient/core/plugin/types';
import type { PluginManager } from '#/main/plugins/PluginManager';

vi.mock('#/main/plugins/pluginRunnerHost', () => ({
  runPluginAfterSendHooks: vi.fn(),
  runPluginBeforeSendHooks: vi.fn(),
  runPluginBeforeScriptsHooks: vi.fn(),
  runPluginAfterScriptsHooks: vi.fn(),
  activatePluginMain: vi.fn(),
  deactivatePluginMain: vi.fn(),
  invokePluginIpc: vi.fn(),
  isPluginRunnerShuttingDown: vi.fn(() => false)
}));

import {
  runPluginAfterScriptsHooks,
  runPluginAfterSendHooks,
  runPluginBeforeScriptsHooks
} from '#/main/plugins/pluginRunnerHost';

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
    const mutated = { 'Accept': 'application/json', 'X-Plugin-Trace': '1' };

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

describe('sanitizeInjectedScripts', () => {
  it('keeps well-formed rows and drops malformed ones', () => {
    expect(
      sanitizeInjectedScripts([
        {
          uuid: 'a',
          pluginId: 'com.example',
          name: 'Guard',
          stage: 'before-all',
          script: 'console.log(1);'
        },
        { uuid: '', pluginId: 'com.example', script: 'x' },
        { uuid: 'b', pluginId: 'com.example', stage: 'not-a-stage', script: 'ok' }
      ])
    ).toEqual([
      {
        uuid: 'a',
        pluginId: 'com.example',
        name: 'Guard',
        stage: 'before-all',
        script: 'console.log(1);'
      },
      {
        uuid: 'b',
        pluginId: 'com.example',
        name: 'Injected script',
        stage: 'main',
        script: 'ok'
      }
    ]);
  });
});

describe('script injection hooks', () => {
  it('short-circuits before-scripts when no plugin holds scripts:inject', async () => {
    setPluginManager({
      list: () => [{ id: 'com.example.http', enabled: true, permissions: ['http'] }]
    } as unknown as PluginManager);

    const result = await applyPluginBeforeScriptsHooks({
      phase: 'pre',
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: {},
        body: ''
      },
      data: { keep: true }
    });

    expect(result).toEqual({ scripts: [], data: { keep: true } });
    expect(runPluginBeforeScriptsHooks).not.toHaveBeenCalled();
  });

  it('returns sanitized injections when a plugin holds scripts:inject', async () => {
    setPluginManager({
      list: () => [{ id: 'com.example.inject', enabled: true, permissions: ['scripts:inject'] }]
    } as unknown as PluginManager);
    vi.mocked(runPluginBeforeScriptsHooks).mockResolvedValueOnce({
      scripts: [
        {
          uuid: 'inj-1',
          pluginId: 'com.example.inject',
          name: 'Guard',
          stage: 'before-all',
          script: 'hc.execution.skipRequest();'
        }
      ],
      data: { guarded: true }
    });

    const result = await applyPluginBeforeScriptsHooks({
      phase: 'pre',
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: {},
        body: ''
      },
      data: {}
    });

    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0]?.stage).toBe('before-all');
    expect(result.data).toEqual({ guarded: true });
  });

  it('does not throw when after-scripts hooks fail', async () => {
    setPluginManager({
      list: () => [{ id: 'com.example.inject', enabled: true, permissions: ['scripts:inject'] }]
    } as unknown as PluginManager);
    vi.mocked(runPluginAfterScriptsHooks).mockRejectedValueOnce(
      new Error('Plugin com.example.inject: boom')
    );

    await expect(
      applyPluginAfterScriptsHooks({
        phase: 'post',
        data: {},
        tests: [],
        logs: [],
        errors: []
      })
    ).resolves.toBeUndefined();
  });
});

describe('logPluginActivationFailureToTerminal', () => {
  it('writes activation failure details to the main process terminal', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plugin: PluginInfo = {
      id: 'com.example.failed',
      name: 'Failed Plugin',
      version: '1.0.0',
      source: 'installed',
      path: '/tmp/failed-plugin',
      enabled: false,
      permissions: ['ui'],
      manifest: {
        id: 'com.example.failed',
        name: 'Failed Plugin',
        version: '1.0.0',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        permissions: ['ui']
      },
      runtimeError: 'Failed to load plugin module.'
    };

    logPluginActivationFailureToTerminal(
      plugin,
      'Failed to load plugin module.',
      'Failed to fetch dynamically imported module: [blob URL omitted]\nCaused by: SyntaxError: Unexpected token'
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[HarborClient] Plugin activation failed (com.example.failed: Failed Plugin; entries: renderer=dist/renderer.js)',
      'Failed to fetch dynamically imported module: [blob URL omitted]\nCaused by: SyntaxError: Unexpected token',
      '(Settings runtime error: Failed to load plugin module.)'
    );

    consoleErrorSpy.mockRestore();
  });
});
