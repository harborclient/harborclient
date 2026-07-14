import type { WebContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageConnection } from '#/shared/types';

const finishHostGitHubOAuth = vi.hoisted(() => vi.fn(async () => undefined));
const testHostCredentials = vi.hoisted(() => vi.fn(async () => undefined));
const mockConnections = vi.hoisted(() => [] as StorageConnection[]);

vi.mock('#/main/git/gitAuth', () => ({
  finishHostGitHubOAuth,
  resolveConnectionHost: vi.fn(() => 'github.com'),
  testHostCredentials
}));

vi.mock('#/main/git/githubOAuth', () => ({
  clearPendingGitHubDeviceFlow: vi.fn()
}));

vi.mock('#/main/settings/storageSettings', () => ({
  listStorageConnections: () => mockConnections
}));

import { scheduleHostGitHubOAuthCompletion } from '#/main/git/gitOAuthScheduler';

/**
 * Flushes pending microtasks so background OAuth completion handlers can run.
 */
async function flushScheduler(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Builds a mock renderer web contents sender for OAuth completion events.
 */
function mockSender(): WebContents & { sent: Array<{ channel: string; payload: unknown }> } {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  return {
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => {
      sent.push({ channel, payload });
    },
    sent
  } as WebContents & { sent: Array<{ channel: string; payload: unknown }> };
}

describe('scheduleHostGitHubOAuthCompletion', () => {
  beforeEach(() => {
    mockConnections.length = 0;
    finishHostGitHubOAuth.mockReset();
    finishHostGitHubOAuth.mockResolvedValue(undefined);
    testHostCredentials.mockReset();
    testHostCredentials.mockResolvedValue(undefined);
  });

  it('notifies auth failure with ok false', async () => {
    finishHostGitHubOAuth.mockRejectedValue(new Error('OAuth denied'));

    const sender = mockSender();
    scheduleHostGitHubOAuthCompletion(sender, {} as never, 'github.com', {
      testUrl: 'https://github.com/org/repo.git',
      repoPath: '/tmp/repo'
    });

    await flushScheduler();

    expect(sender.sent).toEqual([
      {
        channel: 'git:oauthFinished',
        payload: {
          host: 'github.com',
          ok: false,
          error: 'OAuth denied'
        }
      }
    ]);
    expect(testHostCredentials).not.toHaveBeenCalled();
  });

  it('notifies auth success without validationError when validation succeeds', async () => {
    const sender = mockSender();
    scheduleHostGitHubOAuthCompletion(sender, {} as never, 'github.com', {
      testUrl: 'https://github.com/org/repo.git',
      repoPath: '/tmp/repo'
    });

    await flushScheduler();

    expect(testHostCredentials).toHaveBeenCalledWith(
      'github.com',
      'https://github.com/org/repo.git',
      '/tmp/repo'
    );
    expect(sender.sent).toEqual([
      {
        channel: 'git:oauthFinished',
        payload: {
          host: 'github.com',
          ok: true
        }
      }
    ]);
  });

  it('notifies auth success with validationError when repository validation fails', async () => {
    testHostCredentials.mockRejectedValue(new Error('HTTP Error: 404 Not Found'));

    const sender = mockSender();
    scheduleHostGitHubOAuthCompletion(sender, {} as never, 'github.com', {
      testUrl: 'https://github.com/org/missing.git',
      repoPath: '/tmp/repo'
    });

    await flushScheduler();

    expect(sender.sent).toEqual([
      {
        channel: 'git:oauthFinished',
        payload: {
          host: 'github.com',
          ok: true,
          validationError: 'HTTP Error: 404 Not Found'
        }
      }
    ]);
  });

  it('validates connection credentials when a connection id is provided', async () => {
    mockConnections.push({
      id: 'git-conn-1',
      name: 'Git',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/org/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'oauth', provider: 'github' }
      }
    });

    const sender = mockSender();
    scheduleHostGitHubOAuthCompletion(sender, {} as never, 'github.com', {
      connectionId: 'git-conn-1'
    });

    await flushScheduler();

    expect(testHostCredentials).toHaveBeenCalledWith(
      'github.com',
      'https://github.com/org/repo.git',
      '/tmp/repo'
    );
    expect(sender.sent).toEqual([
      {
        channel: 'git:oauthFinished',
        payload: {
          host: 'github.com',
          connectionId: 'git-conn-1',
          ok: true
        }
      }
    ]);
  });
});
