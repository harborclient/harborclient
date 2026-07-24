import { describe, expect, it } from 'vitest';
import {
  credentialsSavedValidationMessage,
  emptyRemoteConnectionTestMessage,
  emptyRemoteCredentialsMessage,
  formatGitHttpError,
  githubForbiddenMessage,
  githubOAuthAppRestrictionMessage,
  githubRateLimitMessage,
  githubRepoNotFoundMessage,
  githubSsoRequiredMessage,
  isGitHubOAuthAppRestrictionMessage,
  isGitRepoNotFoundError,
  ownerFromOAuthAppRestrictionMessage,
  readOnlyRepoAccessMessage,
  stripIpcInvokeErrorPrefix,
  successfulConnectionTestMessage
} from './gitHttpErrors';

describe('gitHttpErrors', () => {
  it('detects isomorphic-git HttpError 404 payloads', () => {
    const err = Object.assign(new Error('HTTP Error: 404 Not Found'), {
      code: 'HttpError',
      data: { statusCode: 404, statusMessage: 'Not Found', response: 'Repository not found.' }
    });
    expect(isGitRepoNotFoundError(err)).toBe(true);
  });

  it('detects repository-not-found message text', () => {
    expect(isGitRepoNotFoundError('Repository not found.')).toBe(true);
    expect(isGitRepoNotFoundError(new Error('HTTP Error: 404 Not Found'))).toBe(true);
  });

  it('does not treat unrelated errors as not-found', () => {
    expect(isGitRepoNotFoundError(new Error('Authentication failed'))).toBe(false);
    expect(isGitRepoNotFoundError(new Error('Cannot pull: repository is not on a branch.'))).toBe(
      false
    );
  });

  it('does not treat missing-branch validation errors as repository-not-found', () => {
    expect(
      isGitRepoNotFoundError(
        new Error(
          'Credentials verified, but branch "main" does not exist on the remote. Check the branch name.'
        )
      )
    ).toBe(false);
  });

  it('formats 404 errors with an actionable access-denied message', () => {
    const err = Object.assign(new Error('HTTP Error: 404 Not Found'), {
      data: { statusCode: 404 }
    });
    const message = formatGitHttpError(err, 'push');
    expect(message).toContain('during push');
    expect(message).toContain('Settings → Git');
    expect(message).toContain('org SSO approval');
  });

  it('includes signed-in login and org SSO URL in diagnostic 404 messages', () => {
    const message = githubRepoNotFoundMessage('validate', {
      githubLogin: 'octocat',
      owner: 'harborclient'
    });
    expect(message).toContain('signed in as octocat');
    expect(message).toContain('https://github.com/orgs/harborclient/sso');
  });

  it('reads owner from a thrown REST probe error when formatting', () => {
    const err = Object.assign(new Error('HTTP Error: 404 Not Found'), {
      data: { statusCode: 404 },
      owner: 'acme'
    });
    expect(formatGitHttpError(err, 'push', { githubLogin: 'jane' })).toContain(
      'https://github.com/orgs/acme/sso'
    );
  });

  it('preserves non-404 error messages', () => {
    expect(formatGitHttpError(new Error('network timeout'), 'fetch')).toBe('network timeout');
  });

  it('strips Electron IPC invoke prefixes from error messages', () => {
    const wrapped = new Error(
      "Error invoking remote method 'git:testConnection': Error: GitHub denied access (403 Forbidden)."
    );
    expect(stripIpcInvokeErrorPrefix(wrapped.message)).toBe(
      'GitHub denied access (403 Forbidden).'
    );
    expect(formatGitHttpError(wrapped, 'validate')).toBe('GitHub denied access (403 Forbidden).');
  });

  it('builds credentials-saved validation messages for 404s', () => {
    const message = credentialsSavedValidationMessage('HTTP Error: 404 Not Found');
    expect(message).toContain('Credentials saved');
    expect(message).toContain('repository not found');
  });

  it('preserves diagnostic validation messages that already include login context', () => {
    const diagnostic = githubRepoNotFoundMessage('validate', {
      githubLogin: 'octocat',
      owner: 'harborclient'
    });
    const message = credentialsSavedValidationMessage(diagnostic);
    expect(message).toContain('Credentials saved');
    expect(message).toContain('signed in as octocat');
    expect(message).toContain('orgs/harborclient/sso');
  });

  it('includes the raw error when validation failed for a non-404 reason', () => {
    expect(credentialsSavedValidationMessage('network timeout')).toContain('network timeout');
  });

  it('builds an SSO-required message preferring the header URL', () => {
    const message = githubSsoRequiredMessage(
      'validate',
      { githubLogin: 'octocat', owner: 'acme' },
      'https://github.com/orgs/acme/sso?authorization_request=abc'
    );
    expect(message).toContain('SAML SSO authorization is required');
    expect(message).toContain('signed in as octocat');
    expect(message).toContain('https://github.com/orgs/acme/sso?authorization_request=abc');
  });

  it('falls back to the org SSO URL when no header URL is given', () => {
    const message = githubSsoRequiredMessage('validate', { owner: 'acme' });
    expect(message).toContain('https://github.com/orgs/acme/sso');
  });

  it('builds a rate-limit message with and without a retry-after time', () => {
    expect(githubRateLimitMessage('validate', 90)).toContain('90 seconds');
    expect(githubRateLimitMessage('validate')).toContain('a few minutes');
  });

  it('detects GitHub OAuth App access restriction messages', () => {
    expect(
      isGitHubOAuthAppRestrictionMessage(
        'Although you appear to have the correct authorization credentials, the `harborclient` organization has enabled OAuth App access restrictions that prevent your application from accessing this repository.'
      )
    ).toBe(true);
    expect(isGitHubOAuthAppRestrictionMessage('Forbidden')).toBe(false);
    expect(
      ownerFromOAuthAppRestrictionMessage(
        'the `harborclient` organization has enabled OAuth App access restrictions'
      )
    ).toBe('harborclient');
  });

  it('builds an OAuth App restriction message with org and re-authorize steps', () => {
    const message = githubOAuthAppRestrictionMessage('validate', {
      githubLogin: 'jane',
      owner: 'harborclient'
    });
    expect(message).toContain('harborclient organization');
    expect(message).toContain('restricts third-party OAuth apps');
    expect(message).toContain('signed in as jane');
    expect(message).toContain('Finish authentication');
    expect(message).toContain('Third-party access');
    expect(message).not.toContain('github.com/orgs/harborclient/sso');
  });

  it('builds a generic forbidden message without speculative SSO URLs', () => {
    const message = githubForbiddenMessage('validate', { githubLogin: 'jane', owner: 'acme' });
    expect(message).toContain('403 Forbidden');
    expect(message).toContain('signed in as jane');
    expect(message).toContain('Re-authorize');
    expect(message).not.toContain('https://github.com/orgs/acme/sso');
  });

  it('preserves SSO and rate-limit diagnostics in credentials-saved messages', () => {
    const sso = credentialsSavedValidationMessage(
      githubSsoRequiredMessage('validate', { owner: 'acme' })
    );
    expect(sso).toContain('Credentials saved');
    expect(sso).toContain('SAML SSO authorization is required');

    const rate = credentialsSavedValidationMessage(githubRateLimitMessage('validate', 30));
    expect(rate).toContain('Credentials saved');
    expect(rate).toContain('rate limit reached');

    const oauth = credentialsSavedValidationMessage(
      githubOAuthAppRestrictionMessage('validate', { owner: 'harborclient' })
    );
    expect(oauth).toContain('Credentials saved');
    expect(oauth).toContain('restricts third-party OAuth apps');
  });

  it('builds empty-remote and read-only status messages', () => {
    expect(emptyRemoteCredentialsMessage()).toContain('empty');
    expect(emptyRemoteConnectionTestMessage()).toContain('empty');
    expect(successfulConnectionTestMessage()).toContain('Connection successful');
    expect(readOnlyRepoAccessMessage()).toContain('push access');
  });
});
