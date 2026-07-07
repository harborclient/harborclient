import { describe, expect, it } from 'vitest';
import {
  resolveTeamHubAdminTabLabel,
  teamHubDisplayName
} from '#/renderer/src/ui/TeamHub/teamHubDisplayName';

describe('teamHubDisplayName', () => {
  it('prefers the trimmed display name', () => {
    expect(
      teamHubDisplayName({
        name: '  Local  ',
        baseUrl: 'http://127.0.0.1:8788'
      })
    ).toBe('Local');
  });

  it('falls back to the base URL when the name is empty', () => {
    expect(
      teamHubDisplayName({
        name: '   ',
        baseUrl: 'http://127.0.0.1:8788'
      })
    ).toBe('http://127.0.0.1:8788');
  });

  it('falls back to Untitled when both name and base URL are empty', () => {
    expect(
      teamHubDisplayName({
        name: '',
        baseUrl: ''
      })
    ).toBe('Untitled');
  });
});

describe('resolveTeamHubAdminTabLabel', () => {
  it('prefers the live hub record over the stored snapshot', () => {
    expect(
      resolveTeamHubAdminTabLabel({ hubId: 'hub-123', label: 'Old Name' }, [
        { id: 'hub-123', name: 'Local', baseUrl: 'http://127.0.0.1:8788', token: 'token' }
      ])
    ).toBe('Local');
  });

  it('uses the stored snapshot when the hub is not loaded yet', () => {
    expect(resolveTeamHubAdminTabLabel({ hubId: 'hub-123', label: 'Local' }, [])).toBe('Local');
  });

  it('falls back to Untitled when neither live nor snapshot labels exist', () => {
    expect(resolveTeamHubAdminTabLabel({ hubId: 'hub-123' }, [])).toBe('Untitled');
  });
});
