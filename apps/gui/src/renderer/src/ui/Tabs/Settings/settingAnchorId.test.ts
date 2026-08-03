// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { focusSettingAnchor, settingAnchorId } from './settingAnchorId';

describe('settingAnchorId', () => {
  it('builds a stable DOM id from dotted setting ids', () => {
    expect(settingAnchorId('backup-restore.confirmations')).toBe(
      'setting-backup-restore-confirmations'
    );
    expect(settingAnchorId('general.verifySsl')).toBe('setting-general-verifySsl');
  });
});

describe('focusSettingAnchor', () => {
  it('scrolls and focuses the matching element when present', () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    const element = { focus, scrollIntoView } as unknown as HTMLElement;
    const getElementById = vi.spyOn(document, 'getElementById').mockReturnValue(element);

    expect(focusSettingAnchor('general.verifySsl')).toBe(true);
    expect(getElementById).toHaveBeenCalledWith('setting-general-verifySsl');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    getElementById.mockRestore();
  });

  it('returns false when no matching element exists', () => {
    const getElementById = vi.spyOn(document, 'getElementById').mockReturnValue(null);
    expect(focusSettingAnchor('general.verifySsl')).toBe(false);
    getElementById.mockRestore();
  });
});
