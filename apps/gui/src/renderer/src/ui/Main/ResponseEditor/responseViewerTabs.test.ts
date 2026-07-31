import { describe, expect, it } from 'vitest';
import {
  isResponseViewerTab,
  RESPONSE_VIEWER_TAB_LABELS,
  RESPONSE_VIEWER_TABS
} from './responseViewerTabs';

describe('responseViewerTabs', () => {
  it('lists every built-in expand-supported viewer tab', () => {
    expect(RESPONSE_VIEWER_TABS).toEqual([
      'body',
      'preview',
      'headers',
      'timing',
      'console',
      'logs',
      'redirects',
      'tests'
    ]);
  });

  it('accepts built-in viewer tab ids', () => {
    expect(isResponseViewerTab('body')).toBe(true);
    expect(isResponseViewerTab('headers')).toBe(true);
    expect(isResponseViewerTab('plugin:custom')).toBe(false);
  });

  it('provides a label for each built-in viewer tab', () => {
    for (const tab of RESPONSE_VIEWER_TABS) {
      expect(RESPONSE_VIEWER_TAB_LABELS[tab].length).toBeGreaterThan(0);
    }
  });
});
