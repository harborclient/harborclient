import { describe, expect, it } from 'vitest';
import {
  appendCustomUserAgent,
  applyUserAgentHeader,
  BUILTIN_USER_AGENT_PRESETS,
  buildHarborClientUserAgent,
  DEFAULT_USER_AGENT,
  hasManualUserAgentHeader,
  LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT,
  listUserAgentPresets,
  normalizeCustomUserAgents,
  resolveEffectiveUserAgent
} from './userAgent';

describe('BUILTIN_USER_AGENT_PRESETS', () => {
  it('does not include the HarborClient or legacy static strings', () => {
    expect(BUILTIN_USER_AGENT_PRESETS).not.toContain(DEFAULT_USER_AGENT);
    expect(BUILTIN_USER_AGENT_PRESETS).not.toContain(LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT);
    expect(BUILTIN_USER_AGENT_PRESETS).toHaveLength(5);
  });
});

describe('buildHarborClientUserAgent', () => {
  it('builds a Windows x64 User-Agent', () => {
    expect(
      buildHarborClientUserAgent({
        appVersion: '2.6.0',
        platform: 'win32',
        arch: 'x64',
        osRelease: '10.0.22631',
        electronVersion: '39.0.0',
        chromeVersion: '140.0.0.0'
      })
    ).toBe(
      'HarborClient/2.6.0 (Windows NT 10.0.22631; Win64; x64) Electron/39.0.0 Chrome/140.0.0.0'
    );
  });

  it('builds a Windows ARM64 User-Agent', () => {
    expect(
      buildHarborClientUserAgent({
        appVersion: '2.6.0',
        platform: 'win32',
        arch: 'arm64',
        osRelease: '10.0.22631',
        electronVersion: '39.0.0',
        chromeVersion: '140.0.0.0'
      })
    ).toBe('HarborClient/2.6.0 (Windows NT 10.0.22631; ARM64) Electron/39.0.0 Chrome/140.0.0.0');
  });

  it('builds a macOS Intel User-Agent from systemVersion', () => {
    expect(
      buildHarborClientUserAgent({
        appVersion: '2.6.0',
        platform: 'darwin',
        arch: 'x64',
        osRelease: '23.6.0',
        electronVersion: '39.0.0',
        chromeVersion: '140.0.0.0',
        systemVersion: '14.6.1'
      })
    ).toBe(
      'HarborClient/2.6.0 (Macintosh; Intel Mac OS X 14_6_1) Electron/39.0.0 Chrome/140.0.0.0'
    );
  });

  it('builds a macOS ARM User-Agent', () => {
    expect(
      buildHarborClientUserAgent({
        appVersion: '2.6.0',
        platform: 'darwin',
        arch: 'arm64',
        osRelease: '24.0.0',
        electronVersion: '39.0.0',
        chromeVersion: '140.0.0.0',
        systemVersion: '15.0'
      })
    ).toBe('HarborClient/2.6.0 (Macintosh; ARM Mac OS X 15_0) Electron/39.0.0 Chrome/140.0.0.0');
  });

  it('builds a Linux x86_64 User-Agent', () => {
    expect(
      buildHarborClientUserAgent({
        appVersion: '2.6.0',
        platform: 'linux',
        arch: 'x64',
        osRelease: '6.8.0',
        electronVersion: '39.0.0',
        chromeVersion: '140.0.0.0'
      })
    ).toBe('HarborClient/2.6.0 (X11; Linux x86_64) Electron/39.0.0 Chrome/140.0.0.0');
  });

  it('builds a Linux aarch64 User-Agent', () => {
    expect(
      buildHarborClientUserAgent({
        appVersion: '2.6.0',
        platform: 'linux',
        arch: 'arm64',
        osRelease: '6.8.0',
        electronVersion: '39.0.0',
        chromeVersion: '140.0.0.0'
      })
    ).toBe('HarborClient/2.6.0 (X11; Linux aarch64) Electron/39.0.0 Chrome/140.0.0.0');
  });
});

describe('normalizeCustomUserAgents', () => {
  it('drops builtins, blanks, and duplicates', () => {
    expect(
      normalizeCustomUserAgents([
        BUILTIN_USER_AGENT_PRESETS[0],
        '  Custom/1.0  ',
        'custom/1.0',
        '',
        12,
        'Another/2.0'
      ])
    ).toEqual(['Custom/1.0', 'Another/2.0']);
  });

  it('keeps HarborClient strings because they are not builtins', () => {
    expect(
      normalizeCustomUserAgents([DEFAULT_USER_AGENT, LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT])
    ).toEqual([DEFAULT_USER_AGENT, LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT]);
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
  it('appends unknown values including HarborClient and ignores builtins', () => {
    expect(appendCustomUserAgent([], BUILTIN_USER_AGENT_PRESETS[0]!)).toEqual([]);
    expect(appendCustomUserAgent([], DEFAULT_USER_AGENT)).toEqual([DEFAULT_USER_AGENT]);
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
