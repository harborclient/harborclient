import { Button } from '@harborclient/sdk/components';
import toast from 'react-hot-toast';
import { useCallback, type JSX } from 'react';

import { useTabSaveRegistration } from '#/renderer/src/hooks/tabSaveRegistry';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectSettingsDraftDirty,
  selectSettingsDraftDisabled,
  selectSettingsDraftSaving
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { saveSettingsDraft } from '#/renderer/src/store/thunks/settingsDraft';

interface Props {
  /**
   * Hosting tab id so File → Save / Ctrl+S can persist the settings draft.
   */
  tabId?: string;
}

/**
 * Shared Save button for catalog-driven form settings sections.
 * Intended for {@link Page} header `actions` so Save stays visible without scrolling.
 */
export function SettingsSaveAction({ tabId }: Props): JSX.Element {
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

  /**
   * Whether File → Save / Ctrl+S should invoke this action (mirrors Save button).
   */
  const menuCanSave = dirty && !disabled && !saving;

  useTabSaveRegistration(tabId, menuCanSave, handleSave);

  return (
    <Button type="button" disabled={disabled || !dirty} onClick={() => void handleSave()}>
      {saving ? 'Saving…' : 'Save'}
    </Button>
  );
}
