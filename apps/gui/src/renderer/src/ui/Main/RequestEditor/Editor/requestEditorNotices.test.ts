import { describe, expect, it } from 'vitest';

import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import type { GeneralSettings } from '@harborclient/core/types';
import {
  dismissRequestEditorNoticePatch,
  isRequestEditorNoticeDismissed,
  REQUEST_EDITOR_NOTICE_TABS,
  REQUEST_EDITOR_NOTICES
} from './requestEditorNotices';

/**
 * Builds general settings with the given dismissed notice list.
 *
 * @param dismissed - Tabs whose notices are already dismissed.
 */
function generalWithDismissed(
  dismissed: GeneralSettings['dismissedRequestEditorNotices']
): GeneralSettings {
  return { ...DEFAULT_GENERAL_SETTINGS, dismissedRequestEditorNotices: dismissed };
}

describe('requestEditorNotices', () => {
  it('provides copy for every built-in editor tab', () => {
    expect(REQUEST_EDITOR_NOTICE_TABS).toEqual([
      'params',
      'body',
      'headers',
      'auth',
      'cookies',
      'pre',
      'post',
      'comment'
    ]);

    for (const tab of REQUEST_EDITOR_NOTICE_TABS) {
      expect(REQUEST_EDITOR_NOTICES[tab].label.length).toBeGreaterThan(0);
      expect(REQUEST_EDITOR_NOTICES[tab].description.length).toBeGreaterThan(0);
    }
  });

  it('reports dismissal per tab', () => {
    const general = generalWithDismissed(['body']);

    expect(isRequestEditorNoticeDismissed(general, 'body')).toBe(true);
    expect(isRequestEditorNoticeDismissed(general, 'params')).toBe(false);
  });

  it('appends only the dismissed tab without duplicates', () => {
    const general = generalWithDismissed(['headers']);

    expect(dismissRequestEditorNoticePatch(general, 'auth')).toEqual({
      dismissedRequestEditorNotices: ['headers', 'auth']
    });
    expect(dismissRequestEditorNoticePatch(general, 'headers')).toEqual({
      dismissedRequestEditorNotices: ['headers']
    });
  });
});
