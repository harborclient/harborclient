import { describe, expect, it } from 'vitest';

import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import type { GeneralSettings } from '@harborclient/core/types';
import {
  dismissLiveServerNoticePatch,
  isLiveServerNoticeDismissed,
  LIVE_SERVER_NOTICE_TABS,
  LIVE_SERVER_NOTICES
} from './liveServerNotices';

/**
 * Builds general settings with the given dismissed Live Server notice list.
 *
 * @param dismissed - Tabs whose notices are already dismissed.
 */
function generalWithDismissed(
  dismissed: GeneralSettings['dismissedLiveServerNotices']
): GeneralSettings {
  return { ...DEFAULT_GENERAL_SETTINGS, dismissedLiveServerNotices: dismissed };
}

describe('liveServerNotices', () => {
  it('provides copy for every Live Server settings tab', () => {
    expect(LIVE_SERVER_NOTICE_TABS).toEqual([
      'general',
      'proxy',
      'headers',
      'routing',
      'run',
      'ssl',
      'scripts'
    ]);

    for (const tab of LIVE_SERVER_NOTICE_TABS) {
      expect(LIVE_SERVER_NOTICES[tab].label.length).toBeGreaterThan(0);
      expect(LIVE_SERVER_NOTICES[tab].description.length).toBeGreaterThan(0);
    }
  });

  it('reports dismissal per tab', () => {
    const general = generalWithDismissed(['ssl']);

    expect(isLiveServerNoticeDismissed(general, 'ssl')).toBe(true);
    expect(isLiveServerNoticeDismissed(general, 'general')).toBe(false);
  });

  it('appends only the dismissed tab without duplicates', () => {
    const general = generalWithDismissed(['proxy']);

    expect(dismissLiveServerNoticePatch(general, 'headers')).toEqual({
      dismissedLiveServerNotices: ['proxy', 'headers']
    });
    expect(dismissLiveServerNoticePatch(general, 'proxy')).toEqual({
      dismissedLiveServerNotices: ['proxy']
    });
  });
});
