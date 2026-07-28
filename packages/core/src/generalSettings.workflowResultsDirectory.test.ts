import { describe, expect, it } from 'vitest';
import { normalizeGeneralSettings, DEFAULT_GENERAL_SETTINGS } from './generalSettings';

describe('normalizeGeneralSettings workflowResultsDirectory', () => {
  it('defaults to empty string', () => {
    expect(DEFAULT_GENERAL_SETTINGS.workflowResultsDirectory).toBe('');
    expect(normalizeGeneralSettings({}).workflowResultsDirectory).toBe('');
  });

  it('trims provided directory paths', () => {
    expect(
      normalizeGeneralSettings({
        workflowResultsDirectory: '  /tmp/workflow-results  '
      }).workflowResultsDirectory
    ).toBe('/tmp/workflow-results');
  });
});
