import { useCallback } from 'react';
import toast from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';

import type { FieldSettingId } from '../catalog/catalog';
import { getFieldBinding, isFieldModified, resetFieldToDefault } from '../catalog/fieldBindings';

/**
 * Per-field state and actions derived from the settings field binding registry.
 *
 * Consumed by {@link SettingField} (Step 3) so individual field components stay
 * unaware of modified indicators, reset, and copy-id behavior.
 */
export type SettingFieldState = {
  /**
   * Catalog field id for this setting (e.g. `general.verifySsl`).
   */
  settingId: FieldSettingId;
  /**
   * True when the draft value differs from the factory default.
   * Unbound catalog ids are always false.
   */
  isModified: boolean;
  /**
   * Writes the factory default into the settings draft.
   * No-op when the id has no binding.
   */
  resetToDefault: () => void;
  /**
   * Copies the catalog id string to the clipboard and shows a success toast.
   * No-op when the id has no binding. Clipboard failures are swallowed.
   */
  copySettingId: () => Promise<void>;
};

/**
 * Exposes modified state, reset, and copy-id handlers for a single settings catalog field.
 *
 * Subscribes to the settings draft via the field binding registry. Unbound ids
 * report `isModified: false` and treat reset/copy as no-ops so callers can
 * safely pass any {@link FieldSettingId}.
 *
 * @param settingId - Catalog field id to bind.
 * @returns Setting id, modified flag, and memoized handlers.
 */
export function useSettingFieldState(settingId: FieldSettingId): SettingFieldState {
  const dispatch = useAppDispatch();
  const isModified = useAppSelector((state) => isFieldModified(state, settingId));
  const hasBinding = getFieldBinding(settingId) != null;

  /**
   * Resets the field's draft value to its factory default via the binding registry.
   */
  const resetToDefault = useCallback(() => {
    resetFieldToDefault(dispatch, settingId);
  }, [dispatch, settingId]);

  /**
   * Copies the catalog setting id to the clipboard when a binding exists.
   */
  const copySettingId = useCallback(async () => {
    if (!hasBinding) {
      return;
    }
    try {
      await navigator.clipboard.writeText(settingId);
      toast.success('Copied to clipboard');
    } catch {
      // Clipboard access can fail in restricted contexts; match copyEntityId and stay quiet.
    }
  }, [hasBinding, settingId]);

  return {
    settingId,
    isModified,
    resetToDefault,
    copySettingId
  };
}
