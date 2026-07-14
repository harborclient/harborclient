import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import type { StorageConnection } from '#/shared/types/storage';

const { watchMock } = vi.hoisted(() => ({
  watchMock: vi.fn()
}));

vi.mock('fs', () => ({
  watch: watchMock
}));

import { resetGitWatcherRegistryForTests, watchGitConnection } from '#/main/git/gitWatcher';

const gitConnection: StorageConnection & { type: 'git' } = {
  id: 'git-1',
  name: 'Demo repo',
  type: 'git',
  settings: {
    repoPath: '/tmp/demo-repo',
    url: 'https://github.com/example/demo.git',
    branch: 'main',
    subdir: '',
    auth: { kind: 'pat', username: 'token' }
  }
};

describe('watchGitConnection', () => {
  beforeEach(() => {
    resetGitWatcherRegistryForTests();
    watchMock.mockReset();
    watchMock.mockImplementation(() => ({
      close: vi.fn()
    }));
  });

  afterEach(() => {
    resetGitWatcherRegistryForTests();
  });

  it('registers one watcher per connection id', () => {
    const router = {
      isConnectionMounted: vi.fn(() => true),
      requireGitStorage: vi.fn(),
      reconcileGitRegistry: vi.fn()
    } as unknown as RoutingStorage;
    const notify = vi.fn();

    watchGitConnection(router, gitConnection, notify);
    watchGitConnection(router, gitConnection, notify);

    expect(watchMock).toHaveBeenCalledTimes(1);
  });

  it('skips unmounted git connections', () => {
    const router = {
      isConnectionMounted: vi.fn(() => false)
    } as unknown as RoutingStorage;

    watchGitConnection(router, gitConnection, vi.fn());

    expect(watchMock).not.toHaveBeenCalled();
  });
});
