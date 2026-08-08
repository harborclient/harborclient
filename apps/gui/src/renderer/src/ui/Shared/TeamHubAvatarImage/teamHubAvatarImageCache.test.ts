import { describe, expect, it } from 'vitest';
import { avatarVersionFromUrl, teamHubAvatarCacheKey } from './teamHubAvatarImageCache';

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
