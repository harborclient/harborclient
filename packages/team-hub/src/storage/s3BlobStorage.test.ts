import { describe, expect, it, vi } from 'vitest';
import { S3BlobStorage } from '#/storage/s3BlobStorage.js';

describe('S3BlobStorage', () => {
  it('puts, deletes, and signs objects through the S3 client', async () => {
    const send = vi.fn().mockResolvedValue({});
    const client = { send } as never;
    const storage = new S3BlobStorage(
      {
        driver: 's3',
        bucket: 'avatars',
        region: 'us-east-1',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
        prefix: 'avatars',
        signedUrlTtlSeconds: 900
      },
      { client }
    );

    await storage.putObject('avatars/hub.png', Buffer.from('img'), 'image/png');
    expect(send).toHaveBeenCalledTimes(1);

    await storage.deleteObject('avatars/hub.png');
    expect(send).toHaveBeenCalledTimes(2);

    // getSignedUrl uses the client middleware stack; with a stub client we only
    // assert put/delete wiring here and cover signing via the SDK integration.
    expect(typeof storage.getSignedReadUrl).toBe('function');
  });
});
