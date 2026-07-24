import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllImportHandlersForTests,
  clearPluginImportHandlers,
  getRegisteredImportExtensions,
  normalizeImportExtension,
  normalizeImportExtensions,
  registerBridgedImportHandler,
  registerImportHandlerContribution,
  runPluginImportHandlers,
  unregisterBridgedImportHandler
} from './pluginImportHandlers';
import type { ImportFile } from '#/shared/plugin/importHandlers';

const sampleFile: ImportFile = {
  name: 'petstore.yaml',
  path: '/tmp/petstore.yaml',
  extension: '.yaml',
  contents: 'openapi: 3.0.3'
};

const invokePluginImportHandlerMock =
  vi.fn<
    (
      pluginId: string,
      registrationId: string,
      phase: 'canImport' | 'import',
      file: ImportFile
    ) => Promise<unknown>
  >();

beforeEach(() => {
  invokePluginImportHandlerMock.mockReset();
  vi.stubGlobal('window', {
    api: {
      invokePluginImportHandler: invokePluginImportHandlerMock
    }
  });
});

afterEach(() => {
  clearAllImportHandlersForTests();
  vi.unstubAllGlobals();
});

describe('normalizeImportExtension', () => {
  it('normalizes extensions with or without a leading dot', () => {
    expect(normalizeImportExtension('json')).toBe('.json');
    expect(normalizeImportExtension('.YAML')).toBe('.yaml');
  });
});

describe('normalizeImportExtensions', () => {
  it('deduplicates normalized extensions', () => {
    expect(normalizeImportExtensions(['json', '.JSON', 'yaml'])).toEqual(['.json', '.yaml']);
  });
});

describe('registerImportHandlerContribution', () => {
  it('registers extensions and removes the handler on dispose', () => {
    const disposable = registerImportHandlerContribution('com.example.a', ['.yaml'], {
      canImport: () => true,
      import: async () => {}
    });

    expect(getRegisteredImportExtensions()).toEqual(['yaml']);

    disposable.dispose();
    expect(getRegisteredImportExtensions()).toEqual([]);
  });
});

describe('registerBridgedImportHandler', () => {
  it('registers bridged metadata and removes it on unregister', () => {
    registerBridgedImportHandler('com.example.a', '1', ['.yaml']);
    expect(getRegisteredImportExtensions()).toEqual(['yaml']);

    unregisterBridgedImportHandler('com.example.a', '1');
    expect(getRegisteredImportExtensions()).toEqual([]);
  });
});

describe('clearPluginImportHandlers', () => {
  it('removes local and bridged handlers for one plugin id', () => {
    registerImportHandlerContribution('com.example.a', ['.yaml'], {
      canImport: () => true,
      import: async () => {}
    });
    registerBridgedImportHandler('com.example.a', '1', ['.json']);
    registerBridgedImportHandler('com.example.b', '2', ['.yaml']);

    clearPluginImportHandlers('com.example.a');

    expect(getRegisteredImportExtensions()).toEqual(['yaml']);
  });
});

describe('runPluginImportHandlers', () => {
  it('runs the first matching handler in registration order', async () => {
    const firstImport = vi.fn(async () => {});
    const secondImport = vi.fn(async () => {});

    registerImportHandlerContribution('com.example.a', ['.yaml'], {
      canImport: () => false,
      import: firstImport
    });
    registerImportHandlerContribution('com.example.b', ['.yaml'], {
      canImport: () => true,
      import: secondImport
    });

    await runPluginImportHandlers(sampleFile);

    expect(firstImport).not.toHaveBeenCalled();
    expect(secondImport).toHaveBeenCalledWith(sampleFile);
  });

  it('supports async canImport callbacks', async () => {
    const importMock = vi.fn(async () => {});

    registerImportHandlerContribution('com.example.a', ['.yaml'], {
      canImport: async () => true,
      import: importMock
    });

    await runPluginImportHandlers(sampleFile);
    expect(importMock).toHaveBeenCalledOnce();
  });

  it('invokes bridged handlers through the plugin agent bridge', async () => {
    invokePluginImportHandlerMock.mockResolvedValueOnce(true).mockResolvedValueOnce(undefined);

    registerBridgedImportHandler('com.example.openapi', '7', ['.yaml']);

    await runPluginImportHandlers(sampleFile);

    expect(invokePluginImportHandlerMock).toHaveBeenNthCalledWith(
      1,
      'com.example.openapi',
      '7',
      'canImport',
      sampleFile
    );
    expect(invokePluginImportHandlerMock).toHaveBeenNthCalledWith(
      2,
      'com.example.openapi',
      '7',
      'import',
      sampleFile
    );
  });

  it('throws when no handler matches the file extension', async () => {
    registerImportHandlerContribution('com.example.a', ['.json'], {
      canImport: () => true,
      import: async () => {}
    });

    await expect(runPluginImportHandlers(sampleFile)).rejects.toThrow(
      'No plugin can import this file.'
    );
  });

  it('throws when no handler accepts the file contents', async () => {
    registerImportHandlerContribution('com.example.a', ['.yaml'], {
      canImport: () => false,
      import: async () => {}
    });

    await expect(runPluginImportHandlers(sampleFile)).rejects.toThrow(
      'No plugin can import this file.'
    );
  });

  it('includes the plugin id when import fails', async () => {
    registerImportHandlerContribution('com.example.a', ['.yaml'], {
      canImport: () => true,
      import: async () => {
        throw new Error('boom');
      }
    });

    await expect(runPluginImportHandlers(sampleFile)).rejects.toThrow(
      'Plugin com.example.a failed to import: boom'
    );
  });
});
