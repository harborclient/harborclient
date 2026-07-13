/**
 * Public GitHub OAuth App client id for HarborClient device flow.
 *
 * Replace with your registered OAuth App client id when forking.
 */
export const GITHUB_OAUTH_CLIENT_ID = 'Ov23liApUgMEA0BGSWnt';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Pending device flow session for a git host.
 */
interface PendingDeviceFlow {
  /**
   * Device code returned by GitHub.
   */
  deviceCode: string;

  /**
   * OAuth App client id used to start this flow.
   */
  clientId: string;

  /**
   * Polling interval in seconds suggested by GitHub.
   */
  interval: number;

  /**
   * Absolute timestamp (ms) when the device code expires.
   */
  expiresAt: number;
}

const pendingFlows = new Map<string, PendingDeviceFlow>();

/**
 * Starts GitHub OAuth device flow for a git host.
 *
 * @param host - Normalized lowercase git host key.
 * @param clientId - GitHub OAuth App client id; defaults to HarborClient's built-in app.
 * @returns User code and verification URI for browser approval.
 */
export async function startGitHubDeviceFlow(
  host: string,
  clientId = GITHUB_OAUTH_CLIENT_ID
): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: 'repo'
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub device flow failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(data.error_description ?? data.error);
  }

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error('GitHub device flow returned an incomplete response.');
  }

  const expiresIn = data.expires_in ?? 900;
  pendingFlows.set(host, {
    deviceCode: data.device_code,
    clientId,
    interval: data.interval ?? 5,
    expiresAt: Date.now() + expiresIn * 1000
  });

  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri
  };
}

/**
 * Options for GitHub device-flow completion polling.
 */
export interface CompleteGitHubDeviceFlowOptions {
  /**
   * When aborted, polling stops without clearing the pending flow session.
   */
  signal?: AbortSignal;
}

/**
 * Polls GitHub until the user approves device flow or the code expires.
 *
 * @param host - Normalized lowercase git host key.
 * @param options - Optional abort signal for background cancellation.
 * @returns OAuth access token and optional refresh metadata.
 */
export async function completeGitHubDeviceFlow(
  host: string,
  options: CompleteGitHubDeviceFlowOptions = {}
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}> {
  const pending = pendingFlows.get(host);
  if (!pending) {
    throw new Error('No pending GitHub authorization. Start OAuth first.');
  }

  while (Date.now() < pending.expiresAt) {
    if (options.signal?.aborted) {
      throw new DOMException('GitHub OAuth polling aborted.', 'AbortError');
    }

    await sleep(pending.interval * 1000, options.signal);

    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: pending.clientId,
        device_code: pending.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub token poll failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (data.error === 'authorization_pending') {
      continue;
    }

    if (data.error === 'slow_down') {
      pending.interval += 1;
      continue;
    }

    if (data.error) {
      throw new Error(data.error_description ?? data.error);
    }

    if (!data.access_token) {
      throw new Error('GitHub did not return an access token.');
    }

    pendingFlows.delete(host);

    const expiresAt =
      data.expires_in != null
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt
    };
  }

  pendingFlows.delete(host);
  throw new Error('GitHub authorization timed out. Try again.');
}

/**
 * Refreshes a GitHub OAuth access token using a refresh token.
 *
 * @param refreshToken - Stored refresh token.
 * @param clientId - GitHub OAuth App client id; defaults to HarborClient's built-in app.
 */
export async function refreshGitHubAccessToken(
  refreshToken: string,
  clientId = GITHUB_OAUTH_CLIENT_ID
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}> {
  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub token refresh failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Token refresh failed.');
  }

  const expiresAt =
    data.expires_in != null
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt
  };
}

/**
 * Clears a pending device flow session for a connection.
 *
 * @param host - Normalized lowercase git host key.
 */
export function clearPendingGitHubDeviceFlow(host: string): void {
  pendingFlows.delete(host);
}

/**
 * Sleeps for the given duration, rejecting immediately when the signal aborts.
 *
 * @param ms - Duration in milliseconds.
 * @param signal - Optional abort signal that cancels the wait early.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('GitHub OAuth polling aborted.', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    /**
     * Clears the timer and rejects when polling is cancelled mid-wait.
     */
    function onAbort(): void {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException('GitHub OAuth polling aborted.', 'AbortError'));
    }

    /**
     * Removes the abort listener so resolved sleeps do not leak handlers.
     */
    function cleanup(): void {
      signal?.removeEventListener('abort', onAbort);
    }

    signal?.addEventListener('abort', onAbort);
  });
}
