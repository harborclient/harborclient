import { describe, expect, it } from 'vitest';
import { collectFilesystemPathsFromPluginStorage } from './pluginStorageGrantPaths';

describe('collectFilesystemPathsFromPluginStorage', () => {
  it('collects dotenvPath fields from link and collection storage rows', () => {
    const paths = collectFilesystemPathsFromPluginStorage([
      {
        key: 'links',
        value: JSON.stringify([
          {
            collectionId: 6,
            dotenvPath: '/tmp/project/.env',
            environmentId: 1
          }
        ])
      },
      {
        key: 'collection:6',
        value: JSON.stringify({ dotenvPath: '/tmp/project/.env' })
      },
      {
        key: 'settings',
        value: JSON.stringify({ pollIntervalMs: 5000 })
      }
    ]);

    expect(paths).toEqual(['/tmp/project/.env']);
  });

  it('ignores invalid JSON and empty dotenvPath values', () => {
    const paths = collectFilesystemPathsFromPluginStorage([
      { key: 'broken', value: 'not-json' },
      { key: 'collection:1', value: JSON.stringify({ dotenvPath: '   ' }) }
    ]);

    expect(paths).toEqual([]);
  });
});
