import { describe, expect, it } from 'vitest';

import { buildSettingsSearchIndex, searchSettings } from '#/shared/search/settings';

describe('settingsSearch', () => {
  const index = buildSettingsSearchIndex();

  it('returns an empty array for an empty query', () => {
    expect(searchSettings(index, '')).toEqual([]);
    expect(searchSettings(index, '   ')).toEqual([]);
  });

  it('matches a field by label keyword', () => {
    const results = searchSettings(index, 'ssl');
    expect(results).toContain('general.verifySsl');
  });

  it('matches multiple proxy fields for a section term', () => {
    const results = searchSettings(index, 'proxy');
    expect(results).toContain('proxy.enabled');
    expect(results).toContain('proxy.host');
    expect(results.some((id) => id.startsWith('proxy.'))).toBe(true);
  });

  it('matches a management section by label', () => {
    const results = searchSettings(index, 'backup');
    expect(results).toContain('backup-restore');
  });

  it('matches a management section by keyword', () => {
    const results = searchSettings(index, 'variables');
    expect(results).toContain('globals');
  });

  it('matches the confirmations group by label keyword', () => {
    const results = searchSettings(index, 'confirmation');
    expect(results).toContain('backup-restore.confirmations');
  });

  it('matches the confirmations group by dont ask again keyword', () => {
    const results = searchSettings(index, "don't ask again");
    expect(results).toContain('backup-restore.confirmations');
  });

  it('returns results in catalog manifest order', () => {
    const results = searchSettings(index, 'api');
    const firstIndex = results.indexOf('ai.openaiApiKey');
    const secondIndex = results.indexOf('ai.claudeApiKey');
    const thirdIndex = results.indexOf('ai.geminiApiKey');

    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(thirdIndex).toBeGreaterThan(secondIndex);
  });
});
