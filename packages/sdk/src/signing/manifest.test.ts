import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPluginManifestIdentity } from './manifest.js';
import { createTestPluginDir, createTestSnippetDir } from './testFixtures.js';

describe('readPluginManifestIdentity', () => {
  it('reads id and version from manifest.json when present', () => {
    const fixture = createTestPluginDir('com.example.plugin-manifest');

    try {
      expect(readPluginManifestIdentity(fixture.pluginDir)).toEqual({
        id: 'com.example.plugin-manifest',
        version: '1.0.0'
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('falls back to snippets.json when manifest.json is absent', () => {
    const fixture = createTestSnippetDir('com.example.snippet-manifest');

    try {
      expect(readPluginManifestIdentity(fixture.pluginDir)).toEqual({
        id: 'com.example.snippet-manifest',
        version: '1.0.0'
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('prefers manifest.json when both manifest files are present', () => {
    const fixture = createTestSnippetDir('com.example.snippet-only');

    try {
      writeFileSync(
        join(fixture.pluginDir, 'manifest.json'),
        JSON.stringify(
          {
            id: 'com.example.plugin-priority',
            name: 'Priority Plugin',
            version: '2.0.0',
            engines: { harborclient: '>=1.0.0' },
            renderer: 'dist/renderer.js',
            permissions: ['ui']
          },
          null,
          2
        )
      );

      expect(readPluginManifestIdentity(fixture.pluginDir)).toEqual({
        id: 'com.example.plugin-priority',
        version: '2.0.0'
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('throws when neither manifest.json nor snippets.json exists', () => {
    const fixture = createTestPluginDir();

    try {
      rmSync(join(fixture.pluginDir, 'manifest.json'));

      expect(() => readPluginManifestIdentity(fixture.pluginDir)).toThrow(
        /expected manifest\.json or snippets\.json/i
      );
    } finally {
      fixture.cleanup();
    }
  });
});
