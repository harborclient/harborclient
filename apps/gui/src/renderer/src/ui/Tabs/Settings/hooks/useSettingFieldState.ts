import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { buildSettingDeepLink } from '@harborclient/core/deepLink';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';

import type { FieldSettingId, GroupSettingId } from '../catalog/catalog';
import {
  formatSettingAsJson,
  getSettingBinding,
  isFieldModified,
  resetFieldToDefault,
  valuesEqual
} from '../catalog/fieldBindings';

/**
 * Catalog field or group id that may have a modified/reset binding.
 */
export type BoundSettingId = FieldSettingId | GroupSettingId;

/**
 * Live (non-Redux) value + default + reset for settings that live outside the
 * draft / navigation binding registry — e.g. sidebar expansion display chrome.
 */
export type LiveSettingFieldState = {
  /**
   * Current live value compared against {@link defaultValue}.
   */
  value: unknown;
  /**
   * Factory default for modified detection and reset.
   */
  defaultValue: unknown;
  /**
   * Restores the factory default in the live store (immediate).
   */
  onReset: () => void;
};

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
   * Unbound catalog ids are always false unless a live override is provided.
   */
  isModified: boolean;
  /**
   * Writes the factory default into the settings draft (or persists for live
   * bindings / live overrides). No-op when the id has no binding and no live
   * override.
   */
  resetToDefault: () => void;
  /**
   * Copies the catalog id string to the clipboard and shows a success toast.
   * Works for unbound catalog ids (id-only; no value lookup). Clipboard
   * failures are swallowed.
   */
  copySettingId: () => Promise<void>;
  /**
   * Copies `"settingId": value` JSON to the clipboard. No-op when unbound and
   * no live override is provided.
   */
  copySettingAsJson: () => Promise<void>;
  /**
   * Copies a `harborclient://settings?id=…` deep link to the clipboard. Works
   * for unbound catalog ids (URL is derived from the id alone).
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
 * Subscribes via the field/group binding registry. When {@link live} is
 * provided, modified/reset/copy-JSON use that override instead (for context-
 * backed Appearance display chrome). Unbound ids without a live override report
 * `isModified: false` and treat reset / copy-as-JSON as no-ops, while copy-id
 * and copy-deep-link still work from the catalog id alone.
 *
 * @param settingId - Catalog field or group id to bind.
 * @param live - Optional live value/default/reset when state is outside Redux.
 * @returns Setting id, modified flag, and memoized handlers.
 */
export function useSettingFieldState(
  settingId: BoundSettingId,
  live?: LiveSettingFieldState
): SettingFieldState {
  const dispatch = useAppDispatch();
  const registryModified = useAppSelector((state) => isFieldModified(state, settingId));
  const binding = getSettingBinding(settingId);
  const hasRegistryBinding = binding != null;
  const registryValue = useAppSelector((state) =>
    binding != null ? binding.getValue(state) : undefined
  );

  const hasLive = live != null;
  const isModified = hasLive ? !valuesEqual(live.value, live.defaultValue) : registryModified;
  const currentValue = hasLive ? live.value : registryValue;
  const canCopyJson = hasLive || hasRegistryBinding;

  /**
   * Resets the setting's value to its factory default via the live override or
   * binding registry.
   */
  const resetToDefault = useCallback(() => {
    if (live != null) {
      live.onReset();
      return;
    }
    resetFieldToDefault(dispatch, settingId);
  }, [dispatch, live, settingId]);

  /**
   * Copies the catalog setting id to the clipboard. Does not require a binding
   * because the payload is the id string itself.
   */
  const copySettingId = useCallback(async () => {
    await copyText(settingId);
  }, [settingId]);

  /**
   * Copies a JSON property snippet for the current bound or live value.
   */
  const copySettingAsJson = useCallback(async () => {
    if (!canCopyJson) {
      return;
    }
    await copyText(formatSettingAsJson(settingId, currentValue));
  }, [canCopyJson, currentValue, settingId]);

  /**
   * Copies a harborclient://settings deep link for this catalog id. Does not
   * require a binding because the URL is derived from the id alone.
   */
  const copyDeepLink = useCallback(async () => {
    await copyText(buildSettingDeepLink(settingId));
  }, [settingId]);

  return {
    settingId,
    isModified,
    resetToDefault,
    copySettingId,
    copySettingAsJson,
    copyDeepLink
  };
}
