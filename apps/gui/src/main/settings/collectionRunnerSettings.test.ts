import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLLECTION_RUNNER_CONFIG } from '#/shared/collectionRunner';

describe('collectionRunnerSettings', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns defaults when nothing is stored', async () => {
    const { getCollectionRunnerConfig } = await import('#/main/settings/collectionRunnerSettings');
    expect(getCollectionRunnerConfig()).toEqual(DEFAULT_COLLECTION_RUNNER_CONFIG);
  });

  it('normalizes stored values on read and write', async () => {
    const { getCollectionRunnerConfig, setCollectionRunnerConfig } =
      await import('#/main/settings/collectionRunnerSettings');

    setCollectionRunnerConfig({
      delayMs: 250,
      stopOnFailure: true,
      environmentMode: 'override',
      environmentId: 4
    });

    expect(getCollectionRunnerConfig()).toEqual({
      delayMs: 250,
      stopOnFailure: true,
      environmentMode: 'override',
      environmentId: 4
    });
  });
});
