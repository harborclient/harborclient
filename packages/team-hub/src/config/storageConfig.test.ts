import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STORAGE_CONFIG,
  isExternalBlobStorage,
  normalizeStorageConfig
} from '#/config/storageConfig.js';

describe('normalizeStorageConfig', () => {
  it('defaults to the db driver when the section is omitted', () => {
    expect(normalizeStorageConfig()).toEqual(DEFAULT_STORAGE_CONFIG);
  });

  it('applies prefix and TTL overrides for the db driver', () => {
    expect(
      normalizeStorageConfig({
        driver: 'db',
        prefix: '/media/avatars/',
        signedUrlTtlSeconds: 60
      })
    ).toEqual({
      driver: 'db',
      prefix: 'media/avatars',
      signedUrlTtlSeconds: 60
    });
  });

  it('requires S3 credentials and bucket fields', () => {
    expect(() => normalizeStorageConfig({ driver: 's3' })).toThrow(/storage\.bucket/);
    expect(() =>
      normalizeStorageConfig({
        driver: 's3',
        bucket: 'avatars',
        region: 'us-east-1',
        accessKeyId: 'ak',
        secretAccessKey: 'sk'
      })
    ).not.toThrow();
  });

  it('normalizes an S3-compatible endpoint', () => {
    expect(
      normalizeStorageConfig({
        driver: 's3',
        bucket: 'avatars',
        region: 'us-east-1',
        endpoint: 'http://minio:9000',
        accessKeyId: 'ak',
        secretAccessKey: 'sk'
      })
    ).toMatchObject({
      driver: 's3',
      endpoint: 'http://minio:9000'
    });
  });

  it('requires a GCS bucket and allows ADC-only credentials', () => {
    expect(() => normalizeStorageConfig({ driver: 'gcs' })).toThrow(/storage\.bucket/);
    expect(
      normalizeStorageConfig({
        driver: 'gcs',
        bucket: 'team-hub-avatars',
        projectId: 'my-project'
      })
    ).toEqual({
      driver: 'gcs',
      bucket: 'team-hub-avatars',
      projectId: 'my-project',
      prefix: 'avatars',
      signedUrlTtlSeconds: 900
    });
  });

  it('rejects unknown drivers', () => {
    expect(() => normalizeStorageConfig({ driver: 'azure' })).toThrow(
      /Unsupported storage\.driver/
    );
  });
});

describe('isExternalBlobStorage', () => {
  it('is false for the db driver and true for s3/gcs', () => {
    expect(isExternalBlobStorage(DEFAULT_STORAGE_CONFIG)).toBe(false);
    expect(
      isExternalBlobStorage({
        driver: 's3',
        bucket: 'b',
        region: 'us-east-1',
        accessKeyId: 'a',
        secretAccessKey: 's',
        prefix: 'avatars',
        signedUrlTtlSeconds: 900
      })
    ).toBe(true);
    expect(
      isExternalBlobStorage({
        driver: 'gcs',
        bucket: 'b',
        prefix: 'avatars',
        signedUrlTtlSeconds: 900
      })
    ).toBe(true);
  });
});
