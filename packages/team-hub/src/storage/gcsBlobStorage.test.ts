import { describe, expect, it, vi } from 'vitest';
import { GcsBlobStorage } from '#/storage/gcsBlobStorage.js';

describe('GcsBlobStorage', () => {
  it('puts, deletes, and signs objects through the GCS bucket API', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const getSignedUrl = vi.fn().mockResolvedValue(['https://signed.example/avatar.png']);
    const file = vi.fn().mockReturnValue({ save, delete: deleteFn, getSignedUrl });
    const bucket = { file } as never;

    const storage = new GcsBlobStorage(
      {
        driver: 'gcs',
        bucket: 'avatars',
        prefix: 'avatars',
        signedUrlTtlSeconds: 900
      },
      { bucket }
    );

    await storage.putObject('avatars/hub.png', Buffer.from('img'), 'image/png');
    expect(save).toHaveBeenCalledWith(Buffer.from('img'), {
      contentType: 'image/png',
      resumable: false
    });

    await storage.deleteObject('avatars/hub.png');
    expect(deleteFn).toHaveBeenCalledWith({ ignoreNotFound: true });

    await expect(storage.getSignedReadUrl('avatars/hub.png', 60)).resolves.toBe(
      'https://signed.example/avatar.png'
    );
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'v4',
        action: 'read'
      })
    );
  });
});
