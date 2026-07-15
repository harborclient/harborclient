import { Button } from '@harborclient/sdk/components';
import toast from 'react-hot-toast';
import { useCallback, type JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectSettingsDraftDirty,
  selectSettingsDraftDisabled,
  selectSettingsDraftSaving
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { saveSettingsDraft } from '#/renderer/src/store/thunks/settingsDraft';

/**
 * Shared Save footer for catalog-driven form settings sections.
 */
export function SettingsSaveFooter(): JSX.Element {
  const dispatch = useAppDispatch();
  const dirty = useAppSelector(selectSettingsDraftDirty);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const saving = useAppSelector(selectSettingsDraftSaving);

  /**
   * Persists the shared settings draft when there are unsaved changes.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await dispatch(saveSettingsDraft()).unwrap();
      toast.success('Settings saved.');
    } catch {
      // Error message is stored on the draft slice for inline display.
    }
  }, [dispatch]);

  return (
    <div className="flex items-center gap-3">
      <Button type="button" disabled={disabled || !dirty} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
