import { describe, expect, it } from 'vitest';
import { avatarColorFromSeed } from '#/avatar/avatarPresentation.js';
import {
  ensureHubAvatar,
  resolveHubAvatarFromTenant,
  updateHubAvatar
} from '#/avatar/hubAvatarService.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { TenantRecord } from '#/db/types.js';

const sampleTenant: TenantRecord = {
  id: 'org-acme',
  name: 'Acme Corp',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdByUserId: 'admin-1',
  updatedByUserId: 'admin-1',
  avatarInitials: null,
  avatarColor: null,
  avatarImage: null,
  avatarImageMime: null,
  avatarImageUpdatedAt: null
};

describe('resolveHubAvatarFromTenant', () => {
  it('returns persisted avatar fields when present', () => {
    expect(
      resolveHubAvatarFromTenant({
        ...sampleTenant,
        avatarInitials: 'AC',
        avatarColor: 'rose-600'
      })
    ).toEqual({
      name: 'Acme Corp',
      initials: 'AC',
      color: 'rose-600'
    });
  });

  it('derives defaults without persisting when avatar fields are missing', () => {
    expect(resolveHubAvatarFromTenant(sampleTenant)).toEqual({
      name: 'Acme Corp',
      initials: 'AC',
      color: avatarColorFromSeed('org-acme')
    });
  });
});

describe('ensureHubAvatar', () => {
  it('persists default avatar fields when missing', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue(sampleTenant);
    db.updateTenantAvatar.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AC',
      avatarColor: avatarColorFromSeed('org-acme')
    });

    const avatar = await ensureHubAvatar(db, 'org-acme');

    expect(avatar.initials).toBe('AC');
    expect(db.updateTenantAvatar).toHaveBeenCalledWith(
      'org-acme',
      'AC',
      avatarColorFromSeed('org-acme'),
      null
    );
  });

  it('skips writes when avatar fields are already persisted', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AC',
      avatarColor: 'cyan-600'
    });

    const avatar = await ensureHubAvatar(db, 'org-acme');

    expect(avatar).toEqual({
      name: 'Acme Corp',
      initials: 'AC',
      color: 'cyan-600'
    });
    expect(db.updateTenantAvatar).not.toHaveBeenCalled();
  });
});

describe('updateHubAvatar', () => {
  it('updates initials and color for admins', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AC',
      avatarColor: 'cyan-600'
    });
    db.updateTenantAvatar.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AX',
      avatarColor: 'amber-600'
    });

    const avatar = await updateHubAvatar(
      db,
      'org-acme',
      { initials: 'ax', color: 'amber-600' },
      'admin-1'
    );

    expect(avatar).toEqual({
      name: 'Acme Corp',
      initials: 'AX',
      color: 'amber-600'
    });
    expect(db.updateTenantAvatar).toHaveBeenCalledWith(
      'org-acme',
      'AX',
      'amber-600',
      'admin-1',
      undefined
    );
  });

  it('requires at least one field', async () => {
    const db = createStubDatabase();
    await expect(updateHubAvatar(db, 'org-acme', {}, 'admin-1')).rejects.toThrow(
      /At least one of initials, color, or imageDataUrl is required/i
    );
    expect(db.findTenantById).not.toHaveBeenCalled();
  });

  it('persists an uploaded image data URL', async () => {
    const db = createStubDatabase();
    const base64 = Buffer.from('tiny-jpeg').toString('base64');
    const updatedAt = new Date('2026-08-08T12:00:00.000Z');
    db.findTenantById.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AC',
      avatarColor: 'cyan-600'
    });
    db.updateTenantAvatar.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AC',
      avatarColor: 'cyan-600',
      avatarImage: base64,
      avatarImageMime: 'image/jpeg',
      avatarImageUpdatedAt: updatedAt
    });

    const avatar = await updateHubAvatar(
      db,
      'org-acme',
      { imageDataUrl: `data:image/jpeg;base64,${base64}` },
      'admin-1'
    );

    expect(avatar.imageUrl).toBe(`/auth/hub/avatar?v=${updatedAt.getTime()}`);
    expect(db.updateTenantAvatar).toHaveBeenCalledWith(
      'org-acme',
      'AC',
      'cyan-600',
      'admin-1',
      expect.objectContaining({
        imageBase64: base64,
        mime: 'image/jpeg'
      })
    );
  });

  it('clears an uploaded image when imageDataUrl is null', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AC',
      avatarColor: 'cyan-600',
      avatarImage: 'abc',
      avatarImageMime: 'image/jpeg',
      avatarImageUpdatedAt: new Date('2026-08-08T12:00:00.000Z')
    });
    db.updateTenantAvatar.mockResolvedValue({
      ...sampleTenant,
      avatarInitials: 'AC',
      avatarColor: 'cyan-600',
      avatarImage: null,
      avatarImageMime: null,
      avatarImageUpdatedAt: null
    });

    const avatar = await updateHubAvatar(db, 'org-acme', { imageDataUrl: null }, 'admin-1');

    expect(avatar.imageUrl).toBeUndefined();
    expect(db.updateTenantAvatar).toHaveBeenCalledWith('org-acme', 'AC', 'cyan-600', 'admin-1', {
      imageBase64: null,
      mime: null,
      updatedAt: null
    });
  });
});
