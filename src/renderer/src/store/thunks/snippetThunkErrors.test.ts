import { describe, expect, it } from 'vitest';
import {
  OFFLINE_TEAM_HUB_SNIPPET_ERROR,
  normalizeOfflineTeamHubSnippetError,
  withOfflineTeamHubSnippetError
} from '#/renderer/src/store/thunks/snippetThunkErrors';

describe('normalizeOfflineTeamHubSnippetError', () => {
  it('rewrites unavailable database connection errors', () => {
    const err = new Error(
      'Database connection "693feca0-0f7f-4c2f-8e8f-3b5f03487a17" is unavailable.'
    );

    const normalized = normalizeOfflineTeamHubSnippetError(err);

    expect(normalized.message).toBe(OFFLINE_TEAM_HUB_SNIPPET_ERROR);
    expect(normalized.cause).toBe(err);
  });

  it('passes through unrelated errors unchanged', () => {
    const err = new Error('Snippet not found: 42');

    const normalized = normalizeOfflineTeamHubSnippetError(err);

    expect(normalized).toBe(err);
  });
});

describe('withOfflineTeamHubSnippetError', () => {
  it('rethrows rewritten offline Team Hub errors from rejected operations', async () => {
    await expect(
      withOfflineTeamHubSnippetError(() =>
        Promise.reject(
          new Error('Database connection "4f5dd356-e1c1-47c6-ba19-f78bb8edfe81" is unavailable.')
        )
      )
    ).rejects.toThrow(OFFLINE_TEAM_HUB_SNIPPET_ERROR);
  });

  it('returns successful operation results unchanged', async () => {
    await expect(
      withOfflineTeamHubSnippetError(async () => ({ id: 1, name: 'Auth helper' }))
    ).resolves.toEqual({ id: 1, name: 'Auth helper' });
  });
});
