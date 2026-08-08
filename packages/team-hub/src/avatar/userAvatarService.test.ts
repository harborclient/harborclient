import { describe, expect, it, vi } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { UserRecord } from '#/db/types.js';
import {
  buildUserAvatarFieldsForCreate,
  ensureUserAvatar,
  MAX_AVATAR_IMAGE_BYTES,
  parseAvatarImageDataUrl,
  resolveUserAvatarFromRecord,
  updateUserAvatar
} from '#/avatar/userAvatarService.js';
import { sampleAttribution } from '#/server/routes/test/sampleAttribution.js';

const sampleUser: UserRecord = {
  id: 'user-abc',
  name: 'Alice Example',
  role: 'user',
  collectionAccess: ['*'],
  environmentAccess: ['*'],
  snippetAccess: ['*'],
  liveServerAccess: ['*'],
  livePageAccess: ['*'],
  llmAccess: false,
  llmModels: [],
  llmMonthlyTokenLimit: null,
  avatarInitials: null,
  avatarColor: null,
  avatarImage: null,
  avatarImageKey: null,
  avatarImageMime: null,
  avatarImageUpdatedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...sampleAttribution
};

describe('buildUserAvatarFieldsForCreate', () => {
  it('auto-assigns initials and deterministic color when overrides are omitted', () => {
    const avatar = buildUserAvatarFieldsForCreate('Alice Example', 'user-abc');
    expect(avatar.avatarInitials).toBe('AE');
    expect(avatar.avatarColor).toBeTruthy();
  });

  it('persists admin-provided overrides', () => {
    const avatar = buildUserAvatarFieldsForCreate('Alice Example', 'user-abc', {
      avatarInitials: 'AX',
      avatarColor: 'rose-600'
    });
    expect(avatar).toEqual({
      avatarInitials: 'AX',
      avatarColor: 'rose-600'
    });
  });
});

describe('resolveUserAvatarFromRecord', () => {
  it('uses persisted avatar fields when present', () => {
    expect(
      resolveUserAvatarFromRecord({
        ...sampleUser,
        avatarInitials: 'AX',
        avatarColor: 'teal-600'
      })
    ).toEqual({
      id: 'user-abc',
      name: 'Alice Example',
      initials: 'AX',
      color: 'teal-600'
    });
  });

  it('computes defaults without requiring persisted values', () => {
    const resolved = resolveUserAvatarFromRecord(sampleUser);
    expect(resolved.initials).toBe('AE');
    expect(resolved.color).toBeTruthy();
  });
});

describe('ensureUserAvatar', () => {
  it('persists defaults for users missing avatar fields', async () => {
    const db = createStubDatabase();
    const persisted = {
      ...sampleUser,
      avatarInitials: 'AE',
      avatarColor: 'sky-600'
    };
    db.findUserById.mockResolvedValueOnce(sampleUser).mockResolvedValueOnce(persisted);
    db.updateUser.mockResolvedValue(persisted);

    const avatar = await ensureUserAvatar(db, sampleUser.id);

    expect(avatar.initials).toBe('AE');
    expect(db.updateUser).toHaveBeenCalledWith(
      sampleUser.id,
      expect.objectContaining({
        avatarInitials: 'AE',
        avatarColor: expect.any(String)
      }),
      sampleUser.id
    );
  });
});

describe('parseAvatarImageDataUrl', () => {
  it('accepts a JPEG data URL under the size cap', () => {
    const base64 = Buffer.from('tiny-jpeg').toString('base64');
    const decoded = parseAvatarImageDataUrl(`data:image/jpeg;base64,${base64}`);
    expect(decoded.mime).toBe('image/jpeg');
    expect(decoded.base64).toBe(base64);
    expect(decoded.byteLength).toBe(Buffer.from('tiny-jpeg').byteLength);
  });

  it('rejects unsupported mime types', () => {
    expect(() => parseAvatarImageDataUrl('data:image/svg+xml;base64,YQ==')).toThrow(
      /not supported/i
    );
  });

  it('rejects oversized payloads', () => {
    const oversized = Buffer.alloc(MAX_AVATAR_IMAGE_BYTES + 1, 1).toString('base64');
    expect(() => parseAvatarImageDataUrl(`data:image/png;base64,${oversized}`)).toThrow(
      /maximum size/i
    );
  });
});

