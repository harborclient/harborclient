import { describe, expect, it } from 'vitest';
import { mergeLivePageVariables } from './mergeLivePageVariables';

describe('mergeLivePageVariables', () => {
  it('merges distinct keys from both scopes', () => {
    const merged = mergeLivePageVariables(
      [{ key: 'env', value: 'dev', defaultValue: '', enabled: true, share: false }],
      [{ key: 'host', value: 'example.com', defaultValue: '', enabled: true, share: false }]
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((row) => row.key).sort()).toEqual(['env', 'host']);
  });

  it('lets live-page variables override base keys', () => {
    const merged = mergeLivePageVariables(
      [{ key: 'host', value: 'base.example', defaultValue: '', enabled: true, share: false }],
      [{ key: 'host', value: 'live.example', defaultValue: '', enabled: true, share: false }]
    );
    expect(merged).toEqual([
      { key: 'host', value: 'live.example', defaultValue: '', enabled: true, share: false }
    ]);
  });

  it('skips disabled rows', () => {
    const merged = mergeLivePageVariables(
      [{ key: 'a', value: '1', defaultValue: '', enabled: false, share: false }],
      [{ key: 'b', value: '2', defaultValue: '', enabled: true, share: false }]
    );
    expect(merged).toEqual([
      { key: 'b', value: '2', defaultValue: '', enabled: true, share: false }
    ]);
  });
});
