import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { UserRecord } from '#/db/types.js';
import {
  buildUserAvatarFieldsForCreate,
  ensureUserAvatar,
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
      /At least one of initials or color/i
    );
    expect(db.findUserById).not.toHaveBeenCalled();
  });
});
