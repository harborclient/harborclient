import { describe, expect, it } from 'vitest';
import { pageTabMeta } from '#/renderer/src/ui/Main/RequestEditor/TabBar/pageTabMeta';

describe('pageTabMeta', () => {
  it('uses the resolved team hub name for team hub admin tabs', () => {
    const meta = pageTabMeta(
      { type: 'team-hub-admin', hubId: 'hub-123', label: 'Local' },
      { teamHubName: 'Local' }
    );

    expect(meta.title).toBe('Local');
  });

  it('falls back to Untitled for team hub admin tabs without a resolved name', () => {
    const meta = pageTabMeta({ type: 'team-hub-admin', hubId: 'hub-123' });

    expect(meta.title).toBe('Untitled');
    expect(meta.title).not.toBe('Team Hub');
  });
});
