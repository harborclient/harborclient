import { describe, expect, it } from 'vitest';
import {
  avatarExtensionForMime,
  buildHubAvatarObjectKey,
  buildUserAvatarObjectKey
} from '#/storage/avatarObjectKeys.js';

describe('avatarObjectKeys', () => {
  it('maps common MIME types to extensions', () => {
    expect(avatarExtensionForMime('image/jpeg')).toBe('.jpg');
    expect(avatarExtensionForMime('image/png')).toBe('.png');
    expect(avatarExtensionForMime('image/webp')).toBe('.webp');
    expect(avatarExtensionForMime('image/gif')).toBe('.gif');
  });

  it('builds tenant-scoped hub and user keys', () => {
    expect(buildHubAvatarObjectKey('avatars', 'acme', 'image/png')).toBe(
      'avatars/tenants/acme/hub/avatar.png'
    );
    expect(buildUserAvatarObjectKey('avatars', 'acme', 'user-1', 'image/jpeg')).toBe(
      'avatars/tenants/acme/users/user-1/avatar.jpg'
    );
  });
});
