/**
 * Public GitHub OAuth App client id for HarborClient git device flow.
 *
 * Replace with your registered OAuth App client id when forking.
 */
export const GITHUB_OAUTH_CLIENT_ID = 'Ov23liApUgMEA0BGSWnt';

/**
 * Public GitHub OAuth App client id for HarborClient GitHub Models device flow.
 *
 * Register an OAuth App with device flow enabled and expiring user authorization
 * tokens. OAuth Apps cannot request the `models:read` scope (that permission applies
 * to GitHub Apps and fine-grained PATs); GitHub Models accepts tokens from
 * authorized OAuth Apps without an explicit scope. Replace when forking.
 */
export const GITHUB_MODELS_APP_CLIENT_ID = 'Ov23liLxKZYqTPAi5yOj';

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
 * Starts GitHub OAuth device flow for a flow key.
 *
 * @param flowKey - Stable key for this device-flow session (git host or `github-models`).
 * @param clientId - GitHub OAuth App or GitHub App client id.
 * @param scope - OAuth scope string for classic OAuth Apps; omit for GitHub Apps (permissions come from the App).
 * @returns User code and verification URI for browser approval.
 */
export async function startGitHubDeviceFlow(
  flowKey: string,
  clientId = GITHUB_OAUTH_CLIENT_ID,
  scope: string | undefined = 'repo'
): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  const body: Record<string, string> = { client_id: clientId };
  if (scope != null) {
    body.scope = scope;
  }

  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = (await parseGitHubResponse(response)) as {
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

  if (!response.ok) {
    throw new Error(`GitHub device flow failed: ${response.status} ${response.statusText}`);
  }

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error('GitHub device flow returned an incomplete response.');
  }

  const expiresIn = data.expires_in ?? 900;
  pendingFlows.set(flowKey, {
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
 * @param flowKey - Stable key for this device-flow session (git host or `github-models`).
 * @param options - Optional abort signal for background cancellation.
 * @returns OAuth access token and optional refresh metadata.
 */
export async function completeGitHubDeviceFlow(
  flowKey: string,
  options: CompleteGitHubDeviceFlowOptions = {}
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}> {
  const pending = pendingFlows.get(flowKey);
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

    const data = (await parseGitHubResponse(response)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!data.error && !response.ok) {
      throw new Error(`GitHub token poll failed: ${response.status} ${response.statusText}`);
    }

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

    pendingFlows.delete(flowKey);

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

  pendingFlows.delete(flowKey);
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

  const data = (await parseGitHubResponse(response)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        (!response.ok
          ? `GitHub token refresh failed: ${response.status} ${response.statusText}`
          : 'Token refresh failed.')
    );
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
 * @param flowKey - Stable key for this device-flow session (git host or `github-models`).
 */
export function clearPendingGitHubDeviceFlow(flowKey: string): void {
  pendingFlows.delete(flowKey);
}

/**
 * Parses a GitHub OAuth JSON response, tolerating error responses.
 *
 * GitHub returns actionable OAuth errors (for example `device_flow_disabled`) as a
 * JSON body even on non-2xx responses. Reading the body regardless of status lets
 * callers surface `error_description` instead of a bare HTTP status line.
 *
 * @param response - Fetch response from a GitHub OAuth endpoint.
 * @returns Parsed JSON body, or an empty object when the body is not JSON.
 */
async function parseGitHubResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
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
