import { Button } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectEditingTabGroup } from '#/renderer/src/store/slices/tabGroupSlice';
import { cancelTabGroupEdit, saveTabGroupEdit } from '#/renderer/src/store/thunks/tabGroups';

/**
 * Bottom instruction bar shown while editing a tab group's membership.
 */
export function TabGroupEditBar(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const editingGroup = useAppSelector(selectEditingTabGroup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Persists the current visible tab membership and exits edit mode.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(saveTabGroupEdit()).unwrap();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save tab group');
    } finally {
      setBusy(false);
    }
  }, [dispatch]);

  /**
   * Exits tab group edit mode without saving changes.
   */
  const handleCancel = useCallback((): void => {
    void dispatch(cancelTabGroupEdit());
  }, [dispatch]);

  if (editingGroup == null) {
    return null;
  }

  return (
    <div className="tab-group-edit-bar-attention flex shrink-0 items-center justify-between gap-4 border-t border-separator bg-surface px-4 py-3 app-no-drag">
      <p className="m-0 min-w-0 flex-1 text-[16px] text-text" role="status" aria-live="polite">
        Editing tab group &ldquo;{editingGroup.name}&rdquo;. Open request tabs to add them and close
        tabs to remove them, then click Save.
        {error != null ? (
          <span className="mt-1 block text-danger" role="alert">
            {error}
          </span>
        ) : null}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={() => void handleSave()}>
          Save
        </Button>
      </div>
    </div>
  );
}
