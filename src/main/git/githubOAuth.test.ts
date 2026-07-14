import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingGitHubDeviceFlow,
  completeGitHubDeviceFlow,
  startGitHubDeviceFlow
} from '#/main/git/githubOAuth';

describe('githubOAuth device flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearPendingGitHubDeviceFlow('conn-1');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('polls until GitHub returns an access token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 1
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'authorization_pending' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    const started = await startGitHubDeviceFlow('conn-1');
    expect(started).toEqual({
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device'
    });

    const completion = completeGitHubDeviceFlow('conn-1');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(completion).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: expect.any(String)
    });
  });

  it('surfaces the GitHub error description when the device request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: 'device_flow_disabled',
        error_description: 'Device Flow must be explicitly enabled for this App'
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(startGitHubDeviceFlow('conn-1')).rejects.toThrow(
      'Device Flow must be explicitly enabled for this App'
    );
  });

  it('aborts polling without clearing the pending flow session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'device-code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 1
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'authorization_pending' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token',
          expires_in: 3600
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    await startGitHubDeviceFlow('conn-1');

    const controller = new AbortController();
    const aborted = completeGitHubDeviceFlow('conn-1', { signal: controller.signal });
    const abortedExpectation = expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    await abortedExpectation;

    const retry = completeGitHubDeviceFlow('conn-1');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(retry).resolves.toEqual({
      accessToken: 'access-token',
      expiresAt: expect.any(String)
    });
  });
});
