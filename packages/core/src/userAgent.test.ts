import { describe, expect, it } from 'vitest';
import {
  appendCustomUserAgent,
  applyUserAgentHeader,
  BUILTIN_USER_AGENT_PRESETS,
  DEFAULT_USER_AGENT,
  hasManualUserAgentHeader,
  listUserAgentPresets,
  normalizeCustomUserAgents,
  resolveEffectiveUserAgent
} from './userAgent';

describe('normalizeCustomUserAgents', () => {
  it('drops builtins, blanks, and duplicates', () => {
    expect(
      normalizeCustomUserAgents([
        DEFAULT_USER_AGENT,
        '  Custom/1.0  ',
        'custom/1.0',
        '',
        12,
        'Another/2.0'
      ])
    ).toEqual(['Custom/1.0', 'Another/2.0']);
  });
});

describe('listUserAgentPresets', () => {
  it('lists builtins before customs', () => {
    expect(listUserAgentPresets(['Custom/1.0'])).toEqual([
      ...BUILTIN_USER_AGENT_PRESETS,
      'Custom/1.0'
    ]);
  });
});

describe('appendCustomUserAgent', () => {
  it('appends unknown values and ignores builtins', () => {
    expect(appendCustomUserAgent([], DEFAULT_USER_AGENT)).toEqual([]);
    expect(appendCustomUserAgent([], 'Custom/1.0')).toEqual(['Custom/1.0']);
    expect(appendCustomUserAgent(['Custom/1.0'], 'Custom/1.0')).toEqual(['Custom/1.0']);
  });
});

describe('hasManualUserAgentHeader', () => {
  it('detects enabled non-empty User-Agent rows case-insensitively', () => {
    expect(
      hasManualUserAgentHeader([{ key: 'User-Agent', value: 'Manual/1', enabled: true }])
    ).toBe(true);
    expect(
      hasManualUserAgentHeader([{ key: 'user-agent', value: 'Manual/1', enabled: false }])
    ).toBe(false);
    expect(hasManualUserAgentHeader([{ key: 'User-Agent', value: '  ', enabled: true }])).toBe(
      false
    );
  });
});

describe('resolveEffectiveUserAgent', () => {
  it('resolves request → folder → collection → general', () => {
    expect(
      resolveEffectiveUserAgent({
        request: 'Req',
        folder: 'Folder',
        collection: 'Coll',
        general: DEFAULT_USER_AGENT
      })
    ).toBe('Req');
    expect(
      resolveEffectiveUserAgent({
        request: '',
        folder: 'Folder',
        collection: 'Coll',
        general: DEFAULT_USER_AGENT
      })
    ).toBe('Folder');
    expect(
      resolveEffectiveUserAgent({
        request: '',
        folder: '',
        collection: 'Coll',
        general: DEFAULT_USER_AGENT
      })
    ).toBe('Coll');
    expect(
      resolveEffectiveUserAgent({
        request: '',
        folder: '',
        collection: '',
        general: DEFAULT_USER_AGENT
      })
    ).toBe(DEFAULT_USER_AGENT);
    expect(resolveEffectiveUserAgent({ general: '' })).toBeNull();
  });
});

describe('applyUserAgentHeader', () => {
  it('injects when no manual header exists', () => {
    expect(applyUserAgentHeader([], { general: DEFAULT_USER_AGENT })).toEqual([
      { key: 'User-Agent', value: DEFAULT_USER_AGENT, enabled: true }
    ]);
  });

  it('skips injection when a key/value User-Agent is present', () => {
    const headers = [{ key: 'user-agent', value: 'Manual/1', enabled: true }];
    expect(applyUserAgentHeader(headers, { general: DEFAULT_USER_AGENT })).toBe(headers);
  });

  it('does nothing when no scope resolves a value', () => {
    expect(applyUserAgentHeader([], { general: '' })).toEqual([]);
  });
});
