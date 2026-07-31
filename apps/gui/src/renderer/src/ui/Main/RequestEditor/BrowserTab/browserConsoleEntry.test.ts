import { describe, expect, it, vi } from 'vitest';
import type { BrowserConsoleEntryPayload } from '@harborclient/core/types';
import {
  consoleEntryFromBrowserPayload,
  resolveBrowserConsoleRequestName
} from './browserConsoleEntry';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { createBrowserTab } from '#/renderer/src/store/tabs';

/**
 * Builds a minimal browser console IPC payload for tests.
 *
 * @param overrides - Partial payload fields to merge.
 * @returns Complete payload.
 */
function samplePayload(
  overrides: Partial<BrowserConsoleEntryPayload> = {}
): BrowserConsoleEntryPayload {
  return {
    tabId: 'browser-1',
    result: {
      status: 200,
      statusText: 'Example Domain',
      headers: { 'content-type': 'text/html' },
      body: '<html></html>',
      timeMs: 42,
      sizeBytes: 13,
      request: {
        method: 'GET',
        url: 'https://example.com/',
        headers: {},
        body: '',
        bodyType: 'none'
      }
    },
    ...overrides
  };
}

describe('resolveBrowserConsoleRequestName', () => {
  it('prefers the browser tab title', () => {
    const tab: BrowserTab = { ...createBrowserTab(), title: 'My Site' };
    expect(resolveBrowserConsoleRequestName(tab, samplePayload())).toBe('My Site');
  });

  it('falls back to statusText then URL', () => {
    expect(resolveBrowserConsoleRequestName(undefined, samplePayload())).toBe('Example Domain');
    expect(
      resolveBrowserConsoleRequestName(
        undefined,
        samplePayload({
          result: {
            ...samplePayload().result,
            statusText: 'OK'
          }
        })
      )
    ).toBe('https://example.com/');
  });
});

describe('consoleEntryFromBrowserPayload', () => {
  it('maps payload fields onto a ConsoleEntry', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'entry-id' });
    const tab = createBrowserTab({ tabId: 'browser-1' });
    tab.title = 'Docs';
    const entry = consoleEntryFromBrowserPayload(
      samplePayload({
        logs: [{ message: 'hi', level: 'log', method: 'log', scriptName: 'Setup' }],
        scriptError: 'Setup: fail'
      }),
      tab
    );

    expect(entry).toMatchObject({
      id: 'entry-id',
      requestName: 'Docs',
      requestTabId: 'browser-1',
      logs: [{ message: 'hi', level: 'log', method: 'log', scriptName: 'Setup' }],
      scriptError: 'Setup: fail',
      result: expect.objectContaining({
        status: 200,
        timeMs: 42
      })
    });
    vi.unstubAllGlobals();
  });
});
