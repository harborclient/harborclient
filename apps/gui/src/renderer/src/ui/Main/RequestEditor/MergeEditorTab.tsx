import { Button, Page } from '@harborclient/sdk/components';
import { useCallback, useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { PageRef } from '#/renderer/src/store/tabs';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { faCodeBranch } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Merge editor tab identity.
   */
  page: Extract<PageRef, { type: 'merge-editor' }>;

  /**
   * Tab id hosting this page.
   */
  tabId: string;
}

/**
 * Built-in merge conflict editor with a full-area textarea and staged save.
 */
export function MergeEditorTab({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Stable key for the currently requested conflict file payload.
   */
  const fileKey = `${page.connectionId}:${page.filePath}`;

  /**
   * Loads the conflicted file contents when the tab opens.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api
      .gitReadConflictFile({
        connectionId: page.connectionId,
        filePath: page.filePath
      })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setContent(result.content);
        setLoadedKey(fileKey);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLoadedKey(fileKey);
      });

    return () => {
      cancelled = true;
    };
  }, [fileKey, page.connectionId, page.filePath]);

  const loading = loadedKey !== fileKey;

  /**
   * Closes the tab without saving changes.
   */
  const handleCancel = useCallback((): void => {
    dispatch(closeTab(tabId));
  }, [dispatch, tabId]);

  /**
   * Writes the resolved file contents and stages the file for commit.
   */
  const handleCommit = useCallback(async (): Promise<void> => {
    if (saving || loading) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await window.api.gitWriteConflictFile({
        connectionId: page.connectionId,
        filePath: page.filePath,
        content
      });
      toast.success('Conflict file saved and staged.');
      dispatch(closeTab(tabId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [content, dispatch, loading, page.connectionId, page.filePath, saving, tabId]);

  return (
    <Page
      embedded
      title={page.label}
      description="Resolve merge conflict markers in this file, then commit to stage it."
      icon={faCodeBranch}
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
      actions={
        <>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={loading || saving} onClick={() => void handleCommit()}>
            {saving ? 'Committing…' : 'Commit'}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="m-0 text-muted" role="status">
          Loading conflict file…
        </p>
      ) : (
        <textarea
          className="min-h-0 flex-1 resize-none rounded border border-separator bg-surface px-3 py-2 font-mono text-[14px] text-text"
          value={content}
          aria-label={`Merge conflict editor for ${page.filePath}`}
          onChange={(event) => setContent(event.target.value)}
        />
      )}
      {error != null ? (
        <p className="mt-3 text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </Page>
  );
}
