import { describe, expect, it } from 'vitest';

import { settingAnchorId } from './settingAnchorId';

describe('settingAnchorId', () => {
  it('builds a stable DOM id from dotted setting ids', () => {
    expect(settingAnchorId('backup-restore.confirmations')).toBe(
      'setting-backup-restore-confirmations'
    );
    expect(settingAnchorId('general.verifySsl')).toBe('setting-general-verifySsl');
  });
});
