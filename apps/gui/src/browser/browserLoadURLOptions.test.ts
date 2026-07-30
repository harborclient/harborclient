import { describe, expect, it } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import { buildBrowserLoadURLOptions } from './browserLoadURLOptions';

describe('buildBrowserLoadURLOptions', () => {
  it('returns empty options when headers, auth, and userAgent are unset', () => {
    expect(buildBrowserLoadURLOptions([], defaultAuth(), '')).toEqual({});
  });

  it('builds extraHeaders from enabled header rows', () => {
    const options = buildBrowserLoadURLOptions(
      [
        { key: 'X-Test', value: '1', enabled: true },
        { key: 'X-Skip', value: '2', enabled: false },
        { key: '', value: 'ignored', enabled: true }
      ],
      defaultAuth(),
      ''
    );
    expect(options.extraHeaders).toBe('X-Test: 1\n');
    expect(options.userAgent).toBeUndefined();
  });

  it('appends Authorization from bearer auth when no manual Authorization header', () => {
    const options = buildBrowserLoadURLOptions(
      [{ key: 'Accept', value: 'text/html', enabled: true }],
      {
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
      },
      ''
    );
    expect(options.extraHeaders).toBe('Accept: text/html\nAuthorization: Bearer secret\n');
  });

  it('does not override a manual Authorization header', () => {
    const options = buildBrowserLoadURLOptions(
      [{ key: 'Authorization', value: 'Bearer manual', enabled: true }],
      {
        type: 'bearer',
        basic: { username: '', password: '' },
        bearer: { token: 'ignored' },
        oauth2: {
          tokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: '',
          audience: '',
          clientAuth: 'body'
        }
      },
      ''
    );
    expect(options.extraHeaders).toBe('Authorization: Bearer manual\n');
  });

  it('includes a trimmed User-Agent override', () => {
    const options = buildBrowserLoadURLOptions([], defaultAuth(), '  HarborClient/1.0  ');
    expect(options).toEqual({ userAgent: 'HarborClient/1.0' });
  });
});
