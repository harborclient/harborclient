import { describe, expect, it, vi } from 'vitest';
import {
  avatarVersionFromUrl,
  teamHubAvatarCacheKey,
  teamHubServerAvatarCacheKey
} from './teamHubAvatarImageCache';

describe('avatarVersionFromUrl', () => {
  it('reads the v query parameter from a relative avatar URL', () => {
    expect(avatarVersionFromUrl('/auth/users/user-1/avatar?v=1723118400000')).toBe('1723118400000');
  });

  it('returns undefined when the URL has no version', () => {
    expect(avatarVersionFromUrl('/auth/users/user-1/avatar')).toBeUndefined();
    expect(avatarVersionFromUrl(undefined)).toBeUndefined();
  });
});

describe('teamHubAvatarCacheKey', () => {
  it('includes hub, user, and version segments', () => {
    expect(teamHubAvatarCacheKey('hub-1', 'user-1', '42')).toBe('hub-1:user-1:42');
    expect(teamHubAvatarCacheKey('hub-1', 'user-1')).toBe('hub-1:user-1:');
  });
});

describe('teamHubServerAvatarCacheKey', () => {
  it('includes hub and version segments', () => {
    expect(teamHubServerAvatarCacheKey('hub-1', '42')).toBe('hub-1:hub:42');
    expect(teamHubServerAvatarCacheKey('hub-1')).toBe('hub-1:hub:');
  });
});

describe('primeTeamHubServerAvatarImage', () => {
  it('stores the data URL under the hub avatar cache key', async () => {
    const { primeTeamHubServerAvatarImage, loadTeamHubServerAvatarImage } =
      await import('./teamHubAvatarImageCache');

    primeTeamHubServerAvatarImage('hub-1', '/auth/hub/avatar?v=99', 'data:image/jpeg;base64,abc');

    const getTeamHubAvatar = vi.fn();
    vi.stubGlobal('window', {
      api: {
        getTeamHubAvatar
      }
    });

    await expect(loadTeamHubServerAvatarImage('hub-1', '/auth/hub/avatar?v=99')).resolves.toBe(
      'data:image/jpeg;base64,abc'
    );
    expect(getTeamHubAvatar).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