describe('updateUserAvatar', () => {
  it('updates initials and color for the target user', async () => {
    const db = createStubDatabase();
    const updated = {
      ...sampleUser,
      avatarInitials: 'AL',
      avatarColor: 'violet-600'
    };
    db.findUserById.mockResolvedValueOnce(sampleUser).mockResolvedValueOnce(updated);
    db.updateUser.mockResolvedValue(updated);

    const avatar = await updateUserAvatar(
      db,
      sampleUser.id,
      { initials: 'AL', color: 'violet-600' },
      'admin-1'
    );

    expect(avatar).toEqual({
      id: sampleUser.id,
      name: sampleUser.name,
      initials: 'AL',
      color: 'violet-600'
    });
    expect(db.updateUser).toHaveBeenCalledWith(
      sampleUser.id,
      {
        avatarInitials: 'AL',
        avatarColor: 'violet-600'
      },
      'admin-1'
    );
  });

  it('requires at least one avatar field', async () => {
    const db = createStubDatabase();
    await expect(updateUserAvatar(db, sampleUser.id, {}, 'admin-1')).rejects.toThrow(
      /At least one of initials, color, or imageDataUrl/i
    );
    expect(db.findUserById).not.toHaveBeenCalled();
  });

  it('persists an uploaded image data URL', async () => {
    const db = createStubDatabase();
    const base64 = Buffer.from('tiny-jpeg').toString('base64');
    const updatedAt = new Date('2026-08-08T12:00:00.000Z');
    const updated = {
      ...sampleUser,
      avatarInitials: 'AE',
      avatarColor: 'sky-600',
      avatarImage: base64,
      avatarImageMime: 'image/jpeg',
      avatarImageUpdatedAt: updatedAt
    };
    db.findUserById.mockResolvedValueOnce(sampleUser);
    db.updateUser.mockResolvedValue(updated);

    const avatar = await updateUserAvatar(
      db,
      sampleUser.id,
      { imageDataUrl: `data:image/jpeg;base64,${base64}` },
      sampleUser.id
    );

    expect(avatar.imageUrl).toBe(`/auth/users/${sampleUser.id}/avatar?v=${updatedAt.getTime()}`);
    expect(db.updateUser).toHaveBeenCalledWith(
      sampleUser.id,
      expect.objectContaining({
        avatarImage: base64,
        avatarImageMime: 'image/jpeg'
      }),
      sampleUser.id
    );
  });

  it('stores an object key and clears base64 when external storage is configured', async () => {
    const db = createStubDatabase();
    db.getTenantId.mockReturnValue('__default__');
    const base64 = Buffer.from('tiny-jpeg').toString('base64');
    const updatedAt = new Date('2026-08-08T12:00:00.000Z');
    const putObject = vi.fn().mockResolvedValue(undefined);
    const blobStorage = {
      putObject,
      deleteObject: vi.fn(),
      getSignedReadUrl: vi.fn()
    };
    const updated = {
      ...sampleUser,
      avatarImage: null,
      avatarImageKey: `avatars/tenants/__default__/users/${sampleUser.id}/avatar.jpg`,
      avatarImageMime: 'image/jpeg',
      avatarImageUpdatedAt: updatedAt
    };
    db.findUserById.mockResolvedValueOnce(sampleUser);
    db.updateUser.mockResolvedValue(updated);

    const avatar = await updateUserAvatar(
      db,
      sampleUser.id,
      { imageDataUrl: `data:image/jpeg;base64,${base64}` },
      sampleUser.id,
      {
        storage: {
          driver: 's3',
          bucket: 'avatars',
          region: 'us-east-1',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
          prefix: 'avatars',
          signedUrlTtlSeconds: 900
        },
        blobStorage
      }
    );

    expect(putObject).toHaveBeenCalledWith(
      `avatars/tenants/__default__/users/${sampleUser.id}/avatar.jpg`,
      Buffer.from(base64, 'base64'),
      'image/jpeg'
    );
    expect(db.updateUser).toHaveBeenCalledWith(
      sampleUser.id,
      expect.objectContaining({
        avatarImage: null,
        avatarImageKey: `avatars/tenants/__default__/users/${sampleUser.id}/avatar.jpg`,
        avatarImageMime: 'image/jpeg'
      }),
      sampleUser.id
    );
    expect(avatar.imageUrl).toBe(`/auth/users/${sampleUser.id}/avatar?v=${updatedAt.getTime()}`);
  });
});
