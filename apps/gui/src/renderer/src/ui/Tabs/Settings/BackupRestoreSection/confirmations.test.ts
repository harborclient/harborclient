import { describe, expect, it } from 'vitest';

import type { GeneralSettings } from '@harborclient/core/types';
import {
  areAllConfirmationsDisabled,
  areAllConfirmationsEnabled,
  CONFIRMATION_ROWS,
  CONFIRMATION_TABLE_ROWS,
  confirmationSettingsPatch,
  REQUEST_EDITOR_NOTICES_ROW
} from './confirmations';

/**
 * Builds a general-settings object with every confirmation row set to the same state.
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

  it('appends the request editor tips aggregate row to the table rows', () => {
    expect(CONFIRMATION_TABLE_ROWS.map((row) => row.id)).toEqual([
      ...CONFIRMATION_ROWS.map((row) => row.key),
      'requestEditorNotices'
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
    expect(
      areAllConfirmationsEnabled({
        ...generalWithConfirmations(true),
        dismissedRequestEditorNotices: ['params']
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
    expect(
      areAllConfirmationsDisabled({
        ...generalWithConfirmations(false),
        dismissedRequestEditorNotices: []
      })
    ).toBe(false);
  });

  it('builds a patch that toggles every confirmation row together', () => {
    expect(confirmationSettingsPatch(false)).toEqual({
      warnWhenSwitchingThemes: false,
      warnWhenExitingWithUnsavedChanges: false,
      warnWhenClosingUnsavedRequests: false,
      warnWhenEditingSnippet: false,
      warnWhenCloningSnippet: false,
      warnWhenClickingReadonlySnippet: false,
      warnWhenCreatingTabGroup: false,
      warnWhenOpeningTabGroup: false,
      warnWhenAgentUsesTerminal: false,
      dismissedRequestEditorNotices: [
        'params',
        'body',
        'headers',
        'auth',
        'cookies',
        'pre',
        'post',
        'comment'
      ]
    });
    expect(confirmationSettingsPatch(true).dismissedRequestEditorNotices).toEqual([]);
  });

  it('treats the tips row as enabled only when no tab tip is dismissed', () => {
    const general = generalWithConfirmations(true);
    expect(REQUEST_EDITOR_NOTICES_ROW.isEnabled(general)).toBe(true);
    expect(
      REQUEST_EDITOR_NOTICES_ROW.isEnabled({
        ...general,
        dismissedRequestEditorNotices: ['cookies']
      })
    ).toBe(false);
  });
});
