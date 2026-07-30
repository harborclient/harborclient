import { describe, expect, it } from 'vitest';
import { buildWebsiteExport, validateWebsiteExport } from './website';

describe('buildWebsiteExport', () => {
  it('builds a website export envelope', () => {
    const envelope = buildWebsiteExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Example',
      url: 'https://example.com/',
      homeUrl: 'https://example.com/',
      faviconDataUrl: 'data:image/png;base64,abc',
      scripts: [
        {
          id: 's1',
          name: 'Inject',
          enabled: true,
          runAt: 'dom-ready',
          source: 'console.log(1)'
        }
      ],
      preRequestScripts: [
        {
          id: 'p1',
          enabled: true,
          kind: 'inline',
          name: 'Pre',
          code: 'hc.log("pre")',
          stage: 'main'
        }
      ]
    });

    expect(envelope).toMatchObject({
      harborclientVersion: 1,
      harborclientExport: 'website',
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Example',
      url: 'https://example.com/',
      homeUrl: 'https://example.com/',
      faviconDataUrl: 'data:image/png;base64,abc'
    });
    expect(envelope.scripts).toHaveLength(1);
    expect(envelope.pre_request_scripts).toHaveLength(1);
  });

  it('omits empty script arrays', () => {
    const envelope = buildWebsiteExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Blank',
      url: 'about:blank',
      homeUrl: 'about:blank'
    });

    expect(envelope.scripts).toBeUndefined();
    expect(envelope.pre_request_scripts).toBeUndefined();
    expect(envelope.post_request_scripts).toBeUndefined();
    expect(envelope.variables).toBeUndefined();
    expect(envelope.headers).toBeUndefined();
    expect(envelope.userAgent).toBeUndefined();
    expect(envelope.auth).toBeUndefined();
    expect(envelope.faviconDataUrl).toBeNull();
  });

  it('includes variables, headers, userAgent, and auth when set', () => {
    const envelope = buildWebsiteExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Configured',
      url: 'https://example.com/',
      homeUrl: 'https://example.com/',
      variables: [
        { key: 'host', value: 'example.com', defaultValue: '', enabled: true, share: false }
      ],
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      userAgent: 'HarborClient/1.0',
      auth: {
        type: 'bearer',
        basic: { username: '', password: '' },
        bearer: { token: 'secret' },
        oauth2: {
          tokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: '',
          audience: '',
          clientAuth: 'body'
        }
      }
    });

    expect(envelope.variables).toHaveLength(1);
    expect(envelope.headers).toEqual([{ key: 'X-Test', value: '1', enabled: true }]);
    expect(envelope.userAgent).toBe('HarborClient/1.0');
    expect(envelope.auth?.type).toBe('bearer');
  });
});

describe('validateWebsiteExport', () => {
  it('accepts a valid website export', () => {
    const exportData = validateWebsiteExport({
      harborclientVersion: 1,
      harborclientExport: 'website',
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Example',
      url: 'https://example.com/',
      homeUrl: 'https://example.com/',
      faviconDataUrl: null,
      scripts: []
    });

    expect(exportData.harborclientExport).toBe('website');
    expect(exportData.name).toBe('Example');
  });

  it('rejects an unknown discriminator', () => {
    expect(() =>
      validateWebsiteExport({
        harborclientVersion: 1,
        harborclientExport: 'workflow',
        uuid: '11111111-1111-4111-8111-111111111111',
        name: 'Example',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    ).toThrow();
  });
});
