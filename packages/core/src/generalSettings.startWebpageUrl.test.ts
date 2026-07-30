import { describe, expect, it } from 'vitest';
import { normalizeGeneralSettings, DEFAULT_GENERAL_SETTINGS } from './generalSettings';

describe('normalizeGeneralSettings startWebpageUrl', () => {
  it('defaults to about:blank', () => {
    expect(DEFAULT_GENERAL_SETTINGS.startWebpageUrl).toBe('about:blank');
    expect(normalizeGeneralSettings({}).startWebpageUrl).toBe('about:blank');
  });

  it('trims provided URLs', () => {
    expect(
      normalizeGeneralSettings({
        startWebpageUrl: '  https://example.com/home  '
      }).startWebpageUrl
    ).toBe('https://example.com/home');
  });

  it('falls back to about:blank for empty or whitespace-only values', () => {
    expect(normalizeGeneralSettings({ startWebpageUrl: '' }).startWebpageUrl).toBe('about:blank');
    expect(normalizeGeneralSettings({ startWebpageUrl: '   ' }).startWebpageUrl).toBe(
      'about:blank'
    );
  });
});
