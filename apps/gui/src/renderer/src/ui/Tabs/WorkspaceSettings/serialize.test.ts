import { describe, expect, it } from 'vitest';
import { serializeWorkspaceForm } from './serialize';

describe('serializeWorkspaceForm', () => {
  it('trims the name and includes the environment uuid', () => {
    expect(serializeWorkspaceForm('  Staging  ', 'env-uuid-1')).toBe(
      JSON.stringify({
        name: 'Staging',
        activeEnvironmentUuid: 'env-uuid-1'
      })
    );
  });

  it('treats null environment as no environment', () => {
    expect(serializeWorkspaceForm('Local', null)).toBe(
      JSON.stringify({
        name: 'Local',
        activeEnvironmentUuid: null
      })
    );
  });

  it('differs when name or environment changes', () => {
    const baseline = serializeWorkspaceForm('Local', 'env-a');
    expect(serializeWorkspaceForm('Local', 'env-a')).toBe(baseline);
    expect(serializeWorkspaceForm('Local ', 'env-a')).toBe(baseline);
    expect(serializeWorkspaceForm('Other', 'env-a')).not.toBe(baseline);
    expect(serializeWorkspaceForm('Local', null)).not.toBe(baseline);
  });
});
