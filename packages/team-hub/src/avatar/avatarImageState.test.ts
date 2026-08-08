import { describe, expect, it } from 'vitest';
import { hasPersistedAvatarImage } from '#/avatar/avatarImageState.js';

describe('hasPersistedAvatarImage', () => {
  it('is true for a legacy base64 image', () => {
    expect(
      hasPersistedAvatarImage({
        avatarImage: 'abc',
        avatarImageKey: null,
        avatarImageMime: 'image/jpeg',
        avatarImageUpdatedAt: new Date()
      })
    ).toBe(true);
  });

  it('is true for an external object key', () => {
    expect(
      hasPersistedAvatarImage({
        avatarImage: null,
        avatarImageKey: 'avatars/tenants/t/users/u/avatar.jpg',
        avatarImageMime: 'image/jpeg',
        avatarImageUpdatedAt: new Date()
      })
    ).toBe(true);
  });

  it('is false when mime or timestamp is missing', () => {
    expect(
      hasPersistedAvatarImage({
        avatarImage: 'abc',
        avatarImageKey: null,
        avatarImageMime: null,
        avatarImageUpdatedAt: new Date()
      })
    ).toBe(false);
    expect(
      hasPersistedAvatarImage({
        avatarImage: null,
        avatarImageKey: 'key',
        avatarImageMime: 'image/png',
        avatarImageUpdatedAt: null
      })
    ).toBe(false);
  });
});
