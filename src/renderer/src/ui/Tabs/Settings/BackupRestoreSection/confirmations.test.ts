import { describe, expect, it } from 'vitest';

import type { GeneralSettings } from '#/shared/types';
import {
  areAllConfirmationsDisabled,
  areAllConfirmationsEnabled,
  CONFIRMATION_ROWS,
  confirmationSettingsPatch
} from './confirmations';

/**
 * Builds a general-settings object with every confirmation flag set to the same value.
 *
 * @param enabled - Whether every confirmation prompt should be shown.
 */
function generalWithConfirmations(enabled: boolean): GeneralSettings {
  return confirmationSettingsPatch(enabled) as GeneralSettings;
}

describe('confirmations helpers', () => {
  it('lists every warnWhen* confirmation key', () => {
    expect(CONFIRMATION_ROWS.map((row) => row.key)).toEqual([
      'warnWhenSwitchingThemes',
      'warnWhenExitingWithUnsavedChanges',
      'warnWhenClosingUnsavedRequests',
      'warnWhenEditingSnippet',
      'warnWhenCloningSnippet',
      'warnWhenClickingReadonlySnippet',
      'warnWhenCreatingTabGroup',
      'warnWhenOpeningTabGroup',
      'warnWhenAgentUsesTerminal'
    ]);
  });

  it('detects when all confirmations are enabled', () => {
    expect(areAllConfirmationsEnabled(generalWithConfirmations(true))).toBe(true);
    expect(
      areAllConfirmationsEnabled({
        ...generalWithConfirmations(true),
        warnWhenEditingSnippet: false
      })
    ).toBe(false);
  });

  it('detects when all confirmations are disabled', () => {
    expect(areAllConfirmationsDisabled(generalWithConfirmations(false))).toBe(true);
    expect(
      areAllConfirmationsDisabled({
        ...generalWithConfirmations(false),
        warnWhenOpeningTabGroup: true
      })
    ).toBe(false);
  });

  it('builds a patch that toggles every confirmation flag together', () => {
    expect(confirmationSettingsPatch(false)).toEqual({
      warnWhenSwitchingThemes: false,
      warnWhenExitingWithUnsavedChanges: false,
      warnWhenClosingUnsavedRequests: false,
      warnWhenEditingSnippet: false,
      warnWhenCloningSnippet: false,
      warnWhenClickingReadonlySnippet: false,
      warnWhenCreatingTabGroup: false,
      warnWhenOpeningTabGroup: false,
      warnWhenAgentUsesTerminal: false
    });
  });
});
