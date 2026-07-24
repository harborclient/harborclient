import { describe, expect, it } from 'vitest';

import { buildSendRuntimeVars, resolveRequestUrl } from './resolveRequestUrl';

describe('buildSendRuntimeVars', () => {
  it('merges globals, collection, and environment with environment winning duplicates', () => {
    expect(
      buildSendRuntimeVars(
        [{ key: 'host', value: 'global.example', defaultValue: '', share: false }],
        [{ key: 'host', value: 'collection.example', defaultValue: '', share: false }],
        [{ key: 'host', value: 'env.example', defaultValue: '', share: false }]
      )
    ).toEqual({
      host: 'env.example'
    });
  });
});

describe('resolveRequestUrl', () => {
  it('substitutes static variables in the URL', () => {
    expect(
      resolveRequestUrl('https://{{baseUrl}}/api', [], {
        baseUrl: 'example.com'
      })
    ).toBe('https://example.com/api');
  });

  it('substitutes variables in enabled query params and merges them into the URL', () => {
    expect(
      resolveRequestUrl(
        'https://example.com/search',
        [{ key: 'q', value: '{{query}}', enabled: true }],
        {
          query: 'hello world'
        }
      )
    ).toBe('https://example.com/search?q=hello+world');
  });

  it('resolves dynamic variables when no runtime value is defined', () => {
    const result = resolveRequestUrl('https://example.com/{{$timestamp}}', [], {});
    expect(result).toMatch(/^https:\/\/example\.com\/\d+$/);
  });

  it('skips disabled params', () => {
    expect(
      resolveRequestUrl(
        'https://example.com',
        [
          { key: 'enabled', value: '1', enabled: true },
          { key: 'disabled', value: '2', enabled: false }
        ],
        {}
      )
    ).toBe('https://example.com/?enabled=1');
  });
});
