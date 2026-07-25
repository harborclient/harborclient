import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Temporary Ed25519 key pair for signing tests.
 */
export interface TestSigningKeys {
  privateKeyPem: string;
  publicKeyPem: string;
}

/**
 * Generates an Ed25519 PEM key pair for tests.
 */
export function createTestSigningKeys(): TestSigningKeys {
  const pair = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return {
    privateKeyPem: pair.privateKey,
    publicKeyPem: pair.publicKey
  };
}

/**
 * Creates a minimal plugin directory suitable for signing tests.
 *
 * @param pluginId - Plugin manifest id.
 */
export function createTestPluginDir(pluginId = 'com.example.test-plugin'): {
  pluginDir: string;
  cleanup: () => void;
} {
  const pluginDir = mkdtempSync(join(tmpdir(), 'hc-plugin-sign-'));
  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  writeFileSync(
    join(pluginDir, 'manifest.json'),
    JSON.stringify(
      {
        id: pluginId,
        name: 'Test Plugin',
        version: '1.0.0',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        permissions: ['ui']
      },
      null,
      2
    )
  );
  writeFileSync(join(pluginDir, 'dist', 'renderer.js'), 'export function activate() {}');

  return {
    pluginDir,
    cleanup: () => {
      rmSync(pluginDir, { recursive: true, force: true });
    }
  };
}

/**
 * Creates a minimal snippet bundle directory suitable for signing tests.
 *
 * @param catalogId - Snippet bundle id from snippets.json.
 */
export function createTestSnippetDir(catalogId = 'com.example.test-snippets'): {
  pluginDir: string;
  cleanup: () => void;
} {
  const pluginDir = mkdtempSync(join(tmpdir(), 'hc-snippet-sign-'));
  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  writeFileSync(
    join(pluginDir, 'snippets.json'),
    JSON.stringify(
      {
        id: catalogId,
        name: 'Test Snippets',
        version: '1.0.0',
        summary: 'Test snippet bundle for signing.',
        author: 'Example Inc.',
        categories: ['testing'],
        engines: { harborclient: '>=2.0.0' },
        snippets: [{ name: 'Tester', where: 'post-request', file: 'dist/tester.js' }]
      },
      null,
      2
    )
  );
  writeFileSync(join(pluginDir, 'dist', 'tester.js'), 'hc.test("ok", () => true);');

  return {
    pluginDir,
    cleanup: () => {
      rmSync(pluginDir, { recursive: true, force: true });
    }
  };
}
