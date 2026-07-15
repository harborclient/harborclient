import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultOAuth2Config } from '#/shared/auth';
import { clearOAuthToken, fetchClientCredentialsToken, getValidOAuthToken } from './oauthToken';
import * as oauthSecrets from './oauthSecrets';

describe('fetchClientCredentialsToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends client credentials in the POST body by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          access_token: 'access-token',
          token_type: 'Bearer',
          expires_in: 3600
        })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchClientCredentialsToken({
      ...defaultOAuth2Config(),
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scope: 'read write',
      audience: 'api',
      clientAuth: 'body'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded'
        })
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = requestInit.body as string;
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=client-id');
    expect(body).toContain('client_secret=client-secret');
    expect(body).toContain('scope=read+write');
    expect(body).toContain('audience=api');
    expect(result.accessToken).toBe('access-token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresAt).toEqual(expect.any(String));
  });

  it('sends client credentials as HTTP Basic auth when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          access_token: 'access-token',
          token_type: 'Bearer'
        })
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchClientCredentialsToken({
      ...defaultOAuth2Config(),
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      clientAuth: 'header'
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.headers).toMatchObject({
      Authorization: 'Basic Y2xpZW50LWlkOmNsaWVudC1zZWNyZXQ='
    });
    expect(requestInit.body).toBe('grant_type=client_credentials');
  });

  it('throws when the token endpoint returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () =>
          JSON.stringify({
            error: 'invalid_client',
            error_description: 'Bad credentials'
          })
      })
    );

    await expect(
      fetchClientCredentialsToken({
        ...defaultOAuth2Config(),
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        clientAuth: 'body'
      })
    ).rejects.toThrow(/Bad credentials/);
  });
});

describe('getValidOAuthToken', () => {
  beforeEach(() => {
    vi.spyOn(oauthSecrets, 'getOAuthToken').mockReturnValue(undefined);
    vi.spyOn(oauthSecrets, 'storeOAuthToken').mockImplementation(() => undefined);
    vi.spyOn(oauthSecrets, 'deleteOAuthToken').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a cached token when still valid', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(oauthSecrets.getOAuthToken).mockReturnValue({
      accessToken: 'cached-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600_000).toISOString()
    });

    const result = await getValidOAuthToken(
      'request:1',
      {
        ...defaultOAuth2Config(),
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        clientAuth: 'body'
      },
      false
    );

    expect(result.accessToken).toBe('cached-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and stores a token when cache is missing or forced', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: 'fresh-token',
            token_type: 'Bearer',
            expires_in: 1800
          })
      })
    );

    const config = {
      ...defaultOAuth2Config(),
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      clientAuth: 'body' as const
    };

    const result = await getValidOAuthToken('request:2', config, true);
    expect(result.accessToken).toBe('fresh-token');
    expect(oauthSecrets.storeOAuthToken).toHaveBeenCalledWith(
      'request:2',
      'fresh-token',
      'Bearer',
      expect.any(String)
    );
  });
});

describe('clearOAuthToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to oauthSecrets delete helper', () => {
    const deleteSpy = vi
      .spyOn(oauthSecrets, 'deleteOAuthToken')
      .mockImplementation(() => undefined);
    clearOAuthToken('collection:3');
    expect(deleteSpy).toHaveBeenCalledWith('collection:3');
  });
});
