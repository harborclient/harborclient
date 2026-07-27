import { useCallback } from 'react';
import toast from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';

import type { FieldSettingId, GroupSettingId } from '../catalog/catalog';
import {
  formatSettingAsJson,
  getSettingBinding,
  isFieldModified,
  resetFieldToDefault
} from '../catalog/fieldBindings';
import { settingAnchorId } from '../settingAnchorId';

/**
 * Catalog field or group id that may have a modified/reset binding.
 */
export type BoundSettingId = FieldSettingId | GroupSettingId;

/**
 * Per-field state and actions derived from the settings field binding registry.
 *
 * Consumed by {@link SettingField} and {@link SettingGroupField} so individual
 * field components stay unaware of modified indicators, reset, and copy behavior.
 */
export type SettingFieldState = {
  /**
   * Catalog field or group id for this setting (e.g. `general.verifySsl`).
   */
  settingId: BoundSettingId;
  /**
   * True when the draft (or live) value differs from the factory default.
   * Unbound catalog ids are always false.
   */
  isModified: boolean;
  /**
   * Writes the factory default into the settings draft (or persists for live
   * bindings). No-op when the id has no binding.
   */
  resetToDefault: () => void;
  /**
   * Copies the catalog id string to the clipboard and shows a success toast.
   * No-op when the id has no binding. Clipboard failures are swallowed.
   */
  copySettingId: () => Promise<void>;
  /**
   * Copies `"settingId": value` JSON to the clipboard. No-op when unbound.
   */
  copySettingAsJson: () => Promise<void>;
  /**
   * Copies `#setting-…` deep-link hash to the clipboard. No-op when unbound.
   */
  copyDeepLink: () => Promise<void>;
};

/**
 * Copies text to the clipboard and shows a success toast when possible.
 *
 * @param text - Clipboard payload.
 */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    // Clipboard access can fail in restricted contexts; match copyEntityId and stay quiet.
  }
}

/**
 * Exposes modified state, reset, and copy handlers for a single settings catalog
 * field or group.
 *
 * Subscribes via the field/group binding registry. Unbound ids report
 * `isModified: false` and treat reset/copy as no-ops so callers can safely pass
 * any {@link BoundSettingId}.
 *
 * @param settingId - Catalog field or group id to bind.
 * @returns Setting id, modified flag, and memoized handlers.
 */
export function useSettingFieldState(settingId: BoundSettingId): SettingFieldState {
  const dispatch = useAppDispatch();
  const isModified = useAppSelector((state) => isFieldModified(state, settingId));
  const binding = getSettingBinding(settingId);
  const hasBinding = binding != null;
  const currentValue = useAppSelector((state) =>
    binding != null ? binding.getValue(state) : undefined
  );

  /**
   * Resets the setting's value to its factory default via the binding registry.
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
    await copyText(settingId);
  }, [hasBinding, settingId]);

  /**
   * Copies a JSON property snippet for the current bound value.
   */
  const copySettingAsJson = useCallback(async () => {
    if (!hasBinding) {
      return;
    }
    await copyText(formatSettingAsJson(settingId, currentValue));
  }, [currentValue, hasBinding, settingId]);

  /**
   * Copies the settings deep-link hash for this catalog id.
   */
  const copyDeepLink = useCallback(async () => {
    if (!hasBinding) {
      return;
    }
    await copyText(`#${settingAnchorId(settingId)}`);
  }, [hasBinding, settingId]);

  return {
    settingId,
    isModified,
    resetToDefault,
    copySettingId,
    copySettingAsJson,
    copyDeepLink
  };
}
